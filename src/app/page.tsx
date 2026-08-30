'use client';

import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from './context/SpacesContext';
import { useAuth } from './context/AuthContext';
import { getFeatureById } from './data/features';

export default function Dashboard() {
  const { spaces, deleteSpace } = useSpaces();
  const { user, isLoaded, loginWithGoogle } = useAuth();

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          {/* Logo Placeholder */}
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            <img src="/myspace_logo.png" alt="MySpace Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className={styles.title} style={{ margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.75rem)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MySpace</h1>
            <p className={styles.subtitle} style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>המרחבים שלי</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', display: 'none' }}>
            {/* Keeping this hidden on very small screens via media queries in standard CSS, but doing it inline for now if possible. Actually, just display it. */}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem', marginRight: '0.5rem', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '80px' }}>
              {user?.realName || user?.nickname || 'אורח'}
            </span>
            {(!user?.email) && (
              <button 
                onClick={() => loginWithGoogle()}
                style={{ fontSize: '0.65rem', background: '#4285F4', color: 'white', border: 'none', borderRadius: '4px', padding: '0.1rem 0.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                title="התחברות עם Google לשמירת נתונים"
              >
                <span>G</span> התחבר
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {user?.isAdmin && (
              <Link href="/admin/users" style={{ padding: '0.4rem 0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', fontWeight: 'bold', textDecoration: 'none', fontSize: '1rem', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--border-light)' }} title="ניהול מערכת">
                🛡️
              </Link>
            )}
            <Link href="/settings" style={{ padding: '0.4rem 0.6rem', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }} title="הגדרות פרופיל">
              <span style={{ fontSize: '1.2rem' }}>⚙️</span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--primary)', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
      <Link href="/space/new" className="fab" title="צור מרחב חדש">
        ➕
      </Link>

      <div className={styles.grid}>
        {spaces.filter(s => s.status !== 'pending_deletion').map(space => (
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
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        v4.5.37 - הרחבת לוג המחיקות עם פירוט מדויק, והוספת ארכיון שחזור הוצאות מחוקות.
      </div>
    </div>
  );
}
