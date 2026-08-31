'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import styles from '../page.module.css';
import { AVAILABLE_FEATURES, getFeatureById } from '../../../data/features';

export default function SpaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { spaces, updateSpaceSettings, updateMemberPermissions, toggleFeature } = useSpaces();
  const { user } = useAuth();
  
  const space = spaces.find(s => s.id === id);

  const [vatRate, setVatRate] = useState<number>(18);

  useEffect(() => {
    if (space?.settings) {
      setVatRate(space.settings.defaultVatRate);
    }
  }, [space]);

  if (!space) {
    return <div className={styles.container}><h1>המרחב לא נמצא.</h1></div>;
  }

  const handleVatChange = (newVat: number) => {
    setVatRate(newVat);
    updateSpaceSettings(id, { defaultVatRate: newVat });
  };

  const handleToggleWallEdit = (allow: boolean) => {
    updateSpaceSettings(id, { allowPartnersToEditWall: allow });
  };

  const handleInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הזמנה למרחב שותפות ב-MySpace',
          text: 'היי! צירפתי אותך עכשיו למרחב שותפות באפליקציה שלנו.',
          url: `${window.location.origin}/space/${id}`,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('שיתוף לא נתמך בדפדפן זה. העתק את כתובת הדף.');
    }
  };

  const hasPartners = space.features.includes('partners');
  const hasFinance = space.features.includes('finance');

  return (
    <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Sticky Header / Back Button */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem 0', margin: '-1rem -1rem 1.5rem -1rem', paddingLeft: '1rem', paddingRight: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <Link href={`/space/${id}`} className={styles.backBtn} style={{ margin: 0 }}>
          <span>&rarr;</span> חזרה לקיר הפרויקט
        </Link>
      </div>

      <header className={styles.header} style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className={styles.title}>הגדרות המרחב: {space.title}</h1>
          <p className={styles.subtitle}>ניהול הגדרות, הרשאות ותוספים במקום אחד (השינויים נשמרים אוטומטית).</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* General Settings Section */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span> הגדרות כלליות
          </h2>
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-light)' }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>שם המרחב</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{space.title}</p>
            </div>
          </div>
        </section>


        {/* Tools & Features Management Section */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🧩</span> ניהול כלים ותוספים
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            הוסף או הסר כלים מהמרחב שלך בלחיצת כפתור. הכלי יתווסף ישירות למסך הראשי.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {AVAILABLE_FEATURES.map(feature => {
              const isActive = space.features.includes(feature.id);
              return (
                <div key={feature.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: isActive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: isActive ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      {feature.icon}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{feature.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>{feature.desc}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (isActive) {
                        let msg = `האם אתה בטוח שברצונך לכבות את התוסף "${feature.name}"?\nהוא יוסר ממסך המרחב הראשי, אך הנתונים יישמרו (אם קיימים).`;
                        if (feature.id === 'partners') {
                          msg = 'שים לב! הסרת תוסף שותפים לא תמחק שותפים קיימים, אך הם לא יוכלו לגשת להוצאות. המאזנים יתאפסו. האם אתה בטוח?';
                        }
                        if (window.confirm(msg)) {
                          toggleFeature(id, feature.id as any, user?.id || 'me');
                        }
                      } else {
                        toggleFeature(id, feature.id as any, user?.id || 'me');
                      }
                    }}
                    style={{ 
                      background: isActive ? '#fee2e2' : 'var(--primary)', 
                      color: isActive ? '#991b1b' : 'white', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontWeight: 'bold', 
                      cursor: 'pointer', 
                      fontSize: '0.85rem',
                      minWidth: '80px',
                      flexShrink: 0
                    }}
                  >
                    {isActive ? 'הסר' : 'הוסף כלי'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>


        {/* Partners Dynamic Section */}
        {hasPartners && (
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👥</span> ניהול שותפים והרשאות
            </h2>
            <button 
              onClick={handleInvite}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', boxShadow: 'var(--shadow-sm)' }}
            >
              + הוסף שותף
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>עריכת ה-Wall המרכזי</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>אפשר לשותפים להוסיף ולסדר רכיבים במסך הראשי</p>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="checkbox" 
                  checked={space.settings?.allowPartnersToEditWall || false} 
                  onChange={(e) => handleToggleWallEdit(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} 
                />
                <div style={{ 
                  width: '44px', height: '24px', 
                  background: space.settings?.allowPartnersToEditWall ? 'var(--primary)' : '#ccc', 
                  borderRadius: '24px', 
                  position: 'relative',
                  transition: 'background 0.3s'
                }}>
                  <div style={{
                    width: '20px', height: '20px',
                    background: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: space.settings?.allowPartnersToEditWall ? '2px' : '22px',
                    transition: 'left 0.3s'
                  }} />
                </div>
              </div>
            </label>
          </div>

          {space.members && space.members.length > 0 ? (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ flex: 1 }}>שם חבר/ה</span>
                <span style={{ width: '70px', textAlign: 'center' }}>העלאות</span>
                <span style={{ width: '70px', textAlign: 'center' }}>מחיקות</span>
              </div>
              
              {space.members.map((m: any) => (
                <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>
                    {m.name} {m.userId === user?.id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>(אני)</span>}
                  </div>
                  
                  {/* Upload Toggle */}
                  <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={m.canUpload} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} 
                        style={{ display: 'none' }} 
                      />
                      <div style={{ width: '36px', height: '20px', background: m.canUpload ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                        <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canUpload ? '2px' : '18px', transition: '0.3s' }} />
                      </div>
                    </label>
                  </div>
                  
                  {/* Delete Toggle */}
                  <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={m.canDelete} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} 
                        style={{ display: 'none' }} 
                      />
                      <div style={{ width: '36px', height: '20px', background: m.canDelete ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                        <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canDelete ? '2px' : '18px', transition: '0.3s' }} />
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', marginTop: '1rem', border: '1px dashed var(--border-light)' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>טרם צורפו שותפים נוספים למרחב.</p>
            </div>
          )}
        </section>
        )}

        {/* Finance Section */}
        {hasFinance && (
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💰</span> הגדרות פיננסיות
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>מע"מ ברירת מחדל</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                יוחל אוטומטית על כל הוצאה חדשה במרחב.
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                onBlur={() => handleVatChange(vatRate)}
                style={{ 
                  width: '60px', 
                  padding: '0.4rem', 
                  fontSize: '1rem', 
                  textAlign: 'center', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  background: 'white'
                }} 
              />
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>%</span>
            </div>
          </div>
        </section>
        )}

      </div>

    </div>
  );
}
