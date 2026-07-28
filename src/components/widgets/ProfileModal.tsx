import React from 'react';
import { createPortal } from 'react-dom';

interface ProfileInfo {
  name: string;
  avatarUrl?: string;
  status?: string;
  isCurrentUser?: boolean;
}

export default function ProfileModal({ profile, onClose }: { profile: ProfileInfo | null, onClose: () => void }) {
  if (!profile || typeof document === 'undefined') return null;

  const translateStatus = (status?: string) => {
    switch (status) {
      case 'single': return 'רווק/ה 🌟';
      case 'married': return 'נשוי/ה 💍';
      case 'relationship': return 'בזוגיות ❤️';
      case 'complicated': return 'מסובך 🌀';
      case 'hidden': return 'פרטי 🤫';
      default: return 'לא צוין';
    }
  };

  return createPortal(
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(5px)'
      }}
      onClick={onClose}
    >
      <div 
        className="card glass-panel" 
        style={{
          background: 'white', padding: '2rem', borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: '350px', textAlign: 'center', position: 'relative',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent close on clicking inside modal
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
        
        <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--border-light)', margin: '0 auto 1rem', overflow: 'hidden', border: '4px solid var(--primary)' }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>👤</div>
          )}
        </div>
        
        <h2 style={{ margin: '0 0 0.5rem', color: 'var(--primary)' }}>{profile.name}</h2>
        {profile.isCurrentUser && <span style={{ background: 'var(--accent)', color: 'white', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '10px', display: 'inline-block', marginBottom: '0.5rem' }}>זה אתה!</span>}
        
        {profile.status !== 'hidden' ? (
          <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
            {translateStatus(profile.status)}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-light)' }}>
            שומר/ת על פרטיות 🤫
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
