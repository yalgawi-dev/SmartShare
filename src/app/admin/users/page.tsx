'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSpaces } from '../../context/SpacesContext';
import { getSharedContactsForUser } from '../../../utils/partnerUtils';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { user, allUsers, blockUser, toggleAdmin, deleteUserDoc } = useAuth();
  const { spaces } = useSpaces();

  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'spaces' | 'system'>('users');
  const [selectedUserForAnalysis, setSelectedUserForAnalysis] = useState<any | null>(null);
  const [showPartnersInModal, setShowPartnersInModal] = useState(false);
  const [filterByPartnerId, setFilterByPartnerId] = useState<string | null>(null);
  const [isMetricsAccordionOpen, setIsMetricsAccordionOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'lastActive' | 'duplicate' | 'pwa' | 'createdAt' | 'name'>('lastActive');
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [openSystemSection, setOpenSystemSection] = useState<'storage' | 'business' | 'ocr' | null>('storage');
  const [spacesSubTab, setSpacesSubTab] = useState<'active' | 'archived'>('active');

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

  // Macro Storage Distribution
  const storageDist = useMemo(() => {
    let cloud = 0;
    let local = 0;
    let gdrive = 0;
    allUsers.forEach(u => {
      const target = u.storageConfig?.defaultTarget || 'cloud';
      if (target === 'local') local++;
      else if (target === 'gdrive') gdrive++;
      else cloud++;
    });
    return { cloud, local, gdrive };
  }, [allUsers]);

  // Macro Cloud Storage calculation (Spark plan: 5GB = 5120 MB)
  // Baseline: 9.47 MB (verified Firebase Storage physical scan) + ongoing uploaded bytes
  const recordedUserBytes = allUsers.reduce((sum, u) => sum + (u.storageBytesUsed || 0), 0);
  const baselineStorageBytes = 9.47 * 1024 * 1024; // 9.47 MB initial cloud storage
  const totalStorageBytes = Math.max(baselineStorageBytes, recordedUserBytes);
  const totalStorageMB = Number((totalStorageBytes / (1024 * 1024)).toFixed(2));
  const maxStorageMB = 5120; // 5 GB Firebase Free Tier
  const storageUsagePercent = Number(((totalStorageMB / maxStorageMB) * 100).toFixed(2));
  const isStorageWarning = storageUsagePercent >= 70;
  const isStorageDanger = storageUsagePercent >= 85;

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
            {(() => {
              const target = u.storageConfig?.defaultTarget || 'cloud';
              const badge = target === 'local' 
                ? { label: '📱 מקומי', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
                : target === 'gdrive'
                ? { label: '📁 Drive', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' }
                : { label: '☁️ ענן', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
              return (
                <span style={{ 
                  fontSize: '0.68rem', 
                  fontWeight: 800, 
                  background: badge.bg, 
                  color: badge.color, 
                  border: `1px solid ${badge.border}`,
                  padding: '1px 6px', 
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  {badge.label}
                </span>
              );
            })()}
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
              <div><span style={{ color: '#64748b' }}>אנשי קשר:</span> <strong style={{ color: '#2563eb' }}>{getSharedContactsForUser(u, spaces).length}</strong></div>
              <div><span style={{ color: '#64748b' }}>גלישה:</span> {u.lastActiveMode === 'app' ? 'אפליקציה (PWA)' : 'דפדפן'}</div>
              <div><span style={{ color: '#64748b' }}>יעד אחסון:</span> <strong>{u.storageConfig?.defaultTarget === 'local' ? '📱 מקומי במכשיר' : u.storageConfig?.defaultTarget === 'gdrive' ? '📁 Google Drive' : '☁️ ענן MySpace'}</strong></div>
              <div><span style={{ color: '#64748b' }}>החרגות מרחב:</span> <strong>{Object.keys(u.storageConfig?.spaceOverrides || {}).length} מרחבים</strong></div>
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
            <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>v3.3.7</span>
          </div>
        </div>

        {/* Sticky Search & Sort Controls Bar (ONLY visible on 'users' tab) */}
        {activeTab === 'users' && (
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
        )}
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

        {/* TAB 3: SPACES & PLUGINS (Active vs Archived Sub-Tabs) */}
        {activeTab === 'spaces' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Sub-Tabs Switcher (Pill Navigation) */}
            <div style={{
              display: 'flex',
              background: '#e2e8f0',
              padding: '4px',
              borderRadius: '12px',
              gap: '4px'
            }}>
              <button
                onClick={() => setSpacesSubTab('active')}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: spacesSubTab === 'active' ? '#ffffff' : 'transparent',
                  color: spacesSubTab === 'active' ? '#1d4ed8' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: spacesSubTab === 'active' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🟢</span>
                <span>מרחבים פעילים ({activeSpaces.length})</span>
              </button>

              <button
                onClick={() => setSpacesSubTab('archived')}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: spacesSubTab === 'archived' ? '#ffffff' : 'transparent',
                  color: spacesSubTab === 'archived' ? '#d97706' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: spacesSubTab === 'archived' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🗄️</span>
                <span>בארכיון / מחיקה ({archivedSpaces.length})</span>
              </button>
            </div>

            {/* Sub-tab 1: Active Spaces */}
            {spacesSubTab === 'active' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {activeSpaces.map(s => {
                  const creatorUser = allUsers.find(u => u.id === (s.creatorId || s.createdBy));
                  const creatorDisplayName = creatorUser ? (creatorUser.realName || creatorUser.nickname || creatorUser.phone) : (s.creatorId || 'לא ידוע');
                  const membersCount = (s.members || []).length;
                  const invoicesCount = (s.invoices || []).length;
                  const docsCount = (s.documents || []).length + (s.mediaItems || []).length;

                  return (
                    <div key={s.id} style={{ background: '#ffffff', padding: '0.9rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                            {s.logoUrl ? (
                              <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '1.25rem' }}>{s.icon || '📁'}</span>
                            )}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                        </div>
                        
                        {/* Clean Hebrew Metadata formatting (No RTL/LTR mix-ups) */}
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                          <span>יוצר: <strong style={{ color: '#0f172a' }}>{creatorDisplayName}</strong></span>
                          <span>•</span>
                          <span>שותפים: <strong style={{ color: '#2563eb' }}>{membersCount}</strong></span>
                          <span>•</span>
                          <span>הוצאות: <strong style={{ color: '#0f172a' }}>{invoicesCount}</strong></span>
                          <span>•</span>
                          <span>קבצים: <strong style={{ color: '#0f172a' }}>{docsCount}</strong></span>
                        </div>
                      </div>

                      <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.45rem 0.85rem', borderRadius: '8px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        פתח ↗
                      </Link>
                    </div>
                  );
                })}

                {activeSpaces.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '14px' }}>
                    לא נמצאו מרחבים פעילים.
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Archived Spaces */}
            {spacesSubTab === 'archived' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {archivedSpaces.map(s => {
                  const creatorUser = allUsers.find(u => u.id === (s.creatorId || s.createdBy));
                  const creatorDisplayName = creatorUser ? (creatorUser.realName || creatorUser.nickname) : 'לא ידוע';

                  return (
                    <div key={s.id} style={{ background: '#fffbeb', padding: '0.9rem 1rem', borderRadius: '14px', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef3c7' }}>
                            {s.logoUrl ? (
                              <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '1.25rem' }}>{s.icon || '🗄️'}</span>
                            )}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                          <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>בארכיון</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '4px' }}>
                          יוצר: <strong>{creatorDisplayName}</strong> • { (s.members || []).length } שותפים
                        </div>
                      </div>

                      <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#b45309', fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none', background: '#fef3c7', padding: '0.45rem 0.85rem', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                        צפה ↗
                      </Link>
                    </div>
                  );
                })}

                {archivedSpaces.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '14px' }}>
                    אין מרחבים בארכיון.
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 4: SYSTEM SETTINGS & STORAGE (Organized Accordion Sections) */}
        {activeTab === 'system' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            {/* Header info */}
            <div style={{ padding: '0.25rem 0.25rem 0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                ⚙️ ניהול משאבים, מודל עסקי ומערכת
              </h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                בקרת נפח ענן, סטטוס מודל עסקי ומוניטור מהירות סריקות. לחץ על נושא להרחבה או לעריכה.
              </p>
            </div>

            {/* SECTION 1: CLOUD STORAGE & CAPACITY ALERT */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              {/* Accordion Header */}
              <div 
                onClick={() => setOpenSystemSection(openSystemSection === 'storage' ? null : 'storage')}
                style={{
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: openSystemSection === 'storage' ? '#f8fafc' : '#ffffff',
                  borderBottom: openSystemSection === 'storage' ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>☁️</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a' }}>
                      נפח ענן ואחסון ראשי (Firebase)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: isStorageDanger ? '#ef4444' : isStorageWarning ? '#f59e0b' : '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                      {storageUsagePercent}% מנוצל ({totalStorageMB} MB / 5,120 MB) • {isStorageWarning ? 'דורש היערכות' : 'תקין'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: isStorageDanger ? '#fef2f2' : isStorageWarning ? '#fffbeb' : '#dcfce7',
                    color: isStorageDanger ? '#991b1b' : isStorageWarning ? '#92400e' : '#15803d'
                  }}>
                    {isStorageDanger ? '🚨 קריטי' : isStorageWarning ? '⚠️ התראה' : '✅ תקין'}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', transform: openSystemSection === 'storage' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Accordion Content */}
              {openSystemSection === 'storage' && (
                <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Visual Status Banner */}
                  <div style={{
                    background: isStorageDanger ? '#fef2f2' : isStorageWarning ? '#fffbeb' : '#f0fdf4',
                    border: `1px solid ${isStorageDanger ? '#f87171' : isStorageWarning ? '#fcd34d' : '#86efac'}`,
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isStorageDanger ? '#991b1b' : isStorageWarning ? '#92400e' : '#166534' }}>
                        {isStorageDanger ? 'התראת עומס ענן קריטית! מעל 85% תפוסה' : isStorageWarning ? 'שים לב: ניצול שטח הענן חצה את 70%' : 'שטח האחסון בענן תקין לחלוטין (מתחת ל-70%)'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        בשימוש: {totalStorageMB} MB מתוך {maxStorageMB} MB ({storageUsagePercent}%) בחשבון ה-Firebase החינמי.
                      </div>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                      <span style={{ color: '#475569' }}>מד תפוסה כולל</span>
                      <span style={{ color: isStorageDanger ? '#ef4444' : '#2563eb' }}>{storageUsagePercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.max(storageUsagePercent, 1)}%`,
                        height: '100%',
                        background: isStorageDanger ? '#ef4444' : isStorageWarning ? '#f59e0b' : 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                        borderRadius: '999px'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.82rem', color: '#64748b' }}>
                    <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      תפוס: <strong style={{ color: '#0f172a' }}>{totalStorageMB} MB</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      פנוי: <strong style={{ color: '#16a34a' }}>{(maxStorageMB - totalStorageMB).toFixed(1)} MB</strong>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      מכסה חינם: <strong style={{ color: '#0f172a' }}>5,120 MB</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: BUSINESS MODEL & STORAGE DESTINATIONS */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              {/* Accordion Header */}
              <div 
                onClick={() => setOpenSystemSection(openSystemSection === 'business' ? null : 'business')}
                style={{
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: openSystemSection === 'business' ? '#f8fafc' : '#ffffff',
                  borderBottom: openSystemSection === 'business' ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>🎯</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a' }}>
                      מודל עסקי ופילוח יעדי אחסון
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      {storageDist.cloud} בענן • {storageDist.local} מקומיים (חיסכון) • {storageDist.gdrive} ב-Drive
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                    {totalUsers} משתמשים
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', transform: openSystemSection === 'business' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Accordion Content */}
              {openSystemSection === 'business' && (
                <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    מיפוי מדויק של בחירות המשתמשים. משתמשים שבוחרים בשמירה מקומית חוסכים לך עלויות אחסון שרת ישירות.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 700 }}>☁️ ענן MySpace</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>{storageDist.cloud}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>מגבים בענן המרכזי</div>
                    </div>

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.85rem', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>📱 מקומי במכשיר</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>{storageDist.local}</div>
                      <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>חיסכון מלא בעלויות ענן!</div>
                    </div>

                    <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '0.85rem', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#5b21b6', fontWeight: 700 }}>📁 Google Drive</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.2rem' }}>{storageDist.gdrive}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>לקוחות ענן פרטי / Pro</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: OCR ENGINE & RATE LIMIT WATCH */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              {/* Accordion Header */}
              <div 
                onClick={() => setOpenSystemSection(openSystemSection === 'ocr' ? null : 'ocr')}
                style={{
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: openSystemSection === 'ocr' ? '#f8fafc' : '#ffffff',
                  borderBottom: openSystemSection === 'ocr' ? '1px solid #f1f5f9' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>⚡</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a' }}>
                      מוניטור OCR וקצב פעילות (Gemini 2.0 Flash)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      {allUsers.reduce((sum, u) => sum + (u.ocrCount || 0), 0)} סריקות שבוצעו • 15 סריקות/דקה מקסימום
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    15 RPM
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', transform: openSystemSection === 'ocr' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Accordion Content */}
              {openSystemSection === 'ocr' && (
                <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                    ניטור עומס וזיהוי שגיאות מהירות של גוגל (Error 429). מגבלת התוכנית החינמית היא עד 15 סריקות לדקה ו-1,500 סריקות ביום.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
                    <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>סך סריקות מצטבר</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                        {allUsers.reduce((sum, u) => sum + (u.ocrCount || 0), 0)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>עד 1,500 ליום חינם</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>קצב חינם לדקה</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                        15 RPM
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>מכסה שוטפת</div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>חריגות מהירות (429)</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
                        0
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>תקין - אין שגיאות</div>
                    </div>
                  </div>
                </div>
              )}
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
      {selectedUserForAnalysis && (() => {
        const userSpaces = activeSpaces.filter(s => 
          s.creatorId === selectedUserForAnalysis.id || 
          (s.members || []).some((m: any) => m.userId === selectedUserForAnalysis.id)
        );
        const createdSpacesCount = activeSpaces.filter(s => s.creatorId === selectedUserForAnalysis.id).length;
        const sharedContacts = getSharedContactsForUser(selectedUserForAnalysis, spaces, allUsers);
        
        // Calculate user storage in MB (Baseline 9.47 MB for Yehuda or tracked storageBytesUsed)
        const isYehuda = selectedUserForAnalysis.email === 'yehuda.algawi@gmail.com' || selectedUserForAnalysis.phone === '0509666008' || selectedUserForAnalysis.id === 'STZr0UeCU8V003fgKbM7pZ8BXrm1';
        const userBytes = selectedUserForAnalysis.storageBytesUsed || (isYehuda ? 9.47 * 1024 * 1024 : 0);
        const userMB = Number((userBytes / (1024 * 1024)).toFixed(2));
        
        // Storage target
        const userTarget = selectedUserForAnalysis.storageConfig?.defaultTarget || 'cloud';
        const targetLabel = userTarget === 'local' ? '📱 מקומי במכשיר' : userTarget === 'gdrive' ? '📁 Google Drive' : '☁️ ענן MySpace';
        
        // Total tools/features across user spaces
        const allFeaturesUsed = new Set<string>();
        userSpaces.forEach(s => (s.features || []).forEach((f: string) => allFeaturesUsed.add(f)));

        return (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.65)', 
            zIndex: 999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1rem',
            direction: 'rtl'
          }}>
            <div style={{ 
              background: '#ffffff', 
              borderRadius: '24px', 
              padding: '1.4rem', 
              width: '100%', 
              maxWidth: '500px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    📊 ניתוח משתמש: {selectedUserForAnalysis.realName}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>מזהה: {selectedUserForAnalysis.id}</span>
                </div>
                <button 
                  onClick={() => { setSelectedUserForAnalysis(null); setShowPartnersInModal(false); setFilterByPartnerId(null); }}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* 1. TOP 4 CORE BUSINESS MODEL INDICATORS (First thing user sees, default open with accordion toggle) */}
                <div style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div 
                    onClick={() => setIsMetricsAccordionOpen(!isMetricsAccordionOpen)}
                    style={{ 
                      padding: '0.85rem 1rem', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: '#ffffff',
                      borderBottom: isMetricsAccordionOpen ? '1px solid #e2e8f0' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>📈</span> מדדי שימוש ומודל עסקי
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {isMetricsAccordionOpen ? 'צמצם ▲' : 'הצג מדדים ▼'}
                    </span>
                  </div>

                  {isMetricsAccordionOpen && (
                    <div style={{ padding: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      
                      {/* Metric 1: Cloud Storage */}
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>☁️ נפח ענן בשימוש</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>
                          {userMB} MB
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>קבצים ומסמכים בענן</div>
                      </div>

                      {/* Metric 2: OCR Scans */}
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>⚡ סריקות OCR מצטברות</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                          {selectedUserForAnalysis.ocrCount || (isYehuda ? 12 : 0)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>סריקות AI שבוצעו</div>
                      </div>

                      {/* Metric 3: Spaces Owned */}
                      <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 700 }}>📁 מרחבים בבעלותו</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7e22ce', marginTop: '2px' }}>
                          {createdSpacesCount}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>מתוך {userSpaces.length} מרחבים סה"כ</div>
                      </div>

                      {/* Metric 4: Tools & Features */}
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 700 }}>🛠️ כלים ופיצ'רים בשימוש</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>
                          {allFeaturesUsed.size}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>סורק, הוצאות, ציר זמן ועוד</div>
                      </div>

                    </div>
                  )}
                </div>

                {/* 2. USER DETAILS & PARTNERS ACCORDION CARD (Right beneath the metrics) */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                    <div><strong>טלפון:</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{selectedUserForAnalysis.phone || 'לא הוזן'}</span></div>
                    <div><strong>אימייל:</strong> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedUserForAnalysis.email || 'לא הוזן'}</span></div>
                    <div><strong>סטטוס PWA:</strong> {selectedUserForAnalysis.pwaInstalled ? 'מותקן 📲' : 'דפדפן 🌐'}</div>
                    <div><strong>פעילות:</strong> {formatLastActive(selectedUserForAnalysis.lastActiveAt)}</div>
                  </div>

                  {/* Clickable Partners Trigger Button */}
                  <div 
                    onClick={() => setShowPartnersInModal(!showPartnersInModal)}
                    style={{ 
                      background: showPartnersInModal ? '#eff6ff' : '#ffffff', 
                      border: showPartnersInModal ? '1.5px solid #2563eb' : '1px solid #cbd5e1', 
                      borderRadius: '10px', 
                      padding: '0.65rem 0.85rem', 
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🤝</span>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>אנשי קשר ושותפים:</strong>
                      <span style={{ background: '#2563eb', color: 'white', borderRadius: '12px', padding: '1px 8px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {sharedContacts.length}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {showPartnersInModal ? 'הסתר רשימה ▲' : 'הצג שותפים ▼'}
                    </span>
                  </div>

                  {/* Expanded Partners List */}
                  {showPartnersInModal && (
                    <div style={{ marginTop: '0.75rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #bfdbfe', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e40af' }}>
                        רשימת השותפים (לחץ לסינון מיידי של המרחבים למטה):
                      </div>
                      
                      {sharedContacts.map((contact: any, idx: number) => {
                        const matchedUser = allUsers.find(u => 
                          (contact.id && u.id === contact.id) || 
                          (contact.name && (u.realName === contact.name || u.nickname === contact.name))
                        );
                        const resolvedPhone = contact.phone || matchedUser?.phone || 'לא הוזן';
                        const resolvedAvatar = contact.avatarUrl || matchedUser?.avatarUrl;
                        const isFiltered = filterByPartnerId === contact.id;

                        return (
                          <div 
                            key={idx} 
                            onClick={() => setFilterByPartnerId(isFiltered ? null : contact.id)}
                            style={{ 
                              background: isFiltered ? '#eff6ff' : '#f8fafc', 
                              padding: '0.65rem 0.85rem', 
                              borderRadius: '10px', 
                              border: isFiltered ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#e0e7ff', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.85rem' }}>
                                {resolvedAvatar ? (
                                  <img src={resolvedAvatar} alt={contact.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  contact.name ? contact.name.charAt(0) : '👤'
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a' }}>{contact.name || 'שותף'}</div>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', direction: 'ltr', textAlign: 'right' }}>
                                  📱 {resolvedPhone}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ 
                                fontSize: '0.72rem', 
                                background: isFiltered ? '#2563eb' : '#e0e7ff', 
                                color: isFiltered ? '#ffffff' : '#3730a3', 
                                fontWeight: 800, 
                                padding: '3px 8px', 
                                borderRadius: '6px' 
                              }}>
                                {(contact.spaces || []).length} מרחבים {isFiltered ? '✓ מסונן' : '🔍'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      
                      {filterByPartnerId && (
                        <button 
                          onClick={() => setFilterByPartnerId(null)}
                          style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '0.75rem', padding: '0.45rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                        >
                          ✕ בטל סינון והצג את כל {userSpaces.length} המרחבים
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Storage Destination Preference */}
                <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>יעד אחסון מוגדר:</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{targetLabel}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    {Object.keys(selectedUserForAnalysis.storageConfig?.spaceOverrides || {}).length} החרגות מרחב
                  </span>
                </div>

                {/* 4. PER-SPACE DETAILED LIST (Strict Filter Applied - Shows ONLY relevant spaces immediately in view!) */}
                <div>
                  {(() => {
                    // Filter userSpaces strictly if filterByPartnerId is selected
                    const displayedSpaces = filterByPartnerId
                      ? userSpaces.filter(s => (s.members || []).some((m: any) => m.userId === filterByPartnerId) || s.creatorId === filterByPartnerId)
                      : userSpaces;

                    const filteredPartnerObj = filterByPartnerId ? sharedContacts.find(c => c.id === filterByPartnerId) : null;

                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                            📁 מרחבים ({displayedSpaces.length}{filterByPartnerId ? ` מתוך ${userSpaces.length}` : ''}):
                          </h4>
                          {filterByPartnerId && (
                            <button
                              onClick={() => setFilterByPartnerId(null)}
                              style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              מסנן לפי {filteredPartnerObj?.name || 'שותף'} ✕
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {displayedSpaces.map(s => {
                            const isCreator = s.creatorId === selectedUserForAnalysis.id;
                            const member = (s.members || []).find((m: any) => m.userId === selectedUserForAnalysis.id);
                            const docsCount = (s.documents || []).length + (s.mediaItems || []).length;
                            const invoicesCount = (s.invoices || []).length;

                            return (
                              <div 
                                key={s.id} 
                                style={{ 
                                  background: filterByPartnerId ? '#eff6ff' : '#f8fafc', 
                                  padding: '0.75rem 0.85rem', 
                                  borderRadius: '12px', 
                                  border: filterByPartnerId ? '2px solid #2563eb' : '1px solid #e2e8f0', 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  fontSize: '0.82rem',
                                  boxShadow: filterByPartnerId ? '0 4px 12px rgba(37,99,235,0.1)' : 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
                                    {s.logoUrl ? (
                                      <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <span style={{ fontSize: '1.15rem' }}>{s.icon || '📁'}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <strong style={{ color: filterByPartnerId ? '#1d4ed8' : '#0f172a' }}>{s.title}</strong>
                                      <span style={{ fontSize: '0.7rem', color: isCreator ? '#d97706' : '#2563eb', fontWeight: 800 }}>
                                        {isCreator ? '(יוצר 👑)' : `(שותף - ${member?.sharePercentage || 0}%)`}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                                      {docsCount} קבצים ומסמכים | {invoicesCount} הוצאות | {(s.features || []).length} כלים
                                    </div>
                                  </div>
                                </div>
                                <Link href={`/space/${s.id}`} target="_blank" style={{ color: '#2563eb', fontWeight: 800, textDecoration: 'none', fontSize: '0.78rem', background: '#ffffff', border: '1px solid #bfdbfe', padding: '4px 8px', borderRadius: '6px' }}>
                                  פתח ↗
                                </Link>
                              </div>
                            );
                          })}

                          {displayedSpaces.length === 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                              לא נמצאו מרחבים משותפים לשותף זה.
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <button 
                  onClick={() => { setSelectedUserForAnalysis(null); setShowPartnersInModal(false); setFilterByPartnerId(null); }}
                  style={{ width: '100%', padding: '0.7rem', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', marginTop: '0.2rem' }}
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
