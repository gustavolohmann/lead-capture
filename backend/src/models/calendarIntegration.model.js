export function toPublicCalendarIntegration(row) {
  if (!row) {
    return {
      connected: false,
      provider: 'GOOGLE',
      status: 'DISCONNECTED',
      email: null,
      calendarId: null,
      lastSyncAt: null,
    };
  }

  return {
    connected: row.status === 'CONNECTED',
    provider: row.provider,
    status: row.status,
    email: row.provider_email || null,
    calendarId: row.calendar_id || null,
    lastSyncAt: row.last_sync_at || null,
    connectedAt: row.created_at || null,
  };
}
