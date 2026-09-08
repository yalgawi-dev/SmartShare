'use client';
import { useState, useEffect } from 'react';

import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from './context/SpacesContext';
import { useAuth } from './context/AuthContext';
import { getFeatureById } from './data/features';
import AuthModal from '../components/auth/AuthModal';
import WelcomeEmptyState from '../components/widgets/WelcomeEmptyState';
import AppShareModal from '../components/widgets/AppShareModal';

export default function Dashboard() {
  const { spaces, deleteSpace, getRoleForSpace, isLoaded: isSpacesLoaded } = useSpaces();
  const { user, isLoaded: isAuthLoaded, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [clientKeys, setClientKeys] = useState<Record<string, { role: string; token?: string }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      } catch (e) {}
    }
    return {};
  });
  const [guestTokens, setGuestTokens] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    const loadKeys = () => {
      try {
        setClientKeys(JSON.parse(localStorage.getItem('smartshare_keys') || '{}'));
        setGuestTokens(JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]'));
      } catch (e) {}
    };
    loadKeys();

    const onKeyChange = (e: any) => {
      const { spaceId, role, token } = e.detail || {};
      if (spaceId) {
        setClientKeys(prev => ({ ...prev, [spaceId]: { role, token } }));
      }
      if (token) {
        setGuestTokens(prev => prev.includes(token) ? prev : [...prev, token]);
      }
      loadKeys();
    };

    window.addEventListener('smartshare_new_key', onKeyChange);
    window.addEventListener('storage', loadKeys);
    window.addEventListener('focus', loadKeys);
    document.addEventListener('visibilitychange', loadKeys);
    return () => {
      window.removeEventListener('smartshare_new_key', onKeyChange);
      window.removeEventListener('storage', loadKeys);
      window.removeEventListener('focus', loadKeys);
      document.removeEventListener('visibilitychange', loadKeys);
    };
  }, []);

  const visibleSpaces = spaces.filter(s => { 
    if (s.status === 'pending_deletion') return false; 
    
    // 1. Creator check (strictly verified)
    if (user?.id && s.creatorId && user.id === s.creatorId) return true;
    if (user?.spaceKeys?.[s.id]?.role === 'creator') return true;
    if (clientKeys[s.id]?.role === 'creator') return true;
    
    // 2. Partner check (key or token)
    if (user?.spaceKeys?.[s.id]?.role === 'partner') return true;
    if (clientKeys[s.id]?.role === 'partner') return true;
    
    const partnerToken = user?.spaceKeys?.[s.id]?.token || clientKeys[s.id]?.token;
    const isMember = s.members?.some((m: any) => {
      if (user?.id && m.userId === user.id) return true;
      if (partnerToken && m.userId === partnerToken) return true;
      if (guestTokens.includes(m.userId)) return true;
      return false;
    });
    return isMember;
  });

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Logo Placeholder */}
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            <img src="/myspace_logo.png" alt="MySpace Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 className={styles.title} style={{ margin: 0, fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', whiteSpace: 'nowrap', lineHeight: '1.2' }}>MySpace</h1>
            <p className={styles.subtitle} style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'nowrap', opacity: 0.8 }}>פלטפורמת שיתוף</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
          {(user?.realName === 'אורח' || user?.realName === 'אורח אנונימי' || !user?.realName) && (
            <button 
              onClick={() => setShowAuthModal(true)}
              style={{ fontSize: '0.85rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 'bold', boxShadow: 'var(--shadow-sm)' }}
            >
              התחבר
            </button>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', padding: '0.2rem', gap: '0.2rem' }}>
            <button onClick={() => setShowShareModal(true)} style={{ padding: '0.4rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'transform 0.2s', borderRadius: '50%' }} title="שתף אפליקציה" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              🎁
            </button>
            {user?.isAdmin && (
              <Link href="/admin/users" style={{ padding: '0.4rem', color: '#EF4444', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'transform 0.2s', borderRadius: '50%' }} title="ניהול מערכת" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                🛡️
              </Link>
            )}
            <Link href="/settings" style={{ padding: '0.4rem', color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'transform 0.2s', borderRadius: '50%' }} title="הגדרות" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              ⚙️
            </Link>
            <Link href="/settings" style={{ padding: '0.2rem', textDecoration: 'none' }} title={`פרופיל - ${user?.realName || 'אורח'}`}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--primary)', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span style={{ fontSize: '1rem' }}>{user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤'}</span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Floating Action Button for New Space */}
      {(user?.realName === 'אורח' || user?.realName === 'אורח אנונימי' || !user?.realName) ? (
        <button 
          onClick={() => alert('כדי לפתוח מרחב וירטואלי משלך, עליך להזדהות תחילה (התחבר).')}
          className="fab" 
          title="פתח מרחב חדש"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          ➕
        </button>
      ) : (
        <Link href="/space/new" className="fab" title="צור מרחב חדש">
          ➕
        </Link>
      )}

      {(!isAuthLoaded || !isSpacesLoaded) ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className={styles.loader} style={{ border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : visibleSpaces.length === 0 ? (
        <WelcomeEmptyState />
      ) : (
      <div className={styles.grid}>
        {visibleSpaces.map(space => (
          <div key={space.id} style={{ position: 'relative' }}>
            <button 
              onClick={(e) => {
                e.preventDefault();
                if (confirm('למחוק את המרחב "' + space.title + '"? הפעולה תעביר אותו לארכיון המחיקה.')) {
                  deleteSpace(space.id);
                }
              }}
              style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                zIndex: 10,
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              title="מחק מרחב"
            >
              🗑️
            </button>
            <Link href={`/space/${space.id}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div className={`card ${styles.projectCard} glass-panel`}>
                <div className={styles.projectHeader}>
                  <div className={styles.projectIcon}>{space.icon}</div>
                </div>
                <h2 className={styles.projectTitle}>{space.title}</h2>
                <p className={styles.projectDesc}>{space.description}</p>
                
                <div className={styles.badges}>
                  {space.features.slice(0, 3).map(fId => {
                    const feature = getFeatureById(fId);
                    return feature ? <span key={fId} className={styles.badge}>{feature.name}</span> : null;
                  })}
                  {space.features.length > 3 && (
                    <span className={styles.badge}>+{space.features.length - 3}</span>
                  )}
                </div>

                <div className={styles.projectFooter}>
                  <span>עודכן: {space.updatedAt}</span>
                  <span>{space.features.length} פיצ'רים</span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
      )}
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        v5.0.10 - תיקון טעינת מסך הפתיחה לאורחים (FOUC Fix)
      </div>
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
      {showShareModal && (
        <AppShareModal onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}
