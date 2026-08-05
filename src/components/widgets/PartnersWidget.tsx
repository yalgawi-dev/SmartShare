'use client';

import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { useState } from 'react';

export default function PartnersWidget({ space, onRemove }: { space: any, onRemove?: () => void }) {
  const { updateMemberPermissions, removeMember, restoreMember } = useSpaces();
  const { user } = useAuth();
  const [showManage, setShowManage] = useState(false);
  const activePartnersCount = space.members?.length || 0;
  
  const handleInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הצטרף למרחב שלי ב-MySpace',
          text: 'היי! אני מזמין אותך להצטרף אלי למרחב העבודה המשותף שלנו.',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('אפשרות השיתוף אינה נתמכת בדפדפן זה. העתק את הקישור במקום.');
    }
  };

  return (
    <div className="card glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '1.5rem', background: 'var(--bg-main)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👥</div>
          <div>
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-primary)' }}>שותפים לפרויקט ({activePartnersCount})</h3>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button 
            onClick={handleInvite}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            + הזמן
          </button>
          <button 
            onClick={() => setShowManage(!showManage)}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}
            title="ניהול הרשאות"
          >
            ⚙️
          </button>
          {onRemove && (
            <button 
              onClick={onRemove}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)', padding: '0.2rem' }}
              title="הסר פיצ'ר מהקיר"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {showManage && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem', width: '100%' }}>
          <h4 style={{ margin: '0 0 1rem 0' }}>אורחים ושותפים פעילים:</h4>
          {activePartnersCount === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>אין חברים במרחב עדיין.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>שם האורח</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>העלאה</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>מחיקה</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>הסרה</th>
                </tr>
              </thead>
              <tbody>
                {space.members.map((m: any) => (
                  <tr key={m.userId} style={{ borderBottom: '1px solid var(--border-light)', opacity: m.isActive === false ? 0.6 : 1 }}>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {m.isActive === false && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>לא פעיל</span>}
                        <span>{m.name} {m.userId === user?.id && '(אתה)'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={m.canUpload} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })}
                        disabled={m.isActive === false} 
                      />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={m.canDelete} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} 
                        disabled={m.isActive === false}
                      />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      {m.isActive === false ? (
                        <button 
                          onClick={() => restoreMember(space.id, m.userId, user?.id || 'unknown')}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '1.2rem', padding: '0.2rem' }}
                          title="שחזר שותף"
                        >
                          ♻️
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            if (confirm(`האם אתה בטוח שברצונך להסיר את ${m.name} מהמרחב?`)) {
                              removeMember(space.id, m.userId, user?.id || 'unknown');
                            }
                          }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem', padding: '0.2rem' }}
                          title="הסר שותף"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
