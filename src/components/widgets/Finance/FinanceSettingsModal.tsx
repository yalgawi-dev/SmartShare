'use client';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

interface FinanceSettingsModalProps {
  space: any;
  onClose: () => void;
  updateSpaceSettings: (spaceId: string, settings: any) => Promise<any> | void;
  isCreator: boolean;
}

export function FinanceSettingsModal({
  space,
  onClose,
  updateSpaceSettings,
  isCreator
}: FinanceSettingsModalProps) {
  const currentSettings = space?.settings || {};
  const [sharedExpensesOnly, setSharedExpensesOnly] = useState<boolean>(
    Boolean(currentSettings.sharedExpensesOnly || currentSettings.disableSettlements)
  );
  const [vatRate, setVatRate] = useState<number>(
    typeof currentSettings.defaultVatRate === 'number' ? currentSettings.defaultVatRate : 18
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggleMode = async (enabled: boolean) => {
    setSharedExpensesOnly(enabled);
    setIsSaving(true);
    try {
      await updateSpaceSettings(space.id, {
        sharedExpensesOnly: enabled,
        disableSettlements: enabled
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update finance settings', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVatChange = async (rate: number) => {
    setVatRate(rate);
    try {
      await updateSpaceSettings(space.id, {
        defaultVatRate: rate
      });
    } catch (err) {
      console.error('Failed to update VAT rate', err);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(5px)',
        direction: 'rtl',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚙️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                הגדרות תוסף הוצאות
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {space.title || 'מרחב'} &bull; ניהול מודל הפעילות
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Main Setting: Shared Expenses Only vs Settlements */}
          <div
            style={{
              background: sharedExpensesOnly ? '#eff6ff' : '#f8fafc',
              border: sharedExpensesOnly ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '1.25rem',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🏡</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                    מעקב הוצאות משותף בלבד
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>
                    (ללא התחשבנות כספית, חובות וחלוקת אחוזים)
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  disabled={!isCreator || isSaving}
                  checked={sharedExpensesOnly}
                  onChange={(e) => handleToggleMode(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: isCreator ? 'pointer' : 'not-allowed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: sharedExpensesOnly ? '#2563eb' : '#cbd5e1',
                    borderRadius: '34px',
                    transition: '.3s',
                    boxShadow: sharedExpensesOnly ? '0 2px 8px rgba(37,99,235,0.3)' : 'none'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '22px',
                      width: '22px',
                      left: sharedExpensesOnly ? '25px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '.3s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }}
                  />
                </span>
              </label>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.5' }}>
              מתאים להורים שמנהלים הוצאות בית יחד, זוגות או שותפים לפרויקט שרק רוצים לסכם מי שילם כמה עבור המרחב — 
              <strong> ללא חישוב חובות, ללא קוביית התחשבנות וללא חלוקת אחוזים</strong>.
            </p>

            {sharedExpensesOnly && (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '0.75rem',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.78rem',
                  color: '#1e40af',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ fontWeight: 800 }}>✨ במצב זה:</div>
                <div>• קוביות המאזן וההמתנה לאישורים מוסתרות ממסך הסיכום.</div>
                <div>• טבלת השותפים מציגה רק כמה שילם כל שותף (ללא עמודת % וללא עמודת חובה/זכות).</div>
                <div>• ניתן להמשיך להוסיף שותפים למרחב בחופשיות.</div>
              </div>
            )}

            {!isCreator && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                * רק יוצר/מנהל המרחב רשאי לשנות הגדרה זו.
              </span>
            )}
          </div>

          {/* Setting 2: Default VAT Rate */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              background: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', color: '#0f172a', fontWeight: 800 }}>
                אחוז מע״מ ברירת מחדל
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                משפיע על חישוב המע״מ בסורק החשבוניות
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number"
                disabled={!isCreator}
                value={vatRate}
                onChange={(e) => handleVatChange(Number(e.target.value))}
                style={{
                  width: '65px',
                  padding: '0.45rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem'
                }}
              />
              <span style={{ fontWeight: 800, color: '#64748b' }}>%</span>
            </div>
          </div>

          {/* Quick link to reports */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              background: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e2e8f0'
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', color: '#0f172a', fontWeight: 800 }}>
                דוחות והדפסות
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                דוחות מפורטים של כלל ההוצאות ב-PDF או Excel
              </p>
            </div>
            <Link
              href={`/space/${space.id}/reports`}
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: '#ffffff',
                fontWeight: 700,
                textDecoration: 'none',
                padding: '0.45rem 1rem',
                background: '#2563eb',
                borderRadius: '10px',
                fontSize: '0.85rem',
                boxShadow: '0 2px 5px rgba(37,99,235,0.2)'
              }}
            >
              <span>📊</span> לדוחות
            </Link>
          </div>

          {saveSuccess && (
            <div
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                padding: '0.6rem',
                borderRadius: '10px',
                textAlign: 'center',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: '1px solid #bbf7d0'
              }}
            >
              ✓ ההגדרות נשמרו בהצלחה
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#f1f5f9',
              color: '#334155',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
