import React, { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../../utils/notifications';

export function PushNotificationReminder({ userId }: { userId?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if notifications are supported and not yet granted/denied
    if (!('Notification' in window)) return;
    
    const permission = Notification.permission;
    if (permission === 'granted') return; // Already enabled

    // Check localStorage for cooldown
    const lastDismissed = localStorage.getItem('pushReminderDismissedAt');
    const dismissType = localStorage.getItem('pushReminderDismissType');

    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed).getTime();
      const now = new Date().getTime();
      const daysSinceDismiss = (now - dismissedDate) / (1000 * 3600 * 24);

      if (dismissType === 'forever') return;
      if (dismissType === 'later' && daysSinceDismiss < 7) return;
    }

    // Show banner if not dismissed or cooldown expired
    setShow(true);
  }, []);

  const handleAction = async (type: 'enable' | 'later' | 'forever') => {
    if (type === 'enable') {
      if (userId) {
        const success = await requestNotificationPermission(userId);
        if (success) {
          setShow(false);
          // If successful, don't show again
          localStorage.setItem('pushReminderDismissType', 'forever');
          localStorage.setItem('pushReminderDismissedAt', new Date().toISOString());
        } else {
          // If denied, they blocked it. Don't show again.
          setShow(false);
          localStorage.setItem('pushReminderDismissType', 'forever');
          localStorage.setItem('pushReminderDismissedAt', new Date().toISOString());
        }
      }
    } else {
      setShow(false);
      localStorage.setItem('pushReminderDismissType', type);
      localStorage.setItem('pushReminderDismissedAt', new Date().toISOString());
    }
  };

  if (!show) return null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
      margin: '0 0 1.5rem 0',
      boxShadow: 'var(--shadow-md)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#22c55e' }}></div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>🔔</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 'bold' }}>
            הידעת?
          </h4>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
            {Notification.permission === 'denied' 
              ? 'ההתראות חסומות. כדי לא לפספס הודעות, פתח את הגדרות הטלפון -> אפליקציות -> SmartShare והפעל התראות.'
              : 'כדי לא לפספס הודעות ופעולות חשובות בקבוצה, מומלץ להפעיל התראות כעת.'}
          </p>
        </div>
      </div>

      {Notification.permission !== 'denied' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button 
            onClick={() => handleAction('enable')}
            style={{ 
              background: '#22c55e', color: 'white', border: 'none', padding: '0.7rem 1rem', 
              borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1, 
              fontSize: '0.95rem', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
            }}
          >
            הפעל התראות עכשיו
          </button>
        </div>
      )}
      
      {/* Close button X */}
      <button 
        onClick={() => handleAction('later')}
        style={{
          position: 'absolute', top: '0.75rem', left: '0.75rem', // RTL: left is the physical left (visual left)
          background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--text-secondary)',
          cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.6
        }}
        title="סגור"
      >
        &times;
      </button>
      
      {Notification.permission === 'denied' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => handleAction('forever')}
            style={{ 
              background: 'transparent', color: 'var(--text-secondary)', border: 'none', 
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            הבנתי, אל תציג שוב
          </button>
        </div>
      )}
    </div>
  );
}
