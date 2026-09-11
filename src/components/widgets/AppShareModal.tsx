'use client';
import { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import { createPortal } from 'react-dom';
import ContactSelector, { SelectedContact } from '../common/ContactSelector';

export default function ShareAppModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${user?.id || 'guest'}` 
    : '';

  const shareText = 'היי! מצאתי פלטפורמה מעולה לארגון חכם של שותפויות, מסמכים, ועוד – לבד או עם שותפים, שווה בדיקה:';

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הזמנה למערכת MySpace',
          text: shareText,
          url: shareUrl
        });
        onClose();
      } catch (err) {
        console.error('Error sharing', err);
      }
    }
  };

  const handleContactSelect = (contact: SelectedContact) => {
    if (contact.userId) {
      alert(`${contact.name} כבר שותף במערכת! אין צורך לשלוח הזמנה חדשה.`);
      return;
    }

    const whatsappUrl = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent('היי ' + contact.name + ', \n' + shareText + '\n' + shareUrl)}`;
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-main)', borderRadius: '24px', width: '100%', maxWidth: '400px', padding: '2rem 1.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'var(--bg-card)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', animation: 'bounce 2s infinite' }}>🎁</div>
          <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.4rem' }}>שתף את MySpace</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
            הזמן חברים ומשפחה לנהל יחד מרחבים חכמים בקלות.
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <ContactSelector onSelect={handleContactSelect} title="בחר למי לשלוח את ההזמנה:" />
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>או שתף קישור כללי:</div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            { 'share' in navigator && (
              <button onClick={handleNativeShare} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxSizing: 'border-box' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                שתף
              </button>
            )}
            <button onClick={handleCopy} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxSizing: 'border-box' }}>
              {copied ? '✓ הועתק!' : '🔗 העתק קישור'}
            </button>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>,
    document.body
  );
}
