'use client';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';
import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { universalSearch, universalSort } from '../../../utils/searchEngine';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces } from '../../../app/context/SpacesContext';
import { ShelfCoverPicker } from './ShelfCoverPicker';
import ShelfTimeline from './ShelfTimeline';
import { uploadImageToStorage } from '@/lib/firebase';
import ConfirmModal from '../../common/ConfirmModal';
import { downloadDocument, shareDocument, getDocumentPreviewUrl } from '../../../utils/documentUtils';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { mergeImagesCleanly } from '../../../utils/imageOptimizer';
import ShareChoiceModal, { ShareChoiceDoc } from './ShareChoiceModal';
import DynamicPdfScrollPreview from './DynamicPdfScrollPreview';
import { saveLocalDeviceFile } from '../../../utils/localDeviceStorage';
import MultiPageViewer from './MultiPageViewer';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string, explicitShelfId?: string) => Promise<string | undefined>;
  uploadAndLinkDocument?: (shelfId: string, eventId: string, url: string, type: 'document' | 'image' | 'pdf') => Promise<void>;
}

interface DocumentsWidgetProps {
  space: Space;
  activePartnersCount: number;
}

type ViewMode = 'feed' | 'grid' | 'circles';

export const DocumentsWidget = forwardRef<DocumentsWidgetRef, DocumentsWidgetProps>(({ space, activePartnersCount }, ref) => {
  const { user } = useAuth();
  const { addShelf, updateShelf, removeShelf, restoreShelf, permanentlyDeleteShelf, addDocument, addDocumentAndLinkToEvent, updateDocument, removeDocument, restoreDocument, permanentlyDeleteDocument, addShelfEvent, updateShelfEvent, removeShelfEvent, addShelfEventComment, removeShelfEventComment } = useSpaces() as any;
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'vault'>(() => (space.settings?.showVaultTimeline ? 'timeline' : 'vault'));
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [pendingImport, setPendingImport] = useState<{ docId?: string, url?: string, type?: 'document' | 'image' | 'pdf', allPages?: string[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState<{ id: string, shelfId: string, url: string, title: string, type: string }[]>([]);
  const [previewState, setPreviewState] = useState<{ docs: any[], index: number } | null>(null);
  const [sharingDoc, setSharingDoc] = useState<ShareChoiceDoc | null>(null);
  const [linkStationDoc, setLinkStationDoc] = useState<{ docId: string, title: string, url: string } | null>(null);
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const viewModeStorageKey = `myspace_vault_view_${space.id}_${user?.id || 'guest'}`;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem(viewModeStorageKey) || localStorage.getItem('myspace_vault_view_mode')) as ViewMode;
      if (saved === 'feed' || saved === 'grid' || saved === 'circles') return saved;
    }
    return 'feed';
  });

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(viewModeStorageKey, mode);
    }
  };
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [activeShelfId, setActiveShelfId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('shelfId');
    }
    return null;
  });

  // Custom modal states (replacing browser alert/prompt/confirm)
  const [activeDocMenuId, setActiveDocMenuId] = useState<string | null>(null);
  const hasFinance = (space.features || []).includes('finance');
  const showTimeline = !!space.settings?.showVaultTimeline;
  const [shelfToDelete, setShelfToDelete] = useState<{ id: string, name: string, count: number } | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleBinTab, setRecycleBinTab] = useState<'shelves' | 'documents'>('shelves');
  const [shelfToPermanentDelete, setShelfToPermanentDelete] = useState<{ id: string, name: string } | null>(null);
  const [docToPermanentDelete, setDocToPermanentDelete] = useState<{ id: string, title: string } | null>(null);

  // Timeline tip banner state
  const timelineHideKey = `hide_timeline_tip_${space.id}`;
  const timelineSnoozeKey = `timeline_snooze_${space.id}`;
  const [isTimelineTipDismissed, setIsTimelineTipDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem(timelineHideKey) === '1') return true;
    const snoozeUntil = localStorage.getItem(timelineSnoozeKey);
    if (snoozeUntil && Number(snoozeUntil) > Date.now()) return true;
    return false;
  });

  const [docToDelete, setDocToDelete] = useState<{ id: string, title: string } | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    onSave: (val: string) => void;
  } | null>(null);
  const [promptInput, setPromptInput] = useState('');

  // Multi-select & Batch sharing states
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isSharingBatch, setIsSharingBatch] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const paramShelfId = new URLSearchParams(window.location.search).get('shelfId');
      if (paramShelfId && shelves.some(s => s.id === paramShelfId)) {
        setActiveShelfId(paramShelfId);
      }
    }
  }, [shelves]);

  React.useEffect(() => {
    if (activeShelfId) {
      window.dispatchEvent(new CustomEvent('smartshare:shelf_opened', { detail: { shelfId: activeShelfId, subTab: activeTab } }));
      window.dispatchEvent(new CustomEvent('smartshare:shelf_subtab_changed', { detail: activeTab }));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:shelf_closed'));
    }
  }, [activeShelfId, activeTab]);

  React.useEffect(() => {
    if (previewState) {
      window.dispatchEvent(new CustomEvent('smartshare:preview_open'));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:preview_closed'));
    }
  }, [previewState]);

  // Silent background preloader for active shelf documents (0ms perceived load time)
  React.useEffect(() => {
    if (!activeShelfId || typeof window === 'undefined') return;
    const activeShelfDocs = documents.filter(d => d.shelfId === activeShelfId);
    if (activeShelfDocs.length === 0) return;

    const urlsToPreload: string[] = [];
    activeShelfDocs.forEach(d => {
      if (d.url && !d.url.toLowerCase().includes('.pdf')) urlsToPreload.push(d.url);
      if (Array.isArray(d.pages)) {
        d.pages.forEach(p => {
          if (p && !p.toLowerCase().includes('.pdf')) urlsToPreload.push(p);
        });
      }
    });

    if (urlsToPreload.length === 0) return;

    const preload = () => {
      urlsToPreload.forEach(src => {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      });
    };

    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(preload, { timeout: 1500 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const t = setTimeout(preload, 120);
      return () => clearTimeout(t);
    }
  }, [activeShelfId, documents]);

  React.useEffect(() => {
    const handler = () => {
      setPromptInput('');
      setCustomPrompt({
        isOpen: true,
        title: 'יצירת מדף חדש',
        placeholder: 'הזן שם למדף...',
        defaultValue: '',
        onSave: (name: string) => {
          if (name.trim()) {
            addShelf(space.id, {
              name: name.trim(),
              allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : []
            });
          }
        }
      });
    };
    window.addEventListener('smartshare:add_shelf', handler);
    return () => window.removeEventListener('smartshare:add_shelf', handler);
  }, [space.id, activePartnersCount, user?.id, addShelf]);
  
  const [editingShelfCoverId, setEditingShelfCoverId] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({
    addDocument: async (url, type, allPages, targetEventId, explicitShelfId?: string) => {
      let targetShelfId: string | null = explicitShelfId || null;
      
      if (!targetShelfId && targetEventId && targetEventId !== '__new_station__') {
        const foundEvent = (space.shelfEvents || []).find(e => e.id === targetEventId);
        if (foundEvent?.shelfId) {
          targetShelfId = foundEvent.shelfId;
        }
      }
      
      if (!targetShelfId) {
        targetShelfId = activeShelfId;
      }
      
      if (!targetShelfId) {
        if (shelves.length === 1) {
           targetShelfId = shelves[0].id;
        } else if (shelves.length > 1) {
           setPendingImport({ url, type: typeof type !== 'undefined' ? type : 'document', allPages: typeof allPages !== 'undefined' ? allPages : [] });
           return undefined;
        } else {
           const newShelfId = addShelf(space.id, { name: 'כללי', allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [] });
           targetShelfId = newShelfId;
        }
      }
      
      return await handleSaveDocument(targetShelfId, url, typeof type !== 'undefined' ? type : 'document', allPages, targetEventId);
    }
  }), [activeShelfId, shelves, space.shelfEvents, space.id, activePartnersCount, user?.id, addShelf]);

  
const shareMultipleDocuments = async (docIds: string[]) => {
  const docsToShare = documents.filter(d => docIds.includes(d.id));
  if (docsToShare.length === 0) return;
  setIsSharingBatch(true);
  try {
    const files: File[] = [];
    for (let i = 0; i < docsToShare.length; i++) {
      const doc = docsToShare[i];
      try {
        const res = await fetch(doc.url);
        const blob = await res.blob();
        const isPdf = doc.url.includes('.pdf') || blob.type === 'application/pdf' || doc.type === 'pdf';
        const ext = isPdf ? 'pdf' : 'jpg';
        const mime = isPdf ? 'application/pdf' : 'image/jpeg';
        const cleanTitle = (doc.title || `doc_${i+1}`).replace(/[/\\?%*:|"<>]/g, '-');
        files.push(new File([blob], `${cleanTitle}.${ext}`, { type: mime }));
      } catch (err) {
        console.error('Failed to load file for share', doc.title, err);
      }
    }

    if (files.length === 0) return;

    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({
        files,
        title: `שיתוף ${files.length} מסמכים מ-MySpace`
      });
    } else {
      for (const f of files) {
        const a = document.createElement('a');
        const objUrl = URL.createObjectURL(f);
        a.href = objUrl;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(objUrl);
      }
    }
  } catch (e) {
    console.error('Error batch sharing', e);
  } finally {
    setIsSharingBatch(false);
  }
};

const handleRenameShelf = (shelfId: string, currentName: string) => {
  setPromptInput(currentName);
  setCustomPrompt({
    isOpen: true,
    title: 'שינוי שם למדף',
    placeholder: 'הזן שם למדף...',
    defaultValue: currentName,
    onSave: (name: string) => {
      if (name.trim()) {
        updateShelf(space.id, shelfId, { name: name.trim() });
      }
    }
  });
};

const handleDeleteDocument = (docId: string, title?: string) => {
  const doc = documents.find(d => d.id === docId);
  setDocToDelete({ id: docId, title: title || doc?.title || 'מסמך' });
};

    
    
    const handleTouchDragStart = (e: React.TouchEvent | React.MouseEvent, docId: string) => {
      setDraggedDocId(docId);
      document.body.style.overflow = 'hidden';
    };

    const handleTouchDragMove = (e: React.TouchEvent) => {
      if (!draggedDocId) return;
      // Note: we can't always e.preventDefault() here without passing { passive: false } to the event listener, 
      // but React passive events allow it if not on document level in some cases.
      const touch = e.touches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetCard = elem?.closest('[data-doc-id]');
      if (targetCard) {
        const targetId = targetCard.getAttribute('data-doc-id');
        if (targetId && targetId !== dragOverDocId) {
          setDragOverDocId(targetId);
        }
      }
    };

    const handleTouchDragEnd = () => {
      if (!draggedDocId) return; // FIX: Don't re-render or cancel clicks if we weren't dragging!
      if (dragOverDocId && draggedDocId !== dragOverDocId) {
        const docA = documents.find(d => d.id === draggedDocId);
        const docB = documents.find(d => d.id === dragOverDocId);
        if (docA && docB) {
          updateDocument(space.id, docA.id, { createdAt: docB.createdAt });
          updateDocument(space.id, docB.id, { createdAt: docA.createdAt });
        }
      }
      setDraggedDocId(null);
      document.body.style.overflow = '';
      setDragOverDocId(null);
    };

    const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string) => {
      // Optimistic UI update
      const tempId = 'temp-' + Date.now();
      const title = type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק';
      
      let previewUrl = (allPages && allPages.length > 0) ? allPages[0] : (url.startsWith('data:image') ? url : undefined);
      setUploadingDocs(prev => [...prev, { id: tempId, shelfId, url, title, type, thumbnailUrl: previewUrl }]);
      
      try {
        let finalUrl = url;
        let finalThumbnailUrl = previewUrl;

        if (url.startsWith('data:image') || url.startsWith('data:application/pdf')) {
          const ext = url.startsWith('data:application/pdf') ? 'pdf' : (url.startsWith('data:image/webp') ? 'webp' : 'jpg');
          const path = `documents/${space.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          finalUrl = await uploadImageToStorage(url, path);
        }

        if (previewUrl && previewUrl.startsWith('data:image')) {
          const thumbExt = previewUrl.startsWith('data:image/webp') ? 'webp' : 'jpg';
          const thumbPath = `documents/${space.id}/thumb_${Date.now()}-${Math.random().toString(36).substring(7)}.${thumbExt}`;
          finalThumbnailUrl = await uploadImageToStorage(previewUrl, thumbPath);
        }

        // Upload multi-page files to Storage so Firestore never overflows 1MB document limit
        let finalPages: string[] | undefined = undefined;
        if (allPages && allPages.length > 1) {
          finalPages = await Promise.all(
            allPages.map(async (pageUrl, idx) => {
              if (pageUrl.startsWith('data:')) {
                const pageExt = pageUrl.startsWith('data:application/pdf') ? 'pdf' : (pageUrl.startsWith('data:image/webp') ? 'webp' : 'jpg');
                const pagePath = `documents/${space.id}/page_${Date.now()}_${idx}_${Math.random().toString(36).substring(7)}.${pageExt}`;
                return await uploadImageToStorage(pageUrl, pagePath);
              }
              return pageUrl;
            })
          );
        }

        // Check user's storage target (default or space override)
        const spaceOverride = user?.storageConfig?.spaceOverrides?.[space.id];
        const effectiveTarget = spaceOverride || user?.storageConfig?.defaultTarget || 'cloud';

        // If local storage is chosen, save copy into device OPFS folder
        if (effectiveTarget === 'local') {
          try {
            const ext = url.startsWith('data:application/pdf') ? 'pdf' : (url.startsWith('data:image/webp') ? 'webp' : 'jpg');
            const safeSpaceTitle = space.title || 'General';
            const baseFileName = `${title}_${Date.now()}.${ext}`;
            await saveLocalDeviceFile(safeSpaceTitle, baseFileName, url);
            
            // If document has multiple pages, save each page as well
            if (allPages && allPages.length > 1) {
              for (let pIdx = 0; pIdx < allPages.length; pIdx++) {
                const pageData = allPages[pIdx];
                const pExt = pageData.startsWith('data:application/pdf') ? 'pdf' : (pageData.startsWith('data:image/webp') ? 'webp' : 'jpg');
                const pageFileName = `${title}_${Date.now()}_page_${pIdx + 1}.${pExt}`;
                await saveLocalDeviceFile(safeSpaceTitle, pageFileName, pageData);
              }
            }
          } catch (localSaveErr) {
            console.warn("Failed saving document to local device OPFS:", localSaveErr);
          }
        }

        const docPayload = {
          shelfId, 
          url: finalUrl, 
          type, 
          title, 
          addedBy: user?.id || '', 
          thumbnailUrl: finalThumbnailUrl,
          pages: finalPages,
          storageTarget: effectiveTarget as 'cloud' | 'local' | 'gdrive'
        };

        // Save to real database - atomically link if targetEventId is present
        let docId: string;
        if (targetEventId && targetEventId !== '__new_station__') {
          docId = addDocumentAndLinkToEvent(space.id, docPayload, targetEventId);
        } else {
          docId = addDocument(space.id, docPayload);
        }

        return docId;
      } catch (e) {
        console.error("Failed to upload document", e);
        alert("שגיאה בהעלאת המסמך");
      } finally {
        // Remove from optimistic UI
        setUploadingDocs(prev => prev.filter(d => d.id !== tempId));
      }
    };



    
    

  const handleMoveDocument = (docId: string, currentShelfId: string) => {
      setPendingImport({ docId });
    };

  const activeDocuments = useMemo(() => {
    return documents.filter(d => !d.deletedAt);
  }, [documents]);

  const deletedDocuments = useMemo(() => {
    return documents.filter(d => !!d.deletedAt);
  }, [documents]);

  const activeShelves = useMemo(() => {
    return shelves.filter(s => !s.deletedAt);
  }, [shelves]);

  const deletedShelves = useMemo(() => {
    return shelves.filter(s => !!s.deletedAt);
  }, [shelves]);

  const totalTrashCount = deletedShelves.length + deletedDocuments.length;

  // Auto purge items older than 12 hours
  React.useEffect(() => {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();

    deletedShelves.forEach(s => {
      if (s.deletedAt && (now - new Date(s.deletedAt).getTime()) > TWELVE_HOURS_MS) {
        permanentlyDeleteShelf(space.id, s.id);
      }
    });

    deletedDocuments.forEach(d => {
      if (d.deletedAt && (now - new Date(d.deletedAt).getTime()) > TWELVE_HOURS_MS) {
        permanentlyDeleteDocument(space.id, d.id);
      }
    });
  }, [deletedShelves, deletedDocuments, space.id, permanentlyDeleteShelf, permanentlyDeleteDocument]);

  const getRemainingTimeString = (deletedAt?: string) => {
    if (!deletedAt) return '12 שעות';
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(deletedAt).getTime();
    const remainingMs = Math.max(0, TWELVE_HOURS_MS - elapsed);
    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    if (remainingHours > 0) {
      return `${remainingHours} שעות ו-${remainingMinutes} דקות`;
    }
    return `${remainingMinutes} דקות`;
  };

  const sortedShelves = useMemo(() => {
    return universalSort(
      activeShelves, 
      (s) => {
        const docs = activeDocuments.filter(d => d.shelfId === s.id);
        return docs.length > 0 ? Math.max(...docs.map(d => new Date(d.createdAt).getTime())) : new Date(s.createdAt || 0).getTime();
      },
      (s) => s.name
    );
  }, [activeShelves, activeDocuments]);

  const filteredShelves = universalSearch(sortedShelves, searchQuery, ['name']);

  if (activeShelves.length === 0 && !showRecycleBin) {
    return (
      <>
        <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗄️</div>
          <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>ברוכים הבאים למחסן המסמכים</h2>
          <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: '1.6' }}>
            כאן תוכלו לשמור, לארגן ולשתף כל מסמך חשוב. צרו מדפים וחלוקות, סרקו מסמכים, ונהלו את המידע החשוב לכם במקום אחד.
          </p>
          <button 
            onClick={() => {
              setPromptInput('');
              setCustomPrompt({
                isOpen: true,
                title: 'יצירת מדף ראשון',
                placeholder: 'הזן שם למדף (לדוגמה: כללי, מסמכים אישיים)...',
                defaultValue: '',
                onSave: (name: string) => {
                  if (name.trim()) {
                    addShelf(space.id, {
                      name: name.trim(),
                      allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : []
                    });
                  }
                }
              });
            }}
            style={{ marginTop: '2rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            צור מדף ראשון
          </button>
        </div>

        {customPrompt?.isOpen && (
          <div 
            onClick={() => setCustomPrompt(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 100006, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', padding: '1rem' }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'white', width: '100%', maxWidth: '380px', borderRadius: '24px', padding: '1.75rem 1.5rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', direction: 'rtl' }}
            >
              <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.25rem', fontWeight: '800', textAlign: 'center' }}>
                {customPrompt.title}
              </h3>
              <input 
                autoFocus
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={customPrompt.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && promptInput.trim()) {
                    customPrompt.onSave(promptInput.trim());
                    setCustomPrompt(null);
                  }
                }}
                style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '1.25rem' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => setCustomPrompt(null)}
                  style={{ flex: 1, padding: '0.85rem', borderRadius: '14px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ביטול
                </button>
                <button 
                  onClick={() => {
                    if (promptInput.trim()) {
                      customPrompt.onSave(promptInput.trim());
                      setCustomPrompt(null);
                    }
                  }}
                  disabled={!promptInput.trim()}
                  style={{ flex: 1.2, padding: '0.85rem', borderRadius: '14px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: promptInput.trim() ? 'pointer' : 'not-allowed', opacity: promptInput.trim() ? 1 : 0.6 }}
                >
                  אישור
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (activeShelfId) {
    const activeShelf = shelves.find(s => s.id === activeShelfId);
    if (!activeShelf) {
      setActiveShelfId(null);
      return null;
    }
    const shelfDocs = [...activeDocuments.filter(d => d.shelfId === activeShelfId), ...uploadingDocs.filter(d => d.shelfId === activeShelfId).map(d => ({ ...d, createdAt: new Date().toISOString(), addedBy: user?.id || '' }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as any[];
    

    return (
      <>
        <div style={{ padding: '0', paddingBottom: '6rem' }}>
        <div style={{ position: 'sticky', top: '56px', zIndex: 100, background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid #e2e8f0', margin: '0 -1rem 1rem -1rem', padding: '0.5rem 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setActiveShelfId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b', padding: '0' }}>
              ←
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                {activeShelf.icon || '🗂️'} {activeShelf.name} <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '6px', marginLeft: '0.4rem', fontWeight: 'bold' }}>v3.0.5</span>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>✏️</span>
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => setEditingShelfCoverId(activeShelf.id)} style={{ background: 'transparent', border: 'none', padding: '0', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                🎨 עיצוב
              </button>
              {totalTrashCount > 0 && (
                <button 
                  onClick={() => setShowRecycleBin(true)}
                  style={{ 
                    padding: '0.35rem 0.5rem', 
                    background: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    borderRadius: '10px', 
                    color: '#ef4444', 
                    fontWeight: 'bold', 
                    fontSize: '0.78rem', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.2rem' 
                  }}
                  title="סל אשפה"
                >
                  <span>🗑️</span>
                  <span>{totalTrashCount}</span>
                </button>
              )}
              <button 
                onClick={() => {
                  const docCount = activeDocuments.filter(d => d.shelfId === activeShelf.id).length;
                  setShelfToDelete({ id: activeShelf.id, name: activeShelf.name, count: docCount });
                }} 
                style={{ background: 'transparent', border: 'none', padding: '0', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                title="מחק מדף זה"
              >
                🗑️ מחק
              </button>
            </div>
          </div>

          {space.settings?.showVaultTimeline ? (
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={() => setActiveTab('timeline')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'timeline' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'timeline' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                ציר זמן (הסיפור)
              </button>
              <button onClick={() => setActiveTab('vault')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'vault' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'vault' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                מחסן מסמכים
              </button>
            </div>
          ) : (
            <div style={{ padding: '0.25rem 0', marginTop: '0.25rem' }}></div>
          )}
        </div>

        {editingShelfCoverId === activeShelf.id && (
          <ShelfCoverPicker 
            onClose={() => setEditingShelfCoverId(null)}
            onSelect={(url, icon, color) => {
              updateShelf(space.id, activeShelf.id, { coverImage: url, icon, highlightColor: color });
              setEditingShelfCoverId(null);
            }} 
          />
        )}

        {activeTab === 'timeline' ? (
          <ShelfTimeline 
            space={space} 
            activeShelfId={activeShelfId} 
            shelfDocs={shelfDocs} 
            onAddEvent={(e) => addShelfEvent(space.id, e)} 
            onUpdateEvent={(id, u) => updateShelfEvent(space.id, id, u)} 
            onRemoveEvent={(id, deleteDocIds) => {
              removeShelfEvent(space.id, id);
              if (deleteDocIds && Array.isArray(deleteDocIds) && deleteDocIds.length > 0) {
                deleteDocIds.forEach(docId => {
                  try {
                    removeDocument(space.id, docId);
                  } catch (err) {
                    console.error('Failed to remove doc', docId, err);
                  }
                });
              }
            }} 
            onAddComment={(id, text) => addShelfEventComment(space.id, id, text)} 
            onRemoveComment={(id, cid) => removeShelfEventComment(space.id, id, cid)} 
            onPreviewDocs={(docs, index) => setPreviewState({ docs, index })}
            onUploadAndLink={async (eventId, url) => {
               await handleSaveDocument(activeShelfId, url, 'document', undefined, eventId);
            }}
          />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
          {(showTimeline || shelfDocs.length > 1) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
              {showTimeline ? (
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '4px', borderRadius: '12px', alignSelf: 'flex-start', border: '1px solid #e2e8f0' }}>
                  <button onClick={() => setFilterLinked('all')} style={{ background: filterLinked === 'all' ? 'white' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: filterLinked === 'all' ? 'bold' : 'normal', color: filterLinked === 'all' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: filterLinked === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>הכל</button>
                  <button onClick={() => setFilterLinked('linked')} style={{ background: filterLinked === 'linked' ? 'white' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: filterLinked === 'linked' ? 'bold' : 'normal', color: filterLinked === 'linked' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: filterLinked === 'linked' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>מקושרים</button>
                  <button onClick={() => setFilterLinked('unlinked')} style={{ background: filterLinked === 'unlinked' ? 'white' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: filterLinked === 'unlinked' ? 'bold' : 'normal', color: filterLinked === 'unlinked' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: filterLinked === 'unlinked' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>לא מקושרים</button>
                </div>
              ) : <div />}

              {shelfDocs.length > 1 && (
                <button 
                  onClick={() => {
                    setIsMultiSelect(prev => !prev);
                    setSelectedDocIds([]);
                  }}
                  style={{
                    background: isMultiSelect ? '#eff6ff' : '#ffffff',
                    border: isMultiSelect ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                    color: isMultiSelect ? '#2563eb' : '#475569',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: isMultiSelect ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                    marginRight: 'auto'
                  }}
                >
                  <span>{isMultiSelect ? '✓ ביטול בחירה' : '☑️ בחירה מרובה לשיתוף'}</span>
                </button>
              )}
            </div>
          )}

          {/* MULTI-SELECT FLOATING ACTION BAR */}
          {isMultiSelect && (
            <div style={{
              background: '#1e293b',
              color: 'white',
              borderRadius: '16px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              position: 'sticky',
              top: '115px',
              zIndex: 90
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                  נבחרו {selectedDocIds.length} מסמכים
                </span>
                <button 
                  onClick={() => {
                    if (selectedDocIds.length === shelfDocs.length) {
                      setSelectedDocIds([]);
                    } else {
                      setSelectedDocIds(shelfDocs.map(d => d.id));
                    }
                  }}
                  style={{ background: 'transparent', border: 'none', color: '#93c5fd', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {selectedDocIds.length === shelfDocs.length ? 'נקה הכל' : 'בחר הכל'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={selectedDocIds.length === 0 || isSharingBatch}
                  onClick={() => shareMultipleDocuments(selectedDocIds)}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: selectedDocIds.length === 0 || isSharingBatch ? 'not-allowed' : 'pointer',
                    opacity: selectedDocIds.length === 0 || isSharingBatch ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span>📤</span> {isSharingBatch ? 'מכין לשיתוף...' : 'שתף נבחרים'}
                </button>

                <button
                  disabled={selectedDocIds.length === 0}
                  onClick={() => setBatchDeleteConfirm(true)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid #ef4444',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    cursor: selectedDocIds.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedDocIds.length === 0 ? 0.6 : 1
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          )}

          {(() => {
            const allSpaceEvents = space.shelfEvents || [];
            const activeShelfEvents = allSpaceEvents.filter(e => e.shelfId === activeShelfId);
            
            const isDocLinked = (docId: string, docUrl?: string) => {
              const cleanId = String(docId || '').trim();
              const cleanUrl = docUrl ? String(docUrl).trim() : '';
              return allSpaceEvents.some(e => {
                const matchesDocId = (e.documentIds || []).some(id => {
                  const sId = String(id || '').trim();
                  return sId === cleanId || (cleanUrl && sId === cleanUrl);
                });
                const matchesTaskId = (e.tasks || []).some(t => {
                  const sTaskId = String(t.documentId || '').trim();
                  return sTaskId === cleanId || (cleanUrl && sTaskId === cleanUrl);
                });
                return matchesDocId || matchesTaskId;
              });
            };

            const getDocLinkedEvent = (docId: string, docUrl?: string) => {
              const cleanId = String(docId || '').trim();
              const cleanUrl = docUrl ? String(docUrl).trim() : '';
              return allSpaceEvents.find(e => {
                const matchesDocId = (e.documentIds || []).some(id => {
                  const sId = String(id || '').trim();
                  return sId === cleanId || (cleanUrl && sId === cleanUrl);
                });
                const matchesTaskId = (e.tasks || []).some(t => {
                  const sTaskId = String(t.documentId || '').trim();
                  return sTaskId === cleanId || (cleanUrl && sTaskId === cleanUrl);
                });
                return matchesDocId || matchesTaskId;
              });
            };

            const filteredDocs = shelfDocs.filter(doc => {
              const isLinked = isDocLinked(doc.id, doc.url);
              if (filterLinked === 'linked') return isLinked;
              if (filterLinked === 'unlinked') return !isLinked;
              return true;
            });
            if (filteredDocs.length === 0) {
              const isFiltered = filterLinked !== 'all';
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3rem 1.5rem',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderRadius: '24px',
                  border: '1.5px dashed #cbd5e1',
                  margin: '1.5rem 0',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }}>
                    {isFiltered ? '🔍' : (activeShelf.icon || '📂')}
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.25rem', fontWeight: 800 }}>
                    {isFiltered ? 'אין מסמכים תואמים לסינון' : `המדף "${activeShelf.name}" ריק כרגע`}
                  </h3>
                  <p style={{ margin: '0 0 1.5rem 0', color: '#64748b', fontSize: '0.9rem', maxWidth: '320px', lineHeight: '1.5' }}>
                    {isFiltered 
                      ? 'נסה לבחור סינון אחר כדי לראות את כל המסמכים במדף זה.' 
                      : 'תוכל לצלם מסמך ישירות למדף זה או לייבא קבצים ותמונות מהמכשיר.'}
                  </p>
                  
                  {isFiltered ? (
                    <button
                      type="button"
                      onClick={() => setFilterLinked('all')}
                      style={{
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '14px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(59,130,246,0.25)'
                      }}
                    >
                      הצג את כל המסמכים
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '280px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', {
                            detail: { shelfId: activeShelfId, mode: 'camera' }
                          }));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '0.8rem 1.25rem',
                          borderRadius: '16px',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>📸</span> צלם מסמך למדף זה
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', {
                            detail: { shelfId: activeShelfId, mode: 'upload' }
                          }));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          background: '#ffffff',
                          color: '#334155',
                          border: '1.5px solid #cbd5e1',
                          padding: '0.75rem 1.25rem',
                          borderRadius: '16px',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>📄</span> ייבא מסמך מקובץ
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveShelfId(null)}
                        style={{
                          background: 'transparent',
                          color: '#64748b',
                          border: 'none',
                          padding: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginTop: '0.25rem'
                        }}
                      >
                        ← חזרה לכל המדפים
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <div onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd} onMouseUp={handleTouchDragEnd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                {filteredDocs.map(doc => {
                  const linkedEvent = getDocLinkedEvent(doc.id, doc.url);
                  const isChecked = selectedDocIds.includes(doc.id);
                  return (
                    <div 
                      key={doc.id} 
                      data-doc-id={doc.id} 
                      onClick={() => {
                        if (isMultiSelect) {
                          setSelectedDocIds(prev => isChecked ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                        }
                      }}
                      style={{ 
                        background: '#f8fafc', 
                        borderRadius: '14px', 
                        overflow: 'visible', 
                        border: isChecked ? '2px solid #2563eb' : (dragOverDocId === doc.id ? '2px dashed #3b82f6' : '1px solid #e2e8f0'), 
                        position: 'relative', 
                        opacity: draggedDocId === doc.id ? 0.4 : (doc.id.startsWith('temp-') ? 0.6 : 1), 
                        transition: 'all 0.2s', 
                        transform: isChecked ? 'scale(1.02)' : (dragOverDocId === doc.id ? 'scale(1.02)' : 'scale(1)'), 
                        boxShadow: isChecked ? '0 6px 16px rgba(37,99,235,0.2)' : 'none',
                        display: 'flex', 
                        flexDirection: 'column',
                        cursor: isMultiSelect ? 'pointer' : 'default'
                      }}
                    >
                      {/* MULTI SELECT CHECKBOX OVERLAY */}
                      {isMultiSelect && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          zIndex: 25,
                          background: isChecked ? '#2563eb' : 'rgba(255,255,255,0.9)',
                          color: 'white',
                          borderRadius: '8px',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: isChecked ? 'none' : '2px solid #94a3b8',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          fontSize: '0.85rem',
                          fontWeight: 'bold'
                        }}>
                          {isChecked ? '✓' : ''}
                        </div>
                      )}

                      {doc.id.startsWith('temp-') && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', zIndex: 20 }}>מעלה...</div>}
                      

                      {((doc.url && doc.url.includes('.pdf')) || doc.url?.startsWith('data:application/pdf') || doc.type === 'pdf') ? (
                        <div onClick={(e) => { if (isMultiSelect) return; e.stopPropagation(); setPreviewState({ docs: filteredDocs, index: filteredDocs.findIndex(d => d.id === doc.id) }); }} style={{ height: '160px', background: '#e2e8f0', backgroundImage: doc.thumbnailUrl ? 'url(' + doc.thumbnailUrl + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in', position: 'relative', borderTopLeftRadius: '13px', borderTopRightRadius: '13px', overflow: 'hidden' }}>
                          {!doc.thumbnailUrl && <span style={{ fontSize: '3rem' }}>📄</span>}
                          <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '1px' }}>PDF</div>
                          
                          {/* Subtle Storage Location Badge */}
                          <div 
                            title={doc.storageTarget === 'local' ? 'שמור מקומית במכשיר' : doc.storageTarget === 'gdrive' ? 'שמור ב-Google Drive' : 'שמור בענן MySpace'}
                            style={{ 
                              position: 'absolute', 
                              bottom: '6px', 
                              right: '6px', 
                              background: doc.storageTarget === 'local' ? 'rgba(16, 185, 129, 0.85)' : doc.storageTarget === 'gdrive' ? 'rgba(234, 179, 8, 0.85)' : 'rgba(37, 99, 235, 0.85)', 
                              color: 'white', 
                              padding: '2px 6px', 
                              borderRadius: '6px', 
                              fontSize: '0.65rem', 
                              fontWeight: 700, 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '3px',
                              backdropFilter: 'blur(4px)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                            }}
                          >
                            <span>{doc.storageTarget === 'local' ? '📱' : doc.storageTarget === 'gdrive' ? '📁' : '☁️'}</span>
                            <span>{doc.storageTarget === 'local' ? 'מקומי' : doc.storageTarget === 'gdrive' ? 'Drive' : 'ענן'}</span>
                          </div>
                        </div>
                      ) : (
                        <div onClick={(e) => { if (isMultiSelect) return; e.stopPropagation(); setPreviewState({ docs: filteredDocs, index: filteredDocs.findIndex(d => d.id === doc.id) }); }} style={{ height: '160px', background: '#e2e8f0', backgroundImage: 'url(' + (doc.thumbnailUrl || doc.url) + ')', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'zoom-in', position: 'relative', borderTopLeftRadius: '13px', borderTopRightRadius: '13px', overflow: 'hidden' }}>
                          {/* Subtle Storage Location Badge */}
                          <div 
                            title={doc.storageTarget === 'local' ? 'שמור מקומית במכשיר' : doc.storageTarget === 'gdrive' ? 'שמור ב-Google Drive' : 'שמור בענן MySpace'}
                            style={{ 
                              position: 'absolute', 
                              bottom: '6px', 
                              right: '6px', 
                              background: doc.storageTarget === 'local' ? 'rgba(16, 185, 129, 0.85)' : doc.storageTarget === 'gdrive' ? 'rgba(234, 179, 8, 0.85)' : 'rgba(37, 99, 235, 0.85)', 
                              color: 'white', 
                              padding: '2px 6px', 
                              borderRadius: '6px', 
                              fontSize: '0.65rem', 
                              fontWeight: 700, 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '3px',
                              backdropFilter: 'blur(4px)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                            }}
                          >
                            <span>{doc.storageTarget === 'local' ? '📱' : doc.storageTarget === 'gdrive' ? '📁' : '☁️'}</span>
                            <span>{doc.storageTarget === 'local' ? 'מקומי' : doc.storageTarget === 'gdrive' ? 'Drive' : 'ענן'}</span>
                          </div>
                        </div>
                      )}
                      
                      {!isMultiSelect && (
                        <div onTouchStart={(e) => handleTouchDragStart(e, doc.id)} onMouseDown={(e) => handleTouchDragStart(e, doc.id)} style={{ display: 'flex', justifyContent: 'center', padding: '0.35rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', cursor: 'grab' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '2px' }}>|||</span>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div 
                          onClick={(e) => { 
                            if (isMultiSelect) return;
                            e.stopPropagation(); 
                            setPromptInput(doc.title);
                            setCustomPrompt({
                              isOpen: true,
                              title: 'עריכת כותרת מסמך',
                              placeholder: 'הזן כותרת...',
                              defaultValue: doc.title,
                              onSave: (val: string) => {
                                if (val.trim()) updateDocument(space.id, doc.id, { title: val.trim() });
                              }
                            });
                          }} 
                          style={{ padding: '0.5rem 0.5rem 0.2rem 0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} 
                          title="לחץ לשינוי שם"
                        >
                          {doc.title}
                        </div>
                        <div style={{ padding: '0 0.5rem 0.2rem 0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
                          {new Date(doc.createdAt).toLocaleDateString('he-IL')}
                        </div>
                        
                        {linkedEvent && (
                          <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
                            <div 
                              onClick={(e) => { 
                                if (isMultiSelect) return;
                                e.stopPropagation(); 
                                setActiveTab('timeline'); 
                                setTimeout(() => {
                                  const el = document.getElementById('event-' + linkedEvent.id);
                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                              }} 
                              style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontWeight: 'bold', maxWidth: '100%' }}
                              title={'מקושר ל: ' + linkedEvent.title}
                            >
                              🔗 <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkedEvent.title}</span>
                            </div>
                          </div>
                        )}
                        
                        {!isMultiSelect && (
                          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '0.35rem 0.4rem', position: 'relative', gap: '0.2rem', borderBottomLeftRadius: '13px', borderBottomRightRadius: '13px' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSharingDoc(doc); }}
                                style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '0.25rem 0.45rem', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}
                                title="שתף מסמך"
                              >
                                📤 שתף
                              </button>
                              
                              {/* Link to Timeline Station (Only if timeline is enabled in space) */}
                              {showTimeline && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinkStationDoc({ docId: doc.id, title: doc.title, url: doc.url });
                                  }}
                                  style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '0.25rem 0.4rem', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem', whiteSpace: 'nowrap' }}
                                  title={linkedEvent ? 'שנה שיוך לתחנה' : 'שייך לתחנה בציר'}
                                >
                                  🔗 {linkedEvent ? 'תחנה' : 'קשר'}
                                </button>
                              )}

                              {/* Move to another shelf */}
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveDocument(doc.id, activeShelf.id);
                                }}
                                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.25rem 0.4rem', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem', whiteSpace: 'nowrap' }}
                                title="העבר למדף אחר"
                              >
                                🔄 העבר
                              </button>
                            </div>

                            {/* 3-Dots Action Menu Trigger */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDocMenuId(activeDocMenuId === doc.id ? null : doc.id);
                                }}
                                style={{ background: activeDocMenuId === doc.id ? '#e2e8f0' : 'transparent', color: '#475569', border: 'none', borderRadius: '6px', width: '24px', height: '24px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="פעולות נוספות"
                              >
                                ⋮
                              </button>

                              {activeDocMenuId === doc.id && (
                                <>
                                  <div 
                                    onClick={(e) => { e.stopPropagation(); setActiveDocMenuId(null); }}
                                    style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                                  />
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'absolute',
                                      bottom: '120%',
                                      left: 0,
                                      right: 'auto',
                                      background: 'white',
                                      borderRadius: '14px',
                                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                      border: '1px solid #e2e8f0',
                                      padding: '0.4rem',
                                      zIndex: 9999,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.2rem',
                                      minWidth: '175px',
                                      textAlign: 'right',
                                      direction: 'rtl'
                                    }}
                                  >
                                    {/* Download to Device */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDocMenuId(null);
                                        downloadDocument(doc.url, doc.title);
                                      }}
                                      style={{ background: 'transparent', border: 'none', padding: '0.55rem 0.75rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.82rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}
                                    >
                                      <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>⬇️</span> הורד למכשיר
                                    </button>

                                    {/* Save to Local MySpace Folder */}
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        setActiveDocMenuId(null);
                                        try {
                                          const safeSpaceTitle = space.title || 'General';
                                          const ext = doc.url.includes('.pdf') || doc.type === 'pdf' ? 'pdf' : 'jpg';
                                          const fileName = `${doc.title || 'מסמך'}_${Date.now()}.${ext}`;
                                          const res = await saveLocalDeviceFile(safeSpaceTitle, fileName, doc.url);
                                          if (res.success) {
                                            alert(`המסמך נשמר בהצלחה בתיקיית המכשיר:\n${res.localPath}`);
                                          } else {
                                            alert(`שגיאה בשמירה למכשיר: ${res.error || 'נסה שוב'}`);
                                          }
                                        } catch (err: any) {
                                          alert(`שגיאה בשמירה: ${err.message || ''}`);
                                        }
                                      }}
                                      style={{ background: 'transparent', border: 'none', padding: '0.55rem 0.75rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.82rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}
                                    >
                                      <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>📱</span> שמור בתיקיית MySpace
                                    </button>

                                    {/* Edit Title */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDocMenuId(null);
                                        setPromptInput(doc.title);
                                        setCustomPrompt({
                                          isOpen: true,
                                          title: 'עריכת כותרת מסמך',
                                          placeholder: 'הזן כותרת...',
                                          defaultValue: doc.title,
                                          onSave: (val: string) => {
                                            if (val.trim()) updateDocument(space.id, doc.id, { title: val.trim() });
                                          }
                                        });
                                      }}
                                      style={{ background: 'transparent', border: 'none', padding: '0.55rem 0.75rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.82rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                      <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>✏️</span> ערוך כותרת
                                    </button>

                                    {/* Convert to Expense (Only if finance plugin exists in space) */}
                                    {hasFinance && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveDocMenuId(null);
                                          window.dispatchEvent(new CustomEvent('smartshare:convert_doc_to_expense', { 
                                            detail: { url: doc.url, allPages: doc.pages || [doc.url], title: doc.title } 
                                          }));
                                        }}
                                        style={{ background: 'transparent', border: 'none', padding: '0.55rem 0.75rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.82rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                      >
                                        <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>🧾</span> הוסף להוצאות המרחב
                                      </button>
                                    )}

                                    <div style={{ height: '1px', background: '#e2e8f0', margin: '0.2rem 0' }} />

                                    {/* Delete Document */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDocMenuId(null);
                                        handleDeleteDocument(doc.id, doc.title);
                                      }}
                                      style={{ background: '#fef2f2', border: 'none', padding: '0.55rem 0.75rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                      <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>🗑️</span> מחק מסמך
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        )}
      </div>
      {pendingImport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', color: '#1e293b', fontSize: '1.25rem' }}>{pendingImport?.docId ? 'לאיזה מדף להעביר את המסמך?' : 'לאיזה מדף לשמור את הקובץ?'}</h3>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: 0 }}>{pendingImport?.docId ? 'בחר את המדף שאליו תרצה להעביר את המסמך' : 'בחר את המדף שאליו יתווסף המסמך החדש'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              {(() => {
                const availableShelves = shelves.filter(s => !s.deletedAt && (pendingImport?.docId ? s.id !== activeShelfId : true));
                if (availableShelves.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.9rem' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📂</div>
                      אין מדפים נוספים במרחב זה להעברה.<br />(המסמך כבר נמצא במדף הנוכחי).
                    </div>
                  );
                }
                return availableShelves.map(shelf => {
                 return (
                  <button key={shelf.id} onClick={() => {
                      if (pendingImport.docId) {
                        updateDocument(space.id, pendingImport.docId, { shelfId: shelf.id });
                      } else {
                        handleSaveDocument(shelf.id, pendingImport.url!, pendingImport.type || 'document', pendingImport.allPages);
                      }
                      setPendingImport(null);
                    }} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', textAlign: 'right', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: shelf.highlightColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: shelf.highlightColor ? `0 0 10px ${shelf.highlightColor}80` : 'none', fontSize: '1.2rem' }}>
                      {shelf.icon || '📁'}
                    </div>
                    {shelf.name}
                  </button>
                 );
                });
              })()}
            </div>
            <button onClick={() => setPendingImport(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '1rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>ביטול פעולה</button>
          </div>
        </div>
      )}

      {/* LINK TO STATION MODAL */}
      {linkStationDoc && (() => {
        const activeShelfEvents = (space.shelfEvents || []).filter(e => e.shelfId === activeShelfId);
        const currentLinkedEvent = activeShelfEvents.find(e => {
          const cleanId = String(linkStationDoc.docId || '').trim();
          const cleanUrl = String(linkStationDoc.url || '').trim();
          return (e.documentIds || []).some(id => {
            const sId = String(id || '').trim();
            return sId === cleanId || (cleanUrl && sId === cleanUrl);
          });
        });

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '1.5rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>שיוך מסמך לתחנה בציר הזמן</h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                    {linkStationDoc.title}
                  </div>
                </div>
                <button onClick={() => setLinkStationDoc(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              {currentLinkedEvent && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                    <strong>משויך כרגע לתחנה:</strong><br />
                    {currentLinkedEvent.title}
                  </div>
                  <button 
                    onClick={() => {
                      const newIds = (currentLinkedEvent.documentIds || []).filter(id => id !== linkStationDoc.docId && id !== linkStationDoc.url);
                      updateShelfEvent(space.id, currentLinkedEvent.id, { documentIds: newIds });
                      setLinkStationDoc(null);
                    }}
                    style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    בטל שיוך
                  </button>
                </div>
              )}

              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.5rem' }}>
                בחר תחנה לשיוך:
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '0.5rem' }}>
                {activeShelfEvents.length > 0 ? activeShelfEvents.map(event => {
                  const isCurrent = event.id === currentLinkedEvent?.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        // If previously linked to another event, unlink it
                        if (currentLinkedEvent && currentLinkedEvent.id !== event.id) {
                          const oldIds = (currentLinkedEvent.documentIds || []).filter(id => id !== linkStationDoc.docId && id !== linkStationDoc.url);
                          updateShelfEvent(space.id, currentLinkedEvent.id, { documentIds: oldIds });
                        }
                        // Link to new event
                        const newIds = (event.documentIds || []).includes(linkStationDoc.docId)
                          ? event.documentIds
                          : [...(event.documentIds || []), linkStationDoc.docId];
                        updateShelfEvent(space.id, event.id, { documentIds: newIds });
                        setLinkStationDoc(null);
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        background: isCurrent ? '#eff6ff' : '#f8fafc',
                        border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'right',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isCurrent ? '#1d4ed8' : '#1e293b' }}>
                          {event.title}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          📅 {new Date(event.eventDate).toLocaleDateString('he-IL')} • {(event.documentIds || []).length} קבצים
                        </span>
                      </div>
                      {isCurrent && <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>}
                    </button>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    עדיין אין תחנות בציר הזמן של מדף זה.<br />
                    עבור ללשונית "ציר זמן" והוסף תחנה חדשה.
                  </div>
                )}
              </div>

              <button 
                onClick={() => setLinkStationDoc(null)} 
                style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                סגור
              </button>
            </div>
          </div>
        );
      })()}

      {/* UNIVERSAL VIEWER ENGINE MODAL (CAMSCANNER STYLE) */}
      {previewState && (
        <UniversalViewerModal
          docs={previewState.docs}
          initialIndex={previewState.index}
          onClose={() => setPreviewState(null)}
          onShare={(doc) => setSharingDoc(doc)}
          onDownload={(url, title) => downloadDocument(url, title)}
          onNormalizeDoc={(docId, pages) => {
            if (typeof updateDocument === 'function') {
              updateDocument(space.id, docId, { pages });
            }
          }}
        />
      )}

      {/* Share Choice Modal (Single Source of Truth) */}
      <ShareChoiceModal 
        isOpen={Boolean(sharingDoc)} 
        doc={sharingDoc} 
        onClose={() => setSharingDoc(null)} 
      />

      {/* CONFIRM DELETE SHELF MODAL */}
      <ConfirmModal
        isOpen={Boolean(shelfToDelete)}
        title="מחיקת מדף"
        message={shelfToDelete?.count ? `מדף זה מכיל ${shelfToDelete.count} מסמכים. במחיקת המדף, המדף והמסמכים שבו יועברו לסל האשפה ויישמרו שם לזמן מוגבל.` : 'האם אתה בטוח שברצונך להעביר מדף זה לסל האשפה?'}
        itemTitle={shelfToDelete?.name}
        confirmText="העבר לסל אשפה"
        onConfirm={() => {
          if (shelfToDelete) {
            removeShelf(space.id, shelfToDelete.id);
            if (activeShelfId === shelfToDelete.id) {
              setActiveShelfId(null);
            }
            setShelfToDelete(null);
          }
        }}
        onClose={() => setShelfToDelete(null)}
      />

      {/* CONFIRM PERMANENT DELETE SHELF MODAL */}
      <ConfirmModal
        isOpen={Boolean(shelfToPermanentDelete)}
        title="מחיקת מדף לצמיתות"
        message="פעולה זו היא בלתי הפיכה! המדף וכל המסמכים שהיו שייכים אליו יימחקו לחלוטין מהמערכת."
        itemTitle={shelfToPermanentDelete?.name}
        confirmText="מחק לצמיתות"
        onConfirm={() => {
          if (shelfToPermanentDelete) {
            permanentlyDeleteShelf(space.id, shelfToPermanentDelete.id);
            setShelfToPermanentDelete(null);
          }
        }}
        onClose={() => setShelfToPermanentDelete(null)}
      />

      {/* CONFIRM DELETE SINGLE DOCUMENT MODAL */}
      <ConfirmModal
        isOpen={Boolean(docToDelete)}
        title="העברת מסמך לסל אשפה"
        message="המסמך יועבר לסל האשפה ויישמר שם למשך 12 שעות, ולאחר מכן יימחק לצמיתות כדי לפנות מקום בענן. תוכל לשחזר אותו בכל עת מסל האשפה."
        itemTitle={docToDelete?.title}
        confirmText="העבר לסל אשפה"
        onConfirm={() => {
          if (docToDelete) {
            removeDocument(space.id, docToDelete.id);
            setDocToDelete(null);
          }
        }}
        onClose={() => setDocToDelete(null)}
      />

      {/* CONFIRM BATCH DELETE MODAL */}
      <ConfirmModal
        isOpen={batchDeleteConfirm}
        title="העברת מסמכים נבחרים לסל אשפה"
        message={`האם להעביר ${selectedDocIds.length} מסמכים שנבחרו לסל האשפה? הם יישמרו בסל האשפה למשך 12 שעות וניתן יהיה לשחזר אותם.`}
        confirmText={`העבר ${selectedDocIds.length} מסמכים לסל אשפה`}
        onConfirm={() => {
          selectedDocIds.forEach(id => removeDocument(space.id, id));
          setSelectedDocIds([]);
          setBatchDeleteConfirm(false);
          setIsMultiSelect(false);
        }}
        onClose={() => setBatchDeleteConfirm(false)}
      />

      {/* CONFIRM PERMANENT DELETE DOCUMENT MODAL */}
      <ConfirmModal
        isOpen={Boolean(docToPermanentDelete)}
        title="מחיקת מסמך לצמיתות"
        message="פעולה זו היא בלתי הפיכה! המסמך יימחק לחלוטין ולצמיתות משרתי הענן ולא ניתן יהיה לשחזרו."
        itemTitle={docToPermanentDelete?.title}
        confirmText="מחק לצמיתות מהענן"
        onConfirm={() => {
          if (docToPermanentDelete) {
            permanentlyDeleteDocument(space.id, docToPermanentDelete.id);
            setDocToPermanentDelete(null);
          }
        }}
        onClose={() => setDocToPermanentDelete(null)}
      />

      </>
    );
  }

  return (
    <div style={{ padding: '0', paddingBottom: '6rem' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(10px)', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', display: 'flex', flexDirection: 'column', lineHeight: '1', flexShrink: 0 }}>
          מחסן
          <span style={{ fontSize: '0.6rem', color: '#3b82f6', marginTop: '2px' }}>v3.0.5</span>
        </h2>
        <input 
          type="text" 
          placeholder="חיפוש מדפים..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '90px', padding: '0.55rem 0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.88rem' }}
        />
        {totalTrashCount > 0 && (
          <button 
            onClick={() => setShowRecycleBin(!showRecycleBin)}
            style={{ 
              padding: '0.45rem 0.55rem', 
              background: showRecycleBin ? '#ef4444' : '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '12px', 
              color: showRecycleBin ? 'white' : '#ef4444', 
              fontWeight: 'bold', 
              fontSize: '0.8rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.2rem', 
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title="סל אשפה (מדפים ומסמכים שנמחקו)"
          >
            <span>🗑️</span>
            <span style={{ fontSize: '0.75rem' }}>{totalTrashCount}</span>
          </button>
        )}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button 
            onClick={() => setShowViewMenu(!showViewMenu)} 
            style={{ height: '100%', padding: '0.45rem 0.6rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#475569', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
          >
            <span>{viewMode === 'feed' ? '📑' : viewMode === 'grid' ? '▦' : '⭕'}</span>
            <span style={{ display: 'none', minWidth: '35px' }} className="sm-inline"> תצוגה</span>
          </button>
          {showViewMenu && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', padding: '0.5rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '130px' }}>
              <button onClick={() => { handleSetViewMode('feed'); setShowViewMenu(false); }} style={{ background: viewMode === 'feed' ? '#f8fafc' : 'transparent', border: 'none', padding: '0.75rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: viewMode === 'feed' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📑</span> רשימה
              </button>
              <button onClick={() => { handleSetViewMode('grid'); setShowViewMenu(false); }} style={{ background: viewMode === 'grid' ? '#f8fafc' : 'transparent', border: 'none', padding: '0.75rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: viewMode === 'grid' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>▦</span> כרטיסיות
              </button>
              <button onClick={() => { handleSetViewMode('circles'); setShowViewMenu(false); }} style={{ background: viewMode === 'circles' ? '#f8fafc' : 'transparent', border: 'none', padding: '0.75rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: viewMode === 'circles' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⭕</span> עיגולים
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Discovery Banner */}
      {!space.settings?.showVaultTimeline && !isTimelineTipDismissed && (
        <div style={{
          position: 'relative',
          margin: '0 1rem 1.25rem 1rem',
          padding: '1.25rem 1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
          border: '1.5px dashed #60a5fa',
          boxShadow: '0 4px 15px rgba(59, 130, 246, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <button 
            onClick={() => setIsTimelineTipDismissed(true)}
            style={{ position: 'absolute', top: '10px', left: '10px', background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', padding: '4px' }}
            title="סגור הודעה זו"
          >
            ✕
          </button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem', flexShrink: 0 }}>💡</span>
            <div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b', fontSize: '1rem', fontWeight: '800' }}>
                הידעת? ניתן להפעיל במרחב זה את 'ציר זמן ותחנות'
              </h4>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', lineHeight: '1.5' }}>
                ציר הזמן מאפשר לסדר מסמכים ואירועים לפי תחנות כרונולוגיות (כמו סיפור המרחב). ניתן להפעיל אותו בכל שלב בהגדרות המרחב.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.25rem' }}>
            <a 
              href={`/space/${space.id}/settings?openFeature=vault`}
              style={{ padding: '0.45rem 1.1rem', background: '#3b82f6', color: 'white', borderRadius: '50px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>⚙️</span> להפעלת ציר הזמן
            </a>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const snoozeUntil = Date.now() + 12 * 3600 * 1000; // 12 hours
                  localStorage.setItem(timelineSnoozeKey, String(snoozeUntil));
                }
                setIsTimelineTipDismissed(true);
              }}
              style={{ padding: '0.45rem 1rem', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '50px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ⏰ הזכר לי בעוד 12 שעות
            </button>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(timelineHideKey, '1');
                }
                setIsTimelineTipDismissed(true);
              }}
              style={{ padding: '0.45rem 0.9rem', background: 'transparent', color: '#64748b', border: 'none', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              הבנתי, אל תציג שוב
            </button>
          </div>
        </div>
      )}

      {/* Recycle Bin Modal with Backdrop (Click outside to close) */}
      {showRecycleBin && (
        <div 
          onClick={() => setShowRecycleBin(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100005,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '480px',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #fecdd3',
              overflow: 'hidden',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', borderBottom: '1px solid #fecdd3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#9f1239', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🗑️</span> סל אשפה ({totalTrashCount})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#be123c', fontSize: '0.78rem' }}>
                  פריטים נשמרים למשך 12 שעות ולאחר מכן נמחקים אוטומטית לצמיתות
                </p>
              </div>
              <button 
                onClick={() => setShowRecycleBin(false)} 
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid #fecdd3', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', cursor: 'pointer', color: '#9f1239', fontWeight: 'bold' }}
                title="סגור (או לחץ על הרקע)"
              >
                ✕
              </button>
            </div>

            {/* Tabs (Shelves / Documents) */}
            <div style={{ display: 'flex', background: '#f8fafc', padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRecycleBinTab('shelves')}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: recycleBinTab === 'shelves' ? '#ffffff' : 'transparent',
                  color: recycleBinTab === 'shelves' ? '#1e293b' : '#64748b',
                  fontWeight: recycleBinTab === 'shelves' ? 800 : 600,
                  fontSize: '0.88rem',
                  boxShadow: recycleBinTab === 'shelves' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>🗂️</span> מדפים ({deletedShelves.length})
              </button>
              <button
                type="button"
                onClick={() => setRecycleBinTab('documents')}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: recycleBinTab === 'documents' ? '#ffffff' : 'transparent',
                  color: recycleBinTab === 'documents' ? '#1e293b' : '#64748b',
                  fontWeight: recycleBinTab === 'documents' ? 800 : 600,
                  fontSize: '0.88rem',
                  boxShadow: recycleBinTab === 'documents' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>📄</span> מסמכים ({deletedDocuments.length})
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {recycleBinTab === 'shelves' ? (
                deletedShelves.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗂️</div>
                    <div style={{ fontWeight: 600 }}>אין מדפים בסל האשפה</div>
                  </div>
                ) : (
                  deletedShelves.map(s => {
                    const docCount = documents.filter(d => d.shelfId === s.id).length;
                    const timeLeft = getRemainingTimeString(s.deletedAt);
                    return (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ fontSize: '1.4rem' }}>{s.icon || '🗂️'}</span>
                          <div>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              {docCount} מסמכים &bull; <span style={{ color: '#dc2626', fontWeight: 600 }}>⏳ נותרו {timeLeft}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            type="button"
                            onClick={() => restoreShelf(space.id, s.id)}
                            style={{ padding: '0.45rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          >
                            ↩️ שחזר
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShelfToPermanentDelete({ id: s.id, name: s.name })}
                            style={{ padding: '0.45rem 0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                            title="מחק לצמיתות עכשיו"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                deletedDocuments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
                    <div style={{ fontWeight: 600 }}>אין מסמכים בסל האשפה</div>
                  </div>
                ) : (
                  deletedDocuments.map(doc => {
                    const shelf = shelves.find(s => s.id === doc.shelfId);
                    const timeLeft = getRemainingTimeString(doc.deletedAt);
                    return (
                      <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e2e8f0', backgroundImage: doc.thumbnailUrl ? `url(${doc.thumbnailUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>
                            {!doc.thumbnailUrl && (doc.type === 'pdf' ? '📄' : '🖼️')}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                              {doc.title || 'מסמך'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                              מדף: {shelf?.name || 'ללא מדף'} &bull; <span style={{ color: '#dc2626', fontWeight: 600 }}>⏳ נותרו {timeLeft}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                          <button 
                            type="button"
                            onClick={() => restoreDocument(space.id, doc.id)}
                            style={{ padding: '0.45rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          >
                            ↩️ שחזר
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDocToPermanentDelete({ id: doc.id, title: doc.title })}
                            style={{ padding: '0.45rem 0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                            title="מחק לצמיתות מהענן"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowRecycleBin(false)}
                style={{
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {editingShelfCoverId && (
        <ShelfCoverPicker 
          onClose={() => setEditingShelfCoverId(null)}
          onSelect={(url, icon, color) => {
            updateShelf(space.id, editingShelfCoverId, { coverImage: url, icon, highlightColor: color });
            setEditingShelfCoverId(null);
          }} 
        />
      )}

      {viewMode === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => d.addedBy !== user?.id && (Date.now() - new Date(d.createdAt).getTime() < 86400000));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : {});

            return (
              <div key={shelf.id} style={{ background: '#ffffff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', position: 'relative', ...highlightStyle }}>
                {hasNewRemoteDoc && <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', background: '#ef4444', borderRadius: '50%', border: '2px solid white' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div onClick={() => setActiveShelfId(shelf.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', cursor: 'pointer' }}>
                      {!shelf.coverImage && (shelf.icon || '🗂️')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <h3 onClick={() => setActiveShelfId(shelf.id)} style={{ margin: 0, fontSize: '1.1rem', color: '#334155', cursor: 'pointer' }}>
                        {shelf.name} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>({shelfDocs.length})</span>
                      </h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRenameShelf(shelf.id, shelf.name); }} 
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.85rem', color: '#64748b', opacity: 0.7 }}
                        title="עריכת שם מדף"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isPrivate && <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>🔒</span>}
                    <button onClick={() => setEditingShelfCoverId(shelf.id)} style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }} title="עיצוב מדף">🎨</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const docCount = documents.filter(d => d.shelfId === shelf.id).length;
                      setShelfToDelete({ id: shelf.id, name: shelf.name, count: docCount });
                    }} style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }} title="מחק מדף">🗑️</button>
                  </div>
                </div>
                
                {/* Removed document previews here per user request, user must click shelf to see contents */}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', padding: '0 1rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const hasNewRemoteDoc = shelfDocs.some(d => d.addedBy !== user?.id && (Date.now() - new Date(d.createdAt).getTime() < 86400000));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : { border: '1px solid #f1f5f9' });

            return (
              <div key={shelf.id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative', ...highlightStyle }}>
                {hasNewRemoteDoc && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }} />}
                
                <div onClick={() => setActiveShelfId(shelf.id)} style={{ height: '100px', background: '#e2e8f0', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                </div>
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', marginBottom: '0.25rem' }}>
                    <div onClick={() => setActiveShelfId(shelf.id)} style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{shelf.name}</div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRenameShelf(shelf.id, shelf.name); }} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.8rem', color: '#64748b', opacity: 0.7 }}
                      title="עריכת שם מדף"
                    >
                      ✏️
                    </button>
                  </div>
                  <div onClick={() => setActiveShelfId(shelf.id)} style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{shelfDocs.length} מסמכים</div>
                  <div onClick={() => setActiveShelfId(shelf.id)} style={{ color: '#cbd5e1', fontSize: '0.65rem', marginTop: '0.25rem' }}>נוצר: {new Date(shelf.createdAt).toLocaleDateString('he-IL')}</div>
                  <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.3rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingShelfCoverId(shelf.id); }} style={{ background: '#f1f5f9', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="עיצוב">🎨</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const docCount = documents.filter(d => d.shelfId === shelf.id).length;
                      setShelfToDelete({ id: shelf.id, name: shelf.name, count: docCount });
                    }} style={{ background: '#fef2f2', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }} title="מחק מדף">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'circles' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'flex-start', padding: '0 1rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => d.addedBy !== user?.id && (Date.now() - new Date(d.createdAt).getTime() < 86400000));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '3px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '3px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '60' } : { border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' });

            return (
              <div key={shelf.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: '90px', position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setEditingShelfCoverId(shelf.id); }} style={{ position: 'absolute', top: 0, left: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', zIndex: 10, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="עיצוב">🎨</button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  const docCount = documents.filter(d => d.shelfId === shelf.id).length;
                  setShelfToDelete({ id: shelf.id, name: shelf.name, count: docCount });
                }} style={{ position: 'absolute', top: 0, right: 0, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', zIndex: 10, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="מחק מדף">🗑️</button>
                {hasNewRemoteDoc && <div style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }} />}
                
                <div onClick={() => setActiveShelfId(shelf.id)} style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', ...highlightStyle, position: 'relative' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                  {isPrivate && <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#ef4444', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: '2px solid white' }}>🔒</div>}
                  <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', color: '#334155', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{shelfDocs.length}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', width: '100%' }}>
                  <div onClick={() => setActiveShelfId(shelf.id)} style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shelf.name}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRenameShelf(shelf.id, shelf.name); }} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '1px', fontSize: '0.75rem', color: '#64748b', opacity: 0.7, flexShrink: 0 }}
                    title="עריכת שם מדף"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    
      {pendingImport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', color: '#1e293b', fontSize: '1.25rem' }}>{pendingImport?.docId ? 'לאיזה מדף להעביר את המסמך?' : 'לאיזה מדף לשמור את הקובץ?'}</h3>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: 0 }}>{pendingImport?.docId ? 'בחר את המדף שאליו תרצה להעביר את המסמך' : 'בחר את המדף שאליו יתווסף המסמך החדש'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              {(() => {
                const currentDoc = pendingImport?.docId ? documents.find(d => d.id === pendingImport.docId) : null;
                const filterOutShelfId = activeShelfId || currentDoc?.shelfId;
                const availableShelves = shelves.filter(s => !s.deletedAt && (pendingImport?.docId ? s.id !== filterOutShelfId : true));
                if (availableShelves.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.9rem' }}>
                      <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📂</div>
                      אין מדפים נוספים במרחב זה להעברה.<br />(המסמך כבר נמצא במדף זה).
                    </div>
                  );
                }
                return availableShelves.map(shelf => {
                 return (
                  <button key={shelf.id} onClick={() => {
                      if (pendingImport.docId) {
                        updateDocument(space.id, pendingImport.docId, { shelfId: shelf.id });
                      } else {
                        handleSaveDocument(shelf.id, pendingImport.url!, pendingImport.type || 'document', pendingImport.allPages);
                      }
                      setPendingImport(null);
                    }} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', textAlign: 'right', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: shelf.highlightColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: shelf.highlightColor ? `0 0 10px ${shelf.highlightColor}80` : 'none', fontSize: '1.2rem' }}>
                      {shelf.icon || '📁'}
                    </div>
                    {shelf.name}
                  </button>
                 );
                });
              })()}
            </div>
            <button onClick={() => setPendingImport(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '1rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>ביטול פעולה</button>
          </div>
        </div>
      )}

      


            {/* CONFIRM DELETE SHELF MODAL (Outer Shelves View) */}
      <ConfirmModal
        isOpen={Boolean(shelfToDelete)}
        title="מחיקת מדף"
        message={shelfToDelete?.count ? `מדף זה מכיל ${shelfToDelete.count} מסמכים. במחיקת המדף, המדף והמסמכים שבו יועברו לסל האשפה ויישמרו שם לזמן מוגבל.` : 'האם אתה בטוח שברצונך להעביר מדף זה לסל האשפה?'}
        itemTitle={shelfToDelete?.name}
        confirmText="העבר לסל אשפה"
        onConfirm={() => {
          if (shelfToDelete) {
            removeShelf(space.id, shelfToDelete.id);
            if (activeShelfId === shelfToDelete.id) {
              setActiveShelfId(null);
            }
            setShelfToDelete(null);
          }
        }}
        onClose={() => setShelfToDelete(null)}
      />

      {/* CONFIRM PERMANENT DELETE SHELF MODAL (Outer Shelves View) */}
      <ConfirmModal
        isOpen={Boolean(shelfToPermanentDelete)}
        title="מחיקת מדף לצמיתות"
        message="פעולה זו היא בלתי הפיכה! המדף וכל המסמכים שהיו שייכים אליו יימחקו לחלוטין מהמערכת."
        itemTitle={shelfToPermanentDelete?.name}
        confirmText="מחק לצמיתות"
        onConfirm={() => {
          if (shelfToPermanentDelete) {
            permanentlyDeleteShelf(space.id, shelfToPermanentDelete.id);
            setShelfToPermanentDelete(null);
          }
        }}
        onClose={() => setShelfToPermanentDelete(null)}
      />

{/* CUSTOM PROMPT MODAL (REPLACES BROWSER window.prompt) */}
      {customPrompt?.isOpen && (
        <div 
          onClick={() => setCustomPrompt(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100006, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', padding: '1rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', width: '100%', maxWidth: '380px', borderRadius: '24px', padding: '1.75rem 1.5rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', direction: 'rtl' }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.25rem', fontWeight: '800', textAlign: 'center' }}>
              {customPrompt.title}
            </h3>
            <input 
              autoFocus
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={customPrompt.placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && promptInput.trim()) {
                  customPrompt.onSave(promptInput.trim());
                  setCustomPrompt(null);
                }
              }}
              style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setCustomPrompt(null)}
                style={{ flex: 1, padding: '0.85rem', borderRadius: '14px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ביטול
              </button>
              <button 
                onClick={() => {
                  if (promptInput.trim()) {
                    customPrompt.onSave(promptInput.trim());
                    setCustomPrompt(null);
                  }
                }}
                disabled={!promptInput.trim()}
                style={{ flex: 1.2, padding: '0.85rem', borderRadius: '14px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: promptInput.trim() ? 'pointer' : 'not-allowed', opacity: promptInput.trim() ? 1 : 0.6 }}
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DocumentsWidget.displayName = 'DocumentsWidget';
