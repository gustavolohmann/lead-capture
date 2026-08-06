export const MessageDirection = Object.freeze({
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
});

export const MessageStatus = Object.freeze({
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RECEIVED: 'RECEIVED',
});

export function toPublicMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    content: row.content,
    externalMessageId: row.external_message_id,
    status: row.status,
    createdAt: row.created_at,
  };
}
