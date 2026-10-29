'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { addActiveSeconds, recordSpaceEnter } from '../utils/telemetryTracker';

/**
 * useTelemetryTracker:
 * Seamlessly tracks user active dwell time and space navigation in the background.
 * Active time is only counted when document.visibilityState is 'visible'.
 * Zero Firestore overhead - strictly client-side accumulation.
 */
export function useTelemetryTracker(currentSpaceId?: string, currentSpaceTitle?: string) {
  const pathname = usePathname();
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const isTabVisibleRef = useRef<boolean>(true);

  // 1. Record Space visit whenever currentSpaceId mounts
  useEffect(() => {
    if (currentSpaceId) {
      recordSpaceEnter(currentSpaceId, currentSpaceTitle);
    }
  }, [currentSpaceId, currentSpaceTitle]);

  // 2. Track active dwell time in intervals
  useEffect(() => {
    if (typeof window === 'undefined') return;

    isTabVisibleRef.current = document.visibilityState === 'visible';
    lastActiveTimestampRef.current = Date.now();

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        // Tab became visible again
        isTabVisibleRef.current = true;
        lastActiveTimestampRef.current = now;
      } else {
        // Tab went to background, commit elapsed seconds
        if (isTabVisibleRef.current) {
          const elapsedSec = Math.round((now - lastActiveTimestampRef.current) / 1000);
          if (elapsedSec > 0 && elapsedSec < 600) { // Discard abnormal gaps > 10 mins
            addActiveSeconds(elapsedSec, currentSpaceId, currentSpaceTitle);
          }
        }
        isTabVisibleRef.current = false;
        lastActiveTimestampRef.current = now;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic heartbeat every 20 seconds to flush active seconds
    const interval = setInterval(() => {
      if (isTabVisibleRef.current) {
        const now = Date.now();
        const elapsedSec = Math.round((now - lastActiveTimestampRef.current) / 1000);
        if (elapsedSec > 0 && elapsedSec < 60) {
          addActiveSeconds(elapsedSec, currentSpaceId, currentSpaceTitle);
        }
        lastActiveTimestampRef.current = now;
      }
    }, 20000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      // Flush remaining seconds on unmount
      if (isTabVisibleRef.current) {
        const now = Date.now();
        const elapsedSec = Math.round((now - lastActiveTimestampRef.current) / 1000);
        if (elapsedSec > 0 && elapsedSec < 60) {
          addActiveSeconds(elapsedSec, currentSpaceId, currentSpaceTitle);
        }
      }
    };
  }, [currentSpaceId, currentSpaceTitle, pathname]);
}
