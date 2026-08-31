'use client';

import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user, allUsers, blockUser, toggleAdmin } = useAuth();

  // Protect route
  if (!user || !user.isAdmin) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>אין לך הרשאת גישה לדף זה. המסך מיועד למנהלים בלבד.</div>;
  }

  const admins = allUsers.filter(u => u.isAdmin && (u.phone || u.email || u.realName !== "אורח"));
  const regulars = allUsers.filter(u => !u.isAdmin && (u.phone || u.email || u.realName !== "אורח"));

  const UserRow = ({ u, isAdminRow }: { u: any, isAdminRow: boolean }) => (
    <tr style={{ borderBottom: '1px solid var(--border-light)', background: u.isBlocked ? 'rgba(239, 68, 68, 0.05)' : 'transparent', transition: 'background 0.2s' }}>
      <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.id.substring(0, 8)}...</td>
      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.realName} {u.isAdmin && '👑'}</td>
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
                background: 'white', 
                color: u.isAdmin ? '#f59e0b' : '#3B82F6', 
                border: u.isAdmin ? '1px solid #f59e0b' : '1px solid #3B82F6', 
                padding: '0.4rem 1rem', 
                borderRadius: 'var(--radius-full)', 
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem'
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
                padding: '0.4rem 1rem', 
                borderRadius: 'var(--radius-full)', 
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem'
              }}
            >
              {u.isBlocked ? 'שחרר חסימה' : 'חסום'}
            </button>
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
      
      {/* Sticky Header / Back Button */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>&rarr;</span> חזרה למסך הראשי
        </Link>
      </div>

      <header style={{ padding: '0 1rem 1.5rem 1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)' }}>מסך ניהול משתמשים (CRM)</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>כאן תוכל לצפות בכלל המשתמשים, למנות מנהלים ולחסום משתמשים בעייתיים.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0 1rem' }}>
        
        {/* Admins Table */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👑</span> מנהלי מערכת
          </h2>
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(16, 185, 129, 0.05)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
                {admins.map(u => <UserRow key={u.id} u={u} isAdminRow={true} />)}
              </tbody>
            </table>
          </div>
        </section>

        {/* Regular Users Table */}
        <section className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>👥</span> משתמשים רשומים
          </h2>
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.01)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
                {regulars.map(u => <UserRow key={u.id} u={u} isAdminRow={false} />)}
                {regulars.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>אין משתמשים רגילים כרגע.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
