'use client';

import React, { useState } from 'react';

interface GuestIdentityGateCardProps {
  spaceTitle: string;
  spaceLogoUrl?: string;
  itemName: string;
  itemType: 'file' | 'folder';
  onSubmit: (guest: { name: string; phone: string; profession?: string }) => Promise<void> | void;
}

const QUICK_PROFESSIONS = ['קבלן', 'אינסטלטור', 'חשמלאי', 'אדריכל / מהנדס', 'ספק / חומרים', 'לקוח'];

export function GuestIdentityGateCard({
  spaceTitle,
  spaceLogoUrl,
  itemName,
  itemType,
  onSubmit,
}: GuestIdentityGateCardProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profession, setProfession] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanProfession = profession.trim();
    const digits = cleanPhone.replace(/\D/g, '');

    if (cleanName.length < 2) {
      setError('אנא הזן שם מלא או שם עסק (לפחות 2 תווים).');
      return;
    }
    if (cleanProfession.length < 2) {
      setError('אנא בחר או הזן את תחום העיסוק / מקצוע שלך.');
      return;
    }
    if (digits.length < 9 || digits.length > 15) {
      setError('אנא הזן מספר טלפון תקין (9–10 ספרות).');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: cleanName, phone: cleanPhone, profession: cleanProfession });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        direction: 'rtl',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '400px',
          borderRadius: '24px',
          padding: '2rem 1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.42)',
          textAlign: 'center',
        }}
      >
        {spaceLogoUrl ? (
          <img
            src={spaceLogoUrl}
            alt={spaceTitle}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              objectFit: 'cover',
              margin: '0 auto 0.75rem',
              border: '1px solid #e2e8f0',
            }}
          />
        ) : (
          <div style={{ fontSize: '2.4rem', marginBottom: '0.6rem' }}>🪪</div>
        )}

        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#4f46e5', marginBottom: '0.2rem' }}>
          {spaceTitle}
        </div>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
          זיהוי מהיר לצפייה
        </h2>
        <p style={{ margin: '0.45rem 0 1.25rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
          לצפייה ב-{itemType === 'folder' ? 'תיקייה' : 'מסמך'}{' '}
          <strong style={{ color: '#1e293b' }}>&quot;{itemName}&quot;</strong>,<br />
          הזן שם וטלפון פעם אחת בלבד (נשמר במכשירך לכניסות הבאות).
        </p>

        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'right' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '0.3rem' }}>
              שם מלא / שם עסק *
            </label>
            <input
              type="text"
              autoFocus
              required
              placeholder="למשל: אבי כהן - עבודות גמר"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              style={{
                width: '100%',
                padding: '0.72rem 0.85rem',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.92rem',
                fontWeight: 600,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '0.3rem' }}>
              תחום / מקצוע *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem', marginBottom: '0.45rem' }}>
              {QUICK_PROFESSIONS.map((prof) => {
                const active = profession.trim() === prof;
                return (
                  <button
                    key={prof}
                    type="button"
                    onClick={() => {
                      setProfession(prof);
                      if (error) setError(null);
                    }}
                    style={{
                      padding: '0.28rem 0.58rem',
                      borderRadius: '999px',
                      border: active ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                      background: active ? '#eef2ff' : '#f8fafc',
                      color: active ? '#3730a3' : '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {prof}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              required
              placeholder="או הקלד תחום (למשל: קבלן שלד, אלומיניום, מטבחים)..."
              value={profession}
              onChange={(e) => {
                setProfession(e.target.value);
                if (error) setError(null);
              }}
              style={{
                width: '100%',
                padding: '0.68rem 0.85rem',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.88rem',
                fontWeight: 600,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '0.3rem' }}>
              מספר טלפון *
            </label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              required
              placeholder="050-0000000"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              style={{
                width: '100%',
                padding: '0.72rem 0.85rem',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.95rem',
                fontWeight: 700,
                textAlign: 'left',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: '0.78rem',
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.45rem 0.65rem',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              marginTop: '0.25rem',
              padding: '0.82rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.95rem',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.32)',
            }}
          >
            {submitting ? '⏳ פותח מסמך...' : '🔓 המשך לצפייה במסמך'}
          </button>
        </form>
      </div>
    </div>
  );
}
