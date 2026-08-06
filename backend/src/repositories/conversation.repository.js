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
    return db('conversations as c')
      .leftJoin('leads as l', 'l.id', 'c.lead_id')
      .select(
        'c.*',
        'l.name as lead_name',
        'l.phone as lead_phone',
        'l.email as lead_email'
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
};
