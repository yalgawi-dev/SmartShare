'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';

export default function InviteModal({ space, onClose }: { space: any, onClose: () => void }) {
  // Fake URL for the demo - in production this would be the real domain
  const inviteLink = `https://smartshare.app/space/${space.id}?role=guest`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('הקישור הועתק בהצלחה!');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(5px)' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', width: '100%', maxWidth: '450px', position: 'relative' }}>
        
        {/* Postcard Header */}
        <div style={{ position: 'relative', height: '180px', background: space.coverImage ? `url(${space.coverImage}) center/cover` : 'var(--primary)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8))', zIndex: 0 }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{space.title}</h2>
            {space.date && <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>📅 {new Date(space.date).toLocaleDateString('he-IL')}</p>}
          </div>
          
          <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', zIndex: 2 }}>✕</button>
        </div>

        {/* Postcard Body */}
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>מוזמנים להצטרף לגלריה!</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            סרקו את קוד ה-QR כדי להיכנס ישירות לאזור האירוע. ניתן להעלות תמונות, סרטונים ולכתוב ברכות ללא צורך בהרשמה!
          </p>

          <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', marginBottom: '1.5rem', display: 'inline-block' }}>
            <QRCode value={inviteLink} size={150} />
          </div>

          <button onClick={handleCopy} style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            🔗 העתק קישור לשליחה בוואטסאפ
          </button>
        </div>
      </div>
    </div>
  );
}
