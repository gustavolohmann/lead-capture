/**
 * Contrato CalendarProvider (abstração para Google / Microsoft).
 * Implementações concretas não devem vazar detalhes da API externa.
 *
 * @typedef {Object} OAuthStartResult
 * @property {string} url
 *
 * @typedef {Object} TokenSet
 * @property {string} accessToken
 * @property {string|null} refreshToken
 * @property {Date|null} expiresAt
 * @property {string} scopes
 * @property {string|null} providerAccountId
 * @property {string|null} providerEmail
 * @property {string} calendarId
 *
 * @typedef {Object} BusyInterval
 * @property {Date} start
 * @property {Date} end
 *
 * @typedef {Object} CalendarEventInput
 * @property {string} summary
 * @property {string} [description]
 * @property {Date} start
 * @property {Date} end
 * @property {string} timezone
 * @property {{ email: string, displayName?: string }[]} [attendees]
 * @property {boolean} [createMeet]
 * @property {string} [idempotencyKey]
 *
 * @typedef {Object} CalendarEventResult
 * @property {string} eventId
 * @property {string} calendarId
 * @property {string|null} meetingUrl
 */

export const CalendarProviderName = Object.freeze({
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
});

/** @type {never} */
export function assertCalendarProvider(_impl) {
  // Marker for documentation / future DI
}
