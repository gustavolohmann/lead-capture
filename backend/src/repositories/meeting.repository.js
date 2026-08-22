import { db } from '../config/database.js';

export const meetingRepository = {
  async listBySeller(userId, { limit = 100 } = {}) {
    return db('meetings')
      .where({ seller_user_id: userId })
      .whereNot('status', 'FAILED')
      .orderBy('start_at', 'desc')
      .limit(limit);
  },

  async findByIdForSeller(userId, id) {
    return db('meetings').where({ seller_user_id: userId, id }).first();
  },

  async findByIdempotency(userId, idempotencyKey) {
    if (!idempotencyKey) return null;
    return db('meetings')
      .where({ seller_user_id: userId, idempotency_key: idempotencyKey })
      .first();
  },

  async findByManageToken(token) {
    return db('meetings').where({ public_manage_token: token }).first();
  },

  async findOverlapping({ sellerUserId, startAt, endAt, excludeId = null }) {
    const q = db('meetings')
      .where({ seller_user_id: sellerUserId })
      .whereIn('status', ['PENDING', 'SCHEDULED'])
      .andWhere('start_at', '<', endAt)
      .andWhere('end_at', '>', startAt);
    if (excludeId) q.andWhereNot('id', excludeId);
    return q;
  },

  async listBusyForSeller({ sellerUserId, from, to }) {
    return db('meetings')
      .where({ seller_user_id: sellerUserId })
      .whereIn('status', ['PENDING', 'SCHEDULED'])
      .andWhere('start_at', '<', to)
      .andWhere('end_at', '>', from)
      .select('id', 'start_at', 'end_at', 'status');
  },

  async create(row) {
    const [id] = await db('meetings').insert({
      company_id: row.companyId,
      seller_user_id: row.sellerUserId,
      lead_id: row.leadId ?? null,
      meeting_type_id: row.meetingTypeId ?? null,
      customer_name: row.customerName,
      customer_email: row.customerEmail,
      customer_phone: row.customerPhone ?? null,
      title: row.title,
      start_at: row.startAt,
      end_at: row.endAt,
      timezone: row.timezone,
      status: row.status || 'SCHEDULED',
      calendar_provider: row.calendarProvider ?? null,
      provider_event_id: row.providerEventId ?? null,
      provider_calendar_id: row.providerCalendarId ?? null,
      meeting_url: row.meetingUrl ?? null,
      source: row.source || 'MANUAL',
      public_manage_token: row.publicManageToken ?? null,
      idempotency_key: row.idempotencyKey ?? null,
    });
    return db('meetings').where({ id }).first();
  },

  async update(id, patch) {
    const data = { updated_at: db.fn.now() };
    const map = {
      startAt: 'start_at',
      endAt: 'end_at',
      status: 'status',
      providerEventId: 'provider_event_id',
      providerCalendarId: 'provider_calendar_id',
      meetingUrl: 'meeting_url',
      calendarProvider: 'calendar_provider',
      cancelledAt: 'cancelled_at',
      title: 'title',
    };
    for (const [k, col] of Object.entries(map)) {
      if (patch[k] !== undefined) data[col] = patch[k];
    }
    await db('meetings').where({ id }).update(data);
    return db('meetings').where({ id }).first();
  },

  async withSellerLock(sellerUserId, fn) {
    const lockName = `meeting_book_${sellerUserId}`;
    const [rows] = await db.raw('SELECT GET_LOCK(?, 10) as got', [lockName]);
    const got = rows?.[0]?.got;
    if (Number(got) !== 1) {
      const err = new Error('Não foi possível obter lock de agendamento');
      err.code = 'BOOKING_LOCK_TIMEOUT';
      throw err;
    }
    try {
      return await fn();
    } finally {
      await db.raw('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  },
};
