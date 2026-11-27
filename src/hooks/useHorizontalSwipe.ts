'use client';

import { useRef } from 'react';

interface UseHorizontalSwipeOptions {
  /** Called when finger swipes right-to-left (dx < -threshold) */
  onSwipeLeft: () => void;
  /** Called when finger swipes left-to-right (dx > threshold) */
  onSwipeRight: () => void;
  thresholdPx?: number;
}

/**
 * Reusable DRY horizontal swipe gesture hook for Calendar Month / Week / Day navigation.
 * Carefully ignores vertical scrolling (requires |dx| > threshold && |dx| > |dy| * 1.4).
 */
export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  thresholdPx = 56,
}: UseHorizontalSwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.changedTouches?.[0];
    if (!t) {
      startRef.current = null;
      return;
    }
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    startRef.current = null;

    if (Math.abs(dx) >= thresholdPx && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    }
  };

  return { onTouchStart, onTouchEnd };
}
