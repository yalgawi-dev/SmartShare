'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../../context/SpacesContext';
import styles from '../page.module.css';

export default function SpaceSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { spaces, updateSpaceSettings } = useSpaces();
  
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
        
        {/* Permissions Section */}
        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
            🤝 הרשאות שותפים
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>עריכת ה-Wall המרכזי</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>האם שותפים למרחב מורשים להוסיף או להסיר כלים (Widgets) מהקיר?</p>
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
        </section>

        {/* Finance Section */}
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

        {/* Save Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
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

      </div>
    </div>
  );
}
