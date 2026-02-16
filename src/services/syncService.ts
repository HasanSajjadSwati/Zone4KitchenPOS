/**
 * Real-time Sync Service
 * Connects to the backend WebSocket server and notifies the app when data changes.
 */

export type SyncEventType =
  | 'orders'
  | 'order_items'
  | 'payments'
  | 'menu_items'
  | 'categories'
  | 'deals'
  | 'customers'
  | 'register_sessions'
  | 'settings'
  | 'employees'
  | 'staff'
  | 'expenses';

export interface SyncEvent {
  type: 'sync';
  resource: SyncEventType;
  action: 'create' | 'update' | 'delete' | 'refresh';
  id?: string;
  timestamp: string;
}

type SyncListener = (event: SyncEvent) => void;

class SyncService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<SyncEventType | '*', Set<SyncListener>> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Get the WebSocket URL based on API URL or current page location
   */
  private getWebSocketUrl(): string {
    // In development with Vite, use the proxy path
    if (import.meta.env.DEV) {
      // Vite proxy will forward /api/ws to the backend
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/api/ws`;
    }
    
    // Check if VITE_API_URL is set (e.g., http://192.168.1.100:3033/api)
    const apiUrl = import.meta.env.VITE_API_URL;
    
    if (apiUrl) {
      // Parse the API URL and convert to WebSocket URL
      try {
        const url = new URL(apiUrl);
        const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProtocol}//${url.host}/api/ws`;
      } catch {
        console.warn('[Sync] Invalid VITE_API_URL, falling back to default');
      }
    }
    
    // In production, use same host as page (frontend served by backend)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    const url = this.getWebSocketUrl();

    // Reconnect when tab becomes visible again
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.shouldReconnect) {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('[Sync] Tab became visible, reconnecting...');
            this.reconnectAttempts = 0;
            this.connect();
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    
    console.log('[Sync] Connecting to:', url);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[Sync] Connected to server at', url);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'sync') {
            console.log('[Sync] Received sync event:', data.resource, data.action);
            this.notifyListeners(data as SyncEvent);
          } else if (data.type === 'website_order') {
            console.log('[Sync] Website order received:', data.orderNumber);
            this.notifyWebsiteOrder(data);
          } else if (data.type === 'connected') {
            console.log('[Sync] Server acknowledged connection');
          }
        } catch (error) {
          console.error('[Sync] Failed to parse message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[Sync] Connection closed', event.code, event.reason);
        this.isConnecting = false;
        this.stopPing();
        
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Sync] WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('[Sync] Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Sync] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`[Sync] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Start sending ping messages to keep connection alive
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Subscribe to sync events
   * @param resource - Resource type to listen for, or '*' for all events
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  subscribe(resource: SyncEventType | '*', listener: SyncListener): () => void {
    if (!this.listeners.has(resource)) {
      this.listeners.set(resource, new Set());
    }
    
    this.listeners.get(resource)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(resource)?.delete(listener);
    };
  }

  /**
   * Notify all relevant listeners of a sync event
   */
  private notifyListeners(event: SyncEvent): void {
    // Notify specific resource listeners
    this.listeners.get(event.resource)?.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Sync] Listener error:', error);
      }
    });

    // Notify wildcard listeners
    this.listeners.get('*')?.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Sync] Listener error:', error);
      }
    });
  }

  // ─── Website Order Notification ──────────────────────────────────
  private websiteOrderListeners: Set<(order: WebsiteOrderEvent) => void> = new Set();

  onWebsiteOrder(listener: (order: WebsiteOrderEvent) => void): () => void {
    this.websiteOrderListeners.add(listener);
    return () => { this.websiteOrderListeners.delete(listener); };
  }

  private notifyWebsiteOrder(order: WebsiteOrderEvent): void {
    this.websiteOrderListeners.forEach((listener) => {
      try { listener(order); } catch (e) { console.error('[Sync] Website order listener error:', e); }
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export interface WebsiteOrderEvent {
  type: 'website_order';
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  total: number;
  itemCount: number;
  timestamp: string;
}

// Singleton instance
export const syncService = new SyncService();
