'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { addActiveSeconds, recordSpaceEnter, prepareSyncPayload, getLocalTelemetry } from '../utils/telemetryTracker';
import { useAuth } from '../app/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * useTelemetryTracker:
 * Seamlessly tracks user active dwell time and space navigation in the background.
 * Active time is only counted when document.visibilityState is 'visible'.
 * Flushes to Firestore on background heartbeat (every 3 minutes) or tab leave without user friction.
 */
export function useTelemetryTracker(currentSpaceId?: string, currentSpaceTitle?: string) {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const isTabVisibleRef = useRef<boolean>(true);
  const lastFirestoreSyncRef = useRef<number>(Date.now());

  // Function to commit local telemetry to Firestore
  const syncToFirestore = async () => {
    if (!user?.id) return;
    try {
      const payload = prepareSyncPayload();
      if (payload.totalActiveSeconds > 0) {
        await updateDoc(doc(db, 'users', user.id), {
          telemetry: payload,
          lastActiveAt: new Date().toISOString()
        });
        lastFirestoreSyncRef.current = Date.now();
      }
    } catch (e) {
      // Quiet fail if offline
    }
  };

  // 1. Record Space visit whenever currentSpaceId mounts
  useEffect(() => {
    if (currentSpaceId) {
      recordSpaceEnter(currentSpaceId, currentSpaceTitle);
    }
  }, [currentSpaceId, currentSpaceTitle]);

  // 2. Track active dwell time in intervals & sync to server
  useEffect(() => {
    if (typeof window === 'undefined') return;

    isTabVisibleRef.current = document.visibilityState === 'visible';
    lastActiveTimestampRef.current = Date.now();

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        isTabVisibleRef.current = true;
        lastActiveTimestampRef.current = now;
      } else {
        // Tab went to background, commit elapsed seconds
        if (isTabVisibleRef.current) {
          const elapsedSec = Math.round((now - lastActiveTimestampRef.current) / 1000);
          if (elapsedSec > 0 && elapsedSec < 600) {
            addActiveSeconds(elapsedSec, currentSpaceId, currentSpaceTitle);
          }
        }
        isTabVisibleRef.current = false;
        lastActiveTimestampRef.current = now;

        // Auto-sync on leaving tab if more than 30 seconds since last sync
        if (now - lastFirestoreSyncRef.current >= 30000) {
          syncToFirestore();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic heartbeat every 15 seconds to accumulate active seconds
    const interval = setInterval(() => {
      if (isTabVisibleRef.current) {
        const now = Date.now();
        const elapsedSec = Math.round((now - lastActiveTimestampRef.current) / 1000);
        if (elapsedSec > 0 && elapsedSec < 60) {
          addActiveSeconds(elapsedSec, currentSpaceId, currentSpaceTitle);
        }
        lastActiveTimestampRef.current = now;

        // Periodic sync to Firestore every 3 minutes (180,000ms)
        if (now - lastFirestoreSyncRef.current >= 180000) {
          syncToFirestore();
        }
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      if (isTabVisibleRef.current) {
        const now = Date.now();
        const elapsedSec = Math.round((now - lastActiveTimestampRef.current) / 1000);
        if (elapsedSec > 0 && elapsedSec < 60) {
          addActiveSeconds(elapsedSec, currentSpaceId, currentSpaceTitle);
        }
        syncToFirestore();
      }
    };
  }, [currentSpaceId, currentSpaceTitle, pathname, user?.id]);
}
