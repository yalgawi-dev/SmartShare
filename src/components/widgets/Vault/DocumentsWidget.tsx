'use client';
import { recordTelemetryAction } from '../../../utils/telemetryTracker';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';
import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { universalSearch, universalSort } from '../../../utils/searchEngine';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces, DocumentFolder } from '../../../app/context/SpacesContext';
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
  const { 
    addShelf, updateShelf, removeShelf, restoreShelf, permanentlyDeleteShelf, 
    addDocument, addDocumentAndLinkToEvent, updateDocument, removeDocument, restoreDocument, permanentlyDeleteDocument, 
    addDocumentFolder, updateDocumentFolder, removeDocumentFolder, restoreDocumentFolder, permanentlyDeleteDocumentFolder,
    addShelfEvent, updateShelfEvent, removeShelfEvent, addShelfEventComment, removeShelfEventComment 
  } = useSpaces() as any;
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'vault'>(() => (space.settings?.showVaultTimeline ? 'timeline' : 'vault'));
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [warehouseSortBy, setWarehouseSortBy] = useState<'station' | 'name' | 'date_desc' | 'date_asc'>('station');
  const [warehouseStationFilter, setWarehouseStationFilter] = useState<string>('all');
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

  // Folders management states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [linkStationFolder, setLinkStationFolder] = useState<DocumentFolder | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string, name: string } | null>(null);
  const [moveDocToFolder, setMoveDocToFolder] = useState<{ docId: string, currentFolderId?: string | null } | null>(null);
  const [showSortFilterModal, setShowSortFilterModal] = useState(false);
  const [vaultViewMode, setVaultViewMode] = useState<'grid_medium' | 'grid_large' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartshare_vault_view_mode');
      if (saved === 'grid_medium' || saved === 'grid_large' || saved === 'list') return saved;
    }
    return 'grid_medium';
  });

  const handleSetVaultViewMode = (mode: 'grid_medium' | 'grid_large' | 'list') => {
    setVaultViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartshare_vault_view_mode', mode);
    }
  };

  React.useEffect(() => {
    const folderHandler = () => {
      if (!activeShelfId) return;
      const targetShelf = shelves.find(s => s.id === activeShelfId);
      if (!targetShelf) return;
      setPromptInput('');
      setCustomPrompt({
        isOpen: true,
        title: 'יצירת תיקייה חדשה',
        placeholder: 'שם התיקייה...',
        defaultValue: '',
        onSave: (folderName: string) => {
          if (folderName.trim()) {
            addDocumentFolder(space.id, {
              shelfId: targetShelf.id,
              parentId: currentFolderId || null,
              name: folderName.trim()
            });
          }
        }
      });
    };
    window.addEventListener('smartshare:add_folder', folderHandler);
    return () => window.removeEventListener('smartshare:add_folder', folderHandler);
  }, [space.id, activeShelfId, shelves, currentFolderId, addDocumentFolder]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const paramShelfId = new URLSearchParams(window.location.search).get('shelfId');
      if (paramShelfId && shelves.some(s => s.id === paramShelfId)) {
        setActiveShelfId(paramShelfId);
      }
    }
  }, [shelves]);

  React.useEffect(() => {
    setCurrentFolderId(null);
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

    const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string, folderId?: string | null) => {
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

        // Determine effective folderId (passed in or currentFolderId if same shelf)
        const effectiveFolderId = typeof folderId !== 'undefined' ? folderId : (shelfId === activeShelfId ? currentFolderId : null);

        // Station resolution: If targetEventId not specified, check if effective folder has linked station
        let effectiveTargetEventId = targetEventId;
        if (!effectiveTargetEventId && effectiveFolderId) {
          const targetFolder = (space.documentFolders || []).find(f => f.id === effectiveFolderId);
          if (targetFolder?.stationId) {
            effectiveTargetEventId = targetFolder.stationId;
          }
        }

        const docPayload = {
          shelfId, 
          folderId: effectiveFolderId || null,
          url: finalUrl, 
          type, 
          title, 
          addedBy: user?.id || '', 
          thumbnailUrl: finalThumbnailUrl,
          pages: finalPages,
          storageTarget: effectiveTarget as 'cloud' | 'local' | 'gdrive'
        };

        // Save to real database - atomically link if effectiveTargetEventId is present
        let docId: string;
        if (effectiveTargetEventId && effectiveTargetEventId !== '__new_station__') {
          docId = addDocumentAndLinkToEvent(space.id, docPayload, effectiveTargetEventId);
        } else {
          docId = addDocument(space.id, docPayload);
          recordTelemetryAction('docUpload');
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
    const allSpaceEvents = space.shelfEvents || [];
    const activeShelfEvents = allSpaceEvents.filter((e: any) => e.shelfId === activeShelfId);

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
                {activeShelf.icon || '🗂️'} {activeShelf.name} <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '6px', marginLeft: '0.4rem', fontWeight: 'bold' }}>v3.3.72</span>
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
          {(showTimeline || shelfDocs.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                {/* Clean Sort & Filter Button (Only in Vault where relevant) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowSortFilterModal(true)}
                    style={{
                      background: (((filterLinked !== 'all') || (warehouseStationFilter !== 'all') || (warehouseSortBy !== 'date_desc'))) ? '#eff6ff' : '#f8fafc',
                      border: (((filterLinked !== 'all') || (warehouseStationFilter !== 'all') || (warehouseSortBy !== 'date_desc'))) ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                      color: (((filterLinked !== 'all') || (warehouseStationFilter !== 'all') || (warehouseSortBy !== 'date_desc'))) ? '#1d4ed8' : '#334155',
                      padding: '6px 14px',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: (((filterLinked !== 'all') || (warehouseStationFilter !== 'all') || (warehouseSortBy !== 'date_desc'))) ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title="סינון לפי תחנות ומיון מסמכים"
                  >
                    <span style={{ fontSize: '1rem' }}>⇅</span>
                    <span>סינון ומיון</span>
                    {(((filterLinked !== 'all') || (warehouseStationFilter !== 'all') || (warehouseSortBy !== 'date_desc'))) && (
                      <span style={{
                        background: '#3b82f6',
                        color: 'white',
                        borderRadius: '999px',
                        padding: '1px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 800
                      }}>פעיל</span>
                    )}
                  </button>

                  {/* Explorer View Mode Switcher (כמו ב-Windows / סייר המכשיר) */}
                  <div style={{
                    display: 'flex',
                    background: '#e2e8f0',
                    borderRadius: '10px',
                    padding: '2px',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => handleSetVaultViewMode('list')}
                      title="תצוגת רשימה (List)"
                      style={{
                        border: 'none',
                        background: vaultViewMode === 'list' ? '#ffffff' : 'transparent',
                        color: vaultViewMode === 'list' ? '#0f172a' : '#64748b',
                        fontWeight: vaultViewMode === 'list' ? 800 : 500,
                        borderRadius: '8px',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: vaultViewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      <span>☰</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>רשימה</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetVaultViewMode('grid_medium')}
                      title="קלפים בינוניים (Medium Icons)"
                      style={{
                        border: 'none',
                        background: vaultViewMode === 'grid_medium' ? '#ffffff' : 'transparent',
                        color: vaultViewMode === 'grid_medium' ? '#0f172a' : '#64748b',
                        fontWeight: vaultViewMode === 'grid_medium' ? 800 : 500,
                        borderRadius: '8px',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: vaultViewMode === 'grid_medium' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      <span>▦</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>בינוני</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetVaultViewMode('grid_large')}
                      title="קלפים גדולים (Large Icons)"
                      style={{
                        border: 'none',
                        background: vaultViewMode === 'grid_large' ? '#ffffff' : 'transparent',
                        color: vaultViewMode === 'grid_large' ? '#0f172a' : '#64748b',
                        fontWeight: vaultViewMode === 'grid_large' ? 800 : 500,
                        borderRadius: '8px',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: vaultViewMode === 'grid_large' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      <span>☷</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>גדול</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginRight: 'auto' }}>
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
                        boxShadow: isMultiSelect ? '0 2px 6px rgba(59,130,246,0.15)' : 'none'
                      }}
                    >
                      <span>{isMultiSelect ? '✓ ביטול בחירה' : '☑️ בחירה מרובה לשיתוף'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Windows Explorer Style Breadcrumbs Navigation */}
              {(() => {
                const allFolders: DocumentFolder[] = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === activeShelf.id);
                const breadcrumbTrail: DocumentFolder[] = [];
                let walkerId = currentFolderId;
                while (walkerId) {
                  const f = allFolders.find(item => item.id === walkerId);
                  if (f) {
                    breadcrumbTrail.unshift(f);
                    walkerId = f.parentId || null;
                  } else {
                    break;
                  }
                }

                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '6px 12px',
                    fontSize: '0.82rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>מיקום:</span>
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(null)}
                        style={{
                          background: !currentFolderId ? '#dbeafe' : 'transparent',
                          color: !currentFolderId ? '#1d4ed8' : '#475569',
                          border: 'none',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: !currentFolderId ? 800 : 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <span>🏠</span> ראשי (כללי)
                      </button>

                      {breadcrumbTrail.map((crumb, idx) => {
                        const isLast = idx === breadcrumbTrail.length - 1;
                        return (
                          <React.Fragment key={crumb.id}>
                            <span style={{ color: '#94a3b8' }}>/</span>
                            <button
                              type="button"
                              onClick={() => setCurrentFolderId(crumb.id)}
                              style={{
                                background: isLast ? '#dbeafe' : 'transparent',
                                color: isLast ? '#1d4ed8' : '#475569',
                                border: 'none',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: isLast ? 800 : 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <span>📁</span> {crumb.name}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {currentFolderId && (
                      <button
                        type="button"
                        onClick={() => {
                          const currentF = allFolders.find(f => f.id === currentFolderId);
                          setCurrentFolderId(currentF?.parentId || null);
                        }}
                        style={{
                          background: 'white',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          borderRadius: '8px',
                          padding: '3px 10px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <span>⬆️</span> תיקייה אחת למעלה
                      </button>
                    )}
                  </div>
                );
              })()}
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

            // Current Level Folders (Explorer Hierarchy)
            const allShelfFolders = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === activeShelfId);
            const currentLevelFolders = allShelfFolders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId);

            let filteredDocs = shelfDocs.filter(doc => {
              // Explorer Hierarchy check: document must reside in the current folder level
              const matchesFolder = currentFolderId ? doc.folderId === currentFolderId : !doc.folderId;
              if (!matchesFolder) return false;

              const linkedEv = getDocLinkedEvent(doc.id, doc.url);
              const isLinked = !!linkedEv;
              if (filterLinked === 'linked') return isLinked;
              if (filterLinked === 'unlinked') return !isLinked;
              return true;
            });

            if (warehouseStationFilter !== 'all') {
              if (warehouseStationFilter === 'unlinked') {
                filteredDocs = filteredDocs.filter(doc => !isDocLinked(doc.id, doc.url));
              } else {
                filteredDocs = filteredDocs.filter(doc => {
                  const ev = getDocLinkedEvent(doc.id, doc.url);
                  return ev && ev.id === warehouseStationFilter;
                });
              }
            }

            // Apply Warehouse Sorting
            filteredDocs = [...filteredDocs].sort((a, b) => {
              if (warehouseSortBy === 'station') {
                const evA = getDocLinkedEvent(a.id, a.url);
                const evB = getDocLinkedEvent(b.id, b.url);
                const stationTitleA = evA?.title || 'תתת_ללא תחנה';
                const stationTitleB = evB?.title || 'תתת_ללא תחנה';
                const cmp = stationTitleA.localeCompare(stationTitleB, 'he');
                if (cmp !== 0) return cmp;
                return (a.title || '').localeCompare(b.title || '', 'he');
              }
              if (warehouseSortBy === 'name') {
                return (a.title || '').localeCompare(b.title || '', 'he');
              }
              if (warehouseSortBy === 'date_asc') {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              }
              // Default date_desc
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            if (filteredDocs.length === 0 && currentLevelFolders.length === 0) {
              const isFiltered = filterLinked !== 'all' || warehouseStationFilter !== 'all';
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem 1.5rem',
                  background: '#f8fafc',
                  borderRadius: '16px',
                  border: '1.5px dashed #cbd5e1',
                  margin: '1.5rem 0',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>
                    {isFiltered ? '🔍' : '📂'}
                  </div>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#1e293b', fontSize: '1rem', fontWeight: 700 }}>
                    {isFiltered ? 'אין מסמכים תואמים לסינון' : 'התיקייה ריקה כרגע'}
                  </h4>
                  <p style={{ margin: '0 0 0.8rem 0', color: '#64748b', fontSize: '0.82rem', maxWidth: '300px', lineHeight: '1.4' }}>
                    {isFiltered 
                      ? 'נסה לבחור תחנה אחרת או לאפס סינון.' 
                      : 'ניתן להעלות מסמכים או ליצור תיקיות באמצעות התפריט התחתון.'}
                  </p>
                  {isFiltered && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterLinked('all');
                        setWarehouseStationFilter('all');
                      }}
                      style={{
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1.1rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      איפוס סינון
                    </button>
                  )}
                </div>
              );
            }

            return (
              (() => {
                if (vaultViewMode === 'list') {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* FOLDERS LIST */}
                      {currentLevelFolders.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.1rem' }}>
                            <span>📁</span>
                            <span>תיקיות ({currentLevelFolders.length}):</span>
                          </div>
                          {currentLevelFolders.map(folder => {
                            const subfolderCount = allShelfFolders.filter(f => f.parentId === folder.id).length;
                            const docCount = shelfDocs.filter(d => d.folderId === folder.id).length;
                            const folderStation = folder.stationId ? (space.shelfEvents || []).find(e => e.id === folder.stationId) : null;

                            return (
                              <div
                                key={folder.id}
                                onClick={() => setCurrentFolderId(folder.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.55rem 0.85rem',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                  gap: '0.5rem'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#93c5fd')}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: '1.6rem', filter: 'drop-shadow(0 2px 4px rgba(245,158,11,0.25))', flexShrink: 0 }}>📁</span>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {folder.name}
                                      </span>
                                      {showTimeline && folderStation && (
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setWarehouseStationFilter(folderStation.id);
                                          }}
                                          style={{
                                            background: '#e0f2fe',
                                            color: '#0369a1',
                                            fontSize: '0.68rem',
                                            padding: '1px 6px',
                                            borderRadius: '6px',
                                            fontWeight: 700,
                                            border: '1px solid #bae6fd'
                                          }}
                                          title={'מקושרת לתחנה: ' + folderStation.title}
                                        >
                                          📍 {folderStation.title}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                                      {subfolderCount > 0 ? `${subfolderCount} תתי-תיקיות • ` : ''}{docCount} מסמכים
                                    </div>
                                  </div>
                                </div>

                                {/* Folder Action Buttons in List View */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPromptInput(folder.name);
                                      setCustomPrompt({
                                        isOpen: true,
                                        title: 'עריכת שם תיקייה',
                                        placeholder: 'שם התיקייה...',
                                        defaultValue: folder.name,
                                        onSave: (val) => {
                                          if (val.trim()) updateDocumentFolder(space.id, folder.id, { name: val.trim() });
                                        }
                                      });
                                    }}
                                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                    title="ערוך שם"
                                  >
                                    ✏️
                                  </button>
                                  {showTimeline && (
                                    <button
                                      type="button"
                                      onClick={() => setLinkStationFolder(folder)}
                                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                                      title="קשר לתחנה"
                                    >
                                      🔗
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setFolderToDelete({ id: folder.id, name: folder.name })}
                                    style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
                                    title="מחק תיקייה"
                                  >
                                    🗑️
                                  </button>
                                  <span style={{ color: '#94a3b8', fontSize: '0.9rem', marginRight: '4px' }}>❯</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* DOCUMENTS LIST */}
                      {filteredDocs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: currentLevelFolders.length > 0 ? '0.5rem' : 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.1rem' }}>
                            <span>📄</span>
                            <span>מסמכים ({filteredDocs.length}):</span>
                          </div>

                          {/* List Table Header */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMultiSelect ? '30px 42px 1fr 85px 105px' : '42px 1fr 85px 105px',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.35rem 0.6rem',
                            background: '#f1f5f9',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#475569'
                          }}>
                            {isMultiSelect && <span style={{ textAlign: 'center' }}>בחר</span>}
                            <span>תצוגה</span>
                            <span>שם המסמך ושיוך</span>
                            <span>תאריך</span>
                            <span style={{ textAlign: 'center' }}>פעולות</span>
                          </div>

                          {filteredDocs.map(doc => {
                            const linkedEvent = getDocLinkedEvent(doc.id, doc.url);
                            const isChecked = selectedDocIds.includes(doc.id);
                            const isPdf = (doc.url && doc.url.includes('.pdf')) || doc.url?.startsWith('data:application/pdf') || doc.type === 'pdf';

                            return (
                              <div
                                key={doc.id}
                                data-doc-id={doc.id}
                                onClick={() => {
                                  if (isMultiSelect) {
                                    setSelectedDocIds(prev => isChecked ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                  } else {
                                    setPreviewState({ docs: filteredDocs, index: filteredDocs.findIndex(d => d.id === doc.id) });
                                  }
                                }}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: isMultiSelect ? '30px 42px 1fr 85px 105px' : '42px 1fr 85px 105px',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.4rem 0.6rem',
                                  background: isChecked ? '#eff6ff' : '#ffffff',
                                  border: isChecked ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                }}
                                onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = '#ffffff'; }}
                              >
                                {isMultiSelect && (
                                  <div style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                  </div>
                                )}

                                {/* Thumbnail */}
                                <div style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  background: '#f1f5f9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {doc.thumbnailUrl ? (
                                    <img src={doc.thumbnailUrl} alt={doc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : isPdf ? (
                                    <span style={{ fontSize: '1.2rem' }}>📑</span>
                                  ) : (
                                    <img src={doc.url} alt={doc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  )}
                                </div>

                                {/* Title & Station */}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {doc.title}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {showTimeline && linkedEvent && (
                                      <span style={{ fontSize: '0.66rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                        📍 {linkedEvent.title}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '0.64rem', color: '#64748b' }}>
                                      {doc.storageTarget === 'local' ? '📱 מקומי' : doc.storageTarget === 'gdrive' ? '📁 Drive' : '☁️ ענן'}
                                    </span>
                                  </div>
                                </div>

                                {/* Date */}
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {new Date(doc.createdAt).toLocaleDateString('he-IL')}
                                </div>

                                {/* Quick Actions */}
                                <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => setSharingDoc(doc)}
                                    title="שתף מסמך"
                                    style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    📤
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPromptInput(doc.title);
                                      setCustomPrompt({
                                        isOpen: true,
                                        title: 'עריכת כותרת מסמך',
                                        placeholder: 'הזן כותרת...',
                                        defaultValue: doc.title,
                                        onSave: (val) => {
                                          if (val.trim()) updateDocument(space.id, doc.id, { title: val.trim() });
                                        }
                                      });
                                    }}
                                    title="ערוך שם"
                                    style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMoveDocToFolder({ docId: doc.id, currentFolderId: doc.folderId })}
                                    title="העבר לתיקייה"
                                    style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    📁
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                    title="מחק מסמך"
                                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Grid Views: grid_medium (125px) / grid_large (175px)
                const minFolderCardWidth = vaultViewMode === 'grid_large' ? '175px' : '125px';
                const folderIconSize = vaultViewMode === 'grid_large' ? '3.4rem' : '2.6rem';
                const docCardHeight = vaultViewMode === 'grid_large' ? '185px' : '135px';

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* FOLDERS GRID SECTION */}
                    {currentLevelFolders.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>📁</span>
                          <span>תיקיות ({currentLevelFolders.length}):</span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(auto-fill, minmax(${minFolderCardWidth}, 1fr))`,
                          gap: '0.75rem'
                        }}>
                          {currentLevelFolders.map(folder => {
                            const subfolderCount = allShelfFolders.filter(f => f.parentId === folder.id).length;
                            const docCount = shelfDocs.filter(d => d.folderId === folder.id).length;
                            const folderStation = folder.stationId ? (space.shelfEvents || []).find(e => e.id === folder.stationId) : null;

                            return (
                              <div
                                key={folder.id}
                                onClick={() => setCurrentFolderId(folder.id)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0.75rem 0.5rem 0.5rem 0.5rem',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '16px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                                  textAlign: 'center',
                                  gap: '0.35rem',
                                  position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.borderColor = '#93c5fd';
                                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.borderColor = '#e2e8f0';
                                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                                }}
                              >
                                {/* Folder Icon with item count badge (Windows / Mac Style) */}
                                <div style={{ position: 'relative' }}>
                                  <span style={{ fontSize: folderIconSize, filter: 'drop-shadow(0 4px 6px rgba(245,158,11,0.25))' }}>📁</span>
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
                                    {docCount + subfolderCount}
                                  </span>
                                </div>

                                <div style={{
                                  fontWeight: 800,
                                  fontSize: '0.82rem',
                                  color: '#0f172a',
                                  width: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }} title={folder.name}>
                                  {folder.name}
                                </div>

                                {/* Station badge */}
                                {showTimeline && folderStation && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setWarehouseStationFilter(folderStation.id);
                                    }}
                                    style={{
                                      background: '#e0f2fe',
                                      color: '#0369a1',
                                      fontSize: '0.64rem',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      fontWeight: 700,
                                      border: '1px solid #bae6fd',
                                      maxWidth: '90%',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={'מקושרת לתחנה: ' + folderStation.title}
                                  >
                                    📍 {folderStation.title}
                                  </span>
                                )}

                                {/* Folder card actions */}
                                <div style={{ display: 'flex', gap: '3px', marginTop: '0.2rem', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPromptInput(folder.name);
                                      setCustomPrompt({
                                        isOpen: true,
                                        title: 'עריכת שם תיקייה',
                                        placeholder: 'שם התיקייה...',
                                        defaultValue: folder.name,
                                        onSave: (val) => {
                                          if (val.trim()) updateDocumentFolder(space.id, folder.id, { name: val.trim() });
                                        }
                                      });
                                    }}
                                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '1px 4px', fontSize: '0.68rem', cursor: 'pointer' }}
                                    title="ערוך שם"
                                  >
                                    ✏️
                                  </button>
                                  {showTimeline && (
                                    <button
                                      type="button"
                                      onClick={() => setLinkStationFolder(folder)}
                                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '1px 4px', fontSize: '0.68rem', cursor: 'pointer' }}
                                      title="קשר לתחנה"
                                    >
                                      🔗
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setFolderToDelete({ id: folder.id, name: folder.name })}
                                    style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '5px', padding: '1px 4px', fontSize: '0.68rem', cursor: 'pointer' }}
                                    title="מחק תיקייה"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* DOCUMENTS GRID SECTION */}
                    {filteredDocs.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {currentLevelFolders.length > 0 && (
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📄</span>
                            <span>מסמכים ({filteredDocs.length}):</span>
                          </div>
                        )}

                        <div onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd} onMouseUp={handleTouchDragEnd} style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minFolderCardWidth}, 1fr))`, gap: '0.75rem' }}>
                          {filteredDocs.map(doc => {
                            const linkedEvent = getDocLinkedEvent(doc.id, doc.url);
                            const isChecked = selectedDocIds.includes(doc.id);
                            const isPdf = (doc.url && doc.url.includes('.pdf')) || doc.url?.startsWith('data:application/pdf') || doc.type === 'pdf';

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
                                  background: '#ffffff',
                                  borderRadius: '14px',
                                  overflow: 'visible',
                                  border: isChecked ? '2px solid #2563eb' : (dragOverDocId === doc.id ? '2px dashed #3b82f6' : '1px solid #e2e8f0'),
                                  position: 'relative',
                                  opacity: draggedDocId === doc.id ? 0.4 : (doc.id.startsWith('temp-') ? 0.6 : 1),
                                  transition: 'all 0.2s',
                                  transform: isChecked ? 'scale(1.02)' : (dragOverDocId === doc.id ? 'scale(1.02)' : 'scale(1)'),
                                  boxShadow: isChecked ? '0 6px 16px rgba(37,99,235,0.2)' : '0 2px 4px rgba(0,0,0,0.03)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  cursor: isMultiSelect ? 'pointer' : 'default'
                                }}
                              >
                                {/* MULTI SELECT CHECKBOX OVERLAY */}
                                {isMultiSelect && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '6px',
                                    left: '6px',
                                    zIndex: 25,
                                    background: isChecked ? '#2563eb' : 'rgba(255,255,255,0.9)',
                                    color: 'white',
                                    borderRadius: '6px',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: isChecked ? 'none' : '1.5px solid #94a3b8',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                  }}>
                                    {isChecked ? '✓' : ''}
                                  </div>
                                )}

                                {doc.id.startsWith('temp-') && (
                                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', zIndex: 20 }}>
                                    מעלה...
                                  </div>
                                )}

                                {/* Card Preview */}
                                <div
                                  onClick={(e) => {
                                    if (isMultiSelect) return;
                                    e.stopPropagation();
                                    setPreviewState({ docs: filteredDocs, index: filteredDocs.findIndex(d => d.id === doc.id) });
                                  }}
                                  style={{
                                    height: docCardHeight,
                                    background: '#e2e8f0',
                                    backgroundImage: isPdf
                                      ? (doc.thumbnailUrl ? `url(${doc.thumbnailUrl})` : 'none')
                                      : `url(${doc.thumbnailUrl || doc.url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'zoom-in',
                                    position: 'relative',
                                    borderTopLeftRadius: '13px',
                                    borderTopRightRadius: '13px',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {isPdf && !doc.thumbnailUrl && <span style={{ fontSize: '2.5rem' }}>📑</span>}
                                  {isPdf && (
                                    <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                                      PDF
                                    </div>
                                  )}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '4px',
                                    right: '4px',
                                    background: doc.storageTarget === 'local' ? 'rgba(16, 185, 129, 0.9)' : doc.storageTarget === 'gdrive' ? 'rgba(234, 179, 8, 0.9)' : 'rgba(37, 99, 235, 0.9)',
                                    color: 'white',
                                    padding: '1px 5px',
                                    borderRadius: '5px',
                                    fontSize: '0.6rem',
                                    fontWeight: 700
                                  }}>
                                    {doc.storageTarget === 'local' ? '📱 מקומי' : doc.storageTarget === 'gdrive' ? '📁 Drive' : '☁️ ענן'}
                                  </div>
                                </div>

                                {!isMultiSelect && (
                                  <div onTouchStart={(e) => handleTouchDragStart(e, doc.id)} onMouseDown={(e) => handleTouchDragStart(e, doc.id)} style={{ display: 'flex', justifyContent: 'center', padding: '0.2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'grab' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '1px' }}>|||</span>
                                  </div>
                                )}

                                {/* Content Details */}
                                <div style={{ padding: '0.4rem 0.5rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.15rem' }}>
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
                                        onSave: (val) => {
                                          if (val.trim()) updateDocument(space.id, doc.id, { title: val.trim() });
                                        }
                                      });
                                    }}
                                    style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                                    title="לחץ לשינוי שם"
                                  >
                                    {doc.title}
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: '#64748b' }}>
                                    <span>{new Date(doc.createdAt).toLocaleDateString('he-IL')}</span>
                                    {showTimeline && linkedEvent && (
                                      <span
                                        onClick={(e) => {
                                          if (isMultiSelect) return;
                                          e.stopPropagation();
                                          setWarehouseStationFilter(linkedEvent.id);
                                        }}
                                        style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 4px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                                        title={'שייך לתחנה: ' + linkedEvent.title}
                                      >
                                        📍
                                      </span>
                                    )}
                                  </div>

                                  {/* Action bar */}
                                  {!isMultiSelect && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setSharingDoc(doc); }}
                                          style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="שתף מסמך"
                                        >
                                          📤
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setMoveDocToFolder({ docId: doc.id, currentFolderId: doc.folderId }); }}
                                          style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="העבר לתיקייה"
                                        >
                                          📁
                                        </button>
                                      </div>

                                      {/* Dots Menu */}
                                      <div style={{ position: 'relative' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDocMenuId(activeDocMenuId === doc.id ? null : doc.id);
                                          }}
                                          style={{ background: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '1px 4px', fontSize: '0.85rem', cursor: 'pointer' }}
                                        >
                                          ⋮
                                        </button>

                                        {activeDocMenuId === doc.id && (
                                          <>
                                            <div onClick={(e) => { e.stopPropagation(); setActiveDocMenuId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                                            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: '120%', left: 0, background: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', padding: '0.35rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '160px', direction: 'rtl' }}>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); downloadDocument(doc.url, doc.title); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                              >
                                                ⬇️ הורד למכשיר
                                              </button>
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
                                                    onSave: (val) => { if (val.trim()) updateDocument(space.id, doc.id, { title: val.trim() }); }
                                                  });
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                              >
                                                ✏️ ערוך כותרת
                                              </button>
                                              {showTimeline && (
                                                <button
                                                  type="button"
                                                  onClick={() => { setActiveDocMenuId(null); setLinkStationDoc({ docId: doc.id, title: doc.title, url: doc.url }); }}
                                                  style={{ background: 'transparent', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                >
                                                  🔗 {linkedEvent ? 'שנה תחנה' : 'קשר לתחנה'}
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); handleMoveDocument(doc.id, activeShelf.id); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                              >
                                                🔄 העבר למדף אחר
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); handleDeleteDocument(doc.id, doc.title); }}
                                                style={{ background: '#fef2f2', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                              >
                                                🗑️ מחק מסמך
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
                      </div>
                    )}
                  </div>
                );
              })()
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

      {/* LINK FOLDER TO TIMELINE STATION MODAL */}
      {linkStationFolder && (() => {
        const activeShelfEvents = (space.shelfEvents || []).filter(e => e.shelfId === activeShelfId);
        const currentFolderStation = linkStationFolder.stationId 
          ? activeShelfEvents.find(e => e.id === linkStationFolder.stationId)
          : null;

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '1.5rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>שיוך תיקייה לתחנה בציר הזמן</h3>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                    📁 {linkStationFolder.name}
                  </div>
                </div>
                <button onClick={() => setLinkStationFolder(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#1e40af', lineHeight: '1.4' }}>
                💡 <strong>שים לב:</strong> שיוך התיקייה לתחנה יקשר אוטומטית את כל המסמכים שנמצאים בתוכה לתחנה זו בציר הזמן!
              </div>

              {currentFolderStation && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                    <strong>משויכת כרגע לתחנה:</strong><br />
                    {currentFolderStation.title}
                  </div>
                  <button 
                    onClick={() => {
                      updateDocumentFolder(space.id, linkStationFolder.id, { stationId: null });
                      setLinkStationFolder(null);
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
                  const isCurrent = event.id === currentFolderStation?.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        updateDocumentFolder(space.id, linkStationFolder.id, { stationId: event.id });
                        setLinkStationFolder(null);
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
                          📅 {new Date(event.eventDate).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                      {isCurrent && <span style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '1.1rem' }}>✓</span>}
                    </button>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    עדיין אין תחנות בציר הזמן של מדף זה.
                  </div>
                )}
              </div>

              <button 
                onClick={() => setLinkStationFolder(null)} 
                style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                סגור
              </button>
            </div>
          </div>
        );
      })()}

      {/* MOVE DOCUMENT TO FOLDER MODAL */}
      {moveDocToFolder && (() => {
        const docToMove = documents.find(d => d.id === moveDocToFolder.docId);
        const allShelfFolders = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === activeShelfId);

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '1.5rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', direction: 'rtl' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>העברת מסמך לתיקייה</h3>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📄 {docToMove?.title || 'מסמך'}
                  </div>
                </div>
                <button onClick={() => setMoveDocToFolder(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginBottom: '0.75rem' }}>
                בחר תיקיית יעד:
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingBottom: '0.5rem' }}>
                {/* Option 1: Root level */}
                <button
                  onClick={() => {
                    updateDocument(space.id, moveDocToFolder.docId, { folderId: null });
                    setMoveDocToFolder(null);
                  }}
                  style={{
                    padding: '0.85rem 1rem',
                    background: !moveDocToFolder.currentFolderId ? '#eff6ff' : '#f8fafc',
                    border: !moveDocToFolder.currentFolderId ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>🏠</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: !moveDocToFolder.currentFolderId ? '#1d4ed8' : '#1e293b' }}>
                      תיקייה ראשית (ללא תיקייה)
                    </span>
                  </div>
                  {!moveDocToFolder.currentFolderId && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓ נוכחי</span>}
                </button>

                {/* Available folders in this shelf */}
                {allShelfFolders.map(f => {
                  const isCurrent = f.id === moveDocToFolder.currentFolderId;
                  const parentF = f.parentId ? allShelfFolders.find(p => p.id === f.parentId) : null;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        updateDocument(space.id, moveDocToFolder.docId, { folderId: f.id });
                        setMoveDocToFolder(null);
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
                        textAlign: 'right'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>📁</span>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isCurrent ? '#1d4ed8' : '#1e293b' }}>
                            {f.name}
                          </div>
                          {parentF && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              נמצאת בתוך: {parentF.name}
                            </div>
                          )}
                        </div>
                      </div>
                      {isCurrent && <span style={{ color: '#2563eb', fontWeight: 'bold' }}>✓ נוכחי</span>}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setMoveDocToFolder(null)} 
                style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                ביטול
              </button>
            </div>
          </div>
        );
      })()}

      {/* CONFIRM DELETE FOLDER MODAL */}
      <ConfirmModal
        isOpen={Boolean(folderToDelete)}
        title="מחיקת תיקייה"
        message="התיקייה תועבר לסל האשפה. המסמכים שהיו בתוכה יישמרו ויועברו לרמה הראשית של המדף."
        itemTitle={folderToDelete?.name}
        confirmText="העבר לסל אשפה"
        onConfirm={() => {
          if (folderToDelete) {
            removeDocumentFolder(space.id, folderToDelete.id);
            if (currentFolderId === folderToDelete.id) {
              setCurrentFolderId(null);
            }
            setFolderToDelete(null);
          }
        }}
        onClose={() => setFolderToDelete(null)}
      />

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
      {/* SORT & FILTER MODAL */}
      {showSortFilterModal && (
        <div 
          onClick={() => setShowSortFilterModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(6px)',
            padding: '1rem'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              width: '100%',
              maxWidth: '380px',
              borderRadius: '24px',
              padding: '1.75rem 1.5rem',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              direction: 'rtl',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>⇅</span> סינון ומיון מסמכים
              </h3>
              <button
                type="button"
                onClick={() => setShowSortFilterModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Filter by Station */}
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                📍 סינון לפי תחנה:
              </label>
              <select
                value={warehouseStationFilter}
                onChange={(e) => setWarehouseStationFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">כל התחנות במדף ({activeShelfEvents.length})</option>
                <option value="unlinked">ללא שיוך לתחנה</option>
                {activeShelfEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title || 'תחנה ללא שם'}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Linked/Unlinked */}
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                🔗 קישור לתחנות:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                {[
                  { id: 'all', label: 'הכל' },
                  { id: 'linked', label: 'מקושר' },
                  { id: 'unlinked', label: 'ללא תחנה' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterLinked(opt.id as any)}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '10px',
                      border: filterLinked === opt.id ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                      background: filterLinked === opt.id ? '#eff6ff' : '#f8fafc',
                      color: filterLinked === opt.id ? '#1d4ed8' : '#64748b',
                      fontWeight: filterLinked === opt.id ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label style={{ display: 'block', color: '#475569', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                ⇅ סדר מיון:
              </label>
              <select
                value={warehouseSortBy}
                onChange={(e) => setWarehouseSortBy(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="station">לפי שם תחנה (א-ת)</option>
                <option value="name">לפי שם מסמך (א-ת)</option>
                <option value="date_desc">מהחדש ביותר לישן</option>
                <option value="date_asc">מהישן ביותר לחדש</option>
              </select>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setFilterLinked('all');
                  setWarehouseStationFilter('all');
                  setWarehouseSortBy('date_desc');
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                איפוס
              </button>
              <button
                type="button"
                onClick={() => setShowSortFilterModal(false)}
                style={{
                  flex: 1.5,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                סגור והחל
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM PROMPT MODAL (FOR ACTIVE SHELF VIEW) */}
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
                type="button"
                onClick={() => setCustomPrompt(null)}
                style={{ flex: 1, padding: '0.85rem', borderRadius: '14px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ביטול
              </button>
              <button 
                type="button"
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

  return (
    <div style={{ padding: '0', paddingBottom: '6rem' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(10px)', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', display: 'flex', flexDirection: 'column', lineHeight: '1', flexShrink: 0 }}>
          מחסן
          <span style={{ fontSize: '0.6rem', color: '#3b82f6', marginTop: '2px' }}>v3.3.72</span>
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
