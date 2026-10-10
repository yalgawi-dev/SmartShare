'use client';
import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import NotificationCenterWidget from '../components/widgets/NotificationCenterWidget';

import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from './context/SpacesContext';
import { useAuth } from './context/AuthContext';
import { getFeatureById } from './data/features';
import AuthModal from '../components/auth/AuthModal';
import PhoneLinkEnforcer from '../components/auth/PhoneLinkEnforcer';
import WelcomeEmptyState from '../components/widgets/WelcomeEmptyState';
import AppShareModal from '../components/widgets/AppShareModal';
import PersonalInboxWidget from '../components/widgets/PersonalInboxWidget';
import { PushNotificationReminder } from '../components/widgets/PushNotificationReminder';
import { universalSearch } from '../utils/searchEngine';
import { uploadImageToStorage } from '@/lib/firebase';
import { compressImage } from '../utils/imageOptimizer';



export default function Dashboard() {
  const { spaces, deleteSpace, updateSpaceTitle, updateSpaceLogo, getRoleForSpace, isLoaded: isSpacesLoaded, finalizeGuestJoin, declinePendingInvite } = useSpaces();
  const { user, isLoaded: isAuthLoaded, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);
  const [logoMenuOpenId, setLogoMenuOpenId] = useState<string | null>(null);
  const activeLogoSpaceIdRef = useRef<string | null>(null);
  const [showPersonalInbox, setShowPersonalInbox] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    const dismissedAlerts = user.dismissedAlerts || [];
    let count = 0;
    spaces.forEach(space => {
      const mySpaceKey = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('smartshare_keys') || '{}')[space.id]) : null;
      const isCreator = space.creatorId === user.id || user?.spaceKeys?.[space.id]?.role === 'creator' || mySpaceKey?.role === 'creator';
      const partnerToken = user?.spaceKeys?.[space.id]?.token || mySpaceKey?.token;
      const myActualId = isCreator ? (space.creatorId || space.createdBy || user.id) : (partnerToken || user.id);
      const hasPartners = space.features?.includes('partners');
      
      (space.invoices || []).forEach(inv => {
        if (!dismissedAlerts.includes('inv-' + inv.id)) {
          if ((inv.status === 'pending' || inv.status === 'missing' || inv.status === 'dispute') && (isCreator || inv.payerId === user.id || (inv as any).uploaderId === user.id)) count++;
        }
      });
      
      if (hasPartners) {
        (space.members || []).forEach(member => {
          if (member.status === 'disputed' && member.disputeMessage && (isCreator || member.userId === user.id) && !dismissedAlerts.includes('disp-' + member.userId)) count++;
          if (member.extensionMessage && isCreator && !dismissedAlerts.includes('ext-' + member.userId)) count++;
          if (member.shareChangeRequest && (isCreator || member.userId === user.id) && !dismissedAlerts.includes('share-' + member.userId)) count++;
          
          
          // P2P chat notifications — only if chat plugin is active
          if (space.features?.includes('chat')) {
            if (!isCreator && member.userId !== myActualId && member.userId !== user?.id) return;
            const targetId = isCreator ? member.userId : (space.creatorId || space.createdBy);
            const p2pConvoId = [user?.id, targetId].filter(Boolean).sort().join('_');
            const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);
            let unreadChatMessages = convo?.messages?.filter((msg: any) => msg.senderId !== user?.id && msg.senderId !== myActualId && !msg.readBy?.includes(user?.id)) || [];

            // Legacy fallback
            if (unreadChatMessages.length === 0) {
              unreadChatMessages = (member.messages || []).filter((msg: any) => {
                if (msg.readAt) return false;
                if (isCreator && msg.from === 'partner') return true;
                if (!isCreator && member.userId === user.id && msg.from === 'creator') return true;
                return false;
              });
            }
            if (unreadChatMessages.length > 0 && !dismissedAlerts.includes('chat-' + member.userId)) count++;
          }
        });

        // Group Chat Summary — only if chat plugin is active
        if (space.features?.includes('chat')) {
          const groupConvo = space.conversations?.find((c: any) => c.id === 'group');
          if (groupConvo) {
            const unreadGroup = groupConvo.messages?.filter((msg: any) => !msg.readBy?.includes(user.id)) || [];
            if (unreadGroup.length > 0 && !dismissedAlerts.includes('chat-group')) count++;
          }
        }
        
        if (isCreator) {
          (space.pendingInvites || []).forEach((invite: any) => {
            if (!dismissedAlerts.includes('invt-' + invite.token)) count++;
          });
        }
      }
    });
    return count;
  }, [spaces, user]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [clientKeys, setClientKeys] = useState<Record<string, { role: string; token?: string }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const parsed = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        return parsed || {};
      } catch (e) {}
    }
    return {};
  });
  const [guestTokens, setGuestTokens] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const parsed = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    const loadKeys = () => {
      try {
        const pKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        setClientKeys(pKeys || {});
        
        const pTokens = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
        setGuestTokens(Array.isArray(pTokens) ? pTokens : []);
      } catch (e) {}
    };
    loadKeys();

    const onKeyChange = (e: any) => {
      const { spaceId, role, token } = e.detail || {};
      if (spaceId) {
        setClientKeys(prev => ({ ...prev, [spaceId]: { role, token } }));
      }
      if (token) {
        setGuestTokens(prev => prev.includes(token) ? prev : [...prev, token]);
      }
      loadKeys();
    };

    window.addEventListener('smartshare_new_key', onKeyChange);
    window.addEventListener('storage', loadKeys);
    window.addEventListener('focus', loadKeys);
    document.addEventListener('visibilitychange', loadKeys);
    return () => {
      window.removeEventListener('smartshare_new_key', onKeyChange);
      window.removeEventListener('storage', loadKeys);
      window.removeEventListener('focus', loadKeys);
      document.removeEventListener('visibilitychange', loadKeys);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && isSpacesLoaded) {
      const searchParams = new URLSearchParams(window.location.search);
      const highlight = searchParams.get('highlight');
      if (highlight) {
        setTimeout(() => {
          const el = document.getElementById(`space-${highlight}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'all 0.5s ease-out';
            el.style.boxShadow = '0 0 0 4px var(--primary), 0 0 30px rgba(99, 102, 241, 0.6)';
            el.style.transform = 'scale(1.02)';
            setTimeout(() => {
              el.style.transform = 'scale(1)';
              setTimeout(() => {
                 el.style.boxShadow = 'var(--shadow-md)';
              }, 2000);
            }, 1000);
          }
        }, 500); // Wait for render
      }
    }
  }, [isSpacesLoaded, spaces.length]);

  const myPendingInvites = user?.id ? spaces.flatMap(s => 
    (s.pendingInvites || [])
      .filter((i: any) => i.targetUserId === user.id)
      .map((i: any) => ({ spaceId: s.id, spaceTitle: s.title, invite: i }))
  ) : [];

  const visibleSpaces = spaces.filter(s => { 
    if (s.status === 'pending_deletion') return false; 
    
    // 1. Creator check (strictly verified)
    if (user?.id && s.creatorId && user.id === s.creatorId) return true;
    if (user?.spaceKeys?.[s.id]?.role === 'creator') return true;
    if (clientKeys[s.id]?.role === 'creator') return true;
    
    // 2. Partner check (key or token)
    if (user?.spaceKeys?.[s.id]?.role === 'partner') return true;
    if (clientKeys[s.id]?.role === 'partner') return true;
    
    const partnerToken = user?.spaceKeys?.[s.id]?.token || clientKeys[s.id]?.token;
    const isMember = s.members?.some((m: any) => {
      if (user?.id && m.userId === user.id) return true;
      if (partnerToken && m.userId === partnerToken) return true;
      if (guestTokens.includes(m.userId)) return true;
      return false;
    });
    return isMember;
  });


  const searchedSpaces = [...universalSearch(visibleSpaces, searchQuery, ['title'])].sort((a, b) => {
      // 1. Priority for new spaces (< 24h)
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      const isNewA = (Date.now() - timeA) < 86400000;
      const isNewB = (Date.now() - timeB) < 86400000;
      
      if (isNewA && !isNewB) return -1;
      if (!isNewA && isNewB) return 1;
      if (isNewA && isNewB) return timeB - timeA; // Both new? newest first

      // 2. Sort by visits
      let visitsA = 0;
      let visitsB = 0;
      if (typeof window !== 'undefined') {
        try {
          visitsA = parseInt(localStorage.getItem(`space_visits_${a.id}`) || '0', 10);
          visitsB = parseInt(localStorage.getItem(`space_visits_${b.id}`) || '0', 10);
        } catch (e) {}
      }
      if (visitsA !== visitsB) return visitsB - visitsA; // Higher visits first
      
      // 3. Fallback to updatedAt / createdAt
      const updateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const updateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return updateB - updateA;
    });

  // Mark tutorials as seen for veteran users
  useEffect(() => {
    if (visibleSpaces.length > 1) {
      try {
        if (!localStorage.getItem('tutorial_enter_space')) localStorage.setItem('tutorial_enter_space', '1');
        if (!localStorage.getItem('tutorial_add_tools')) localStorage.setItem('tutorial_add_tools', '1');
      } catch(e){}
    }
  }, [visibleSpaces.length]);

  // Restore scroll position when coming back from a space
  useEffect(() => {
    if (isSpacesLoaded && visibleSpaces.length > 0) {
      try {
        const lastVisited = sessionStorage.getItem('lastSpaceVisited');
        if (lastVisited) {
          // Increase timeout slightly to allow DOM to render the list
          setTimeout(() => {
            const el = document.getElementById(`space-${lastVisited}`);
            if (el) {
              el.scrollIntoView({ behavior: 'auto', block: 'center' });
              el.style.transition = 'box-shadow 0.5s ease';
              el.style.boxShadow = '0 0 0 2px var(--primary)';
              setTimeout(() => el.style.boxShadow = '', 2000);
              sessionStorage.removeItem('lastSpaceVisited');
            }
          }, 200);
        }
      } catch(e) {}
    }
  }, [isSpacesLoaded, visibleSpaces.length]);


  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('action=login')) {
      setShowAuthModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className={styles.container}>
      <PhoneLinkEnforcer />
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Logo Placeholder */}
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            <img src="/myspace_logo.png" alt="MySpace Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 className={styles.title} style={{ margin: 0, fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', whiteSpace: 'nowrap', lineHeight: '1.2' }}>MySpace <span style={{fontSize: '0.6em', opacity: 0.7}}>v6.7.74</span></h1>
            <p className={styles.subtitle} style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'nowrap', opacity: 0.8 }}>פלטפורמת שיתוף</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
          {(user?.realName === 'אורח' || user?.realName === 'אורח אנונימי' || !user?.realName) && (
            <button 
              onClick={() => setShowAuthModal(true)}
              style={{ fontSize: '0.85rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 'bold', boxShadow: 'var(--shadow-sm)' }}
            >
              התחבר
            </button>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', padding: '0.2rem', gap: '0.2rem' }}>
            
            <button onClick={() => setShowShareModal(true)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'all 0.2s', borderRadius: '50%' }} title="שתף אפליקציה" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            {user?.isAdmin && (
              <Link href="/admin/users" style={{ padding: '0.4rem', color: '#EF4444', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'transform 0.2s', borderRadius: '50%' }} title="ניהול מערכת" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                🛡️
              </Link>
            )}
            <Link href="/settings" style={{ padding: '0.4rem', color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'transform 0.2s', borderRadius: '50%' }} title="הגדרות" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              ⚙️
            </Link>
            <Link href="/settings" style={{ padding: '0.2rem', textDecoration: 'none' }} title={`פרופיל - ${user?.realName || 'אורח'}`}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--primary)', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span style={{ fontSize: '1rem' }}>{user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤'}</span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Unified Bottom Bar for Main Page */}
      <>
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '420px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '24px',
          padding: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
          zIndex: 50,
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* New Space */}
          <Link 
            href="/space/new" 
            title="צור מרחב התחשבנויות חדש" 
            style={{ 
              textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              color: 'var(--text-secondary)', minWidth: '60px', transition: 'all 0.2s'
            }}
          >
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: '1.5rem' }}>➕</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>חדש</span>
          </Link>
          
          {/* Notifications */}
          <button 
            onClick={() => setShowNotifications(true)}
            title="התראות והודעות פרטיות" 
            style={{ 
              background: 'transparent', border: 'none', padding: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
              color: 'var(--text-secondary)', minWidth: '60px', transition: 'all 0.2s'
            }}
          >
            <div style={{ position: 'relative', width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ fontSize: '1.5rem' }}>✉️</span>
              {unreadMessagesCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', padding: '0 2px' }}>
                  {unreadMessagesCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>הודעות</span>
          </button>

          {/* Inbox */}
          <button 
            onClick={() => setShowPersonalInbox(true)}
            title="מחסן מסמכים אישי" 
            style={{ 
              background: 'transparent', border: 'none', padding: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
              color: 'var(--text-secondary)', minWidth: '60px', transition: 'all 0.2s'
            }}
          >
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
              <span style={{ fontSize: '1.5rem' }}>📥</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>מחסן</span>
          </button>
        </div>

        {showNotifications && typeof window !== 'undefined' && createPortal(<NotificationCenterWidget onClose={() => setShowNotifications(false)} />, document.body)}
        {showPersonalInbox && typeof window !== 'undefined' && createPortal(
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} 
            onClick={() => setShowPersonalInbox(false)}
          >
            <div 
              style={{ background: 'var(--bg-main)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }} 
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>מחסן מסמכים אישי</h3>
                <button onClick={() => setShowPersonalInbox(false)} style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>✖</button>
              </div>
              <PersonalInboxWidget />
            </div>
          </div>,
          document.body
        )}
      </>

      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
      `}</style>

      {(!isAuthLoaded || !isSpacesLoaded) ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className={styles.loader} style={{ border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : visibleSpaces.length === 0 ? (
        <WelcomeEmptyState />
      ) : (
      <>
        {(user?.realName === 'אורח' || user?.realName === 'אורח אנונימי' || !user?.realName) && (
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#b45309', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowAuthModal(true)}>
            <strong>שימו לב:</strong> אתם מחוברים כאורח! כדי לגבות את המרחבים שלכם ולמנוע איבוד נתונים, <span style={{ textDecoration: 'underline' }}>לחצו כאן להרשמה קצרה בחינם (10 שניות)</span>.
          </div>
        )}
      
          
          {visibleSpaces.length >= 2 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="חיפוש מרחב..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '1rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

        {myPendingInvites.length > 0 && (
          <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
            {myPendingInvites.map((item, idx) => (
              <div key={idx} style={{ 
                background: 'var(--bg-main)', border: '1px solid var(--primary)', 
                borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '0.5rem',
                boxShadow: '0 4px 12px rgba(99,102,241,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>הזמנה למרחב חדש</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      הוזמנת להצטרף למרחב <strong>{item.spaceTitle}</strong> {item.invite.guestShare > 0 ? `כשותף (${item.invite.guestShare}%)` : 'כמשתף פעולה'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => {
                      if (user?.id) {
                        finalizeGuestJoin(item.spaceId, user.realName || user.nickname || user.phone || 'משתמש', item.invite.isRetroactive || false, user.id, item.invite.token, item.invite.guestShare)
                      }
                    }}
                    style={{ flex: 1, padding: '0.6rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: '600', cursor: 'pointer' }}
                  >
                    אישור הצטרפות
                  </button>
                  <button 
                    onClick={() => declinePendingInvite(item.spaceId, item.invite.token)}
                    style={{ flex: 1, padding: '0.6rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontWeight: '500', cursor: 'pointer' }}
                  >
                    דחייה
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
          {searchedSpaces.length === 0 && visibleSpaces.length > 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              לא נמצאו מרחבים תואמים לחיפוש
            </div>
          )}

        {searchedSpaces.map((space, index) => {
          let showFirstSpaceTip = false;
          if (visibleSpaces.length === 1 && index === 0 && typeof window !== 'undefined') {
            try { showFirstSpaceTip = !localStorage.getItem('tutorial_enter_space'); } catch(e) {}
          }
          const isExpanded = expandedSpaceId === space.id;
          
          return (
          <div id={`space-${space.id}`} key={space.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', border: isExpanded ? '2px solid var(--primary)' : '1px solid var(--border-light)', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s ease', boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.05)' }}>
            
            {/* Header / Accordion Toggle */}
            <div 
              onClick={() => setExpandedSpaceId(isExpanded ? null : space.id)}
              style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent' }}
            >
              <div style={{ position: 'relative' }}>
                <div 
                  style={{ 
                    fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    width: '48px', height: '48px', 
                    background: space.logoUrl ? 'transparent' : 'var(--bg-body)', 
                    borderRadius: '16px', overflow: 'hidden', position: 'relative',
                    boxShadow: space.logoUrl ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    flexShrink: 0
                  }}
                >
                  {space.logoUrl ? (
                    <img src={space.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    space.icon
                  )}
                </div>
                {isExpanded && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(logoMenuOpenId === space.id ? null : space.id); }}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', border: '2px solid var(--bg-main)', zIndex: 10 }}
                  >
                    ✏️
                  </div>
                )}
                {isExpanded && logoMenuOpenId === space.id && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', padding: '0.5rem', zIndex: 20, minWidth: '130px', border: '1px solid var(--border-light)' }}>
                    <button onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(null); activeLogoSpaceIdRef.current = space.id; setTimeout(() => document.getElementById('global-logo-camera')?.click(), 50); }} style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.6rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold' }}>
                      <span>📷</span> צלם לוגו
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setLogoMenuOpenId(null); activeLogoSpaceIdRef.current = space.id; setTimeout(() => document.getElementById('global-logo-gallery')?.click(), 50); }} style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.6rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 'bold', marginTop: '4px' }}>
                      <span>🖼️</span> ייבא תמונה
                    </button>
                  </div>
                )}
                              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{space.title}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{space.features.length} פיצ'רים</span>
                  {(() => {
                    const totalUnread = (space.members || []).reduce((acc: number, m: any) => acc + ((m.messages || []).filter((msg: any) => msg.from === 'partner' && !msg.readAt).length), 0);
                    const hasExtension = (space.members || []).some((m: any) => m.status === 'extension_requested');
                    const count = totalUnread + (hasExtension ? 1 : 0);
                    return count > 0 ? (
                      <span style={{ background: '#ef4444', color: 'white', borderRadius: '12px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 'bold' }}>{count} עדכונים</span>
                    ) : null;
                  })()}
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border-light)' }}>
                {space.coverImage && (
                  <div style={{ height: '120px', width: 'calc(100% + 2rem)', margin: '0 -1rem 1rem -1rem', background: 'var(--border-light)', overflow: 'hidden' }}>
                    <img src={space.coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                
                {editingSpaceId === space.id ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (editTitleValue.trim()) updateSpaceTitle(space.id, editTitleValue.trim());
                    setEditingSpaceId(null);
                  }} style={{ margin: '0 0 1rem 0' }}>
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={() => {
                        if (editTitleValue.trim()) updateSpaceTitle(space.id, editTitleValue.trim());
                        setEditingSpaceId(null);
                      }}
                      autoFocus
                      onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 50); }}
                      style={{
                        margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)',
                        border: '1px solid var(--primary)', borderRadius: '6px',
                        padding: '0.4rem', outline: 'none', background: 'var(--bg-main)', width: '100%',
                        boxSizing: 'border-box'
                      }}
                    />
                  </form>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', flex: 1 }}>{space.description}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditTitleValue(space.title); setEditingSpaceId(space.id); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
                      title="שנה שם"
                    >
                      ✏️
                    </button>
                  </div>
                )}


                <input 
                  type="file" 
                  id={`logo-gallery-${space.id}`} 
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => { updateSpaceLogo(space.id, ev.target?.result as string); };
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                <div className={styles.badges} style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {space.features.slice(0, 5).map(fId => {
                    const feature = getFeatureById(fId);
                    return feature ? <span key={fId} className={styles.badge}>{feature.name}</span> : null;
                  })}
                  {space.features.length > 5 && (
                    <span className={styles.badge}>+{space.features.length - 5}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={`/space/${space.id}`} 
                    onClick={() => {
                      try { 
                        sessionStorage.setItem('lastSpaceVisited', space.id); 
                        const currentVisits = parseInt(localStorage.getItem(`space_visits_${space.id}`) || '0', 10);
                        localStorage.setItem(`space_visits_${space.id}`, (currentVisits + 1).toString());
                      } catch(e){}
                      if (showFirstSpaceTip) {
                        try { localStorage.setItem('tutorial_enter_space', '1'); } catch(e){}
                      }
                    }}
                    style={{ flex: 1, background: 'var(--primary)', color: 'white', textDecoration: 'none', textAlign: 'center', padding: '0.8rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                  >
                    כניסה למרחב <span>→</span>
                  </Link>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm('למחוק את המרחב "' + space.title + '"? הפעולה תעביר אותו לארכיון המחיקה.')) {
                        deleteSpace(space.id);
                      }
                    }}
                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.8rem', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="מחק מרחב"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            )}
          </div>
        );
        })}
      </div>
      </>
      )}
      <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        v5.1.0 - שלב 5: מנוע הזמנות חכם, זיהוי טלפוני (Phone Auth) ומאגר אנשי קשר
      </div>
      
      {/* Global hidden inputs for Logo Upload */}
      <div style={{ display: 'none' }}>
        <input 
          type="file" 
          id="global-logo-camera" 
          accept="image/*" 
          capture="environment"
          onChange={async (e) => {
            const spaceId = activeLogoSpaceIdRef.current;
            if (!spaceId) return;
            try {
              const file = e.target.files?.[0];
              if (file) {
                const tempUrl = URL.createObjectURL(file);
                updateSpaceLogo(spaceId, tempUrl);
                const base64 = await compressImage(file, 256, 256, 0.85, 'image/png');
                updateSpaceLogo(spaceId, base64);
                try {
                  const storageUrl = await uploadImageToStorage(base64, `spaces/covers/logo_${spaceId}_${Date.now()}.png`);
                  updateSpaceLogo(spaceId, storageUrl);
                } catch(uploadErr) {
                  console.warn("Storage fail", uploadErr);
                }
              }
            } catch(err) { 
              console.error(err); 
              alert("שגיאה בהעלאה: " + String(err));
            }
            e.target.value = ''; // Reset input
          }}
        />
        <input 
          type="file" 
          id="global-logo-gallery" 
          accept="image/*" 
          onChange={async (e) => {
            const spaceId = activeLogoSpaceIdRef.current;
            if (!spaceId) return;
            try {
              const file = e.target.files?.[0];
              if (file) {
                const tempUrl = URL.createObjectURL(file);
                updateSpaceLogo(spaceId, tempUrl);
                const base64 = await compressImage(file, 256, 256, 0.85, 'image/png');
                updateSpaceLogo(spaceId, base64);
                try {
                  const storageUrl = await uploadImageToStorage(base64, `spaces/covers/logo_${spaceId}_${Date.now()}.png`);
                  updateSpaceLogo(spaceId, storageUrl);
                } catch(uploadErr) {
                  console.warn("Storage fail", uploadErr);
                }
              }
            } catch(err) { 
              console.error(err); 
              alert("שגיאה בהעלאה: " + String(err));
            }
            e.target.value = ''; // Reset input
          }}
        />
      </div>
      {showAuthModal && (

        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
      {showShareModal && (
        <AppShareModal onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
}
