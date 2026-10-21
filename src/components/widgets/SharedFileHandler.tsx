'use client';

import React, { useEffect, useState, useRef } from 'react';
import PdfThumbnail from '../shared/PdfThumbnail';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { uploadImageToStorage } from '../../lib/firebase';
import { downscaleBase64, extractPdfPages } from '../../utils/imageOptimizer';

export default function SharedFileHandler() {
  const { spaces, addInboxItems, addToPersonalInbox, setPersonalInbox, addDocument, addShelf } = useSpaces();
  const { user } = useAuth();
  
  const [clientKeys, setClientKeys] = useState<any>({});
  const [guestTokens, setGuestTokens] = useState<string[]>([]);
  const [sharedFiles, setSharedFiles] = useState<string[]>([]);
  const [sharedAllPages, setSharedAllPages] = useState<string[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [routeDestination, setRouteDestination] = useState<'direct' | 'inbox' | 'personal' | 'vault'>('personal');
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [showChromeUpdateModal, setShowChromeUpdateModal] = useState(false);
  const isCancelledRef = useRef(false);
  const router = useRouter();

  // Thorough cleanup of all share caches across browser storage
  const clearAllShareStores = () => {
    try {
      localStorage.removeItem('smartshare_latest_shared_backup');
      localStorage.removeItem('smartshare_share_checkpoints');
    } catch(e) {}

    if (typeof caches !== 'undefined') {
      try {
        caches.open('smartshare-shared-cache').then(cache => {
          cache.delete('/api/last-shared-files');
        }).catch(() => {});
      } catch(e) {}
    }

    try {
      const dbReq = indexedDB.open('MySpaceDB');
      dbReq.onsuccess = (e: any) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('sharedFiles')) {
          const tx = db.transaction('sharedFiles', 'readwrite');
          tx.objectStore('sharedFiles').delete('latest_shared');
        }
      };
    } catch(e) {}
  };

  useEffect(() => {
    try {
      const ck = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      setClientKeys(ck || {});
      const gt = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
      setGuestTokens(Array.isArray(gt) ? gt : []);
    } catch(e){}
  }, []);

  const activeSpaces = React.useMemo(() => {
    if (!spaces) return [];
    
    const filtered = spaces.filter((s: any) => {
      if (s.status === 'pending_deletion') return false;
      
      if (user?.id && s.creatorId && user.id === s.creatorId) return true;
      if (user?.spaceKeys?.[s.id]?.role === 'creator') return true;
      if (clientKeys[s.id]?.role === 'creator') return true;
      
      if (user?.spaceKeys?.[s.id]?.role === 'partner') return true;
      if (clientKeys[s.id]?.role === 'partner') return true;
      
      const partnerToken = user?.spaceKeys?.[s.id]?.token || clientKeys[s.id]?.token;
      const isMember = s.members?.some((m: any) => {
        if (user?.id && m.userId === user.id) return true;
        if (partnerToken && m.userId === partnerToken) return true;
        if (Array.isArray(guestTokens) && guestTokens.includes(m.userId)) return true;
        return false;
      });
      return isMember;
    });

    return filtered.sort((a: any, b: any) => {
      const getLatest = (space: any) => {
        let latest = new Date(space.createdAt || 0).getTime();
        
        if (space.invoices && space.invoices.length > 0) {
          const invDates = space.invoices.map((i: any) => new Date(i.createdAt || i.date || 0).getTime()).filter((t: number) => !isNaN(t));
          if (invDates.length > 0) {
            latest = Math.max(latest, ...invDates);
          }
        }
        
        if (space.inbox && space.inbox.length > 0) {
          const inboxDates = space.inbox.map((i: any) => new Date(i.createdAt || 0).getTime()).filter((t: number) => !isNaN(t));
          if (inboxDates.length > 0) {
            latest = Math.max(latest, ...inboxDates);
          }
        }
        return latest;
      };
      
      return getLatest(b) - getLatest(a);
    });
  }, [spaces, user, clientKeys, guestTokens]);

  const displayedSpaces = React.useMemo(() => {
    if (!searchQuery.trim()) return activeSpaces;
    const lowerQuery = searchQuery.toLowerCase();
    return activeSpaces.filter((s: any) => s.title?.toLowerCase().includes(lowerQuery));
  }, [activeSpaces, searchQuery]);

  const processFoundFiles = React.useCallback(async (rawResult: any, source: string) => {
    if (!rawResult || isCancelledRef.current) return;
    const files = Array.isArray(rawResult) ? rawResult : [rawResult];
    if (files.length === 0) return;

    // Immediately remove from persistent stores so interval checks never re-trigger
    clearAllShareStores();

    // Check if the single file is a PDF with multiple pages
    if (files.length === 1) {
      const firstUri = files[0];
      const isPdf = typeof firstUri === 'string' && (firstUri.startsWith('data:application/pdf') || firstUri.includes('application/pdf'));
      if (isPdf) {
        try {
          const extractedPages = await extractPdfPages(firstUri, 1500, 0.85);
          if (extractedPages && extractedPages.length > 1) {
            // Multi-page document: save pages for page-by-page review without forcing megilah
            setSharedAllPages(extractedPages);
          } else {
            setSharedAllPages(null);
          }
        } catch (pdfErr) {
          console.warn('extractPdfPages error:', pdfErr);
          setSharedAllPages(null);
        }
      } else {
        setSharedAllPages(null);
      }
    } else {
      setSharedAllPages(files);
    }

    setSharedFiles(files);
    setRouteDestination(files.length > 1 ? 'personal' : 'direct');
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const hasSharedParam = searchParams.get('shared');

    if (hasSharedParam) {
      if (hasSharedParam === 'empty') {
        setShowChromeUpdateModal(true);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkPendingFiles = async () => {
      if (isCancelledRef.current) return false;

      // 1. Check Cache Storage directly first
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open('smartshare-shared-cache');
          const match = (await cache.match('/api/last-shared-files')) || 
                        (await cache.match(new URL('/api/last-shared-files', window.location.origin).href));
          if (match) {
            const data = await match.json();
            if (data && (Array.isArray(data) ? data.length > 0 : true)) {
              await cache.delete('/api/last-shared-files');
              processFoundFiles(data, 'SW_CACHE_STORAGE');
              return true;
            }
          }
        } catch (cErr) {
          console.warn('Cache check err:', cErr);
        }
      }

      // 2. Check LocalStorage fallback
      try {
        const backup = JSON.parse(localStorage.getItem('smartshare_latest_shared_backup') || 'null');
        if (backup && (Array.isArray(backup) ? backup.length > 0 : true)) {
          localStorage.removeItem('smartshare_latest_shared_backup');
          processFoundFiles(backup, 'LOCAL_STORAGE_BACKUP');
          return true;
        }
      } catch (err) {}

      // 3. Check IndexedDB without specifying version to avoid lockups
      try {
        const req = indexedDB.open('MySpaceDB');
        req.onsuccess = (e: any) => {
          const db = e.target.result;
          if (db.objectStoreNames.contains('sharedFiles')) {
            const tx = db.transaction('sharedFiles', 'readonly');
            const store = tx.objectStore('sharedFiles');
            const getReq = store.get('latest_shared');
            getReq.onsuccess = () => {
              if (getReq.result && !isCancelledRef.current) {
                processFoundFiles(getReq.result, 'INDEXED_DB');
              }
            };
          }
        };
      } catch (idbErr) {}

      return false;
    };

    // Immediate check across storage layers
    checkPendingFiles();

    // Listen to messages from Service Worker
    const handleSwMessage = (event: MessageEvent) => {
      if (!event.data || isCancelledRef.current) return;
      if (event.data.action === 'SHARE_FILES_PAYLOAD' && event.data.files && event.data.files.length > 0) {
        processFoundFiles(event.data.files, 'SW_POST_MESSAGE');
      } else if (event.data.action === 'NEW_SHARE_RECEIVED') {
        checkPendingFiles();
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'REQUEST_PENDING_SHARE' });
      }
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) {
          reg.active.postMessage({ action: 'REQUEST_PENDING_SHARE' });
        }
      });
    }

    // Keep checking every 300ms for up to 3.5 seconds to guarantee capture in all lifecycle states
    let retries = 0;
    const interval = setInterval(async () => {
      if (isCancelledRef.current) {
        clearInterval(interval);
        return;
      }
      retries++;
      const found = await checkPendingFiles();
      if (found || retries > 12) {
        clearInterval(interval);
      }
    }, 300);

    return () => {
      clearInterval(interval);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [processFoundFiles, user, spaces, activeSpaces]);

  const currentSelectedSpace = React.useMemo(() => {
    return activeSpaces.find((s: any) => s.id === selectedSpaceId) || displayedSpaces[0] || null;
  }, [activeSpaces, displayedSpaces, selectedSpaceId]);

  const spaceHasFinance = React.useMemo(() => {
    return (currentSelectedSpace?.features || []).includes('finance');
  }, [currentSelectedSpace]);

  const spaceHasVault = React.useMemo(() => {
    const f = currentSelectedSpace?.features || [];
    return f.includes('vault') || f.includes('documents');
  }, [currentSelectedSpace]);

  useEffect(() => {
    if (isModalOpen && displayedSpaces && displayedSpaces.length > 0) {
      if (!selectedSpaceId || !displayedSpaces.find((s:any) => s.id === selectedSpaceId)) {
        const initSpace = displayedSpaces[0];
        setSelectedSpaceId(initSpace.id);
      }
    }
  }, [isModalOpen, displayedSpaces, selectedSpaceId]);

  // Automatically tune destination based on the space capabilities
  useEffect(() => {
    if (routeDestination === 'personal') return;
    if (spaceHasFinance && !spaceHasVault) {
      if (routeDestination === 'vault') setRouteDestination(sharedFiles.length > 1 ? 'inbox' : 'direct');
    } else if (!spaceHasFinance && spaceHasVault) {
      if (routeDestination === 'direct' || routeDestination === 'inbox') setRouteDestination('vault');
    }
  }, [selectedSpaceId, spaceHasFinance, spaceHasVault, routeDestination, sharedFiles.length]);

  useEffect(() => {
    if (selectedSpaceId) {
      const sp = activeSpaces.find((s: any) => s.id === selectedSpaceId);
      const sh = sp?.shelves || [];
      if (sh.length > 0) {
        if (!selectedShelfId || !sh.some((x: any) => x.id === selectedShelfId)) {
          setSelectedShelfId(sh[0].id);
        }
      } else {
        setSelectedShelfId('__new__');
      }
    }
  }, [selectedSpaceId, activeSpaces, selectedShelfId]);

  const handleProcess = async () => {
    if (routeDestination !== 'personal' && !selectedSpaceId) return;
    if (sharedFiles.length === 0) return;
    setIsProcessing(true);
    
    try {
      if (routeDestination === 'personal') {
          setUploadProgress({ current: 0, total: sharedFiles.length });
          const filesToProcess = [...sharedFiles];
          for (let i = 0; i < filesToProcess.length; i++) {
            setUploadProgress({ current: i + 1, total: filesToProcess.length });
            const cleanUri = filesToProcess[i].replace(/^"|"$/g, '');
            const compressedUri = await downscaleBase64(cleanUri, 1500, 0.85);
            const publicUrl = await uploadImageToStorage(compressedUri, 'personal_inbox/' + (user?.id || 'me') + '/' + Date.now() + '-' + Math.random().toString(36).substring(7) + '.jpg');
            await addToPersonalInbox({
              imageUrl: publicUrl,
              status: 'processing',
              suggestedPayerId: selectedPayerId || user?.id,
              uploadedBy: user?.id || 'me'
            });
          }
          
          try {
            const dbReq = indexedDB.open('MySpaceDB', 1);
            dbReq.onsuccess = (e: any) => {
              const db = e.target.result;
              if (db.objectStoreNames.contains('sharedFiles')) {
                const tx = db.transaction('sharedFiles', 'readwrite');
                tx.objectStore('sharedFiles').delete('latest_shared');
              }
            };
          } catch(e) {}
          
          setSharedFiles([]);
          setIsModalOpen(false);
          setIsProcessing(false);
          router.replace('/');
          return;
        } else if (routeDestination === 'inbox') {
        const itemsToAdd = [];
          let currentIdx = 0;
          setUploadProgress({ current: 0, total: sharedFiles.length });
          for (const dataUri of sharedFiles) {
              currentIdx++;
              setUploadProgress({ current: currentIdx, total: sharedFiles.length });
              const cleanUri = dataUri.replace(/^"|"$/g, '');
              let compressedUri = cleanUri;
              try {
                compressedUri = await downscaleBase64(cleanUri, 1500, 0.85);
              } catch (err) {
                console.error('Downscale failed', err);
              }
              const publicUrl = await uploadImageToStorage(compressedUri, 'inbox/' + selectedSpaceId + '/' + Date.now() + '-' + Math.random().toString(36).substring(7) + '.jpg');
              itemsToAdd.push({
                imageUrl: publicUrl,
                createdAt: new Date().toISOString(),
                status: 'processing' as any,
                suggestedPayerId: selectedPayerId || user?.id,
                uploadedBy: user?.id || 'me'
              });
            }
          await addInboxItems(selectedSpaceId, itemsToAdd);
        
        const request = indexedDB.open('MySpaceDB', 1);
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction('sharedFiles', 'readwrite');
          tx.objectStore('sharedFiles').delete('latest_shared');
        };
        
        setIsModalOpen(false);
        setIsProcessing(false);
        // הועבר בהצלחה
        router.push('/space/' + selectedSpaceId);
      } else if (routeDestination === 'vault') {
        let targetShelfId = selectedShelfId;
        const currentSpace = activeSpaces.find((s: any) => s.id === selectedSpaceId);
        const existingShelves = currentSpace?.shelves || [];
        
        if (!targetShelfId || targetShelfId === '__new__') {
          if (existingShelves.length > 0 && targetShelfId !== '__new__') {
            targetShelfId = existingShelves[0].id;
          } else {
            targetShelfId = addShelf(selectedSpaceId, {
              name: 'כללי',
              allowedPartners: []
            });
          }
        }

        setUploadProgress({ current: 0, total: sharedFiles.length });
        let currentIdx = 0;
        for (const dataUri of sharedFiles) {
          currentIdx++;
          setUploadProgress({ current: currentIdx, total: sharedFiles.length });
          const cleanUri = dataUri.replace(/^"|"$/g, '');
          const isPdf = cleanUri.includes('.pdf') || cleanUri.startsWith('data:application/pdf');
          const ext = isPdf ? 'pdf' : 'jpg';
          let compressedUri = cleanUri;
          if (!isPdf) {
            try {
              compressedUri = await downscaleBase64(cleanUri, 1500, 0.85);
            } catch (err) {
              console.error('Downscale failed', err);
            }
          }
          const publicUrl = await uploadImageToStorage(
            compressedUri,
            `vault/${selectedSpaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
          );
          addDocument(selectedSpaceId, {
            shelfId: targetShelfId,
            url: publicUrl,
            title: isPdf ? 'מסמך PDF ששותף' : 'מסמך ששותף',
            type: isPdf ? 'pdf' : 'document',
            addedBy: user?.id || 'me'
          });
        }

        const request = indexedDB.open('MySpaceDB', 1);
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction('sharedFiles', 'readwrite');
          tx.objectStore('sharedFiles').delete('latest_shared');
        };

        setIsModalOpen(false);
        setIsProcessing(false);
        setSharedFiles([]);
        router.push('/space/' + selectedSpaceId + '?tab=documents&shelfId=' + targetShelfId);
      } else {
        // Direct route: save primary and allPages to IndexedDB for page-by-page review
        try {
          const dbReq = indexedDB.open('MySpaceDB', 1);
          dbReq.onsuccess = (e: any) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains('sharedFiles')) {
              const tx = db.transaction('sharedFiles', 'readwrite');
              const store = tx.objectStore('sharedFiles');
              const primary = sharedFiles[0];
              const pagesPayload = sharedAllPages && sharedAllPages.length > 0 ? sharedAllPages : sharedFiles;
              store.put({ primary, allPages: pagesPayload, files: sharedFiles }, 'latest_shared');
            }
          };
        } catch(e) {}

        setIsModalOpen(false);
        setIsProcessing(false);
        router.push('/space/' + selectedSpaceId + '?addExpense=true&triggerOcr=true&payerId=' + (selectedPayerId || user?.id || 'me'));
      }
    } catch (e: any) {
        console.error(e);
        alert('שגיאה מפורטת: ' + (e.message || e.toString()));
        setIsProcessing(false);
      }
  };

  return (
    <>
      {/* Chrome Version Assistance Modal when Android Chrome drops share payload */}
      {showChromeUpdateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 100001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '20px', padding: '1.75rem',
            width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            direction: 'rtl', textAlign: 'center', border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto',
              fontSize: '1.8rem'
            }}>
              🚀
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: '800' }}>
              עדכון קל בדפדפן Chrome נדרש
            </h3>

            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              בגרסת ה-Chrome הנוכחית במכשיר שלך ישנה חסימת אבטחה של גוגל לשיתוף קבצים חיצוניים.
              <br /><br />
              <strong>גוגל כבר שחררה עדכון שפותר את זה!</strong> עדכן את כרום בלחיצה אחת, והשיתוף יעבוד מיד וחלק.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <a
                href="market://details?id=com.android.chrome"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.85rem', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff', fontWeight: 'bold', textDecoration: 'none',
                  fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                <span>🌐</span> עדכן את Google Chrome כעת
              </a>

              {/* Direct fallback to pick the shared file manually right now */}
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1',
                  background: '#f8fafc', color: '#334155', fontWeight: 'bold', cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                <span>📂</span> בחר את הקובץ ידנית בינתיים
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const fl = e.target.files;
                    if (fl && fl.length > 0) {
                      const filesArray = Array.from(fl);
                      const base64List = await Promise.all(filesArray.map((file) => {
                        return new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => resolve(reader.result as string);
                          reader.readAsDataURL(file);
                        });
                      }));
                      setShowChromeUpdateModal(false);
                      processFoundFiles(base64List, 'MANUAL_FALLBACK');
                    }
                  }}
                />
              </label>

              <button
                onClick={() => setShowChromeUpdateModal(false)}
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.25rem'
                }}
              >
                הבנתי, סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}>
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '1.5rem',
          width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          maxHeight: '90vh', overflowY: 'auto'
        }}>
          {/* Industry Banner for External Share */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
            color: '#fff', padding: '0.6rem 0.85rem', borderRadius: '10px',
            marginBottom: '1rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem', animation: 'spin 4s linear infinite' }}>🔄</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>משתף עם SmartShare <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>v6.8.20</span></div>
                <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>מנותב ל: {routeDestination === 'personal' ? 'מחסן אישי פרטי' : (displayedSpaces.find((s:any) => s.id === selectedSpaceId)?.title || 'בחר פרויקט')}</div>
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.25)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
              {sharedAllPages && sharedAllPages.length > 1 ? `${sharedAllPages.length} עמודים` : `${sharedFiles.length} ${sharedFiles.length > 1 ? 'קבצים' : 'קובץ'}`}
            </span>
          </div>

          <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#1e293b', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📄</span> בחר לאן לנתב {sharedFiles.length > 1 ? 'את המסמכים' : 'את המסמך'}
          </h2>
          
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
            הקובץ התקבל בהצלחה. בחר את היעד והמערכת תעביר אותו לשם מיד:
          </p>

          {sharedFiles.length > 0 && (
            <div style={{ marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', height: '120px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '0.5rem', padding: '0.5rem', overflowX: 'auto' }}>
              {sharedFiles.slice(0, 3).map((uri, idx) => {
                const isPdf = uri.includes('.pdf') || uri.startsWith('data:application/pdf');
                return isPdf ? (
                  <PdfThumbnail 
                    key={idx}
                    base64Uri={uri}
                    onClick={() => setZoomedIndex(idx)}
                    style={{ height: '100%', width: '80px', flexShrink: 0, objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                ) : (
                  <img 
                    key={idx} 
                    src={uri} 
                    alt="Preview" 
                    style={{ height: '100%', width: '80px', flexShrink: 0, objectFit: 'cover', cursor: 'zoom-in', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
                    onClick={() => setZoomedIndex(idx)}
                  />
                );
              })}
              {sharedFiles.length > 3 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minWidth: '80px', backgroundColor: '#e2e8f0', borderRadius: '8px', fontWeight: 'bold' }}>
                  +{sharedFiles.length - 3}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>בחר יעד ניתוב:</label>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', border: routeDestination === 'personal' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: routeDestination === 'personal' ? '#eef2ff' : '#f8fafc', borderRadius: '8px' }}>
              <input type="radio" name="routeDest" checked={routeDestination === 'personal'} onChange={() => setRouteDestination('personal')} style={{ marginTop: '0.25rem' }} />
              <div>
                <div style={{ fontWeight: 'bold', color: '#1e293b' }}>📥 למחסן מיון אישי (פרטי)</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>רק אתה רואה את זה. שומר מיד במחסן שלך ומאפשר למיין לפרויקטים אחר כך.</div>
              </div>
            </label>

            {spaceHasFinance && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', border: routeDestination === 'direct' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: routeDestination === 'direct' ? '#eef2ff' : '#f8fafc', borderRadius: '8px', opacity: sharedFiles.length > 1 ? 0.5 : 1 }}>
                <input type="radio" name="routeDest" checked={routeDestination === 'direct'} disabled={sharedFiles.length > 1} onChange={() => setRouteDestination('direct')} style={{ marginTop: '0.25rem' }} />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>🧾 להוצאות הפרויקט + סריקת AI מיידית {sharedFiles.length > 1 ? '(קובץ בודד)' : ''}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>פותח ישירות את טופס ההוצאה ומפעיל סריקת AI מהירה תוך 2-3 שניות.</div>
                </div>
              </label>
            )}

            {spaceHasFinance && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', border: routeDestination === 'inbox' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: routeDestination === 'inbox' ? '#eef2ff' : '#f8fafc', borderRadius: '8px' }}>
                <input type="radio" name="routeDest" checked={routeDestination === 'inbox'} onChange={() => setRouteDestination('inbox')} style={{ marginTop: '0.25rem' }} />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>📥 למחסן ההמתנה של הפרויקט</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>נכנס למחסן המשותף של הפרויקט כדי שכל השותפים יוכלו לראות ולטפל.</div>
                </div>
              </label>
            )}

            {spaceHasVault && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', border: routeDestination === 'vault' ? '2px solid #4f46e5' : '2px solid transparent', backgroundColor: routeDestination === 'vault' ? '#eef2ff' : '#f8fafc', borderRadius: '8px' }}>
                <input type="radio" name="routeDest" checked={routeDestination === 'vault'} onChange={() => setRouteDestination('vault')} style={{ marginTop: '0.25rem' }} />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1e293b' }}>🗂️ למחסן מסמכים (מדף בפרויקט)</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>שומר מסמך/חוזה ישירות לתוך מדף במחסן המסמכים ללא פתיחת הוצאה.</div>
                </div>
              </label>
            )}
          </div>

          {routeDestination !== 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>מרחב עבודה (פרויקט):</label>
              
              {activeSpaces.length > 5 && (
                <input 
                  type="text" 
                  placeholder="חיפוש מרחב..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', marginBottom: '0.25rem' }}
                />
              )}

              <select 
                value={selectedSpaceId} 
                onChange={e => setSelectedSpaceId(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#f8fafc' }}
              >
                {displayedSpaces.length === 0 && <option value="">לא נמצאו מרחבים תואמים</option>}
                {displayedSpaces.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}


            {routeDestination === 'vault' && selectedSpaceId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>בחר מדף יעד במחסן המסמכים:</label>
                <select 
                  value={selectedShelfId} 
                  onChange={e => setSelectedShelfId(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#f8fafc' }}
                >
                  {(activeSpaces.find((s: any) => s.id === selectedSpaceId)?.shelves || []).map((sh: any) => (
                    <option key={sh.id} value={sh.id}>{sh.icon || '📁'} {sh.name}</option>
                  ))}
                  <option value="__new__">+ צור מדף חדש בשם &quot;כללי&quot;</option>
                </select>
              </div>
            )}

            {routeDestination !== 'personal' && routeDestination !== 'vault' && selectedSpaceId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' }}>מי שילם בפועל? (רשות):</label>
                <select 
                  value={selectedPayerId} 
                  onChange={e => setSelectedPayerId(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#f8fafc' }}
                >
                  <option value="">אני ({user?.realName || 'ברירת מחדל'})</option>
                  {(displayedSpaces.find((s: any) => s.id === selectedSpaceId)?.members || []).map((m: any) => (
                    <option key={m.userId} value={m.userId}>{m.name || 'שותף'}</option>
                  ))}
                </select>
              </div>
            )}


          <div style={{ display: 'flex', gap: '0.75rem', marginTop: routeDestination === 'personal' ? '1rem' : 0 }}>
            <button 
              onClick={() => { 
                isCancelledRef.current = true;
                setIsModalOpen(false); 
                setSharedFiles([]);
                setSharedAllPages(null);
                clearAllShareStores();
              }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ביטול
            </button>
            <button 
              onClick={handleProcess}
              disabled={(routeDestination !== 'personal' && !selectedSpaceId) || isProcessing}
              style={{ flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
            >
              {isProcessing 
                ? 'מעביר נתונים...' 
                : routeDestination === 'personal'
                  ? '📥 שמור במחסן האישי'
                  : routeDestination === 'direct'
                    ? '🧾 פתח הוצאה והפעל סריקה ⚡'
                    : routeDestination === 'vault'
                      ? '🗂️ שמור במחסן מסמכים'
                      : '📥 העבר למחסן הפרויקט'}
            </button>
          </div>
        </div>
      </div>
      )}
      
      {zoomedIndex !== null && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onTouchStart={e => setTouchStartX(e.changedTouches[0].screenX)}
          onTouchEnd={e => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50 && zoomedIndex < sharedFiles.length - 1) setZoomedIndex(zoomedIndex + 1);
            if (touchEndX - touchStartX > 50 && zoomedIndex > 0) setZoomedIndex(zoomedIndex - 1);
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sharedFiles[zoomedIndex]?.includes('.pdf') || sharedFiles[zoomedIndex]?.startsWith('data:application/pdf') ? (
               <PdfThumbnail 
                 base64Uri={sharedFiles[zoomedIndex]}
                 style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
               />
            ) : (
               <img src={sharedFiles[zoomedIndex]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            )}
            {zoomedIndex > 0 && (
              <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex - 1); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                &gt;
              </div>
            )}
            {zoomedIndex < sharedFiles.length - 1 && (
              <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex + 1); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                &lt;
              </div>
            )}
          </div>
          <div style={{ color: 'white', marginTop: '1rem', fontSize: '1.2rem', fontWeight: 'bold', direction: 'rtl' }}>
            {zoomedIndex + 1} מתוך {sharedFiles.length}
          </div>
          <div 
            onClick={() => setZoomedIndex(null)}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            סגור תצוגה
          </div>
        </div>
      )}
    </>
  );
}
