'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App ErrorBoundary]', error);
  }, [error]);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: '#f8fafc',
        textAlign: 'center',
        gap: '1rem',
      }}
    >
      <div style={{ fontSize: '2.5rem' }}>🔄</div>
      <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
        הדף זקוק לרענון מהיר
      </h2>
      <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', maxWidth: '320px' }}>
        התרחשה שגיאה רגעית בטעינה. לחיצה למטה תטען את האפליקציה מחדש בצורה נקייה.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '0.65rem 1.2rem',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          נסה שוב
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '0.65rem 1.2rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
            color: '#ffffff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          רענן אפליקציה
        </button>
      </div>
    </div>
  );
}
