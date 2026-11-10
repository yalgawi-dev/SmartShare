'use client';

import React, { useEffect, useState, useRef } from 'react';
import PdfThumbnail from '../shared/PdfThumbnail';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { uploadImageToStorage, uploadBlobToStorage } from '../../lib/firebase';
import { downscaleBase64, extractPdfPages, analyzePdfStructure, isTrueOriginalPdf } from '../../utils/imageOptimizer';
import { saveLocalDeviceFile } from '../../utils/localDeviceStorage';
import InvoiceAttachMatchModal, { ScannedReceiptInput } from './Finance/InvoiceAttachMatchModal';
import DynamicPdfScrollPreview from './Vault/DynamicPdfScrollPreview';

export default function SharedFileHandler() {
  const { spaces, addInboxItems, addToPersonalInbox, setPersonalInbox, addDocument, addShelf } = useSpaces();
  const { user } = useAuth();
  
  const [clientKeys, setClientKeys] = useState<any>({});
  const [guestTokens, setGuestTokens] = useState<string[]>([]);
  const [sharedFiles, setSharedFiles] = useState<string[]>([]);
  const [sharedBlobs, setSharedBlobs] = useState<any[]>([]);
  const [sharedAllPages, setSharedAllPages] = useState<string[] | null>(null);
  const [isReceivingShare, setIsReceivingShare] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUltraHdPlan, setIsUltraHdPlan] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [routeDestination, setRouteDestination] = useState<'direct' | 'inbox' | 'personal' | 'vault' | 'attach_existing'>('personal');
  const [attachQueueState, setAttachQueueState] = useState<{ spaceId: string; queue: ScannedReceiptInput[] } | null>(null);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [showChromeUpdateModal, setShowChromeUpdateModal] = useState(false);
  const isCancelledRef = useRef(false);
  const hasHandledShareRef = useRef(false);
  const router = useRouter();

  // Thorough cleanup of all share caches across browser storage
  const clearAllShareStores = (opts?: { keepLatestShared?: boolean }) => {
    try {
      if (!opts?.keepLatestShared) {
        localStorage.removeItem('smartshare_latest_shared_backup');
      }
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
      const blobReq = indexedDB.open('SmartShareSharedBlobsDB', 1);
      blobReq.onupgradeneeded = (e: any) => {
        if (!e.target.result.objectStoreNames.contains('blobs')) {
          e.target.result.createObjectStore('blobs');
        }
      };
      blobReq.onsuccess = (e: any) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('blobs')) {
          const tx = db.transaction('blobs', 'readwrite');
          tx.objectStore('blobs').delete('latest_blobs');
        }
      };
    } catch(e) {}

    if (!opts?.keepLatestShared) {
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
    }
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

  const processFoundBlobs = React.useCallback(async (blobItems: any[]) => {
    if (!blobItems || blobItems.length === 0 || isCancelledRef.current || hasHandledShareRef.current) return;
    hasHandledShareRef.current = true;
    clearAllShareStores();
    setIsReceivingShare(false);
    setSharedBlobs(blobItems);

    // Convert blobs to Object URLs for instant, 0ms, zero-memory-cost previews
    const previewUrls: string[] = [];
    for (const item of blobItems) {
      if (item.blob instanceof Blob) {
        previewUrls.push(URL.createObjectURL(item.blob));
      } else if (typeof item === 'string') {
        previewUrls.push(item);
      }
    }

    if (previewUrls.length === 0) return;

    // Immediately open the modal and display previews without blocking on heavy extraction!
    setSharedFiles(previewUrls);
    setRouteDestination(previewUrls.length > 1 ? 'personal' : 'direct');
    setIsModalOpen(true);
  }, []);

  const processFoundFiles = React.useCallback(async (rawResult: any, source: string) => {
    if (!rawResult || isCancelledRef.current || hasHandledShareRef.current) return;
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
      } else {
        // Immediate visual HUD response (<50ms) so user never sees an empty screen
        setIsReceivingShare(true);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkPendingFiles = async () => {
      if (isCancelledRef.current || hasHandledShareRef.current) return false;

      // 1. Check dedicated SharedBlobs DB first (instant binary read!)
      try {
        const blobReq = indexedDB.open('SmartShareSharedBlobsDB', 1);
        blobReq.onupgradeneeded = (e: any) => {
          if (!e.target.result.objectStoreNames.contains('blobs')) {
            e.target.result.createObjectStore('blobs');
          }
        };
        blobReq.onsuccess = (e: any) => {
          const db = e.target.result;
          if (db.objectStoreNames.contains('blobs')) {
            const tx = db.transaction('blobs', 'readonly');
            const store = tx.objectStore('blobs');
            const getBlobsReq = store.get('latest_blobs');
            getBlobsReq.onsuccess = () => {
              if (getBlobsReq.result && Array.isArray(getBlobsReq.result) && getBlobsReq.result.length > 0) {
                processFoundBlobs(getBlobsReq.result);
                return;
              }
            };
          }
        };
      } catch (blobErr) {}

      // 2. Check MySpaceDB sharedFiles fallback
      try {
        const req = indexedDB.open('MySpaceDB', 1);
        req.onsuccess = (e: any) => {
          const db = e.target.result;
          if (db.objectStoreNames.contains('sharedFiles')) {
            const tx = db.transaction('sharedFiles', 'readonly');
            const store = tx.objectStore('sharedFiles');
            const getReq = store.get('latest_shared');
            getReq.onsuccess = () => {
              if (getReq.result && !isCancelledRef.current && !hasHandledShareRef.current) {
                processFoundFiles(getReq.result, 'INDEXED_DB');
              }
            };
          }
        };
      } catch (idbErr) {}

      // 2. Check Cache Storage fallback
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
              if (getReq.result && !isCancelledRef.current && !hasHandledShareRef.current) {
                processFoundFiles(getReq.result, 'INDEXED_DB');
              }
            };
          }
        };
      } catch (idbErr) {}

      return false;
    };

    // Check immediately, then poll rapidly (every 250ms for 5 seconds) to catch the SW write reliably
    checkPendingFiles();
    const pollInterval = setInterval(() => {
      if (hasHandledShareRef.current || isCancelledRef.current) {
        clearInterval(pollInterval);
        return;
      }
      checkPendingFiles();
    }, 250);

    const safetyTimeout = setTimeout(() => {
      clearInterval(pollInterval);
      setIsReceivingShare(false);
    }, 10000);

    // Listen to messages from Service Worker
    const handleSwMessage = (event: MessageEvent) => {
      if (!event.data || isCancelledRef.current || hasHandledShareRef.current) return;
      if (event.data.action === 'SHARE_BLOBS_AVAILABLE') {
        checkPendingFiles();
      } else if (event.data.action === 'SHARE_FILES_PAYLOAD' && event.data.files && event.data.files.length > 0) {
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
      if (isCancelledRef.current || hasHandledShareRef.current) {
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
      if (routeDestination === 'direct' || routeDestination === 'inbox' || routeDestination === 'attach_existing') setRouteDestination('vault');
    }
  }, [selectedSpaceId, spaceHasFinance, spaceHasVault, routeDestination, sharedFiles.length]);

  useEffect(() => {
    setSelectedFolderId(null);
  }, [selectedSpaceId, selectedShelfId]);

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
    hasHandledShareRef.current = true;
    isCancelledRef.current = true;
    clearAllShareStores({ keepLatestShared: routeDestination === 'direct' });
    setIsProcessing(true);
    
    try {
      if (routeDestination === 'personal') {
          setUploadProgress({ current: 0, total: sharedFiles.length });
          const filesToProcess = [...sharedFiles];
          for (let i = 0; i < filesToProcess.length; i++) {
            setUploadProgress({ current: i + 1, total: filesToProcess.length });
            const cleanUri = filesToProcess[i].replace(/^"|"$/g, '');
            const compressedUri = await downscaleBase64(cleanUri, 1500, 0.85);
            const publicUrl = await uploadImageToStorage(compressedUri, 'personal_inbox/' + (user?.id || 'me') + '/' + Date.now() + '-' + Math.random().toString(36).substring(7) + '.webp');
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
              const publicUrl = await uploadImageToStorage(compressedUri, 'inbox/' + selectedSpaceId + '/' + Date.now() + '-' + Math.random().toString(36).substring(7) + '.webp');
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
          const correspondingBlob = sharedBlobs[currentIdx - 1];
          const isPdf = Boolean(
            (correspondingBlob?.blob && (correspondingBlob.blob.type === 'application/pdf' || correspondingBlob.blob.name?.toLowerCase().endsWith('.pdf'))) ||
            correspondingBlob?.type === 'application/pdf' ||
            correspondingBlob?.name?.toLowerCase().endsWith('.pdf') ||
            cleanUri.toLowerCase().includes('.pdf') ||
            cleanUri.startsWith('data:application/pdf')
          );

          const spaceOverride = user?.storageConfig?.spaceOverrides?.[selectedSpaceId];
          const effectiveTarget = spaceOverride || user?.storageConfig?.defaultTarget || 'cloud';

          if (isPdf) {
            const blobToUpload = (correspondingBlob?.blob instanceof Blob)
              ? correspondingBlob.blob
              : await fetch(cleanUri).then(r => r.blob());

            const buffer = await blobToUpload.arrayBuffer();
            const analysis = await analyzePdfStructure(buffer);
            // Strict check: only true digital signatures or compact vector files retain raw PDF!
            const isOriginalSignedOrVector = isTrueOriginalPdf(analysis, blobToUpload.size);

            // Extract all pages as crisp, optimized WebP images (1200px or Ultra-HD 3200px for architectural plans)
            const maxDim = isUltraHdPlan ? 3200 : 1200;
            const quality = isUltraHdPlan ? 0.90 : 0.80;
            const webpPages = await extractPdfPages(blobToUpload, maxDim, quality);

            // Parallel upload of all WebP pages (super-fast, finishes in ~1.5s instead of 15s!)
            const uploadedPages = await Promise.all(
              webpPages.map((pageUri, p) => uploadImageToStorage(
                pageUri,
                `vault/${selectedSpaceId}/${Date.now()}-${p}-${Math.random().toString(36).substring(7)}.webp`
              ))
            );

            let rawPdfDownloadUrl: string | undefined = undefined;
            if (isOriginalSignedOrVector) {
              // Digitally signed or compact vector PDF: retain intact original file in Storage for legal validity & download
              const fileName = correspondingBlob?.name || correspondingBlob?.blob?.name || `doc_${Date.now()}.pdf`;
              rawPdfDownloadUrl = await uploadBlobToStorage(
                blobToUpload,
                `vault/${selectedSpaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
              );
            }

            const fileName = correspondingBlob?.name || correspondingBlob?.blob?.name || `doc_${Date.now()}`;
            const cleanTitle = fileName.replace(/\.pdf$/i, '');
            const finalThumb = uploadedPages[0];

            addDocument(selectedSpaceId, {
              shelfId: targetShelfId,
              folderId: selectedFolderId || undefined,
              url: rawPdfDownloadUrl || finalThumb,
              rawPdfUrl: rawPdfDownloadUrl,
              thumbnailUrl: finalThumb,
              pages: uploadedPages.length > 0 ? uploadedPages : (finalThumb ? [finalThumb] : undefined),
              title: cleanTitle || (isOriginalSignedOrVector ? 'מסמך PDF מקורי' : 'מסמך ששותף'),
              type: isOriginalSignedOrVector ? 'pdf' : 'document',
              addedBy: user?.id || 'me',
              storageTarget: effectiveTarget as 'cloud' | 'local' | 'gdrive',
              fileSize: blobToUpload.size
            });

            if (effectiveTarget === 'local') {
              try {
                await saveLocalDeviceFile(currentSpace?.title || 'General', fileName, cleanUri);
              } catch (err) {
                console.warn("Local save failed in SharedFileHandler:", err);
              }
            }
          } else {
            let webpPages: string[] = [];
            try {
              webpPages = [await downscaleBase64(cleanUri, 1500, 0.85)];
            } catch (err) {
              console.error('Downscale failed', err);
              webpPages = [cleanUri];
            }

            const uploadedPages: string[] = [];
            for (let p = 0; p < webpPages.length; p++) {
              const pageUri = webpPages[p];
              const ext = pageUri.startsWith('data:image/webp') ? 'webp' : 'jpg';
              uploadedPages.push(await uploadImageToStorage(
                pageUri,
                `vault/${selectedSpaceId}/${Date.now()}-${p}-${Math.random().toString(36).substring(7)}.${ext}`
              ));
              if (effectiveTarget === 'local') {
                try {
                  await saveLocalDeviceFile(currentSpace?.title || 'General', `shared_${Date.now()}_${currentIdx}_${p + 1}.${ext}`, pageUri);
                } catch (err) {
                  console.warn("Local save failed in SharedFileHandler:", err);
                }
              }
            }

            const publicUrl = uploadedPages[0];
            const docThumbnailUrl: string | undefined = uploadedPages[0];
            const docPages: string[] | undefined = uploadedPages.length > 1 ? uploadedPages : undefined;

            const imageFileSize = cleanUri.startsWith('data:') ? Math.round((cleanUri.length * 3) / 4) : undefined;

            addDocument(selectedSpaceId, {
              shelfId: targetShelfId,
              folderId: selectedFolderId || undefined,
              url: publicUrl,
              thumbnailUrl: docThumbnailUrl,
              pages: docPages,
              title: 'מסמך ששותף',
              type: 'image',
              addedBy: user?.id || 'me',
              storageTarget: effectiveTarget as 'cloud' | 'local' | 'gdrive',
              fileSize: imageFileSize
            });
          }
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
        router.push('/space/' + selectedSpaceId + '?tab=documents&shelfId=' + targetShelfId + (selectedFolderId ? '&folderId=' + selectedFolderId : ''));
      } else if (routeDestination === 'attach_existing') {
        // Prepare queue with converted WebP pages right away so OCR and thumbnail work immediately without raw PDF issues
        const queue: ScannedReceiptInput[] = [];
        for (let idx = 0; idx < sharedFiles.length; idx++) {
          const rawUri = sharedFiles[idx].replace(/^"|"$/g, '');
          const correspondingBlob = sharedBlobs[idx];
          const isPdf = Boolean(
            (correspondingBlob?.blob && (correspondingBlob.blob.type === 'application/pdf' || correspondingBlob.blob.name?.toLowerCase().endsWith('.pdf'))) ||
            correspondingBlob?.type === 'application/pdf' ||
            correspondingBlob?.name?.toLowerCase().endsWith('.pdf') ||
            rawUri.toLowerCase().includes('.pdf') ||
            rawUri.startsWith('data:application/pdf')
          );

          let webpPages: string[] | undefined = undefined;
          let rawPdfBlobToKeep: Blob | undefined = undefined;

          if (idx === 0 && sharedFiles.length === 1 && sharedAllPages && sharedAllPages.length > 1) {
            webpPages = sharedAllPages;
          } else if (isPdf) {
            try {
              const blobSource = (correspondingBlob?.blob instanceof Blob)
                ? correspondingBlob.blob
                : await fetch(rawUri).then(r => r.blob()).catch(() => null);

              if (blobSource) {
                webpPages = await extractPdfPages(blobSource, 1500, 0.85);
                const buffer = await blobSource.arrayBuffer();
                const analysis = await analyzePdfStructure(buffer);
                if (isTrueOriginalPdf(analysis, blobSource.size)) {
                  rawPdfBlobToKeep = blobSource;
                }
              }
            } catch (pdfErr) {
              console.warn('PDF extraction for attach_existing queue failed:', pdfErr);
            }
          }

          queue.push({
            url: (webpPages && webpPages.length > 0) ? webpPages[0] : rawUri,
            pages: (webpPages && webpPages.length > 1) ? webpPages : undefined,
            rawPdfBlob: rawPdfBlobToKeep
          });
        }

        const request = indexedDB.open('MySpaceDB', 1);
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          if (db.objectStoreNames.contains('sharedFiles')) {
            const tx = db.transaction('sharedFiles', 'readwrite');
            tx.objectStore('sharedFiles').delete('latest_shared');
          }
        };

        setIsModalOpen(false);
        setIsProcessing(false);
        setSharedFiles([]);
        setAttachQueueState({ spaceId: selectedSpaceId, queue });
      } else {
        // Direct route: save primary and allPages for page-by-page review and OCR
        try {
          let convertedPrimary = sharedFiles[0];
          let convertedPages = sharedAllPages && sharedAllPages.length > 0 ? sharedAllPages : sharedFiles;
          let rawPdfBlobToKeep: Blob | undefined = undefined;

          // Check if the primary file is a PDF (Blob instance or data URI or filename)
          const correspondingBlob = sharedBlobs[0];
          const rawUri = (sharedFiles[0] || '').replace(/^"|"$/g, '');
          const isPdf = Boolean(
            (correspondingBlob?.blob && (correspondingBlob.blob.type === 'application/pdf' || correspondingBlob.blob.name?.toLowerCase().endsWith('.pdf'))) ||
            correspondingBlob?.type === 'application/pdf' ||
            correspondingBlob?.name?.toLowerCase().endsWith('.pdf') ||
            rawUri.toLowerCase().includes('.pdf') ||
            rawUri.startsWith('data:application/pdf') ||
            (correspondingBlob?.blob instanceof Blob && correspondingBlob.blob.type === 'application/pdf')
          );

          if (isPdf) {
            try {
              const blobSource = (correspondingBlob?.blob instanceof Blob)
                ? correspondingBlob.blob
                : await fetch(rawUri).then(r => r.blob()).catch(() => null);

              if (blobSource) {
                const maxDim = isUltraHdPlan ? 3200 : 1500;
                const quality = isUltraHdPlan ? 0.90 : 0.85;
                const extracted = await extractPdfPages(blobSource, maxDim, quality);
                if (extracted && extracted.length > 0) {
                  convertedPrimary = extracted[0];
                  convertedPages = extracted;
                }
                const buffer = await blobSource.arrayBuffer();
                const analysis = await analyzePdfStructure(buffer);
                if (isTrueOriginalPdf(analysis, blobSource.size)) {
                  rawPdfBlobToKeep = blobSource;
                }
              }
            } catch (pdfErr) {
              console.warn('PDF extraction for direct route failed:', pdfErr);
            }
          }

          const pendingExpensePayload = {
            primary: convertedPrimary,
            allPages: convertedPages,
            files: convertedPages,
            rawPdfBlob: rawPdfBlobToKeep,
            spaceId: selectedSpaceId
          };

          // 1. In-memory storage on window (0ms, no quota limits, passes raw Blob directly)
          if (typeof window !== 'undefined') {
            (window as any).__SMARTSHARE_PENDING_SHARED_EXPENSE__ = pendingExpensePayload;
          }

          // 2. Dedicated IndexedDB SmartShareSharedBlobsDB (handles Blobs without memory/quota limits)
          try {
            const blobDbReq = indexedDB.open('SmartShareSharedBlobsDB', 1);
            blobDbReq.onupgradeneeded = (e: any) => {
              if (!e.target.result.objectStoreNames.contains('blobs')) {
                e.target.result.createObjectStore('blobs');
              }
            };
            blobDbReq.onsuccess = (e: any) => {
              const db = e.target.result;
              if (db.objectStoreNames.contains('blobs')) {
                const tx = db.transaction('blobs', 'readwrite');
                tx.objectStore('blobs').put(pendingExpensePayload, 'pending_expense');
              }
            };
          } catch(e) {}

          // 3. Fallbacks to MySpaceDB and localStorage
          try {
            const dbReq = indexedDB.open('MySpaceDB', 1);
            dbReq.onupgradeneeded = (e: any) => {
              if (!e.target.result.objectStoreNames.contains('sharedFiles')) {
                e.target.result.createObjectStore('sharedFiles');
              }
            };
            dbReq.onsuccess = (e: any) => {
              const db = e.target.result;
              if (db.objectStoreNames.contains('sharedFiles')) {
                const tx = db.transaction('sharedFiles', 'readwrite');
                tx.objectStore('sharedFiles').put(pendingExpensePayload, 'latest_shared');
              }
            };
          } catch(e) {}

          try {
            localStorage.setItem('smartshare_latest_shared_backup', JSON.stringify({ primary: convertedPrimary, allPages: convertedPages, files: convertedPages }));
          } catch(e) {}

          // 4. Dispatch instant CustomEvent in case target space is already open
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartshare:trigger_shared_expense', { detail: pendingExpensePayload }));
          }
        } catch(e) {
          console.warn('Direct expense handover error:', e);
        }

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
      {/* Instant HUD Banner when external share is receiving (<50ms feedback) */}
      {isReceivingShare && !isModalOpen && (
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100008,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '30px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          direction: 'rtl',
          fontSize: '0.9rem',
          fontWeight: 700,
          animation: 'pulse 1.5s infinite ease-in-out'
        }}>
          <span style={{ fontSize: '1.2rem' }}>📥</span>
          <span>קולט קובץ ששותף... אנא המתן רגע</span>
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      )}
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
        backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 100005,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        backdropFilter: 'blur(6px)'
      }}>
        <div style={{
          background: '#ffffff', borderRadius: '24px', padding: '1.5rem',
          width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          maxHeight: '92vh', overflowY: 'auto', border: '1px solid #f1f5f9', direction: 'rtl'
        }}>
          {/* Header Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
            color: '#fff', padding: '0.65rem 0.95rem', borderRadius: '14px',
            marginBottom: '1.25rem', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.3rem' }}>📥</span>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', letterSpacing: '-0.01em' }}>
                  קליטת שיתוף <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 'normal' }}>v6.8.21</span>
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.92 }}>
                  {routeDestination === 'personal' 
                    ? 'מחסן אישי פרטי (ללא OCR)' 
                    : (displayedSpaces.find((s:any) => s.id === selectedSpaceId)?.title || 'בחר פרויקט')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.22)', padding: '0.25rem 0.55rem', borderRadius: '20px', fontWeight: '800' }}>
                {sharedAllPages && sharedAllPages.length > 1 ? `${sharedAllPages.length} עמודים` : `${sharedFiles.length} ${sharedFiles.length > 1 ? 'קבצים' : 'קובץ'}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  hasHandledShareRef.current = true;
                  isCancelledRef.current = true;
                  setIsModalOpen(false);
                  setSharedFiles([]);
                  setSharedAllPages(null);
                  clearAllShareStores();
                }}
                title="סגור ללא שמירה"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Document Preview Thumbnails */}
          {sharedFiles.length > 0 && (
            <div style={{ 
              marginBottom: '1.25rem', borderRadius: '12px', height: '90px', 
              backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', overflowX: 'auto' 
            }}>
              {sharedFiles.slice(0, 3).map((uri, idx) => {
                const blobItem = sharedBlobs[idx];
                const isPdf = Boolean(
                  blobItem?.type === 'application/pdf' ||
                  blobItem?.blob?.type === 'application/pdf' ||
                  blobItem?.name?.toLowerCase().endsWith('.pdf') ||
                  uri.toLowerCase().includes('.pdf') ||
                  uri.startsWith('data:application/pdf')
                );
                return isPdf ? (
                  <PdfThumbnail 
                    key={idx}
                    url={uri}
                    onClick={() => setZoomedIndex(idx)}
                    style={{ height: '100%', width: '70px', flexShrink: 0, objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                ) : (
                  <img 
                    key={idx} 
                    src={uri} 
                    alt="Preview" 
                    style={{ height: '100%', width: '70px', flexShrink: 0, objectFit: 'cover', cursor: 'zoom-in', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                    onClick={() => setZoomedIndex(idx)}
                  />
                );
              })}
              {sharedFiles.length > 3 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minWidth: '65px', backgroundColor: '#e2e8f0', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', color: '#475569' }}>
                  +{sharedFiles.length - 3}
                </div>
              )}
              {sharedAllPages && sharedAllPages.length > 1 && (
                <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: '700', padding: '0 0.4rem', whiteSpace: 'nowrap' }}>
                  מסמך מרובה עמודים ({sharedAllPages.length})
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Top-Level Destination Switcher */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#475569', display: 'block' }}>
                לאן לשמור את הקובץ?
              </label>

              {/* Ultra-HD Plan / Blueprint Toggle */}
              <button
                type="button"
                onClick={() => setIsUltraHdPlan(prev => !prev)}
                style={{
                  background: isUltraHdPlan ? '#eff6ff' : '#f8fafc',
                  border: isUltraHdPlan ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                  color: isUltraHdPlan ? '#1d4ed8' : '#64748b',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: isUltraHdPlan ? '0 1px 4px rgba(59, 130, 246, 0.2)' : 'none'
                }}
                title="הפעל רזולוציית-על של 3200px לקריאת מספרים ומידות קטנות בתוכניות אדריכליות וגרמושקא בזום עד 3000%"
              >
                <span>📐</span>
                <span>איכות Ultra-HD (גרמושקא)</span>
                <span style={{
                  fontSize: '0.66rem',
                  background: isUltraHdPlan ? '#2563eb' : '#94a3b8',
                  color: '#ffffff',
                  padding: '1px 5px',
                  borderRadius: '10px'
                }}>
                  {isUltraHdPlan ? 'פעיל (3200px)' : 'רגיל'}
                </span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (routeDestination === 'personal') {
                    if (spaceHasVault) setRouteDestination('vault');
                    else if (spaceHasFinance) setRouteDestination(sharedFiles.length > 1 ? 'inbox' : 'direct');
                  }
                }}
                style={{
                  padding: '0.65rem 0.5rem', borderRadius: '10px', border: 'none',
                  background: routeDestination !== 'personal' ? '#ffffff' : 'transparent',
                  color: routeDestination !== 'personal' ? '#1e293b' : '#64748b',
                  fontWeight: routeDestination !== 'personal' ? '800' : '600',
                  fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  boxShadow: routeDestination !== 'personal' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🏠</span> לפרויקט
              </button>
              <button
                type="button"
                onClick={() => setRouteDestination('personal')}
                style={{
                  padding: '0.65rem 0.5rem', borderRadius: '10px', border: 'none',
                  background: routeDestination === 'personal' ? '#ffffff' : 'transparent',
                  color: routeDestination === 'personal' ? '#1e293b' : '#64748b',
                  fontWeight: routeDestination === 'personal' ? '800' : '600',
                  fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  boxShadow: routeDestination === 'personal' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📥</span> למחסן אישי
              </button>
            </div>
          </div>

          {/* IF PERSONAL INBOX: Simple, Zero Clutter Info */}
          {routeDestination === 'personal' && (
            <div style={{ 
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', 
              padding: '1rem', marginBottom: '1.25rem', textAlign: 'right' 
            }}>
              <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                🔒 מחסן מיון אישי פרטי
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: '1.45' }}>
                הקובץ יישמר במחסן האישי שלך בענן <strong>ללא סריקת OCR</strong>. רק אתה רואה אותו ותוכל למיין אותו בהמשך לכל פרויקט שתרצה.
              </p>
            </div>
          )}

          {/* IF PROJECT ROUTE: Space Selector + Clean Action Flow */}
          {routeDestination !== 'personal' && (
            <>
              {/* Space Picker */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '0.45rem', display: 'block' }}>
                  בחר פרויקט (מרחב עבודה):
                </label>
                {activeSpaces.length > 5 && (
                  <input 
                    type="text" 
                    placeholder="חיפוש מהיר..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginBottom: '0.4rem' }}
                  />
                )}
                <select 
                  value={selectedSpaceId} 
                  onChange={e => setSelectedSpaceId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: '700', backgroundColor: '#f8fafc', color: '#1e293b' }}
                >
                  {displayedSpaces.length === 0 && <option value="">לא נמצאו מרחבים תואמים</option>}
                  {displayedSpaces.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {/* STEP 2: Intent Selection within Space */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '0.45rem', display: 'block' }}>
                  מה סוג הפעולה בפרויקט?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  
                  {/* Option 1: Documents Vault (NO OCR) */}
                  {spaceHasVault && (
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0.85rem',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                      border: routeDestination === 'vault' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: routeDestination === 'vault' ? '#eef2ff' : '#ffffff'
                    }}>
                      <input 
                        type="radio" 
                        name="spaceAction" 
                        checked={routeDestination === 'vault'} 
                        onChange={() => setRouteDestination('vault')}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#1e293b' }}>
                          🗂️ מסמך כללי למדף (חוזה, תוכנית, קובץ)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          שומר ישירות לתיקייה בפרויקט <strong>ללא OCR</strong>.
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 2: Project Inbox / Waiting room (NO Immediate OCR) */}
                  {spaceHasFinance && (
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0.85rem',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                      border: routeDestination === 'inbox' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: routeDestination === 'inbox' ? '#eef2ff' : '#ffffff'
                    }}>
                      <input 
                        type="radio" 
                        name="spaceAction" 
                        checked={routeDestination === 'inbox'} 
                        onChange={() => setRouteDestination('inbox')}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#1e293b' }}>
                          📥 מחסן ההמתנה של הפרויקט
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          שומר במחסן המשותף לטיפול מאוחר יותר של כל השותפים.
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 3: Direct Expense with OCR */}
                  {spaceHasFinance && (
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0.85rem',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                      border: routeDestination === 'direct' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: routeDestination === 'direct' ? '#eef2ff' : '#ffffff',
                      opacity: sharedFiles.length > 1 ? 0.6 : 1
                    }}>
                      <input 
                        type="radio" 
                        name="spaceAction" 
                        checked={routeDestination === 'direct'} 
                        disabled={sharedFiles.length > 1}
                        onChange={() => setRouteDestination('direct')}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#1e293b' }}>
                          🧾 הוצאה כספית ישירה + סריקת AI
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                          פותח טופס הוצאה ומפעיל חילוץ כספי (ספק, סכום ומע&quot;מ).
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Option 4: Attach to Existing Expense (No duplicate total) */}
                  {spaceHasFinance && (
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0.85rem',
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease',
                      border: routeDestination === 'attach_existing' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                      backgroundColor: routeDestination === 'attach_existing' ? '#f0fdf4' : '#ffffff'
                    }}>
                      <input 
                        type="radio" 
                        name="spaceAction" 
                        checked={routeDestination === 'attach_existing'} 
                        onChange={() => setRouteDestination('attach_existing')}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#14532d' }}>
                          🔗 צרף חשבונית להוצאה קיימת (ללא חשבונית)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' }}>
                          מצליב אוטומטית מול הוצאות שהוזנו ידנית <strong>מבלי להוסיף לסה&quot;כ ההוצאות</strong>.
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Sub-step A: Shelf Picker if Vault Selected */}
              {routeDestination === 'vault' && selectedSpaceId && (() => {
                const curSp = activeSpaces.find((s: any) => s.id === selectedSpaceId);
                const availableFolders = (curSp?.documentFolders || []).filter((f: any) => !f.deletedAt && f.shelfId === selectedShelfId);
                return (
                  <div style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                        בחר מדף יעד במסמכים:
                      </label>
                      <select 
                        value={selectedShelfId} 
                        onChange={e => setSelectedShelfId(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#ffffff' }}
                      >
                        {(curSp?.shelves || []).map((sh: any) => (
                          <option key={sh.id} value={sh.id}>{sh.icon || '📁'} {sh.name}</option>
                        ))}
                        <option value="__new__">+ צור מדף חדש בשם &quot;כללי&quot;</option>
                      </select>
                    </div>

                    {availableFolders.length > 0 && selectedShelfId !== '__new__' && (
                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                          בחר תיקייה בתוך המדף (אופציונלי):
                        </label>
                        <select 
                          value={selectedFolderId || ''} 
                          onChange={e => setSelectedFolderId(e.target.value || null)}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#ffffff' }}
                        >
                          <option value="">📁 ראשי (ללא תיקייה)</option>
                          {availableFolders.map((f: any) => {
                            const parentF = f.parentId ? availableFolders.find((p: any) => p.id === f.parentId) : null;
                            return (
                              <option key={f.id} value={f.id}>
                                📁 {parentF ? parentF.name + ' > ' : ''}{f.name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sub-step B: Payer Selection ONLY if Direct Expense Selected */}
              {routeDestination === 'direct' && selectedSpaceId && (
                <div style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                    מי שילם בפועל?
                  </label>
                  <select 
                    value={selectedPayerId} 
                    onChange={e => setSelectedPayerId(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#ffffff' }}
                  >
                    <option value="">אני ({user?.realName || 'ברירת מחדל'})</option>
                    {(displayedSpaces.find((s: any) => s.id === selectedSpaceId)?.members || []).map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.name || 'שותף'}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.25rem' }}>
            <button 
              type="button"
              onClick={() => { 
                hasHandledShareRef.current = true;
                isCancelledRef.current = true;
                setIsModalOpen(false); 
                setSharedFiles([]);
                setSharedAllPages(null);
                clearAllShareStores();
              }}
              style={{ flex: 1, padding: '0.8rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }}
            >
              ביטול
            </button>
            <button 
              type="button"
              onClick={handleProcess}
              disabled={(routeDestination !== 'personal' && !selectedSpaceId) || isProcessing}
              style={{ 
                flex: 2, padding: '0.8rem', borderRadius: '12px', border: 'none', 
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)', 
                color: '#fff', fontWeight: '800', fontSize: '0.9rem', 
                cursor: isProcessing ? 'not-allowed' : 'pointer', 
                opacity: (routeDestination !== 'personal' && !selectedSpaceId) || isProcessing ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)'
              }}
            >
              {isProcessing 
                ? 'מעביר נתונים...' 
                : routeDestination === 'personal'
                  ? '📥 שמור במחסן האישי'
                  : routeDestination === 'vault'
                    ? '🗂️ שמור במדף המסמכים'
                    : routeDestination === 'inbox'
                      ? '📥 העבר למחסן ההמתנה'
                      : routeDestination === 'attach_existing'
                        ? '🔗 אתר הוצאה וצרף חשבונית'
                        : '🧾 פתח והפעל סריקה ⚡'}
            </button>
          </div>
        </div>
      </div>
      )}

      {attachQueueState && (() => {
        const targetSpace = activeSpaces.find((s: any) => s.id === attachQueueState.spaceId);
        if (!targetSpace) return null;
        return (
          <InvoiceAttachMatchModal
            space={targetSpace}
            receiptQueue={attachQueueState.queue}
            onClose={() => {
              const sid = attachQueueState.spaceId;
              setAttachQueueState(null);
              router.push('/space/' + sid + '?tab=transactions');
            }}
            onFallbackToNewExpense={(receipt) => {
              const sid = attachQueueState.spaceId;
              setAttachQueueState(null);
              const fallbackPayload = {
                primary: receipt.url,
                allPages: receipt.pages || [receipt.url],
                files: [receipt.url],
                rawPdfBlob: receipt.rawPdfBlob,
                spaceId: sid
              };
              if (typeof window !== 'undefined') {
                (window as any).__SMARTSHARE_PENDING_SHARED_EXPENSE__ = fallbackPayload;
                window.dispatchEvent(new CustomEvent('smartshare:trigger_shared_expense', { detail: fallbackPayload }));
              }
              try {
                const blobDbReq = indexedDB.open('SmartShareSharedBlobsDB', 1);
                blobDbReq.onsuccess = (e: any) => {
                  const db = e.target.result;
                  if (db.objectStoreNames.contains('blobs')) {
                    const tx = db.transaction('blobs', 'readwrite');
                    tx.objectStore('blobs').put(fallbackPayload, 'pending_expense');
                  }
                };
              } catch(e) {}
              try {
                const dbReq = indexedDB.open('MySpaceDB', 1);
                dbReq.onupgradeneeded = (e: any) => {
                  if (!e.target.result.objectStoreNames.contains('sharedFiles')) {
                    e.target.result.createObjectStore('sharedFiles');
                  }
                };
                dbReq.onsuccess = (e: any) => {
                  const db = e.target.result;
                  if (db.objectStoreNames.contains('sharedFiles')) {
                    const tx = db.transaction('sharedFiles', 'readwrite');
                    tx.objectStore('sharedFiles').put(fallbackPayload, 'latest_shared');
                  }
                };
              } catch {}
              router.push('/space/' + sid + '?addExpense=true&triggerOcr=true&payerId=' + (user?.id || 'me'));
            }}
          />
        );
      })()}
      
      {zoomedIndex !== null && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 100010, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onTouchStart={e => setTouchStartX(e.changedTouches[0].screenX)}
          onTouchEnd={e => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchStartX - touchEndX > 50 && zoomedIndex < sharedFiles.length - 1) setZoomedIndex(zoomedIndex + 1);
            if (touchEndX - touchStartX > 50 && zoomedIndex > 0) setZoomedIndex(zoomedIndex - 1);
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '82%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(() => {
              const isPdf = Boolean(
                (zoomedIndex !== null && sharedBlobs[zoomedIndex]?.type === 'application/pdf') ||
                (zoomedIndex !== null && sharedBlobs[zoomedIndex]?.blob?.type === 'application/pdf') ||
                (zoomedIndex !== null && sharedBlobs[zoomedIndex]?.name?.toLowerCase().endsWith('.pdf')) ||
                sharedFiles[zoomedIndex]?.toLowerCase().includes('.pdf') ||
                sharedFiles[zoomedIndex]?.startsWith('data:application/pdf')
              );
              if (isPdf) {
                return (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DynamicPdfScrollPreview
                      url={sharedFiles[zoomedIndex]}
                      title={sharedBlobs[zoomedIndex]?.name || 'תצוגת מסמך'}
                    />
                  </div>
                );
              }
              return (
                <img src={sharedFiles[zoomedIndex]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
              );
            })()}
            {zoomedIndex > 0 && (
              <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex - 1); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                &gt;
              </div>
            )}
            {zoomedIndex < sharedFiles.length - 1 && (
              <div onClick={(e) => { e.stopPropagation(); setZoomedIndex(zoomedIndex + 1); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', padding: '1rem', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                &lt;
              </div>
            )}
          </div>
          <div style={{ color: 'white', marginTop: '0.8rem', fontSize: '1.1rem', fontWeight: 'bold', direction: 'rtl' }}>
            {zoomedIndex + 1} מתוך {sharedFiles.length}
          </div>
          <div 
            onClick={() => setZoomedIndex(null)}
            style={{ marginTop: '0.8rem', padding: '0.6rem 2rem', background: '#3b82f6', color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}
          >
            סגור תצוגה
          </div>
        </div>
      )}
    </>
  );
}
