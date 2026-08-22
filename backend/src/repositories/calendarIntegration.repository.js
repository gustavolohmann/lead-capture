import { db } from '../config/database.js';

export const calendarIntegrationRepository = {
  async upsertGoogle({
    companyId,
    userId,
    providerAccountId,
    providerEmail,
    calendarId,
    encryptedRefreshToken,
    encryptedAccessToken,
    accessTokenExpiresAt,
    scopes,
    status = 'CONNECTED',
  }) {
    const existing = await db('calendar_integrations')
      .where({ user_id: userId, provider: 'GOOGLE' })
      .first();

    const payload = {
      company_id: companyId,
      user_id: userId,
      provider: 'GOOGLE',
      provider_account_id: providerAccountId,
      provider_email: providerEmail,
      calendar_id: calendarId || 'primary',
      encrypted_refresh_token: encryptedRefreshToken,
      encrypted_access_token: encryptedAccessToken,
      access_token_expires_at: accessTokenExpiresAt,
      scopes,
      status,
      last_sync_at: db.fn.now(),
      updated_at: db.fn.now(),
    };

    if (existing) {
      // Keep previous refresh token if Google didn't return a new one
      if (!encryptedRefreshToken) {
        delete payload.encrypted_refresh_token;
      }
      await db('calendar_integrations').where({ id: existing.id }).update(payload);
      return this.findByUserAndProvider(userId, 'GOOGLE');
    }

    const [id] = await db('calendar_integrations').insert(payload);
    return db('calendar_integrations').where({ id }).first();
  },

  async findByUserAndProvider(userId, provider = 'GOOGLE') {
    return db('calendar_integrations')
      .where({ user_id: userId, provider })
      .first();
  },

  async findConnectedByUser(userId) {
    return db('calendar_integrations')
      .where({ user_id: userId, status: 'CONNECTED' })
      .first();
  },

  async updateTokens(id, {
    encryptedAccessToken,
    encryptedRefreshToken,
    accessTokenExpiresAt,
    status,
  }) {
    const data = { updated_at: db.fn.now() };
    if (encryptedAccessToken !== undefined) {
      data.encrypted_access_token = encryptedAccessToken;
    }
    if (encryptedRefreshToken !== undefined) {
      data.encrypted_refresh_token = encryptedRefreshToken;
    }
    if (accessTokenExpiresAt !== undefined) {
      data.access_token_expires_at = accessTokenExpiresAt;
    }
    if (status !== undefined) data.status = status;
    await db('calendar_integrations').where({ id }).update(data);
    return db('calendar_integrations').where({ id }).first();
  },

  async markStatus(userId, provider, status) {
    await db('calendar_integrations')
      .where({ user_id: userId, provider })
      .update({ status, updated_at: db.fn.now() });
  },

  async disconnect(userId, provider = 'GOOGLE') {
    await db('calendar_integrations')
      .where({ user_id: userId, provider })
      .update({
        status: 'DISCONNECTED',
        encrypted_refresh_token: null,
        encrypted_access_token: null,
        access_token_expires_at: null,
        updated_at: db.fn.now(),
      });
  },
};
