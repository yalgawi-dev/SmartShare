'use client';

import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user, allUsers, blockUser } = useAuth();

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

      <div className="card glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '1rem' }}>מזהה</th>
              <th style={{ padding: '1rem' }}>שם מלא (אמיתי)</th>
              <th style={{ padding: '1rem' }}>כינוי / פומבי</th>
              <th style={{ padding: '1rem' }}>טלפון</th>
              <th style={{ padding: '1rem' }}>אנשי קשר שמורים</th>
              <th style={{ padding: '1rem' }}>תאריך הצטרפות</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>פעולות אדמין</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)', background: u.isBlocked ? 'rgba(255,0,0,0.05)' : 'transparent' }}>
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.id.substring(0, 8)}...</td>
                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.realName} {u.isAdmin && '👑'}</td>
                <td style={{ padding: '1rem' }}>{u.nickname || '-'}</td>
                <td style={{ padding: '1rem' }}>{u.phone}</td>
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
                        fontWeight: 'bold'
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
    </div>
  );
}
