'use client';

import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { useState } from 'react';

export default function PartnersWidget({ space, onRemove }: { space: any, onRemove?: () => void }) {
  const { updateMemberPermissions, removeMember, restoreMember } = useSpaces();
  const { user } = useAuth();
  const [showManage, setShowManage] = useState(false);
  const activePartnersCount = space.members?.length || 0;

  return (
    <div className="widget-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>ניהול שותפים והרשאות</h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {activePartnersCount} שותפים בפרויקט
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setShowManage(!showManage)}
            style={{ background: showManage ? 'var(--primary)' : 'var(--bg-main)', color: showManage ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-light)', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {showManage ? 'סגור ניהול' : 'ניהול'}
          </button>
          {onRemove && (
            <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              ⚙️
            </button>
          )}
        </div>
      </div>

      {showManage && (
        <div style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '1rem', overflowX: 'auto' }}>
          {space.members?.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 0 }}>אין שותפים עדיין.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>שם השותף</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>העלאה</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>עריכה</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>מחיקה</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {space.members?.map((m: any) => (
                  <tr key={m.userId} style={{ borderBottom: '1px solid var(--border-light)', opacity: m.isActive === false ? 0.5 : 1 }}>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {m.name} 
                        {m.isActive === false && ' (הוסר)'}
                        {m.userId === user?.id && ' (את/ה)'}
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
                        checked={m.canEdit} 
                        onChange={e => updateMemberPermissions(space.id, m.userId, { canEdit: e.target.checked })} 
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
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', width: '36px', height: '20px', background: m.isActive !== false ? '#10b981' : '#cbd5e1', borderRadius: '20px', transition: 'all 0.3s' }}>
                          <div style={{ position: 'absolute', top: '2px', left: m.isActive !== false ? '18px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                        <input 
                          type="checkbox" 
                          checked={m.isActive !== false} 
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
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: m.isActive !== false ? '#10b981' : '#94a3b8' }}>
                          {m.isActive !== false ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </label>
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
