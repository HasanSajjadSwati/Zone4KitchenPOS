import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { syncService, type SyncEvent, type WebsiteOrderEvent } from '@/services/syncService';

interface WebsiteOrderNotification {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: string;
  total: number;
  timestamp: string;
}

interface SyncContextValue {
  isConnected: boolean;
  lastSyncEvent: SyncEvent | null;
  refreshKey: number;
  websiteOrderNotification: WebsiteOrderNotification | null;
  clearWebsiteOrderNotification: () => void;
}

const SyncContext = createContext<SyncContextValue>({
  isConnected: false,
  lastSyncEvent: null,
  refreshKey: 0,
  websiteOrderNotification: null,
  clearWebsiteOrderNotification: () => {},
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncEvent, setLastSyncEvent] = useState<SyncEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [websiteOrderNotification, setWebsiteOrderNotification] = useState<WebsiteOrderNotification | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);

  const clearWebsiteOrderNotification = useCallback(() => {
    setWebsiteOrderNotification(null);
  }, []);

  // Connect on mount with delay to handle React StrictMode
  useEffect(() => {
    isMountedRef.current = true;
    
    // Delay connection to avoid React StrictMode interruption
    connectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        syncService.connect();
      }
    }, 100);

    // Check connection status periodically
    checkIntervalRef.current = setInterval(() => {
      setIsConnected(syncService.isConnected());
    }, 1000);

    return () => {
      isMountedRef.current = false;
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      // Don't disconnect immediately - let the service manage itself
      // syncService will handle reconnection if needed
    };
  }, []);

  // Subscribe to all sync events
  useEffect(() => {
    const unsubscribe = syncService.subscribe('*', (event) => {
      setLastSyncEvent(event);
      // Increment refresh key to trigger re-renders in subscribed components
      setRefreshKey((prev) => prev + 1);
    });

    return unsubscribe;
  }, []);

  // Subscribe to website order notifications
  useEffect(() => {
    syncService.setWebsiteOrderCallback((event: WebsiteOrderEvent) => {
      setWebsiteOrderNotification({
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        customerName: event.customerName,
        customerPhone: event.customerPhone,
        orderType: event.orderType,
        total: event.total,
        timestamp: event.timestamp,
      });
      
      // Play notification sound
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {
        // Ignore audio errors
      }
    });

    return () => {
      syncService.setWebsiteOrderCallback(null);
    };
  }, []);

  return (
    <SyncContext.Provider value={{ isConnected, lastSyncEvent, refreshKey, websiteOrderNotification, clearWebsiteOrderNotification }}>
      {children}
    </SyncContext.Provider>
  );
};

/**
 * Hook to access sync context
 */
export function useSyncContext(): SyncContextValue {
  return useContext(SyncContext);
}

/**
 * Hook that returns a refresh callback for a specific resource
 * Call this in your component to get notified when data changes
 */
export function useSyncRefresh(
  resources: Array<'orders' | 'order_items' | 'payments' | 'menu_items' | 'categories' | 'deals' | 'customers' | 'register_sessions' | 'settings' | 'employees' | 'staff' | 'expenses'>,
  onRefresh: () => void
): void {
  const { lastSyncEvent } = useSyncContext();
  const onRefreshRef = useRef(onRefresh);
  const resourcesRef = useRef(resources);

  // Keep refs updated
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  // Trigger refresh when relevant sync event occurs
  useEffect(() => {
    if (lastSyncEvent && resourcesRef.current.includes(lastSyncEvent.resource as any)) {
      onRefreshRef.current();
    }
  }, [lastSyncEvent]);
}
