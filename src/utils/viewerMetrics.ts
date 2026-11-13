/**
 * Performance Profiler & Metrics Tracker for Document Viewer
 * Tracks exact timestamps, network fetch duration, first render, cloud rendering, and cache hits.
 */

export interface MetricEvent {
  step: string;
  durationMs: number;
  timestamp: string;
  details?: Record<string, any>;
}

export interface DocumentSessionMetrics {
  docId: string;
  sourceType: 'pdf' | 'webp' | 'image';
  isFromCache: boolean;
  totalTimeMs: number;
  events: MetricEvent[];
  startedAt: number;
}

class ViewerMetricsTracker {
  private activeSessions = new Map<string, { start: number; lastStepTime: number; events: MetricEvent[] }>();
  private history: DocumentSessionMetrics[] = [];
  private listeners = new Set<(history: DocumentSessionMetrics[]) => void>();

  public startSession(docId: string, sourceType: 'pdf' | 'webp' | 'image' = 'pdf') {
    const now = performance.now();
    this.activeSessions.set(docId, {
      start: now,
      lastStepTime: now,
      events: [{
        step: '🚀 התחלת טעינת מסמך',
        durationMs: 0,
        timestamp: new Date().toLocaleTimeString(),
        details: { docId, sourceType }
      }]
    });
    this.notify();
  }

  public recordStep(docId: string, stepName: string, details?: Record<string, any>) {
    const session = this.activeSessions.get(docId);
    if (!session) return;

    const now = performance.now();
    const durationFromStart = Math.round(now - session.start);
    const durationFromPrev = Math.round(now - session.lastStepTime);
    session.lastStepTime = now;

    session.events.push({
      step: `${stepName} (+${durationFromPrev}ms, סה"כ: ${durationFromStart}ms)`,
      durationMs: durationFromPrev,
      timestamp: new Date().toLocaleTimeString(),
      details
    });

    this.notify();
  }

  public endSession(docId: string, isFromCache: boolean = false, finalStatus = 'הושלם בהצלחה') {
    const session = this.activeSessions.get(docId);
    if (!session) return;

    const now = performance.now();
    const totalTimeMs = Math.round(now - session.start);

    session.events.push({
      step: `🏁 ${finalStatus} (סה"כ: ${totalTimeMs}ms)`,
      durationMs: Math.round(now - session.lastStepTime),
      timestamp: new Date().toLocaleTimeString(),
      details: { totalTimeMs, isFromCache }
    });

    const fullSession: DocumentSessionMetrics = {
      docId,
      sourceType: 'pdf',
      isFromCache,
      totalTimeMs,
      events: [...session.events],
      startedAt: session.start
    };

    this.history.unshift(fullSession);
    if (this.history.length > 20) this.history.pop();
    this.activeSessions.delete(docId);
    this.notify();
  }

  public getHistory(): DocumentSessionMetrics[] {
    return this.history;
  }

  public subscribe(cb: (history: DocumentSessionMetrics[]) => void) {
    this.listeners.add(cb);
    cb(this.history);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => {
      try { cb(this.history); } catch (_) {}
    });
  }
}

export const viewerMetrics = new ViewerMetricsTracker();
