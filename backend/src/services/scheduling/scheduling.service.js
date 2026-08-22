import crypto from 'node:crypto';
import { DateTime } from 'luxon';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { userRepository } from '../../repositories/user.repository.js';
import { availabilityRuleRepository } from '../../repositories/availabilityRule.repository.js';
import { meetingTypeRepository } from '../../repositories/meetingType.repository.js';
import { meetingRepository } from '../../repositories/meeting.repository.js';
import { leadRepository } from '../../repositories/lead.repository.js';
import { googleCalendarAuthService } from '../calendar/google.auth.service.js';
import { googleCalendarProvider } from '../calendar/google.calendar.provider.js';
import { generateAvailableSlots } from './availability.slots.js';
import {
  toPublicAvailabilityRule,
  toPublicMeeting,
  toPublicMeetingType,
} from '../../models/scheduling.model.js';

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function ensureSlug(user) {
  if (user.scheduling_slug) return user.scheduling_slug;
  const base = slugify(user.name) || `user-${user.id}`;
  return `${base}-${user.id}`;
}

async function ensureUserSlug(user) {
  if (user.scheduling_slug) return user;
  const slug = ensureSlug(user);
  return userRepository.updateSchedulingProfile(user.id, {
    schedulingSlug: slug,
    timezone: user.timezone || 'America/Sao_Paulo',
  });
}

function toMysqlDateTime(date) {
  return DateTime.fromJSDate(new Date(date), { zone: 'utc' }).toFormat(
    'yyyy-MM-dd HH:mm:ss'
  );
}

async function assertSlotFree({
  sellerUserId,
  startAt,
  endAt,
  meetingType,
  timezone,
  excludeId = null,
}) {
  const rules = await availabilityRuleRepository.listByUser(sellerUserId);
  if (!rules.length) {
    throw new AppError('Horário indisponível', {
      statusCode: 409,
      code: 'SLOT_UNAVAILABLE',
    });
  }

  const day = DateTime.fromJSDate(startAt, { zone: 'utc' }).setZone(timezone);
  const windowStart = day.startOf('day');
  const windowEnd = day.endOf('day');

  const { accessToken, calendarId } =
    await googleCalendarAuthService.getValidAccessToken(sellerUserId);
  const googleBusy = await googleCalendarProvider.getBusyTimes(accessToken, {
    calendarId,
    timeMin: windowStart.toUTC().toJSDate(),
    timeMax: windowEnd.toUTC().toJSDate(),
  });
  const localBusy = await meetingRepository.listBusyForSeller({
    sellerUserId,
    from: toMysqlDateTime(windowStart.toUTC().toJSDate()),
    to: toMysqlDateTime(windowEnd.toUTC().toJSDate()),
  });

  const busy = [
    ...googleBusy,
    ...localBusy
      .filter((m) => !excludeId || Number(m.id) !== Number(excludeId))
      .map((m) => ({ start: new Date(m.start_at), end: new Date(m.end_at) })),
  ];

  const slots = generateAvailableSlots({
    rules: rules.map((r) => ({
      dayOfWeek: r.day_of_week,
      startTime: String(r.start_time).slice(0, 5),
      endTime: String(r.end_time).slice(0, 5),
    })),
    timezone,
    from: windowStart.toJSDate(),
    to: windowEnd.toJSDate(),
    durationMinutes: meetingType.duration_minutes,
    bufferBeforeMinutes: meetingType.buffer_before_minutes,
    bufferAfterMinutes: meetingType.buffer_after_minutes,
    minimumNoticeMinutes: meetingType.minimum_notice_minutes,
    busy,
  });

  const startIso = DateTime.fromJSDate(startAt, { zone: 'utc' })
    .setZone(timezone)
    .toISO({ includeOffset: true });
  const ok = slots.some((s) => s.start === startIso);
  if (!ok) {
    throw new AppError('Horário indisponível', {
      statusCode: 409,
      code: 'SLOT_UNAVAILABLE',
    });
  }

  const overlaps = await meetingRepository.findOverlapping({
    sellerUserId,
    startAt: toMysqlDateTime(startAt),
    endAt: toMysqlDateTime(endAt),
    excludeId,
  });
  if (overlaps.length) {
    throw new AppError('Horário indisponível', {
      statusCode: 409,
      code: 'SLOT_UNAVAILABLE',
    });
  }
}

async function bookMeeting({
  companyId,
  sellerUserId,
  meetingType,
  startAt,
  customer,
  leadId,
  source,
  idempotencyKey,
  timezone,
}) {
  if (idempotencyKey) {
    const existing = await meetingRepository.findByIdempotency(
      sellerUserId,
      idempotencyKey
    );
    if (existing) return toPublicMeeting(existing);
  }

  const start = DateTime.fromISO(startAt);
  if (!start.isValid) {
    throw new AppError('Horário inválido.', {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  const end = start.plus({ minutes: meetingType.duration_minutes });

  try {
    return await meetingRepository.withSellerLock(sellerUserId, async () => {
      await assertSlotFree({
        sellerUserId,
        startAt: start.toUTC().toJSDate(),
        endAt: end.toUTC().toJSDate(),
        meetingType,
        timezone,
      });

      const { accessToken, calendarId } =
        await googleCalendarAuthService.getValidAccessToken(sellerUserId);

      const title = `${meetingType.name} com ${customer.name}`;
      const createMeet = meetingType.location_type === 'GOOGLE_MEET';
      const key = idempotencyKey || crypto.randomUUID();

      // Estratégia falha parcial: cria no Google primeiro; se DB falhar, remove evento.
      let providerEvent;
      try {
        providerEvent = await googleCalendarProvider.createEvent(accessToken, {
          calendarId,
          summary: title,
          description: `Agendado via Lead Capture\nContato: ${customer.email}${
            customer.phone ? `\nTelefone: ${customer.phone}` : ''
          }`,
          start: start.toUTC().toJSDate(),
          end: end.toUTC().toJSDate(),
          timezone,
          attendees: customer.email
            ? [{ email: customer.email, displayName: customer.name }]
            : [],
          createMeet,
          idempotencyKey: key,
        });
      } catch (error) {
        throw error;
      }

      try {
        const row = await meetingRepository.create({
          companyId,
          sellerUserId,
          leadId,
          meetingTypeId: meetingType.id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone || null,
          title,
          startAt: toMysqlDateTime(start.toUTC().toJSDate()),
          endAt: toMysqlDateTime(end.toUTC().toJSDate()),
          timezone,
          status: 'SCHEDULED',
          calendarProvider: 'GOOGLE',
          providerEventId: providerEvent.eventId,
          providerCalendarId: providerEvent.calendarId,
          meetingUrl: providerEvent.meetingUrl,
          source,
          publicManageToken: crypto.randomBytes(24).toString('hex'),
          idempotencyKey: key,
        });
        logger.info('Reunião criada', {
          meetingId: row.id,
          sellerUserId,
          source,
        });
        return toPublicMeeting(row);
      } catch (error) {
        try {
          await googleCalendarProvider.deleteEvent(accessToken, {
            calendarId: providerEvent.calendarId,
            eventId: providerEvent.eventId,
          });
        } catch (cleanupError) {
          logger.error('Falha ao compensar evento Google após erro de DB', {
            eventId: providerEvent.eventId,
          });
        }
        throw error;
      }
    });
  } catch (error) {
    if (error.code === 'BOOKING_LOCK_TIMEOUT') {
      throw new AppError('Horário indisponível', {
        statusCode: 409,
        code: 'SLOT_UNAVAILABLE',
      });
    }
    throw error;
  }
}

export const schedulingService = {
  async getProfile(userId) {
    let user = await userRepository.findByIdWithRole(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    }
    user = await ensureUserSlug(user);
    const calendar = await googleCalendarAuthService.getStatus(userId);
    return {
      timezone: user.timezone || 'America/Sao_Paulo',
      schedulingSlug: user.scheduling_slug,
      publicBasePath: `/agendar/${user.scheduling_slug}`,
      calendar,
    };
  },

  async updateProfile(userId, { timezone, schedulingSlug }) {
    if (schedulingSlug) {
      const slug = slugify(schedulingSlug);
      if (slug.length < 3) {
        throw new AppError('Slug inválido.', {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
      const taken = await userRepository.findBySchedulingSlug(slug);
      if (taken && Number(taken.id) !== Number(userId)) {
        throw new AppError('Este slug já está em uso.', {
          statusCode: 409,
          code: 'SLUG_TAKEN',
        });
      }
      schedulingSlug = slug;
    }
    const user = await userRepository.updateSchedulingProfile(userId, {
      timezone,
      schedulingSlug,
    });
    return this.getProfile(user.id);
  },

  async getAvailability(userId) {
    const user = await userRepository.findByIdWithRole(userId);
    const rows = await availabilityRuleRepository.listByUser(userId);
    return {
      timezone: user?.timezone || 'America/Sao_Paulo',
      rules: rows.map(toPublicAvailabilityRule),
    };
  },

  async putAvailability(companyId, userId, { timezone, rules }) {
    const tz = timezone || 'America/Sao_Paulo';
    for (const rule of rules) {
      if (rule.startTime >= rule.endTime) {
        throw new AppError('Intervalo inválido: início deve ser antes do fim.', {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    }
    await userRepository.updateSchedulingProfile(userId, { timezone: tz });
    const rows = await availabilityRuleRepository.replaceForUser({
      companyId,
      userId,
      timezone: tz,
      rules,
    });
    return {
      timezone: tz,
      rules: rows.map(toPublicAvailabilityRule),
    };
  },

  async listMeetingTypes(userId) {
    const user = await ensureUserSlug(await userRepository.findByIdWithRole(userId));
    const rows = await meetingTypeRepository.listByUser(userId);
    return rows.map((row) =>
      toPublicMeetingType(row, { sellerSlug: user.scheduling_slug })
    );
  },

  async createMeetingType(companyId, userId, body) {
    const user = await ensureUserSlug(await userRepository.findByIdWithRole(userId));
    const slug = slugify(body.slug || body.name);
    const row = await meetingTypeRepository.create({
      companyId,
      userId,
      name: body.name,
      slug,
      description: body.description,
      durationMinutes: body.durationMinutes,
      locationType: body.locationType,
      isActive: body.isActive,
      bufferBeforeMinutes: body.bufferBeforeMinutes,
      bufferAfterMinutes: body.bufferAfterMinutes,
      minimumNoticeMinutes: body.minimumNoticeMinutes,
      bookingWindowDays: body.bookingWindowDays,
    });
    return toPublicMeetingType(row, { sellerSlug: user.scheduling_slug });
  },

  async updateMeetingType(userId, id, body) {
    const user = await ensureUserSlug(await userRepository.findByIdWithRole(userId));
    const existing = await meetingTypeRepository.findByIdForUser(userId, id);
    if (!existing) {
      throw new AppError('Tipo de reunião não encontrado.', {
        statusCode: 404,
        code: 'MEETING_TYPE_NOT_FOUND',
      });
    }
    const patch = { ...body };
    if (body.slug) patch.slug = slugify(body.slug);
    const row = await meetingTypeRepository.updateForUser(userId, id, patch);
    return toPublicMeetingType(row, { sellerSlug: user.scheduling_slug });
  },

  async deleteMeetingType(userId, id) {
    const row = await meetingTypeRepository.softDisable(userId, id);
    if (!row) {
      throw new AppError('Tipo de reunião não encontrado.', {
        statusCode: 404,
        code: 'MEETING_TYPE_NOT_FOUND',
      });
    }
    return { success: true };
  },

  async listMeetings(userId) {
    const rows = await meetingRepository.listBySeller(userId);
    return rows.map(toPublicMeeting);
  },

  async getMeeting(userId, id) {
    const row = await meetingRepository.findByIdForSeller(userId, id);
    if (!row) {
      throw new AppError('Reunião não encontrada.', {
        statusCode: 404,
        code: 'MEETING_NOT_FOUND',
      });
    }
    return toPublicMeeting(row);
  },

  async getPublicPage(sellerSlug, meetingSlug) {
    const mt = await meetingTypeRepository.findActiveBySlugs(
      sellerSlug,
      meetingSlug
    );
    if (!mt) {
      throw new AppError('Página de agendamento não encontrada.', {
        statusCode: 404,
        code: 'SCHEDULING_PAGE_NOT_FOUND',
      });
    }
    return {
      seller: {
        name: mt.seller_name,
        slug: mt.seller_slug,
        timezone: mt.seller_timezone || 'America/Sao_Paulo',
      },
      meetingType: toPublicMeetingType(mt, { sellerSlug: mt.seller_slug }),
    };
  },

  async getPublicAvailability(sellerSlug, meetingSlug, { date, from, to } = {}) {
    const mt = await meetingTypeRepository.findActiveBySlugs(
      sellerSlug,
      meetingSlug
    );
    if (!mt) {
      throw new AppError('Página de agendamento não encontrada.', {
        statusCode: 404,
        code: 'SCHEDULING_PAGE_NOT_FOUND',
      });
    }

    const connected = await googleCalendarAuthService.getStatus(mt.seller_user_id);
    if (!connected.connected) {
      throw new AppError('Conecte sua agenda para disponibilizar horários.', {
        statusCode: 400,
        code: 'CALENDAR_NOT_CONNECTED',
      });
    }

    const timezone = mt.seller_timezone || 'America/Sao_Paulo';
    const windowDays = Number(mt.booking_window_days) || 14;
    let rangeStart;
    let rangeEnd;
    if (date) {
      rangeStart = DateTime.fromISO(date, { zone: timezone }).startOf('day');
      rangeEnd = rangeStart.endOf('day');
    } else {
      rangeStart = from
        ? DateTime.fromISO(from, { zone: timezone }).startOf('day')
        : DateTime.now().setZone(timezone).startOf('day');
      rangeEnd = to
        ? DateTime.fromISO(to, { zone: timezone }).endOf('day')
        : rangeStart.plus({ days: Math.min(windowDays, 7) }).endOf('day');
    }

    const maxEnd = DateTime.now()
      .setZone(timezone)
      .plus({ days: windowDays })
      .endOf('day');
    if (rangeEnd > maxEnd) rangeEnd = maxEnd;

    const rules = await availabilityRuleRepository.listByUser(mt.seller_user_id);
    const mappedRules = rules.map((r) => ({
      dayOfWeek: r.day_of_week,
      startTime: String(r.start_time).slice(0, 5),
      endTime: String(r.end_time).slice(0, 5),
    }));

    const { accessToken, calendarId } =
      await googleCalendarAuthService.getValidAccessToken(mt.seller_user_id);

    const googleBusy = await googleCalendarProvider.getBusyTimes(accessToken, {
      calendarId,
      timeMin: rangeStart.toUTC().toJSDate(),
      timeMax: rangeEnd.toUTC().toJSDate(),
    });

    const localBusyRows = await meetingRepository.listBusyForSeller({
      sellerUserId: mt.seller_user_id,
      from: toMysqlDateTime(rangeStart.toUTC().toJSDate()),
      to: toMysqlDateTime(rangeEnd.toUTC().toJSDate()),
    });

    const busy = [
      ...googleBusy,
      ...localBusyRows.map((m) => ({
        start: new Date(m.start_at),
        end: new Date(m.end_at),
      })),
    ];

    const slots = generateAvailableSlots({
      rules: mappedRules,
      timezone,
      from: rangeStart.toJSDate(),
      to: rangeEnd.toJSDate(),
      durationMinutes: mt.duration_minutes,
      bufferBeforeMinutes: mt.buffer_before_minutes,
      bufferAfterMinutes: mt.buffer_after_minutes,
      minimumNoticeMinutes: mt.minimum_notice_minutes,
      busy,
    });

    return {
      date: date || rangeStart.toISODate(),
      timezone,
      slots,
    };
  },

  async bookPublic(sellerSlug, meetingSlug, body, { idempotencyKey } = {}) {
    const mt = await meetingTypeRepository.findActiveBySlugs(
      sellerSlug,
      meetingSlug
    );
    if (!mt) {
      throw new AppError('Página de agendamento não encontrada.', {
        statusCode: 404,
        code: 'SCHEDULING_PAGE_NOT_FOUND',
      });
    }

    return bookMeeting({
      companyId: mt.seller_company_id,
      sellerUserId: mt.seller_user_id,
      meetingType: mt,
      startAt: body.startAt,
      customer: {
        name: body.name,
        email: body.email,
        phone: body.phone,
      },
      leadId: null,
      source: 'PUBLIC_LINK',
      idempotencyKey,
      timezone: mt.seller_timezone || 'America/Sao_Paulo',
    });
  },

  async bookManual(companyId, userId, body, { idempotencyKey } = {}) {
    const mt = await meetingTypeRepository.findByIdForUser(
      userId,
      body.meetingTypeId
    );
    if (!mt || !mt.is_active) {
      throw new AppError('Tipo de reunião inválido.', {
        statusCode: 400,
        code: 'MEETING_TYPE_NOT_FOUND',
      });
    }

    let leadId = body.leadId || null;
    if (leadId) {
      const lead = await leadRepository.findById(companyId, leadId);
      if (!lead) {
        throw new AppError('Lead não encontrado.', {
          statusCode: 404,
          code: 'LEAD_NOT_FOUND',
        });
      }
    }

    const user = await userRepository.findByIdWithRole(userId);
    return bookMeeting({
      companyId,
      sellerUserId: userId,
      meetingType: mt,
      startAt: body.startAt,
      customer: body.customer,
      leadId,
      source: 'MANUAL',
      idempotencyKey,
      timezone: user?.timezone || 'America/Sao_Paulo',
    });
  },

  async reschedule(userId, meetingId, { startAt }) {
    const meeting = await meetingRepository.findByIdForSeller(userId, meetingId);
    if (!meeting || meeting.status === 'CANCELLED') {
      throw new AppError('Reunião não encontrada.', {
        statusCode: 404,
        code: 'MEETING_NOT_FOUND',
      });
    }

    const mt = meeting.meeting_type_id
      ? await meetingTypeRepository.findByIdForUser(userId, meeting.meeting_type_id)
      : null;
    const duration =
      mt?.duration_minutes ||
      Math.round(
        (new Date(meeting.end_at) - new Date(meeting.start_at)) / 60000
      );

    const start = DateTime.fromISO(startAt);
    if (!start.isValid) {
      throw new AppError('Horário inválido.', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }
    const end = start.plus({ minutes: duration });

    return meetingRepository.withSellerLock(userId, async () => {
      await assertSlotFree({
        sellerUserId: userId,
        startAt: start.toUTC().toJSDate(),
        endAt: end.toUTC().toJSDate(),
        meetingType: mt || {
          duration_minutes: duration,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          minimum_notice_minutes: 0,
          booking_window_days: 60,
        },
        timezone: meeting.timezone,
        excludeId: meeting.id,
      });

      const { accessToken, calendarId } =
        await googleCalendarAuthService.getValidAccessToken(userId);

      if (meeting.provider_event_id) {
        await googleCalendarProvider.updateEvent(accessToken, {
          calendarId: meeting.provider_calendar_id || calendarId,
          eventId: meeting.provider_event_id,
          start: start.toUTC().toJSDate(),
          end: end.toUTC().toJSDate(),
          timezone: meeting.timezone,
        });
      }

      const updated = await meetingRepository.update(meeting.id, {
        startAt: toMysqlDateTime(start.toUTC().toJSDate()),
        endAt: toMysqlDateTime(end.toUTC().toJSDate()),
      });
      logger.info('Reunião reagendada', { meetingId: meeting.id, userId });
      return toPublicMeeting(updated);
    });
  },

  async cancel(userId, meetingId) {
    const meeting = await meetingRepository.findByIdForSeller(userId, meetingId);
    if (!meeting) {
      throw new AppError('Reunião não encontrada.', {
        statusCode: 404,
        code: 'MEETING_NOT_FOUND',
      });
    }
    if (meeting.status === 'CANCELLED') return toPublicMeeting(meeting);

    try {
      if (meeting.provider_event_id) {
        const { accessToken, calendarId } =
          await googleCalendarAuthService.getValidAccessToken(userId);
        await googleCalendarProvider.deleteEvent(accessToken, {
          calendarId: meeting.provider_calendar_id || calendarId,
          eventId: meeting.provider_event_id,
        });
      }
    } catch (error) {
      logger.warn('Falha ao remover evento Google no cancelamento', {
        meetingId,
        code: error.code,
      });
    }

    const updated = await meetingRepository.update(meeting.id, {
      status: 'CANCELLED',
      cancelledAt: toMysqlDateTime(new Date()),
    });
    logger.info('Reunião cancelada', { meetingId, userId });
    return toPublicMeeting(updated);
  },

  async cancelByManageToken(token) {
    const meeting = await meetingRepository.findByManageToken(token);
    if (!meeting || meeting.status === 'CANCELLED') {
      throw new AppError('Agendamento não encontrado.', {
        statusCode: 404,
        code: 'MEETING_NOT_FOUND',
      });
    }
    return this.cancel(meeting.seller_user_id, meeting.id);
  },
};
