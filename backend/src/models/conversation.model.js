export const ConversationChannel = Object.freeze({
  WHATSAPP: 'WHATSAPP',
  INSTAGRAM: 'INSTAGRAM',
});

export const ConversationStatus = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
});

export function toPublicConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    status: row.status,
    leadName: row.lead_name || null,
    leadPhone: row.lead_phone || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
