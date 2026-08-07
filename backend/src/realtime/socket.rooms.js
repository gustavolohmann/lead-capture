export function companyRoom(companyId) {
  return `company:${companyId}`;
}

export function conversationRoom(companyId, conversationId) {
  return `company:${companyId}:conversation:${conversationId}`;
}

export function userRoom(userId) {
  return `user:${userId}`;
}

export function joinCompanyRoom(socket) {
  const companyId = socket.company?.id;
  if (!companyId) return null;
  const room = companyRoom(companyId);
  socket.join(room);
  return room;
}

export function joinUserRoom(socket) {
  const userId = socket.user?.id;
  if (!userId) return null;
  const room = userRoom(userId);
  socket.join(room);
  return room;
}
