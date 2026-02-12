import { useEffect, useRef } from 'react';
import { syncService, type SyncEvent, type SyncEventType } from '@/services/syncService';

/**
 * Hook to subscribe to real-time sync events
 * @param resource - Resource type to listen for, or '*' for all
 * @param callback - Function to call when sync event occurs
 */
export function useSync(
  resource: SyncEventType | '*',
  callback: (event: SyncEvent) => void
): void {
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = syncService.subscribe(resource, (event) => {
      callbackRef.current(event);
    });

    return unsubscribe;
  }, [resource]);
}

/**
 * Hook to subscribe to multiple resource types
 * @param resources - Array of resource types to listen for
 * @param callback - Function to call when sync event occurs
 */
export function useSyncMultiple(
  resources: SyncEventType[],
  callback: (event: SyncEvent) => void
): void {
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribes = resources.map((resource) =>
      syncService.subscribe(resource, (event) => {
        callbackRef.current(event);
      })
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [resources.join(',')]); // Re-subscribe if resources change
}
