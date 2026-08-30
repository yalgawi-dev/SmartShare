'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import styles from '../page.module.css';

export default function SpaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { spaces, updateSpaceSettings, updateMemberPermissions } = useSpaces();
  const { user } = useAuth();
  
  const space = spaces.find(s => s.id === id);

  // Local state for form
  const [vatRate, setVatRate] = useState<number>(18);
  const [allowEdit, setAllowEdit] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (space?.settings) {
      setVatRate(space.settings.defaultVatRate);
      setAllowEdit(space.settings.allowPartnersToEditWall);
    }
  }, [space]);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const handleSave = () => {
    updateSpaceSettings(id, {
      defaultVatRate: vatRate,
      allowPartnersToEditWall: allowEdit
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הצטרף למרחב שלי ב-MySpace',
          text: 'היי! אני מזמין אותך להצטרף אלי למרחב העבודה המשותף שלנו.',
          url: `${window.location.origin}/space/${id}`,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('אפשרות השיתוף אינה נתמכת בדפדפן זה. העתק את הקישור במקום.');
    }
  };

  const hasPartners = space.features.includes('partners');
  const hasFinance = space.features.includes('finance');

  return (
    <div className={styles.container} style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Link href={`/space/${id}`} className={styles.backBtn}>
        <span>&rarr;</span> חזרה לקיר הפרויקט
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>⚙️ הגדרות מרחב: {space.title}</h1>
          <p className={styles.subtitle}>נהל הרשאות שותפים והגדרות פיננסיות של הפרויקט</p>
        </div>
      </header>

      <div className="card glass-panel" style={{ padding: '2rem', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Partners Dynamic Section */}
        {hasPartners && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>
              👥 ניהול שותפים למרחב
            </h2>
            <button 
              onClick={handleInvite}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              + הזמן שותפים
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <h4 style={{ margin: "0 0 0.2rem 0", fontSize: "1rem", color: "var(--text-primary)" }}>מע"מ (%)</h4>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.2" }}>
                יופעל אוטומטית על כל ההוצאות.
              </p>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="checkbox" 
                  checked={allowEdit} 
                  onChange={(e) => setAllowEdit(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} 
                />
                <div style={{ 
                  width: '50px', height: '26px', 
                  background: allowEdit ? 'var(--primary)' : '#ccc', 
                  borderRadius: '26px', 
                  position: 'relative',
                  transition: 'background 0.3s'
                }}>
                  <div style={{
                    width: '22px', height: '22px',
                    background: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: allowEdit ? '2px' : '26px',
                    transition: 'left 0.3s'
                  }} />
                </div>
              </div>
            </label>
          </div>
          {/* Dynamic List for Partners Permissions */}
          {space.members && space.members.length > 0 ? (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <span style={{ flex: 1 }}>שם האורח</span>
                <span style={{ width: '80px', textAlign: 'center' }}>העלאה</span>
                <span style={{ width: '80px', textAlign: 'center' }}>מחיקה</span>
              </div>
              
              {space.members.map((m: any) => (
                <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ flex: 1, fontWeight: '500' }}>
                    {m.name} {m.userId === user?.id && <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>(אתה)</span>}
                  </div>
                  
                  {/* Upload Toggle */}
                  <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
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
                  <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
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
            <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>אין חברים במרחב עדיין.</p>
          )}
        </section>
        )}

        {/* Finance Section */}
        {hasFinance && (
        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            💰 הגדרות התחשבנות
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>מע"מ ברירת מחדל (%)</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                מספר זה ישמש לחישוב מע"מ עבור חשבוניות חדשות שיוזנו החל מהיום. חשבוניות ישנות שומרות את אחוז המע"מ שהיה נהוג ביום הפקתן כדי למנוע חישוב רטרואקטיבי.
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                style={{ 
                  width: '80px', 
                  padding: '0.5rem', 
                  fontSize: '1.1rem', 
                  textAlign: 'center', 
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)'
                }} 
              />
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>%</span>
            </div>
          </div>
        </section>
        )}

        {/* Save Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
          {isSaved && <span style={{ color: 'green', display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>✓ נשמר בהצלחה</span>}
          <button 
            onClick={() => router.push(`/space/${id}`)}
            style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
            ביטול
          </button>
          <button 
            onClick={handleSave}
            style={{ padding: '0.75rem 2rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer' }}>
            שמור הגדרות
          </button>
        </div>

        {/* Audit Logs Section */}
        <section style={{ borderTop: '1px solid var(--border-light)', paddingTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📜</span> יומן שקיפות ואמון (Audit Logs)
          </h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            מערכת ה-Audit Log מתעדת פעולות קריטיות כגון עזיבה/הסרת שותפים ושינויים באחוזי חלוקת הכספים במרחב, להבטחת שקיפות מלאה.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(!space.auditLogs || space.auditLogs.length === 0) ? (
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                אין עדיין רשומות יומן למרחב זה.
              </div>
            ) : (
              space.auditLogs.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(log.timestamp).toLocaleDateString('he-IL')} <br/> {new Date(log.timestamp).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                      {log.actionType === 'MEMBER_REMOVED' ? 'הסרת שותף' : 
                       log.actionType === 'AUTO_BALANCE' ? 'איזון אוטומטי לאחוזים' : 
                       log.actionType === 'SHARES_UPDATED' ? 'עדכון אחוזי השתתפות' : 
                       log.actionType === 'EDIT_INVOICE' ? 'עריכת הוצאה' :
                       log.actionType === 'DELETE_INVOICE' ? 'מחיקת הוצאה' : log.actionType}
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>{log.details}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
