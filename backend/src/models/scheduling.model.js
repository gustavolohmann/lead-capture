export function toPublicMeetingType(row, { sellerSlug = null } = {}) {
  if (!row) return null;
  const slug = sellerSlug || row.seller_slug || null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    durationMinutes: row.duration_minutes,
    locationType: row.location_type,
    isActive: Boolean(row.is_active),
    bufferBeforeMinutes: row.buffer_before_minutes,
    bufferAfterMinutes: row.buffer_after_minutes,
    minimumNoticeMinutes: row.minimum_notice_minutes,
    bookingWindowDays: row.booking_window_days,
    publicPath:
      slug && row.slug ? `/agendar/${slug}/${row.slug}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicMeeting(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    status: row.status,
    meetingUrl: row.meeting_url,
    source: row.source,
    leadId: row.lead_id,
    meetingTypeId: row.meeting_type_id,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
    },
    publicManageToken: row.public_manage_token,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export function toPublicAvailabilityRule(row) {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    timezone: row.timezone,
    isActive: Boolean(row.is_active),
  };
}
