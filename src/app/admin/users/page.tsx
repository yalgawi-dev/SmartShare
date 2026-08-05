'use client';

import { useAuth } from '../../context/AuthContext';
import { useSpaces } from '../../context/SpacesContext';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user, allUsers, blockUser } = useAuth();
  const { spaces, restoreSpace } = useSpaces();

  // Protect route
  if (!user || !user.isAdmin) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>אין לך הרשאה לצפות בעמוד זה. מיועד למנהלי מערכת בלבד.</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)' }}>פאנל ניהול משתמשים (CRM) 🛡️</h1>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
          חזרה ללוח הראשי &rarr;
        </Link>
      </header>

      <div className="card glass-panel" style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
        <p style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>&larr; גלול הצידה כדי לראות עוד פרטים &rarr;</p>
        <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '1rem' }}>מזהה</th>
              <th style={{ padding: '1rem' }}>שם מלא</th>
              <th style={{ padding: '1rem' }}>כינוי</th>
              <th style={{ padding: '1rem' }}>טלפון</th>
              <th style={{ padding: '1rem' }}>אימייל</th>
              <th style={{ padding: '1rem' }}>אנשי קשר</th>
              <th style={{ padding: '1rem' }}>הצטרפות</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)', background: u.isBlocked ? 'rgba(255,0,0,0.05)' : 'transparent' }}>
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.id.substring(0, 8)}...</td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.realName} {u.isAdmin && '👑'}</td>
                <td style={{ padding: '1rem' }}>{u.nickname || '-'}</td>
                <td style={{ padding: '1rem' }}>{u.phone}</td>
                <td style={{ padding: '1rem' }}>{u.email || '-'}</td>
                <td style={{ padding: '1rem' }}>{u.contacts?.length || 0}</td>
                <td style={{ padding: '1rem' }}>{new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  {!u.isAdmin && (
                    <button 
                      onClick={() => blockUser(u.id, !u.isBlocked)}
                      style={{ 
                        background: u.isBlocked ? '#10B981' : '#EF4444', 
                        color: 'white', 
                        border: 'none', 
                        padding: '0.5rem 1rem', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {u.isBlocked ? 'שחרר חסימה' : 'חסום משתמש'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {allUsers.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>אין משתמשים במערכת</div>
        )}
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>מרחבים בהשהיה / ארכיון 🗑️</h2>
        <div className="card glass-panel" style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
          <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '1rem' }}>מזהה</th>
                <th style={{ padding: '1rem' }}>שם המרחב</th>
                <th style={{ padding: '1rem' }}>שותפים</th>
                <th style={{ padding: '1rem' }}>הוצאות</th>
                <th style={{ padding: '1rem' }}>תאריך מחיקה מתוכנן</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {spaces.filter(s => s.status === 'pending_deletion').map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.id.substring(0, 8)}...</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{s.icon} {s.title}</td>
                  <td style={{ padding: '1rem' }}>{s.members?.length || 0}</td>
                  <td style={{ padding: '1rem' }}>{s.invoices?.length || 0}</td>
                  <td style={{ padding: '1rem', color: '#EF4444' }}>
                    {s.deletionScheduledFor ? new Date(s.deletionScheduledFor).toLocaleDateString('he-IL') : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => restoreSpace(s.id)}
                      style={{ 
                        background: '#10B981', 
                        color: 'white', 
                        border: 'none', 
                        padding: '0.5rem 1rem', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      שחזר מרחב ♻️
                    </button>
                  </td>
                </tr>
              ))}
              {spaces.filter(s => s.status === 'pending_deletion').length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    אין מרחבים בהמתנה למחיקה.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
