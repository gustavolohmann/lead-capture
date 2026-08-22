import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { CalendarProviderName } from './calendar.provider.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function googleErrorDetails(error) {
  const data = error?.response?.data;
  const status = error?.response?.status;
  const code =
    (typeof data?.error === 'string' && data.error) ||
    data?.error?.status ||
    data?.error?.errors?.[0]?.reason ||
    null;
  const description =
    data?.error_description ||
    data?.error?.message ||
    error?.message ||
    'unknown';
  return { status, code, description };
}

function mapGoogleError(error, fallbackCode = 'CALENDAR_PROVIDER_UNAVAILABLE') {
  const { status, code, description } = googleErrorDetails(error);

  logger.error('Falha no Google Calendar provider', {
    status,
    code,
    description: String(description).slice(0, 300),
  });

  if (status === 401 || status === 403) {
    return new AppError(
      `Conexão com o Google Calendar expirada ou sem permissão${
        code ? ` (${code})` : ''
      }.`,
      {
        statusCode: 401,
        code: 'CALENDAR_AUTH_EXPIRED',
      }
    );
  }

  return new AppError(
    `Falha ao comunicar com o Google Calendar${code ? `: ${code}` : ''}${
      description && description !== 'unknown' ? ` — ${description}` : ''
    }.`,
    {
      statusCode: 502,
      code: fallbackCode,
    }
  );
}

function decodeIdTokenPayload(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const googleCalendarProvider = {
  name: CalendarProviderName.GOOGLE,

  getAuthorizationUrl({ state }) {
    const scopes = String(env.GOOGLE_OAUTH_SCOPES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  },

  async exchangeAuthorizationCode(code) {
    let data;
    try {
      const response = await axios.post(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
          code,
          client_id: String(env.GOOGLE_CLIENT_ID || '').trim(),
          client_secret: String(env.GOOGLE_CLIENT_SECRET || '').trim(),
          redirect_uri: String(env.GOOGLE_OAUTH_REDIRECT_URI || '').trim(),
          grant_type: 'authorization_code',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      data = response.data;
    } catch (error) {
      const { code: gCode, description } = googleErrorDetails(error);
      logger.error('Falha ao trocar code OAuth Google', {
        code: gCode,
        description: String(description).slice(0, 300),
        status: error?.response?.status,
      });
      throw new AppError(
        `Google recusou o código OAuth${gCode ? ` (${gCode})` : ''}${
          description ? `: ${description}` : ''
        }. Confira Client Secret e Redirect URI no .env.`,
        {
          statusCode: 400,
          code: 'CALENDAR_OAUTH_EXCHANGE_FAILED',
        }
      );
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      throw new AppError('Google não retornou access token.', {
        statusCode: 400,
        code: 'CALENDAR_OAUTH_EXCHANGE_FAILED',
      });
    }

    const refreshToken = data.refresh_token || null;
    const expiresAt = data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null;

    const fromIdToken = decodeIdTokenPayload(data.id_token);
    let providerAccountId = fromIdToken?.sub || null;
    let providerEmail = fromIdToken?.email || null;

    if (!providerEmail || !providerAccountId) {
      try {
        const profile = await axios.get(GOOGLE_USERINFO_URL, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        providerAccountId = providerAccountId || profile.data?.id || null;
        providerEmail = providerEmail || profile.data?.email || null;
      } catch (error) {
        const details = googleErrorDetails(error);
        logger.warn('userinfo Google falhou; seguindo com id_token', details);
      }
    }

    return {
      accessToken,
      refreshToken,
      expiresAt,
      scopes: data.scope || env.GOOGLE_OAUTH_SCOPES,
      providerAccountId,
      providerEmail,
      calendarId: 'primary',
    };
  },

  async refreshAccessToken(refreshToken) {
    try {
      const { data } = await axios.post(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: data.expires_in
          ? new Date(Date.now() + Number(data.expires_in) * 1000)
          : null,
        scopes: data.scope || null,
      };
    } catch (error) {
      throw mapGoogleError(error, 'CALENDAR_AUTH_EXPIRED');
    }
  },

  async getCalendarInfo(accessToken, calendarId = 'primary') {
    try {
      const { data } = await axios.get(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return {
        calendarId: data.id || calendarId,
        summary: data.summary || null,
        timeZone: data.timeZone || null,
      };
    } catch (error) {
      throw mapGoogleError(error);
    }
  },

  /**
   * FreeBusy — retorna apenas intervalos ocupados (sem detalhes privados).
   */
  async getBusyTimes(accessToken, { calendarId = 'primary', timeMin, timeMax }) {
    try {
      const { data } = await axios.post(
        `${GOOGLE_CALENDAR_API}/freeBusy`,
        {
          timeMin: new Date(timeMin).toISOString(),
          timeMax: new Date(timeMax).toISOString(),
          items: [{ id: calendarId }],
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const busy = data?.calendars?.[calendarId]?.busy || [];
      return busy.map((item) => ({
        start: new Date(item.start),
        end: new Date(item.end),
      }));
    } catch (error) {
      throw mapGoogleError(error);
    }
  },

  async createEvent(accessToken, input) {
    const calendarId = input.calendarId || 'primary';
    const body = {
      summary: input.summary,
      description: input.description || '',
      start: {
        dateTime: new Date(input.start).toISOString(),
        timeZone: input.timezone,
      },
      end: {
        dateTime: new Date(input.end).toISOString(),
        timeZone: input.timezone,
      },
      attendees: (input.attendees || []).map((a) => ({
        email: a.email,
        displayName: a.displayName,
      })),
      extendedProperties: {
        private: {
          leadCaptureIdempotency: input.idempotencyKey || crypto.randomUUID(),
        },
      },
    };

    if (input.createMeet) {
      body.conferenceData = {
        createRequest: {
          requestId: (input.idempotencyKey || crypto.randomUUID()).slice(0, 48),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    try {
      const { data } = await axios.post(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        body,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            conferenceDataVersion: input.createMeet ? 1 : undefined,
            sendUpdates: 'all',
          },
        }
      );

      const meetingUrl =
        data.hangoutLink ||
        data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
          ?.uri ||
        null;

      return {
        eventId: data.id,
        calendarId,
        meetingUrl,
      };
    } catch (error) {
      throw mapGoogleError(error, 'CALENDAR_EVENT_CREATION_FAILED');
    }
  },

  async updateEvent(accessToken, { calendarId = 'primary', eventId, start, end, timezone, summary }) {
    try {
      const body = {};
      if (summary != null) body.summary = summary;
      if (start && end) {
        body.start = {
          dateTime: new Date(start).toISOString(),
          timeZone: timezone,
        };
        body.end = {
          dateTime: new Date(end).toISOString(),
          timeZone: timezone,
        };
      }

      const { data } = await axios.patch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        body,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { sendUpdates: 'all' },
        }
      );

      return {
        eventId: data.id,
        calendarId,
        meetingUrl:
          data.hangoutLink ||
          data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
            ?.uri ||
          null,
      };
    } catch (error) {
      throw mapGoogleError(error, 'CALENDAR_EVENT_CREATION_FAILED');
    }
  },

  async deleteEvent(accessToken, { calendarId = 'primary', eventId }) {
    try {
      await axios.delete(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { sendUpdates: 'all' },
        }
      );
      return { success: true };
    } catch (error) {
      if (error?.response?.status === 404) return { success: true };
      throw mapGoogleError(error);
    }
  },
};
