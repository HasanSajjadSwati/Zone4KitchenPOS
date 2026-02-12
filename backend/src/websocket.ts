import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from './utils/logger.js';

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

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): WebSocketServer {
  // Attach WebSocket server to HTTP server on /api/ws path
  wss = new WebSocketServer({ 
    server,
    path: '/api/ws',
    // Allow connections from any origin (CORS for WebSocket)
    verifyClient: (info, callback) => {
      // Accept all connections
      callback(true);
    }
  });

  wss.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    logger.info(`WebSocket client connected from ${clientIp}`);

    // Send a welcome message with current timestamp
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Real-time sync established',
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        // Handle ping/pong for connection health
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        logger.debug('WebSocket received non-JSON message');
      }
    });

    ws.on('close', () => {
      logger.info(`WebSocket client disconnected from ${clientIp}`);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });
  });

  logger.info('WebSocket server initialized on /ws');
  return wss;
}

/**
 * Broadcast a sync event to all connected clients
 */
export function broadcastSync(resource: SyncEventType, action: SyncEvent['action'], id?: string): void {
  if (!wss) {
    logger.debug('WebSocket server not initialized, skipping broadcast');
    return;
  }

  const event: SyncEvent = {
    type: 'sync',
    resource,
    action,
    id,
    timestamp: new Date().toISOString(),
  };

  const message = JSON.stringify(event);
  let sentCount = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    }
  });

  logger.debug(`Broadcast sync event: ${resource}.${action}`, { sentCount, id });
}

/**
 * Get the current WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

/**
 * Get the number of connected clients
 */
export function getConnectedClientsCount(): number {
  if (!wss) return 0;
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      count++;
    }
  });
  return count;
}
