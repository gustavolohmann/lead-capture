import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthContext } from './AuthContext.jsx';
import {
  createSocket,
  SocketClientEvents,
} from '../services/socket.js';
import { notificationsApi } from '../services/notifications.api.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, isAuthenticated } = useAuthContext();
  const socketRef = useRef(null);
  const activeConversationRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [lastMessageEvent, setLastMessageEvent] = useState(null);
  const [lastConversationEvent, setLastConversationEvent] = useState(null);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }
    try {
      const [countRes, listRes] = await Promise.all([
        notificationsApi.unreadCount(),
        notificationsApi.listUnread(),
      ]);
      setUnreadCount(Number(countRes.count || 0));
      setNotifications(listRes.notifications || []);
    } catch {
      // Mantém estado local se a API falhar temporariamente
    }
  }, [isAuthenticated]);

  const joinConversation = useCallback((conversationId) => {
    const id = Number(conversationId);
    if (!Number.isFinite(id) || !socketRef.current) return;
    activeConversationRef.current = id;
    socketRef.current.emit(SocketClientEvents.CONVERSATION_JOIN, {
      conversationId: id,
    });
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    const id = Number(conversationId ?? activeConversationRef.current);
    if (!Number.isFinite(id) || !socketRef.current) return;
    socketRef.current.emit(SocketClientEvents.CONVERSATION_LEAVE, {
      conversationId: id,
    });
    if (activeConversationRef.current === id) {
      activeConversationRef.current = null;
    }
  }, []);

  const markNotificationRead = useCallback(async (id) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await notificationsApi.markAllRead();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setUnreadCount(0);
      setNotifications([]);
      return undefined;
    }

    const socket = createSocket(token);
    socketRef.current = socket;

    function onConnect() {
      setConnected(true);
      if (activeConversationRef.current) {
        socket.emit(SocketClientEvents.CONVERSATION_JOIN, {
          conversationId: activeConversationRef.current,
        });
      }
      refreshUnread();
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onMessageCreated(payload) {
      setLastMessageEvent({
        ...payload,
        receivedAt: Date.now(),
      });
    }

    function onConversationUpdated(payload) {
      setLastConversationEvent({
        ...payload,
        receivedAt: Date.now(),
      });
    }

    function onNotificationCreated(payload) {
      const activeId = activeConversationRef.current;
      // Conversa aberta: thread já atualiza via message.created — sem badge/toast
      if (
        payload?.conversationId &&
        Number(payload.conversationId) === Number(activeId)
      ) {
        return;
      }

      setNotifications((prev) => {
        if (prev.some((item) => item.id === payload.id)) return prev;
        return [payload, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    }

    function onNotificationRead(payload) {
      if (payload?.all) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      if (payload?.id) {
        setNotifications((prev) => prev.filter((item) => item.id !== payload.id));
        setUnreadCount((prev) => Math.max(0, prev - 1));
        return;
      }
      refreshUnread();
    }

    socket.on(SocketClientEvents.CONNECT, onConnect);
    socket.on(SocketClientEvents.DISCONNECT, onDisconnect);
    socket.on(SocketClientEvents.MESSAGE_CREATED, onMessageCreated);
    socket.on(SocketClientEvents.CONVERSATION_UPDATED, onConversationUpdated);
    socket.on(SocketClientEvents.NOTIFICATION_CREATED, onNotificationCreated);
    socket.on(SocketClientEvents.NOTIFICATION_READ, onNotificationRead);

    refreshUnread();

    return () => {
      socket.off(SocketClientEvents.CONNECT, onConnect);
      socket.off(SocketClientEvents.DISCONNECT, onDisconnect);
      socket.off(SocketClientEvents.MESSAGE_CREATED, onMessageCreated);
      socket.off(SocketClientEvents.CONVERSATION_UPDATED, onConversationUpdated);
      socket.off(SocketClientEvents.NOTIFICATION_CREATED, onNotificationCreated);
      socket.off(SocketClientEvents.NOTIFICATION_READ, onNotificationRead);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, token, refreshUnread]);

  const value = useMemo(
    () => ({
      connected,
      unreadCount,
      notifications,
      lastMessageEvent,
      lastConversationEvent,
      joinConversation,
      leaveConversation,
      markNotificationRead,
      markAllNotificationsRead,
      refreshUnread,
      getActiveConversationId: () => activeConversationRef.current,
    }),
    [
      connected,
      unreadCount,
      notifications,
      lastMessageEvent,
      lastConversationEvent,
      joinConversation,
      leaveConversation,
      markNotificationRead,
      markAllNotificationsRead,
      refreshUnread,
    ]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de SocketProvider');
  }
  return context;
}
