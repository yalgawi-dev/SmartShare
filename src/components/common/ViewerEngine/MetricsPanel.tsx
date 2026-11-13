import React, { useState, useEffect } from 'react';
import { viewerMetrics, DocumentSessionMetrics } from '@/utils/viewerMetrics';

interface MetricsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MetricsPanel({ isOpen, onClose }: MetricsPanelProps) {
  const [history, setHistory] = useState<DocumentSessionMetrics[]>([]);

  useEffect(() => {
    return viewerMetrics.subscribe(setHistory);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '60px',
        right: '16px',
        width: '340px',
        maxWidth: '92vw',
        maxHeight: '80vh',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1.5px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
        zIndex: 200050,
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'monospace',
        direction: 'rtl'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(30, 41, 59, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#38bdf8' }}>
          ⏱️ מדדי ביצועים וטעינה
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '2px 6px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Body: Events list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', fontSize: '0.78rem' }}>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
            עדיין לא נרשמו פעולות. פתח מסמך לצפייה בזמנים.
          </div>
        ) : (
          history.map((sess, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '14px',
                background: 'rgba(30, 41, 59, 0.5)',
                padding: '8px 10px',
                borderRadius: '8px',
                border: sess.isFromCache ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: sess.isFromCache ? '#34d399' : '#60a5fa', fontWeight: 'bold' }}>
                  {sess.isFromCache ? '⚡ טעינה ממטמון מקומי' : '🌐 טעינת רשת/שרת'}
                </span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                  {sess.totalTimeMs}ms ({(sess.totalTimeMs / 1000).toFixed(1)}s)
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sess.events.map((ev, evIdx) => (
                  <div key={evIdx} style={{ color: '#e2e8f0', lineHeight: 1.4 }}>
                    • {ev.step}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
