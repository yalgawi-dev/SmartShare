'use client';

import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from './context/SpacesContext';
import { useAuth } from './context/AuthContext';
import { getFeatureById } from './data/features';

export default function Dashboard() {
  const { spaces } = useSpaces();
  const { user } = useAuth();

  return (
    <div className={styles.container}>
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Logo Placeholder */}
          <div style={{ width: '48px', height: '48px', background: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem', flexShrink: 0 }}>
            S
          </div>
          <div>
            <h1 className={styles.title} style={{ margin: 0, fontSize: '1.75rem' }}>SmartShare</h1>
            <p className={styles.subtitle} style={{ margin: 0, fontSize: '1rem' }}>המרחבים שלי</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {user?.isAdmin && (
            <Link href="/admin/users" style={{ padding: '0.6rem 1rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', fontWeight: 'bold', textDecoration: 'none', fontSize: '0.9rem' }}>
              🛡️ אדמין
            </Link>
          )}
          <Link href="/settings" style={{ padding: '0.5rem', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ padding: '0 0.5rem', fontSize: '0.9rem' }}>⚙️ הגדרות אישיות</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--primary)', overflow: 'hidden', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {user?.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt="Profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.innerHTML = user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤';
                    fallback.style.fontSize = '1.2rem';
                    (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                  }}
                />
              ) : (
                <span style={{ fontSize: '1.2rem' }}>
                  {user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤'}
                </span>
              )}
            </div>
          </Link>
        </div>
      </header>

      {/* Floating Action Button for New Space */}
      <Link href="/space/new" className="fab" title="צור מרחב חדש">
        ➕
      </Link>

      <div className={styles.grid}>
        {spaces.map(space => (
          <Link href={`/space/${space.id}`} key={space.id}>
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
        ))}
      </div>
    </div>
  );
}
