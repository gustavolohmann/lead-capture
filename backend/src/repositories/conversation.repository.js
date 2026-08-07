import { db } from '../config/database.js';
import { ConversationStatus } from '../models/conversation.model.js';

export const conversationRepository = {
  async create({
    companyId,
    leadId,
    channel,
    externalUserId,
    status = ConversationStatus.OPEN,
  }) {
    const [id] = await db('conversations').insert({
      company_id: companyId,
      lead_id: leadId,
      channel,
      external_user_id: externalUserId ?? null,
      status,
    });
    return this.findById(id, companyId);
  },

  async findById(id, companyId) {
    return db('conversations as c')
      .leftJoin('leads as l', 'l.id', 'c.lead_id')
      .select(
        'c.*',
        'l.name as lead_name',
        'l.phone as lead_phone',
        'l.email as lead_email'
      )
      .where({ 'c.id': id, 'c.company_id': companyId })
      .first();
  },

  async findByCompanyId(companyId) {
    const lastMessage = db('messages as m')
      .select(
        'm.conversation_id',
        'm.content as last_message_preview',
        'm.created_at as last_message_at',
        'm.direction as last_message_direction'
      )
      .whereRaw(
        'm.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.conversation_id = m.conversation_id AND m2.company_id = ?)',
        [companyId]
      )
      .as('lm');

    return db('conversations as c')
      .leftJoin('leads as l', 'l.id', 'c.lead_id')
      .leftJoin(lastMessage, 'lm.conversation_id', 'c.id')
      .select(
        'c.*',
        'l.name as lead_name',
        'l.phone as lead_phone',
        'l.email as lead_email',
        'lm.last_message_preview',
        'lm.last_message_at',
        'lm.last_message_direction'
      )
      .where({ 'c.company_id': companyId })
      .orderBy('c.updated_at', 'desc');
  },

  async findByLeadAndChannel(companyId, leadId, channel) {
    return db('conversations')
      .where({
        company_id: companyId,
        lead_id: leadId,
        channel,
      })
      .first();
  },

  async findByExternalUserId(companyId, channel, externalUserId) {
    if (!externalUserId) return null;
    return db('conversations as c')
      .leftJoin('leads as l', 'l.id', 'c.lead_id')
      .select(
        'c.*',
        'l.name as lead_name',
        'l.phone as lead_phone',
        'l.email as lead_email'
      )
      .where({
        'c.company_id': companyId,
        'c.channel': channel,
        'c.external_user_id': String(externalUserId),
      })
      .first();
  },

  async upsertByLeadChannel({
    companyId,
    leadId,
    channel,
    externalUserId,
  }) {
    const existing = await this.findByLeadAndChannel(
      companyId,
      leadId,
      channel
    );
    if (existing) {
      if (externalUserId && !existing.external_user_id) {
        await db('conversations')
          .where({ id: existing.id, company_id: companyId })
          .update({ external_user_id: externalUserId });
      }
      return this.findById(existing.id, companyId);
    }
    return this.create({
      companyId,
      leadId,
      channel,
      externalUserId,
    });
  },

  async updateMetaPhoneNumberId(id, companyId, metaPhoneNumberId) {
    if (!id || !companyId || !metaPhoneNumberId) return;
    await db('conversations')
      .where({ id, company_id: companyId })
      .update({ meta_phone_number_id: String(metaPhoneNumberId) });
  },
};
