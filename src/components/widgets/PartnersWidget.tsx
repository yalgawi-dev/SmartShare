'use client';

import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { useState } from 'react';

export default function PartnersWidget({ space, onRemove }: { space: any, onRemove?: () => void }) {
  const { updateMemberPermissions } = useSpaces();
  const { user } = useAuth();
  const [showManage, setShowManage] = useState(false);
  const activePartnersCount = space.members?.length || 0;
  
  const handleInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הצטרף למרחב שלי ב-SmartShare',
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
    <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>🤝</div>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>שותפים לפרויקט</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              {activePartnersCount === 0 
                ? 'טרם הזמנת שותפים לפרויקט זה.' 
                : `ישנם ${activePartnersCount} שותפים פעילים במרחב.`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => setShowManage(!showManage)}
            style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '0.5rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {showManage ? 'סגור ניהול' : 'ניהול הרשאות'}
          </button>
          <button 
            onClick={handleInvite}
            style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '0.5rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + הזמן שותפים
          </button>
          {onRemove && (
            <button 
              onClick={onRemove}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}
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
                  <th style={{ padding: '0.5rem' }}>שם האורח</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>הרשאת העלאה</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>הרשאת מחיקה</th>
                </tr>
              </thead>
              <tbody>
                {space.members.map((m: any) => (
                  <tr key={m.userId} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      {m.name} {m.userId === user?.id && '(אתה)'}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={m.canUpload} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canUpload: e.target.checked })} 
                      />
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={m.canDelete} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canDelete: e.target.checked })} 
                      />
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
