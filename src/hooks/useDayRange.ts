import { useEffect, useState, useCallback } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { db } from '@/db';
import { getSettings } from '@/services/settingsService';
import type { DateRange } from '@/services/reportService';
import type { RegisterSession } from '@/db/types';

interface DayRangeResult {
  /** Whether the setting is loaded */
  ready: boolean;
  /** True when day = register session */
  dayCountByRegister: boolean;
  /** Get "today" range — register session bounds when enabled, calendar day otherwise */
  getTodayRange: () => Promise<DateRange>;
  /** Reload the setting (call after settings change) */
  refresh: () => Promise<void>;
}

/**
 * Hook that resolves "today" as either:
 * - Calendar day (midnight to midnight) — default
 * - Current register session (openedAt to closedAt/now) — when dayCountByRegister is enabled
 *
 * If no open register session exists when the setting is enabled, falls back to calendar day.
 */
export function useDayRange(): DayRangeResult {
  const [dayCountByRegister, setDayCountByRegister] = useState(false);
  const [ready, setReady] = useState(false);

  const loadSetting = useCallback(async () => {
    try {
      const settings = await getSettings();
      setDayCountByRegister(!!settings?.dayCountByRegister);
    } catch {
      setDayCountByRegister(false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    loadSetting();
  }, [loadSetting]);

  const getTodayRange = useCallback(async (): Promise<DateRange> => {
    // Re-read the setting each time to stay current
    let useRegister = dayCountByRegister;
    try {
      const settings = await getSettings();
      useRegister = !!settings?.dayCountByRegister;
    } catch {
      // keep existing value
    }

    if (useRegister) {
      try {
        // Find the most recent open register session
        const session = await db.registerSessions
          .where('status')
          .equals('open')
          .first();

        if (session?.openedAt) {
          const openedAt = session.openedAt instanceof Date ? session.openedAt : new Date(session.openedAt);
          if (!Number.isNaN(openedAt.getTime())) {
            return {
              startDate: openedAt,
              endDate: session.closedAt
                ? (session.closedAt instanceof Date ? session.closedAt : new Date(session.closedAt as string))
                : new Date(), // still open → use current time
            };
          }
        }

        // No open session — try the last closed session today
        const now = new Date();
        const todayStart = startOfDay(now);
        const sessions = await db.registerSessions.toArray();
        const todaySessions = sessions
          .filter((s: RegisterSession) => {
            const opened = s.openedAt instanceof Date ? s.openedAt : new Date(s.openedAt);
            return opened >= todayStart;
          })
          .sort((a: RegisterSession, b: RegisterSession) => {
            const aTime = (a.openedAt instanceof Date ? a.openedAt : new Date(a.openedAt)).getTime();
            const bTime = (b.openedAt instanceof Date ? b.openedAt : new Date(b.openedAt)).getTime();
            return bTime - aTime; // most recent first
          });

        if (todaySessions.length > 0) {
          const latest = todaySessions[0];
          const openedAt = latest.openedAt instanceof Date ? latest.openedAt : new Date(latest.openedAt);
          const closedAt = latest.closedAt
            ? (latest.closedAt instanceof Date ? latest.closedAt : new Date(latest.closedAt as string))
            : new Date();
          return { startDate: openedAt, endDate: closedAt };
        }
      } catch {
        // Fall through to calendar day
      }
    }

    // Default: calendar day
    const now = new Date();
    return { startDate: startOfDay(now), endDate: endOfDay(now) };
  }, [dayCountByRegister]);

  return { ready, dayCountByRegister, getTodayRange, refresh: loadSetting };
}
