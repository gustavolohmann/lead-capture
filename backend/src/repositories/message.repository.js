import { db } from '../config/database.js';

export const messageRepository = {
  async create({
    companyId,
    conversationId,
    direction,
    content,
    externalMessageId,
    status,
  }) {
    const [id] = await db('messages').insert({
      company_id: companyId,
      conversation_id: conversationId,
      direction,
      content,
      external_message_id: externalMessageId ?? null,
      status: status ?? null,
    });

    await db('conversations')
      .where({ id: conversationId, company_id: companyId })
      .update({ updated_at: db.fn.now() });

    return this.findById(id, companyId);
  },

  async findById(id, companyId) {
    return db('messages').where({ id, company_id: companyId }).first();
  },

  async findByConversationId(conversationId, companyId) {
    return db('messages')
      .where({ conversation_id: conversationId, company_id: companyId })
      .orderBy('created_at', 'asc');
  },
};
