'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import styles from '../page.module.css';
import { getFeatureById } from '../../../data/features';

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

  if (!space) return <div className={styles.container}><h1>המרחב אינו קיים.</h1></div>;

  const handleVatChange = (newVat: number) => {
    setVatRate(newVat);
    updateSpaceSettings(id, { defaultVatRate: newVat });
  };

  const handleToggleWallEdit = (allow: boolean) => {
    updateSpaceSettings(id, { allowPartnersToEditWall: allow });
  };

  const removeFeature = (featureId: string, featureName: string) => {
    let msg = `האם אתה בטוח שברצונך להסיר את "${featureName}"?\nהוא יוסר מהמרחב אך הנתונים יישמרו (אם קיימים).`;
    if (featureId === 'partners') {
      msg = 'שים לב! הסרת תוסף שותפים לא תמחק שותפים קיימים, אך הם לא יוכלו לגשת להוצאות. המאזנים יתאפסו. האם אתה בטוח?';
    }
    if (window.confirm(msg)) {
      toggleFeature(id, featureId as any, user?.id || 'me');
    }
  };

  return (
    <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Sticky Header / Back Button */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem 0', margin: '-1rem -1rem 1.5rem -1rem', paddingLeft: '1rem', paddingRight: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <Link href={`/space/${id}`} className={styles.backBtn} style={{ margin: 0, display: 'inline-block', color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>
          <span>&rarr;</span> חזרה לקיר המרחב
        </Link>
      </div>

      <header className={styles.header} style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className={styles.title}>הגדרות המרחב: {space.title}</h1>
          <p className={styles.subtitle}>ניהול מקצועי ומתקדם של הכלים המותקנים בפרויקט שלך.</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* General Settings Section */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1.25rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span> הגדרות כלליות
          </h2>
          <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-light)' }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>שם המרחב</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{space.title}</p>
            </div>
            <div style={{ fontSize: '2rem', background: 'var(--bg-main)', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
              {space.icon || '📁'}
            </div>
          </div>
        </section>

        {/* Dynamic Features Sections */}
        {space.features.map((featureId: string) => {
          const feature = getFeatureById(featureId);
          if (!feature) return null;

          return (
            <section key={featureId} className="card glass-panel" style={{ padding: '0', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              
              {/* Feature Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-light)', padding: '1.25rem 1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800' }}>
                  <span style={{ fontSize: '1.5rem' }}>{feature.icon}</span> {feature.name}
                </h2>
                <button 
                  onClick={() => removeFeature(feature.id, feature.name)}
                  style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                >
                  הסרת הכלי
                </button>
              </div>

              {/* Feature Body */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Specific configs for Finance */}
                {featureId === 'finance' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>אחוז מע"מ מוגדר</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ישפיע על חישוב המע"מ בסורק</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input 
                          type="number" 
                          value={vatRate}
                          onChange={(e) => setVatRate(Number(e.target.value))}
                          onBlur={() => handleVatChange(vatRate)}
                          style={{ width: '70px', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', fontWeight: 'bold' }}
                        />
                        <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>%</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>צפייה בדוחות חכמים</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>דוחות מפורטים של ההתחשבנות (PDF/Excel)</p>
                      </div>
                      <Link href={`/space/${space.id}/reports`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontWeight: '600', textDecoration: 'none', padding: '0.5rem 1.25rem', background: 'var(--primary)', borderRadius: '8px', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <span>📊</span>
                        לדוחות
                      </Link>
                    </div>
                  </>
                )}

                {/* Specific configs for Partners */}
                {featureId === 'partners' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>עריכת הקיר הראשי</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>מאפשר לשותפים לערוך את כותרת ותאריך המרחב</p>
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
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span style={{ flex: 1 }}>שם השותף</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>העלאה</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>מחיקה</span>
                        </div>
                        
                        {space.members.map((m: any) => (
                          <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>
                              {m.name} {m.userId === user?.id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>(אני)</span>}
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canUpload} onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} style={{ display: 'none' }} />
                                <div style={{ width: '36px', height: '20px', background: m.canUpload ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canUpload ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canDelete} onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} style={{ display: 'none' }} />
                                <div style={{ width: '36px', height: '20px', background: m.canDelete ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canDelete ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-light)' }}>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>עדיין לא הוספת שותפים דרך הקיר.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Generic features message */}
                {featureId !== 'finance' && featureId !== 'partners' && (
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{feature.desc}</p>
                )}

              </div>
            </section>
          );
        })}

      </div>
    </div>
  );
}
