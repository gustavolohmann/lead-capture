import { db } from '../config/database.js';

export const meetingTypeRepository = {
  async listByUser(userId) {
    return db('meeting_types')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
  },

  async findByIdForUser(userId, id) {
    return db('meeting_types').where({ user_id: userId, id }).first();
  },

  async findActiveBySlugs(userSlug, meetingSlug) {
    return db('meeting_types as mt')
      .join('users as u', 'u.id', 'mt.user_id')
      .where({
        'u.scheduling_slug': userSlug,
        'mt.slug': meetingSlug,
        'mt.is_active': 1,
        'u.status': 'ACTIVE',
      })
      .select(
        'mt.*',
        'u.id as seller_user_id',
        'u.name as seller_name',
        'u.timezone as seller_timezone',
        'u.scheduling_slug as seller_slug',
        'u.company_id as seller_company_id'
      )
      .first();
  },

  async create(row) {
    const [id] = await db('meeting_types').insert({
      company_id: row.companyId,
      user_id: row.userId,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      duration_minutes: row.durationMinutes,
      location_type: row.locationType || 'GOOGLE_MEET',
      is_active: row.isActive === false ? 0 : 1,
      buffer_before_minutes: row.bufferBeforeMinutes ?? 0,
      buffer_after_minutes: row.bufferAfterMinutes ?? 0,
      minimum_notice_minutes: row.minimumNoticeMinutes ?? 60,
      booking_window_days: row.bookingWindowDays ?? 14,
    });
    return db('meeting_types').where({ id }).first();
  },

  async updateForUser(userId, id, patch) {
    const data = { updated_at: db.fn.now() };
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.slug !== undefined) data.slug = patch.slug;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.durationMinutes !== undefined) {
      data.duration_minutes = patch.durationMinutes;
    }
    if (patch.locationType !== undefined) data.location_type = patch.locationType;
    if (patch.isActive !== undefined) data.is_active = patch.isActive ? 1 : 0;
    if (patch.bufferBeforeMinutes !== undefined) {
      data.buffer_before_minutes = patch.bufferBeforeMinutes;
    }
    if (patch.bufferAfterMinutes !== undefined) {
      data.buffer_after_minutes = patch.bufferAfterMinutes;
    }
    if (patch.minimumNoticeMinutes !== undefined) {
      data.minimum_notice_minutes = patch.minimumNoticeMinutes;
    }
    if (patch.bookingWindowDays !== undefined) {
      data.booking_window_days = patch.bookingWindowDays;
    }
    await db('meeting_types').where({ user_id: userId, id }).update(data);
    return this.findByIdForUser(userId, id);
  },

  async softDisable(userId, id) {
    await db('meeting_types')
      .where({ user_id: userId, id })
      .update({ is_active: 0, updated_at: db.fn.now() });
    return this.findByIdForUser(userId, id);
  },
};
