'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface HistoryStep {
  id: string;
  label: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
  timestamp: number;
}

interface UseActionHistoryOptions {
  maxDepth?: number;
  enableKeyboardShortcuts?: boolean;
  onActionApplied?: (direction: 'undo' | 'redo', label: string) => void;
}

/**
 * DRY Single Source of Truth: Word-style Undo / Redo History Stack.
 * Supports step-by-step Undo (↩️) and Redo (↪️) with optional Ctrl+Z / Ctrl+Y shortcuts.
 */
export function useActionHistory(options: UseActionHistoryOptions = {}) {
  const { maxDepth = 20, enableKeyboardShortcuts = true, onActionApplied } = options;

  const [past, setPast] = useState<HistoryStep[]>([]);
  const [future, setFuture] = useState<HistoryStep[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const pastRef = useRef<HistoryStep[]>(past);
  const futureRef = useRef<HistoryStep[]>(future);
  const applyingRef = useRef<boolean>(false);

  pastRef.current = past;
  futureRef.current = future;

  const pushStep = useCallback(
    (step: Omit<HistoryStep, 'id' | 'timestamp'>) => {
      const entry: HistoryStep = {
        ...step,
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      };
      setPast((prev) => [...prev, entry].slice(-maxDepth));
      setFuture([]); // Word/Docs standard: any new action clears the redo branch
    },
    [maxDepth]
  );

  const undo = useCallback(async () => {
    if (applyingRef.current || pastRef.current.length === 0) return;
    const step = pastRef.current[pastRef.current.length - 1];
    applyingRef.current = true;
    setIsApplying(true);
    try {
      await step.undo();
      setPast((prev) => prev.slice(0, -1));
      setFuture((prev) => [step, ...prev].slice(0, maxDepth));
      onActionApplied?.('undo', step.label);
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  }, [maxDepth, onActionApplied]);

  const redo = useCallback(async () => {
    if (applyingRef.current || futureRef.current.length === 0) return;
    const step = futureRef.current[0];
    applyingRef.current = true;
    setIsApplying(true);
    try {
      await step.redo();
      setFuture((prev) => prev.slice(1));
      setPast((prev) => [...prev, step].slice(-maxDepth));
      onActionApplied?.('redo', step.label);
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  }, [maxDepth, onActionApplied]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Desktop Ctrl+Z / Ctrl+Y / Cmd+Z / Cmd+Shift+Z keyboard support
  useEffect(() => {
    if (!enableKeyboardShortcuts || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        if (pastRef.current.length > 0) {
          e.preventDefault();
          void undo();
        }
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        if (futureRef.current.length > 0) {
          e.preventDefault();
          void redo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboardShortcuts, undo, redo]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const lastUndoLabel = canUndo ? past[past.length - 1].label : null;
  const lastRedoLabel = canRedo ? future[0].label : null;

  return {
    canUndo,
    canRedo,
    undoCount: past.length,
    redoCount: future.length,
    lastUndoLabel,
    lastRedoLabel,
    isApplying,
    pushStep,
    undo,
    redo,
    clearHistory,
  };
}
