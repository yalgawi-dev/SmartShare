const fs = require('fs');

const content = \'use client';
import { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import { createPortal } from 'react-dom';
import ContactSelector, { SelectedContact } from '../common/ContactSelector';

export default function ShareAppModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' 
    ? \\\\\\/?ref=\\\\\\ 
    : '';

  const shareText = 'היי! מצאתי פלטפורמה מעולה לניהול חכם של הוצאות, מסמכים, ועוד – לבד או עם שותפים. שווה בדיקה:';

  const handleContactSelect = (contact: SelectedContact) => {
    if (contact.userId) {
      alert(\\\\\\ כבר רשום במערכת! אין צורך להזמין אותו שוב.\\\);
      return;
    }

    const whatsappUrl = \\\https://wa.me/\\\?text=\\\\\\;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-main)', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '2rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--bg-card)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✖
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'bounce 2s infinite' }}>🎁</div>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.5rem' }}>שתף את MySpace</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            הזמן חברים ומשפחה לנהל יחד מרחבים חכמים בקלות.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <ContactSelector onSelect={handleContactSelect} title="בחר למי לשלוח את ההזמנה" />
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>או שתף קישור כללי:</div>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            {copied ? '✅ הועתק!' : '📋 העתק קישור להזמנה'}
          </button>
        </div>

      </div>
      <style>{\
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      \}</style>
    </div>,
    document.body
  );
}
\;
fs.writeFileSync('src/components/widgets/AppShareModal.tsx', content);
console.log('Fixed');
