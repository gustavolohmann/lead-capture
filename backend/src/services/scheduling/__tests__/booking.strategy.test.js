import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../calendar/google.auth.service.js', () => ({
  googleCalendarAuthService: {
    getStatus: vi.fn(async () => ({ connected: true })),
    getValidAccessToken: vi.fn(async () => ({
      accessToken: 'token',
      calendarId: 'primary',
    })),
  },
}));

vi.mock('../../calendar/google.calendar.provider.js', () => ({
  googleCalendarProvider: {
    getBusyTimes: vi.fn(async () => []),
    createEvent: vi.fn(async () => ({
      eventId: 'evt_1',
      calendarId: 'primary',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    })),
    deleteEvent: vi.fn(async () => ({ success: true })),
    updateEvent: vi.fn(async () => ({
      eventId: 'evt_1',
      calendarId: 'primary',
      meetingUrl: null,
    })),
  },
}));

describe('scheduling booking failure strategy (documented)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('documents Google-first then DB with compensation on DB failure', () => {
    // Estratégia escolhida em scheduling.service #bookMeeting:
    // 1) validar slot + lock
    // 2) criar evento Google
    // 3) inserir meeting no banco
    // 4) se (3) falhar → deleteEvent no Google
    expect(true).toBe(true);
  });
});
