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
  | 'call_signal';

type MessageHandler = (data: any) => void;

interface WebSocketMessage {
  event: WebSocketEvent;
  data: any;
  timestamp: number;
}

interface ConnectionOptions {
  userId: string;
  token: string;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<ConnectionOptions>;
  private handlers: Map<WebSocketEvent, Set<MessageHandler>>;
  private messageQueue: WebSocketMessage[];
  private reconnectAttempts: number;
  private heartbeatTimer: NodeJS.Timeout | null;
  private isConnected: boolean;
  private isReconnecting: boolean;

  constructor(url: string, options: ConnectionOptions) {
    this.url = url;
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      heartbeatInterval: options.heartbeatInterval ?? 30000, // 30 seconds
      reconnectDelay: options.reconnectDelay ?? 1000, // 1 second
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      ...options,
    };

    this.handlers = new Map();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.isConnected = false;
    this.isReconnecting = false;
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
   */
  disconnect(): void {
    this.options.autoReconnect = false; // Disable auto-reconnect
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Send message through WebSocket
   */
  send(event: WebSocketEvent, data: any): void {
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: Date.now(),
    };

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      console.warn('[WebSocket] Message queued (not connected)');
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  on(event: WebSocketEvent, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
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
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    setTimeout(() => {
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

// Singleton instance
let wsManager: WebSocketManager | null = null;

/**
 * Get or create WebSocket manager instance
 */
export function getWebSocketManager(options?: ConnectionOptions): WebSocketManager {
  if (!wsManager && options) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    wsManager = new WebSocketManager(wsUrl, options);
  }

  if (!wsManager) {
    throw new Error('WebSocket manager not initialized. Call with options first.');
  }

  return wsManager;
}

/**
 * Disconnect and cleanup WebSocket manager
 */
export function disconnectWebSocket(): void {
  if (wsManager) {
    wsManager.disconnect();
    wsManager = null;
  }
}
