import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import request from 'supertest';
import {
  db,
  resetTestData,
  seedMasterUser,
  seedMetaFixtures,
  seedSecondCompanyUser,
  TEST_MASTER,
  TEST_USER_B,
} from './helpers/fixtures.js';
import { loginAs } from './helpers/http.js';
import {
  connectSocket,
  expectNoEvent,
  startRealtimeServer,
  stopRealtimeServer,
  waitForEvent,
} from './helpers/realtime.js';
import { messagingService } from '../../../backend/src/services/messaging.service.js';
import { ConversationChannel } from '../../../backend/src/models/conversation.model.js';
import {
  MessageDirection,
  MessageStatus,
} from '../../../backend/src/models/message.model.js';

function buildWhatsappPayload({
  wabaId,
  phoneNumberId,
  messageId,
  from = '554188877766',
  text = 'Olá, gostaria de saber mais',
}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: 'João Silva' }, wa_id: from }],
              messages: [
                {
                  id: messageId,
                  from,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('E2E Realtime Conversas + Notificações', () => {
  let baseUrl;

  beforeEach(async () => {
    await resetTestData();
    await stopRealtimeServer();
    const started = await startRealtimeServer();
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await stopRealtimeServer();
    await db.destroy();
  });

  test('Teste 1 — webhook salva mensagem, emite socket e atualiza API', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const meta = await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const token = login.body.token;

    const socket = connectSocket(baseUrl, token);
    await waitForEvent(socket, 'connect');

    const messageEventPromise = waitForEvent(socket, 'message.created');
    const notificationPromise = waitForEvent(socket, 'notification.created');

    const payload = buildWhatsappPayload({
      wabaId: meta.wabaId,
      phoneNumberId: meta.phoneNumberId,
      messageId: 'wamid_realtime_1',
    });

    const webhookRes = await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(payload);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.processed).toBe(1);

    const messageEvent = await messageEventPromise;
    expect(messageEvent.message.content).toContain('Olá');
    expect(messageEvent.message.companyId).toBe(companyId);
    expect(messageEvent.message.direction).toBe('INBOUND');

    const notification = await notificationPromise;
    expect(notification.type).toBe('NEW_MESSAGE');
    expect(notification.conversationId).toBe(messageEvent.message.conversationId);

    const messagesInDb = await db('messages').where({ company_id: companyId });
    expect(messagesInDb).toHaveLength(1);

    const apiMessages = await request(baseUrl)
      .get(`/api/conversations/${messageEvent.message.conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(apiMessages.status).toBe(200);
    expect(apiMessages.body.messages).toHaveLength(1);

    const unread = await request(baseUrl)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    // Ao listar mensagens marcamos a conversa como lida
    expect(unread.body.count).toBe(0);

    socket.disconnect();
  });

  test('Teste 2 — isolamento por company (empresa B não recebe evento)', async () => {
    const companyA = await seedMasterUser({ withCompany: true });
    const metaA = await seedMetaFixtures(companyA.companyId);
    const companyB = await seedSecondCompanyUser();
    await seedMetaFixtures(companyB.companyId);

    const loginA = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const loginB = await loginAs(TEST_USER_B.email, TEST_USER_B.password);

    const socketA = connectSocket(baseUrl, loginA.body.token);
    const socketB = connectSocket(baseUrl, loginB.body.token);
    await Promise.all([
      waitForEvent(socketA, 'connect'),
      waitForEvent(socketB, 'connect'),
    ]);

    const eventA = waitForEvent(socketA, 'message.created');
    const noEventB = expectNoEvent(socketB, 'message.created', 1000);

    await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(
        buildWhatsappPayload({
          wabaId: metaA.wabaId,
          phoneNumberId: metaA.phoneNumberId,
          messageId: 'wamid_iso_a',
          text: 'Mensagem só para A',
        })
      );

    const receivedA = await eventA;
    expect(receivedA.message.companyId).toBe(companyA.companyId);
    await noEventB;

    socketA.disconnect();
    socketB.disconnect();
  });

  test('Teste 3 — conversa aberta recebe mensagem sem refresh', async () => {
    const { companyId, userId } = await seedMasterUser({ withCompany: true });
    const meta = await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const token = login.body.token;

    const lead = await db('leads')
      .insert({
        company_id: companyId,
        name: 'Lead Conversa',
        phone: '554188877766',
        email: null,
        source: 'WHATSAPP_INBOUND',
        origin: 'whatsapp_inbound',
        status: 'NEW',
      })
      .then(([id]) => db('leads').where({ id }).first());

    const conversation = await messagingService.createOrGetConversation({
      companyId,
      leadId: lead.id,
      channel: ConversationChannel.WHATSAPP,
      externalUserId: '554188877766',
    });

    const socket = connectSocket(baseUrl, token);
    await waitForEvent(socket, 'connect');
    socket.emit('conversation:join', { conversationId: conversation.id });
    await new Promise((r) => setTimeout(r, 150));

    const messagePromise = waitForEvent(socket, 'message.created');
    // Com conversa aberta, notificação não deve ser criada para o viewer
    const noNotification = expectNoEvent(socket, 'notification.created', 900);

    await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(
        buildWhatsappPayload({
          wabaId: meta.wabaId,
          phoneNumberId: meta.phoneNumberId,
          messageId: 'wamid_open_thread',
          text: 'Mensagem na thread aberta',
        })
      );

    const event = await messagePromise;
    expect(event.message.conversationId).toBe(conversation.id);
    expect(event.message.content).toContain('thread aberta');
    await noNotification;

    const notifications = await db('notifications').where({
      company_id: companyId,
      user_id: userId,
    });
    expect(notifications).toHaveLength(0);

    socket.disconnect();
  });

  test('Teste 4 — outra tela incrementa sino (unread-count)', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const meta = await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const token = login.body.token;

    const socket = connectSocket(baseUrl, token);
    await waitForEvent(socket, 'connect');

    const notificationPromise = waitForEvent(socket, 'notification.created');

    await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(
        buildWhatsappPayload({
          wabaId: meta.wabaId,
          phoneNumberId: meta.phoneNumberId,
          messageId: 'wamid_bell_1',
          text: 'Ping no sino',
        })
      );

    await notificationPromise;

    const unread = await request(baseUrl)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(unread.status).toBe(200);
    expect(unread.body.count).toBe(1);

    socket.disconnect();
  });

  test('Teste 5 — offline: mensagem fica no MySQL e volta via API', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const meta = await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const token = login.body.token;

    await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(
        buildWhatsappPayload({
          wabaId: meta.wabaId,
          phoneNumberId: meta.phoneNumberId,
          messageId: 'wamid_offline_1',
          text: 'Chegou offline',
        })
      );

    const conversations = await request(baseUrl)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(conversations.status).toBe(200);
    expect(conversations.body.conversations.length).toBeGreaterThanOrEqual(1);

    const conversationId = conversations.body.conversations[0].id;
    const messages = await request(baseUrl)
      .get(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(messages.body.messages.some((m) => m.content.includes('offline'))).toBe(
      true
    );
  });

  test('Teste 6 — reconexão restaura room sem duplicar mensagem no estado', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const meta = await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const token = login.body.token;

    let socket = connectSocket(baseUrl, token);
    await waitForEvent(socket, 'connect');

    await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(
        buildWhatsappPayload({
          wabaId: meta.wabaId,
          phoneNumberId: meta.phoneNumberId,
          messageId: 'wamid_reconnect_seed',
          text: 'Seed',
        })
      );

    const conversations = await request(baseUrl)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${token}`);
    const conversationId = conversations.body.conversations[0].id;

    socket.emit('conversation:join', { conversationId });
    await new Promise((r) => setTimeout(r, 100));
    socket.disconnect();

    socket = connectSocket(baseUrl, token);
    await waitForEvent(socket, 'connect');
    socket.emit('conversation:join', { conversationId });
    await new Promise((r) => setTimeout(r, 100));

    const nextEvent = waitForEvent(socket, 'message.created');
    await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(
        buildWhatsappPayload({
          wabaId: meta.wabaId,
          phoneNumberId: meta.phoneNumberId,
          messageId: 'wamid_reconnect_2',
          text: 'Após reconnect',
        })
      );

    const event = await nextEvent;
    expect(event.message.content).toContain('Após reconnect');

    const dbMessages = await db('messages').where({
      company_id: companyId,
      conversation_id: conversationId,
    });
    expect(dbMessages).toHaveLength(2);

    socket.disconnect();
  });

  test('Teste 7 — conversa de outra company → 404', async () => {
    const companyA = await seedMasterUser({ withCompany: true });
    const companyB = await seedSecondCompanyUser();

    const [leadId] = await db('leads').insert({
      company_id: companyA.companyId,
      name: 'Lead A',
      phone: '5541999000111',
      source: 'WHATSAPP_INBOUND',
      origin: 'whatsapp_inbound',
      status: 'NEW',
    });

    const conversation = await messagingService.createOrGetConversation({
      companyId: companyA.companyId,
      leadId,
      channel: ConversationChannel.WHATSAPP,
      externalUserId: '5541999000111',
    });

    const loginB = await loginAs(TEST_USER_B.email, TEST_USER_B.password);
    const res = await request(baseUrl)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${loginB.body.token}`);

    expect([403, 404]).toContain(res.status);

    const contactRes = await request(baseUrl)
      .get(`/api/conversations/${conversation.id}/contact`)
      .set('Authorization', `Bearer ${loginB.body.token}`);
    expect([403, 404]).toContain(contactRes.status);

    // Socket join de conversa alheia
    const socketB = connectSocket(baseUrl, loginB.body.token);
    await waitForEvent(socketB, 'connect');
    const errorPromise = waitForEvent(socketB, 'error');
    socketB.emit('conversation:join', { conversationId: conversation.id });
    const error = await errorPromise;
    expect(error.code).toBe('FORBIDDEN_CONVERSATION');
    socketB.disconnect();

    void companyB;
  });

  test('Teste 8 — webhook duplicado não cria mensagem/notificação duplicada', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const meta = await seedMetaFixtures(companyId);
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const token = login.body.token;

    const socket = connectSocket(baseUrl, token);
    await waitForEvent(socket, 'connect');

    const payload = buildWhatsappPayload({
      wabaId: meta.wabaId,
      phoneNumberId: meta.phoneNumberId,
      messageId: 'wamid_dup_1',
      text: 'Duplicada?',
    });

    const firstEvent = waitForEvent(socket, 'message.created');
    const first = await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(payload);
    expect(first.body.processed).toBe(1);
    await firstEvent;

    const second = await request(baseUrl)
      .post('/webhooks/meta/whatsapp')
      .send(payload);
    expect(second.body.processed).toBe(0);

    await expectNoEvent(socket, 'message.created', 700);

    const messages = await db('messages').where({ company_id: companyId });
    expect(messages).toHaveLength(1);

    const notifications = await db('notifications').where({
      company_id: companyId,
    });
    expect(notifications).toHaveLength(1);

    const unread = await request(baseUrl)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(unread.body.count).toBe(1);

    socket.disconnect();
  });

  test('JWT inválido rejeita conexão socket', async () => {
    const socket = connectSocket(baseUrl, 'token.invalido');
    const err = await waitForEvent(socket, 'connect_error');
    expect(String(err.message || err)).toMatch(/UNAUTHORIZED|unauthorized/i);
    socket.disconnect();
  });

  test('Painel de contato retorna dados do lead sem inventar campos', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);

    const [leadId] = await db('leads').insert({
      company_id: companyId,
      name: 'Maria Contato',
      phone: '5541999111222',
      email: 'maria@example.com',
      source: 'META_LEAD_ADS',
      origin: 'Lead Ads · Campanha Curitiba',
      campaign_name: 'Imóveis Curitiba',
      ad_name: 'Anúncio Centro',
      form_name: 'Form Lead',
      status: 'NEW',
    });

    const conversation = await messagingService.createOrGetConversation({
      companyId,
      leadId,
      channel: ConversationChannel.WHATSAPP,
      externalUserId: '5541999111222',
    });

    const res = await request(baseUrl)
      .get(`/api/conversations/${conversation.id}/contact`)
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.contact.name).toBe('Maria Contato');
    expect(res.body.contact.phone).toBe('5541999111222');
    expect(res.body.contact.email).toBe('maria@example.com');
    expect(res.body.contact.campaignName).toBe('Imóveis Curitiba');
    expect(res.body.contact.socialUsername).toBeNull();
    expect(res.body.contact.profilePictureUrl).toBeNull();
  });

  test('saveMessage emite message.created após persistir (ordem banco → evento)', async () => {
    const { companyId } = await seedMasterUser({ withCompany: true });
    const login = await loginAs(TEST_MASTER.email, TEST_MASTER.password);
    const socket = connectSocket(baseUrl, login.body.token);
    await waitForEvent(socket, 'connect');

    const [leadId] = await db('leads').insert({
      company_id: companyId,
      name: 'Ordem Evento',
      phone: '5541999000222',
      source: 'WHATSAPP_INBOUND',
      origin: 'whatsapp_inbound',
      status: 'NEW',
    });

    const conversation = await messagingService.createOrGetConversation({
      companyId,
      leadId,
      channel: ConversationChannel.WHATSAPP,
      externalUserId: '5541999000222',
    });

    const eventPromise = waitForEvent(socket, 'message.created');
    const saved = await messagingService.saveMessage({
      companyId,
      conversationId: conversation.id,
      direction: MessageDirection.OUTBOUND,
      content: 'Resposta manual',
      externalMessageId: 'out_order_1',
      status: MessageStatus.SENT,
    });

    const event = await eventPromise;
    expect(event.message.id).toBe(saved.id);

    const row = await db('messages').where({ id: saved.id }).first();
    expect(row).toBeTruthy();

    socket.disconnect();
  });
});
