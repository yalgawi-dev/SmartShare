'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface NotificationHelpModalProps {
  onClose: () => void;
  onRetry?: () => void;
}

export default function NotificationHelpModal({ onClose, onRetry }: NotificationHelpModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const iosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const androidDevice = /Android/i.test(ua);
      setIsIOS(iosDevice);
      setIsAndroid(androidDevice);
    }
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const handleOpenPhoneSettings = () => {
    try {
      if (isAndroid) {
        // Try to launch Android notification settings directly for Chrome / browser
        window.location.href = 'intent://#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=com.android.chrome;end';
        setTimeout(() => {
          // Fallback to general application details settings if Chrome package fails
          try {
            window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.android.chrome;end';
          } catch(e) {}
        }, 800);
      } else {
        alert('פתח את הגדרות המכשיר ⚙️ > Safari / MySpace > אפשר התראות');
      }
    } catch (e) {
      console.error('Failed to launch settings intent', e);
    }
  };

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.75rem',
          position: 'relative',
          border: '1px solid #e2e8f0'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '2px solid #bfdbfe',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.2rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
          }}>
            🔔
          </div>
          <h3 style={{ margin: '0.85rem 0 0.35rem 0', fontSize: '1.4rem', color: '#0f172a', fontWeight: '800' }}>
            הפעלת התראות בטלפון
          </h3>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#64748b' }}>
            כדי שלא תפספס שום הוצאה, הודעה או שותף
          </p>
        </div>

        {/* Incognito Warning */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: '16px',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🕶️</span>
          <div style={{ fontSize: '0.88rem', color: '#92400e', lineHeight: '1.45' }}>
            <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#78350f' }}>גולש במצב גלישה בסתר (חלון פרטי)?</strong>
            הטלפון חוסם התראות בחלונות פרטיים כדי לשמור על פרטיותך. פשוט פתח את MySpace בחלון רגיל – וההתראות יופעלו מיד!
          </div>
        </div>

        {/* Direct Action for Mobile */}
        {isAndroid && (
          <div style={{ marginBottom: '1.25rem' }}>
            <button 
              onClick={handleOpenPhoneSettings}
              style={{
                width: '100%',
                padding: '0.95rem 1.25rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '16px',
                fontWeight: 'bold',
                fontSize: '1.05rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
              }}
            >
              <span>⚙️</span> פתח הגדרות התראות בטלפון
            </button>
            <p style={{ margin: '0.5rem 0 0 0', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
              בלחיצה תועבר ישירות להגדרות ההתראות של המכשיר
            </p>
          </div>
        )}

        {/* Simple 2-Step visual guide */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '1.1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⚡</span> איך להפעיל ב-2 שניות (ללא מאמץ):
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#3b82f6',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                flexShrink: 0,
                marginTop: '1px'
              }}>1</div>
              <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.4' }}>
                {isAndroid ? (
                  <>במסך ההגדרות או בסרגל העליון (3 הנקודות <strong>⋮</strong> או סמל <strong>🔒</strong>) — לחץ על <strong>התראות</strong>.</>
                ) : isIOS ? (
                  <>היכנס ל<strong>הגדרות המכשיר ⚙️</strong> ➔ <strong>Safari / MySpace</strong> ➔ <strong>התראות</strong>.</>
                ) : (
                  <>לחץ על סמל המנעול <strong>🔒</strong> בראש הדפדפן ➔ <strong>הרשאות</strong> ➔ <strong>התראות</strong>.</>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                flexShrink: 0,
                marginTop: '1px'
              }}>2</div>
              <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.4' }}>
                <strong>רואה את המתג?</strong> פשוט תלחץ עליו שיהיה דלוק (כחול או ירוק) ➔ וחזור לכאן!
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.8rem 1rem',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
          >
            הבנתי, תודה 👍
          </button>
          
          {onRetry && (
            <button 
              onClick={() => {
                onClose();
                onRetry();
              }}
              style={{
                flex: 1,
                padding: '0.8rem 1rem',
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
              }}
            >
              נסה להפעיל שוב 🔄
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
