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
  const { spaces, updateSpaceSettings, updateMemberPermissions, toggleFeature, removeMember, restoreMember } = useSpaces();
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
      
      
      {/* Unified Sticky Header - Professional Premium UI */}
      <div style={{ 
        position: 'sticky', top: 0, background: 'rgba(248, 250, 252, 0.9)', 
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100, padding: '0.75rem 1rem', margin: '-1rem -1rem 1.5rem -1rem', 
        borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'grid', 
        gridTemplateColumns: '80px 1fr 80px', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        {/* Right side - Back button (RTL layout implies it might be on the right, but we keep layout order) */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Link href={`/space/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontWeight: '600', textDecoration: 'none', background: 'white', padding: '0.35rem 0.85rem', borderRadius: '100px', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', fontSize: '0.9rem', transition: 'all 0.2s' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>&rarr;</span> לקיר
          </Link>
        </div>
        
        {/* Center - Title with Ellipsis to prevent wrapping */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: '800', color: 'var(--text-primary)', fontSize: '1.1rem', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{space.icon || '📁'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{space.title}</span>
        </div>
        
        {/* Left side - Empty spacer to balance the grid */}
        <div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
        
        {/* Dynamic Features Sections */}
        {space.features.map((featureId: string) => {
          const feature = getFeatureById(featureId);
          if (!feature) return null;

          return (
            <div key={featureId} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  הגדרות מנוע &bull; {feature.name}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(0,0,0,0.1), transparent)' }}></div>
              </div>
              <section className="card glass-panel" style={{ padding: '0', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.05)' }}>
              
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
                          <span style={{ width: '70px', textAlign: 'center' }}>סטטוס</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>העלאה</span>
                          <span style={{ width: '70px', textAlign: 'center' }}>מחיקה</span>
                        </div>
                        
                        {space.members.map((m: any) => (
                          <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ flex: 1, fontWeight: '500', fontSize: '0.95rem' }}>
                              <div>
                                {m.name} {m.userId === user?.id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>(אני)</span>}
                                {m.isActive === false && <span style={{ color: '#ef4444', fontSize: '0.85rem' }}> (לא פעיל)</span>}
                              </div>
                              {m.status === 'pending' && (
                                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem', fontWeight: 'bold' }}>
                                  ⏳ ממתין לאישור השותף
                                </div>
                              )}
                              {m.status === 'disputed' && (
                                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.2rem', background: '#fef2f2', padding: '0.4rem', borderRadius: '4px' }}>
                                  <strong>יש השגה:</strong> {m.disputeMessage}
                                </div>
                              )}
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: m.userId === user?.id ? 'not-allowed' : 'pointer', opacity: m.userId === user?.id ? 0.5 : 1 }} title={m.userId === user?.id ? "לא ניתן להסיר את עצמך מהפרויקט" : ""}>
                                <input 
                                  type="checkbox" 
                                  checked={m.isActive !== false} 
                                  disabled={m.userId === user?.id}
                                  onChange={(e) => {
                                    if (!e.target.checked) {
                                      if (confirm(`האם אתה בטוח שברצונך להסיר את ${m.name} מהשותפות? החובות שלו מחשבוניות עבר יישמרו, אך המערכת תבצע איזון מחדש לחשבוניות הבאות.`)) {
                                        removeMember(space.id, m.userId, user?.id || 'unknown');
                                      }
                                    } else {
                                      restoreMember(space.id, m.userId, user?.id || 'unknown');
                                    }
                                  }}
                                  style={{ display: 'none' }}
                                />
                                <div style={{ width: '36px', height: '20px', background: m.isActive !== false ? '#10b981' : '#cbd5e1', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.isActive !== false ? '2px' : '18px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                                </div>
                              </label>
                              
                              {m.isActive === false && (
                                <button 
                                  onClick={() => {
                                    if (confirm(`מחיקה לצמיתות (Hard Delete): האם אתה בטוח שברצונך למחוק את ${m.name} כליל מהפרויקט? פעולה זו תמחק גם את ההיסטוריה שלו.`)) {
                                      removeMember(space.id, m.userId, user?.id || 'unknown', true);
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="מחיקה לצמיתות"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: m.isActive === false ? 0.5 : 1 }}>
                                <input type="checkbox" checked={m.canUpload} disabled={m.isActive === false} onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} style={{ display: 'none' }} />
                                <div style={{ width: '36px', height: '20px', background: m.canUpload ? 'var(--primary)' : '#ccc', borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: m.canUpload ? '2px' : '18px', transition: '0.3s' }} />
                                </div>
                              </label>
                            </div>
                            
                            <div style={{ width: '70px', display: 'flex', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="checkbox" checked={m.canDelete} onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} style={{ display: 'none' }} disabled={m.isActive === false} />
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
            </div>
          );
        })}

      </div>
    </div>
  );
}
