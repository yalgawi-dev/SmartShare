'use client';

import { useEffect, useRef } from 'react';

interface StackEntry {
  id: string;
  keyTag: string;
  onBack: () => void;
}

// Single Global LIFO Stack for Android / Galaxy Hardware Back Button (Single Source of Truth).
// Guarantees that pressing the physical Back button ALWAYS pops ONLY the single topmost
// overlay, viewer, drawer, modal, or nested folder — never skipping multiple layers at once.
const hardwareBackStack: StackEntry[] = [];
let globalListenerAttached = false;
let ignoreNextPopCount = 0;
let seqCounter = 0;

function ensureGlobalPopStateListener(): void {
  if (typeof window === 'undefined' || globalListenerAttached) return;
  globalListenerAttached = true;

  window.addEventListener('popstate', () => {
    if (ignoreNextPopCount > 0) {
      ignoreNextPopCount--;
      return;
    }
    const top = hardwareBackStack.pop();
    if (top) {
      try {
        top.onBack();
      } catch (err) {
        console.warn('[useHardwareBack] onBack error:', err);
      }
    }
  });
}

function pushStackEntry(entry: StackEntry): void {
  if (typeof window === 'undefined') return;
  ensureGlobalPopStateListener();
  hardwareBackStack.push(entry);
  try {
    window.history.pushState(
      { ...(window.history.state || {}), __hwBackId: entry.id, __hwBackTag: entry.keyTag },
      ''
    );
  } catch (_) {}
}

function removeStackEntry(id: string): void {
  if (typeof window === 'undefined') return;
  const idx = hardwareBackStack.findIndex((e) => e.id === id);
  if (idx === -1) return;

  const isTop = idx === hardwareBackStack.length - 1;
  hardwareBackStack.splice(idx, 1);

  // If closed via UI button (✕) while at the top of history, cleanly pop the dummy history entry
  // without triggering any other hardware-back handler.
  if (isTop && window.history.state?.__hwBackId === id) {
    ignoreNextPopCount++;
    try {
      window.history.back();
    } catch (_) {
      ignoreNextPopCount = Math.max(0, ignoreNextPopCount - 1);
    }
  }
}

/**
 * Boolean overlay hook: pushes 1 step onto the global LIFO Hardware Back stack
 * when `isOpen` becomes true, and pops cleanly on Galaxy/Android Back or UI close.
 */
export function useHardwareBack(isOpen: boolean, onBack: () => void, keyTag = 'overlay'): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen && !activeIdRef.current) {
      const id = `hwb_${keyTag}_${++seqCounter}_${Date.now()}`;
      activeIdRef.current = id;
      pushStackEntry({
        id,
        keyTag,
        onBack: () => {
          activeIdRef.current = null;
          onBackRef.current();
        },
      });
    } else if (!isOpen && activeIdRef.current) {
      const id = activeIdRef.current;
      activeIdRef.current = null;
      removeStackEntry(id);
    }
  }, [isOpen, keyTag]);

  useEffect(() => {
    return () => {
      if (activeIdRef.current) {
        const id = activeIdRef.current;
        activeIdRef.current = null;
        removeStackEntry(id);
      }
    };
  }, []);
}

/**
 * Multi-level drill-down hook (e.g., Shelves -> Folder -> Child Folder -> Grandchild Folder).
 * Pass a non-null `stepKey` whenever the user is deeper than root (e.g. `"shelf1::folder2"`),
 * or `null` when at root. Each deeper navigation pushes a new entry on the global LIFO stack,
 * so pressing Back steps back ONE level at a time even when viewers/modals open on top.
 */
export function useHardwareBackStep(
  stepKey: string | null,
  onBack: () => void,
  keyTag = 'nav-step'
): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const stepEntriesRef = useRef<Array<{ id: string; key: string }>>([]);
  const lastStepKeyRef = useRef<string | null>(null);
  const poppedByHardwareRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (poppedByHardwareRef.current) {
      poppedByHardwareRef.current = false;
      lastStepKeyRef.current = stepKey;
      if (!stepKey) {
        // Reached root: clean any leftover entries
        while (stepEntriesRef.current.length > 0) {
          const old = stepEntriesRef.current.pop()!;
          removeStackEntry(old.id);
        }
      }
      return;
    }

    if (!stepKey) {
      lastStepKeyRef.current = null;
      while (stepEntriesRef.current.length > 0) {
        const old = stepEntriesRef.current.pop()!;
        removeStackEntry(old.id);
      }
      return;
    }

    if (stepKey !== lastStepKeyRef.current) {
      lastStepKeyRef.current = stepKey;
      // If user clicked a UI breadcrumb/back arrow to jump UP to an already-visited ancestor step,
      // pop the deeper entries instead of pushing a duplicate history state!
      const existingIdx = stepEntriesRef.current.findIndex((e) => e.key === stepKey);
      if (existingIdx !== -1) {
        while (stepEntriesRef.current.length > existingIdx + 1) {
          const popped = stepEntriesRef.current.pop()!;
          removeStackEntry(popped.id);
        }
        return;
      }

      const id = `hwb_${keyTag}_${++seqCounter}_${Date.now()}`;
      stepEntriesRef.current.push({ id, key: stepKey });
      pushStackEntry({
        id,
        keyTag,
        onBack: () => {
          poppedByHardwareRef.current = true;
          const idx = stepEntriesRef.current.findIndex((e) => e.id === id);
          if (idx !== -1) stepEntriesRef.current.splice(idx, 1);
          onBackRef.current();
        },
      });
    }
  }, [stepKey, keyTag]);

  useEffect(() => {
    return () => {
      while (stepEntriesRef.current.length > 0) {
        const old = stepEntriesRef.current.pop()!;
        removeStackEntry(old.id);
      }
    };
  }, []);
}
