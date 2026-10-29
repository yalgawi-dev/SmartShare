'use client';
import NotificationHelpModal from '../../components/common/NotificationHelpModal';
import { useState, useRef, useEffect, useMemo } from 'react';

import { auth } from '@/lib/firebase';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission } from '../../utils/notifications';
import { useSpaces } from '../context/SpacesContext';
import Link from 'next/link';
import { sortSpacesByUsagePriority } from '../../utils/spaceSorting';
import { getDeviceStorageEstimate, requestPersistentStorage, LocalStorageQuota, listLocalDeviceFiles, getLocalDeviceFileBlob, deleteLocalDeviceFile, LocalDeviceItem } from '../../utils/localDeviceStorage';
import { getSharedContactsForUser } from '../../utils/partnerUtils';
import { compressImageWebP } from '../../utils/imageOptimizer';
import { calculateUserStorageDetails } from '../../utils/userStorageCalculator';
import UniversalViewerModal from '../../components/common/ViewerEngine/UniversalViewerModal';

export default function SettingsPage() {
  const { user, allUsers, updateProfile, logout, deleteMyAccount } = useAuth();
  const { spaces, restoreSpace, permanentlyDeleteSpace, removeMember } = useSpaces() as any;
  
  const [activeTab, setActiveTab] = useState<'profile' | 'contacts' | 'spaces' | 'storage' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'profile' || t === 'contacts' || t === 'spaces' || t === 'storage' || t === 'system') {
        return t;
      }
    }
    return 'profile';
  });
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
  const [showStorageIntroCard, setShowStorageIntroCard] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('myspace_hide_storage_intro') !== 'true';
    }
    return true;
  });
  const [isLocalExplorerOpen, setIsLocalExplorerOpen] = useState(false);
  const [localDeviceFiles, setLocalDeviceFiles] = useState<LocalDeviceItem[]>([]);
  const [isLoadingLocalFiles, setIsLoadingLocalFiles] = useState(false);
  const [currentLocalPath, setCurrentLocalPath] = useState<string>('root'); // 'root' or spaceName
  const [localExplorerViewMode, setLocalExplorerViewMode] = useState<'grid_large' | 'grid_medium' | 'list'>('grid_medium');
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('');
  const [localViewerItem, setLocalViewerItem] = useState<{ docs: any[]; index: number } | null>(null);

  // Calculate user-initiated cloud storage strictly from user's files and documents (DRY)
  const userStorage = useMemo(() => {
    return calculateUserStorageDetails(user, spaces);
  }, [user, spaces]);

  useEffect(() => {
    getDeviceStorageEstimate().then(setDeviceQuota);
    listLocalDeviceFiles().then(setLocalDeviceFiles);
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
  // Helper to render files in list, medium grid, or large grid view (DRY Windows/Mac Explorer)
  const renderFilesView = (files: LocalDeviceItem[], mode: 'grid_large' | 'grid_medium' | 'list') => {
    if (mode === 'list') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 90px 75px 65px',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.6rem',
            background: '#f1f5f9',
            borderRadius: '8px',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#475569'
          }}>
            <span>תצוגה</span>
            <span>שם הקובץ</span>
            <span>מרחב</span>
            <span>גודל</span>
            <span style={{ textAlign: 'center' }}>פעולות</span>
          </div>

          {files.map((file, idx) => (
            <div
              key={file.path || idx}
              onClick={async () => {
                const blob = await getLocalDeviceFileBlob(file.spaceName, file.fileName);
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  setLocalViewerItem({
                    docs: [{
                      id: file.path,
                      title: file.fileName,
                      url,
                      type: file.type || (file.fileName.endsWith('.pdf') ? 'pdf' : 'image'),
                      storageTarget: 'local'
                    }],
                    index: 0
                  });
                }
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 90px 75px 65px',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.6rem',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              {/* Thumbnail / Icon */}
              <div style={{ width: '36px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '1.2rem' }}>{file.type === 'pdf' ? '📑' : '📄'}</span>
                )}
              </div>

              {/* File Name */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.fileName}
                </div>
              </div>

              {/* Space Name */}
              <div style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                📁 {file.spaceName}
              </div>

              {/* Size */}
              <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                {file.sizeMB} MB
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  title="הורד קובץ"
                  onClick={async () => {
                    const blob = await getLocalDeviceFileBlob(file.spaceName, file.fileName);
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.fileName;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }
                  }}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 5px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  ⬇️
                </button>
                <button
                  type="button"
                  title="מחק קובץ"
                  onClick={async () => {
                    if (confirm(`האם למחוק את הקובץ "${file.fileName}"?`)) {
                      await deleteLocalDeviceFile(file.spaceName, file.fileName);
                      const refreshed = await listLocalDeviceFiles();
                      setLocalDeviceFiles(refreshed);
                    }
                  }}
                  style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', padding: '2px 5px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Grid Views (Medium: 130px minmax / Large: 180px minmax)
    const minCardWidth = mode === 'grid_large' ? '170px' : '120px';
    const thumbHeight = mode === 'grid_large' ? '140px' : '95px';

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`, gap: '0.65rem' }}>
        {files.map((file, idx) => (
          <div
            key={file.path || idx}
            onClick={async () => {
              const blob = await getLocalDeviceFileBlob(file.spaceName, file.fileName);
              if (blob) {
                const url = URL.createObjectURL(blob);
                setLocalViewerItem({
                  docs: [{
                    id: file.path,
                    title: file.fileName,
                    url,
                    type: file.type || (file.fileName.endsWith('.pdf') ? 'pdf' : 'image'),
                    storageTarget: 'local'
                  }],
                  index: 0
                });
              }
            }}
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            {/* Live Image Thumbnail Preview */}
            <div style={{
              height: thumbHeight,
              background: '#f1f5f9',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {file.previewUrl ? (
                <img src={file.previewUrl} alt={file.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: '#64748b' }}>
                  <span style={{ fontSize: mode === 'grid_large' ? '2.5rem' : '1.8rem' }}>{file.type === 'pdf' ? '📑' : '📄'}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{file.type === 'pdf' ? 'PDF' : 'קובץ'}</span>
                </div>
              )}

              {/* Size Badge */}
              <div style={{
                position: 'absolute',
                bottom: '4px',
                left: '4px',
                background: 'rgba(16, 185, 129, 0.9)',
                color: 'white',
                padding: '1px 5px',
                borderRadius: '5px',
                fontSize: '0.62rem',
                fontWeight: 700
              }}>
                {file.sizeMB} MB
              </div>

              {/* Space badge if searching */}
              {localSearchQuery && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: 'white',
                  padding: '1px 5px',
                  borderRadius: '5px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  maxWidth: '90px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.spaceName}
                </div>
              )}
            </div>

            {/* File Details & Actions */}
            <div style={{ padding: '0.45rem 0.55rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{
                fontWeight: 800,
                fontSize: '0.78rem',
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {file.fileName}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700 }}>
                  👁️ צפה
                </span>

                <div style={{ display: 'flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="הורד קובץ"
                    onClick={async () => {
                      const blob = await getLocalDeviceFileBlob(file.spaceName, file.fileName);
                      if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.fileName;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }
                    }}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '1px 4px', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    ⬇️
                  </button>

                  <button
                    type="button"
                    title="מחק קובץ"
                    onClick={async () => {
                      if (confirm(`האם למחוק את הקובץ "${file.fileName}"?`)) {
                        await deleteLocalDeviceFile(file.spaceName, file.fileName);
                        const refreshed = await listLocalDeviceFiles();
                        setLocalDeviceFiles(refreshed);
                      }
                    }}
                    style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '5px', padding: '1px 4px', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const [spacesSubTab, setSpacesSubTab] = useState<'active' | 'archived'>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('sub');
      if (s === 'archived' || s === 'active') {
        return s;
      }
    }
    return 'active';
  });
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

      // Restore exact scroll position / card position if spaceId is specified
      const targetSpace = new URLSearchParams(window.location.search).get('targetSpace');
      if (targetSpace) {
        setTimeout(() => {
          const el = document.getElementById(`space-card-${targetSpace}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.outline = '3px solid #f59e0b';
            setTimeout(() => { el.style.outline = 'none'; }, 2500);
          }
        }, 300);
      }
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
          <span style={{ fontSize: '0.7rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>v3.3.59</span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>{realName || user.id}</h3>
                    {user.isAdmin && (
                      <Link 
                        href="/admin/users"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textDecoration: 'none'
                        }}
                        title="כניסה למרכז הבקרה"
                      >
                        🛡️ מנהל מערכת (ניהול)
                      </Link>
                    )}
                  </div>
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
                                href={'/space/' + s.id + '?from=settings_active'} 
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
                  {myArchivedSpaces.map((s: any) => {
                    const isActualCreator = s.creatorId === user?.id || s.createdBy === user?.realName;
                    const canManageArchive = isActualCreator;
                    const creatorName = s.createdBy || (s.creatorId && allUsers?.find((u: any) => u.id === s.creatorId)?.realName) || 'לא צוין';
                    const deletedByName = s.deletedByName || (s.deletedBy && allUsers?.find((u: any) => u.id === s.deletedBy)?.realName) || (isActualCreator ? 'מנהל המרחב' : 'אחד השותפים');

                    return (
                      <div id={`space-card-${s.id}`} key={s.id} style={{ border: '1px solid #fed7aa', background: '#fffbeb', padding: '1rem 1.15rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef3c7', border: '1px solid #fde68a' }}>
                              {s.logoUrl ? (
                                <img src={s.logoUrl} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <span style={{ fontSize: '1.3rem' }}>{s.icon || '🗄️'}</span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>{s.title}</span>
                                <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: '#fef3c7', color: '#b45309', borderRadius: '6px', border: '1px solid #fde68a', fontWeight: 700 }}>ארכיון</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '4px', fontSize: '0.8rem', color: '#78350f' }}>
                                <span>👤 <strong>נוצר ע״י:</strong> {creatorName}</span>
                                <span>🗑️ <strong>הועבר לארכיון ע״י:</strong> {deletedByName}</span>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '3px' }}>
                                ⏳ נמחק סופית ב: {new Date(s.deletionScheduledFor || Date.now() + 14 * 86400000).toLocaleDateString('he-IL')} (סל מחזור 14 יום)
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Toolbar */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed #fed7aa' }}>
                          {/* Peek / Preview into Space */}
                          <Link 
                            href={`/space/${s.id}?from=settings_archived`}
                            style={{ 
                              padding: '0.45rem 0.9rem', 
                              background: '#ffffff', 
                              color: '#4338ca', 
                              border: '1px solid #c7d2fe', 
                              borderRadius: '10px', 
                              textDecoration: 'none', 
                              fontWeight: 700, 
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                          >
                            👁️ הצץ במרחב
                          </Link>

                          {canManageArchive ? (
                            <>
                              <button 
                                onClick={() => restoreSpace(s.id)}
                                style={{ padding: '0.45rem 0.9rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                ↩️ שחזר מרחב
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm('האם למחוק לצמיתות את "' + s.title + '"? הפעולה בלתי הפיכה ותמחק את כל נתוני המרחב!')) {
                                    await permanentlyDeleteSpace(s.id);
                                  }
                                }}
                                style={{ padding: '0.45rem 0.9rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                🗑️ מחק סופית
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={async () => {
                                if (confirm(`להסיר את המרחב "${s.title}" מרשימת המרחבים שלך? (המרחב לא יימחק לצמיתות מהיוצר, רק יוסר מחשבונך)`)) {
                                  const myMember = (s.members || []).find((m: any) => m.userId === user?.id || (m.phone && m.phone === user?.phone));
                                  if (myMember) {
                                    await removeMember(s.id, myMember.userId);
                                  } else {
                                    alert('המרחב הוסר מחשבונך.');
                                  }
                                }
                              }}
                              style={{ padding: '0.45rem 0.9rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              🚪 הסר מהרשימה שלי
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
            
            {/* Header / Intro Card - Dismissable at Top */}
            {showStorageIntroCard && (
              <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', borderRadius: '18px', padding: '1rem 1.25rem', boxShadow: '0 6px 20px rgba(15,23,42,0.12)', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStorageIntroCard(false);
                    try {
                      localStorage.setItem('myspace_hide_storage_intro', 'true');
                    } catch (e) {}
                  }}
                  title="סגור הודעה זו"
                  style={{
                    position: 'absolute',
                    top: '0.85rem',
                    left: '0.85rem',
                    background: 'rgba(255,255,255,0.18)',
                    border: 'none',
                    color: 'white',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                >
                  ✕
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', paddingLeft: '2rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>אחסון ופרטיות ב-MySpace</h2>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.88, lineHeight: '1.5', paddingLeft: '2rem' }}>
                  שליטה מלאה ועצמאית במיקום שמירת המסמכים שלך. בחר היכן נשמר המידע שלך – בענן MySpace, ישירות על הטלפון שלך לפרטיות מרבית, או ב-Google Drive האישי שלך.
                </p>
              </div>
            )}

            {storageSaveSuccess && (
              <div style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>✓</span> הגדרות האחסון עודכנו ונשמרו בהצלחה!
              </div>
            )}

            {/* Destination Picker with In-Card Status */}
            <section style={{ background: '#ffffff', borderRadius: '20px', padding: '1.4rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🌐</span> יעד אחסון ראשי (ברירת מחדל)
              </h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                בחר את המיקום העיקרי שבו תרצה לשמור את המסמכים שלך. הסטטוס מתעדכן בזמן אמת לפי מה ששמרת בפועל:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                
                {/* 1. Cloud Storage */}
                <div 
                  onClick={() => handleSaveStorageConfig('cloud')}
                  style={{
                    border: defaultStorageTarget === 'cloud' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: defaultStorageTarget === 'cloud' ? '#eff6ff' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>☁️</span>
                      {defaultStorageTarget === 'cloud' && (
                        <span style={{ background: '#2563eb', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>פעיל</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>ענן MySpace</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                      סנכרון מלא, זמין מכל מכשיר, גיבוי אוטומטי שוטף.
                    </div>
                  </div>

                  {/* Contextual Cloud Usage Status */}
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px dashed #bfdbfe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      <span style={{ color: '#1e3a8a' }}>
                        {userStorage.quotaMode === 'pages' ? 'עמודי מסמכים בשימוש:' : 'שטח ענן אישי בשימוש:'}
                      </span>
                      <span style={{ color: '#2563eb' }}>
                        {userStorage.isQuotaActive ? (
                          userStorage.quotaMode === 'pages' 
                            ? `${userStorage.myPagesCount} מתוך ${userStorage.pagesQuota} עמודים` 
                            : `${userStorage.mb} MB מתוך ${userStorage.formattedQuota}`
                        ) : (
                          userStorage.quotaMode === 'pages'
                            ? `${userStorage.myPagesCount} עמודים`
                            : `${userStorage.mb} MB`
                        )}
                      </span>
                    </div>

                    {/* Progress Bar (Only visible when Quota is active!) */}
                    {userStorage.isQuotaActive && (
                      <div style={{ width: '100%', height: '7px', background: '#dbeafe', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.45rem' }}>
                        <div 
                          style={{ 
                            width: `${Math.max(userStorage.percentUsed, (userStorage.quotaMode === 'pages' ? userStorage.myPagesCount > 0 : userStorage.bytes > 0) ? 2 : 0)}%`, 
                            height: '100%', 
                            background: userStorage.percentUsed > 90 ? '#ef4444' : '#2563eb', 
                            borderRadius: '999px',
                            transition: 'width 0.3s ease'
                          }} 
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', marginTop: userStorage.isQuotaActive ? 0 : '0.2rem' }}>
                      <span>
                        {userStorage.quotaMode === 'pages'
                          ? `📄 ${userStorage.myDocsCount} מסמכים (${userStorage.myPagesCount} עמודים שנספרו)`
                          : `📄 ${userStorage.totalItemsCount} קבצים שנשמרו`}
                      </span>
                      <span>
                        {userStorage.isQuotaActive 
                          ? `🔍 סריקות OCR: ${userStorage.ocrCount}/${userStorage.ocrQuota}`
                          : `🔍 סריקות OCR שבוצעו: ${userStorage.ocrCount}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Local Storage */}
                <div 
                  onClick={() => handleSaveStorageConfig('local')}
                  style={{
                    border: defaultStorageTarget === 'local' ? '2px solid #10b981' : '1px solid #cbd5e1',
                    background: defaultStorageTarget === 'local' ? '#f0fdf4' : '#f8fafc',
                    borderRadius: '16px',
                    padding: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>📱</span>
                      {defaultStorageTarget === 'local' && (
                        <span style={{ background: '#10b981', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>פעיל</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>שמירה מקומית במכשיר</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                      פרטיות מרבית (תיקיית MySpace ייעודית). אפס עלויות שרת.
                    </div>
                  </div>

                  {/* Contextual Local Folder Details & Device Storage Graph */}
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px dashed #a7f3d0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>📂 MySpace/[שם המרחב]/</span>
                      <span>{localDeviceFiles.length} קבצים בטלפון ({localDeviceFiles.reduce((acc, f) => acc + f.sizeMB, 0).toFixed(2)} MB)</span>
                    </div>

                    {/* Total Device Storage Graph */}
                    {deviceQuota && (
                      <div style={{ background: 'rgba(255,255,255,0.7)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                          <span style={{ color: '#065f46' }}>זיכרון כולל בטלפון:</span>
                          <span style={{ color: '#047857', direction: 'rtl' }}>
                            {deviceQuota.usageMB} MB מתוך {deviceQuota.quotaMB > 0 ? `${(deviceQuota.quotaMB / 1024).toFixed(1)} GB זמין` : 'שטח פנוי'}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: '#d1fae5', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(deviceQuota.percentUsed, 1)}%`, height: '100%', background: '#10b981', borderRadius: '999px' }} />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setIsLoadingLocalFiles(true);
                        setIsLocalExplorerOpen(true);
                        const files = await listLocalDeviceFiles();
                        setLocalDeviceFiles(files);
                        setIsLoadingLocalFiles(false);
                      }}
                      style={{
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '9px',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
                      }}
                    >
                      <span>📂</span> פתח את תיקיית MySpace המקומית
                    </button>
                  </div>
                </div>

                {/* 3. Google Drive */}
                <div 
                  onClick={() => alert('חיבור ישיר ל-Google Drive נמצא כעת בפיתוח! בקרוב תוכל להתחבר בקליק אחד עם חשבון הגוגל שלך לשמירה ישירה.')}
                  style={{
                    border: '1px dashed #cbd5e1',
                    background: '#f8fafc',
                    borderRadius: '16px',
                    padding: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    opacity: 0.85
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>📁</span>
                    <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>🚧 בפיתוח</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Google Drive
                    <span style={{ fontSize: '0.65rem', background: '#e2e8f0', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>בקרוב</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    חיבור ישיר בקליק אחד לחשבון הגוגל האישי/עסקי שלך ושמירה אוטומטית בתיקייה ייעודית.
                  </div>
                </div>

                {/* 4. Microsoft OneDrive */}
                <div 
                  onClick={() => alert('חיבור ל-Microsoft OneDrive נמצא כעת בפיתוח!')}
                  style={{
                    border: '1px dashed #cbd5e1',
                    background: '#f8fafc',
                    borderRadius: '16px',
                    padding: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    opacity: 0.85
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>🏢</span>
                    <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>🚧 בפיתוח</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    Microsoft OneDrive
                    <span style={{ fontSize: '0.65rem', background: '#e2e8f0', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>בקרוב</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: '1.4' }}>
                    סנכרון ארגוני ישיר לחשבון Microsoft 365 של המשתמש.
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
                  <option value="gdrive" disabled>📁 שמור ב-Google Drive האישי שלי (בפיתוח)</option>
                  <option value="onedrive" disabled>🏢 שמור ב-Microsoft OneDrive שלי (בפיתוח)</option>
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
                          <option value="gdrive" disabled>📁 Google Drive (בפיתוח)</option>
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

      {/* Local Device Files Explorer Modal */}
      {isLocalExplorerOpen && (
        <div 
          onClick={() => setIsLocalExplorerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: 'rtl'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              height: '88vh',
              maxHeight: '780px',
              background: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Explorer Window Titlebar */}
            <div style={{ 
              padding: '0.85rem 1.25rem', 
              borderBottom: '1px solid #e2e8f0', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: '#0f172a',
              color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.25rem' }}>💻</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.2px' }}>
                    סייר הקבצים של MySpace במכשיר
                  </h3>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    אחסון מקומי פרטי ומאובטח (OPFS) • זיכרון פנימי
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  type="button"
                  onClick={async () => {
                    setIsLoadingLocalFiles(true);
                    const list = await listLocalDeviceFiles();
                    setLocalDeviceFiles(list);
                    setIsLoadingLocalFiles(false);
                  }}
                  title="רענן קבצים"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#e2e8f0',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem'
                  }}
                >
                  🔄
                </button>
                <button 
                  onClick={() => setIsLocalExplorerOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#e2e8f0'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Windows Address Bar / Breadcrumbs & Navigation Toolbar */}
            <div style={{
              padding: '0.55rem 0.9rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {/* Row 1: Back/Up Buttons & Breadcrumb Address Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Back / Up to Root Button */}
                <button
                  type="button"
                  disabled={currentLocalPath === 'root'}
                  onClick={() => setCurrentLocalPath('root')}
                  title="עלה לתיקיית השורש MySpace"
                  style={{
                    background: currentLocalPath === 'root' ? '#f1f5f9' : '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: currentLocalPath === 'root' ? '#94a3b8' : '#0f172a',
                    borderRadius: '8px',
                    padding: '4px 9px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: currentLocalPath === 'root' ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: currentLocalPath === 'root' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <span>⬆️</span>
                  <span style={{ fontSize: '0.75rem' }}>למעלה</span>
                </button>

                {/* Windows-style Address Bar (Breadcrumbs) */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  gap: '6px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                }}>
                  <button
                    type="button"
                    onClick={() => setCurrentLocalPath('root')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: currentLocalPath === 'root' ? '#0f172a' : '#2563eb',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🏠</span>
                    <span>MySpace</span>
                  </button>

                  {currentLocalPath !== 'root' && (
                    <>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>❯</span>
                      <span style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>📁</span>
                        <span>{currentLocalPath}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Search Input & View Mode Toggles (Large / Medium / List) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
                {/* Search Bar */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    placeholder="🔍 חפש קובץ או מרחב..."
                    style={{
                      width: '100%',
                      padding: '5px 28px 5px 8px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      background: '#ffffff',
                      outline: 'none'
                    }}
                  />
                  {localSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLocalSearchQuery('')}
                      style={{
                        position: 'absolute',
                        left: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* View Mode Switcher (כמו ב-Windows) */}
                <div style={{
                  display: 'flex',
                  background: '#e2e8f0',
                  borderRadius: '8px',
                  padding: '2px',
                  gap: '2px'
                }}>
                  <button
                    type="button"
                    onClick={() => setLocalExplorerViewMode('list')}
                    title="תצוגת רשימה (List)"
                    style={{
                      border: 'none',
                      background: localExplorerViewMode === 'list' ? '#ffffff' : 'transparent',
                      color: localExplorerViewMode === 'list' ? '#0f172a' : '#64748b',
                      fontWeight: localExplorerViewMode === 'list' ? 800 : 500,
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: localExplorerViewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <span>☰</span>
                    <span style={{ display: 'none' }}>רשימה</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalExplorerViewMode('grid_medium')}
                    title="קלפים בינוניים (Medium Icons)"
                    style={{
                      border: 'none',
                      background: localExplorerViewMode === 'grid_medium' ? '#ffffff' : 'transparent',
                      color: localExplorerViewMode === 'grid_medium' ? '#0f172a' : '#64748b',
                      fontWeight: localExplorerViewMode === 'grid_medium' ? 800 : 500,
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: localExplorerViewMode === 'grid_medium' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <span>▦</span>
                    <span style={{ display: 'none' }}>בינוני</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalExplorerViewMode('grid_large')}
                    title="קלפים גדולים (Large Icons)"
                    style={{
                      border: 'none',
                      background: localExplorerViewMode === 'grid_large' ? '#ffffff' : 'transparent',
                      color: localExplorerViewMode === 'grid_large' ? '#0f172a' : '#64748b',
                      fontWeight: localExplorerViewMode === 'grid_large' ? 800 : 500,
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: localExplorerViewMode === 'grid_large' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <span>☷</span>
                    <span style={{ display: 'none' }}>גדול</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Explorer Canvas / Folder & Files Content */}
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#fdfdfd' }}>
              {isLoadingLocalFiles ? (
                <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem', animation: 'spin 1s linear infinite' }}>⏳</div>
                  <div>סורק את תיקיית המכשיר...</div>
                </div>
              ) : localDeviceFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
                  <div style={{ fontWeight: 800, color: '#334155', fontSize: '1rem' }}>תיקיית MySpace במכשיר ריקה</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem', lineHeight: '1.5' }}>
                    כאשר תסרוק או תעלה מסמך כשיעד האחסון מוגדר "שמירה מקומית", הקובץ יישמר כאן אוטומטית לפי תיקיית המרחב.
                  </div>
                </div>
              ) : (() => {
                // Group all files by spaceName
                const spacesMap: Record<string, LocalDeviceItem[]> = {};
                localDeviceFiles.forEach(f => {
                  if (!spacesMap[f.spaceName]) spacesMap[f.spaceName] = [];
                  spacesMap[f.spaceName].push(f);
                });
                const spaceNames = Object.keys(spacesMap);

                // Filter files by search query if present
                const query = localSearchQuery.trim().toLowerCase();

                // If searching, show all matched files across spaces
                if (query) {
                  const filteredFiles = localDeviceFiles.filter(f => 
                    f.fileName.toLowerCase().includes(query) || 
                    f.spaceName.toLowerCase().includes(query)
                  );

                  if (filteredFiles.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '0.85rem' }}>
                        לא נמצאו קבצים התואמים לחיפוש "{localSearchQuery}".
                      </div>
                    );
                  }

                  return renderFilesView(filteredFiles, localExplorerViewMode);
                }

                // If at Root Level: Show Folder Icons for each Space
                if (currentLocalPath === 'root') {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>📂</span>
                        <span>תיקיות מרחבים ({spaceNames.length}):</span>
                      </div>

                      {/* Windows Folder Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: localExplorerViewMode === 'list' 
                          ? '1fr' 
                          : 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '0.75rem'
                      }}>
                        {spaceNames.map(sName => {
                          const filesInSpace = spacesMap[sName];
                          const totalSpaceMB = filesInSpace.reduce((acc, f) => acc + (f.sizeMB || 0), 0).toFixed(1);

                          if (localExplorerViewMode === 'list') {
                            return (
                              <div
                                key={sName}
                                onClick={() => setCurrentLocalPath(sName)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.65rem 0.85rem',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                                  <span style={{ fontSize: '1.5rem' }}>📁</span>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {sName}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                      {filesInSpace.length} קבצים • {totalSpaceMB} MB
                                    </div>
                                  </div>
                                </div>
                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>❯</span>
                              </div>
                            );
                          }

                          // Folder Card (Windows / Mac Style)
                          return (
                            <div
                              key={sName}
                              onClick={() => setCurrentLocalPath(sName)}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '1rem 0.5rem',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                                textAlign: 'center',
                                gap: '0.4rem'
                              }}
                            >
                              <div style={{ position: 'relative' }}>
                                <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 4px 6px rgba(245,158,11,0.25))' }}>📁</span>
                                <span style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  right: '-4px',
                                  background: '#2563eb',
                                  color: 'white',
                                  borderRadius: '999px',
                                  padding: '1px 5px',
                                  fontSize: '0.65rem',
                                  fontWeight: 800
                                }}>
                                  {filesInSpace.length}
                                </span>
                              </div>
                              <div style={{
                                fontWeight: 800,
                                fontSize: '0.82rem',
                                color: '#0f172a',
                                width: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                padding: '0 4px'
                              }}>
                                {sName}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                {totalSpaceMB} MB
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Inside a Space Folder
                const filesInCurrentFolder = spacesMap[currentLocalPath] || [];

                if (filesInCurrentFolder.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                      אין קבצים בתיקייה זו.
                    </div>
                  );
                }

                return renderFilesView(filesInCurrentFolder, localExplorerViewMode);
              })()}
            </div>

            {/* Modal Footer (Status Bar - Windows Explorer Style) */}
            <div style={{
              padding: '0.65rem 1.1rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.78rem',
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>
                  {currentLocalPath === 'root' ? 'כל התיקיות' : currentLocalPath}:
                </span>
                <span>
                  {currentLocalPath === 'root' 
                    ? `${localDeviceFiles.length} קבצים סה״כ` 
                    : `${(localDeviceFiles.filter(f => f.spaceName === currentLocalPath)).length} קבצים`}
                </span>
              </div>

              <button 
                type="button"
                onClick={() => setIsLocalExplorerOpen(false)}
                style={{
                  background: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem 1.1rem',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Local Document Viewer (Universal Viewer) */}
      {localViewerItem && (
        <UniversalViewerModal
          docs={localViewerItem.docs}
          initialIndex={localViewerItem.index}
          onClose={() => setLocalViewerItem(null)}
          onDownload={(url, title) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = title || 'document';
            a.click();
          }}
        />
      )}

      {pushSuccessMessage && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: 'white', padding: '0.85rem 1.75rem', borderRadius: '999px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(16,185,129,0.4)', zIndex: 99999 }}>
          ✓ ההתראות הופעלו בהצלחה!
        </div>
      )}
    </div>
  );
}
