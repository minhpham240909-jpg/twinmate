/**
 * Real-Time React Hooks
 * Easy-to-use hooks for WebSocket features in React components
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketManager } from './websocket-manager';

/**
 * Hook for real-time chat messages
 */
export function useRealtimeMessages(sessionId: string, userId: string, token: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(getWebSocketManager({ userId, token }));

  useEffect(() => {
    const ws = wsRef.current;

    // Connect to WebSocket
    ws.connect().then(() => {
      setIsConnected(true);

      // Subscribe to this session's messages
      ws.send('subscribe', { sessionId });
    }).catch((error) => {
      console.error('Failed to connect:', error);
    });

    // Listen for new messages
    const unsubscribe = ws.on('message', (data) => {
      if (data.sessionId === sessionId) {
        setMessages(prev => [...prev, data.message]);
      }
    });

    return () => {
      unsubscribe();
      ws.send('unsubscribe', { sessionId });
    };
  }, [sessionId, userId, token]);

  // Send message
  const sendMessage = useCallback((content: string) => {
    const ws = wsRef.current;
    ws.send('message', {
      sessionId,
      content,
      timestamp: Date.now(),
    });

    // Optimistic update
    setMessages(prev => [...prev, {
      id: `temp-${Date.now()}`,
      content,
      senderId: userId,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    }]);
  }, [sessionId, userId]);

  return { messages, sendMessage, isConnected };
}

/**
 * Hook for online presence tracking
 */
export function usePresence(userId: string, token: string) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef(getWebSocketManager({ userId, token }));

  useEffect(() => {
    const ws = wsRef.current;

    ws.connect().then(() => {
      // Notify server we're online
      ws.send('presence', { status: 'online', userId });
    });

    // Listen for presence updates
    const unsubscribe = ws.on('presence', (data) => {
      setOnlineUsers(prev => {
        const updated = new Set(prev);
        if (data.status === 'online') {
          updated.add(data.userId);
        } else {
          updated.delete(data.userId);
        }
        return updated;
      });
    });

    // Send offline status on unmount
    return () => {
      ws.send('presence', { status: 'offline', userId });
      unsubscribe();
    };
  }, [userId, token]);

  return { onlineUsers };
}

/**
 * Hook for typing indicators
 */
export function useTypingIndicator(sessionId: string, userId: string, token: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const wsRef = useRef(getWebSocketManager({ userId, token }));
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const ws = wsRef.current;

    const unsubscribe = ws.on('typing', (data) => {
      if (data.sessionId === sessionId && data.userId !== userId) {
        setTypingUsers(prev => {
          const updated = new Set(prev);
          if (data.isTyping) {
            updated.add(data.userId);

            // Auto-remove after 3 seconds
            setTimeout(() => {
              setTypingUsers(current => {
                const newSet = new Set(current);
                newSet.delete(data.userId);
                return newSet;
              });
            }, 3000);
          } else {
            updated.delete(data.userId);
          }
          return updated;
        });
      }
    });

    return () => unsubscribe();
  }, [sessionId, userId, token]);

  // Notify others when typing
  const notifyTyping = useCallback((isTyping: boolean) => {
    const ws = wsRef.current;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    ws.send('typing', { sessionId, userId, isTyping });

    // Auto-stop typing after 2 seconds of no activity
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        ws.send('typing', { sessionId, userId, isTyping: false });
      }, 2000);
    }
  }, [sessionId, userId]);

  return { typingUsers, notifyTyping };
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications(userId: string, token: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef(getWebSocketManager({ userId, token }));

  useEffect(() => {
    const ws = wsRef.current;

    ws.connect();

    const unsubscribe = ws.on('notification', (data) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message,
          icon: '/icon.png',
        });
      }
    });

    return () => unsubscribe();
  }, [userId, token]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markAsRead, clearAll };
}

/**
 * Hook for session status updates (calls, study sessions)
 */
export function useSessionStatus(sessionId: string, userId: string, token: string) {
  const [status, setStatus] = useState<string>('WAITING');
  const [participants, setParticipants] = useState<any[]>([]);
  const wsRef = useRef(getWebSocketManager({ userId, token }));

  useEffect(() => {
    const ws = wsRef.current;

    ws.connect();

    const unsubscribe = ws.on('session_update', (data) => {
      if (data.sessionId === sessionId) {
        if (data.status) setStatus(data.status);
        if (data.participants) setParticipants(data.participants);
      }
    });

    return () => unsubscribe();
  }, [sessionId, userId, token]);

  const updateStatus = useCallback((newStatus: string) => {
    const ws = wsRef.current;
    ws.send('session_update', {
      sessionId,
      status: newStatus,
      userId,
    });
  }, [sessionId, userId]);

  return { status, participants, updateStatus };
}
