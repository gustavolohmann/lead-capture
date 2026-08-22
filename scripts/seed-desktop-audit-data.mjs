/**
 * Seed local (apenas ambiente de dev) para auditoria visual de tabelas cheias.
 * Uso: node scripts/seed-desktop-audit-data.mjs [--clean]
 */
import { createKnex } from './db.js';

const db = createKnex();
const clean = process.argv.includes('--clean');
const user = await db('users').where({ email: 'dev@localhost.com' }).first();
const companyId = Number(user.company_id);

await db('campaigns').where({ company_id: companyId }).where('campaign_id', 'like', 'seed_ui_%').del();
await db('whatsapp_templates')
  .where({ company_id: companyId })
  .where('meta_template_id', 'like', 'seed_ui_%')
  .del();

const seededConversations = await db('conversations')
  .where({ company_id: companyId })
  .where('external_user_id', 'like', 'seed_ui_%')
  .pluck('id');

if (seededConversations.length > 0) {
  await db('messages').whereIn('conversation_id', seededConversations).del();
  await db('conversations').whereIn('id', seededConversations).del();
}

if (clean) {
  console.log('CLEANED');
  await db.destroy();
  process.exit(0);
}

const adAccount = await db('meta_ad_accounts')
  .where({ company_id: companyId })
  .first()
  .catch(() => null);

const campaigns = [
  ['Cotação Seguro Auto 2026 — Leads frios SP/RJ', 'OUTCOME_LEADS', 'ACTIVE', 50],
  ['Leads Imóveis Premium', 'OUTCOME_LEADS', 'ACTIVE', 120.5],
  ['Captação Curso Online', 'OUTCOME_LEADS', 'PAUSED', 35],
  ['Demo SaaS B2B', 'OUTCOME_LEADS', 'ACTIVE', 200],
  ['Clínica Estética — Agendamentos', 'OUTCOME_LEADS', 'PAUSED', 80],
  ['Mensagens WhatsApp — Barbearia', 'OUTCOME_ENGAGEMENT', 'ACTIVE', 25],
  ['Tráfego Blog Institucional', 'OUTCOME_TRAFFIC', 'ERROR', 15],
  ['Black Friday — Remarketing', 'OUTCOME_LEADS', 'ACTIVE', 1500],
  ['Teste criativo A/B vídeo curto', 'OUTCOME_LEADS', 'DRAFT', null],
  ['Campanha encerrada 2025', 'OUTCOME_LEADS', 'ARCHIVED', 40],
];

let i = 0;
for (const [name, objective, status, budget] of campaigns) {
  i += 1;
  await db('campaigns').insert({
    company_id: companyId,
    ad_account_id: adAccount?.id ?? null,
    campaign_id: `seed_ui_${i}`,
    name,
    objective,
    status,
    daily_budget: budget,
    created_at: new Date(Date.now() - i * 86400000),
    updated_at: new Date(),
  });
}

const templates = [
  ['boas_vindas_lead', 'pt_BR', 'UTILITY', 'APPROVED', null],
  ['follow_up_24h', 'pt_BR', 'UTILITY', 'APPROVED', null],
  ['promo_black_friday_desconto_progressivo', 'pt_BR', 'MARKETING', 'REJECTED', 'INVALID_FORMAT'],
  ['codigo_verificacao', 'pt_BR', 'AUTHENTICATION', 'PENDING', null],
  ['reengajamento_carrinho', 'pt_BR', 'MARKETING', 'PAUSED', null],
];

i = 0;
for (const [name, language, category, status, reason] of templates) {
  i += 1;
  await db('whatsapp_templates').insert({
    company_id: companyId,
    waba_id: 'seed_ui_waba',
    meta_template_id: `seed_ui_${i}`,
    name,
    language,
    category,
    status,
    rejected_reason: reason,
    rejection_info: reason
      ? JSON.stringify({ reason: 'Corpo com formatação de variável inválida.' })
      : null,
    components: JSON.stringify([
      { type: 'BODY', text: 'Olá {{1}}, recebemos seu interesse. Podemos falar agora?' },
    ]),
    created_at: new Date(),
    updated_at: new Date(),
  });
}

const leads = await db('leads')
  .where({ company_id: companyId })
  .orderBy('id', 'desc')
  .select('id', 'name')
  .limit(9);

const MIN = 60 * 1000;
const conversations = [
  {
    channel: 'WHATSAPP',
    status: 'OPEN',
    messages: [
      ['INBOUND', 'Oi, vi o anúncio do seguro. Quanto fica pro meu carro?', 240],
      ['OUTBOUND', 'Olá! Claro. Qual o modelo e o ano do veículo?', 232],
      ['INBOUND', 'Onix 2021, moro em São Paulo', 228],
      ['OUTBOUND', 'Perfeito. Consigo uma cotação hoje ainda. Você prefere cobertura compreensiva ou só terceiros?', 220],
      ['INBOUND', 'Compreensiva', 12],
    ],
  },
  {
    channel: 'WHATSAPP',
    status: 'OPEN',
    messages: [
      ['INBOUND', 'bom dia', 180],
      ['OUTBOUND', 'Bom dia! Como posso ajudar?', 175],
      [
        'INBOUND',
        'Recebi a proposta por e-mail mas não consegui abrir o anexo. Você pode reenviar? Também queria entender melhor a diferença entre as duas franquias que aparecem na primeira página, porque uma delas parece bem mais alta e não ficou claro o que muda no atendimento em caso de sinistro.',
        170,
      ],
      ['OUTBOUND', 'Reenviei agora. A franquia maior reduz a mensalidade, mas você paga mais no acionamento.', 165],
    ],
  },
  {
    channel: 'INSTAGRAM',
    status: 'OPEN',
    messages: [
      ['INBOUND', 'oi! vcs atendem em bh? 😄', 90],
      ['OUTBOUND', 'Atendemos sim! Me passa seu WhatsApp que continuo o atendimento por lá.', 85],
      ['INBOUND', '31 99999-0000', 80],
    ],
  },
  {
    channel: 'INSTAGRAM',
    status: 'OPEN',
    messages: [
      ['INBOUND', 'quanto custa?', 45],
    ],
  },
  {
    channel: 'MESSENGER',
    status: 'OPEN',
    messages: [
      ['INBOUND', 'Vi a página de vocês, o link do formulário não abriu', 30],
      [
        'OUTBOUND',
        'Pode tentar por aqui: http://localhost:5173/f/2?utm_source=messenger&utm_medium=social&utm_campaign=cotacao-seguro-auto-2026',
        28,
      ],
      ['INBOUND', 'abriu agora, obrigado', 25],
    ],
  },
  {
    channel: 'MESSENGER',
    status: 'CLOSED',
    messages: [
      ['INBOUND', 'Já fechei com outra corretora, obrigado', 60 * 24 * 3],
      ['OUTBOUND', 'Sem problema! Qualquer coisa estamos por aqui.', 60 * 24 * 3 - 5],
    ],
  },
  {
    channel: 'WHATSAPP',
    status: 'OPEN',
    messages: [
      ['OUTBOUND', 'Olá! Recebemos seu interesse pelo formulário. Podemos falar agora?', 60 * 24 * 5],
    ],
  },
];

let convCount = 0;
let msgCount = 0;
for (const [index, conv] of conversations.entries()) {
  const lead = leads[index];
  if (!lead) break;

  const lastAgo = conv.messages[conv.messages.length - 1][2];
  const [conversationId] = await db('conversations').insert({
    company_id: companyId,
    lead_id: lead.id,
    channel: conv.channel,
    external_user_id: `seed_ui_${index + 1}`,
    meta_phone_number_id: conv.channel === 'WHATSAPP' ? 'seed_ui_phone' : null,
    status: conv.status,
    created_at: new Date(Date.now() - conv.messages[0][2] * MIN),
    updated_at: new Date(Date.now() - lastAgo * MIN),
  });
  convCount += 1;

  for (const [direction, content, minutesAgo] of conv.messages) {
    await db('messages').insert({
      conversation_id: conversationId,
      company_id: companyId,
      direction,
      content,
      external_message_id: null,
      status: direction === 'OUTBOUND' ? 'SENT' : null,
      created_at: new Date(Date.now() - minutesAgo * MIN),
    });
    msgCount += 1;
  }
}

console.log(
  'SEEDED campaigns=%d templates=%d conversas=%d mensagens=%d',
  campaigns.length,
  templates.length,
  convCount,
  msgCount
);
await db.destroy();
