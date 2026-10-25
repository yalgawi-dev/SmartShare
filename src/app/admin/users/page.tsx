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
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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

  // Render Status Lamp Dot
  const renderStatusDot = (u: any) => {
    if (u.pwaInstalled && u.lastActiveMode === 'app') {
      return (
        <span title="מותקן ופעיל באפליקציה" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
          🟢 אפליקציה
        </span>
      );
    }
    if (u.pwaInstalled) {
      return (
        <span title="גולש כעת מדפדפן (הותקנה בעבר)" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef9c3', color: '#a16207', padding: '2px 6px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
          🟡 דפדפן (מותקן)
        </span>
      );
    }
    return (
      <span title="גולש מדפדפן רגיל" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600 }}>
        ⚪ דפדפן
      </span>
    );
  };

  const formatLastActive = (dateStr?: string) => {
    if (!dateStr) return <span style={{ color: '#94a3b8' }}>לא פעיל</span>;
    try {
      const d = new Date(dateStr);
      const isToday = new Date().toDateString() === d.toDateString();
      const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
      const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
      return (
        <span style={{ fontWeight: isToday ? 800 : 500, color: isToday ? '#15803d' : '#475569', fontSize: '0.75rem' }}>
          {isToday ? `היום ${time}` : `${date} ${time}`}
        </span>
      );
    } catch {
      return dateStr;
    }
  };

  const sortLabels: Record<string, string> = {
    lastActive: '🕒 פעילות אחרונה',
    duplicate: '⚠️ כפולים קודם',
    pwa: '📲 אפליקציה (PWA)',
    createdAt: '📅 הצטרפות',
    name: '🔤 שם (א-ת)'
  };

  // Compact One-Line Accordion User Row Component
  const CompactUserRow = ({ u, isAdminRow }: { u: any, isAdminRow: boolean }) => {
    const isDup = isUserDuplicate(u);
    const isExpanded = expandedUserId === u.id;

    return (
      <div style={{
        background: u.isBlocked ? '#fef2f2' : isDup ? '#fffbeb' : '#ffffff',
        border: isExpanded ? '1.5px solid #3b82f6' : isDup ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: isExpanded ? '0 4px 12px rgba(59, 130, 246, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Main One-Line Row Clickable Header */}
        <div 
          onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 0.85rem',
            cursor: 'pointer',
            userSelect: 'none',
            gap: '0.5rem'
          }}
        >
          {/* User Name & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
            <span style={{ 
              fontWeight: 800, 
              fontSize: '0.92rem', 
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {u.realName || 'אורח'}
            </span>
            {u.isAdmin && <span title="מנהל מערכת">👑</span>}
            {isDup && (
              <span style={{ 
                background: '#fef3c7', 
                color: '#b45309', 
                border: '1px solid #fde68a', 
                padding: '1px 5px', 
                borderRadius: '5px', 
                fontSize: '0.65rem', 
                fontWeight: 800,
                flexShrink: 0
              }}>
                ⚠️ כפול
              </span>
            )}
          </div>

          {/* Right info: status dot, last active & expand arrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {renderStatusDot(u)}
            <div style={{ minWidth: '70px', textAlign: 'left' }}>
              {formatLastActive(u.lastActiveAt)}
            </div>
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#94a3b8', 
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}>
              ▼
            </span>
          </div>
        </div>

        {/* Expanded Drawer Details */}
        {isExpanded && (
          <div style={{ 
            borderTop: '1px solid #f1f5f9', 
            background: '#f8fafc', 
            padding: '0.85rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.75rem' 
          }}>
            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', fontSize: '0.82rem' }}>
              <div><span style={{ color: '#64748b' }}>טלפון:</span> <strong style={{ direction: 'ltr', display: 'inline-block' }}>{u.phone || 'לא הוזן'}</strong></div>
              <div><span style={{ color: '#64748b' }}>אימייל:</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email || '-'}</span></div>
              <div><span style={{ color: '#64748b' }}>מזהה:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{(u.id || '').substring(0,8)}...</span></div>
              <div><span style={{ color: '#64748b' }}>הצטרף ב:</span> {u.createdAt ? new Date(u.createdAt).toLocaleDateString('he-IL') : '-'}</div>
              <div><span style={{ color: '#64748b' }}>אנשי קשר:</span> <strong>{u.contacts?.length || 0}</strong></div>
              <div><span style={{ color: '#64748b' }}>גלישה:</span> {u.lastActiveMode === 'app' ? 'אפליקציה (PWA)' : 'דפדפן'}</div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.6rem', flexWrap: 'wrap' }}>
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
                📊 ניתוח מלא
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
                    {u.isAdmin ? 'הסר ניהול' : 'מנהל 👑'}
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
                      padding: '0.45rem 0.75rem', 
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
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '6.5rem', direction: 'rtl' }}>
      
      {/* Sticky Header: Clean Hebrew Title, Search & Quick Back */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        background: 'rgba(255, 255, 255, 0.96)', 
        backdropFilter: 'blur(10px)',
        zIndex: 90, 
        padding: '0.75rem 1rem', 
        borderBottom: '1px solid #e2e8f0', 
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Link href="/" style={{ color: 'var(--primary, #2563eb)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span>&rarr;</span> חזרה
            </Link>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>מרכז בקרה וניהול</h1>
            <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>v2.9.4</span>
          </div>
        </div>

        {/* Sticky Search & Sort Controls Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 חיפוש משתמש (שם, טלפון, מייל)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
          </div>

          {/* Quick Sort Dropdown Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{sortLabels[sortBy] || 'מיון'}</span>
              <span style={{ fontSize: '0.65rem' }}>▼</span>
            </button>

            {isSortMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '115%',
                left: 0,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.35rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                zIndex: 100,
                minWidth: '180px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}>
                {Object.entries(sortLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSortBy(key as any);
                      setIsSortMenuOpen(false);
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: sortBy === key ? '#eff6ff' : 'transparent',
                      color: sortBy === key ? '#1d4ed8' : '#334155',
                      fontWeight: sortBy === key ? 800 : 500,
                      fontSize: '0.82rem',
                      textAlign: 'right',
                      cursor: 'pointer'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area based on Active Tab */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* TAB 1: USERS & CRM */}
        {activeTab === 'users' && (
          <>
            {/* Collapsible Status Legend Accordion */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div 
                onClick={() => setIsLegendOpen(!isLegendOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#334155',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🗺️</span>
                  <span>מקרא סטטוסים ומנורות</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {isLegendOpen ? '▲ סגור' : '▼ הסבר על הסימונים'}
                </span>
              </div>

              {isLegendOpen && (
                <div style={{ padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ background: '#f0fdf4', padding: '0.5rem', borderRadius: '8px' }}>
                    <strong style={{ color: '#15803d' }}>🟢 אפליקציה:</strong> מותקן במסך הבית ונכנס דרכה.
                  </div>
                  <div style={{ background: '#fefce8', padding: '0.5rem', borderRadius: '8px' }}>
                    <strong style={{ color: '#a16207' }}>🟡 דפדפן (מותקן):</strong> הותקנה בעבר אך כרגע גולש מדפדפן.
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '8px' }}>
                    <strong style={{ color: '#475569' }}>⚪ דפדפן:</strong> משתמש שטרם התקין את האפליקציה.
                  </div>
                  <div style={{ background: '#fffbeb', padding: '0.5rem', borderRadius: '8px' }}>
                    <strong style={{ color: '#b45309' }}>⚠️ כפול:</strong> טלפון/מייל רשום פעמיים במערכת.
                  </div>
                </div>
              )}
            </div>

            {/* Admins Accordion List */}
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>👑</span> מנהלי מערכת ({admins.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {admins.map(u => <CompactUserRow key={u.id} u={u} isAdminRow={true} />)}
              </div>
            </div>

            {/* Regular Users Accordion List */}
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>👥</span> משתמשים רשומים ({regulars.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {regulars.map(u => <CompactUserRow key={u.id} u={u} isAdminRow={false} />)}
                {regulars.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>לא נמצאו משתמשים.</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: ANALYTICS & KPIS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>רשומים במערכת</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{totalUsers}</div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>פעילים ב-24 שעות: {activeIn24h}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>התקנות PWA</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>{pwaAdoptionRate}%</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{pwaUsersCount} מתוך {totalUsers}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>פעילים שבועית</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>{activeIn7d}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>מעורבות ב-7 ימים</div>
              </div>

              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>מרחבים פעילים</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>{activeSpaces.length}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{totalInvoices} הוצאות שנוהלו</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SPACES & PLUGINS */}
        {activeTab === 'spaces' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              📁 מרחבים פעילים ({activeSpaces.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeSpaces.map(s => (
                <div key={s.id} style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{s.icon || '🌟'} {s.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      יוצר: {s.createdBy || s.creatorId} | { (s.members || []).length } שותפים | { (s.invoices || []).length } הוצאות
                    </div>
                  </div>
                  <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none' }}>
                    פתח ↗
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM SETTINGS & STORAGE */}
        {activeTab === 'system' && (
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>📦 שימוש במשאבים ו-OCR</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>סריקות OCR במערכת</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                  {allUsers.reduce((sum, u) => sum + (u.ocrCount || 0), 0)} סריקות
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>קבצים ומסמכים</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                  {totalDocuments + totalMedia} פריטים
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FLOATING BOTTOM DOCK NAVIGATION BAR */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '460px',
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '24px',
        padding: '6px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '4px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
        zIndex: 9999
      }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'users' ? '#2563eb' : 'transparent',
            color: activeTab === 'users' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>👥</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px' }}>משתמשים</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'analytics' ? '#2563eb' : 'transparent',
            color: activeTab === 'analytics' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>📊</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px' }}>מדדים</span>
        </button>

        <button
          onClick={() => setActiveTab('spaces')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'spaces' ? '#2563eb' : 'transparent',
            color: activeTab === 'spaces' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>📁</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px' }}>מרחבים</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'system' ? '#2563eb' : 'transparent',
            color: activeTab === 'system' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>⚙️</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px' }}>הגדרות</span>
        </button>
      </div>

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
            padding: '1.5rem', 
            width: '100%', 
            maxWidth: '480px', 
            maxHeight: '85vh', 
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  📊 פרופיל: {selectedUserForAnalysis.realName}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>מזהה: {selectedUserForAnalysis.id}</span>
              </div>
              <button 
                onClick={() => setSelectedUserForAnalysis(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div><strong>טלפון:</strong> {selectedUserForAnalysis.phone || 'לא הוזן'}</div>
                <div><strong>אימייל:</strong> {selectedUserForAnalysis.email || 'לא הוזן'}</div>
                <div><strong>סטטוס PWA:</strong> {selectedUserForAnalysis.pwaInstalled ? 'מותקן 📲' : 'דפדפן 🌐'}</div>
                <div><strong>פעילות:</strong> {formatLastActive(selectedUserForAnalysis.lastActiveAt)}</div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 800 }}>מרחבים שבהם המשתמש משתתף:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {activeSpaces.filter(s => 
                    s.creatorId === selectedUserForAnalysis.id || 
                    (s.members || []).some((m: any) => m.userId === selectedUserForAnalysis.id)
                  ).map(s => {
                    const isCreator = s.creatorId === selectedUserForAnalysis.id;
                    const member = (s.members || []).find((m: any) => m.userId === selectedUserForAnalysis.id);
                    return (
                      <div key={s.id} style={{ background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <div>
                          <strong>{s.title}</strong>
                          <span style={{ marginRight: '0.4rem', fontSize: '0.72rem', color: isCreator ? '#d97706' : '#2563eb' }}>
                            {isCreator ? '(יוצר 👑)' : `(שותף - ${member?.sharePercentage || 0}%)`}
                          </span>
                        </div>
                        <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none', fontSize: '0.78rem' }}>
                          פתח ↗
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setSelectedUserForAnalysis(null)}
                style={{ width: '100%', padding: '0.65rem', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', marginTop: '0.4rem' }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
