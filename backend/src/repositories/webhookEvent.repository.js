import { db } from '../config/database.js';

export const webhookEventRepository = {
  async create({ provider, eventId, payload }) {
    try {
      const [id] = await db('webhook_events').insert({
        provider,
        event_id: eventId,
        payload: payload ? JSON.stringify(payload) : null,
        processed: 0,
      });
      return db('webhook_events').where({ id }).first();
    } catch (error) {
      // Duplicate UNIQUE(provider, event_id)
      if (error?.code === 'ER_DUP_ENTRY') {
        return null;
      }
      throw error;
    }
  },

  async exists(provider, eventId) {
    const row = await db('webhook_events')
      .where({ provider, event_id: eventId })
      .first('id');
    return Boolean(row);
  },

  async markProcessed(provider, eventId) {
    await db('webhook_events')
      .where({ provider, event_id: eventId })
      .update({ processed: 1 });
  },

  async findByProviderAndEventId(provider, eventId) {
    return db('webhook_events')
      .where({ provider, event_id: eventId })
      .first();
  },
};
