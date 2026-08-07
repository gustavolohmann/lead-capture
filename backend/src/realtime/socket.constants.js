/**
 * Eventos Socket.IO padronizados (domínio → cliente).
 *
 * message.created        — nova mensagem persistida
 * message.updated        — status/conteúdo de mensagem alterado
 * conversation.updated   — preview/última atividade da conversa
 * notification.created   — nova notificação persistida
 * notification.read      — notificação marcada como lida
 *
 * Cliente → servidor:
 * conversation:join    { conversationId }
 * conversation:leave   { conversationId }
 */
export const SocketEvents = Object.freeze({
  MESSAGE_CREATED: 'message.created',
  MESSAGE_UPDATED: 'message.updated',
  CONVERSATION_UPDATED: 'conversation.updated',
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
});
