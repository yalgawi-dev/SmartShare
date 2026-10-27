'use client';
import NotificationHelpModal from '../../components/common/NotificationHelpModal';
import { useState, useRef, useEffect, useMemo } from 'react';

import { auth } from '@/lib/firebase';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission } from '../../utils/notifications';
import { useSpaces } from '../context/SpacesContext';
import Link from 'next/link';
import { sortSpacesByUsagePriority } from '../../utils/spaceSorting';
import { getDeviceStorageEstimate, requestPersistentStorage, LocalStorageQuota } from '../../utils/localDeviceStorage';
import { getSharedContactsForUser } from '../../utils/partnerUtils';
import { compressImageWebP } from '../../utils/imageOptimizer';

export default function SettingsPage() {
  const { user, allUsers, updateProfile, logout, deleteMyAccount } = useAuth();
  const { spaces, restoreSpace, permanentlyDeleteSpace, removeMember } = useSpaces() as any;
  
    const [activeTab, setActiveTab] = useState<'profile' | 'contacts' | 'spaces' | 'storage' | 'system'>('profile');
  const [defaultStorageTarget, setDefaultStorageTarget] = useState<'cloud' | 'local' | 'gdrive'>(
    user?.storageConfig?.defaultTarget || 'cloud'
  );
  const [spaceStorageOverrides, setSpaceStorageOverrides] = useState<Record<string, 'cloud' | 'local' | 'gdrive'>>(
    user?.storageConfig?.spaceOverrides || {}
  );
  const [storageSaveSuccess, setStorageSaveSuccess] = useState(false);
  const [deviceQuota, setDeviceQuota] = useState<LocalStorageQuota | null>(null);
  const [fallbackTarget, setFallbackTarget] = useState<'local' | 'gdrive' | 'onedrive' | 'stop'>(
    (user?.storageConfig as any)?.fallbackTarget || 'local'
  );

  useEffect(() => {
    getDeviceStorageEstimate().then(setDeviceQuota);
  }, []);

  const handleRequestPersistence = async () => {
    const success = await requestPersistentStorage();
    const updated = await getDeviceStorageEstimate();
    setDeviceQuota(updated);
    if (success) {
      alert('האחסון המקומי של MySpace הוגדר כקבוע ומוגן בזיכרון המכשיר בהצלחה!');
    } else {
      alert('המכשיר שלך מנהל את האחסון אוטומטית.');
    }
  };

  useEffect(() => {
    if (user?.storageConfig) {
      if (user.storageConfig.defaultTarget) setDefaultStorageTarget(user.storageConfig.defaultTarget);
      if (user.storageConfig.spaceOverrides) setSpaceStorageOverrides(user.storageConfig.spaceOverrides);
    }
  }, [user?.storageConfig]);

  const handleSaveStorageConfig = (newTarget: 'cloud' | 'local' | 'gdrive', newOverrides?: Record<string, 'cloud' | 'local' | 'gdrive'>) => {
    const overrides = newOverrides !== undefined ? newOverrides : spaceStorageOverrides;
    setDefaultStorageTarget(newTarget);
    updateProfile({
      storageConfig: {
        defaultTarget: newTarget,
        spaceOverrides: overrides
      }
    });
    setStorageSaveSuccess(true);
    setTimeout(() => setStorageSaveSuccess(false), 3000);
  };

  const handleSetSpaceOverride = (spaceId: string, target: 'default' | 'cloud' | 'local' | 'gdrive') => {
    const nextOverrides = { ...spaceStorageOverrides };
    if (target === 'default') {
      delete nextOverrides[spaceId];
    } else {
      nextOverrides[spaceId] = target;
    }
    setSpaceStorageOverrides(nextOverrides);
    updateProfile({
      storageConfig: {
        defaultTarget: defaultStorageTarget,
        spaceOverrides: nextOverrides
      }
    });
    setStorageSaveSuccess(true);
    setTimeout(() => setStorageSaveSuccess(false), 3000);
  };
  const [spacesSubTab, setSpacesSubTab] = useState<'active' | 'archived'>('active');
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [showNotificationHelp, setShowNotificationHelp] = useState(false);
  const [pushSuccessMessage, setPushSuccessMessage] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [showExtraProfile, setShowExtraProfile] = useState(false);
  const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window && Notification.permission === 'granted') {
        setIsPushEnabled(true);
      }
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    }
  }, []);

  const handleEnablePush = async () => {
    if (user?.id) {
      const success = await requestNotificationPermission(user.id);
      if (success) {
        setIsPushEnabled(true);
        setPushSuccessMessage(true);
        setTimeout(() => setPushSuccessMessage(false), 4000);
      } else {
        setShowNotificationHelp(true);
      }
    }
  };

  const handleTriggerInstall = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('trigger-pwa-install'));
    }
  };
  
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [realName, setRealName] = useState(user?.realName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [status, setStatus] = useState(user?.status || 'hidden');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [zodiacSign, setZodiacSign] = useState(user?.zodiacSign || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [showPhotoSourceSheet, setShowPhotoSourceSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '');
      setRealName(user.realName || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
      setStatus(user.status || 'hidden');
      setCustomStatus(user.customStatus || '');
      setBirthDate(user.birthDate || '');
      setZodiacSign(user.zodiacSign || '');
      setGender(user.gender || '');
    }
  }, [user]);

  // Comprehensive calculation of contacts: Include ALL spaces user has access to
  const { uniqueContacts, myActiveSpaces, myArchivedSpaces } = useMemo(() => {
    if (!user?.id || !Array.isArray(spaces)) {
      return { uniqueContacts: [], myActiveSpaces: [], myArchivedSpaces: [] };
    }

    const mySpaces = spaces.filter((s: any) => {
      const isCreator = s.creatorId === user.id || user.spaceKeys?.[s.id]?.role === 'creator';
      const isPartnerKey = user.spaceKeys?.[s.id]?.role === 'partner';
      const isMember = (s.members || []).some((m: any) => m.userId === user.id || m.phone === user.phone);
      return isCreator || isPartnerKey || isMember;
    });

    const active = mySpaces.filter((s: any) => s.status !== 'pending_deletion' && !s.isArchived);
    const archived = mySpaces.filter((s: any) => s.status === 'pending_deletion' || s.isArchived);

    // Single Source of Truth for shared contacts (partnerUtils)
    const contactsList = getSharedContactsForUser(user, spaces, allUsers);

    return {
      uniqueContacts: contactsList,
      myActiveSpaces: sortSpacesByUsagePriority(active),
      myArchivedSpaces: sortSpacesByUsagePriority(archived)
    };
  }, [spaces, user, allUsers]);

  if (!user || (user as any).isAnonymous) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main, #f8fafc)', padding: '2rem' }}>
        <div style={{ background: 'white', maxWidth: '500px', width: '100%', borderRadius: '24px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '4rem', margin: '0 auto 1.5rem', width: '80px', height: '80px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>🔒</div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', color: '#0f172a' }}>פעולה חסומה</h2>
          <p style={{ color: '#475569', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            על מנת לגשת להגדרות הפרופיל והמערכת, עליך להיות משתמש מחובר (רשום). אנא חזור למסך הראשי והתחבר או הירשם בחינם.
          </p>
          <Link href="/" style={{ display: 'inline-block', padding: '1rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: '16px', fontWeight: 'bold', textDecoration: 'none', boxShadow: '0 4px 12px rgba(74,91,240,0.2)' }}>
            &rarr; חזרה למסך הראשי
          </Link>
        </div>
      </div>
    );
  }

  // Auto-save logic
  const saveField = (field: string, value: any) => {
    updateProfile({ [field]: value });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImageWebP(file, 600, 600, 0.85);
        updateProfile({ avatarUrl: compressedBase64 });
      } catch (err) {
        console.error('Failed to compress avatar, fallback to reader:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            updateProfile({ avatarUrl: event.target.result as string });
          }
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset inputs so selecting the same file again triggers onChange
    if (e.target) e.target.value = '';
    setShowPhotoSourceSheet(false);
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '7rem', direction: 'rtl' }}>
      
      {/* Sticky Top Header */}
      <div style={{ position: 'sticky', top: 0, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', zIndex: 100, padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <Link href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
          <span>→</span> חזרה למסך הראשי
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>v3.3.12</span>
          <button onClick={logout} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '20px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
            התנתק
          </button>
        </div>
      </div>

      <header style={{ padding: '1.25rem 1rem 0.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
          הגדרות חשבון וניהול
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.35rem', fontSize: '0.9rem' }}>
          נהל את הפרופיל שלך, השותפים, המרחבים והגדרות המערכת בקלות.
        </p>
      </header>

      {/* Main Content Area based on Active Tab */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.75rem 1rem' }}>
        
        {/* ================= TAB 1: PROFILE ================= */}
        {activeTab === 'profile' && (
          <>
            {/* Install PWA Prompt Banner inside Profile if not standalone */}
            {!isStandalone && (
              <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                borderRadius: '18px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                animation: 'pulseGlow 3s infinite'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '2rem' }}>📲</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>התקן את MySpace בטלפון</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '2px' }}>גישה מיידית ממסך הבית, מהירות שיא והתראות בזמן אמת</div>
                  </div>
                </div>
                <button
                  onClick={handleTriggerInstall}
                  style={{
                    background: '#ffffff',
                    color: '#059669',
                    border: 'none',
                    padding: '0.6rem 1.2rem',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  התקן עכשיו ⬇️
                </button>
              </div>
            )}

            {/* Profile Main Card */}
            <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: '1.15rem', margin: '0 0 1.25rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <span>👤</span> פרופיל ראשי
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f1f5f9', overflow: 'hidden', border: '3px solid #2563eb' }}>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🧑‍💻</div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowPhotoSourceSheet(true)}
                    style={{ position: 'absolute', bottom: -2, right: -2, background: '#2563eb', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
                    title="החלף תמונה (מצלמה או גלריה)"
                  >
                    📷
                  </button>
                  {/* Gallery input */}
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
                  {/* Camera input with direct camera capture */}
                  <input type="file" accept="image/*" capture="user" ref={cameraInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>{realName || user.id}</h3>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{phone || 'אין טלפון'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                  שם מלא:
                  <input type="text" value={realName} onChange={e => setRealName(e.target.value)} onBlur={e => saveField('realName', e.target.value)} style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }} />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                  כינוי / תצוגה:
                  <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} onBlur={e => saveField('nickname', e.target.value)} placeholder="הכינוי שלך..." style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }} />
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>מספר טלפון:</label>
                    {phone && (
                      <button 
                        type="button"
                        onClick={async () => {
                          if (confirm('האם אתה בטוח שברצונך לשנות מספר? תצטרך לאמת את המספר החדש ב-SMS.')) {
                            await saveField('phone', '');
                            window.location.reload();
                          }
                        }}
                        style={{ padding: '0.25rem 0.65rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        שנה מספר ✏️
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={phone || 'לא מאומת'} 
                    disabled 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', direction: 'ltr', textAlign: 'right' }} 
                  />
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{phone ? (user.phoneVerified !== false ? 'המספר מאומת ומאובטח ✓' : 'המספר טרם אומת ב-SMS') : 'יש להזין מספר במסך הראשי.'}</span>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                  אימייל:
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => saveField('email', e.target.value)} placeholder="name@example.com" style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', direction: 'ltr', textAlign: 'right' }} />
                    {email && <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>רשום ✓</span>}
                  </div>
                </label>
              </div>


            </section>

            {/* Accordion: Extra Profile Information */}
            <section style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div 
                onClick={() => setShowExtraProfile(!showExtraProfile)}
                style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: showExtraProfile ? '#f8fafc' : '#ffffff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                  <span>🌟</span> פרטים אישיים נוספים (אופציונלי)
                </div>
                <div style={{ color: '#64748b', fontSize: '1rem', transition: 'transform 0.3s', transform: showExtraProfile ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </div>
              </div>

              {showExtraProfile && (
                <div style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                    מצב משפחתי:
                    <select value={status} onChange={e => { setStatus(e.target.value as any); saveField('status', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                      <option value="hidden">לא מעוניין/ת לשתף</option>
                      <option value="single">רווק/ה</option>
                      <option value="relationship">במערכת יחסים</option>
                      <option value="married">נשוי/אה</option>
                      <option value="divorced">גרוש/ה</option>
                      <option value="widowed">אלמן/ה</option>
                      <option value="complicated">זה מסובך</option>
                      <option value="other">אחר...</option>
                    </select>
                  </label>

                  {status === 'other' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                      פירוט:
                      <input type="text" value={customStatus} onChange={e => setCustomStatus(e.target.value)} onBlur={e => saveField('customStatus', e.target.value)} placeholder="מצב אישי..." style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    </label>
                  )}

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                    מגדר:
                    <select value={gender} onChange={e => { setGender(e.target.value); saveField('gender', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                      <option value="">לא צוין</option>
                      <option value="male">זכר</option>
                      <option value="female">נקבה</option>
                      <option value="other">אחר</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                    תאריך לידה:
                    <input type="date" value={birthDate} onChange={e => { setBirthDate(e.target.value); saveField('birthDate', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                    מזל:
                    <select value={zodiacSign} onChange={e => { setZodiacSign(e.target.value); saveField('zodiacSign', e.target.value); }} style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}>
                      <option value="">לא צוין</option>
                      <option value="טלה">טלה</option>
                      <option value="שור">שור</option>
                      <option value="תאומים">תאומים</option>
                      <option value="סרטן">סרטן</option>
                      <option value="אריה">אריה</option>
                      <option value="בתולה">בתולה</option>
                      <option value="מאזניים">מאזניים</option>
                      <option value="עקרב">עקרב</option>
                      <option value="קשת">קשת</option>
                      <option value="גדי">גדי</option>
                      <option value="דלי">דלי</option>
                      <option value="דגים">דגים</option>
                    </select>
                  </label>
                </div>
              )}
            </section>
          </>
        )}

        {/* ================= TAB 2: CONTACTS ================= */}
        {activeTab === 'contacts' && (
          <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <span>🤝</span> אנשי קשר ושותפים ({uniqueContacts.length})
              </h2>
            </div>
            <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
              כל השותפים שחולקים איתך מרחבים קיימים או שמורים באנשי הקשר שלך.
            </p>

            {uniqueContacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>אין אנשי קשר משותפים כרגע</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>כאשר תזמין שותפים למרחבים שלך או תצטרף למרחב, הם יופיעו כאן אוטומטית.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {uniqueContacts.map((contact) => (
                  <div key={contact.id} style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '1rem', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#e0e7ff', color: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                      {contact.avatarUrl ? (
                        <img src={contact.avatarUrl} alt={contact.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        contact.name ? contact.name.charAt(0) : '👤'
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{contact.name}</div>
                      {contact.phone && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', direction: 'ltr', textAlign: 'right' }}>{contact.phone}</div>
                      )}
                      <div style={{ color: '#2563eb', fontSize: '0.8rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {contact.spaces.length > 0 
                          ? 'שותף ב: ' + contact.spaces.map(s => s.title).join(', ') 
                          : 'איש קשר שמור'}
                      </div>
                    </div>
                    {contact.spaces.length > 0 && (
                      <button 
                        onClick={() => {
                          if (confirm('האם אתה בטוח שברצונך להסיר את ' + contact.name + ' מכל הפרויקטים המשותפים?')) {
                            contact.spaces.forEach(s => removeMember(s.id, contact.id, user.id));
                          }
                        }}
                        style={{ padding: '0.4rem 0.85rem', borderRadius: '20px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}
                      >
                        הסר שותף
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= TAB 3: SPACES & ARCHIVE ================= */}
        {activeTab === 'spaces' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Spaces Sub-tabs Switcher */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '6px', 
              background: '#e2e8f0', 
              padding: '4px', 
              borderRadius: '14px' 
            }}>
              <button
                type="button"
                onClick={() => setSpacesSubTab('active')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: spacesSubTab === 'active' ? '#ffffff' : 'transparent',
                  color: spacesSubTab === 'active' ? '#2563eb' : '#64748b',
                  fontWeight: spacesSubTab === 'active' ? 800 : 600,
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
                <span>מרחבים פעילים ({myActiveSpaces.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSpacesSubTab('archived')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: spacesSubTab === 'archived' ? '#ffffff' : 'transparent',
                  color: spacesSubTab === 'archived' ? '#d97706' : '#64748b',
                  fontWeight: spacesSubTab === 'archived' ? 800 : 600,
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
                <span>בארכיון ({myArchivedSpaces.length})</span>
              </button>
            </div>

            {/* Sub-tab 1: Active Spaces */}
            {spacesSubTab === 'active' && (
              <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.15rem', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                    <span>🟢</span> מרחבים פעילים ({myActiveSpaces.length})
                  </h2>
                  <Link href="/" style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}>
                    פתח במסך הראשי ↗
                  </Link>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myActiveSpaces.map((s: any) => {
                    const isExpanded = expandedSpaceId === s.id;
                    return (
                      <div 
                        key={s.id} 
                        style={{ 
                          borderRadius: '16px', 
                          border: '1px solid #e2e8f0', 
                          background: '#ffffff', 
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Card Header (clickable to expand/collapse) */}
                        <div 
                          onClick={() => setExpandedSpaceId(isExpanded ? null : s.id)}
                          style={{ 
                            padding: '0.85rem 1rem', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            userSelect: 'none',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                              {s.logoUrl ? (
                                <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '1.4rem' }}>{s.icon || '🌟'}</span>
                              )}
                            </div>
                            <div style={{ minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                                {(s.features || []).length} פיצ'רים | {(s.members || []).length} שותפים | {(s.invoices || []).length} הוצאות
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '8px', 
                            background: '#f1f5f9', 
                            color: '#64748b', 
                            fontSize: '0.75rem',
                            flexShrink: 0,
                            transition: 'transform 0.2s ease', 
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' 
                          }}>
                            ▼
                          </div>
                        </div>

                        {/* Expanded Content Drawer matching home page */}
                        {isExpanded && (
                          <div style={{ padding: '0.75rem 1rem 0.85rem', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                            {s.coverImage && (
                              <div style={{ height: '100px', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                                <img src={s.coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}

                            {s.description && (
                              <p style={{ margin: '0 0 0.65rem 0', fontSize: '0.84rem', color: '#475569', lineHeight: '1.4' }}>
                                {s.description}
                              </p>
                            )}

                            {/* Features badges */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                              {(s.features || []).map((fId: string) => (
                                <span 
                                  key={fId} 
                                  style={{ 
                                    background: '#e0e7ff', 
                                    color: '#3730a3', 
                                    fontSize: '0.72rem', 
                                    padding: '2px 7px', 
                                    borderRadius: '6px', 
                                    fontWeight: 700 
                                  }}
                                >
                                  {fId}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <Link 
                                href={'/space/' + s.id} 
                                style={{ 
                                  flex: 1, 
                                  background: '#2563eb', 
                                  color: 'white', 
                                  textDecoration: 'none', 
                                  textAlign: 'center', 
                                  padding: '0.45rem 0.9rem', 
                                  borderRadius: '8px', 
                                  fontWeight: 700, 
                                  fontSize: '0.84rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px'
                                }}
                              >
                                כניסה למרחב <span>→</span>
                              </Link>
                              <button 
                                onClick={async (e) => {
                                  e.preventDefault();
                                  if (confirm('למחוק את המרחב "' + s.title + '"? הפעולה תעביר אותו לארכיון המחיקה.')) {
                                    await permanentlyDeleteSpace(s.id);
                                  }
                                }}
                                style={{ 
                                  background: '#fef2f2', 
                                  color: '#ef4444', 
                                  border: '1px solid #fecaca', 
                                  borderRadius: '8px', 
                                  padding: '0.45rem 0.85rem', 
                                  cursor: 'pointer', 
                                  fontWeight: 700, 
                                  fontSize: '0.8rem',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                🗑️ העבר לארכיון
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {myActiveSpaces.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                      אין מרחבים פעילים
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Sub-tab 2: Archived Spaces */}
            {spacesSubTab === 'archived' && (
              <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                  <span>🗄️</span> מרחבים בארכיון ({myArchivedSpaces.length})
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                  מרחבים שהועברו לארכיון. מרחבים אלו ישמרו למשך 14 ימים לפני מחיקה לצמיתות.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myArchivedSpaces.map((s: any) => (
                    <div key={s.id} style={{ border: '1px solid #fed7aa', background: '#fffbeb', padding: '1rem', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef3c7' }}>
                          {s.logoUrl ? (
                            <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '1.2rem' }}>{s.icon || '🗄️'}</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#9a3412' }}>{s.title}</div>
                          <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px' }}>
                            נמחק סופית ב: {new Date(s.deletionScheduledFor || Date.now() + 14 * 86400000).toLocaleDateString('he-IL')}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => restoreSpace(s.id)}
                          style={{ padding: '0.45rem 0.9rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
                        >
                          ↩️ שחזר מרחב
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm('האם למחוק לצמיתות את "' + s.title + '"? הפעולה בלתי הפיכה!')) {
                              await permanentlyDeleteSpace(s.id);
                            }
                          }}
                          style={{ padding: '0.45rem 0.9rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
                        >
                          🗑️ מחק סופית
                        </button>
                      </div>
                    </div>
                  ))}
                  {myArchivedSpaces.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      אין מרחבים בארכיון כרגע.
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ================= TAB 4: SYSTEM & SETTINGS ================= */}
        {activeTab === 'system' && (
          <>
            {/* Direct Phone Notifications Section */}
            <section style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 800 }}>
                    <span>🔔</span> התראות ישירות לטלפון (Push Notifications)
                  </h3>
                  <p style={{ margin: 0, color: '#15803d', fontSize: '0.88rem', lineHeight: '1.5' }}>
                    קבל התראה מיידית למכשיר כששותף מעלה הוצאה, שולח מסמך או מעביר כסף.
                  </p>
                </div>
                <button 
                  onClick={handleEnablePush} 
                  style={{ 
                    background: isPushEnabled ? '#86efac' : '#22c55e', 
                    color: isPushEnabled ? '#14532d' : 'white', 
                    border: 'none', 
                    padding: '0.75rem 1.4rem', 
                    borderRadius: '12px', 
                    fontWeight: 800, 
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    boxShadow: '0 4px 10px rgba(34, 197, 94, 0.25)'
                  }}
                >
                  {isPushEnabled ? 'פעיל ✔️ (רענן סנכרון)' : 'הפעל עכשיו 🔔'}
                </button>
              </div>
            </section>

            {/* PWA App Install Section */}
            <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 800 }}>
                    <span>📲</span> התקנת האפליקציה במכשיר (PWA)
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem', lineHeight: '1.5' }}>
                    {isStandalone 
                      ? 'האפליקציה כבר מותקנת ופועלת במצב אפליקציה עצמאית במכשיר שלך.' 
                      : 'התקן את MySpace כאפליקציה אמיתית במסך הבית של הטלפון בלחיצה אחת.'}
                  </p>
                </div>
                {!isStandalone ? (
                  <button 
                    onClick={handleTriggerInstall} 
                    style={{ 
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.75rem 1.4rem', 
                      borderRadius: '12px', 
                      fontWeight: 800, 
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    התקן עכשיו ⬇️
                  </button>
                ) : (
                  <span style={{ color: '#15803d', background: '#dcfce7', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 800 }}>
                    מותקן בהצלחה ✓
                  </span>
                )}
              </div>
            </section>


            {/* Danger Zone */}
            <section style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '20px', padding: '1.5rem', marginTop: '1rem' }}>
              <h3 style={{ color: '#e11d48', margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 800 }}>
                ⚠️ אזור מסוכן (Danger Zone)
              </h3>
              <p style={{ color: '#9f1239', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                מחיקת חשבון הינה פעולה בלתי הפיכה. מחיקת החשבון תסיר את פרטיך ותשחרר את מספר הטלפון המקושר.
              </p>
              <button 
                onClick={async () => {
                  if (confirm('האם אתה בטוח שברצונך למחוק את החשבון הנוכחי לצמיתות? הפעולה בלתי הפיכה!')) {
                    try {
                      await deleteMyAccount();
                      alert('החשבון נמחק בהצלחה.');
                      window.location.href = '/';
                    } catch (e: any) {
                      alert('שגיאה במחיקת חשבון: ' + e.message);
                    }
                  }
                }}
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                מחק את החשבון שלי לצמיתות
              </button>
            </section>
          </>
        )}

      </div>

              {/* ================= TAB: STORAGE & PRIVACY ================= */}
        {activeTab === 'storage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Header / Intro Card */}
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', borderRadius: '20px', padding: '1.4rem', boxShadow: '0 8px 24px rgba(15,23,42,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>אחסון ופרטיות ב-MySpace</h2>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.85, lineHeight: '1.5' }}>
                שליטה מלאה ועצמאית במיקום שמירת המסמכים והקבצים שלך. בחר היכן נשמר המידע שלך – בענן המאובטח של MySpace, ישירות על המכשיר שלך לפרטיות מרבית, או ב-Google Drive האישי שלך.
              </p>
            </div>

            {storageSaveSuccess && (
              <div style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>✓</span> הגדרות האחסון עודכנו ונשמרו בהצלחה!
              </div>
            )}

            {/* 1. Device Storage Quota Monitor (WhatsApp Style) */}
            <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.4rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📱</span> תיקיית MySpace המקומית בטלפון (מודל WhatsApp)
                </h3>
                {deviceQuota && (
                  <span style={{ fontSize: '0.75rem', background: deviceQuota.isPersistent ? '#dcfce7' : '#fef9c3', color: deviceQuota.isPersistent ? '#15803d' : '#854d0e', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                    {deviceQuota.isPersistent ? '🔒 אחסון קבוע ומוגן' : '⚡ אחסון רגיל'}
                  </span>
                )}
              </div>

              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' }}>
                בדיוק כמו תיקיית <code style={{ direction: 'ltr', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>WhatsApp/Media</code>, האפליקציה שומרת את הקבצים המקומיים בתיקייה ייעודית מבודדת ומסודרת: <strong style={{ color: '#0f172a' }}>MySpace/[שם המרחב]</strong>, מבלי לערבב שום דבר בתיקיית ההורדות הכללית של המכשיר.
              </p>

              {deviceQuota && (
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span style={{ color: '#475569' }}>נפח בשימוש באפליקציה</span>
                    <span style={{ color: '#2563eb' }}>{deviceQuota.usageMB} MB / {deviceQuota.quotaMB > 0 ? `${(deviceQuota.quotaMB / 1024).toFixed(1)} GB זמין` : 'ללא הגבלה'}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(deviceQuota.percentUsed, 1)}%`, height: '100%', background: '#10b981', borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ניתן לנצל את מלוא שטח האחסון הפנוי במכשירך.</span>
                    {!deviceQuota.isPersistent && (
                      <button 
                        onClick={handleRequestPersistence}
                        style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        הפעל הגנת מחיקה קבועה
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 2. Destination Picker with Waterfall Hybrid Option */}
            <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.4rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🌐</span> יעד אחסון ראשי (ברירת מחדל)
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                בחר את המיקום העיקרי שבו תרצה לשמור את המסמכים שלך.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                
                {/* 1. Cloud Storage */}
                <div 
                  onClick={() => handleSaveStorageConfig('cloud')}
                  style={{
                    border: defaultStorageTarget === 'cloud' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: defaultStorageTarget === 'cloud' ? '#eff6ff' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>☁️</span>
                    {defaultStorageTarget === 'cloud' && (
                      <span style={{ background: '#2563eb', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>פעיל</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>ענן MySpace</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    סנכרון מלא, זמין מכל מכשיר, גיבוי אוטומטי שוטף.
                  </div>
                </div>

                {/* 2. Local Storage */}
                <div 
                  onClick={() => handleSaveStorageConfig('local')}
                  style={{
                    border: defaultStorageTarget === 'local' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: defaultStorageTarget === 'local' ? '#f0fdf4' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>📱</span>
                    {defaultStorageTarget === 'local' && (
                      <span style={{ background: '#10b981', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>פעיל</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>שמירה מקומית במכשיר</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    פרטיות מרבית (תיקיית MySpace ייעודית). אפס עלויות שרת.
                  </div>
                </div>

                {/* 3. Google Drive */}
                <div 
                  onClick={() => handleSaveStorageConfig('gdrive')}
                  style={{
                    border: defaultStorageTarget === 'gdrive' ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                    background: defaultStorageTarget === 'gdrive' ? '#f5f3ff' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>📁</span>
                    {defaultStorageTarget === 'gdrive' && (
                      <span style={{ background: '#8b5cf6', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>פעיל</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Google Drive
                    <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>עסקי</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    שמירה ב-Drive האישי/העסקי שלך בתיקיית MySpace ייעודית.
                  </div>
                </div>

                {/* 4. Microsoft OneDrive */}
                <div 
                  onClick={() => handleSaveStorageConfig('onedrive' as any)}
                  style={{
                    border: (defaultStorageTarget as any) === 'onedrive' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: (defaultStorageTarget as any) === 'onedrive' ? '#f0f9ff' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>🏢</span>
                    {(defaultStorageTarget as any) === 'onedrive' && (
                      <span style={{ background: '#0284c7', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>פעיל</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Microsoft OneDrive
                    <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>Microsoft 365</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    שמירה ב-OneDrive הארגוני של מייקרוסופט.
                  </div>
                </div>

              </div>

              {/* Hybrid Waterfall Fallback Setting */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🔄</span> שילוב היברידי: מה קורה כשהמכסה הראשית מסתיימת? (Fallback Chain)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  אם מכסת ענן MySpace תסתיים, לאן להעביר אוטומטית את המסמכים הבאים כדי שלא תיתקע?
                </div>
                <select
                  value={fallbackTarget}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setFallbackTarget(val);
                    updateProfile({
                      storageConfig: {
                        defaultTarget: defaultStorageTarget,
                        spaceOverrides: spaceStorageOverrides,
                        fallbackTarget: val
                      } as any
                    });
                    setStorageSaveSuccess(true);
                    setTimeout(() => setStorageSaveSuccess(false), 3000);
                  }}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    background: '#ffffff',
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: '380px'
                  }}
                >
                  <option value="local">📱 עבור אוטומטית לשמירה בתיקיית MySpace בטלפון</option>
                  <option value="gdrive">📁 שמור ב-Google Drive האישי שלי</option>
                  <option value="onedrive">🏢 שמור ב-Microsoft OneDrive שלי</option>
                  <option value="stop">🛑 עצור והתרע לי לשדרג מנוי</option>
                </select>
              </div>
            </section>

            {/* Per-Space Custom Storage Settings */}
            <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.4rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🎯</span> התאמה אישית לפי מרחב
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                ניתן לקבוע לכל מרחב אישי יעד אחסון ספציפי (למשל: מרחב רפואי יישמר רק מקומית, בעוד מרחב הוצאות יישמר בענן).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {myActiveSpaces.map((s: any) => {
                  const currentOverride = spaceStorageOverrides[s.id] || 'default';
                  const effectiveTarget = currentOverride === 'default' ? defaultStorageTarget : currentOverride;
                  const targetLabel = effectiveTarget === 'cloud' ? 'ענן MySpace' : effectiveTarget === 'local' ? 'מקומי במכשיר' : 'Google Drive';
                  const targetBadgeColor = effectiveTarget === 'cloud' ? '#2563eb' : effectiveTarget === 'local' ? '#10b981' : '#8b5cf6';

                  return (
                    <div 
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '150px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
                          {s.logoUrl ? (
                            <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '1.2rem' }}>{s.icon || '📁'}</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>{s.title}</div>
                          <div style={{ fontSize: '0.75rem', color: targetBadgeColor, fontWeight: 700 }}>
                            פעיל: {targetLabel} {currentOverride === 'default' ? '(ברירת מחדל)' : '(החרגה אישית)'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <select
                          value={currentOverride}
                          onChange={(e) => handleSetSpaceOverride(s.id, e.target.value as any)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            background: '#ffffff',
                            color: '#334155',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="default">לפי ברירת מחדל ({defaultStorageTarget === 'cloud' ? 'ענן' : defaultStorageTarget === 'local' ? 'מקומי' : 'דרייב'})</option>
                          <option value="cloud">☁️ ענן MySpace</option>
                          <option value="local">📱 שמירה מקומית במכשיר</option>
                          <option value="gdrive">📁 Google Drive</option>
                        </select>
                      </div>
                    </div>
                  );
                })}

                {myActiveSpaces.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                    לא נמצאו מרחבים פעילים.
                  </div>
                )}
              </div>
            </section>

          </div>
        )}

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
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '24px',
        padding: '6px',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '2px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
        zIndex: 99999,
        direction: 'rtl'
      }}>
        {/* Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'profile' ? '#2563eb' : 'transparent',
            color: activeTab === 'profile' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>👤</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px' }}>פרופיל</span>
        </button>

        {/* Contacts */}
        <button
          onClick={() => setActiveTab('contacts')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'contacts' ? '#2563eb' : 'transparent',
            color: activeTab === 'contacts' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🤝</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            אנשי קשר
            {uniqueContacts.length > 0 && (
              <span style={{
                background: activeTab === 'contacts' ? 'rgba(255,255,255,0.3)' : '#e2e8f0',
                color: activeTab === 'contacts' ? '#ffffff' : '#334155',
                borderRadius: '8px',
                padding: '0 4px',
                fontSize: '0.65rem',
                fontWeight: 800
              }}>
                {uniqueContacts.length}
              </span>
            )}
          </span>
        </button>

        {/* Spaces */}
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

        {/* Storage */}
        <button
          onClick={() => setActiveTab('storage')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 2px',
            borderRadius: '18px',
            border: 'none',
            background: activeTab === 'storage' ? '#2563eb' : 'transparent',
            color: activeTab === 'storage' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🛡️</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, marginTop: '2px', whiteSpace: 'nowrap' }}>אחסון</span>
        </button>

        {/* System */}
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
          <span style={{ fontSize: '0.72rem', fontWeight: 800, marginTop: '2px' }}>מערכת</span>
        </button>
      </div>

      {showNotificationHelp && (
        <NotificationHelpModal 
          onClose={() => setShowNotificationHelp(false)} 
          onRetry={handleEnablePush} 
        />
      )}

      {/* Facebook-style Photo Source Bottom Sheet (Camera or Gallery) */}
      {showPhotoSourceSheet && (
        <div 
          onClick={() => setShowPhotoSourceSheet(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            direction: 'rtl'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              background: '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.5rem 1.25rem 2rem',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              animation: 'slideUp 0.25s ease-out'
            }}
          >
            {/* Grab handle indicator */}
            <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '999px', margin: '0 auto 0.5rem' }} />

            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                עדכון תמונת פרופיל
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                בחר כיצד תרצה להעלות את תמונת הפרופיל שלך
              </p>
            </div>

            {/* Option 1: Take Photo with Camera */}
            <button
              type="button"
              onClick={() => {
                cameraInputRef.current?.click();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.25rem',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0
              }}>
                📸
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>צילום תמונה במצלמה</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>פתח את המצלמה של המכשיר וצלם סלפי עכשיו</div>
              </div>
              <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>‹</span>
            </button>

            {/* Option 2: Choose from Gallery */}
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.25rem',
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0
              }}>
                🖼️
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>בחירה מהגלריה</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>בחר תמונה קיימת מתוך אלבום התמונות שלך</div>
              </div>
              <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>‹</span>
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => setShowPhotoSourceSheet(false)}
              style={{
                marginTop: '0.25rem',
                padding: '0.85rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                color: '#475569',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {pushSuccessMessage && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: 'white', padding: '0.85rem 1.75rem', borderRadius: '999px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(16,185,129,0.4)', zIndex: 99999 }}>
          ✓ ההתראות הופעלו בהצלחה!
        </div>
      )}
    </div>
  );
}
