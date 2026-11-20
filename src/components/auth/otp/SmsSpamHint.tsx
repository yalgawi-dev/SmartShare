'use client';

import React, { useEffect, useState } from 'react';

type Platform = 'android' | 'ios' | 'other';

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  return 'other';
};

const STEPS: Record<Platform, string[]> = {
  android: [
    'פתח את אפליקציית ההודעות (Messages).',
    'לחץ למעלה על העיגול עם האות שלך (תמונת הפרופיל).',
    'בחר "שיחות חסומות וספאם".',
    'העתק משם את הקוד והדבק אותו כאן.'
  ],
  ios: [
    'פתח את אפליקציית ההודעות.',
    'לחץ למעלה משמאל על "מסננים".',
    'בחר "שולחים לא מוכרים" או "זבל".',
    'העתק משם את הקוד והדבק אותו כאן.'
  ],
  other: [
    'בדוק את תיבת ההודעות בטלפון.',
    'אם אין הודעה – בדוק בתיקיית הספאם / הודעות חסומות.',
    'העתק את הקוד והדבק אותו כאן.'
  ]
};

/** Platform-aware, plain-language "where is my SMS?" guide. */
export default function SmsSpamHint() {
  const [platform, setPlatform] = useState<Platform>('other');
  useEffect(() => setPlatform(detectPlatform()), []);

  return (
    <div style={{
      background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '14px',
      padding: '12px 14px', textAlign: 'right', direction: 'rtl', marginBottom: '14px'
    }}>
      <div style={{ fontWeight: 800, color: '#B45309', fontSize: '0.92rem', marginBottom: '6px' }}>
        📩 לא קיבלת הודעה? כנראה שהיא בספאם:
      </div>
      <ol style={{ margin: 0, paddingInlineStart: '18px', color: '#78350F', fontSize: '0.85rem', lineHeight: 1.6 }}>
        {STEPS[platform].map((s) => <li key={s}>{s}</li>)}
      </ol>
    </div>
  );
}
