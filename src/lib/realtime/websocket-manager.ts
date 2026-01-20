/**
 * Real-Time WebSocket Manager
 * Handles WebSocket connections for chat, presence, and notifications
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Heartbeat/ping-pong keep-alive
 * - Message queuing when offline
 * - Event-based architecture
 * - TypeScript type safety
 */

type WebSocketEvent =
  | 'message'
  | 'presence'
  | 'typing'
  | 'notification'
  | 'session_update'
  | 'call_signal'
  | 'subscribe'
  | 'unsubscribe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageHandler = (data: unknown) => void;

interface WebSocketMessage {
  event: WebSocketEvent;
  data: unknown;
  timestamp: number;
}

interface ConnectionOptions {
  userId: string;
  token: string;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  maxQueueSize?: number; // FIX: Add max queue size to prevent OOM
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<ConnectionOptions>;
  private handlers: Map<WebSocketEvent, Set<MessageHandler>>;
  private messageQueue: WebSocketMessage[];
  private reconnectAttempts: number;
  private heartbeatTimer: NodeJS.Timeout | null;
  private reconnectTimer: NodeJS.Timeout | null; // FIX: Track reconnect timer for cleanup
  private isConnected: boolean;
  private isReconnecting: boolean;
  private isDestroyed: boolean; // FIX: Track if manager is destroyed to prevent leaks

  constructor(url: string, options: ConnectionOptions) {
    this.url = url;
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      heartbeatInterval: options.heartbeatInterval ?? 30000, // 30 seconds
      reconnectDelay: options.reconnectDelay ?? 1000, // 1 second
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      maxQueueSize: options.maxQueueSize ?? 100, // FIX: Default max 100 queued messages to prevent OOM
      ...options,
    };

    this.handlers = new Map();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.isConnected = false;
    this.isReconnecting = false;
    this.isDestroyed = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with authentication
        const wsUrl = `${this.url}?userId=${this.options.userId}&token=${this.options.token}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;

          // Start heartbeat
          this.startHeartbeat();

          // Send queued messages
          this.flushMessageQueue();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
          this.isConnected = false;
          this.stopHeartbeat();

          // Auto-reconnect if enabled
          if (this.options.autoReconnect && !this.isReconnecting) {
            this.reconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   * FIX: Comprehensive cleanup to prevent memory leaks
   */
  disconnect(): void {
    this.options.autoReconnect = false; // Disable auto-reconnect
    this.isDestroyed = true;
    
    // FIX: Clear all timers to prevent leaks
    this.stopHeartbeat();
    this.stopReconnectTimer();

    if (this.ws) {
      // Remove all event listeners before closing
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      this.ws.close();
      this.ws = null;
    }

    // FIX: Clear handlers to prevent memory leaks from retained callbacks
    this.handlers.clear();
    
    // FIX: Clear message queue
    this.messageQueue = [];

    this.isConnected = false;
    this.isReconnecting = false;
  }

  /**
   * FIX: Stop reconnect timer
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Send message through WebSocket
   * FIX: Added queue bounds to prevent OOM
   */
  send(event: WebSocketEvent, data: unknown): void {
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: Date.now(),
    };

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // FIX: Check queue size before adding to prevent OOM
      if (this.messageQueue.length >= this.options.maxQueueSize) {
        // Drop oldest messages when queue is full (FIFO eviction)
        const dropped = this.messageQueue.shift();
        if (process.env.NODE_ENV === 'development') {
          console.warn('[WebSocket] Queue full, dropped oldest message:', dropped?.event);
        }
      }
      
      // Queue message for later
      this.messageQueue.push(message);
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[WebSocket] Message queued (not connected). Queue size: ${this.messageQueue.length}/${this.options.maxQueueSize}`);
      }
    }
  }

  /**
   * Subscribe to WebSocket events
   * FIX: Return cleanup function that checks for destroyed state
   */
  on(event: WebSocketEvent, handler: MessageHandler): () => void {
    // FIX: Don't add handlers if destroyed
    if (this.isDestroyed) {
      console.warn('[WebSocket] Cannot add handler - manager is destroyed');
      return () => {}; // No-op cleanup
    }
    
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      // FIX: Safe cleanup even if manager is destroyed
      const handlers = this.handlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        // FIX: Clean up empty sets to prevent memory leaks
        if (handlers.size === 0) {
          this.handlers.delete(event);
        }
      }
    };
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off(event: WebSocketEvent, handler: MessageHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.event);

    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`[WebSocket] Handler error for ${message.event}:`, error);
        }
      });
    }
  }

  /**
   * Reconnect with exponential backoff
   * FIX: Track timer and check destroyed state
   */
  private reconnect(): void {
    // FIX: Don't reconnect if destroyed
    if (this.isDestroyed) {
      return;
    }
    
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 second delay
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    // FIX: Track the timer so we can cancel it
    this.stopReconnectTimer(); // Clear any existing timer
    this.reconnectTimer = setTimeout(() => {
      // FIX: Check destroyed state again before reconnecting
      if (this.isDestroyed) {
        return;
      }
      
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping', timestamp: Date.now() }));
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message.event, message.data);
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    isConnected: boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
    queuedMessages: number;
  } {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
    };
  }
}

// FIX: Track singleton per userId to prevent cross-user contamination
// Each user gets their own isolated WebSocket manager
const wsManagers = new Map<string, WebSocketManager>();

// FIX: Maximum number of cached managers to prevent memory leak
const MAX_CACHED_MANAGERS = 10;

/**
 * Get or create WebSocket manager instance for a specific user
 * FIX: No longer a global singleton - each user gets their own manager
 */
export function getWebSocketManager(options?: ConnectionOptions): WebSocketManager {
  if (!options) {
    throw new Error('WebSocket manager requires options with userId.');
  }

  const userId = options.userId;

  // Check if we already have a manager for this user
  let manager = wsManagers.get(userId);

  if (manager) {
    // Check if the existing manager is still valid (not destroyed)
    const status = manager.getStatus();
    if (!status.isConnected && !status.isReconnecting && status.reconnectAttempts >= (options.maxReconnectAttempts ?? 5)) {
      // Manager is exhausted, clean it up and create new one
      manager.disconnect();
      wsManagers.delete(userId);
      manager = undefined;
    }
  }

  if (!manager) {
    // FIX: Evict oldest manager if we hit the limit (LRU-style)
    if (wsManagers.size >= MAX_CACHED_MANAGERS) {
      const oldestUserId = wsManagers.keys().next().value;
      if (oldestUserId) {
        const oldManager = wsManagers.get(oldestUserId);
        oldManager?.disconnect();
        wsManagers.delete(oldestUserId);
        if (process.env.NODE_ENV === 'development') {
          console.log('[WebSocket] Evicted manager for user:', oldestUserId);
        }
      }
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    manager = new WebSocketManager(wsUrl, options);
    wsManagers.set(userId, manager);
  }

  return manager;
}

/**
 * Disconnect and cleanup WebSocket manager for a specific user
 */
export function disconnectWebSocket(userId?: string): void {
  if (userId) {
    const manager = wsManagers.get(userId);
    if (manager) {
      manager.disconnect();
      wsManagers.delete(userId);
    }
  } else {
    // FIX: Disconnect all managers (cleanup on app unmount)
    for (const [id, manager] of wsManagers.entries()) {
      manager.disconnect();
      wsManagers.delete(id);
    }
  }
}

/**
 * Get current manager count (for monitoring/debugging)
 */
export function getWebSocketManagerCount(): number {
  return wsManagers.size;
}
