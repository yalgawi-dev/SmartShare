'use client';
import { canAccessItem } from '../../../utils/permissionUtils';
import { recordTelemetryAction } from '../../../utils/telemetryTracker';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';
import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { universalSearch, universalSort } from '../../../utils/searchEngine';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces, DocumentFolder, SpaceDocument } from '../../../app/context/SpacesContext';
import { ShelfCoverPicker } from './ShelfCoverPicker';
import ShelfTimeline from './ShelfTimeline';
import { uploadImageToStorage } from '@/lib/firebase';
import ConfirmModal from '../../common/ConfirmModal';
import BatchActionToolbar, { BatchToolbarAction } from '../../common/BatchActionToolbar';
import GlobalMoveModal from '../../common/GlobalMoveModal';
import GlobalRecycleBinModal, { TrashItem } from '../../common/GlobalRecycleBinModal';
import { downloadDocument, shareDocument, getDocumentPreviewUrl, formatFileSize } from '../../../utils/documentUtils';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { mergeImagesCleanly } from '../../../utils/imageOptimizer';
import ShareChoiceModal, { ShareChoiceDoc } from './ShareChoiceModal';
import DynamicPdfScrollPreview from './DynamicPdfScrollPreview';
import { saveLocalDeviceFile } from '../../../utils/localDeviceStorage';
import MultiPageViewer from './MultiPageViewer';
import DocNoteModal from './DocNoteModal';
import { LinkDocumentsModal, LinkedDocsPreviewModal } from './DocumentLinkModals';
import { APP_VERSION } from '@/constants/version';
import { findDuplicateInSpace, computeImageDHash, DuplicateMatch } from '@/utils/duplicateDetection';
import { DuplicateWarningModal } from './DuplicateWarningModal';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string, explicitShelfId?: string) => Promise<string | undefined>;
  uploadAndLinkDocument?: (shelfId: string, eventId: string, url: string, type: 'document' | 'image' | 'pdf') => Promise<void>;
}

interface DocumentsWidgetProps {
  space: Space;
  activePartnersCount: number;
}

type ViewMode = 'feed' | 'grid' | 'circles';

const getPrivacyInfo = (allowedPartners?: string[], creatorId?: string) => {
  const raw = allowedPartners || [];
  const allowed = raw.filter(id => id && id.trim() !== '' && (!creatorId || id !== creatorId));
  if (allowed.includes('__only_me__')) {
    return { icon: '👤', text: 'רק לעצמי', bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c' };
  }
  if (allowed.includes('__creator_vault_secret__')) {
    return { icon: '🛡️', text: 'מנהלים', bg: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9' };
  }
  if (allowed.length > 0) {
    const partnerCount = allowed.filter(id => id && id !== '__only_me__' && id !== '__creator_vault_secret__').length;
    return { icon: '🔒', text: `${partnerCount} מורשים`, bg: '#fef3c7', border: '#fde68a', color: '#b45309' };
  }
  return { icon: '🌐', text: 'פתוח לכולם', bg: '#f8fafc', border: '#cbd5e1', color: '#475569' };
};

export const DocumentsWidget = forwardRef<DocumentsWidgetRef, DocumentsWidgetProps>(({ space, activePartnersCount }, ref) => {
  const { user } = useAuth();
  const { 
    addShelf, updateShelf, removeShelf, restoreShelf, permanentlyDeleteShelf, 
    addDocument, addDocumentAndLinkToEvent, updateDocument, removeDocument, restoreDocument, permanentlyDeleteDocument, 
    addDocumentFolder, updateDocumentFolder, removeDocumentFolder, restoreDocumentFolder, permanentlyDeleteDocumentFolder, moveDocumentFolder,
    addShelfEvent, updateShelfEvent, removeShelfEvent, addShelfEventComment, removeShelfEventComment 
  } = useSpaces() as any;
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'vault'>('vault');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [warehouseSortBy, setWarehouseSortBy] = useState<'station' | 'name' | 'date_desc' | 'date_asc'>('station');
  const [warehouseStationFilter, setWarehouseStationFilter] = useState<string>('all');
  const [pendingImport, setPendingImport] = useState<{ docId?: string, url?: string, type?: 'document' | 'image' | 'pdf', allPages?: string[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState<{ id: string, shelfId: string, folderId?: string | null, url: string, title: string, type: string, thumbnailUrl?: string }[]>([]);
  const [previewState, setPreviewState] = useState<{ docs: any[], index: number } | null>(null);
  const [sharingDoc, setSharingDoc] = useState<ShareChoiceDoc | null>(null);
  const [linkStationDoc, setLinkStationDoc] = useState<{ docId: string, title: string, url: string } | null>(null);
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, number>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [lastViewedDocId, setLastViewedDocId] = useState<string | null>(null);
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
  const [noteDocId, setNoteDocId] = useState<string | null>(null);
  const hasFinance = (space.features || []).includes('finance');
  const showTimeline = !!space.settings?.showVaultTimeline;
  const [shelfToDelete, setShelfToDelete] = useState<{ id: string, name: string, count: number } | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
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

  // Local read documents state to immediately clear red indicator in UI
  const [locallyReadDocIds, setLocallyReadDocIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(`read_docs_${space.id}`) || '[]');
    } catch {
      return [];
    }
  });

  const markDocAsRead = React.useCallback((docId: string) => {
    if (!docId) return;
    setLocallyReadDocIds(prev => {
      if (prev.includes(docId)) return prev;
      const updated = [...prev, docId];
      try {
        localStorage.setItem(`read_docs_${space.id}`, JSON.stringify(updated.slice(-200)));
      } catch {}
      return updated;
    });

    // Also persist to document in Firestore if user is authenticated
    if (user?.id) {
      const docItem = documents.find(d => d.id === docId);
      if (docItem) {
        const existingReadBy = Array.isArray(docItem.readBy) ? docItem.readBy : [];
        if (!existingReadBy.includes(user.id)) {
          updateDocument(space.id, docId, {
            readBy: [...existingReadBy, user.id]
          });
        }
      }
    }
  }, [space.id, user?.id, documents, updateDocument]);

  const isDocUnread = React.useCallback((doc: any) => {
    if (!doc || doc.addedBy === user?.id) return false;
    const isRecent = Date.now() - new Date(doc.createdAt).getTime() < 86400000;
    if (!isRecent) return false;
    if (locallyReadDocIds.includes(doc.id)) return false;
    if (user?.id && Array.isArray(doc.readBy) && doc.readBy.includes(user.id)) return false;
    return true;
  }, [user?.id, locallyReadDocIds]);

  // Automatically mark current viewing doc as read when viewer is open
  useEffect(() => {
    if (previewState && previewState.docs && previewState.docs[previewState.index]) {
      const currentDoc = previewState.docs[previewState.index];
      if (currentDoc?.id) {
        markDocAsRead(currentDoc.id);
      }
    }
  }, [previewState, markDocAsRead]);

  // Duplicate document prevention state
  const [duplicateMatchState, setDuplicateMatchState] = useState<{
    match: DuplicateMatch;
    incomingTitle: string;
    shelfId: string;
    url: string;
    type: 'document' | 'image' | 'pdf';
    allPages?: string[];
    targetEventId?: string;
    folderId?: string | null;
  } | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isSharingBatch, setIsSharingBatch] = useState(false);

  // Folders management states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const currentFolderIdRef = useRef<string | null>(null);
  currentFolderIdRef.current = currentFolderId;
  const [linkStationFolder, setLinkStationFolder] = useState<DocumentFolder | null>(null);
  const [privacyTarget, setPrivacyTarget] = useState<{
    type: 'shelf' | 'folder' | 'document';
    id: string;
    name: string;
    allowedPartners: string[];
    ownerId?: string;
  } | null>(null);

  const handleSavePrivacy = (newAllowed: string[]) => {
    if (!privacyTarget) return;
    if (privacyTarget.type === 'shelf') {
      updateShelf(space.id, privacyTarget.id, { allowedPartners: newAllowed });
    } else if (privacyTarget.type === 'folder') {
      updateDocumentFolder(space.id, privacyTarget.id, { allowedPartners: newAllowed });
    } else if (privacyTarget.type === 'document') {
      updateDocument(space.id, privacyTarget.id, { allowedPartners: newAllowed });
    }
    setPrivacyTarget(prev => prev ? { ...prev, allowedPartners: newAllowed } : null);
  };
  const [folderToDelete, setFolderToDelete] = useState<{ id: string, name: string } | null>(null);
  const [folderToMove, setFolderToMove] = useState<DocumentFolder | null>(null);
  const [linkingDoc, setLinkingDoc] = useState<SpaceDocument | null>(null);
  const [viewLinkedDocsFor, setViewLinkedDocsFor] = useState<SpaceDocument | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);

  const showFeedbackToast = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedbackToast({ message, type });
  };

  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => {
      setFeedbackToast(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  const [moveDocToFolder, setMoveDocToFolder] = useState<{ docIds: string[], currentFolderId?: string | null } | null>(null);
  const [showSortFilterModal, setShowSortFilterModal] = useState(false);
  const [showVaultViewDropdown, setShowVaultViewDropdown] = useState(false);
  const vaultViewDropdownRef = useRef<HTMLDivElement>(null);
  const [vaultViewMode, setVaultViewMode] = useState<'grid_medium' | 'grid_large' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartshare_vault_view_mode');
      if (saved === 'grid_medium' || saved === 'grid_large' || saved === 'list') return saved;
    }
    return 'grid_medium';
  });

  const handleSetVaultViewMode = (mode: 'grid_medium' | 'grid_large' | 'list') => {
    setVaultViewMode(mode);
    setShowVaultViewDropdown(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartshare_vault_view_mode', mode);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vaultViewDropdownRef.current && !vaultViewDropdownRef.current.contains(e.target as Node)) {
        setShowVaultViewDropdown(false);
      }
    };
    if (showVaultViewDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVaultViewDropdown]);

  // Global outside-click / touch listener for closing the 3-dots document menu anywhere on screen
  React.useEffect(() => {
    if (!activeDocMenuId) return;
    const handleOutsideDocMenu = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-doc-menu-container="true"]')) {
        return;
      }
      setActiveDocMenuId(null);
    };
    document.addEventListener('mousedown', handleOutsideDocMenu);
    document.addEventListener('touchstart', handleOutsideDocMenu);
    return () => {
      document.removeEventListener('mousedown', handleOutsideDocMenu);
      document.removeEventListener('touchstart', handleOutsideDocMenu);
    };
  }, [activeDocMenuId]);

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
              name: folderName.trim(),
              allowedPartners: []
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
      const params = new URLSearchParams(window.location.search);
      const paramShelfId = params.get('shelfId');
      const paramFolderId = params.get('folderId');
      if (paramShelfId && shelves.some(s => s.id === paramShelfId)) {
        setActiveShelfId(paramShelfId);
        if (paramFolderId) {
          setCurrentFolderId(paramFolderId);
        }
      }
    }
  }, [shelves]);

  React.useEffect(() => {
    const handleSwitchSubTab = (e: any) => {
      if (e?.detail === 'timeline' || e?.detail === 'vault') {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('smartshare:switch_shelf_subtab', handleSwitchSubTab);
    return () => window.removeEventListener('smartshare:switch_shelf_subtab', handleSwitchSubTab);
  }, []);

  React.useEffect(() => {
    if (!showTimeline && activeTab === 'timeline') {
      setActiveTab('vault');
    }
  }, [showTimeline, activeTab]);

  React.useEffect(() => {
    setCurrentFolderId(null);
    setActiveTab('vault');
  }, [activeShelfId]);

  React.useEffect(() => {
    if (activeShelfId) {
      window.dispatchEvent(new CustomEvent('smartshare:shelf_opened', { detail: { shelfId: activeShelfId, subTab: activeTab } }));
      window.dispatchEvent(new CustomEvent('smartshare:shelf_subtab_changed', { detail: activeTab }));
    } else {
      setActiveTab('vault');
      window.dispatchEvent(new CustomEvent('smartshare:shelf_closed'));
    }
  }, [activeShelfId, activeTab, showTimeline]);

  React.useEffect(() => {
    const allFolders: DocumentFolder[] = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === activeShelfId);
    const activeFolder = currentFolderId ? allFolders.find(f => f.id === currentFolderId) : null;
    window.dispatchEvent(new CustomEvent('smartshare:hierarchy_state', {
      detail: {
        shelfId: activeShelfId || null,
        folderId: currentFolderId || null,
        parentFolderId: activeFolder?.parentId || null
      }
    }));
  }, [activeShelfId, currentFolderId, space.documentFolders]);

  React.useEffect(() => {
    const handleBackOneStep = (e: any) => {
      if (currentFolderId) {
        const allFolders: DocumentFolder[] = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === activeShelfId);
        const activeFolder = allFolders.find(f => f.id === currentFolderId);
        setCurrentFolderId(activeFolder?.parentId || null);
        if (e?.detail) e.detail.handled = true;
      } else if (activeShelfId) {
        setActiveShelfId(null);
        setActiveTab('vault');
        if (e?.detail) e.detail.handled = true;
      }
    };
    window.addEventListener('smartshare:navigate_back_one_step', handleBackOneStep);
    return () => window.removeEventListener('smartshare:navigate_back_one_step', handleBackOneStep);
  }, [activeShelfId, currentFolderId, space.documentFolders, showTimeline]);

  React.useEffect(() => {
    if (previewState) {
      window.dispatchEvent(new CustomEvent('smartshare:preview_open'));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:preview_closed'));
      if (lastViewedDocId) {
        // Smoothly scroll last viewed card into view with slight delay for modal exit animation
        setTimeout(() => {
          const el = document.querySelector(`[data-doc-id="${lastViewedDocId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 120);
      }
    }
  }, [previewState, lastViewedDocId]);

  // Proactively measure file sizes for all documents without a saved fileSize
  React.useEffect(() => {
    if (!documents || documents.length === 0) return;
    const unmeasured = documents.filter(d => !d.fileSize && !measuredSizes[d.id] && d.url);
    if (unmeasured.length === 0) return;

    unmeasured.slice(0, 15).forEach(doc => {
      if (doc.url.startsWith('data:')) {
        const sz = Math.round((doc.url.length * 3) / 4);
        setMeasuredSizes(prev => ({ ...prev, [doc.id]: sz }));
        if (typeof updateDocument === 'function') updateDocument(space.id, doc.id, { fileSize: sz });
      } else {
        fetch(doc.url, { method: 'HEAD' })
          .then(res => {
            const cl = res.headers.get('content-length');
            if (cl) {
              const sz = parseInt(cl, 10);
              if (sz > 0) {
                setMeasuredSizes(prev => ({ ...prev, [doc.id]: sz }));
                if (typeof updateDocument === 'function') updateDocument(space.id, doc.id, { fileSize: sz });
                return;
              }
            }
            return fetch(doc.url).then(r => r.blob()).then(b => {
              if (b.size > 0) {
                setMeasuredSizes(prev => ({ ...prev, [doc.id]: b.size }));
                if (typeof updateDocument === 'function') updateDocument(space.id, doc.id, { fileSize: b.size });
              }
            });
          })
          .catch(() => {
            fetch(doc.url).then(r => r.blob()).then(b => {
              if (b.size > 0) {
                setMeasuredSizes(prev => ({ ...prev, [doc.id]: b.size }));
                if (typeof updateDocument === 'function') updateDocument(space.id, doc.id, { fileSize: b.size });
              }
            }).catch(() => {});
          });
      }
    });
  }, [documents, space.id, measuredSizes]);

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
        title: 'יצירת נושא חדש',
        placeholder: 'הזן שם לנושא...',
        defaultValue: '',
        onSave: (name: string) => {
          if (name.trim()) {
            addShelf(space.id, {
              name: name.trim(),
              allowedPartners: []
            });
          }
        }
      });
    };
    window.addEventListener('smartshare:add_shelf', handler);
    return () => window.removeEventListener('smartshare:add_shelf', handler);
  }, [space.id, addShelf]);
  
  const [editingShelfCoverId, setEditingShelfCoverId] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({
    addDocument: async (url, type, allPages, targetEventId, explicitShelfId?: string, bypassDuplicateCheck?: boolean) => {
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
           const newShelfId = addShelf(space.id, { name: 'כללי', allowedPartners: [] });
           targetShelfId = newShelfId;
        }
      }
      
      const targetFolderId = targetShelfId === activeShelfId ? (currentFolderIdRef.current ?? currentFolderId) : null;

      // Smart Duplicate Detection (Interception across WhatsApp, camera scans, recompressed images)
      if (!bypassDuplicateCheck) {
        const sampleUrl = (allPages && allPages.length > 0) ? allPages[0] : url;
        const incomingSize = sampleUrl.startsWith('data:') ? Math.round((sampleUrl.length * 3) / 4) : undefined;
        const duplicateMatch = await findDuplicateInSpace({
          incomingUrl: sampleUrl,
          incomingTitle: type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק',
          incomingSize,
          existingDocuments: documents,
          shelves,
          members: space.members || []
        });

        if (duplicateMatch) {
          setDuplicateMatchState({
            match: duplicateMatch,
            incomingTitle: type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק',
            shelfId: targetShelfId,
            url,
            type: typeof type !== 'undefined' ? type : 'document',
            allPages,
            targetEventId,
            folderId: targetFolderId
          });
          return undefined;
        }
      }

      return await handleSaveDocument(targetShelfId, url, typeof type !== 'undefined' ? type : 'document', allPages, targetEventId, targetFolderId);
    }
  }), [activeShelfId, currentFolderId, shelves, space.shelfEvents, space.id, addShelf, documents, space.members]);

  
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
    title: 'שינוי שם לנושא',
    placeholder: 'הזן שם לנושא...',
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

    
    
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggeredRef = useRef(false);

    const startLongPress = (docId: string) => {
      isLongPressTriggeredRef.current = false;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        setIsMultiSelect(true);
        setSelectedDocIds(prev => prev.includes(docId) ? prev : [...prev, docId]);
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
          }
        } catch (_) {}
      }, 500);
    };

    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleTouchDragStart = (e: React.TouchEvent | React.MouseEvent, docId: string) => {
      cancelLongPress();
      setDraggedDocId(docId);
      document.body.style.overflow = 'hidden';
    };

    const handleTouchDragMove = (e: React.TouchEvent) => {
      if (!draggedDocId) return;
      const touch = e.touches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Check if hovering over a folder
      const targetFolderCard = elem?.closest('[data-folder-id]');
      if (targetFolderCard) {
        const targetFId = targetFolderCard.getAttribute('data-folder-id');
        if (targetFId && targetFId !== dragOverFolderId) {
          setDragOverFolderId(targetFId);
          setDragOverDocId(null);
          return;
        }
      } else if (dragOverFolderId) {
        setDragOverFolderId(null);
      }

      // Check if hovering over another document (reordering)
      const targetCard = elem?.closest('[data-doc-id]');
      if (targetCard) {
        const targetId = targetCard.getAttribute('data-doc-id');
        if (targetId && targetId !== dragOverDocId) {
          setDragOverDocId(targetId);
        }
      }
    };

    const handleTouchDragEnd = () => {
      if (!draggedDocId) return; // Don't re-render or cancel clicks if we weren't dragging!
      
      // Scenario 1: Dropped onto a folder
      if (dragOverFolderId) {
        const docsToMove = selectedDocIds.includes(draggedDocId) ? selectedDocIds : [draggedDocId];
        docsToMove.forEach(id => {
          updateDocument(space.id, id, { folderId: dragOverFolderId });
        });
        if (selectedDocIds.includes(draggedDocId)) {
          setSelectedDocIds([]);
          setIsMultiSelect(false);
        }
      } else if (dragOverDocId && draggedDocId !== dragOverDocId) {
        // Scenario 2: Dropped onto another document (reorder)
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
      setDragOverFolderId(null);
    };

    const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string, folderId?: string | null) => {
      // Determine effective folderId immediately (passed in or live currentFolderId if same shelf)
      const liveFolderId = currentFolderIdRef.current ?? currentFolderId;
      const effectiveFolderId = typeof folderId !== 'undefined' ? folderId : (shelfId === activeShelfId ? liveFolderId : null);

      // Optimistic UI update
      const tempId = 'temp-' + Date.now();
      const title = type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק';
      
      let previewUrl = (allPages && allPages.length > 0) ? allPages[0] : (url.startsWith('data:image') ? url : undefined);
      setUploadingDocs(prev => [...prev, { id: tempId, shelfId, folderId: effectiveFolderId || null, url, title, type, thumbnailUrl: previewUrl }]);
      
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

        // Station resolution: If targetEventId not specified, check if effective folder has linked station
        let effectiveTargetEventId = targetEventId;
        if (!effectiveTargetEventId && effectiveFolderId) {
          const targetFolder = (space.documentFolders || []).find(f => f.id === effectiveFolderId);
          if (targetFolder?.stationId) {
            effectiveTargetEventId = targetFolder.stationId;
          }
        }

        let detectedSize: number | undefined = undefined;
        if (url.startsWith('data:')) {
          detectedSize = Math.round((url.length * 3) / 4);
        }

        // Compute perceptual dHash for fast future duplicate interception
        let computedDHash: string | undefined = undefined;
        try {
          const sampleForHash = (finalPages && finalPages.length > 0) ? finalPages[0] : (finalThumbnailUrl || finalUrl);
          if (sampleForHash && (sampleForHash.startsWith('data:image') || sampleForHash.includes('.jpg') || sampleForHash.includes('.png') || sampleForHash.includes('.webp'))) {
            computedDHash = await computeImageDHash(sampleForHash);
          }
        } catch (hashErr) {
          console.warn('Failed computing dHash', hashErr);
        }

        const uploaderDisplayName = user?.realName || user?.nickname || (space.members || []).find((m: any) => m.userId === user?.id)?.name || 'שותף במרחב';

        const docPayload = {
          shelfId, 
          folderId: effectiveFolderId || null,
          url: finalUrl, 
          type, 
          title, 
          addedBy: user?.id || '', 
          addedByName: uploaderDisplayName,
          thumbnailUrl: finalThumbnailUrl,
          pages: finalPages,
          storageTarget: effectiveTarget as 'cloud' | 'local' | 'gdrive',
          fileSize: detectedSize,
          dHash: computedDHash,
          allowedPartners: []
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

  const spacesCtx = useSpaces() as any;
  const myRole = spacesCtx.getRoleForSpace(space.id) || 'partner';
  const myPartnerToken = spacesCtx.getTokenForSpace ? spacesCtx.getTokenForSpace(space.id) : null;
  const isManaged = Boolean(space.settings?.isManagedMode);

  const activeDocuments = useMemo(() => {
    return documents.filter(d => !d.deletedAt && canAccessItem({
      spaceRole: myRole,
      userId: user?.id,
      partnerToken: myPartnerToken,
      creatorId: space.creatorId,
      isManagedMode: isManaged,
      ownerId: d.ownerId || (d as any).addedBy,
      allowedPartners: d.allowedPartners
    }));
  }, [documents, myRole, user?.id, myPartnerToken, space.creatorId, isManaged]);

  const deletedDocuments = useMemo(() => {
    return documents.filter(d => !!d.deletedAt);
  }, [documents]);

  const activeShelves = useMemo(() => {
    return shelves.filter(s => {
      if (s.deletedAt) return false;
      return canAccessItem({
        spaceRole: myRole,
        userId: user?.id,
        partnerToken: myPartnerToken,
        creatorId: space.creatorId,
        isManagedMode: isManaged,
        allowedPartners: s.allowedPartners
      });
    });
  }, [shelves, myRole, user?.id, myPartnerToken, space.creatorId, isManaged]);

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

  const handleOpenRecycleBin = () => {
    setShowRecycleBin(true);
  };

  const renderRecycleBinModal = () => {
    if (!showRecycleBin) return null;

    const trashItems: TrashItem[] = [
      ...deletedShelves.map(sh => ({
        id: sh.id,
        name: sh.name,
        type: 'shelf' as const,
        originLocation: 'כספת / רשימת מדפים',
        deletedAt: sh.deletedAt,
        rawItem: sh
      })),
      ...deletedDocuments.map(doc => {
        const sh = shelves.find(s => s.id === doc.shelfId);
        const origin = sh ? `כספת / מדף "${sh.name}"` : 'כספת / ללא מדף';
        return {
          id: doc.id,
          name: doc.title || 'מסמך ללא שם',
          type: 'document' as const,
          originLocation: origin,
          deletedAt: doc.deletedAt,
          thumbnailUrl: doc.thumbnailUrl,
          url: doc.url,
          pages: doc.pages,
          rawItem: doc
        };
      })
    ];

    return (
      <GlobalRecycleBinModal
        isOpen={showRecycleBin}
        onClose={() => setShowRecycleBin(false)}
        items={trashItems}
        onRestore={(item) => {
          if (item.type === 'shelf') {
            restoreShelf(space.id, item.id);
          } else {
            restoreDocument(space.id, item.id);
          }
        }}
        onPermanentDelete={(item) => {
          if (item.type === 'shelf') {
            setShelfToPermanentDelete({ id: item.id, name: item.name });
          } else {
            setDocToPermanentDelete({ id: item.id, title: item.name });
          }
        }}
        onPreviewItem={(item) => {
          if (item.rawItem) {
            setLastViewedDocId(item.id);
            setPreviewState({ docs: [item.rawItem], index: 0 });
          }
        }}
      />
    );
  };

  // Shared Document Note Modal (Single Source of Truth for both inner shelf view and outer shelves view)
  const renderDocNoteModal = () => {
    if (!noteDocId) return null;
    const targetDoc = documents.find(d => d.id === noteDocId);
    if (!targetDoc) return null;
    return (
      <DocNoteModal
        docTitle={targetDoc.title}
        initialNote={targetDoc.note}
        onSave={(noteText) => {
          updateDocument(space.id, targetDoc.id, { note: noteText });
          setNoteDocId(null);
        }}
        onClose={() => setNoteDocId(null)}
      />
    );
  };

        // Shared Privacy & Permissions Modal (Single Source of Truth for both inner shelf view and outer shelves gallery)
  const renderPrivacyModal = () => {
    if (!privacyTarget) return null;
        const activeMembers = (space.members || []).filter((m: any) => m.isActive !== false);
        const pendingInvites = (space.pendingInvites || []).filter((inv: any) => inv && inv.token);
        const rawAllowed = privacyTarget.allowedPartners || [];
        const currentAllowed = rawAllowed.filter(pid => pid && pid.trim() !== '' && (!space.creatorId || pid !== space.creatorId));
        const isOnlyMe = currentAllowed.includes('__only_me__');
        const isManagerVault = currentAllowed.includes('__creator_vault_secret__');
        const isRestricted = !isOnlyMe && !isManagerVault && currentAllowed.length > 0;
        const isPublic = !isOnlyMe && !isManagerVault && currentAllowed.length === 0;

        const targetTitle =
          privacyTarget.type === 'shelf' ? 'פרטיות והרשאות מדף ראשי' :
          privacyTarget.type === 'folder' ? 'פרטיות והרשאות תיקייה' :
          'פרטיות והרשאות מסמך';

        const targetIcon =
          privacyTarget.type === 'shelf' ? '🗂️' :
          privacyTarget.type === 'folder' ? '📁' :
          '📄';

        const inheritanceNote =
          privacyTarget.type === 'shelf'
            ? '💡 ברירת מחדל: כל הנושאים, התיקיות והמסמכים נוצרים פתוחים לכולם (🌐). שינוי הרשאה כאן יחול על מדף זה בלבד.'
            : privacyTarget.type === 'folder'
            ? '💡 ברירת מחדל: כל התיקיות והמסמכים נוצרים פתוחים לכולם (🌐). שינוי הרשאה כאן יחול על תיקייה זו בלבד.'
            : '💡 ברירת מחדל: כל מסמך נוצר פתוח לכולם (🌐). שינוי הרשאה כאן יגביל את המסמך הספציפי בלבד.';

        const currentUserId = user?.id || myPartnerToken || 'me';

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', zIndex: 100060, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '1.25rem', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', direction: 'rtl', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>{targetTitle}</h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                    {targetIcon} {privacyTarget.name}
                  </div>
                </div>
                <button onClick={() => setPrivacyTarget(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.85rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '12px', border: '1px solid #e2e8f0', lineHeight: 1.4 }}>
                {inheritanceNote}
              </div>

              {/* 4 Mode Selection Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', marginBottom: '1rem' }}>
                {/* 1. Public */}
                <button
                  type="button"
                  onClick={() => {
                    handleSavePrivacy([]);
                    showFeedbackToast('הוגדר כפתוח לכל חברי המרחב');
                  }}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '12px',
                    border: isPublic ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: isPublic ? '#eff6ff' : '#ffffff',
                    color: isPublic ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🌐</span>
                  <span>פתוח לכולם</span>
                </button>

                {/* 2. Restricted Partners */}
                <button
                  type="button"
                  onClick={() => {
                    const fallbackTarget = activeMembers[0]?.userId || 'partner';
                    handleSavePrivacy([fallbackTarget]);
                    showFeedbackToast('הוגדרה גישה מוגבלת לשותפים ספציפיים');
                  }}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '12px',
                    border: isRestricted ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: isRestricted ? '#eff6ff' : '#ffffff',
                    color: isRestricted ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🔒</span>
                  <span>שותפים</span>
                </button>

                {/* 3. Managers Only */}
                <button
                  type="button"
                  onClick={() => {
                    handleSavePrivacy(['__creator_vault_secret__']);
                    showFeedbackToast('הוגדר לכספת מנהלים ויוצר בלבד!');
                  }}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '12px',
                    border: isManagerVault ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                    background: isManagerVault ? '#f5f3ff' : '#ffffff',
                    color: isManagerVault ? '#6d28d9' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                  <span>מנהלים</span>
                </button>

                {/* 4. Only Me (Exclusive Personal Vault) */}
                <button
                  type="button"
                  onClick={() => {
                    handleSavePrivacy([currentUserId, '__only_me__']);
                    showFeedbackToast('הוגדר ככספת אישית: רק אתה יכול לראות!');
                  }}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '12px',
                    border: isOnlyMe ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    background: isOnlyMe ? '#fef2f2' : '#ffffff',
                    color: isOnlyMe ? '#b91c1c' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>👤</span>
                  <span>רק לעצמי</span>
                </button>
              </div>

              {/* Body Content based on Mode */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0 0.75rem 0' }}>
                {isOnlyMe && (
                  <div style={{ textAlign: 'center', padding: '1.2rem', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '16px', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>👤</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>כספת אישית בלעדית (רק עבורך!)</div>
                    <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '6px', lineHeight: 1.45 }}>
                      פריט זה מוסתר לחלוטין מכל חברי המרחב ומכל שאר המנהלים. <strong>אף אחד מלבדך לא רואה אותו</strong>, לא יודע על קיומו ולא יכול לגשת אליו.
                    </div>
                  </div>
                )}

                {isManagerVault && (
                  <div style={{ textAlign: 'center', padding: '1.2rem', background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: '16px', color: '#6d28d9' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>🛡️</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>כספת סודית למנהלים</div>
                    <div style={{ fontSize: '0.78rem', color: '#5b21b6', marginTop: '6px', lineHeight: 1.45 }}>
                      פריט זה גלוי אך ורק ליוצר המרחב ולמנהלי המרחב (Admins). שאר השותפים הרגילים אינם רואים אותו כלל (אפס חשיפה).
                    </div>
                  </div>
                )}

                {isRestricted && (
                  <>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>בחר שותפים מורשים לצפייה:</span>
                      <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>
                        {currentAllowed.filter(id => id && id !== '__only_me__' && id !== '__creator_vault_secret__').length} מורשים
                      </span>
                    </div>

                    {/* Active Space Members */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {activeMembers.map((m: any) => {
                        const isChecked = currentAllowed.includes(m.userId);
                        return (
                          <label
                            key={m.userId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.6rem 0.8rem',
                              background: isChecked ? '#eff6ff' : '#f8fafc',
                              border: isChecked ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.1rem' }}>👤</span>
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: isChecked ? 700 : 500, color: '#1e293b' }}>
                                  {m.name || 'שותף'} {m.role === 'admin' ? '(מנהל)' : ''}
                                </div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: isChecked ? '#16a34a' : '#94a3b8' }}>
                                  {isChecked ? '👁️ מורשה צפייה (גלוי עבורו)' : '🙈 מוסתר לחלוטין (אפס חשיפה)'}
                                </div>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newAllowed = isChecked
                                  ? currentAllowed.filter((id: string) => id !== m.userId && id !== '__creator_vault_secret__' && id !== '__only_me__')
                                  : [...currentAllowed.filter((id: string) => id !== '__creator_vault_secret__' && id !== '__only_me__'), m.userId];
                                handleSavePrivacy(newAllowed);
                              }}
                              style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                          </label>
                        );
                      })}

                      {/* Pending Invited Partners */}
                      {pendingInvites.map((inv: any) => {
                        const targetKey = inv.targetUserId || inv.token;
                        const isChecked = currentAllowed.includes(targetKey) || currentAllowed.includes(inv.token);
                        return (
                          <label
                            key={inv.token}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.6rem 0.8rem',
                              background: isChecked ? '#eff6ff' : '#f8fafc',
                              border: isChecked ? '1.5px solid #3b82f6' : '1px dashed #cbd5e1',
                              borderRadius: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.1rem' }}>⏳</span>
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: isChecked ? 700 : 500, color: '#1e293b' }}>
                                  {inv.name || 'שותף מוזמן'} <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>(בהמתנה להצטרפות)</span>
                                </div>
                                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: isChecked ? '#16a34a' : '#94a3b8' }}>
                                  {isChecked ? '👁️ מורשה מראש (ייפתח כשיצטרף)' : '🙈 מוסתר לחלוטין'}
                                </div>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const newAllowed = isChecked
                                  ? currentAllowed.filter((id: string) => id !== targetKey && id !== inv.token && id !== '__creator_vault_secret__' && id !== '__only_me__')
                                  : [...currentAllowed.filter((id: string) => id !== '__creator_vault_secret__' && id !== '__only_me__'), targetKey];
                                handleSavePrivacy(newAllowed);
                              }}
                              style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                          </label>
                        );
                      })}
                    </div>

                    {/* Quick Invite Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('smartshare:open_invite'));
                        }
                      }}
                      style={{
                        padding: '0.6rem',
                        background: '#f0fdf4',
                        border: '1.5px dashed #86efac',
                        borderRadius: '12px',
                        color: '#16a34a',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '0.35rem'
                      }}
                    >
                      <span>➕ הזמן שותף חדש למרחב</span>
                    </button>

                    <div style={{ fontSize: '0.72rem', color: '#64748b', background: '#f8fafc', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', lineHeight: 1.4, marginTop: '0.2rem' }}>
                      🔒 <strong>עיקרון אפס חשיפה (Zero-Trust):</strong> מי שאינו מסומן לא יראה את הפריט כלל ברשימה — הוא מוסתר לחלוטין (ללא מנעול, ללא כרטיס חסום).
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', background: 'white', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setPrivacyTarget(null)}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '14px',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
                  }}
                >
                  סיום ושמירה
                </button>
              </div>
            </div>
          </div>
        );
  };

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
                title: 'יצירת נושא ראשון',
                placeholder: 'הזן שם לנושא (לדוגמה: כללי, מסמכים אישיים)...',
                defaultValue: '',
                onSave: (name: string) => {
                  if (name.trim()) {
                    addShelf(space.id, {
                      name: name.trim(),
                      allowedPartners: []
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
    const activeShelfFolders: DocumentFolder[] = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === activeShelf.id);
    const currentActiveFolder = currentFolderId ? activeShelfFolders.find(f => f.id === currentFolderId) : null;

    return (
      <>
        <div style={{ padding: '0', paddingBottom: '6rem' }}>
        <div style={{ position: 'sticky', top: '56px', zIndex: 100, background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid #e2e8f0', margin: '0 -1rem 1rem -1rem', padding: '0.5rem 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                {activeShelf.icon || '🗂️'} {activeShelf.name}
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>✏️</span>
              </h2>
              {(() => {
                const shelfPrivacy = getPrivacyInfo(activeShelf.allowedPartners);
                return (
                  <button
                    type="button"
                    onClick={() => setPrivacyTarget({
                      type: 'shelf',
                      id: activeShelf.id,
                      name: activeShelf.name,
                      allowedPartners: activeShelf.allowedPartners || []
                    })}
                    style={{
                      background: shelfPrivacy.bg,
                      border: `1px solid ${shelfPrivacy.border}`,
                      color: shelfPrivacy.color,
                      fontSize: '0.74rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={`הרשאות מדף ראשי: ${shelfPrivacy.text} (לחץ לעריכה)`}
                  >
                    <span>{shelfPrivacy.icon}</span>
                    <span>{shelfPrivacy.text}</span>
                  </button>
                );
              })()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => setEditingShelfCoverId(activeShelf.id)} style={{ background: 'transparent', border: 'none', padding: '0', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                🎨 עיצוב
              </button>
              {totalTrashCount > 0 && (
                <button 
                  onClick={handleOpenRecycleBin}
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
                style={{ background: 'transparent', border: 'none', padding: '0', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                title="מחק מדף זה"
              >
                <span>🗑️</span>
                <span>מחק מדף</span>
              </button>
            </div>
          </div>
          <div style={{ paddingBottom: '0.5rem' }} />
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

        {/* Timeline Discovery Banner (shown inside the shelf ONLY when timeline is disabled) */}
        {!showTimeline && !isTimelineTipDismissed && (
          <div style={{
            position: 'relative',
            margin: '0 1rem 1rem 1rem',
            padding: '1.1rem 1.25rem',
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
                  הידעת? ניתן להפעיל במרחב זה את &apos;ציר זמן ותחנות&apos;
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

        {(activeTab === 'timeline' && showTimeline) ? (
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

                  {/* Favorite / Relevant Filter Button */}
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly(prev => !prev)}
                    style={{
                      background: showFavoritesOnly ? '#fef3c7' : '#f8fafc',
                      border: showFavoritesOnly ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                      color: showFavoritesOnly ? '#b45309' : '#475569',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: showFavoritesOnly ? '0 2px 6px rgba(245,158,11,0.2)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title="הצג רק הצעות מחיר ומסמכים מועדפים / רלוונטיים"
                  >
                    <span>{showFavoritesOnly ? '⭐' : '☆'}</span>
                    <span>{showFavoritesOnly ? 'מועדפים בלבד' : 'מועדפים'}</span>
                  </button>

                  {/* Explorer View Mode Dropdown Button (Compact, Space-Saving) */}
                  <div ref={vaultViewDropdownRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowVaultViewDropdown(prev => !prev)}
                      title="שינוי תצוגת מסמכים (רשימה / בינוני / גדול)"
                      style={{
                        background: showVaultViewDropdown ? '#eff6ff' : '#f8fafc',
                        border: showVaultViewDropdown ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                        color: showVaultViewDropdown ? '#1d4ed8' : '#334155',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: showVaultViewDropdown ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.95rem' }}>
                        {vaultViewMode === 'list' ? '☰' : vaultViewMode === 'grid_large' ? '☷' : '▦'}
                      </span>
                      <span>
                        {vaultViewMode === 'list' ? 'רשימה' : vaultViewMode === 'grid_large' ? 'גדול' : 'בינוני'}
                      </span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.65 }}>▾</span>
                    </button>

                    {showVaultViewDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        padding: '4px',
                        zIndex: 9999,
                        minWidth: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        animation: 'fadeIn 0.15s ease-out'
                      }}>
                        <button
                          type="button"
                          onClick={() => handleSetVaultViewMode('list')}
                          style={{
                            border: 'none',
                            background: vaultViewMode === 'list' ? '#eff6ff' : 'transparent',
                            color: vaultViewMode === 'list' ? '#1d4ed8' : '#334155',
                            fontWeight: vaultViewMode === 'list' ? 800 : 500,
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'right',
                            width: '100%'
                          }}
                        >
                          <span style={{ fontSize: '0.95rem' }}>☰</span>
                          <span>רשימה</span>
                          {vaultViewMode === 'list' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetVaultViewMode('grid_medium')}
                          style={{
                            border: 'none',
                            background: vaultViewMode === 'grid_medium' ? '#eff6ff' : 'transparent',
                            color: vaultViewMode === 'grid_medium' ? '#1d4ed8' : '#334155',
                            fontWeight: vaultViewMode === 'grid_medium' ? 800 : 500,
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'right',
                            width: '100%'
                          }}
                        >
                          <span style={{ fontSize: '0.95rem' }}>▦</span>
                          <span>בינוני</span>
                          {vaultViewMode === 'grid_medium' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetVaultViewMode('grid_large')}
                          style={{
                            border: 'none',
                            background: vaultViewMode === 'grid_large' ? '#eff6ff' : 'transparent',
                            color: vaultViewMode === 'grid_large' ? '#1d4ed8' : '#334155',
                            fontWeight: vaultViewMode === 'grid_large' ? 800 : 500,
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'right',
                            width: '100%'
                          }}
                        >
                          <span style={{ fontSize: '0.95rem' }}>☷</span>
                          <span>גדול</span>
                          {vaultViewMode === 'grid_large' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginRight: 'auto' }}>
                  {shelfDocs.length > 1 && !isMultiSelect && (
                    <button 
                      onClick={() => {
                        setIsMultiSelect(true);
                        setSelectedDocIds([]);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        padding: '6px 14px',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>☑️ בחירה מרובה</span>
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
                        <span>🏠</span> {activeShelf?.name || 'ראשי'}
                      </button>

                      {breadcrumbTrail.map((crumb, idx) => {
                        const isLast = idx === breadcrumbTrail.length - 1;
                        const folderPrivacy = getPrivacyInfo(crumb.allowedPartners);
                        return (
                          <React.Fragment key={crumb.id}>
                            <span style={{ color: '#94a3b8' }}>/</span>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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
                              {isLast && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrivacyTarget({
                                      type: 'folder',
                                      id: crumb.id,
                                      name: crumb.name,
                                      allowedPartners: crumb.allowedPartners || [],
                                      ownerId: crumb.ownerId
                                    });
                                  }}
                                  style={{
                                    background: folderPrivacy.bg,
                                    border: `1px solid ${folderPrivacy.border}`,
                                    color: folderPrivacy.color,
                                    fontSize: '0.68rem',
                                    padding: '1px 6px',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    marginRight: '2px'
                                  }}
                                  title={`הרשאות תיקייה זו: ${folderPrivacy.text} (לחץ לעריכה)`}
                                >
                                  <span>{folderPrivacy.icon}</span>
                                  <span>{folderPrivacy.text}</span>
                                </button>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MULTI-SELECT FLOATING ACTION BAR - REFACTORED VIA GLOBAL COMPONENT */}
          {isMultiSelect && (() => {
            const currentLevelDocIds = shelfDocs
              .filter(d => (currentFolderId ? d.folderId === currentFolderId : !d.folderId))
              .map(d => d.id);
            const isAllSelected = currentLevelDocIds.length > 0 && currentLevelDocIds.every(id => selectedDocIds.includes(id));

            const actions: BatchToolbarAction[] = [];

            if (selectedDocIds.length === 1) {
              actions.push({
                id: 'edit',
                label: 'עריכה',
                icon: '✂️',
                variant: 'primary',
                title: 'עריכה ופילטור המסמך בסורק',
                onClick: () => {
                  const targetDoc = documents.find(d => d.id === selectedDocIds[0]);
                  if (targetDoc && typeof window !== 'undefined') {
                    setIsMultiSelect(false);
                    setSelectedDocIds([]);
                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', {
                      detail: { doc: targetDoc }
                    }));
                  }
                }
              });
            } else if (selectedDocIds.length > 1) {
              actions.push({
                id: 'merge',
                label: 'איחוד',
                icon: '📜',
                variant: 'primary',
                title: 'עריכה, יישור ואיחוד המסמכים הנבחרים בסורק',
                onClick: () => {
                  console.log('[DEBUG MERGE] selectedDocIds:', selectedDocIds);
                  const targetDocs = selectedDocIds.map(id => documents.find(d => d.id === id)).filter((d) => Boolean(d)) as any[];
                  console.log('[DEBUG MERGE] targetDocs:', targetDocs.map(d => ({ id: d.id, title: d.title, pages: d.pages?.length })));
                  if (targetDocs.length > 0 && typeof window !== 'undefined') {
                    setIsMultiSelect(false);
                    setSelectedDocIds([]);
                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', {
                      detail: { docs: targetDocs }
                    }));
                  }
                }
              });
            }

            actions.push({
              id: 'move',
              label: 'תיקייה',
              icon: '📁',
              variant: 'info',
              title: 'העבר מסמכים נבחרים לתיקייה',
              onClick: () => setMoveDocToFolder({ docIds: selectedDocIds, currentFolderId })
            });

            actions.push({
              id: 'share',
              label: isSharingBatch ? 'מכין...' : 'שתף',
              icon: '📤',
              variant: 'secondary',
              disabled: isSharingBatch,
              onClick: () => shareMultipleDocuments(selectedDocIds)
            });

            actions.push({
              id: 'delete',
              label: 'מחק',
              icon: '🗑️',
              variant: 'danger',
              title: 'העבר מסמכים נבחרים לסל אשפה',
              onClick: () => setBatchDeleteConfirm(true)
            });

            return (
              <BatchActionToolbar
                selectedCount={selectedDocIds.length}
                totalCount={currentLevelDocIds.length}
                isAllSelected={isAllSelected}
                onToggleSelectAll={() => {
                  if (isAllSelected) {
                    setSelectedDocIds(prev => prev.filter(id => !currentLevelDocIds.includes(id)));
                  } else {
                    setSelectedDocIds(prev => Array.from(new Set([...prev, ...currentLevelDocIds])));
                  }
                }}
                onCancel={() => {
                  setIsMultiSelect(false);
                  setSelectedDocIds([]);
                }}
                actions={actions}
              />
            );
          })()}

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
            const allShelfFolders = (space.documentFolders || []).filter(f => {
              if (f.deletedAt || f.shelfId !== activeShelfId) return false;
              return canAccessItem({
                spaceRole: myRole,
                userId: user?.id,
                partnerToken: myPartnerToken,
                creatorId: space.creatorId,
                isManagedMode: isManaged,
                allowedPartners: f.allowedPartners
              });
            });
            const currentLevelFolders = allShelfFolders.filter(f => currentFolderId ? f.parentId === currentFolderId : !f.parentId);

            let filteredDocs = shelfDocs.filter(doc => {
              // Explorer Hierarchy check: document must reside in the current folder level
              const matchesFolder = currentFolderId ? doc.folderId === currentFolderId : !doc.folderId;
              if (!matchesFolder) return false;

              // Zero-Trust Permission Check:
              if (!canAccessItem({
                spaceRole: myRole,
                userId: user?.id,
                partnerToken: myPartnerToken,
                creatorId: space.creatorId,
                isManagedMode: isManaged,
                ownerId: doc.ownerId || (doc as any).addedBy,
                allowedPartners: doc.allowedPartners
              })) {
                return false;
              }

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

            if (showFavoritesOnly) {
              filteredDocs = filteredDocs.filter(doc => doc.isFavorite);
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
                    <div onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd} onMouseUp={handleTouchDragEnd} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                            const isFolderDragOver = dragOverFolderId === folder.id;

                            return (
                              <div
                                key={folder.id}
                                data-folder-id={folder.id}
                                onClick={() => setCurrentFolderId(folder.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.55rem 0.85rem',
                                  background: isFolderDragOver ? '#eff6ff' : '#ffffff',
                                  border: isFolderDragOver ? '2px dashed #2563eb' : '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isFolderDragOver ? '0 4px 12px rgba(37,99,235,0.2)' : '0 1px 3px rgba(0,0,0,0.02)',
                                  transform: isFolderDragOver ? 'scale(1.02)' : 'none',
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
                                      {(() => {
                                        const folderPrivacy = getPrivacyInfo(folder.allowedPartners);
                                        return (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPrivacyTarget({
                                                type: 'folder',
                                                id: folder.id,
                                                name: folder.name,
                                                allowedPartners: folder.allowedPartners || [],
                                                ownerId: folder.ownerId
                                              });
                                            }}
                                            style={{
                                              fontSize: '0.66rem',
                                              background: folderPrivacy.bg,
                                              color: folderPrivacy.color,
                                              border: `1px solid ${folderPrivacy.border}`,
                                              padding: '1px 6px',
                                              borderRadius: '6px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px'
                                            }}
                                            title={`הרשאות תיקייה: ${folderPrivacy.text} (לחץ לעריכה)`}
                                          >
                                            <span>{folderPrivacy.icon}</span>
                                            <span>{folderPrivacy.text}</span>
                                          </button>
                                        );
                                      })()}
                                      {folderStation && (
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
                                  {(() => {
                                    const folderPrivacy = getPrivacyInfo(folder.allowedPartners);
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setPrivacyTarget({
                                          type: 'folder',
                                          id: folder.id,
                                          name: folder.name,
                                          allowedPartners: folder.allowedPartners || [],
                                          ownerId: folder.ownerId
                                        })}
                                        style={{ 
                                          background: folderPrivacy.bg, 
                                          border: `1px solid ${folderPrivacy.border}`, 
                                          padding: '3px 7px', 
                                          borderRadius: '7px', 
                                          fontSize: '0.72rem', 
                                          fontWeight: 600, 
                                          color: folderPrivacy.color, 
                                          cursor: 'pointer' 
                                        }}
                                        title={`פרטיות וגישה לתיקייה: ${folderPrivacy.text}`}
                                      >
                                        {folderPrivacy.icon}
                                      </button>
                                    );
                                  })()}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFolderToMove(folder);
                                      
                                    }}
                                    style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}
                                    title="העבר תיקייה למדף/מיקום אחר"
                                  >
                                    📦
                                  </button>
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
                            gridTemplateColumns: isMultiSelect ? '26px 36px 30px 38px 1fr 90px 105px' : '36px 30px 38px 1fr 90px 105px',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.35rem 0.6rem',
                            background: '#f1f5f9',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: '#475569'
                          }}>
                            {isMultiSelect && <span style={{ textAlign: 'center' }}>בחר</span>}
                            <span style={{ textAlign: 'center' }}>מס'</span>
                            <span style={{ textAlign: 'center' }} title="מועדף / רלוונטי">⭐</span>
                            <span>תצוגה</span>
                            <span>שם המסמך ושיוך</span>
                            <span style={{ textAlign: 'right' }}>תאריך / משקל</span>
                            <span style={{ textAlign: 'center' }}>פעולות</span>
                          </div>

                          {filteredDocs.map((doc, docIdx) => {
                            const linkedEvent = getDocLinkedEvent(doc.id, doc.url);
                            const isChecked = selectedDocIds.includes(doc.id);
                            const isPdf = doc.type === 'pdf' || (doc.url && doc.url.toLowerCase().includes('.pdf')) || doc.url?.startsWith('data:application/pdf');
                            const effectiveSize = doc.fileSize || measuredSizes[doc.id];
                            const isLastViewed = lastViewedDocId === doc.id;

                            return (
                              <div
                                key={doc.id}
                                data-doc-id={doc.id}
                                onTouchStart={() => startLongPress(doc.id)}
                                onTouchMove={cancelLongPress}
                                onTouchEnd={cancelLongPress}
                                onMouseDown={() => startLongPress(doc.id)}
                                onMouseUp={cancelLongPress}
                                onClick={() => {
                                  if (isLongPressTriggeredRef.current) {
                                    isLongPressTriggeredRef.current = false;
                                    return;
                                  }
                                  if (isMultiSelect) {
                                    setSelectedDocIds(prev => isChecked ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                  } else {
                                    setLastViewedDocId(doc.id);
                                    setPreviewState({ docs: filteredDocs, index: docIdx });
                                  }
                                }}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: isMultiSelect ? '26px 36px 30px 38px 1fr 90px 105px' : '36px 30px 38px 1fr 90px 105px',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  padding: '0.4rem 0.6rem',
                                  background: isChecked ? '#eff6ff' : (isLastViewed ? '#ecfeff' : (doc.isFavorite ? '#fffbeb' : '#ffffff')),
                                  border: isChecked ? '1.5px solid #3b82f6' : (isLastViewed ? '2px solid #06b6d4' : (doc.isFavorite ? '1.5px solid #f59e0b' : '1px solid #e2e8f0')),
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease, box-shadow 0.2s ease',
                                  boxShadow: isLastViewed 
                                    ? '0 0 12px rgba(6, 182, 212, 0.45)' 
                                    : (doc.isFavorite ? '0 2px 6px rgba(245,158,11,0.15)' : '0 1px 2px rgba(0,0,0,0.02)')
                                }}
                                onMouseEnter={(e) => { if (!isChecked && !doc.isFavorite && !isLastViewed) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { if (!isChecked && !doc.isFavorite && !isLastViewed) e.currentTarget.style.background = '#ffffff'; }}
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

                                {/* Document Index Number */}
                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  color: '#64748b',
                                  textAlign: 'center',
                                  background: '#f1f5f9',
                                  padding: '2px 0',
                                  borderRadius: '6px'
                                }}>
                                  #{docIdx + 1}
                                </div>

                                {/* Favorite Star Toggle */}
                                <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => updateDocument(space.id, doc.id, { isFavorite: !doc.isFavorite })}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '1rem',
                                      padding: '2px',
                                      lineHeight: 1
                                    }}
                                    title={doc.isFavorite ? 'הסר ממועדפים / רלוונטיים' : 'סמן כהצעה מועדפת / רלוונטית'}
                                  >
                                    {doc.isFavorite ? '⭐' : '☆'}
                                  </button>
                                </div>

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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {doc.title}
                                    </span>
                                    {(() => {
                                      const isRawPdf = Boolean(doc.rawPdfUrl || doc.type === 'pdf' || (doc.url && doc.url.toLowerCase().includes('.pdf')));
                                      const isWebp = !isRawPdf && (doc.type === 'document' || doc.type === 'image' || (doc.url && doc.url.toLowerCase().includes('.webp')) || (doc.thumbnailUrl && doc.thumbnailUrl.toLowerCase().includes('.webp')));
                                      return (
                                        <span style={{
                                          fontSize: '0.6rem',
                                          fontWeight: 800,
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          background: isRawPdf ? '#fee2e2' : isWebp ? '#dbeafe' : '#f1f5f9',
                                          color: isRawPdf ? '#b91c1c' : isWebp ? '#1d4ed8' : '#334155',
                                          border: isRawPdf ? '1px solid #fca5a5' : isWebp ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                                          flexShrink: 0
                                        }}>
                                          {isRawPdf ? 'PDF' : isWebp ? 'WEBP' : 'FILE'}
                                        </span>
                                      );
                                    })()}
                                    {isDocUnread(doc) && (
                                      <span
                                        style={{
                                          fontSize: '0.62rem',
                                          background: '#fef2f2',
                                          color: '#ef4444',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          fontWeight: 800,
                                          border: '1px solid #fecaca',
                                          flexShrink: 0,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px'
                                        }}
                                        title="מסמך חדש שהועלה על ידי שותף ביממה האחרונה"
                                      >
                                        🔴 חדש
                                      </span>
                                    )}
                                    {doc.isFavorite && (
                                      <span style={{ fontSize: '0.62rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>
                                        מועדף
                                      </span>
                                    )}
                                    {isLastViewed && (
                                      <span style={{ fontSize: '0.62rem', background: '#cffafe', color: '#0891b2', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, border: '1px solid #a5f3fc', flexShrink: 0 }}>
                                        נצפה
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                    {linkedEvent && (
                                      <span style={{ fontSize: '0.66rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                        📍 {linkedEvent.title}
                                      </span>
                                    )}
                                    {doc.linkedDocIds && doc.linkedDocIds.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setViewLinkedDocsFor(doc); }}
                                        style={{ fontSize: '0.66rem', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                        title="לחץ לצפייה בחשבוניות / מסמכים מקושרים"
                                      >
                                        💳 {doc.linkedDocIds.length} מקושרים
                                      </button>
                                    )}
                                    {(() => {
                                      const payingParents = activeDocuments.filter(d => d.linkedDocIds?.includes(doc.id));
                                      if (payingParents.length === 0) return null;
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setViewLinkedDocsFor(payingParents[0]); }}
                                          style={{ fontSize: '0.66rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                          title={`משולם ע"י / מקושר ל: ${payingParents.map(p => p.title).join(', ')}`}
                                        >
                                          ✅ משולם ע"י {payingParents[0].title.slice(0, 10)}...
                                        </button>
                                      );
                                    })()}
                                    <span style={{ fontSize: '0.64rem', color: '#64748b' }}>
                                      {doc.storageTarget === 'local' ? '📱 מקומי' : doc.storageTarget === 'gdrive' ? '📁 Drive' : '☁️ ענן'}
                                    </span>
                                    {(() => {
                                      const uploader = (space.members || []).find((m: any) => m.userId === doc.addedBy);
                                      const uploaderName = doc.addedByName || uploader?.name || (doc.addedBy === user?.id ? 'אני' : (doc.addedBy === space.creatorId ? 'יוצר המרחב' : ''));
                                      if (!uploaderName) return null;
                                      return (
                                        <span style={{ fontSize: '0.64rem', color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }} title={`הועלה ע"י: ${uploaderName}`}>
                                          👤 {uploaderName}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Date & Size */}
                                <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span>{new Date(doc.createdAt).toLocaleDateString('he-IL')}</span>
                                  <span style={{ fontSize: '0.62rem', background: effectiveSize ? '#f1f5f9' : '#fef2f2', color: effectiveSize ? '#334155' : '#ea580c', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0' }} title="גודל הקובץ">
                                    {effectiveSize ? `⚖️ ${formatFileSize(effectiveSize)}` : '⚖️ מודד...'}
                                  </span>
                                </div>

                                {/* Quick Actions */}
                                <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  {(() => {
                                    const docPrivacy = getPrivacyInfo(doc.allowedPartners);
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setPrivacyTarget({
                                          type: 'document',
                                          id: doc.id,
                                          name: doc.title,
                                          allowedPartners: doc.allowedPartners || [],
                                          ownerId: doc.ownerId || (doc as any).addedBy
                                        })}
                                        title={`פרטיות והרשאות מסמך: ${docPrivacy.text}`}
                                        style={{ background: docPrivacy.bg, color: docPrivacy.color, border: `1px solid ${docPrivacy.border}`, borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                      >
                                        {docPrivacy.icon}
                                      </button>
                                    );
                                  })()}
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
                                           onClick={(e) => { e.stopPropagation(); setMoveDocToFolder({ docIds: [doc.id], currentFolderId: doc.folderId }); }}
                                           style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                           title="העבר לתיקייה אחרת"
                                         >
                                           📁
                                         </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setLinkingDoc(doc); }}
                                    title="קשר לחשבוניות / מסמכים מקושרים"
                                    style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    💳
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

                            const isFolderDragOver = dragOverFolderId === folder.id;

                            return (
                              <div
                                key={folder.id}
                                data-folder-id={folder.id}
                                onClick={() => setCurrentFolderId(folder.id)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0.75rem 0.5rem 0.5rem 0.5rem',
                                  background: isFolderDragOver ? '#eff6ff' : '#ffffff',
                                  border: isFolderDragOver ? '2px dashed #2563eb' : '1px solid #e2e8f0',
                                  borderRadius: '16px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isFolderDragOver ? '0 8px 20px rgba(37,99,235,0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
                                  textAlign: 'center',
                                  gap: '0.35rem',
                                  position: 'relative',
                                  transform: isFolderDragOver ? 'scale(1.04)' : 'none'
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

                                {(() => {
                                  const fPrivacy = getPrivacyInfo(folder.allowedPartners);
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPrivacyTarget({
                                          type: 'folder',
                                          id: folder.id,
                                          name: folder.name,
                                          allowedPartners: folder.allowedPartners || [],
                                          ownerId: folder.ownerId
                                        });
                                      }}
                                      style={{
                                        background: fPrivacy.bg,
                                        border: `1px solid ${fPrivacy.border}`,
                                        color: fPrivacy.color,
                                        fontSize: '0.66rem',
                                        padding: '1px 6px',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        maxWidth: '90%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={`הרשאות תיקייה: ${fPrivacy.text} (לחץ לעריכה)`}
                                    >
                                      <span>{fPrivacy.icon}</span>
                                      <span>{fPrivacy.text}</span>
                                    </button>
                                  );
                                })()}

                                {/* Station badge */}
                                {folderStation && (
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
                                  {(() => {
                                    const folderPrivacy = getPrivacyInfo(folder.allowedPartners);
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setPrivacyTarget({
                                          type: 'folder',
                                          id: folder.id,
                                          name: folder.name,
                                          allowedPartners: folder.allowedPartners || [],
                                          ownerId: folder.ownerId
                                        })}
                                        style={{ 
                                          background: folderPrivacy.bg, 
                                          border: `1px solid ${folderPrivacy.border}`, 
                                          borderRadius: '5px', 
                                          padding: '1px 5px', 
                                          fontSize: '0.68rem', 
                                          color: folderPrivacy.color,
                                          cursor: 'pointer' 
                                        }}
                                        title={`פרטיות וגישה לתיקייה: ${folderPrivacy.text}`}
                                      >
                                        {folderPrivacy.icon}
                                      </button>
                                    );
                                  })()}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFolderToMove(folder);
                                      
                                    }}
                                    style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}
                                    title="העבר תיקייה למדף/מיקום אחר"
                                  >
                                    📦
                                  </button>
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
                          {filteredDocs.map((doc, docIdx) => {
                            const linkedEvent = getDocLinkedEvent(doc.id, doc.url);
                            const isChecked = selectedDocIds.includes(doc.id);
                            const isPdf = doc.type === 'pdf' || (doc.url && doc.url.toLowerCase().includes('.pdf')) || doc.url?.startsWith('data:application/pdf');
                            const effectiveSize = doc.fileSize || measuredSizes[doc.id];
                            const isLastViewed = lastViewedDocId === doc.id;

                            return (
                              <div
                                key={doc.id}
                                data-doc-id={doc.id}
                                onTouchStart={() => startLongPress(doc.id)}
                                onTouchMove={cancelLongPress}
                                onTouchEnd={cancelLongPress}
                                onMouseDown={() => startLongPress(doc.id)}
                                onMouseUp={cancelLongPress}
                                onClick={() => {
                                  if (isLongPressTriggeredRef.current) {
                                    isLongPressTriggeredRef.current = false;
                                    return;
                                  }
                                  if (isMultiSelect) {
                                    setSelectedDocIds(prev => isChecked ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                  }
                                }}
                                style={{
                                  background: isLastViewed ? '#f0fdfa' : (doc.isFavorite ? '#fffdf7' : '#ffffff'),
                                  borderRadius: '14px',
                                  overflow: 'visible',
                                  border: isChecked 
                                    ? '2px solid #2563eb' 
                                    : (dragOverDocId === doc.id 
                                        ? '2px dashed #3b82f6' 
                                        : (isLastViewed 
                                            ? '2.5px solid #06b6d4' 
                                            : (doc.isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0'))),
                                  position: 'relative',
                                  zIndex: activeDocMenuId === doc.id ? 60 : (isLastViewed ? 5 : 1),
                                  opacity: draggedDocId === doc.id ? 0.4 : (doc.id.startsWith('temp-') ? 0.6 : 1),
                                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                  transform: isChecked ? 'scale(1.02)' : (dragOverDocId === doc.id ? 'scale(1.02)' : (isLastViewed ? 'scale(1.015)' : 'none')),
                                  boxShadow: isChecked 
                                    ? '0 6px 16px rgba(37,99,235,0.2)' 
                                    : (isLastViewed 
                                        ? '0 0 0 1.5px #06b6d4, 0 0 20px rgba(6, 182, 212, 0.55), 0 6px 16px rgba(0,0,0,0.08)' 
                                        : (doc.isFavorite ? '0 4px 14px rgba(245,158,11,0.22)' : '0 2px 4px rgba(0,0,0,0.03)')),
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
                                    if (isLongPressTriggeredRef.current) {
                                      isLongPressTriggeredRef.current = false;
                                      return;
                                    }
                                    if (isMultiSelect) return;
                                    e.stopPropagation();
                                    setLastViewedDocId(doc.id);
                                    setPreviewState({ docs: filteredDocs, index: docIdx });
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
                                  {/* Document Index Badge */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '6px',
                                    right: '6px',
                                    background: 'rgba(15, 23, 42, 0.82)',
                                    backdropFilter: 'blur(4px)',
                                    color: '#ffffff',
                                    padding: '1px 7px',
                                    borderRadius: '6px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    zIndex: 15,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                  }}>
                                    #{docIdx + 1}
                                  </div>

                                  {/* Favorite Star Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateDocument(space.id, doc.id, { isFavorite: !doc.isFavorite });
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: '6px',
                                      left: isMultiSelect ? '32px' : '6px',
                                      zIndex: 26,
                                      background: doc.isFavorite ? '#fef3c7' : 'rgba(255,255,255,0.9)',
                                      border: doc.isFavorite ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                                      borderRadius: '50%',
                                      width: '26px',
                                      height: '26px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title={doc.isFavorite ? 'הסר ממועדפים / רלוונטיים' : 'סמן כהצעה מועדפת / רלוונטית'}
                                  >
                                    <span>{doc.isFavorite ? '⭐' : '☆'}</span>
                                  </button>

                                  {isPdf && !doc.thumbnailUrl && <span style={{ fontSize: '2.5rem' }}>📑</span>}
                                  {/* File Format Badge (PDF vs WEBP) */}
                                  {(() => {
                                    const isRawPdf = Boolean(doc.rawPdfUrl || doc.type === 'pdf' || (doc.url && doc.url.toLowerCase().includes('.pdf')));
                                    const isWebp = !isRawPdf && (doc.type === 'document' || doc.type === 'image' || (doc.url && doc.url.toLowerCase().includes('.webp')) || (doc.thumbnailUrl && doc.thumbnailUrl.toLowerCase().includes('.webp')));
                                    return (
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        left: '4px',
                                        background: isRawPdf ? 'rgba(220, 38, 38, 0.92)' : isWebp ? 'rgba(37, 99, 235, 0.92)' : 'rgba(15, 23, 42, 0.85)',
                                        color: '#ffffff',
                                        padding: '2px 6px',
                                        borderRadius: '5px',
                                        fontSize: '0.62rem',
                                        fontWeight: 900,
                                        letterSpacing: '0.5px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        border: '1px solid rgba(255,255,255,0.3)'
                                      }}>
                                        <span>{isRawPdf ? '📄 PDF' : isWebp ? '🖼️ WEBP' : '📁 קובץ'}</span>
                                      </div>
                                    );
                                  })()}
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
                                    style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="לחץ לשינוי שם"
                                  >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                                    {(() => {
                                      const isRawPdf = Boolean(doc.rawPdfUrl || doc.type === 'pdf' || (doc.url && doc.url.toLowerCase().includes('.pdf')));
                                      const isWebp = !isRawPdf && (doc.type === 'document' || doc.type === 'image' || (doc.url && doc.url.toLowerCase().includes('.webp')) || (doc.thumbnailUrl && doc.thumbnailUrl.toLowerCase().includes('.webp')));
                                      return (
                                        <span style={{
                                          fontSize: '0.58rem',
                                          fontWeight: 800,
                                          padding: '0 4px',
                                          borderRadius: '3px',
                                          background: isRawPdf ? '#fee2e2' : isWebp ? '#dbeafe' : '#f1f5f9',
                                          color: isRawPdf ? '#b91c1c' : isWebp ? '#1d4ed8' : '#334155',
                                          border: isRawPdf ? '1px solid #fca5a5' : isWebp ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                                          flexShrink: 0
                                        }}>
                                          {isRawPdf ? 'PDF' : isWebp ? 'WEBP' : 'FILE'}
                                        </span>
                                      );
                                    })()}
                                  </div>

                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {isDocUnread(doc) && (
                                      <span style={{ fontSize: '0.62rem', background: '#fef2f2', color: '#ef4444', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, border: '1px solid #fecaca' }}>
                                        🔴 חדש
                                      </span>
                                    )}
                                    {doc.isFavorite && (
                                      <span style={{ fontSize: '0.62rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, border: '1px solid #fcd34d' }}>
                                        ⭐ הצעה מועדפת
                                      </span>
                                    )}
                                    {isLastViewed && (
                                      <span style={{ fontSize: '0.62rem', background: '#ecfeff', color: '#0891b2', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, border: '1px solid #a5f3fc', boxShadow: '0 0 8px rgba(6, 182, 212, 0.35)' }}>
                                        👁️ נצפה לאחרונה
                                      </span>
                                    )}
                                    {doc.linkedDocIds && doc.linkedDocIds.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          if (isMultiSelect) return;
                                          e.stopPropagation();
                                          setViewLinkedDocsFor(doc);
                                        }}
                                        style={{
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          border: '1px solid #a7f3d0',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 800,
                                          fontSize: '0.62rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px'
                                        }}
                                        title="לחץ לצפייה במסמכים / חשבוניות המקושרים"
                                      >
                                        💳 {doc.linkedDocIds.length} מקושרים
                                      </button>
                                    )}
                                    {(() => {
                                      const payingParents = activeDocuments.filter(d => d.linkedDocIds?.includes(doc.id));
                                      if (payingParents.length === 0) return null;
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            if (isMultiSelect) return;
                                            e.stopPropagation();
                                            setViewLinkedDocsFor(payingParents[0]);
                                          }}
                                          style={{
                                            background: '#fef3c7',
                                            color: '#b45309',
                                            border: '1px solid #fde68a',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 800,
                                            fontSize: '0.62rem',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}
                                          title={`משולם ע"י / מקושר ל: ${payingParents.map(p => p.title).join(', ')}`}
                                        >
                                          ✅ משולם ע"י {payingParents[0].title.slice(0, 8)}...
                                        </button>
                                      );
                                    })()}
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: '#64748b' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                      {new Date(doc.createdAt).toLocaleDateString('he-IL')}
                                      <span style={{ fontSize: '0.6rem', background: effectiveSize ? '#f1f5f9' : '#fef2f2', color: effectiveSize ? '#334155' : '#ea580c', padding: '1px 4px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0' }} title="גודל הקובץ">
                                        {effectiveSize ? `⚖️ ${formatFileSize(effectiveSize)}` : '⚖️ מודד...'}
                                      </span>
                                      {(() => {
                                        const uploader = (space.members || []).find((m: any) => m.userId === doc.addedBy);
                                        const uploaderName = doc.addedByName || uploader?.name || (doc.addedBy === user?.id ? 'אני' : (doc.addedBy === space.creatorId ? 'יוצר המרחב' : ''));
                                        if (!uploaderName) return null;
                                        return (
                                          <span style={{ fontSize: '0.6rem', color: '#475569', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px' }} title={`הועלה ע"י: ${uploaderName}`}>
                                            👤 {uploaderName}
                                          </span>
                                        );
                                      })()}
                                      {doc.note && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setNoteDocId(doc.id); }}
                                          title="יש הערה – לחץ לקריאה"
                                          style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', borderRadius: '6px', padding: '0 5px', fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1.4 }}
                                        >
                                          📝
                                        </button>
                                      )}
                                    </span>
                                    {linkedEvent && (
                                      <span
                                        onClick={(e) => {
                                          if (isMultiSelect) return;
                                          e.stopPropagation();
                                          setWarehouseStationFilter(linkedEvent.id);
                                        }}
                                        style={{ 
                                          background: '#e0f2fe', 
                                          color: '#0369a1', 
                                          padding: '1px 5px', 
                                          borderRadius: '4px', 
                                          fontWeight: 700, 
                                          cursor: 'pointer',
                                          maxWidth: '120px',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px'
                                        }}
                                        title={'שייך לתחנה: ' + linkedEvent.title}
                                      >
                                        📍 {linkedEvent.title}
                                      </span>
                                    )}
                                  </div>

                                  {/* Action bar */}
                                  {!isMultiSelect && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
                                      <div style={{ display: 'flex', gap: '3px' }}>
                                        {(() => {
                                          const docPrivacy = getPrivacyInfo(doc.allowedPartners);
                                          return (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPrivacyTarget({
                                                  type: 'document',
                                                  id: doc.id,
                                                  name: doc.title,
                                                  allowedPartners: doc.allowedPartners || [],
                                                  ownerId: doc.ownerId || (doc as any).addedBy
                                                });
                                              }}
                                              style={{ background: docPrivacy.bg, color: docPrivacy.color, border: `1px solid ${docPrivacy.border}`, padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                              title={`פרטיות והרשאות מסמך: ${docPrivacy.text}`}
                                            >
                                              {docPrivacy.icon}
                                            </button>
                                          );
                                        })()}
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
                                          onClick={(e) => { e.stopPropagation(); setMoveDocToFolder({ docIds: [doc.id], currentFolderId: doc.folderId }); }}
                                          style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="העבר לתיקייה"
                                        >
                                          📁
                                        </button>
                                      </div>

                                      {/* Dots Menu */}
                                      <div data-doc-menu-container="true" style={{ position: 'relative' }}>
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
                                            <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: '120%', left: 0, background: 'white', borderRadius: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', padding: '0.45rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '175px', direction: 'rtl' }}>
                                              {/* קבוצה 1: פעולות ועריכה */}
                                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', padding: '0.2rem 0.4rem 0.1rem', letterSpacing: '0.3px' }}>
                                                עריכה ותצוגה
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveDocMenuId(null);
                                                  if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', { detail: { doc } }));
                                                  }
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#6d28d9', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                ✂️ עריכה בסורק
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); downloadDocument(doc.url, doc.title); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
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
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                ✏️ ערוך כותרת
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); setNoteDocId(doc.id); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                📝 {doc.note ? 'הצג / ערוך הערה' : 'הוסף הערה'}
                                              </button>

                                              {/* קו מפריד */}
                                              <div style={{ height: '1px', background: '#f1f5f9', margin: '0.2rem 0' }} />

                                              {/* קבוצה 2: ארגון ופרטיות */}
                                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', padding: '0.1rem 0.4rem', letterSpacing: '0.3px' }}>
                                                ארגון ופרטיות
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); setMoveDocToFolder({ docIds: [doc.id], currentFolderId: doc.folderId }); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                📁 העבר לתיקייה
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); handleMoveDocument(doc.id, activeShelf.id); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                🔄 העבר למדף
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveDocMenuId(null);
                                                  setPrivacyTarget({
                                                    type: 'document',
                                                    id: doc.id,
                                                    name: doc.title,
                                                    allowedPartners: doc.allowedPartners || [],
                                                    ownerId: doc.ownerId || (doc as any).addedBy
                                                  });
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                🔐 הרשאות ופרטיות
                                              </button>

                                              {/* קו מפריד */}
                                              <div style={{ height: '1px', background: '#f1f5f9', margin: '0.2rem 0' }} />

                                              {/* קבוצה 3: קישור */}
                                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', padding: '0.1rem 0.4rem', letterSpacing: '0.3px' }}>
                                                קישורים
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); setLinkingDoc(doc); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                💳 קשר להוצאה / מסמך
                                              </button>
                                              {showTimeline && (
                                                <button
                                                  type="button"
                                                  onClick={() => { setActiveDocMenuId(null); setLinkStationDoc({ docId: doc.id, title: doc.title, url: doc.url }); }}
                                                  style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                                >
                                                  🔗 {linkedEvent ? 'שנה תחנה (ציר זמן)' : 'קשר לתחנה (ציר זמן)'}
                                                </button>
                                              )}

                                              {/* קו מפריד */}
                                              <div style={{ height: '1px', background: '#fef2f2', margin: '0.2rem 0' }} />

                                              {/* קבוצה 4: מחיקה */}
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); handleDeleteDocument(doc.id, doc.title); }}
                                                style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.4rem 0.6rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#e11d48', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
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
        const count = moveDocToFolder.docIds.length;
        const singleDoc = count === 1 ? documents.find(d => String(d.id) === String(moveDocToFolder.docIds[0])) : null;
        const targetShelfId = activeShelfId || activeShelf?.id || singleDoc?.shelfId;
        const availableFolders = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === targetShelfId);
        
        return (
          <GlobalMoveModal
            isOpen={Boolean(moveDocToFolder)}
            itemCount={count}
            subtitle={count > 1 ? `📁 נבחרו ${count} מסמכים` : `📄 ${singleDoc?.title || 'מסמך'}`}
            currentFolderId={moveDocToFolder.currentFolderId}
            folders={availableFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId }))}
            onClose={() => setMoveDocToFolder(null)}
            onConfirmMove={(targetFolderId) => {
              moveDocToFolder.docIds.forEach(id => {
                updateDocument(space.id, id, { folderId: targetFolderId ? String(targetFolderId) : null });
              });
              setSelectedDocIds([]);
              setIsMultiSelect(false);
              setMoveDocToFolder(null);
            }}
            rootLabel="תיקייה ראשית (ללא תיקייה)"
            rootDescription="שכבת הבסיס של המדף"
          />
        );
      })()}

      {renderPrivacyModal()}

      {/* MOVE ENTIRE FOLDER MODAL (Rule DRY / Single Source of Truth via GlobalMoveModal) */}
      {folderToMove && (() => {
        // Collect all descendant folder IDs to prevent circular nesting
        const getDescendantFolderIds = (parentId: string): string[] => {
          const direct = (space.documentFolders || []).filter(f => f.parentId === parentId && !f.deletedAt).map(f => f.id);
          let all = [...direct];
          direct.forEach(subId => {
            all = [...all, ...getDescendantFolderIds(subId)];
          });
          return all;
        };
        const invalidFolderIds = [folderToMove.id, ...getDescendantFolderIds(folderToMove.id)];

        // Candidate folders (excluding invalidFolderIds)
        const validFolders = (space.documentFolders || []).filter(f => 
          !f.deletedAt && 
          !invalidFolderIds.includes(f.id)
        );

        return (
          <GlobalMoveModal
            isOpen={Boolean(folderToMove)}
            title="העברת תיקייה שלמה"
            subtitle={`התיקייה "${folderToMove.name}" על כל מסמכיה`}
            itemCount={1}
            currentFolderId={folderToMove.parentId || null}
            currentShelfId={folderToMove.shelfId}
            shelves={space.shelves || []}
            folders={validFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId, shelfId: f.shelfId }))}
            onClose={() => setFolderToMove(null)}
            onConfirmMove={(targetFolderId, targetShelfId) => {
              const destShelfId = targetShelfId || folderToMove.shelfId;
              const isSame = destShelfId === folderToMove.shelfId && (targetFolderId || null) === (folderToMove.parentId || null);
              if (isSame) {
                setFolderToMove(null);
                return;
              }
              const targetShelf = (space.shelves || []).find(s => s.id === destShelfId);
              moveDocumentFolder(space.id, folderToMove.id, destShelfId, targetFolderId);
              if (destShelfId && destShelfId !== activeShelfId) {
                setActiveShelfId(destShelfId);
              }
              setCurrentFolderId(targetFolderId || null);
              setFolderToMove(null);
              showFeedbackToast(`התיקייה "${folderToMove.name}" וכל מסמכיה הועברו בהצלחה ${targetShelf ? 'למדף "' + targetShelf.name + '"' : ''}!`);
            }}
            rootLabel="רמה ראשית של המדף (ללא תיקיית אב)"
            rootDescription="שכבת הבסיס הראשית של המדף הנבחר"
          />
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
          onToggleFavorite={(docId, currentVal) => {
            if (typeof updateDocument === 'function') {
              updateDocument(space.id, docId, { isFavorite: !currentVal });
            }
          }}
          onIndexChange={(newIndex) => {
            const targetDoc = previewState?.docs?.[newIndex];
            if (targetDoc?.id) {
              setLastViewedDocId(targetDoc.id);
              markDocAsRead(targetDoc.id);
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

      {/* DOCUMENT TO DOCUMENT RELATIONAL LINKING MODAL */}
      <LinkDocumentsModal
        isOpen={Boolean(linkingDoc)}
        doc={linkingDoc}
        allDocs={activeDocuments}
        onClose={() => setLinkingDoc(null)}
        onSave={(docId, linkedDocIds) => {
          updateDocument(space.id, docId, { linkedDocIds });
          showFeedbackToast(`קושרו בהצלחה ${linkedDocIds.length} מסמכים!`);
        }}
      />

      {/* VIEW LINKED DOCUMENTS MODAL */}
      <LinkedDocsPreviewModal
        isOpen={Boolean(viewLinkedDocsFor)}
        parentDoc={viewLinkedDocsFor}
        allDocs={activeDocuments}
        onClose={() => setViewLinkedDocsFor(null)}
        onOpenDoc={(targetDoc, allLinked) => {
          const idx = allLinked.findIndex(d => d.id === targetDoc.id);
          setPreviewState({ docs: allLinked, index: idx >= 0 ? idx : 0 });
          setViewLinkedDocsFor(null);
        }}
        onEditLinks={(doc) => {
          setLinkingDoc(doc);
          setViewLinkedDocsFor(null);
        }}
      />

      {/* FLOATING ACTION FEEDBACK TOAST */}
      {feedbackToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100060,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '0.75rem 1.4rem',
            borderRadius: '9999px',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            direction: 'rtl',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '1.05rem' }}>✨</span>
          <span>{feedbackToast.message}</span>
        </div>
      )}

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

      {renderRecycleBinModal()}
      {renderDocNoteModal()}
      </>
    );
  }

  return (
    <div style={{ padding: '0', paddingBottom: '6rem' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(10px)', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', display: 'flex', flexDirection: 'column', lineHeight: '1', flexShrink: 0 }}>
          נושאים
          <span style={{ fontSize: '0.6rem', color: '#3b82f6', marginTop: '2px' }}>{APP_VERSION}</span>
        </h2>
        <input 
          type="text" 
          placeholder="חיפוש נושאים..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '90px', padding: '0.55rem 0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.88rem' }}
        />
        {totalTrashCount > 0 && (
          <button 
            onClick={() => {
              if (showRecycleBin) setShowRecycleBin(false);
              else handleOpenRecycleBin();
            }}
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
            title="סל אשפה (נושאים ומסמכים שנמחקו)"
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

      {/* Recycle Bin Modal with Backdrop (Click outside to close) */}
      {renderRecycleBinModal()}

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
            const isPrivate = (shelf.allowedPartners || []).filter(pid => pid && pid.trim() !== '' && pid !== space.creatorId).length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => isDocUnread(d));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : {});

            return (
              <div key={shelf.id} style={{ background: '#ffffff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', position: 'relative', ...highlightStyle }}>
                {hasNewRemoteDoc && (
                  <div
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', background: '#ef4444', borderRadius: '50%', border: '2px solid white' }}
                    title="נוספו מסמכים חדשים ביממה האחרונה על ידי שותף"
                  />
                )}
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
                    {(() => {
                      const pInfo = getPrivacyInfo(shelf.allowedPartners);
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrivacyTarget({
                              type: 'shelf',
                              id: shelf.id,
                              name: shelf.name,
                              allowedPartners: shelf.allowedPartners || []
                            });
                          }}
                          style={{
                            background: pInfo.bg,
                            border: `1px solid ${pInfo.border}`,
                            color: pInfo.color,
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem'
                          }}
                          title={`הרשאות ופרטיות מדף: ${pInfo.text}`}
                        >
                          {pInfo.icon}
                        </button>
                      );
                    })()}
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
            const hasNewRemoteDoc = shelfDocs.some(d => isDocUnread(d));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : { border: '1px solid #f1f5f9' });

            return (
              <div key={shelf.id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative', ...highlightStyle }}>
                {hasNewRemoteDoc && (
                  <div
                    style={{ position: 'absolute', top: '8px', right: '8px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }}
                    title="נוספו מסמכים חדשים ביממה האחרונה על ידי שותף"
                  />
                )}

                
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
                    {(() => {
                      const shelfPrivacy = getPrivacyInfo(shelf.allowedPartners);
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrivacyTarget({
                              type: 'shelf',
                              id: shelf.id,
                              name: shelf.name,
                              allowedPartners: shelf.allowedPartners || []
                            });
                          }}
                          style={{
                            background: shelfPrivacy.bg,
                            border: `1px solid ${shelfPrivacy.border}`,
                            color: shelfPrivacy.color,
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem'
                          }}
                          title={`הרשאות ופרטיות מדף: ${shelfPrivacy.text}`}
                        >
                          {shelfPrivacy.icon}
                        </button>
                      );
                    })()}
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
            const isPrivate = (shelf.allowedPartners || []).filter(pid => pid && pid.trim() !== '' && pid !== space.creatorId).length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => isDocUnread(d));
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
                {hasNewRemoteDoc && (
                  <div
                    style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }}
                    title="נוספו מסמכים חדשים ביממה האחרונה על ידי שותף"
                  />
                )}
                
                <div onClick={() => setActiveShelfId(shelf.id)} style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', ...highlightStyle, position: 'relative' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                  {(() => {
                    const pInfo = getPrivacyInfo(shelf.allowedPartners);
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrivacyTarget({
                            type: 'shelf',
                            id: shelf.id,
                            name: shelf.name,
                            allowedPartners: shelf.allowedPartners || []
                          });
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '-4px',
                          right: '-4px',
                          background: pInfo.bg,
                          border: `1px solid ${pInfo.border}`,
                          color: pInfo.color,
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          zIndex: 11
                        }}
                        title={`הרשאות מדף: ${pInfo.text}`}
                      >
                        {pInfo.icon}
                      </button>
                    );
                  })()}
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

      {/* CONFIRM PERMANENT DELETE DOCUMENT MODAL (Outer Shelves View) */}
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

      {/* DOCUMENT NOTE MODAL */}
      {renderDocNoteModal()}
      {/* PRIVACY MODAL IN OUTER GALLERY VIEW */}
      {renderPrivacyModal()}

      {/* SMART DUPLICATE PREVENTION INTERCEPTION MODAL */}
      {duplicateMatchState && (
        <DuplicateWarningModal
          isOpen={Boolean(duplicateMatchState)}
          match={duplicateMatchState.match}
          incomingTitle={duplicateMatchState.incomingTitle}
          onViewExisting={() => {
            const targetDoc = documents.find(d => d.id === duplicateMatchState.match.existingDocId);
            if (targetDoc) {
              setPreviewState({ docs: [targetDoc], index: 0 });
            }
            setDuplicateMatchState(null);
          }}
          onLinkToCurrentShelf={() => {
            // Link existing document to current shelf without copying bytes
            const targetDoc = documents.find(d => d.id === duplicateMatchState.match.existingDocId);
            if (targetDoc) {
              const currentLinked = Array.isArray(targetDoc.linkedShelfIds) ? targetDoc.linkedShelfIds : [];
              if (!currentLinked.includes(duplicateMatchState.shelfId)) {
                updateDocument(space.id, targetDoc.id, {
                  linkedShelfIds: [...currentLinked, duplicateMatchState.shelfId]
                });
              }
            }
            setDuplicateMatchState(null);
          }}
          onUploadAnyway={async () => {
            const state = duplicateMatchState;
            setDuplicateMatchState(null);
            if (state) {
              await handleSaveDocument(
                state.shelfId,
                state.url,
                state.type,
                state.allPages,
                state.targetEventId,
                state.folderId
              );
            }
          }}
          onCancel={() => setDuplicateMatchState(null)}
        />
      )}
    </div>
  );
});

DocumentsWidget.displayName = 'DocumentsWidget';
