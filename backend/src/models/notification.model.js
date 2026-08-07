export const NotificationType = Object.freeze({
  NEW_MESSAGE: 'NEW_MESSAGE',
});

export function toPublicNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
