import { db } from '../config/database.js';

export const notificationRepository = {
  async create({
    companyId,
    userId,
    type,
    title,
    message,
    conversationId,
    messageId,
  }) {
    try {
      const [id] = await db('notifications').insert({
        company_id: companyId,
        user_id: userId,
        type,
        title,
        message: message ?? null,
        conversation_id: conversationId ?? null,
        message_id: messageId ?? null,
      });
      return this.findById(id, companyId, userId);
    } catch (error) {
      // Idempotência: webhook/retry não duplica notificação por mensagem+usuário
      if (error?.code === 'ER_DUP_ENTRY' && messageId) {
        return this.findByUserAndMessage(userId, messageId, companyId);
      }
      throw error;
    }
  },

  async findById(id, companyId, userId) {
    return db('notifications')
      .where({ id, company_id: companyId, user_id: userId })
      .first();
  },

  async findByUserAndMessage(userId, messageId, companyId) {
    return db('notifications')
      .where({
        user_id: userId,
        message_id: messageId,
        company_id: companyId,
      })
      .first();
  },

  async countUnread(companyId, userId) {
    const row = await db('notifications')
      .where({ company_id: companyId, user_id: userId })
      .whereNull('read_at')
      .count({ count: '*' })
      .first();
    return Number(row?.count || 0);
  },

  async listUnread(companyId, userId, { limit = 50 } = {}) {
    return db('notifications')
      .where({ company_id: companyId, user_id: userId })
      .whereNull('read_at')
      .orderBy('created_at', 'desc')
      .limit(limit);
  },

  async markRead(id, companyId, userId) {
    await db('notifications')
      .where({ id, company_id: companyId, user_id: userId })
      .whereNull('read_at')
      .update({ read_at: db.fn.now() });
    return this.findById(id, companyId, userId);
  },

  async markAllRead(companyId, userId) {
    await db('notifications')
      .where({ company_id: companyId, user_id: userId })
      .whereNull('read_at')
      .update({ read_at: db.fn.now() });
  },

  async markConversationRead(companyId, userId, conversationId) {
    await db('notifications')
      .where({
        company_id: companyId,
        user_id: userId,
        conversation_id: conversationId,
      })
      .whereNull('read_at')
      .update({ read_at: db.fn.now() });
  },
};
