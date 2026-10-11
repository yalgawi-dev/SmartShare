'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface NotificationHelpModalProps {
  onClose: () => void;
  onRetry?: () => void;
}

export default function NotificationHelpModal({ onClose, onRetry }: NotificationHelpModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'incognito' | 'blocked' | 'ios'>('incognito');
  const [copied, setCopied] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const iosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(iosDevice);

      // Check if permission is explicitly blocked
      if ('Notification' in window && Notification.permission === 'denied') {
        setActiveTab('blocked');
      } else if (iosDevice && !(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) {
        // iOS browser
        setActiveTab('ios');
      } else {
        // Check for likely private browsing
        const detectPrivate = async () => {
          try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
              const { quota } = await navigator.storage.estimate();
              if (quota && quota < 120000000) {
                setActiveTab('incognito');
                return;
              }
            }
          } catch (e) {}
          // Default to incognito since this modal is opened after failure and permission wasn't denied
          setActiveTab('incognito');
        };
        detectPrivate();
      }
    }
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const handleCopyLink = () => {
    try {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch (e) {
      // Fallback
      setCopied(true);
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
          border: '1px solid #e2e8f0',
          fontFamily: 'inherit'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '2px solid #bfdbfe',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
            marginBottom: '0.75rem'
          }}>
            {activeTab === 'incognito' ? '🕶️' : activeTab === 'blocked' ? '🔒' : '📱'}
          </div>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.35rem', color: '#0f172a', fontWeight: '800' }}>
            הפעלת התראות לטלפון
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            למה זה לא הופעל ואיך לפתור זאת בנגיעה אחת
          </p>
        </div>

        {/* Situation Tabs */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '1.25rem',
          gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('incognito')}
            style={{
              flex: 1,
              padding: '0.5rem 0.25rem',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === 'incognito' ? '#ffffff' : 'transparent',
              color: activeTab === 'incognito' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'incognito' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            גלישה בסתר
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            style={{
              flex: 1,
              padding: '0.5rem 0.25rem',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === 'blocked' ? '#ffffff' : 'transparent',
              color: activeTab === 'blocked' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'blocked' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            חסימת הרשאה
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            style={{
              flex: 1,
              padding: '0.5rem 0.25rem',
              border: 'none',
              borderRadius: '9px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              background: activeTab === 'ios' ? '#ffffff' : 'transparent',
              color: activeTab === 'ios' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'ios' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            משתמשי אייפון
          </button>
        </div>

        {/* Content Tab 1: Incognito */}
        {activeTab === 'incognito' && (
          <div>
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontWeight: '800', color: '#92400e', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                מדוע זה קורה?
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#78350f', lineHeight: '1.5' }}>
                במצב <strong>גלישה בסתר (חלון פרטי)</strong>, מערכת ההפעלה של הטלפון חוסמת לחלוטין קבלת התראות כדי לשמור על דיסקרטיות מלאה ולא להשאיר עקבות במכשיר.
              </p>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                איך לפתור את זה בקלות?
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: '1.5' }}>
                פשוט העתק את הקישור בלחיצה מטה, פתח חלון רגיל של הדפדפן והדבק אותו — ושם ההתראות יופעלו מיד!
              </p>
            </div>

            <button 
              onClick={handleCopyLink}
              style={{
                width: '100%',
                padding: '0.95rem 1.25rem',
                background: copied ? '#10b981' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
                boxShadow: copied ? '0 4px 14px rgba(16, 185, 129, 0.35)' : '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s ease',
                marginBottom: '1rem'
              }}
            >
              <span>{copied ? '✓' : '📋'}</span>
              {copied ? 'הקישור הועתק! פתח חלון רגיל והדבק' : 'העתק קישור ופתח בחלון רגיל'}
            </button>
          </div>
        )}

        {/* Content Tab 2: Blocked */}
        {activeTab === 'blocked' && (
          <div>
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontWeight: '800', color: '#991b1b', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                מדוע זה קורה?
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#7f1d1d', lineHeight: '1.5' }}>
                הדפדפן זוכר שבעבר נלחץ <strong>'חסום'</strong>. כדי להגן עליך, הטלפון לא יציג שוב את הבקשה עד שתשחרר את החסימה באופן ידני.
              </p>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                איך לשחרר ב-2 שניות:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>1.</span>
                  <span>הקש על סמל המנעול / ההגדרות <strong>🔒</strong> בראש הדפדפן (ליד הכתובת).</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>2.</span>
                  <span>הקש על <strong>הרשאות</strong> (Permissions) ➔ <strong>התראות</strong>.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>3.</span>
                  <span>העבר את המתג למצב <strong>'אפשר'</strong> (Allow) ➔ וחזור לכאן!</span>
                </div>
              </div>
            </div>

            {onRetry && (
              <button 
                onClick={() => {
                  onClose();
                  onRetry();
                }}
                style={{
                  width: '100%',
                  padding: '0.95rem 1.25rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.2s ease',
                  marginBottom: '1rem'
                }}
              >
                <span>🔄</span> בדוק שוב לאחר שפתחת
              </button>
            )}
          </div>
        )}

        {/* Content Tab 3: iOS */}
        {activeTab === 'ios' && (
          <div>
            <div style={{
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontWeight: '800', color: '#1e40af', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                מדוע זה קורה?
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e3a8a', lineHeight: '1.5' }}>
                באייפון (Apple iOS), קבלת התראות מתאפשרת רק באפליקציות שהתווספו למסך הבית.
              </p>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                איך להוסיף ב-3 שניות:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>1.</span>
                  <span>הקש על כפתור השיתוף <strong>⎋</strong> בתחתית מסך Safari.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>2.</span>
                  <span>גלול ובחר <strong>'הוסף למסך הבית'</strong> (Add to Home Screen).</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>3.</span>
                  <span>פתח את האפליקציה ממסך הבית — וההתראות יפעלו כרגיל!</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.8rem 1rem',
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #cbd5e1',
            borderRadius: '14px',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          סגור חלון זה
        </button>
      </div>
    </div>,
    document.body
  );
}
