import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { syncService, type SyncEvent } from '@/services/syncService';

interface SyncContextValue {
  isConnected: boolean;
  lastSyncEvent: SyncEvent | null;
  refreshKey: number;
}

const SyncContext = createContext<SyncContextValue>({
  isConnected: false,
  lastSyncEvent: null,
  refreshKey: 0,
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncEvent, setLastSyncEvent] = useState<SyncEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect on mount
  useEffect(() => {
    syncService.connect();

    // Check connection status periodically
    checkIntervalRef.current = setInterval(() => {
      setIsConnected(syncService.isConnected());
    }, 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      syncService.disconnect();
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

  return (
    <SyncContext.Provider value={{ isConnected, lastSyncEvent, refreshKey }}>
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
