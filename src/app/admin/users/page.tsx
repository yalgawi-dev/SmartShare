'use client';

import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user, allUsers, blockUser, toggleAdmin } = useAuth();

  // Protect route
  if (!user || !user.isAdmin) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>אין לך הרשאות גישה לכאן. אנא התחבר עם משתמש מורשה.</div>;
  }

  const admins = allUsers.filter(u => u.isAdmin);
  const regulars = allUsers.filter(u => !u.isAdmin);

  const UserRow = ({ u, isAdminRow }: { u: any, isAdminRow: boolean }) => (
    <tr style={{ borderBottom: '1px solid var(--border-light)', background: u.isBlocked ? 'rgba(255,0,0,0.05)' : isAdminRow ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
      <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.id.substring(0, 8)}...</td>
      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.realName} {u.isAdmin && '⭐'}</td>
      <td style={{ padding: '1rem' }}>{u.nickname || '-'}</td>
      <td style={{ padding: '1rem' }}>{u.phone}</td>
      <td style={{ padding: '1rem' }}>{u.email || '-'}</td>
      <td style={{ padding: '1rem' }}>{u.contacts?.length || 0}</td>
      <td style={{ padding: '1rem' }}>{new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
      <td style={{ padding: '1rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
        {u.id !== user.id && (
          <>
            <button 
              onClick={() => toggleAdmin && toggleAdmin(u.id, !u.isAdmin)}
              style={{ 
                background: u.isAdmin ? '#f59e0b' : '#3B82F6', 
                color: 'white', 
                border: 'none', 
                padding: '0.5rem 1rem', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem'
              }}
            >
              {u.isAdmin ? 'הסר ניהול' : 'הפוך למנהל'}
            </button>
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
                fontSize: '0.8rem'
              }}
            >
              {u.isBlocked ? 'שחרר חסימה' : 'חסום משתמש'}
            </button>
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)' }}>לוח ניהול משתמשים (CRM) במבט על</h1>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
          &larr; חזרה לדף הבית
        </Link>
      </header>

      <div className="card glass-panel" style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
        <p style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}>&rarr; גלול הצידה כדי לראות את כל העמודות &larr;</p>
        <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '1rem' }}>מזהה</th>
              <th style={{ padding: '1rem' }}>שם מלא</th>
              <th style={{ padding: '1rem' }}>כינוי</th>
              <th style={{ padding: '1rem' }}>טלפון</th>
              <th style={{ padding: '1rem' }}>אימייל</th>
              <th style={{ padding: '1rem' }}>אנשי קשר</th>
              <th style={{ padding: '1rem' }}>הצטרף ב</th>
              <th style={{ padding: '1rem', textAlign: 'center' }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: 'var(--bg-main)' }}>
              <td colSpan={8} style={{ padding: '0.5rem 1rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>--- מנהלי מערכת ---</td>
            </tr>
            {admins.map(u => <UserRow key={u.id} u={u} isAdminRow={true} />)}
            
            <tr style={{ background: 'var(--bg-main)' }}>
              <td colSpan={8} style={{ padding: '0.5rem 1rem', fontWeight: 'bold', color: 'var(--text-secondary)', textAlign: 'center' }}>--- משתמשים רשומים ---</td>
            </tr>
            {regulars.map(u => <UserRow key={u.id} u={u} isAdminRow={false} />)}
          </tbody>
        </table>
        {allUsers.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>אין משתמשים להצגה</div>
        )}
      </div>
    </div>
  );
}
