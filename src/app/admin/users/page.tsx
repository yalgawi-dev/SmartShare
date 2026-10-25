'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSpaces } from '../../context/SpacesContext';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user, allUsers, blockUser, toggleAdmin, deleteUserDoc } = useAuth();
  const { spaces } = useSpaces();

  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'spaces' | 'system'>('users');
  const [selectedUserForAnalysis, setSelectedUserForAnalysis] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'lastActive' | 'duplicate' | 'pwa' | 'createdAt' | 'name'>('lastActive');

  // Protect route
  if (!user || !user.isAdmin) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', direction: 'rtl' }}>
        <h2>אין לך הרשאת גישה לדף זה</h2>
        <p style={{ color: 'var(--text-secondary)' }}>המסך מיועד למנהלי מערכת מורשים בלבד.</p>
        <Link href="/" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'underline' }}>חזרה לדף הבית</Link>
      </div>
    );
  }

  // Duplicate user detection
  const duplicateIdentifiers = useMemo(() => {
    const counts: Record<string, number> = {};
    allUsers.forEach(u => {
      const cleanPhone = (u.phone || '').trim();
      const cleanEmail = (u.email || '').trim().toLowerCase();
      if (cleanPhone && cleanPhone !== '0500000000') {
        counts['phone:' + cleanPhone] = (counts['phone:' + cleanPhone] || 0) + 1;
      }
      if (cleanEmail) {
        counts['email:' + cleanEmail] = (counts['email:' + cleanEmail] || 0) + 1;
      }
    });
    return counts;
  }, [allUsers]);

  const isUserDuplicate = (u: any) => {
    const cleanPhone = (u.phone || '').trim();
    const cleanEmail = (u.email || '').trim().toLowerCase();
    const phoneCount = cleanPhone ? (duplicateIdentifiers['phone:' + cleanPhone] || 0) : 0;
    const emailCount = cleanEmail ? (duplicateIdentifiers['email:' + cleanEmail] || 0) : 0;
    return phoneCount > 1 || emailCount > 1;
  };

  // Filtered and Sorted users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = allUsers;
    if (q) {
      result = result.filter(u => 
        (u.realName && u.realName.toLowerCase().includes(q)) ||
        (u.nickname && u.nickname.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'lastActive') {
        const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'duplicate') {
        const dupA = isUserDuplicate(a) ? 1 : 0;
        const dupB = isUserDuplicate(b) ? 1 : 0;
        if (dupB !== dupA) return dupB - dupA;
        const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'pwa') {
        const pwaA = a.pwaInstalled ? 1 : 0;
        const pwaB = b.pwaInstalled ? 1 : 0;
        if (pwaB !== pwaA) return pwaB - pwaA;
        const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'createdAt') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'name') {
        return (a.realName || '').localeCompare(b.realName || '', 'he');
      }
      return 0;
    });
  }, [allUsers, searchQuery, sortBy, duplicateIdentifiers]);

  const admins = useMemo(() => filteredUsers.filter(u => u.isAdmin), [filteredUsers]);
  const regulars = useMemo(() => filteredUsers.filter(u => !u.isAdmin), [filteredUsers]);

  // Accurate Active Spaces (excluding archived or pending_deletion)
  const activeSpaces = useMemo(() => {
    return (spaces || []).filter(s => s.status !== 'pending_deletion' && !(s as any).isArchived);
  }, [spaces]);

  const archivedSpaces = useMemo(() => {
    return (spaces || []).filter(s => s.status === 'pending_deletion' || (s as any).isArchived);
  }, [spaces]);

  // Macro Statistics calculations
  const totalUsers = allUsers.length;
  const pwaUsersCount = allUsers.filter(u => u.pwaInstalled).length;
  const pwaAdoptionRate = totalUsers > 0 ? Math.round((pwaUsersCount / totalUsers) * 100) : 0;

  const now = new Date().getTime();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const activeIn24h = allUsers.filter(u => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= oneDayAgo).length;
  const activeIn7d = allUsers.filter(u => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= sevenDaysAgo).length;

  const totalInvoices = activeSpaces.reduce((acc, s) => acc + (s.invoices?.length || 0), 0);
  const totalDocuments = activeSpaces.reduce((acc, s) => acc + (s.documents?.length || 0), 0);
  const totalMedia = activeSpaces.reduce((acc, s) => acc + (s.mediaItems?.length || 0), 0);

  // Render Status Badge
  const renderPwaBadge = (u: any) => {
    if (u.pwaInstalled && u.lastActiveMode === 'app') {
      return (
        <span style={{ 
          background: 'rgba(34, 197, 94, 0.15)', 
          color: '#15803d', 
          border: '1px solid #86efac', 
          padding: '2px 8px', 
          borderRadius: '12px', 
          fontSize: '0.75rem', 
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap'
        }}>
          🟢 📲 אפליקציה (פעיל)
        </span>
      );
    }
    if (u.pwaInstalled) {
      return (
        <span style={{ 
          background: 'rgba(234, 179, 8, 0.15)', 
          color: '#a16207', 
          border: '1px solid #fde047', 
          padding: '2px 8px', 
          borderRadius: '12px', 
          fontSize: '0.75rem', 
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap'
        }}>
          🟡 🌐 דפדפן (מותקן)
        </span>
      );
    }
    return (
      <span style={{ 
        background: 'rgba(100, 116, 139, 0.1)', 
        color: '#475569', 
        border: '1px solid #cbd5e1', 
        padding: '2px 8px', 
        borderRadius: '12px', 
        fontSize: '0.75rem',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap'
      }}>
        ⚪ 🌐 דפדפן בלבד
      </span>
    );
  };

  const formatLastActive = (dateStr?: string) => {
    if (!dateStr) return <span style={{ color: '#94a3b8' }}>לא ידוע</span>;
    try {
      const d = new Date(dateStr);
      const isToday = new Date().toDateString() === d.toDateString();
      const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return (
        <span style={{ fontWeight: isToday ? 700 : 500, color: isToday ? '#15803d' : '#334155' }}>
          {isToday ? `היום ${time}` : `${date} ${time}`}
        </span>
      );
    } catch {
      return dateStr;
    }
  };

  // Mobile User Card Component
  const MobileUserCard = ({ u, isAdminRow }: { u: any, isAdminRow: boolean }) => {
    const isDup = isUserDuplicate(u);
    return (
      <div style={{
        background: u.isBlocked ? '#fef2f2' : isDup ? '#fffbeb' : '#ffffff',
        border: isDup ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
      }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{u.realName || 'אורח'}</span>
            {u.isAdmin && <span>👑</span>}
            {isDup && (
              <span style={{ 
                background: '#fef3c7', 
                color: '#b45309', 
                border: '1px solid #fde68a', 
                padding: '1px 6px', 
                borderRadius: '6px', 
                fontSize: '0.7rem', 
                fontWeight: 800 
              }}>
                ⚠️ כפול
              </span>
            )}
          </div>
          <div>{renderPwaBadge(u)}</div>
        </div>

        {/* Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.82rem', background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '10px' }}>
          <div><span style={{ color: '#64748b' }}>טלפון:</span> <strong>{u.phone || '-'}</strong></div>
          <div><span style={{ color: '#64748b' }}>מזהה:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{(u.id || '').substring(0,6)}...</span></div>
          <div><span style={{ color: '#64748b' }}>פעילות:</span> {formatLastActive(u.lastActiveAt)}</div>
          <div><span style={{ color: '#64748b' }}>הצטרף:</span> {u.createdAt ? new Date(u.createdAt).toLocaleDateString('he-IL') : '-'}</div>
          {u.email && <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#64748b' }}>אימייל:</span> {u.email}</div>}
        </div>

        {/* Actions Row */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem' }}>
          <button
            onClick={() => setSelectedUserForAnalysis(u)}
            style={{
              flex: 1,
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '0.45rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}
          >
            📊 ניתוח
          </button>

          {u.id !== user.id && (
            <>
              <button 
                onClick={() => toggleAdmin && toggleAdmin(u.id, !u.isAdmin)}
                style={{ 
                  flex: 1,
                  background: 'white', 
                  color: u.isAdmin ? '#d97706' : '#2563eb', 
                  border: u.isAdmin ? '1px solid #d97706' : '1px solid #2563eb', 
                  padding: '0.45rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                {u.isAdmin ? 'הסר' : 'מנהל 👑'}
              </button>

              <button 
                onClick={() => blockUser(u.id, !u.isBlocked)}
                style={{ 
                  flex: 1,
                  background: u.isBlocked ? '#10b981' : '#f87171', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.45rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                {u.isBlocked ? 'שחרר' : 'חסום'}
              </button>

              <button 
                onClick={() => {
                  const confirmText = isDup 
                    ? `מחיקת חשבון כפול (מזהה: ${u.id.substring(0,8)}). פעילות אחרונה: ${u.lastActiveAt || 'לא ידוע'}. האם למחוק?`
                    : 'האם אתה בטוח שברצונך למחוק משתמש זה לצמיתות?';
                  if (window.confirm(confirmText)) {
                    deleteUserDoc(u.id);
                  }
                }}
                style={{ 
                  background: 'transparent', 
                  color: '#ef4444', 
                  border: '1px solid #fca5a5', 
                  padding: '0.45rem 0.65rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                מחק
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Desktop Table Row
  const UserRow = ({ u, isAdminRow }: { u: any, isAdminRow: boolean }) => {
    const isDup = isUserDuplicate(u);
    return (
      <tr style={{ 
        borderBottom: '1px solid var(--border-light, #e2e8f0)', 
        background: u.isBlocked ? 'rgba(239, 68, 68, 0.06)' : isDup ? 'rgba(254, 243, 199, 0.35)' : 'transparent', 
        transition: 'background 0.2s' 
      }}>
        {/* Sticky Full Name Column with max width constraint */}
        <td style={{ 
          position: 'sticky', 
          right: 0, 
          background: u.isBlocked ? '#fef2f2' : isDup ? '#fffbeb' : '#ffffff', 
          zIndex: 4, 
          padding: '0.85rem 1rem', 
          fontWeight: 'bold',
          borderLeft: '2px solid rgba(0,0,0,0.06)',
          boxShadow: '-3px 0 6px -2px rgba(0,0,0,0.06)',
          maxWidth: '180px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.realName || 'אורח'}</span>
            {u.isAdmin && <span>👑</span>}
            {isDup && (
              <span style={{ 
                background: '#fef3c7', 
                color: '#b45309', 
                border: '1px solid #fde68a', 
                padding: '1px 5px', 
                borderRadius: '6px', 
                fontSize: '0.68rem', 
                fontWeight: 800,
                flexShrink: 0
              }}>
                ⚠️ כפול
              </span>
            )}
          </div>
        </td>

        <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
          {(u.id || '').substring(0, 8)}...
        </td>

        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>{u.nickname || '-'}</td>
        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>{u.phone || '-'}</td>
        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>{u.email || '-'}</td>
        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{u.contacts?.length || 0}</td>
        
        {/* PWA Badge */}
        <td style={{ padding: '0.85rem 1rem' }}>
          {renderPwaBadge(u)}
        </td>

        {/* Last Active */}
        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
          {formatLastActive(u.lastActiveAt)}
        </td>

        {/* Joined Date */}
        <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#64748b' }}>
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('he-IL') : '-'}
        </td>

        {/* Actions */}
        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              onClick={() => setSelectedUserForAnalysis(u)}
              style={{
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.78rem'
              }}
            >
              📊 ניתוח
            </button>

            {u.id !== user.id && (
              <>
                <button 
                  onClick={() => toggleAdmin && toggleAdmin(u.id, !u.isAdmin)}
                  style={{ 
                    background: 'white', 
                    color: u.isAdmin ? '#d97706' : '#2563eb', 
                    border: u.isAdmin ? '1px solid #d97706' : '1px solid #2563eb', 
                    padding: '0.35rem 0.65rem', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                >
                  {u.isAdmin ? 'הסר' : 'מנהל 👑'}
                </button>

                <button 
                  onClick={() => blockUser(u.id, !u.isBlocked)}
                  style={{ 
                    background: u.isBlocked ? '#10b981' : '#f87171', 
                    color: 'white', 
                    border: 'none', 
                    padding: '0.35rem 0.65rem', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                >
                  {u.isBlocked ? 'שחרר' : 'חסום'}
                </button>

                <button 
                  onClick={() => {
                    const confirmText = isDup 
                      ? `שים לב! מחיקת משתמש כפול (מזהה: ${u.id.substring(0,8)}). פעילות אחרונה: ${u.lastActiveAt || 'לא ידוע'}. האם למחוק?`
                      : 'האם אתה בטוח שברצונך למחוק משתמש זה לצמיתות?';
                    if (window.confirm(confirmText)) {
                      deleteUserDoc(u.id);
                    }
                  }}
                  style={{ 
                    background: 'transparent', 
                    color: '#ef4444', 
                    border: '1px solid #fca5a5', 
                    padding: '0.35rem 0.65rem', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                >
                  מחק
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', paddingBottom: '5rem', direction: 'rtl' }}>
      
      {/* Sticky Header / Hub Bar */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        background: 'rgba(255, 255, 255, 0.96)', 
        backdropFilter: 'blur(10px)',
        zIndex: 100, 
        padding: '0.85rem 1.25rem', 
        borderBottom: '1px solid #e2e8f0', 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: '0.75rem',
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/" style={{ color: 'var(--primary, #2563eb)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
            <span>&rarr;</span> חזרה לאפליקציה
          </Link>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>Admin Hub v2.9.2</span>
        </div>

        {/* Search Input for fast lookup */}
        <div style={{ minWidth: '220px', flex: 1, maxWidth: '320px' }}>
          <input
            type="text"
            placeholder="🔍 חיפוש משתמש (שם, טלפון, מייל)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
        </div>
      </div>

      <header style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#0f172a', fontWeight: 800 }}>מרכז בקרה וניהול (Admin Command Center)</h1>
        <p style={{ color: '#64748b', marginTop: '0.35rem', fontSize: '0.95rem' }}>
          שליטה מלאה במשתמשים, ניתוחי פעילות, התקנות PWA, מרחבים פעילים ותשתיות המערכת.
        </p>
      </header>

      {/* Topics Tabs Navigation */}
      <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          background: '#f1f5f9', 
          padding: '0.35rem', 
          borderRadius: '14px', 
          width: 'fit-content' 
        }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'users' ? '#ffffff' : 'transparent',
              color: activeTab === 'users' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'users' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>👥</span>
            <span>משתמשים ו-CRM</span>
            <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '1px 6px', borderRadius: '10px' }}>{allUsers.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'analytics' ? '#ffffff' : 'transparent',
              color: activeTab === 'analytics' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'analytics' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>📊</span>
            <span>סטטיסטיקות ומדדים</span>
          </button>

          <button
            onClick={() => setActiveTab('spaces')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'spaces' ? '#ffffff' : 'transparent',
              color: activeTab === 'spaces' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'spaces' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>📁</span>
            <span>מרחבים ותוספים</span>
            <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '1px 6px', borderRadius: '10px' }}>{activeSpaces.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'system' ? '#ffffff' : 'transparent',
              color: activeTab === 'system' ? '#0f172a' : '#64748b',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'system' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>⚙️</span>
            <span>הגדרות ואחסון</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USERS & CRM */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0 1.25rem' }}>
          
          {/* Status Map Legend Card */}
          <div style={{ 
            background: '#ffffff', 
            borderRadius: '16px', 
            padding: '1rem 1.25rem', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
              <span>🗺️</span>
              <span>מקרא מפה: זיהוי סטטוסי התקנה ושימוש</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#f0fdf4', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <span>🟢</span>
                <div>
                  <strong style={{ color: '#15803d' }}>מותקן ופעיל באפליקציה:</strong>
                  <div style={{ color: '#166534', marginTop: '2px' }}>האפליקציה מותקנת במסך הבית והמשתמש נכנס דרכה.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#fefce8', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #fef08a' }}>
                <span>🟡</span>
                <div>
                  <strong style={{ color: '#a16207' }}>גולש כעת מדפדפן (מותקן בעבר):</strong>
                  <div style={{ color: '#854d0e', marginTop: '2px' }}>הותקנה בעבר, אך כניסתו האחרונה הייתה מהדפדפן הרגיל.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span>⚪</span>
                <div>
                  <strong style={{ color: '#475569' }}>דפדפן בלבד:</strong>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>המשתמש טרם התקין את האפליקציה למכשיר.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', background: '#fffbeb', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid #fde68a' }}>
                <span>⚠️</span>
                <div>
                  <strong style={{ color: '#b45309' }}>משתמש כפול:</strong>
                  <div style={{ color: '#92400e', marginTop: '2px' }}>מספר טלפון/מייל זהה נרשם פעמיים. בדוק פעילות אחרונה.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sort Selector Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#334155' }}>מיון משתמשים לפי:</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSortBy('lastActive')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: sortBy === 'lastActive' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: sortBy === 'lastActive' ? '#eff6ff' : '#f8fafc',
                  color: sortBy === 'lastActive' ? '#1d4ed8' : '#475569',
                  fontWeight: sortBy === 'lastActive' ? 800 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                🕒 פעילות אחרונה (הכי פעיל ראשון)
              </button>

              <button
                onClick={() => setSortBy('duplicate')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: sortBy === 'duplicate' ? '2px solid #d97706' : '1px solid #cbd5e1',
                  background: sortBy === 'duplicate' ? '#fffbeb' : '#f8fafc',
                  color: sortBy === 'duplicate' ? '#b45309' : '#475569',
                  fontWeight: sortBy === 'duplicate' ? 800 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                ⚠️ כפולים קודם (לניקוי)
              </button>

              <button
                onClick={() => setSortBy('pwa')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: sortBy === 'pwa' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  background: sortBy === 'pwa' ? '#f0fdf4' : '#f8fafc',
                  color: sortBy === 'pwa' ? '#15803d' : '#475569',
                  fontWeight: sortBy === 'pwa' ? 800 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                📲 מותקנים באפליקציה (PWA)
              </button>

              <button
                onClick={() => setSortBy('createdAt')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: sortBy === 'createdAt' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                  background: sortBy === 'createdAt' ? '#eef2ff' : '#f8fafc',
                  color: sortBy === 'createdAt' ? '#3730a3' : '#475569',
                  fontWeight: sortBy === 'createdAt' ? 800 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                📅 הצטרפות (חדש לישן)
              </button>

              <button
                onClick={() => setSortBy('name')}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: sortBy === 'name' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: sortBy === 'name' ? '#eff6ff' : '#f8fafc',
                  color: sortBy === 'name' ? '#1d4ed8' : '#475569',
                  fontWeight: sortBy === 'name' ? 800 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                🔤 לפי שם (א-ת)
              </button>
            </div>
          </div>

          {/* Admins Section */}
          <section style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <span>👑</span> מנהלי מערכת ({admins.length})
            </h2>

            {/* Mobile View Cards */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {admins.map(u => <MobileUserCard key={u.id} u={u} isAdminRow={true} />)}
            </div>

            {/* Desktop View Table */}
            <div className="desktop-only" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.85rem 1rem', position: 'sticky', right: 0, background: '#f8fafc', zIndex: 5, borderLeft: '2px solid rgba(0,0,0,0.06)', maxWidth: '180px' }}>שם מלא</th>
                    <th style={{ padding: '0.85rem 1rem' }}>מזהה</th>
                    <th style={{ padding: '0.85rem 1rem' }}>כינוי</th>
                    <th style={{ padding: '0.85rem 1rem' }}>טלפון</th>
                    <th style={{ padding: '0.85rem 1rem' }}>אימייל</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>אנשי קשר</th>
                    <th style={{ padding: '0.85rem 1rem' }}>התקנת PWA</th>
                    <th style={{ padding: '0.85rem 1rem' }}>פעילות אחרונה</th>
                    <th style={{ padding: '0.85rem 1rem' }}>הצטרף ב</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(u => <UserRow key={u.id} u={u} isAdminRow={true} />)}
                </tbody>
              </table>
            </div>
          </section>

          {/* Regular Users Section */}
          <section style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <span>👥</span> משתמשים רשומים ({regulars.length})
            </h2>

            {/* Mobile View Cards */}
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {regulars.map(u => <MobileUserCard key={u.id} u={u} isAdminRow={false} />)}
              {regulars.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>לא נמצאו משתמשים.</div>
              )}
            </div>

            {/* Desktop View Table */}
            <div className="desktop-only" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.85rem 1rem', position: 'sticky', right: 0, background: '#f8fafc', zIndex: 5, borderLeft: '2px solid rgba(0,0,0,0.06)', maxWidth: '180px' }}>שם מלא</th>
                    <th style={{ padding: '0.85rem 1rem' }}>מזהה</th>
                    <th style={{ padding: '0.85rem 1rem' }}>כינוי</th>
                    <th style={{ padding: '0.85rem 1rem' }}>טלפון</th>
                    <th style={{ padding: '0.85rem 1rem' }}>אימייל</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>אנשי קשר</th>
                    <th style={{ padding: '0.85rem 1rem' }}>התקנת PWA</th>
                    <th style={{ padding: '0.85rem 1rem' }}>פעילות אחרונה</th>
                    <th style={{ padding: '0.85rem 1rem' }}>הצטרף ב</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {regulars.map(u => <UserRow key={u.id} u={u} isAdminRow={false} />)}
                  {regulars.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>לא נמצאו משתמשים התואמים לחיפוש.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}

      {/* TAB 2: ANALYTICS & KPIS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0 1.25rem' }}>
          
          {/* Key Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>סה״כ משתמשים רשומים</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.3rem' }}>{totalUsers}</div>
              <div style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.2rem' }}>פעילים ב-24 שעות: {activeIn24h}</div>
            </div>

            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>אימוץ אפליקציה (PWA)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d', marginTop: '0.3rem' }}>{pwaAdoptionRate}%</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>{pwaUsersCount} מתוך {totalUsers} התקינו</div>
            </div>

            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>פעילים שבועית (7 ימים)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563eb', marginTop: '0.3rem' }}>{activeIn7d}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>{totalUsers > 0 ? Math.round((activeIn7d/totalUsers)*100) : 0}% מעורבות שבועית</div>
            </div>

            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700 }}>מרחבים פעילים באמת</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.3rem' }}>{activeSpaces.length}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>{archivedSpaces.length} מרחבים בארכיון/מחיקה</div>
            </div>
          </div>

          {/* Deep Breakdown Card */}
          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>📊 שימוש בתוספים ובמנועים ברחבי המערכת (מרחבים פעילים)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: '#1e293b' }}>💰 מנוע התחשבנויות ושותפים</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>{totalInvoices} הוצאות</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>חישובי רטרו, שותפויות וקיזוזים</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: '#1e293b' }}>🗄️ כספת מסמכים דיגיטלית</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.25rem' }}>{totalDocuments} מסמכים</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>מדפים, תגיות ותצוגות מקדימות</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, color: '#1e293b' }}>📸 גלריה ומדיה שיתופית</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ea580c', marginTop: '0.25rem' }}>{totalMedia} פריטים</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>העלאות תמונות, שיתופים ולייקים</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SPACES & PLUGINS */}
      {activeTab === 'spaces' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active Spaces Table */}
          <section style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🟢</span> מרחבים פעילים ({activeSpaces.length})
            </h2>
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>שם המרחב</th>
                    <th style={{ padding: '0.85rem 1rem' }}>יוצר המרחב</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>שותפים פעילים</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>הוצאות/חשבוניות</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>מסמכים בכספת</th>
                    <th style={{ padding: '0.85rem 1rem' }}>תוספים פעילים</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSpaces.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>{s.icon || '🌟'}</span>
                          <span>{s.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{s.createdBy || s.creatorId || 'יוצר לא צוין'}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700 }}>{(s.members || []).length}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{(s.invoices || []).length}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{(s.documents || []).length}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(s.features || []).map((f: string) => (
                            <span key={f} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '6px', fontSize: '0.75rem' }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
                          פתח מרחב ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Archived / Pending Deletion Spaces Table */}
          {archivedSpaces.length > 0 && (
            <section style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '18px', border: '1px solid #fed7aa', opacity: 0.9 }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', color: '#c2410c', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📦</span> מרחבים בארכיון או לקראת מחיקה ({archivedSpaces.length})
              </h2>
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>שם המרחב</th>
                      <th style={{ padding: '0.75rem 1rem' }}>יוצר</th>
                      <th style={{ padding: '0.75rem 1rem' }}>סטטוס</th>
                      <th style={{ padding: '0.75rem 1rem' }}>תאריך מחיקה מיועד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedSpaces.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #ffedd5', color: '#64748b' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{s.title}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{s.createdBy || s.creatorId}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#ea580c', fontWeight: 700 }}>ממתין למחיקה סופית</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{s.deletionScheduledFor ? new Date(s.deletionScheduledFor).toLocaleDateString('he-IL') : 'מיידי'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 4: SYSTEM SETTINGS & STORAGE */}
      {activeTab === 'system' && (
        <div style={{ padding: '0 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>📦 אחסון וצריכת משאבים</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
              מעקב צריכת שטח אחסון וניתוחי OCR עבור כלל המשתמשים כהכנה למודלים עסקיים עתידיים.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>סה״כ סריקות OCR שבוצעו</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                  {allUsers.reduce((sum, u) => sum + (u.ocrCount || 0), 0)} סריקות
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700 }}>סה״כ קבצים שמורים במערכת</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                  {totalDocuments + totalMedia} קבצים
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MICRO USER ANALYTICS MODAL */}
      {selectedUserForAnalysis && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.6)', 
          zIndex: 999999, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '1rem',
          direction: 'rtl'
        }}>
          <div style={{ 
            background: '#ffffff', 
            borderRadius: '20px', 
            padding: '1.75rem', 
            width: '100%', 
            maxWidth: '520px', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  📊 פרופיל וניתוח משתמש: {selectedUserForAnalysis.realName}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>מזהה: {selectedUserForAnalysis.id}</span>
              </div>
              <button 
                onClick={() => setSelectedUserForAnalysis(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div><strong>טלפון:</strong> {selectedUserForAnalysis.phone || 'לא הוזן'}</div>
                <div><strong>אימייל:</strong> {selectedUserForAnalysis.email || 'לא הוזן'}</div>
                <div><strong>סטטוס PWA:</strong> {selectedUserForAnalysis.pwaInstalled ? 'מותקן במכשיר 📲' : 'דפדפן בלבד 🌐'}</div>
                <div><strong>אופן גלישה אחרון:</strong> {selectedUserForAnalysis.lastActiveMode === 'app' ? 'אפליקציה' : 'דפדפן'}</div>
                <div><strong>פעילות אחרונה:</strong> {formatLastActive(selectedUserForAnalysis.lastActiveAt)}</div>
                <div><strong>הצטרף ב:</strong> {selectedUserForAnalysis.createdAt ? new Date(selectedUserForAnalysis.createdAt).toLocaleDateString('he-IL') : '-'}</div>
              </div>

              {/* Spaces associated */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 800 }}>מרחבים שבהם המשתמש משתתף:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activeSpaces.filter(s => 
                    s.creatorId === selectedUserForAnalysis.id || 
                    (s.members || []).some((m: any) => m.userId === selectedUserForAnalysis.id)
                  ).map(s => {
                    const isCreator = s.creatorId === selectedUserForAnalysis.id;
                    const member = (s.members || []).find((m: any) => m.userId === selectedUserForAnalysis.id);
                    return (
                      <div key={s.id} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <div>
                          <strong>{s.title}</strong>
                          <span style={{ marginRight: '0.5rem', fontSize: '0.75rem', color: isCreator ? '#d97706' : '#2563eb' }}>
                            {isCreator ? '(יוצר המרחב 👑)' : `(שותף - ${member?.sharePercentage || 0}%)`}
                          </span>
                        </div>
                        <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none', fontSize: '0.8rem' }}>
                          פתח ↗
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setSelectedUserForAnalysis(null)}
                style={{ width: '100%', padding: '0.75rem', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', marginTop: '0.5rem' }}
              >
                סגור חלונית
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Styles Injection */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .desktop-only {
            display: none !important;
          }
          .mobile-only {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .desktop-only {
            display: block !important;
          }
          .mobile-only {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
