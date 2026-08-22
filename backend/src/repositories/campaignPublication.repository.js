import { db } from '../config/database.js';

function serializeJson(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export const campaignPublicationRepository = {
  async findByKey(companyId, idempotencyKey) {
    return db('campaign_publications')
      .where({ company_id: companyId, idempotency_key: idempotencyKey })
      .first();
  },

  async begin({ companyId, idempotencyKey, requestHash }) {
    try {
      const [id] = await db('campaign_publications').insert({
        company_id: companyId,
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        status: 'IN_PROGRESS',
      });
      const row = await db('campaign_publications').where({ id }).first();
      return { created: true, row };
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error;
      return {
        created: false,
        row: await this.findByKey(companyId, idempotencyKey),
      };
    }
  },

  async complete(companyId, id, { campaignId, result }) {
    await db('campaign_publications')
      .where({ company_id: companyId, id })
      .update({
        campaign_id: campaignId ?? null,
        status: 'COMPLETED',
        result: serializeJson(result),
        error: null,
      });
  },

  async restartFailed(companyId, id) {
    const updated = await db('campaign_publications')
      .where({ company_id: companyId, id, status: 'FAILED' })
      .update({ status: 'IN_PROGRESS', error: null, result: null });
    if (!updated) return null;
    return db('campaign_publications').where({ company_id: companyId, id }).first();
  },

  async fail(companyId, id, error, { cleanupRequired = false } = {}) {
    await db('campaign_publications')
      .where({ company_id: companyId, id })
      .update({
        status: cleanupRequired ? 'CLEANUP_REQUIRED' : 'FAILED',
        error: serializeJson({
          message: error?.message || 'Falha ao publicar campanha',
          code: error?.code || null,
          statusCode: error?.statusCode || null,
          cleanupContext: error?.cleanupContext || null,
        }),
      });
  },
};
