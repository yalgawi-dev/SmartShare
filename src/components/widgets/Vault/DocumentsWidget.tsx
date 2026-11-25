'use client';
import { canAccessItem } from '../../../utils/permissionUtils';
import { recordTelemetryAction } from '../../../utils/telemetryTracker';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';
import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { universalSearch, universalSort } from '../../../utils/searchEngine';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces, DocumentFolder, SpaceDocument, DocumentShelf } from '../../../app/context/SpacesContext';
import { ShelfCoverPicker } from './ShelfCoverPicker';
import ShelfTimeline from './ShelfTimeline';
import { uploadImageToStorage } from '@/lib/firebase';
import ConfirmModal from '../../common/ConfirmModal';
import BatchActionToolbar, { BatchToolbarAction } from '../../common/BatchActionToolbar';
import GlobalRecycleBinModal, { TrashItem } from '../../common/GlobalRecycleBinModal';
import { downloadDocument, shareDocument, getDocumentPreviewUrl, formatFileSize, cleanDisplayTitle, getDocumentFormatInfo } from '../../../utils/documentUtils';
import { mergeImagesCleanly } from '../../../utils/imageOptimizer';
import ShareChoiceModal, { ShareChoiceDoc } from './ShareChoiceModal';
import DynamicPdfScrollPreview from './DynamicPdfScrollPreview';
import { saveLocalDeviceFile } from '../../../utils/localDeviceStorage';
import DocNoteModal from './DocNoteModal';
import { LinkDocumentsModal, LinkedDocsPreviewModal } from './DocumentLinkModals';
import { APP_VERSION } from '@/constants/version';
import { findDuplicateInSpace, computeImageDHash, resolveExplorerUniqueTitle, DuplicateMatch } from '@/utils/duplicateDetection';
import { DuplicateWarningModal } from './DuplicateWarningModal';
import { CreateShareLinkModal } from '../FileShare/CreateShareLinkModal';
import { ImportExistingFileModal } from '../FileShare/ImportExistingFileModal';
import { FileShareItem, ShareLinkConfig } from '@/utils/fileShareUtils';
import { useHardwareBackStep } from '@/hooks/useHardwareBack';
import {
  VaultTransferClipboardBar,
  VaultContextMenuPopover,
  VaultClipboardState,
  VaultContextMenuState,
} from './VaultTransferClipboard';
import { useGlobalTransferClipboard } from '@/utils/globalTransferClipboard';
import { useActionHistory } from '@/hooks/useActionHistory';
import { UndoRedoBar } from '@/components/common/UndoRedoBar';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string, explicitShelfId?: string, bypassDuplicateCheck?: boolean, explicitFolderId?: string | null, initialFileName?: string) => Promise<string | undefined>;
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
    spaces,
    addShelf, updateShelf, removeShelf, restoreShelf, permanentlyDeleteShelf, 
    addDocument, addDocumentAndLinkToEvent, updateDocument, removeDocument, restoreDocument, permanentlyDeleteDocument, 
    addDocumentFolder, updateDocumentFolder, removeDocumentFolder, restoreDocumentFolder, permanentlyDeleteDocumentFolder, moveDocumentFolder,
    exportDocumentFolderToSpace, exportShelfToSpace,
    addShelfEvent, updateShelfEvent, removeShelfEvent, addShelfEventComment, removeShelfEventComment,
    updateFileShareItems
  } = useSpaces() as any;
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'vault'>('vault');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [warehouseSortBy, setWarehouseSortBy] = useState<'station' | 'name' | 'date_desc' | 'date_asc'>('date_desc');
  const [warehouseStationFilter, setWarehouseStationFilter] = useState<string>('all');
  const [pendingImport, setPendingImport] = useState<{ docId?: string, url?: string, type?: 'document' | 'image' | 'pdf', allPages?: string[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState<{ id: string, shelfId: string, folderId?: string | null, url: string, title: string, type: string, thumbnailUrl?: string, isUploading?: boolean, uploadError?: boolean, progress?: number }[]>([]);
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
  const [showVaultImportModal, setShowVaultImportModal] = useState(false);
  const hasFinance = (space.features || []).includes('finance');
  const hasFileShare = (space.features || []).includes('fileshare');
  const showTimeline = !!space.settings?.showVaultTimeline;
  const [externalShareItem, setExternalShareItem] = useState<FileShareItem | null>(null);
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
    // Up to 14 days so users never miss documents added while away
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const isRecent = Date.now() - new Date(doc.createdAt).getTime() < FOURTEEN_DAYS_MS;
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
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [isSharingBatch, setIsSharingBatch] = useState(false);

  // Folders management states
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const currentFolderIdRef = useRef<string | null>(null);
  currentFolderIdRef.current = currentFolderId;
  const [showRecentFeedOnly, setShowRecentFeedOnly] = useState(false);
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
  const [linkingDoc, setLinkingDoc] = useState<{ doc: SpaceDocument; contextDocs?: SpaceDocument[] } | null>(null);
  const [viewLinkedDocsFor, setViewLinkedDocsFor] = useState<{ doc: SpaceDocument; contextDocs?: SpaceDocument[] } | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);

  const showFeedbackToast = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedbackToast({ message, type });
  };

  // Pin Vault document or folder to the Space Sharing Wall with ZERO storage duplication
  const handlePinToSharingWall = async (target: { type: 'doc' | 'folder'; item: any }) => {
    const existingItems: FileShareItem[] = Array.isArray((space as any).fileShareItems) ? [...(space as any).fileShareItems] : [];
    const now = Date.now();

    if (target.type === 'doc') {
      const docItem = target.item;
      const alreadyLinked = existingItems.find(i => !i.deletedAt && i.linkedSourceId === docItem.id);
      if (alreadyLinked) {
        showFeedbackToast('המסמך כבר משויך לקיר השיתוף!', 'info');
        return;
      }
      const isPdf = docItem.type === 'pdf' || docItem.url?.toLowerCase().includes('.pdf');
      const newWallItem: FileShareItem = {
        id: `wall_doc_${docItem.id}_${now}`,
        spaceId: space.id,
        name: docItem.title || 'מסמך',
        type: 'file',
        parentId: null,
        url: docItem.url,
        thumbnailUrl: docItem.thumbnailUrl || (Array.isArray(docItem.pages) && docItem.pages.length > 0 ? docItem.pages[0] : (!isPdf ? docItem.url : undefined)),
        pages: docItem.pages || [docItem.url],
        fileType: isPdf ? 'pdf' : 'image',
        size: 0, // Zero storage duplication!
        createdAt: now,
        createdBy: user?.id || 'user',
        creatorName: user?.realName || user?.nickname || 'משתמש',
        allowedPartners: docItem.allowedPartners || [],
        linkedSourceId: docItem.id,
        linkedSourceType: 'vault_doc'
      };
      if (updateFileShareItems) {
        await updateFileShareItems(space.id, [...existingItems, newWallItem]);
      }
      showFeedbackToast('המסמך שויך לקיר השיתוף בהצלחה (ללא שכפול נפח)!');
    } else if (target.type === 'folder') {
      const folder = target.item as DocumentFolder;
      const isShelf = shelves.some(s => s.id === folder.id);
      const alreadyLinked = existingItems.find(i => !i.deletedAt && i.linkedSourceId === folder.id);
      if (alreadyLinked) {
        showFeedbackToast(isShelf ? 'הנושא כבר משויך לקיר השיתוף!' : 'התיקייה כבר משויכת לקיר השיתוף!', 'info');
        return;
      }
      // Create root folder pointer and recursively map descendant subfolders and docs with 0 byte duplication
      const newItemsToAppend: FileShareItem[] = [];
      const folderIdMap: Record<string, string> = {};

      if (isShelf) {
        // Shelf is root container for all its folders and direct docs
        const wallShelfFolderId = `wall_shelf_${folder.id}_${now}`;
        newItemsToAppend.push({
          id: wallShelfFolderId,
          spaceId: space.id,
          name: folder.name,
          type: 'folder',
          parentId: null,
          createdAt: now,
          createdBy: user?.id || 'user',
          creatorName: user?.realName || user?.nickname || 'משתמש',
          allowedPartners: folder.allowedPartners || [],
          linkedSourceId: folder.id,
          linkedSourceType: 'vault_shelf' as any
        });

        // Add direct docs in shelf
        const shelfDirectDocs = documents.filter(d => !d.deletedAt && d.shelfId === folder.id && !d.folderId);
        shelfDirectDocs.forEach(d => {
          const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
          newItemsToAppend.push({
            id: `wall_doc_${d.id}_${now}`,
            spaceId: space.id,
            name: d.title || 'מסמך',
            type: 'file',
            parentId: wallShelfFolderId,
            url: d.url,
            thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
            pages: d.pages || [d.url],
            fileType: isPdf ? 'pdf' : 'image',
            size: 0,
            createdAt: now,
            createdBy: user?.id || 'user',
            creatorName: user?.realName || user?.nickname || 'משתמש',
            allowedPartners: d.allowedPartners || [],
            linkedSourceId: d.id,
            linkedSourceType: 'vault_doc'
          });
        });

        // Add shelf top-level folders recursively
        const mapFolderRecursive = (vFolder: DocumentFolder, wallParentId: string | null) => {
          const wallFolderId = `wall_fld_${vFolder.id}_${now}`;
          folderIdMap[vFolder.id] = wallFolderId;
          newItemsToAppend.push({
            id: wallFolderId,
            spaceId: space.id,
            name: vFolder.name,
            type: 'folder',
            parentId: wallParentId,
            createdAt: now,
            createdBy: user?.id || 'user',
            creatorName: user?.realName || user?.nickname || 'משתמש',
            allowedPartners: vFolder.allowedPartners || [],
            linkedSourceId: vFolder.id,
            linkedSourceType: 'vault_folder'
          });

          // Docs inside this folder
          const childDocs = documents.filter(d => !d.deletedAt && d.folderId === vFolder.id);
          childDocs.forEach(d => {
            const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
            newItemsToAppend.push({
              id: `wall_doc_${d.id}_${now}`,
              spaceId: space.id,
              name: d.title || 'מסמך',
              type: 'file',
              parentId: wallFolderId,
              url: d.url,
              thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
              pages: d.pages || [d.url],
              fileType: isPdf ? 'pdf' : 'image',
              size: 0,
              createdAt: now,
              createdBy: user?.id || 'user',
              creatorName: user?.realName || user?.nickname || 'משתמש',
              allowedPartners: d.allowedPartners || [],
              linkedSourceId: d.id,
              linkedSourceType: 'vault_doc'
            });
          });

          // Subfolders
          const subFolders = (space.documentFolders || []).filter(sf => !sf.deletedAt && sf.parentId === vFolder.id);
          subFolders.forEach(sf => mapFolderRecursive(sf, wallFolderId));
        };

        const shelfTopFolders = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === folder.id && !f.parentId);
        shelfTopFolders.forEach(f => mapFolderRecursive(f, wallShelfFolderId));

        if (updateFileShareItems) {
          await updateFileShareItems(space.id, [...existingItems, ...newItemsToAppend]);
        }
        showFeedbackToast(`הנושא "${folder.name}" וכל מסמכיו שויכו לקיר השיתוף (0 נפח כפול)!`);
      } else {
        const mapFolderRecursive = (vFolder: DocumentFolder, wallParentId: string | null) => {
          const wallFolderId = `wall_fld_${vFolder.id}_${now}`;
          folderIdMap[vFolder.id] = wallFolderId;
          newItemsToAppend.push({
            id: wallFolderId,
            spaceId: space.id,
            name: vFolder.name,
            type: 'folder',
            parentId: wallParentId,
            createdAt: now,
            createdBy: user?.id || 'user',
            creatorName: user?.realName || user?.nickname || 'משתמש',
            allowedPartners: vFolder.allowedPartners || [],
            linkedSourceId: vFolder.id,
            linkedSourceType: 'vault_folder'
          });

          // Docs inside this folder
          const childDocs = documents.filter(d => !d.deletedAt && d.folderId === vFolder.id);
          childDocs.forEach(d => {
            const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
            newItemsToAppend.push({
              id: `wall_doc_${d.id}_${now}`,
              spaceId: space.id,
              name: d.title || 'מסמך',
              type: 'file',
              parentId: wallFolderId,
              url: d.url,
              thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
              pages: d.pages || [d.url],
              fileType: isPdf ? 'pdf' : 'image',
              size: 0,
              createdAt: now,
              createdBy: user?.id || 'user',
              creatorName: user?.realName || user?.nickname || 'משתמש',
              allowedPartners: d.allowedPartners || [],
              linkedSourceId: d.id,
              linkedSourceType: 'vault_doc'
            });
          });

          // Subfolders
          const subFolders = (space.documentFolders || []).filter(sf => !sf.deletedAt && sf.parentId === vFolder.id);
          subFolders.forEach(sf => mapFolderRecursive(sf, wallFolderId));
        };

        mapFolderRecursive(folder, null);
        if (updateFileShareItems) {
          await updateFileShareItems(space.id, [...existingItems, ...newItemsToAppend]);
        }
        showFeedbackToast(`התיקייה "${folder.name}" ותכולתה שויכו לקיר השיתוף (0 נפח כפול)!`);
      }
    }
  };

  // Open External Share Link Modal directly for any Vault document or folder
  const handleOpenExternalShareModal = (target: { type: 'doc' | 'folder'; item: any }) => {
    if (target.type === 'doc') {
      const d = target.item;
      const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
      setExternalShareItem({
        id: d.id,
        spaceId: space.id,
        name: d.title || 'מסמך',
        type: 'file',
        parentId: d.folderId || null,
        url: d.url,
        thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
        pages: d.pages || [d.url],
        fileType: isPdf ? 'pdf' : 'image',
        size: d.fileSize || 0,
        createdAt: new Date(d.createdAt || Date.now()).getTime(),
        createdBy: d.addedBy || user?.id || 'user',
        creatorName: d.addedByName || user?.realName || 'משתמש',
        allowedPartners: d.allowedPartners || [],
        shareLink: (d as any).shareLink
      });
    } else {
      const f = target.item as DocumentFolder;
      setExternalShareItem({
        id: f.id,
        spaceId: space.id,
        name: f.name,
        type: 'folder',
        parentId: f.parentId || null,
        createdAt: new Date(f.createdAt || Date.now()).getTime(),
        createdBy: f.ownerId || user?.id || 'user',
        creatorName: user?.realName || 'משתמש',
        allowedPartners: f.allowedPartners || [],
        shareLink: (f as any).shareLink
      });
    }
  };

  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => {
      setFeedbackToast(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  // Windows / Google Drive Style Global Cut-Copy-Paste Clipboard & Long-Press Context Menu (Single Source of Truth — works across ALL spaces, shelves, folders & views!)
  const { clipboard, setClipboard, clearClipboard } = useGlobalTransferClipboard();
  const [contextMenu, setContextMenu] = useState<VaultContextMenuState | null>(null);
  const vaultHistory = useActionHistory({
    maxDepth: 20,
    onActionApplied: (dir, label) => {
      showFeedbackToast(dir === 'undo' ? `↩️ בוטל: ${label}` : `↪️ בוצע שוב: ${label}`);
    },
  });
  const contextLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const contextLongPressFiredAtRef = useRef<number>(0);

  const shouldIgnorePostLongPressClick = () => Date.now() - contextLongPressFiredAtRef.current < 500;

  const startContextLongPress = (
    e: React.TouchEvent | React.MouseEvent,
    itemType: 'document' | 'folder' | 'shelf' | 'canvas',
    id: string,
    title: string
  ) => {
    if (contextLongPressTimerRef.current) clearTimeout(contextLongPressTimerRef.current);
    const pt = 'touches' in e && e.touches[0] ? e.touches[0] : (e as React.MouseEvent);
    const x = pt?.clientX ?? 180;
    const y = pt?.clientY ?? 260;
    contextTouchStartPosRef.current = { x, y };
    contextLongPressTimerRef.current = setTimeout(() => {
      contextLongPressFiredAtRef.current = Date.now();
      setContextMenu({ itemType, id, title, x, y });
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(45);
        }
      } catch (_) {}
    }, 450);
  };

  const cancelContextLongPress = () => {
    contextTouchStartPosRef.current = null;
    if (contextLongPressTimerRef.current) {
      clearTimeout(contextLongPressTimerRef.current);
      contextLongPressTimerRef.current = null;
    }
  };

  const handleContextTouchMove = (e: React.TouchEvent) => {
    if (!contextLongPressTimerRef.current || !contextTouchStartPosRef.current) return;
    const pt = e.touches?.[0];
    if (!pt) return;
    const dx = pt.clientX - contextTouchStartPosRef.current.x;
    const dy = pt.clientY - contextTouchStartPosRef.current.y;
    // Allow natural finger tremor (12px) without cancelling long-press!
    if (Math.hypot(dx, dy) > 12) {
      cancelContextLongPress();
    }
  };

  // DRY helpers for Windows Explorer cut fade-out across ALL views (Grid, List, Shelves Feed/Grid/Circles, Mixed multi-select)
  const isDocCut = (docId: string) =>
    Boolean(
      clipboard?.mode === 'cut' &&
        clipboard.sourceEngine === 'vault' &&
        clipboard.sourceSpaceId === space.id &&
        (clipboard.itemType === 'document' || clipboard.itemType === 'mixed') &&
        clipboard.itemIds.includes(docId)
    );
  const isFolderCut = (folderId: string) =>
    Boolean(
      clipboard?.mode === 'cut' &&
        clipboard.sourceEngine === 'vault' &&
        clipboard.sourceSpaceId === space.id &&
        ((clipboard.itemType === 'folder' && clipboard.itemIds.includes(folderId)) ||
          Boolean(clipboard.folderIds?.includes(folderId)))
    );
  const isShelfCut = (shelfId: string) =>
    Boolean(
      clipboard?.mode === 'cut' &&
        clipboard.sourceEngine === 'vault' &&
        clipboard.sourceSpaceId === space.id &&
        clipboard.itemType === 'shelf' &&
        clipboard.itemIds.includes(shelfId)
    );

  const handleStageClipboard = (
    mode: 'cut' | 'copy',
    itemType: 'document' | 'folder' | 'shelf' | 'mixed',
    itemIds: string[],
    label: string,
    folderIds?: string[]
  ) => {
    if (itemIds.length === 0 && (!folderIds || folderIds.length === 0)) return;
    setClipboard({
      mode,
      sourceEngine: 'vault',
      sourceSpaceId: space.id,
      sourceSpaceTitle: space.title,
      itemType,
      itemIds,
      folderIds,
      label,
      sourceShelfId: activeShelfId || null,
      sourceFolderId: currentFolderId || null,
    });
    setIsMultiSelect(false);
    setSelectedDocIds([]);
    setSelectedFolderIds([]);
    showFeedbackToast(
      mode === 'cut'
        ? `✂️ "${label}" נגזר — נווט לתיקייה או למרחב היעד ולחץ "הדבק כאן"`
        : `📋 "${label}" הועתק — נווט לתיקייה או למרחב היעד ולחץ "הדבק כאן"`
    );
  };

  // Self-Healing Recovery: if any document or subfolder has a shelfId out of sync with its parent folder
  // (e.g. from an earlier folder cut), automatically re-align shelfId so zero documents are ever orphaned!
  const healedOrphansRef = useRef<string>('');
  useEffect(() => {
    if (!space?.id || !Array.isArray(space.documentFolders) || space.documentFolders.length === 0) return;
    const folderById = new Map<string, any>();
    space.documentFolders.forEach((f: any) => {
      if (f && !f.deletedAt) folderById.set(f.id, f);
    });
    const mismatchedFolders = space.documentFolders.filter((f: any) => {
      if (!f || f.deletedAt || !f.parentId) return false;
      const parent = folderById.get(f.parentId);
      return parent && parent.shelfId && parent.shelfId !== f.shelfId;
    });
    const mismatchedDocs = (space.documents || []).filter((d: any) => {
      if (!d || d.deletedAt || !d.folderId) return false;
      const parent = folderById.get(d.folderId);
      return parent && parent.shelfId && parent.shelfId !== d.shelfId;
    });
    if (mismatchedFolders.length === 0 && mismatchedDocs.length === 0) return;
    const sig = `${space.id}:${mismatchedFolders.map((f: any) => f.id).join(',')}:${mismatchedDocs.map((d: any) => d.id).join(',')}`;
    if (healedOrphansRef.current === sig) return;
    healedOrphansRef.current = sig;

    mismatchedFolders.forEach((f: any) => {
      const parent = folderById.get(f.parentId);
      if (parent?.shelfId) {
        updateDocumentFolder(space.id, f.id, { shelfId: parent.shelfId });
      }
    });
    mismatchedDocs.forEach((d: any) => {
      const parent = folderById.get(d.folderId);
      if (parent?.shelfId) {
        updateDocument(space.id, d.id, { shelfId: parent.shelfId });
      }
    });
  }, [space?.id, space?.documentFolders, space?.documents, updateDocumentFolder, updateDocument]);

  const handlePasteClipboardInto = async (destShelfId: string | null, destFolderId: string | null) => {
    if (!clipboard) return;

    // 1. Handle Shelf-level paste (Cross-space move/copy of an entire Subject/Shelf!)
    if (clipboard.itemType === 'shelf') {
      const shelfIds = clipboard.itemIds || [];
      if (shelfIds.length === 0) return;
      if (clipboard.sourceSpaceId === space.id) {
        if (clipboard.mode === 'cut') {
          showFeedbackToast('כדי להעביר נושא שלם למרחב אחר, עבור למרחב היעד ולחץ "📥 הדבק כאן".');
          return;
        }
        // Same-space copy of a shelf
        for (const sid of shelfIds) {
          if (exportShelfToSpace) {
            await exportShelfToSpace(space.id, sid, space.id, 'copy');
          }
        }
        clearClipboard();
        showFeedbackToast(`הנושא "${clipboard.label}" שוכפל בהצלחה!`);
        return;
      }
      // Cross-space Shelf transfer!
      for (const sid of shelfIds) {
        if (exportShelfToSpace) {
          await exportShelfToSpace(
            clipboard.sourceSpaceId,
            sid,
            space.id,
            clipboard.mode === 'copy' ? 'copy' : 'move'
          );
        }
      }
      clearClipboard();
      showFeedbackToast(
        clipboard.mode === 'copy'
          ? `הנושא "${clipboard.label}" שוכפל למרחב זה בהצלחה!`
          : `הנושא "${clipboard.label}" הועבר למרחב זה בהצלחה!`
      );
      return;
    }

    // For documents & folders, we must have a destination shelf
    const resolvedDestShelfId = destShelfId || activeShelfId;
    if (!resolvedDestShelfId) {
      showFeedbackToast('היכנס קודם לנושא היעד (או לחץ על "📥 הדבק לכאן" בכרטיס הנושא) כדי להדביק.');
      return;
    }

    if (clipboard.sourceEngine === 'fileshare') {
      showFeedbackToast('הפריט נגזר/הועתק מקיר השיתוף — הדבק אותו בקיר השיתוף (במרחב זה או במרחב אחר).');
      return;
    }

    const targetFolderIds =
      clipboard.itemType === 'folder'
        ? clipboard.itemIds
        : clipboard.itemType === 'mixed'
          ? (clipboard.folderIds || [])
          : [];
    const targetDocIds =
      clipboard.itemType === 'document' || clipboard.itemType === 'mixed'
        ? clipboard.itemIds
        : [];
    const totalCount = targetFolderIds.length + targetDocIds.length;
    if (totalCount === 0) return;

    // 2. Cross-Space Vault transfer (Folder / Document / Mixed from Space A -> Space B!)
    if (clipboard.sourceSpaceId && clipboard.sourceSpaceId !== space.id) {
      const sourceSpace = Array.isArray(spaces)
        ? spaces.find((s: any) => s.id === clipboard.sourceSpaceId)
        : null;
      const actionType: 'copy' | 'move' = clipboard.mode === 'copy' ? 'copy' : 'move';

      for (const fid of targetFolderIds) {
        if (exportDocumentFolderToSpace) {
          await exportDocumentFolderToSpace(
            clipboard.sourceSpaceId,
            fid,
            space.id,
            resolvedDestShelfId,
            destFolderId || null,
            actionType
          );
        }
      }

      const sourceDocs: any[] = sourceSpace?.documents || [];
      for (const docId of targetDocIds) {
        const orig = sourceDocs.find((d: any) => String(d.id) === String(docId));
        if (orig) {
          addDocument(space.id, {
            title: orig.title,
            type: orig.type,
            url: orig.url,
            rawPdfUrl: orig.rawPdfUrl,
            thumbnailUrl: orig.thumbnailUrl,
            shelfId: resolvedDestShelfId,
            folderId: destFolderId || null,
            notes: orig.note,
            fileSize: orig.fileSize,
            allowedPartners: orig.allowedPartners || [],
          });
          if (actionType === 'move') {
            removeDocument(clipboard.sourceSpaceId, orig.id);
          }
        }
      }

      clearClipboard();
      showFeedbackToast(
        actionType === 'copy'
          ? (totalCount > 1 ? `${totalCount} פריטים שוכפלו למרחב זה בהצלחה!` : 'הפריט שוכפל למרחב זה בהצלחה!')
          : (totalCount > 1 ? `${totalCount} פריטים הועברו למרחב זה בהצלחה!` : 'הפריט הועבר למרחב זה בהצלחה!')
      );
      return;
    }

    // 3. Same-Space Vault transfer
    const getDescendantSet = (rootId: string): Set<string> => {
      const res = new Set<string>([rootId]);
      const queue = [rootId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        (space.documentFolders || []).forEach((f: any) => {
          if (!f.deletedAt && f.parentId === curr && !res.has(f.id)) {
            res.add(f.id);
            queue.push(f.id);
          }
        });
      }
      return res;
    };

    // Guard circular nesting before mutating anything
    if (clipboard.mode === 'cut' && destFolderId) {
      for (const fid of targetFolderIds) {
        if (getDescendantSet(fid).has(destFolderId)) {
          showFeedbackToast('לא ניתן להעביר תיקייה לתוך עצמה או לתת-תיקייה שלה.');
          return;
        }
      }
    }

    const prevFolderLocations = targetFolderIds
      .map((fid) => {
        const orig = (space.documentFolders || []).find((f: any) => f.id === fid);
        return orig ? { id: fid, shelfId: orig.shelfId, parentId: orig.parentId || null } : null;
      })
      .filter(Boolean) as Array<{ id: string; shelfId: string; parentId: string | null }>;

    const prevDocLocations = targetDocIds
      .map((id) => {
        const orig = documents.find((d) => String(d.id) === String(id));
        return orig ? { id, shelfId: orig.shelfId, folderId: orig.folderId || null } : null;
      })
      .filter(Boolean) as Array<{ id: string; shelfId: string; folderId: string | null }>;

    if (clipboard.mode === 'copy') {
      const cloneFolderSubtree = (origFolderId: string, targetParentId: string | null, isRoot: boolean) => {
        const origFolder = (space.documentFolders || []).find((f: any) => f.id === origFolderId && !f.deletedAt);
        if (!origFolder) return;
        const newFolderName = isRoot ? `${origFolder.name} (עותק)` : origFolder.name;
        const createdId = addDocumentFolder(space.id, resolvedDestShelfId, newFolderName, targetParentId || undefined);
        const newTargetId = typeof createdId === 'string' ? createdId : null;

        documents
          .filter((d) => !d.deletedAt && d.folderId === origFolderId)
          .forEach((origDoc) => {
            addDocument(space.id, {
              title: origDoc.title,
              type: origDoc.type,
              url: origDoc.url,
              shelfId: resolvedDestShelfId,
              folderId: newTargetId,
              notes: origDoc.note,
              fileSize: origDoc.fileSize,
              allowedPartners: origDoc.allowedPartners || [],
            });
          });

        (space.documentFolders || [])
          .filter((sub: any) => !sub.deletedAt && sub.parentId === origFolderId)
          .forEach((sub: any) => cloneFolderSubtree(sub.id, newTargetId, false));
      };

      targetFolderIds.forEach((fid) => cloneFolderSubtree(fid, destFolderId || null, true));
      targetDocIds.forEach((id) => {
        const orig = documents.find((d) => String(d.id) === String(id));
        if (orig) {
          addDocument(space.id, {
            title: orig.title,
            type: orig.type,
            url: orig.url,
            shelfId: resolvedDestShelfId || orig.shelfId,
            folderId: destFolderId || null,
            notes: orig.note,
            fileSize: orig.fileSize,
            allowedPartners: orig.allowedPartners || [],
          });
        }
      });
      showFeedbackToast(totalCount > 1 ? `${totalCount} פריטים שוכפלו בהצלחה!` : 'הפריט שוכפל בהצלחה!');
    } else {
      targetFolderIds.forEach((fid) => {
        moveDocumentFolder(space.id, fid, resolvedDestShelfId, destFolderId || null);
      });
      targetDocIds.forEach((id) => {
        updateDocument(space.id, id, {
          shelfId: resolvedDestShelfId,
          folderId: destFolderId || null,
        });
      });

      if (prevFolderLocations.length > 0 || prevDocLocations.length > 0) {
        vaultHistory.pushStep({
          label: `העברת "${clipboard.label}"`,
          undo: () => {
            prevFolderLocations.forEach((loc) => moveDocumentFolder(space.id, loc.id, loc.shelfId, loc.parentId));
            prevDocLocations.forEach((loc) => updateDocument(space.id, loc.id, { shelfId: loc.shelfId, folderId: loc.folderId }));
          },
          redo: () => {
            prevFolderLocations.forEach((loc) => moveDocumentFolder(space.id, loc.id, resolvedDestShelfId, destFolderId || null));
            prevDocLocations.forEach((loc) => updateDocument(space.id, loc.id, { shelfId: resolvedDestShelfId, folderId: destFolderId || null }));
          },
        });
      }
      showFeedbackToast(totalCount > 1 ? `${totalCount} פריטים הועברו בהצלחה!` : 'הפריט הועבר בהצלחה!');
    }
    clearClipboard();
  };

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

    const newShelfPromptHandler = () => {
      setPromptInput('');
      setCustomPrompt({
        isOpen: true,
        title: 'יצירת נושא (מדף) חדש',
        placeholder: 'שם הנושא (לדוגמה: חוזים, תוכניות, קבלות)',
        defaultValue: '',
        onSave: (name: string) => {
          if (name.trim()) {
            const newId = `shelf_${Date.now()}`;
            addShelf(space.id, {
              id: newId,
              name: name.trim(),
              icon: '🗂️',
              createdAt: new Date().toISOString()
            });
            setActiveShelfId(newId);
          }
        }
      });
    };
    window.addEventListener('smartshare:open_new_shelf_prompt', newShelfPromptHandler);

    const vaultImportHandler = () => {
      setShowVaultImportModal(true);
    };
    window.addEventListener('smartshare:vault_import', vaultImportHandler);

    return () => {
      window.removeEventListener('smartshare:add_folder', folderHandler);
      window.removeEventListener('smartshare:open_new_shelf_prompt', newShelfPromptHandler);
      window.removeEventListener('smartshare:vault_import', vaultImportHandler);
    };
  }, [space.id, activeShelfId, shelves, currentFolderId, addDocumentFolder, addShelf]);

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

  // Android / Galaxy Hardware Back Button & 1-Step Back Navigation (Single Global LIFO Stack)
  // Step-by-step: child folder -> parent folder -> shelf root -> shelves list -> space/home!
  const navigateBackOneStep = React.useCallback((): boolean => {
    if (!activeShelfId) return false;
    if (currentFolderId) {
      const currentFolderObj = (space.documentFolders || []).find((f: any) => f.id === currentFolderId);
      setCurrentFolderId(currentFolderObj?.parentId || null);
      return true;
    }
    setActiveShelfId(null);
    return true;
  }, [activeShelfId, currentFolderId, space.documentFolders]);

  const vaultBackStepKey = activeShelfId ? `${activeShelfId}::${currentFolderId || 'root'}` : null;
  useHardwareBackStep(vaultBackStepKey, () => {
    navigateBackOneStep();
  }, 'vault-folder');

  React.useEffect(() => {
    const handleBackStep = (e: any) => {
      if (navigateBackOneStep()) {
        if (e?.detail) e.detail.handled = true;
      }
    };
    window.addEventListener('smartshare:navigate_back_one_step', handleBackStep);
    return () => window.removeEventListener('smartshare:navigate_back_one_step', handleBackStep);
  }, [navigateBackOneStep]);

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

  // Proactively measure file sizes for all documents without a saved fileSize (in-memory only to avoid triggering background Firestore transaction storms)
  React.useEffect(() => {
    if (!documents || documents.length === 0) return;
    const unmeasured = documents.filter(d => !d.fileSize && !measuredSizes[d.id] && d.url);
    if (unmeasured.length === 0) return;

    unmeasured.slice(0, 15).forEach(doc => {
      if (doc.url.startsWith('data:')) {
        const sz = Math.round((doc.url.length * 3) / 4);
        setMeasuredSizes(prev => ({ ...prev, [doc.id]: sz }));
      } else {
        fetch(doc.url, { method: 'HEAD' })
          .then(res => {
            const cl = res.headers.get('content-length');
            if (cl) {
              const sz = parseInt(cl, 10);
              if (sz > 0) {
                setMeasuredSizes(prev => ({ ...prev, [doc.id]: sz }));
                return;
              }
            }
            return fetch(doc.url).then(r => r.blob()).then(b => {
              if (b.size > 0) {
                setMeasuredSizes(prev => ({ ...prev, [doc.id]: b.size }));
              }
            });
          })
          .catch(() => {
            fetch(doc.url).then(r => r.blob()).then(b => {
              if (b.size > 0) {
                setMeasuredSizes(prev => ({ ...prev, [doc.id]: b.size }));
              }
            }).catch(() => {});
          });
      }
    });
  }, [documents, space.id, measuredSizes]);

  // Silent background preloader for active shelf documents (0ms perceived load time)
  React.useEffect(() => {
    if (!activeShelfId || typeof window === 'undefined') return;
    const activeShelfDocs = activeDocuments.filter(d => d.shelfId === activeShelfId);
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
    addDocument: async (url, type, allPages, targetEventId, explicitShelfId?: string, bypassDuplicateCheck?: boolean, explicitFolderId?: string | null, initialFileName?: string) => {
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
      
      const targetFolderId = typeof explicitFolderId !== 'undefined' && explicitFolderId !== null
        ? explicitFolderId
        : (targetShelfId === activeShelfId ? (currentFolderIdRef.current ?? currentFolderId) : null);

      // Smart Content/Structural Duplicate Detection (strictly content & internal page layout, NEVER by name)
      const baseAutoTitle = initialFileName ? initialFileName.trim() : (type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק');
      const resolvedFolderTitle = resolveExplorerUniqueTitle(baseAutoTitle, documents, targetShelfId, targetFolderId);

      if (!bypassDuplicateCheck) {
        const sampleUrl = (allPages && allPages.length > 0) ? allPages[0] : url;
        const incomingSize = sampleUrl.startsWith('data:') ? Math.round((sampleUrl.length * 3) / 4) : undefined;
        const duplicateMatch = await findDuplicateInSpace({
          incomingUrl: sampleUrl,
          incomingTitle: resolvedFolderTitle,
          incomingSize,
          incomingPageCount: Array.isArray(allPages) && allPages.length > 0 ? allPages.length : 1,
          existingDocuments: documents,
          shelves,
          members: space.members || []
        });

        if (duplicateMatch) {
          setDuplicateMatchState({
            match: duplicateMatch,
            incomingTitle: resolvedFolderTitle,
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

      return await handleSaveDocument(targetShelfId, url, typeof type !== 'undefined' ? type : 'document', allPages, targetEventId, targetFolderId, initialFileName);
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

  // Unified helper to open rename modal for any document
  const openRenameDocModal = (doc: SpaceDocument) => {
    const cleanTitle = cleanDisplayTitle(doc.title);
    setPromptInput(cleanTitle);
    setCustomPrompt({
      isOpen: true,
      title: 'שינוי שם מסמך',
      placeholder: 'הזן שם מסמך...',
      defaultValue: cleanTitle,
      onSave: (val) => {
        const trimmed = val.trim();
        if (trimmed) {
          updateDocument(space.id, doc.id, { title: trimmed });
        }
      }
    });
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

    
    
    const handleTouchDragStart = (e: React.TouchEvent | React.MouseEvent, docId: string) => {
      e.stopPropagation();
      cancelContextLongPress();
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

    const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf', allPages?: string[], targetEventId?: string, folderId?: string | null, initialFileName?: string) => {
      // Determine effective folderId immediately (passed in or live currentFolderId if same shelf)
      const liveFolderId = currentFolderIdRef.current ?? currentFolderId;
      const effectiveFolderId = typeof folderId !== 'undefined' ? folderId : (shelfId === activeShelfId ? liveFolderId : null);

      // Optimistic UI update — Windows Explorer-style folder-scoped unique naming
      const tempId = 'temp-' + Date.now();
      const baseTitle = initialFileName ? initialFileName.trim() : (type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק');
      const title = resolveExplorerUniqueTitle(baseTitle, documents, shelfId, effectiveFolderId);
      
      let previewUrl = (allPages && allPages.length > 0) ? allPages[0] : (url.startsWith('data:image') ? url : undefined);
      setUploadingDocs(prev => [...prev, { id: tempId, shelfId, folderId: effectiveFolderId || null, url, title, type, thumbnailUrl: previewUrl, isUploading: true, progress: 5 }]);
      
      try {
        let finalUrl = url;
        let finalThumbnailUrl = previewUrl;

        const updateProgress = (pct: number) => {
          setUploadingDocs(prev => prev.map(d => d.id === tempId ? { ...d, progress: pct } : d));
        };

        if (url.startsWith('data:') || url.startsWith('blob:')) {
          let ext = 'bin';
          const lowerTitle = title.toLowerCase();
          const lowerFileName = (initialFileName || '').toLowerCase();
          if (lowerTitle.endsWith('.dwg') || lowerFileName.endsWith('.dwg')) ext = 'dwg';
          else if (lowerTitle.endsWith('.dwfx') || lowerFileName.endsWith('.dwfx')) ext = 'dwfx';
          else if (lowerTitle.endsWith('.dwf') || lowerFileName.endsWith('.dwf')) ext = 'dwf';
          else if (lowerTitle.endsWith('.dxf') || lowerFileName.endsWith('.dxf')) ext = 'dxf';
          else if (url.startsWith('data:application/pdf') || lowerTitle.endsWith('.pdf')) ext = 'pdf';
          else if (url.startsWith('data:image/webp') || lowerTitle.endsWith('.webp')) ext = 'webp';
          else if (url.startsWith('data:image/png') || lowerTitle.endsWith('.png')) ext = 'png';
          else if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg') || lowerTitle.endsWith('.jpg')) ext = 'jpg';
          else if (url.includes('dwfx')) ext = 'dwfx';
          else if (url.includes('dwg')) ext = 'dwg';
          else if (url.includes('dwf')) ext = 'dwf';
          else if (url.includes('dxf')) ext = 'dxf';
          const path = `documents/${space.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          finalUrl = await uploadImageToStorage(url, path, updateProgress);
        }

        if (previewUrl && (previewUrl.startsWith('data:image') || previewUrl.startsWith('blob:'))) {
          const thumbExt = previewUrl.startsWith('data:image/webp') ? 'webp' : 'jpg';
          const thumbPath = `documents/${space.id}/thumb_${Date.now()}-${Math.random().toString(36).substring(7)}.${thumbExt}`;
          finalThumbnailUrl = await uploadImageToStorage(previewUrl, thumbPath);
        }

        // Upload multi-page files to Storage so Firestore never overflows 1MB document limit
        let finalPages: string[] | undefined = undefined;
        if (allPages && allPages.length > 1) {
          finalPages = await Promise.all(
            allPages.map(async (pageUrl, idx) => {
              if (pageUrl.startsWith('data:') || pageUrl.startsWith('blob:')) {
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

        // Station resolution: If targetEventId not specified, check if effective folder or any ancestor folder has linked station
        let effectiveTargetEventId = targetEventId;
        if (!effectiveTargetEventId && effectiveFolderId) {
          let currFId: string | null = effectiveFolderId;
          const visited = new Set<string>();
          while (currFId && !visited.has(currFId)) {
            visited.add(currFId);
            const targetFolder = (space.documentFolders || []).find(f => f.id === currFId);
            if (targetFolder?.stationId) {
              effectiveTargetEventId = targetFolder.stationId;
              break;
            }
            currFId = targetFolder?.parentId || null;
          }
        }

        let detectedSize: number | undefined = undefined;
        if (allPages && allPages.length > 0) {
          let sumBytes = 0;
          allPages.forEach(p => {
            if (p && p.startsWith('data:')) {
              sumBytes += Math.round((p.length * 3) / 4);
            }
          });
          if (sumBytes > 0) detectedSize = sumBytes;
        }
        if (!detectedSize && url.startsWith('data:')) {
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
        console.error("Failed to upload document to cloud", e);
        // Fallback safety net: Keep file in IndexedDB cache and notify user
        try {
          if (url.startsWith('blob:')) {
            const resp = await fetch(url);
            const blobData = await resp.blob();
            const ab = await blobData.arrayBuffer();
            const { setCachedPdfBytes } = await import('@/utils/imageOptimizer');
            await setCachedPdfBytes(`local_safety_${tempId}`, new Uint8Array(ab));
          } else if (url.startsWith('data:')) {
            const byteStr = atob(url.split(',')[1]);
            const ab = new ArrayBuffer(byteStr.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
            const { setCachedPdfBytes } = await import('@/utils/imageOptimizer');
            await setCachedPdfBytes(`local_safety_${tempId}`, ia);
          }
        } catch (backupErr) {
          console.warn("Safety backup to IndexedDB also failed:", backupErr);
        }
        alert(`הקובץ "${title}" לא הצליח להסתנכרן לענן עקב בעיית תקשורת, אך נשמר בבטחה כגיבוי מקומי במכשיר.`);
      } finally {
        // Remove from optimistic UI once finalized
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

  // Single Source of Truth helper for Delete & Custom Prompt Modals (shared between inner and outer views)
  const renderSharedConfirmAndPromptModals = () => (
    <>
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
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = promptInput.trim();
                  if (val) {
                    customPrompt.onSave(val);
                    setCustomPrompt(null);
                  }
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
                  const val = promptInput.trim();
                  if (val) {
                    customPrompt.onSave(val);
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
        <div style={{ position: 'sticky', top: '56px', zIndex: 40, background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid #e2e8f0', margin: '0 -1rem 1rem -1rem', padding: '0.5rem 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                {activeShelf.icon || '🗂️'} {activeShelf.name}
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>✏️</span>
                <span style={{ fontSize: '0.62rem', color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>{APP_VERSION}</span>
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
                title="מחק תיקייה זו"
              >
                <span>🗑️</span>
                <span>מחק תיקייה</span>
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
        <div
          data-agent-scope-id={currentFolderId || activeShelf.id}
          data-agent-scope-type={currentFolderId ? 'vault_folder' : 'vault_shelf'}
          data-agent-scope-label={
            currentFolderId
              ? ((space.documentFolders || []).find((f) => f.id === currentFolderId)?.name || activeShelf.name)
              : activeShelf.name
          }
          onTouchStart={(e) => {
            if (!clipboard) return;
            const targetEl = e.target as HTMLElement | null;
            if (targetEl?.closest('button, a, input, select, [data-doc-id], [data-folder-id]')) return;
            const locName = currentFolderId
              ? ((space.documentFolders || []).find((f) => f.id === currentFolderId)?.name || activeShelf.name)
              : activeShelf.name;
            startContextLongPress(e, 'canvas', currentFolderId || activeShelf.id, locName);
          }}
          onTouchMove={handleContextTouchMove}
          onTouchEnd={cancelContextLongPress}
          onContextMenu={(e) => {
            if (!clipboard) return;
            const targetEl = e.target as HTMLElement | null;
            if (targetEl?.closest('button, a, input, select, [data-doc-id], [data-folder-id]')) return;
            e.preventDefault();
            const locName = currentFolderId
              ? ((space.documentFolders || []).find((f) => f.id === currentFolderId)?.name || activeShelf.name)
              : activeShelf.name;
            setContextMenu({ itemType: 'canvas', id: currentFolderId || activeShelf.id, title: locName, x: e.clientX, y: e.clientY });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0 1rem', minHeight: '55vh' }}
        >
          {/* Safety-First Undo / Redo Bar (aligned to far-left edge, away from navigation buttons) */}
          {(vaultHistory.canUndo || vaultHistory.canRedo) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <UndoRedoBar
                canUndo={vaultHistory.canUndo}
                canRedo={vaultHistory.canRedo}
                lastUndoLabel={vaultHistory.lastUndoLabel}
                lastRedoLabel={vaultHistory.lastRedoLabel}
                isApplying={vaultHistory.isApplying}
                onUndo={vaultHistory.undo}
                onRedo={vaultHistory.redo}
              />
            </div>
          )}

          {/* Sticky Windows/Drive Cut-Copy-Paste Bar */}
          <VaultTransferClipboardBar
            clipboard={clipboard}
            currentLocationLabel={
              currentFolderId
                ? `${activeShelf.name} / ${(space.documentFolders || []).find((f) => f.id === currentFolderId)?.name || 'תיקייה'}`
                : activeShelf.name
            }
            onPasteHere={() => handlePasteClipboardInto(activeShelf.id, currentFolderId || null)}
            onCancel={() => setClipboard(null)}
          />
          {(showTimeline || shelfDocs.length > 0 || currentFolderId) && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.45rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '6px 8px',
              minHeight: '40px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              {/* Full-width Top Row: Up-One-Level Arrow + Complete Visible Breadcrumb Path */}
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
                const currentFolderObj = breadcrumbTrail.length > 0 ? breadcrumbTrail[breadcrumbTrail.length - 1] : null;
                const handleGoUpOneLevel = () => {
                  if (currentFolderObj) {
                    setCurrentFolderId(currentFolderObj.parentId || null);
                  } else {
                    setActiveShelfId(null);
                  }
                };

                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    flex: '1 1 100%',
                    minWidth: 0,
                    paddingBottom: '4px',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <button
                      type="button"
                      onClick={handleGoUpOneLevel}
                      style={{
                        background: '#eef2ff',
                        color: '#4338ca',
                        border: '1px solid #c7d2fe',
                        padding: '3px 8px',
                        borderRadius: '8px',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        flexShrink: 0
                      }}
                      title={currentFolderObj ? 'עלה רמה אחת לתיקיית האב' : 'חזור לרשימת כל התיקיות'}
                    >
                      <span>⬆️</span>
                      <span>{currentFolderObj ? 'עלה רמה' : 'כל התיקיות'}</span>
                    </button>

                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.74rem', flexShrink: 0 }}>מיקום:</span>
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(null)}
                      style={{
                        background: !currentFolderId ? '#dbeafe' : 'transparent',
                        color: !currentFolderId ? '#1d4ed8' : '#475569',
                        border: 'none',
                        padding: '3px 6px',
                        borderRadius: '6px',
                        fontWeight: !currentFolderId ? 800 : 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        flexShrink: 0
                      }}
                      title="חזרה לתיקייה הראשית במדף"
                    >
                      <span>🏠</span>
                      <span>{activeShelf?.name || 'ראשי'}</span>
                    </button>

                    {breadcrumbTrail.map((crumb, idx) => {
                      const isLast = idx === breadcrumbTrail.length - 1;
                      const folderPrivacy = getPrivacyInfo(crumb.allowedPartners);
                      return (
                        <React.Fragment key={crumb.id}>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', flexShrink: 0 }}>/</span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => setCurrentFolderId(crumb.id)}
                              style={{
                                background: isLast ? '#dbeafe' : 'transparent',
                                color: isLast ? '#1d4ed8' : '#475569',
                                border: 'none',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                fontWeight: isLast ? 800 : 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <span>📁</span>
                              <span>{crumb.name}</span>
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
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                                title={`הרשאות תיקייה: ${folderPrivacy.text}`}
                              >
                                <span>{folderPrivacy.icon}</span>
                              </button>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Left side (RTL): Compact Icon Actions Toolbar - Shown only when there are at least 2 items or an active filter/view */}
              {(() => {
                const totalDocsInShelf = shelfDocs.length;
                const totalFoldersInShelf = (space.documentFolders || []).filter((f: any) => !f.deletedAt && f.shelfId === activeShelfId).length;
                const hasMinimalItems = (totalDocsInShelf + totalFoldersInShelf) >= 2;
                const isFilterActive = (filterLinked !== 'all') || (warehouseStationFilter !== 'all') || (warehouseSortBy !== 'date_desc');
                const shouldShowToolbar = hasMinimalItems || isFilterActive || showFavoritesOnly || showRecentFeedOnly;

                if (!shouldShowToolbar) return null;

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {/* 1. Sort & Filter Icon Button */}
                    <button
                      type="button"
                      onClick={() => setShowSortFilterModal(true)}
                      style={{
                        position: 'relative',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isFilterActive ? '#eff6ff' : '#ffffff',
                        border: isFilterActive ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                        color: isFilterActive ? '#1d4ed8' : '#475569',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isFilterActive ? '0 2px 6px rgba(59,130,246,0.2)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                      title={isFilterActive ? 'סינון ומיון מסמכים (פעיל)' : 'סינון ומיון מסמכים'}
                    >
                      <span>⇅</span>
                      {isFilterActive && (
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: '#3b82f6',
                          border: '1.5px solid #ffffff'
                        }} />
                      )}
                    </button>

                    {/* 2. Favorites Toggle Icon Button */}
                    <button
                      type="button"
                      onClick={() => setShowFavoritesOnly(prev => !prev)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: showFavoritesOnly ? '#fef3c7' : '#ffffff',
                    border: showFavoritesOnly ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                    color: showFavoritesOnly ? '#b45309' : '#94a3b8',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: showFavoritesOnly ? '0 2px 6px rgba(245,158,11,0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title={showFavoritesOnly ? 'הצג את כל המסמכים' : 'הצג מועדפים בלבד (⭐)'}
                >
                  <span>{showFavoritesOnly ? '⭐' : '☆'}</span>
                </button>

                {/* 2.5 Recent / Unread Feed Toggle Button */}
                {(() => {
                  const unreadShelfDocsCount = shelfDocs.filter(d => isDocUnread(d)).length;
                  return (
                    <button
                      type="button"
                      onClick={() => setShowRecentFeedOnly(prev => !prev)}
                      style={{
                        position: 'relative',
                        height: '32px',
                        padding: '0 8px',
                        borderRadius: '8px',
                        background: showRecentFeedOnly ? '#eff6ff' : (unreadShelfDocsCount > 0 ? '#fef2f2' : '#ffffff'),
                        border: showRecentFeedOnly ? '1.5px solid #2563eb' : (unreadShelfDocsCount > 0 ? '1.5px solid #ef4444' : '1px solid #cbd5e1'),
                        color: showRecentFeedOnly ? '#1d4ed8' : (unreadShelfDocsCount > 0 ? '#dc2626' : '#64748b'),
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: showRecentFeedOnly ? '0 2px 6px rgba(37,99,235,0.2)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                      title={showRecentFeedOnly ? 'חזור לתצוגת תיקיות רגילה' : 'הצג פיד מסמכים אחרונים בלבד'}
                    >
                      <span>🕒</span>
                      <span>אחרונים</span>
                      {unreadShelfDocsCount > 0 && !showRecentFeedOnly && (
                        <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '1px 5px', fontSize: '0.64rem', fontWeight: 900 }}>
                          {unreadShelfDocsCount}
                        </span>
                      )}
                    </button>
                  );
                })()}

                {/* 3. View Mode Dropdown Button */}
                <div ref={vaultViewDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowVaultViewDropdown(prev => !prev)}
                    title={`שינוי תצוגה (${vaultViewMode === 'list' ? 'רשימה' : vaultViewMode === 'grid_large' ? 'גדול' : 'בינוני'})`}
                    style={{
                      height: '32px',
                      padding: '0 6px',
                      borderRadius: '8px',
                      background: showVaultViewDropdown ? '#eff6ff' : '#ffffff',
                      border: showVaultViewDropdown ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                      color: showVaultViewDropdown ? '#1d4ed8' : '#334155',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      boxShadow: showVaultViewDropdown ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>
                      {vaultViewMode === 'list' ? '☰' : vaultViewMode === 'grid_large' ? '☷' : '▦'}
                    </span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.65 }}>▾</span>
                  </button>

                  {showVaultViewDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      padding: '4px',
                      zIndex: 9999,
                      minWidth: '110px',
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
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textAlign: 'right',
                          width: '100%'
                        }}
                      >
                        <span>☰</span>
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
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textAlign: 'right',
                          width: '100%'
                        }}
                      >
                        <span>▦</span>
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
                          borderRadius: '6px',
                          padding: '6px 8px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textAlign: 'right',
                          width: '100%'
                        }}
                      >
                        <span>☷</span>
                        <span>גדול</span>
                        {vaultViewMode === 'grid_large' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Multi-Select Icon Button */}
                {shelfDocs.length > 1 && !isMultiSelect && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiSelect(true);
                      setSelectedDocIds([]);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    title="בחירה מרובה של מסמכים"
                  >
                    <span>☑️</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

          {/* MULTI-SELECT FLOATING ACTION BAR - SUPPORTS BOTH FOLDERS & DOCUMENTS */}
          {isMultiSelect && (() => {
            const currentLevelDocIds = shelfDocs
              .filter(d => (currentFolderId ? d.folderId === currentFolderId : !d.folderId))
              .map(d => d.id);
            const currentLevelFolderIds = (space.documentFolders || [])
              .filter((f: any) => !f.deletedAt && f.shelfId === activeShelf?.id && (currentFolderId ? f.parentId === currentFolderId : !f.parentId))
              .map((f: any) => f.id);
            const totalSelectableCount = currentLevelDocIds.length + currentLevelFolderIds.length;
            const totalSelectedCount = selectedDocIds.length + selectedFolderIds.length;
            const isAllSelected =
              totalSelectableCount > 0 &&
              currentLevelDocIds.every(id => selectedDocIds.includes(id)) &&
              currentLevelFolderIds.every(id => selectedFolderIds.includes(id));

            const actions: BatchToolbarAction[] = [];

            if (selectedDocIds.length === 1 && selectedFolderIds.length === 0) {
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

            const stageMixedOrSingle = (mode: 'cut' | 'copy') => {
              const label =
                totalSelectedCount === 1
                  ? selectedFolderIds.length === 1
                    ? ((space.documentFolders || []).find((f: any) => f.id === selectedFolderIds[0])?.name || 'תיקייה')
                    : (documents.find((d) => d.id === selectedDocIds[0])?.title || 'קובץ')
                  : `${totalSelectedCount} פריטים`;

              if (selectedFolderIds.length > 0 && selectedDocIds.length > 0) {
                handleStageClipboard(mode, 'mixed', selectedDocIds, label, selectedFolderIds);
              } else if (selectedFolderIds.length > 0) {
                handleStageClipboard(mode, 'folder', selectedFolderIds, label);
              } else {
                handleStageClipboard(mode, 'document', selectedDocIds, label);
              }
            };

            actions.push({
              id: 'cut',
              label: 'גזור',
              icon: '✂️',
              variant: 'info',
              title: 'גזור והעבר פריטים נבחרים לתיקייה אחרת',
              onClick: () => stageMixedOrSingle('cut'),
            });

            actions.push({
              id: 'copy',
              label: 'העתק',
              icon: '📋',
              variant: 'secondary',
              title: 'העתק פריטים נבחרים לתיקייה אחרת',
              onClick: () => stageMixedOrSingle('copy'),
            });

            if (selectedDocIds.length > 0 && selectedFolderIds.length === 0) {
              actions.push({
                id: 'share',
                label: isSharingBatch ? 'מכין...' : 'שתף',
                icon: '📤',
                variant: 'secondary',
                disabled: isSharingBatch,
                onClick: () => shareMultipleDocuments(selectedDocIds)
              });
            }

            actions.push({
              id: 'delete',
              label: 'מחק',
              icon: '🗑️',
              variant: 'danger',
              title: 'העבר פריטים נבחרים לסל אשפה',
              onClick: () => setBatchDeleteConfirm(true)
            });

            return (
              <BatchActionToolbar
                selectedCount={totalSelectedCount}
                totalCount={totalSelectableCount}
                isAllSelected={isAllSelected}
                onToggleSelectAll={() => {
                  if (isAllSelected) {
                    setSelectedDocIds(prev => prev.filter(id => !currentLevelDocIds.includes(id)));
                    setSelectedFolderIds(prev => prev.filter(id => !currentLevelFolderIds.includes(id)));
                  } else {
                    setSelectedDocIds(prev => Array.from(new Set([...prev, ...currentLevelDocIds])));
                    setSelectedFolderIds(prev => Array.from(new Set([...prev, ...currentLevelFolderIds])));
                  }
                }}
                onCancel={() => {
                  setIsMultiSelect(false);
                  setSelectedDocIds([]);
                  setSelectedFolderIds([]);
                }}
                actions={actions}
              />
            );
          })()}

          {(() => {
            const allSpaceEvents = space.shelfEvents || [];
            const activeShelfEvents = allSpaceEvents.filter(e => e.shelfId === activeShelfId);
            
            const isDocLinked = (docId: string, docUrl?: string) => {
              return Boolean(getDocLinkedEvent(docId, docUrl));
            };

            const getDocLinkedEvent = (docId: string, docUrl?: string) => {
              const cleanId = String(docId || '').trim();
              const cleanUrl = docUrl ? String(docUrl).trim() : '';
              const directEvent = allSpaceEvents.find(e => {
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
              if (directEvent) return directEvent;

              // Fallback: Check if document's folder or ancestor folder is linked to a station
              const docObj = shelfDocs.find(d => d.id === cleanId);
              let currFId = docObj?.folderId || null;
              const visited = new Set<string>();
              while (currFId && !visited.has(currFId)) {
                visited.add(currFId);
                const f = (space.documentFolders || []).find(fl => fl.id === currFId);
                if (f?.stationId) {
                  const folderEv = allSpaceEvents.find(e => e.id === f.stationId);
                  if (folderEv) return folderEv;
                }
                currFId = f?.parentId || null;
              }
              return undefined;
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
              // If showRecentFeedOnly is active, show all accessible docs in this shelf regardless of folder hierarchy
              if (!showRecentFeedOnly) {
                // Explorer Hierarchy check: document must reside in the current folder level
                const matchesFolder = currentFolderId ? doc.folderId === currentFolderId : !doc.folderId;
                if (!matchesFolder) return false;
              }

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

            if (showRecentFeedOnly) {
              // Filter to recent docs (last 30 days) or unread
              filteredDocs = filteredDocs.filter(d => isDocUnread(d) || (Date.now() - new Date(d.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000));
            }

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
                // Stable secondary sort by creation date (NEVER by title to prevent swapping cards on rename!)
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              if (warehouseSortBy === 'name') {
                const cmp = (a.title || '').localeCompare(b.title || '', 'he');
                if (cmp !== 0) return cmp;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              }
              if (warehouseSortBy === 'date_asc') {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              }
              // Default date_desc: newest first
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            if (filteredDocs.length === 0 && currentLevelFolders.length === 0) {
              const isFiltered = filterLinked !== 'all' || warehouseStationFilter !== 'all' || showFavoritesOnly || showRecentFeedOnly;
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
                    {showRecentFeedOnly ? 'אין מסמכים חדשים שטרם נקראו' : isFiltered ? 'אין מסמכים תואמים לסינון' : 'התיקייה ריקה כרגע'}
                  </h4>
                  <p style={{ margin: '0 0 0.8rem 0', color: '#64748b', fontSize: '0.82rem', maxWidth: '300px', lineHeight: '1.4' }}>
                    {showRecentFeedOnly
                      ? 'כל המסמכים במדף זה נקראו ונצפו על ידך.'
                      : isFiltered 
                      ? 'נסה לבחור תחנה אחרת או לאפס סינון.' 
                      : 'ניתן להעלות מסמכים או ליצור תיקיות באמצעות התפריט התחתון.'}
                  </p>
                  {isFiltered && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterLinked('all');
                        setWarehouseStationFilter('all');
                        setShowFavoritesOnly(false);
                        setShowRecentFeedOnly(false);
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
                                data-agent-entity-id={folder.id}
                                data-agent-entity-type="folder"
                                data-agent-entity-title={folder.name}
                                onTouchStart={(e) => startContextLongPress(e, 'folder', folder.id, folder.name)}
                                onTouchMove={handleContextTouchMove}
                                onTouchEnd={cancelContextLongPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({ itemType: 'folder', id: folder.id, title: folder.name, x: e.clientX, y: e.clientY });
                                }}
                                onClick={() => {
                                  if (shouldIgnorePostLongPressClick()) return;
                                  if (isMultiSelect) {
                                    setSelectedFolderIds((prev) =>
                                      prev.includes(folder.id) ? prev.filter((id) => id !== folder.id) : [...prev, folder.id]
                                    );
                                    return;
                                  }
                                  setCurrentFolderId(folder.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.55rem 0.85rem',
                                  background: selectedFolderIds.includes(folder.id) ? '#eff6ff' : isFolderDragOver ? '#eff6ff' : '#ffffff',
                                  border:
                                    isFolderCut(folder.id)
                                      ? '2px dashed #6366f1'
                                      : selectedFolderIds.includes(folder.id)
                                        ? '2px solid #2563eb'
                                        : isFolderDragOver
                                          ? '2px dashed #2563eb'
                                          : '1px solid #e2e8f0',
                                  opacity: isFolderCut(folder.id) ? 0.48 : 1,
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
                                  {isMultiSelect && (
                                    <div
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '6px',
                                        background: selectedFolderIds.includes(folder.id) ? '#2563eb' : '#ffffff',
                                        border: selectedFolderIds.includes(folder.id) ? '2px solid #2563eb' : '2px solid #94a3b8',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.72rem',
                                        fontWeight: 900,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {selectedFolderIds.includes(folder.id) ? '✓' : ''}
                                    </div>
                                  )}
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
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                      <span>{subfolderCount > 0 ? `${subfolderCount} תתי-תיקיות • ` : ''}{docCount} מסמכים</span>
                                      {(() => {
                                        // Check if folder contains unread documents (recursive / direct)
                                        const unreadInThisFolder = shelfDocs.filter(d => d.folderId === folder.id && isDocUnread(d)).length;
                                        if (unreadInThisFolder > 0) {
                                          return (
                                            <span style={{ background: '#ef4444', color: '#ffffff', fontSize: '0.66rem', fontWeight: 900, padding: '1px 6px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }}>
                                              🔴 {unreadInThisFolder} חדש
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
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
                                data-agent-entity-id={doc.id}
                                data-agent-entity-type="document"
                                data-agent-entity-title={doc.title || 'מסמך'}
                                onTouchStart={(e) => {
                                  startContextLongPress(e, 'document', doc.id, doc.title || 'מסמך');
                                }}
                                onTouchMove={handleContextTouchMove}
                                onTouchEnd={cancelContextLongPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({ itemType: 'document', id: doc.id, title: doc.title || 'מסמך', x: e.clientX, y: e.clientY });
                                }}
                                onClick={() => {
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
                                  border: isDocCut(doc.id)
                                    ? '2px dashed #6366f1'
                                    : isChecked
                                      ? '1.5px solid #3b82f6'
                                      : (isLastViewed ? '2px solid #06b6d4' : (doc.isFavorite ? '1.5px solid #f59e0b' : '1px solid #e2e8f0')),
                                  opacity: isDocCut(doc.id) ? 0.48 : 1,
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
                                      {cleanDisplayTitle(doc.title)}
                                    </span>
                                    {(() => {
                                      const fmt = getDocumentFormatInfo(doc);
                                      return (
                                        <span style={{
                                          fontSize: '0.6rem',
                                          fontWeight: 800,
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          background: fmt.badgeBg,
                                          color: fmt.badgeColor,
                                          border: `1px solid ${fmt.badgeBorder}`,
                                          flexShrink: 0
                                        }}>
                                          {fmt.tag}
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
                                    {doc.linkedDocIds && doc.linkedDocIds.length > 0 && (() => {
                                      const targetNums = (doc.linkedDocIds || [])
                                        .map(targetId => {
                                          const idx = filteredDocs.findIndex(d => d.id === targetId);
                                          return idx >= 0 ? `#${idx + 1}` : null;
                                        })
                                        .filter(Boolean);
                                      const numsLabel = targetNums.length > 0 ? targetNums.join(', ') : `${doc.linkedDocIds.length} מסמכים`;

                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setViewLinkedDocsFor({ doc, contextDocs: filteredDocs }); }}
                                          style={{ fontSize: '0.66rem', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #93c5fd', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                          title={`לחץ לצפייה במסמכים מקושרים: ${numsLabel}`}
                                        >
                                          🔗 מוצמד ל-{numsLabel}
                                        </button>
                                      );
                                    })()}
                                    {(() => {
                                      const parentDocs = activeDocuments.filter(d => d.linkedDocIds?.includes(doc.id));
                                      if (parentDocs.length === 0) return null;
                                      const parentNums = parentDocs
                                        .map(p => {
                                          const idx = filteredDocs.findIndex(d => d.id === p.id);
                                          return idx >= 0 ? `#${idx + 1}` : null;
                                        })
                                        .filter(Boolean);
                                      const parentLabel = parentNums.length > 0 ? parentNums.join(', ') : parentDocs[0].title.slice(0, 10);

                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setViewLinkedDocsFor({ doc: parentDocs[0], contextDocs: filteredDocs }); }}
                                          style={{ fontSize: '0.66rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                          title={`מוצמד מתוך מסמך: ${parentDocs.map(p => p.title).join(', ')}`}
                                        >
                                          📎 מוצמד מ-{parentLabel}
                                        </button>
                                      );
                                    })()}
                                    <span style={{ fontSize: '0.64rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      {(doc as any).isUploading ? (
                                        <span style={{ color: '#2563eb', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <span style={{ display: 'inline-block', animation: 'pulse 1.2s infinite ease-in-out', fontSize: '0.72rem' }}>☁️</span>
                                          <span>מעלה {(doc as any).progress ? `${(doc as any).progress}%` : '...'}</span>
                                        </span>
                                      ) : (doc as any).uploadError ? (
                                        <span style={{ color: '#dc2626', fontWeight: 800 }}>⚠️ נשמר במכשיר בלבד</span>
                                      ) : (
                                        doc.storageTarget === 'local' ? '📱 מקומי' : doc.storageTarget === 'gdrive' ? '📁 Drive' : '☁️ ענן'
                                      )}
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
                                    onClick={() => openRenameDocModal(doc)}
                                    title="שנה שם"
                                    style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleStageClipboard('cut', 'document', [doc.id], doc.title || 'מסמך'); }}
                                    style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    title="גזור להעברה לתיקייה אחרת"
                                  >
                                    ✂️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setLinkingDoc({ doc, contextDocs: filteredDocs }); }}
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
                                data-agent-entity-id={folder.id}
                                data-agent-entity-type="folder"
                                data-agent-entity-title={folder.name}
                                onTouchStart={(e) => startContextLongPress(e, 'folder', folder.id, folder.name)}
                                onTouchMove={handleContextTouchMove}
                                onTouchEnd={cancelContextLongPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({ itemType: 'folder', id: folder.id, title: folder.name, x: e.clientX, y: e.clientY });
                                }}
                                onClick={() => {
                                  if (shouldIgnorePostLongPressClick()) return;
                                  if (isMultiSelect) {
                                    setSelectedFolderIds((prev) =>
                                      prev.includes(folder.id) ? prev.filter((id) => id !== folder.id) : [...prev, folder.id]
                                    );
                                    return;
                                  }
                                  setCurrentFolderId(folder.id);
                                }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '0.75rem 0.5rem 0.5rem 0.5rem',
                                  background: selectedFolderIds.includes(folder.id) ? '#eff6ff' : isFolderDragOver ? '#eff6ff' : '#ffffff',
                                  border:
                                    isFolderCut(folder.id)
                                      ? '2px dashed #6366f1'
                                      : selectedFolderIds.includes(folder.id)
                                        ? '2px solid #2563eb'
                                        : isFolderDragOver
                                          ? '2px dashed #2563eb'
                                          : '1px solid #e2e8f0',
                                  opacity: isFolderCut(folder.id) ? 0.48 : 1,
                                  borderRadius: '16px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: isFolderDragOver ? '0 8px 20px rgba(37,99,235,0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
                                  textAlign: 'center',
                                  gap: '0.35rem',
                                  position: 'relative',
                                  zIndex: activeDocMenuId === folder.id ? 80 : 1,
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
                                {isMultiSelect && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '8px',
                                      right: '8px',
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '6px',
                                      background: selectedFolderIds.includes(folder.id) ? '#2563eb' : 'rgba(255,255,255,0.92)',
                                      border: selectedFolderIds.includes(folder.id) ? '2px solid #2563eb' : '2px solid #94a3b8',
                                      color: '#ffffff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.78rem',
                                      fontWeight: 900,
                                      zIndex: 10,
                                    }}
                                  >
                                    {selectedFolderIds.includes(folder.id) ? '✓' : ''}
                                  </div>
                                )}
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

                                {/* Folder card actions (Uniform 4-button layout matching Document Cards) */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: '3px' }}>
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
                                            padding: '2px 5px', 
                                            fontSize: '0.68rem', 
                                            fontWeight: 'bold',
                                            color: folderPrivacy.color,
                                            cursor: 'pointer' 
                                          }}
                                          title={`פרטיות וגישה לתיקייה: ${folderPrivacy.text}`}
                                        >
                                          {folderPrivacy.icon}
                                        </button>
                                      );
                                    })()}
                                    {hasFileShare ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenExternalShareModal({ type: 'folder', item: folder });
                                          }}
                                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '5px', padding: '2px 5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="קישור שיתוף חיצוני מאובטח לתיקייה"
                                        >
                                          🔗
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handlePinToSharingWall({ type: 'folder', item: folder });
                                          }}
                                          style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', borderRadius: '5px', padding: '2px 5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="שייך תיקייה לקיר השיתוף המרוכז (ללא שכפול נפח)"
                                        >
                                          📤
                                        </button>
                                      </>
                                    ) : (
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
                                        style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '2px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                                        title="ערוך שם"
                                      >
                                        ✏️
                                      </button>
                                    )}
                                  </div>

                                  {/* Folder 3-dots menu */}
                                  <div data-doc-menu-container="true" style={{ position: 'relative' }}>
                                    <button
                                      type="button"
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDocMenuId(activeDocMenuId === folder.id ? null : folder.id);
                                      }}
                                      style={{ background: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '1px 4px', fontSize: '0.85rem', cursor: 'pointer' }}
                                    >
                                      ⋮
                                    </button>

                                    {activeDocMenuId === folder.id && (
                                      <>
                                        <div onClick={(e) => { e.stopPropagation(); setActiveDocMenuId(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                                        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: '120%', left: 0, background: 'white', borderRadius: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', padding: '0.45rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '170px', direction: 'rtl' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveDocMenuId(null);
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
                                            style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}
                                          >
                                            ✏️ ערוך שם תיקייה
                                          </button>
                                          {showTimeline && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveDocMenuId(null);
                                                setLinkStationFolder(folder);
                                              }}
                                              style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
                                            >
                                              📍 {folderStation ? 'שנה תחנה בציר הזמן' : 'קשר לתחנה בציר הזמן'}
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveDocMenuId(null);
                                              setPrivacyTarget({
                                                type: 'folder',
                                                id: folder.id,
                                                name: folder.name,
                                                allowedPartners: folder.allowedPartners || [],
                                                ownerId: folder.ownerId
                                              });
                                            }}
                                            style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                          >
                                            🔐 הרשאות ופרטיות
                                          </button>
                                          {hasFileShare && (
                                            <>
                                              <div style={{ height: '1px', background: '#f1f5f9', margin: '0.15rem 0' }} />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveDocMenuId(null);
                                                  handleOpenExternalShareModal({ type: 'folder', item: folder });
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                🔗 קישור שיתוף חיצוני
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveDocMenuId(null);
                                                  handlePinToSharingWall({ type: 'folder', item: folder });
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                📤 שייך לקיר השיתוף (0 נפח)
                                              </button>
                                            </>
                                          )}
                                          <div style={{ height: '1px', background: '#fef2f2', margin: '0.15rem 0' }} />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveDocMenuId(null);
                                              setFolderToDelete({ id: folder.id, name: folder.name });
                                            }}
                                            style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '0.4rem 0.6rem', borderRadius: '8px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#e11d48', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                          >
                                            🗑️ מחק תיקייה
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
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
                                data-agent-entity-id={doc.id}
                                data-agent-entity-type="document"
                                data-agent-entity-title={doc.title || 'מסמך'}
                                onTouchStart={(e) => {
                                  startContextLongPress(e, 'document', doc.id, doc.title || 'מסמך');
                                }}
                                onTouchMove={handleContextTouchMove}
                                onTouchEnd={cancelContextLongPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({ itemType: 'document', id: doc.id, title: doc.title || 'מסמך', x: e.clientX, y: e.clientY });
                                }}
                                onClick={() => {
                                  if (isMultiSelect) {
                                    setSelectedDocIds(prev => isChecked ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                  }
                                }}
                                style={{
                                  background: isLastViewed ? '#f0fdfa' : (doc.isFavorite ? '#fffdf7' : '#ffffff'),
                                  borderRadius: '14px',
                                  overflow: 'visible',
                                  border:
                                    isDocCut(doc.id)
                                      ? '2px dashed #6366f1'
                                      : isChecked 
                                        ? '2px solid #2563eb' 
                                        : (dragOverDocId === doc.id 
                                            ? '2px dashed #3b82f6' 
                                            : (isLastViewed 
                                                ? '2.5px solid #06b6d4' 
                                                : (doc.isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0'))),
                                  position: 'relative',
                                  zIndex: activeDocMenuId === doc.id ? 80 : (isLastViewed ? 5 : 1),
                                  opacity:
                                    isDocCut(doc.id)
                                      ? 0.48
                                      : (draggedDocId === doc.id ? 0.4 : (doc.id.startsWith('temp-') ? 0.6 : 1)),
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
                                  {/* File Format Badge (PDF vs WEBP vs CAD) */}
                                  {(() => {
                                    const fmt = getDocumentFormatInfo(doc);
                                    return (
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        left: '4px',
                                        background: fmt.overlayBg,
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
                                        <span>{fmt.badgeText}</span>
                                      </div>
                                    );
                                  })()}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '4px',
                                    right: '4px',
                                    background: (doc as any).isUploading ? 'rgba(37, 99, 235, 0.95)' : (doc as any).uploadError ? 'rgba(220, 38, 38, 0.95)' : doc.storageTarget === 'local' ? 'rgba(16, 185, 129, 0.9)' : doc.storageTarget === 'gdrive' ? 'rgba(234, 179, 8, 0.9)' : 'rgba(37, 99, 235, 0.9)',
                                    color: 'white',
                                    padding: '1px 5px',
                                    borderRadius: '5px',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                  }}>
                                    {(doc as any).isUploading ? (
                                      <>
                                        <span style={{ display: 'inline-block', animation: 'pulse 1.2s infinite ease-in-out', fontSize: '0.65rem' }}>☁️</span>
                                        <span>{(doc as any).progress ? `${(doc as any).progress}%` : 'מעלה...'}</span>
                                      </>
                                    ) : (doc as any).uploadError ? (
                                      <span>⚠️ במכשיר בלבד</span>
                                    ) : (
                                      doc.storageTarget === 'local' ? '📱 מקומי' : doc.storageTarget === 'gdrive' ? '📁 Drive' : '☁️ ענן'
                                    )}
                                  </div>
                                  {(doc as any).isUploading && typeof (doc as any).progress === 'number' && (
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.4)' }}>
                                      <div style={{ height: '100%', width: `${(doc as any).progress}%`, background: '#2563eb', transition: 'width 0.2s ease-out' }} />
                                    </div>
                                  )}
                                </div>

                                {!isMultiSelect && (
                                  <div
                                    onTouchStart={(e) => handleTouchDragStart(e, doc.id)}
                                    onMouseDown={(e) => handleTouchDragStart(e, doc.id)}
                                    onClick={(e) => { e.stopPropagation(); }}
                                    style={{ display: 'flex', justifyContent: 'center', padding: '0.2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
                                    title="גרור כדי להעביר לתיקייה או לשנות סדר"
                                  >
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '1px', pointerEvents: 'none' }}>|||</span>
                                  </div>
                                )}

                                {/* Content Details */}
                                <div style={{ padding: '0.4rem 0.5rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.15rem' }}>
                                  <div
                                    onClick={(e) => {
                                      if (isMultiSelect) return;
                                      e.stopPropagation();
                                      openRenameDocModal(doc);
                                    }}
                                    style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '5px', minWidth: 0, lineHeight: 1.25 }}
                                    title={`לחץ לשינוי שם: ${cleanDisplayTitle(doc.title)}`}
                                  >
                                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cleanDisplayTitle(doc.title)}</span>
                                    {(() => {
                                      const fmt = getDocumentFormatInfo(doc);
                                      return (
                                        <span style={{
                                          fontSize: '0.58rem',
                                          fontWeight: 800,
                                          padding: '1px 4px',
                                          borderRadius: '3px',
                                          background: fmt.badgeBg,
                                          color: fmt.badgeColor,
                                          border: `1px solid ${fmt.badgeBorder}`,
                                          flexShrink: 0
                                        }}>
                                          {fmt.tag}
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
                                    {doc.linkedDocIds && doc.linkedDocIds.length > 0 && (() => {
                                      const targetNums = (doc.linkedDocIds || [])
                                        .map(targetId => {
                                          const idx = filteredDocs.findIndex(d => d.id === targetId);
                                          return idx >= 0 ? `#${idx + 1}` : null;
                                        })
                                        .filter(Boolean);
                                      const numsLabel = targetNums.length > 0 ? targetNums.join(', ') : `${doc.linkedDocIds.length} מסמכים`;

                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            if (isMultiSelect) return;
                                            e.stopPropagation();
                                            setViewLinkedDocsFor({ doc, contextDocs: filteredDocs });
                                          }}
                                          style={{
                                            background: '#eff6ff',
                                            color: '#1d4ed8',
                                            border: '1px solid #93c5fd',
                                            padding: '1px 6px',
                                            borderRadius: '5px',
                                            fontWeight: 800,
                                            fontSize: '0.64rem',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}
                                          title={`לחץ לצפייה במסמכים מקושרים: ${numsLabel}`}
                                        >
                                          🔗 מוצמד ל-{numsLabel}
                                        </button>
                                      );
                                    })()}
                                    {(() => {
                                      const parentDocs = activeDocuments.filter(d => d.linkedDocIds?.includes(doc.id));
                                      if (parentDocs.length === 0) return null;
                                      const parentNums = parentDocs
                                        .map(p => {
                                          const idx = filteredDocs.findIndex(d => d.id === p.id);
                                          return idx >= 0 ? `#${idx + 1}` : null;
                                        })
                                        .filter(Boolean);
                                      const parentLabel = parentNums.length > 0 ? parentNums.join(', ') : parentDocs[0].title.slice(0, 8);

                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            if (isMultiSelect) return;
                                            e.stopPropagation();
                                            setViewLinkedDocsFor({ doc: parentDocs[0], contextDocs: filteredDocs });
                                          }}
                                          style={{
                                            background: '#fef3c7',
                                            color: '#b45309',
                                            border: '1px solid #fde68a',
                                            padding: '1px 6px',
                                            borderRadius: '5px',
                                            fontWeight: 800,
                                            fontSize: '0.64rem',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}
                                          title={`מוצמד מתוך מסמך: ${parentDocs.map(p => p.title).join(', ')}`}
                                        >
                                          📎 מוצמד מ-{parentLabel}
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
                                        {hasFileShare && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenExternalShareModal({ type: 'doc', item: doc });
                                            }}
                                            style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                            title="קישור שיתוף חיצוני מאובטח"
                                          >
                                            🔗
                                          </button>
                                        )}
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
                                          onClick={(e) => { e.stopPropagation(); handleStageClipboard('cut', 'document', [doc.id], doc.title || 'מסמך'); }}
                                          style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                                          title="גזור להעברה לתיקייה אחרת"
                                        >
                                          ✂️
                                        </button>
                                      </div>

                                      {/* Dots Menu */}
                                      <div data-doc-menu-container="true" style={{ position: 'relative' }}>
                                        <button
                                          type="button"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onTouchStart={(e) => e.stopPropagation()}
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
                                              {/* קבוצה 1: קישורים ושיתוף (עדיפות עליונה) */}
                                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', padding: '0.2rem 0.4rem 0.1rem', letterSpacing: '0.3px' }}>
                                                קישורים ושיתוף
                                              </div>
                                              {hasFileShare && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setActiveDocMenuId(null);
                                                      handleOpenExternalShareModal({ type: 'doc', item: doc });
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                                  >
                                                    🔗 קישור שיתוף חיצוני מאובטח
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setActiveDocMenuId(null);
                                                      handlePinToSharingWall({ type: 'doc', item: doc });
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                                  >
                                                    📤 שייך לקיר השיתוף (0 נפח)
                                                  </button>
                                                </>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); setLinkingDoc({ doc, contextDocs: filteredDocs }); }}
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
                                              <div style={{ height: '1px', background: '#f1f5f9', margin: '0.2rem 0' }} />

                                              {/* קבוצה 2: ארגון ופרטיות */}
                                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', padding: '0.1rem 0.4rem', letterSpacing: '0.3px' }}>
                                                ארגון ופרטיות
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); handleStageClipboard('cut', 'document', [doc.id], doc.title || 'מסמך'); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
                                              >
                                                ✂️ גזור (העבר לתיקייה אחרת)
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setActiveDocMenuId(null); handleStageClipboard('copy', 'document', [doc.id], doc.title || 'מסמך'); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
                                              >
                                                📋 העתק (שכפל לתיקייה אחרת)
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

                                              {/* קבוצה 3: עריכה ותצוגה */}
                                              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', padding: '0.1rem 0.4rem', letterSpacing: '0.3px' }}>
                                                עריכה ותצוגה
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveDocMenuId(null);
                                                  openRenameDocModal(doc);
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                ✏️ שנה שם
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveDocMenuId(null);
                                                  if (typeof window !== 'undefined') {
                                                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', { detail: { doc, defaultStep: 'scanning' } }));
                                                  }
                                                }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
                                              >
                                                📷 הוסף עמוד (מצלמה)
                                              </button>
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
                                                onClick={() => { setActiveDocMenuId(null); setNoteDocId(doc.id); }}
                                                style={{ background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', textAlign: 'right', cursor: 'pointer', fontSize: '0.78rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                                              >
                                                📝 {doc.note ? 'הצג / ערוך הערה' : 'הוסף הערה'}
                                              </button>

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

      {/* Windows/Drive Long-Press Context Menu Popover (Replaces Legacy moveDocToFolder Modal — Zero Remnants!) */}
      <VaultContextMenuPopover
        menu={contextMenu}
        clipboard={clipboard}
        onClose={() => setContextMenu(null)}
        onCut={() => {
          if (!contextMenu || contextMenu.itemType === 'canvas') return;
          handleStageClipboard('cut', contextMenu.itemType, [contextMenu.id], contextMenu.title);
        }}
        onCopy={() => {
          if (!contextMenu || contextMenu.itemType === 'canvas') return;
          handleStageClipboard('copy', contextMenu.itemType, [contextMenu.id], contextMenu.title);
        }}
        onPasteIntoTarget={() => {
          if (!contextMenu || !activeShelf) return;
          if (contextMenu.itemType === 'canvas') {
            handlePasteClipboardInto(activeShelf.id, currentFolderId || null);
          } else if (contextMenu.itemType === 'folder') {
            handlePasteClipboardInto(activeShelf.id, contextMenu.id);
          }
        }}
        onCancelClipboard={() => clearClipboard()}
        onSelectMultiple={
          contextMenu && contextMenu.itemType !== 'canvas'
            ? () => {
                setIsMultiSelect(true);
                if (contextMenu.itemType === 'folder') {
                  setSelectedFolderIds((prev) =>
                    prev.includes(contextMenu.id) ? prev : [...prev, contextMenu.id]
                  );
                } else {
                  setSelectedDocIds((prev) =>
                    prev.includes(contextMenu.id) ? prev : [...prev, contextMenu.id]
                  );
                }
              }
            : undefined
        }
        onDelete={() => {
          if (!contextMenu) return;
          const targetId = contextMenu.id;
          const targetTitle = contextMenu.title;
          if (contextMenu.itemType === 'folder') {
            if (window.confirm(`למחוק את התיקייה "${targetTitle}"?`)) {
              removeDocumentFolder(space.id, targetId);
              vaultHistory.pushStep({
                label: `מחיקת תיקייה "${targetTitle}"`,
                undo: () => restoreDocumentFolder(space.id, targetId),
                redo: () => removeDocumentFolder(space.id, targetId),
              });
            }
          } else {
            if (window.confirm(`למחוק את הקובץ "${targetTitle}"?`)) {
              removeDocument(space.id, targetId);
              vaultHistory.pushStep({
                label: `מחיקת "${targetTitle}"`,
                undo: () => restoreDocument(space.id, targetId),
                redo: () => removeDocument(space.id, targetId),
              });
            }
          }
        }}
      />

      {renderPrivacyModal()}

      {/* EXTERNAL PUBLIC SHARE LINK MODAL FOR VAULT ITEMS (When FileShare plugin is active) */}
      {externalShareItem && (
        <CreateShareLinkModal
          isOpen={Boolean(externalShareItem)}
          item={externalShareItem}
          space={space}
          spaceTitle={space.title || 'המרחב שלי'}
          folderFiles={externalShareItem.type === 'folder' ? documents.filter(d => {
            if (d.deletedAt) return false;
            const isShelf = shelves.some(s => s.id === externalShareItem.id);
            if (isShelf) {
              return d.shelfId === externalShareItem.id;
            }
            return d.folderId === externalShareItem.id;
          }).map(d => {
            const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
            return {
              id: d.id,
              spaceId: space.id,
              name: d.title || 'מסמך',
              type: 'file' as const,
              parentId: d.folderId || null,
              url: d.url,
              thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
              pages: d.pages || [d.url],
              fileType: isPdf ? 'pdf' as const : 'image' as const,
              size: d.fileSize || 0,
              createdAt: new Date(d.createdAt || Date.now()).getTime(),
              createdBy: d.addedBy || user?.id || 'user',
              creatorName: d.addedByName || user?.realName || 'משתמש'
            };
          }) : undefined}
          allSpaceFolders={(() => {
            const baseFolders = (space.documentFolders || []).filter(f => !f.deletedAt).map(f => ({
              id: f.id,
              name: f.name,
              parentId: f.parentId || null
            }));
            const isShelf = shelves.some(s => s.id === externalShareItem.id);
            if (isShelf) {
              // Add shelf's top folders with shelf as their parent
              const shelfFolders = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === externalShareItem.id).map(f => ({
                id: f.id,
                name: f.name,
                parentId: f.parentId || externalShareItem.id
              }));
              return shelfFolders;
            }
            return baseFolders;
          })()}
          allSpaceFiles={documents.filter(d => !d.deletedAt).map(d => {
            const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
            return {
              id: d.id,
              spaceId: space.id,
              name: d.title || 'מסמך',
              type: 'file' as const,
              parentId: d.folderId || null,
              url: d.url,
              thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
              pages: d.pages || [d.url],
              fileType: isPdf ? 'pdf' as const : 'image' as const,
              size: d.fileSize || 0,
              createdAt: new Date(d.createdAt || Date.now()).getTime(),
              createdBy: d.addedBy || user?.id || 'user',
              creatorName: d.addedByName || user?.realName || 'משתמש'
            };
          })}
          spaceLogoUrl={space.features?.includes('business_card') ? space.logoUrl : undefined}
          businessCard={space.features?.includes('business_card') ? space.settings?.businessCard : undefined}
          onClose={() => setExternalShareItem(null)}
          onSaved={(newConfig?: ShareLinkConfig) => {
            const isShelf = shelves.some(s => s.id === externalShareItem.id);
            if (isShelf) {
              updateShelf(space.id, externalShareItem.id, { shareLink: newConfig || null } as any);
            } else if (externalShareItem.type === 'folder') {
              updateDocumentFolder(space.id, externalShareItem.id, { shareLink: newConfig || null } as any);
            } else {
              updateDocument(space.id, externalShareItem.id, { shareLink: newConfig || null } as any);
            }
          }}
        />
      )}

      {/* MOVE / COPY SHELF ACROSS SPACES MODAL (Single Source of Truth) */}

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
        doc={linkingDoc?.doc || null}
        allDocs={activeDocuments}
        contextDocs={linkingDoc?.contextDocs}
        folders={space.documentFolders || []}
        shelves={space.shelves || []}
        onClose={() => setLinkingDoc(null)}
        onSave={(docId, linkedDocIds) => {
          updateDocument(space.id, docId, { linkedDocIds });
          showFeedbackToast(`קושרו בהצלחה ${linkedDocIds.length} מסמכים!`);
        }}
        onPreviewDoc={(targetDoc) => {
          const pool = linkingDoc?.contextDocs || activeDocuments;
          const idx = pool.findIndex(d => d.id === targetDoc.id);
          setPreviewState({ docs: pool, index: idx >= 0 ? idx : 0 });
        }}
      />

      {/* VIEW LINKED DOCUMENTS MODAL */}
      <LinkedDocsPreviewModal
        isOpen={Boolean(viewLinkedDocsFor)}
        parentDoc={viewLinkedDocsFor?.doc || null}
        allDocs={activeDocuments}
        contextDocs={viewLinkedDocsFor?.contextDocs}
        onClose={() => setViewLinkedDocsFor(null)}
        onOpenDoc={(targetDoc, allLinked) => {
          const idx = allLinked.findIndex(d => d.id === targetDoc.id);
          setPreviewState({ docs: allLinked, index: idx >= 0 ? idx : 0 });
          setViewLinkedDocsFor(null);
        }}
        onEditLinks={(doc) => {
          setLinkingDoc({ doc, contextDocs: viewLinkedDocsFor?.contextDocs });
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
        title="העברת פריטים נבחרים לסל אשפה"
        message={`האם להעביר ${selectedDocIds.length + selectedFolderIds.length} פריטים שנבחרו לסל האשפה? הם יישמרו בסל האשפה למשך 12 שעות וניתן יהיה לשחזר אותם.`}
        confirmText={`העבר ${selectedDocIds.length + selectedFolderIds.length} פריטים לסל אשפה`}
        onConfirm={() => {
          const docsToDel = [...selectedDocIds];
          const foldersToDel = [...selectedFolderIds];
          docsToDel.forEach(id => removeDocument(space.id, id));
          foldersToDel.forEach(id => removeDocumentFolder(space.id, id));
          if (docsToDel.length > 0 || foldersToDel.length > 0) {
            vaultHistory.pushStep({
              label: `מחיקת ${docsToDel.length + foldersToDel.length} פריטים`,
              undo: () => {
                docsToDel.forEach(id => restoreDocument(space.id, id));
                foldersToDel.forEach(id => restoreDocumentFolder(space.id, id));
              },
              redo: () => {
                docsToDel.forEach(id => removeDocument(space.id, id));
                foldersToDel.forEach(id => removeDocumentFolder(space.id, id));
              },
            });
          }
          setSelectedDocIds([]);
          setSelectedFolderIds([]);
          setBatchDeleteConfirm(false);
          setIsMultiSelect(false);
        }}
        onClose={() => setBatchDeleteConfirm(false)}
      />

      {/* IMPORT EXISTING FILE MODAL (Single Source of Truth - Zero Storage Duplication) */}
      <ImportExistingFileModal
        isOpen={showVaultImportModal}
        currentSpaceId={space.id}
        currentFolderId={currentFolderId}
        onClose={() => setShowVaultImportModal(false)}
        onImport={async (importedItem: FileShareItem) => {
          // If in a shelf, add to that shelf. If in outer shelves view, add to the first shelf or prompt
          let targetShelfId = activeShelfId;
          if (!targetShelfId) {
            const firstShelf = (shelves || []).find(s => !s.deletedAt);
            if (firstShelf) {
              targetShelfId = firstShelf.id;
            } else {
              // Create default shelf if none exists
              const newShelfId = `shelf_${Date.now()}`;
              addShelf(space.id, {
                id: newShelfId,
                name: 'כללי',
                icon: '🗂️',
                createdAt: new Date().toISOString()
              });
              targetShelfId = newShelfId;
            }
          }

          const isPdf = importedItem.fileType === 'pdf' || importedItem.url.toLowerCase().includes('.pdf');
          const docType = isPdf ? 'pdf' : (importedItem.fileType === 'image' ? 'image' : 'document');
          
          addDocument(space.id, {
            title: importedItem.name,
            type: docType,
            url: importedItem.url,
            shelfId: targetShelfId,
            folderId: currentFolderId || null,
            pages: importedItem.pages || (importedItem.url ? [importedItem.url] : []),
            thumbnailUrl: importedItem.thumbnailUrl,
            fileSize: importedItem.size,
            addedBy: user?.id || '',
            addedByName: user?.realName || user?.nickname || 'שותף',
            allowedPartners: []
          });

          showFeedbackToast(`המסמך "${importedItem.name}" יובא בהצלחה!`);
        }}
      />

      {renderSharedConfirmAndPromptModals()}
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

      {renderRecycleBinModal()}
      {renderDocNoteModal()}

      {/* SMART DUPLICATE PREVENTION INTERCEPTION MODAL (ACTIVE SHELF / FOLDER VIEW) */}
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

        {/* Add New Shelf / Topic Button */}
        <button
          type="button"
          onClick={() => {
            setPromptInput('');
            setCustomPrompt({
              isOpen: true,
              title: 'יצירת נושא (מדף) חדש',
              placeholder: 'שם הנושא (לדוגמה: חוזים, תוכניות, קבלות)',
              defaultValue: '',
              onSave: (name) => {
                const newId = `shelf_${Date.now()}`;
                addShelf(space.id, {
                  id: newId,
                  name,
                  icon: '🗂️',
                  createdAt: new Date().toISOString()
                });
                setActiveShelfId(newId);
              }
            });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.5rem 0.8rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
          title="צור נושא / מדף חדש"
        >
          <span>➕</span>
          <span>נושא חדש</span>
        </button>

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

      {/* Persistent Cut/Copy/Paste Bar when navigating across Shelves & Spaces (activeShelf === null) */}
      {clipboard && (
        <div style={{ marginBottom: '0.85rem' }}>
          <VaultTransferClipboardBar
            clipboard={clipboard}
            currentLocationLabel={
              clipboard.itemType === 'shelf'
                ? `מרחב "${space.title}" — לחץ "הדבק כאן" להוספת הנושא למרחב זה`
                : `רשימת הנושאים (${space.title}) — בחר "הדבק לכאן" על נושא היעד או היכנס אליו`
            }
            onPasteHere={() => {
              if (clipboard.itemType === 'shelf') {
                handlePasteClipboardInto(null, null);
              } else {
                showFeedbackToast('לחץ "📥 הדבק לכאן" על נושא היעד או היכנס לתוכו כדי להדביק!');
              }
            }}
            onCancel={() => clearClipboard()}
          />
        </div>
      )}

      {(vaultHistory.canUndo || vaultHistory.canRedo) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.65rem' }}>
          <UndoRedoBar
            canUndo={vaultHistory.canUndo}
            canRedo={vaultHistory.canRedo}
            lastUndoLabel={vaultHistory.lastUndoLabel}
            lastRedoLabel={vaultHistory.lastRedoLabel}
            isApplying={vaultHistory.isApplying}
            onUndo={vaultHistory.undo}
            onRedo={vaultHistory.redo}
          />
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
            const shelfDocs = activeDocuments.filter(d => d.shelfId === shelf.id);
            const isPrivate = (shelf.allowedPartners || []).filter(pid => pid && pid.trim() !== '' && pid !== space.creatorId).length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => isDocUnread(d));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : {});

            return (
              <div
                key={shelf.id}
                onTouchStart={(e) => startContextLongPress(e, 'shelf', shelf.id, shelf.name)}
                onTouchMove={handleContextTouchMove}
                onTouchEnd={cancelContextLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ itemType: 'shelf', id: shelf.id, title: shelf.name, x: e.clientX, y: e.clientY });
                }}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '1rem',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  border: isShelfCut(shelf.id) ? '2px dashed #6366f1' : '1px solid #f1f5f9',
                  opacity: isShelfCut(shelf.id) ? 0.48 : 1,
                  transition: 'opacity 0.2s ease, border-color 0.2s ease',
                  position: 'relative',
                  ...(isShelfCut(shelf.id) ? {} : highlightStyle),
                }}
              >
                {hasNewRemoteDoc && (
                  <div
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', background: '#ef4444', borderRadius: '50%', border: '2px solid white' }}
                    title="נוספו מסמכים חדשים ביממה האחרונה על ידי שותף"
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', cursor: 'pointer' }}>
                      {!shelf.coverImage && (shelf.icon || '🗂️')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <h3 onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ margin: 0, fontSize: '1.1rem', color: '#334155', cursor: 'pointer' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {clipboard && clipboard.itemType !== 'shelf' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePasteClipboardInto(shelf.id, null);
                          setActiveShelfId(shelf.id);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '0.74rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title={`הדבק ישירות לתוך "${shelf.name}"`}
                      >
                        📥 הדבק לכאן
                      </button>
                    )}
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
                    {hasFileShare && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExternalShareModal({ type: 'folder', item: shelf as any });
                          }}
                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 'bold' }}
                          title="קישור שיתוף חיצוני מאובטח לנושא (כולל כל המסמכים שבו)"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinToSharingWall({ type: 'folder', item: shelf as any });
                          }}
                          style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 'bold' }}
                          title="שייך נושא לקיר השיתוף המרוכז (ללא שכפול נפח)"
                        >
                          📤
                        </button>
                      </>
                    )}
                    <button onClick={() => setEditingShelfCoverId(shelf.id)} style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }} title="עיצוב מדף">🎨</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const docCount = activeDocuments.filter(d => d.shelfId === shelf.id).length;
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
            const shelfDocs = activeDocuments.filter(d => d.shelfId === shelf.id);
            const hasNewRemoteDoc = shelfDocs.some(d => isDocUnread(d));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : { border: '1px solid #f1f5f9' });

            return (
              <div
                key={shelf.id}
                onTouchStart={(e) => startContextLongPress(e, 'shelf', shelf.id, shelf.name)}
                onTouchMove={handleContextTouchMove}
                onTouchEnd={cancelContextLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ itemType: 'shelf', id: shelf.id, title: shelf.name, x: e.clientX, y: e.clientY });
                }}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  opacity: isShelfCut(shelf.id) ? 0.48 : 1,
                  transition: 'opacity 0.2s ease, border-color 0.2s ease',
                  ...(isShelfCut(shelf.id) ? { border: '2px dashed #6366f1' } : highlightStyle),
                }}
              >
                {hasNewRemoteDoc && (
                  <div
                    style={{ position: 'absolute', top: '8px', right: '8px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }}
                    title="נוספו מסמכים חדשים ביממה האחרונה על ידי שותף"
                  />
                )}

                
                <div onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ height: '100px', background: '#e2e8f0', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                </div>
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', marginBottom: '0.35rem' }}>
                    <div onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{shelf.name}</div>
                    {clipboard && clipboard.itemType !== 'shelf' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePasteClipboardInto(shelf.id, null);
                          setActiveShelfId(shelf.id);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '3px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title={`הדבק ישירות לתוך "${shelf.name}"`}
                      >
                        📥 הדבק לכאן
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRenameShelf(shelf.id, shelf.name); }} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.8rem', color: '#64748b', opacity: 0.7 }}
                      title="עריכת שם מדף"
                    >
                      ✏️
                    </button>
                  </div>
                  <div onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{shelfDocs.length} מסמכים</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.65rem' }}>{new Date(shelf.createdAt).toLocaleDateString('he-IL')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
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
                    {hasFileShare && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExternalShareModal({ type: 'folder', item: shelf as any });
                          }}
                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 'bold' }}
                          title="קישור שיתוף חיצוני מאובטח לנושא (כולל כל המסמכים שבו)"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinToSharingWall({ type: 'folder', item: shelf as any });
                          }}
                          style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 'bold' }}
                          title="שייך נושא לקיר השיתוף המרוכז (ללא שכפול נפח)"
                        >
                          📤
                        </button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setEditingShelfCoverId(shelf.id); }} style={{ background: '#f1f5f9', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="עיצוב">🎨</button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const docCount = activeDocuments.filter(d => d.shelfId === shelf.id).length;
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
            const shelfDocs = activeDocuments.filter(d => d.shelfId === shelf.id);
            const isPrivate = (shelf.allowedPartners || []).filter(pid => pid && pid.trim() !== '' && pid !== space.creatorId).length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => isDocUnread(d));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '3px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '3px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '60' } : { border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' });

            return (
              <div
                key={shelf.id}
                onTouchStart={(e) => startContextLongPress(e, 'shelf', shelf.id, shelf.name)}
                onTouchMove={handleContextTouchMove}
                onTouchEnd={cancelContextLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ itemType: 'shelf', id: shelf.id, title: shelf.name, x: e.clientX, y: e.clientY });
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  width: '90px',
                  position: 'relative',
                  opacity: isShelfCut(shelf.id) ? 0.48 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <button onClick={(e) => { e.stopPropagation(); setEditingShelfCoverId(shelf.id); }} style={{ position: 'absolute', top: 0, left: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', zIndex: 10, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="עיצוב">🎨</button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  const docCount = activeDocuments.filter(d => d.shelfId === shelf.id).length;
                  setShelfToDelete({ id: shelf.id, name: shelf.name, count: docCount });
                }} style={{ position: 'absolute', top: 0, right: 0, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', zIndex: 10, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} title="מחק מדף">🗑️</button>
                {hasNewRemoteDoc && (
                  <div
                    style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }}
                    title="נוספו מסמכים חדשים ביממה האחרונה על ידי שותף"
                  />
                )}
                
                <div onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', ...(isShelfCut(shelf.id) ? { border: '3px dashed #6366f1' } : highlightStyle), position: 'relative' }}>
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
                  <div onClick={() => { if (!shouldIgnorePostLongPressClick()) setActiveShelfId(shelf.id); }} style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shelf.name}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRenameShelf(shelf.id, shelf.name); }} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '1px', fontSize: '0.75rem', color: '#64748b', opacity: 0.7, flexShrink: 0 }}
                    title="עריכת שם מדף"
                  >
                    ✏️
                  </button>
                </div>
                {clipboard && clipboard.itemType !== 'shelf' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePasteClipboardInto(shelf.id, null);
                      setActiveShelfId(shelf.id);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '3px 7px',
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    title={`הדבק ישירות לתוך "${shelf.name}"`}
                  >
                    📥 הדבק
                  </button>
                )}
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

      


      {renderSharedConfirmAndPromptModals()}

      {/* IMPORT EXISTING FILE MODAL (Single Source of Truth - Zero Storage Duplication) */}
      <ImportExistingFileModal
        isOpen={showVaultImportModal}
        currentSpaceId={space.id}
        currentFolderId={currentFolderId}
        onClose={() => setShowVaultImportModal(false)}
        onImport={async (importedItem: FileShareItem) => {
          // If in a shelf, add to that shelf. If in outer shelves view, add to the first shelf or prompt
          let targetShelfId = activeShelfId;
          if (!targetShelfId) {
            const firstShelf = (shelves || []).find(s => !s.deletedAt);
            if (firstShelf) {
              targetShelfId = firstShelf.id;
            } else {
              // Create default shelf if none exists
              const newShelfId = `shelf_${Date.now()}`;
              addShelf(space.id, {
                id: newShelfId,
                name: 'כללי',
                icon: '🗂️',
                createdAt: new Date().toISOString()
              });
              targetShelfId = newShelfId;
            }
          }

          const isPdf = importedItem.fileType === 'pdf' || importedItem.url.toLowerCase().includes('.pdf');
          const docType = isPdf ? 'pdf' : (importedItem.fileType === 'image' ? 'image' : 'document');
          
          addDocument(space.id, {
            title: importedItem.name,
            type: docType,
            url: importedItem.url,
            shelfId: targetShelfId,
            folderId: currentFolderId || null,
            pages: importedItem.pages || (importedItem.url ? [importedItem.url] : []),
            thumbnailUrl: importedItem.thumbnailUrl,
            fileSize: importedItem.size,
            addedBy: user?.id || '',
            addedByName: user?.realName || user?.nickname || 'שותף',
            allowedPartners: []
          });

          showFeedbackToast(`המסמך "${importedItem.name}" יובא בהצלחה!`);
        }}
      />

      {/* DOCUMENT NOTE MODAL */}
      {renderDocNoteModal()}
      {/* PRIVACY MODAL IN OUTER GALLERY VIEW */}
      {renderPrivacyModal()}

      {/* EXTERNAL PUBLIC SHARE LINK MODAL FOR VAULT ITEMS (When FileShare plugin is active) */}
      {externalShareItem && (
        <CreateShareLinkModal
          isOpen={Boolean(externalShareItem)}
          item={externalShareItem}
          space={space}
          spaceTitle={space.title || 'המרחב שלי'}
          folderFiles={externalShareItem.type === 'folder' ? documents.filter(d => {
            if (d.deletedAt) return false;
            const isShelf = shelves.some(s => s.id === externalShareItem.id);
            if (isShelf) {
              return d.shelfId === externalShareItem.id;
            }
            return d.folderId === externalShareItem.id;
          }).map(d => {
            const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
            return {
              id: d.id,
              spaceId: space.id,
              name: d.title || 'מסמך',
              type: 'file' as const,
              parentId: d.folderId || null,
              url: d.url,
              thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
              pages: d.pages || [d.url],
              fileType: isPdf ? 'pdf' as const : 'image' as const,
              size: d.fileSize || 0,
              createdAt: new Date(d.createdAt || Date.now()).getTime(),
              createdBy: d.addedBy || user?.id || 'user',
              creatorName: d.addedByName || user?.realName || 'משתמש'
            };
          }) : undefined}
          allSpaceFolders={(() => {
            const baseFolders = (space.documentFolders || []).filter(f => !f.deletedAt).map(f => ({
              id: f.id,
              name: f.name,
              parentId: f.parentId || null
            }));
            const isShelf = shelves.some(s => s.id === externalShareItem.id);
            if (isShelf) {
              // Add shelf's top folders with shelf as their parent
              const shelfFolders = (space.documentFolders || []).filter(f => !f.deletedAt && f.shelfId === externalShareItem.id).map(f => ({
                id: f.id,
                name: f.name,
                parentId: f.parentId || externalShareItem.id
              }));
              return shelfFolders;
            }
            return baseFolders;
          })()}
          allSpaceFiles={documents.filter(d => !d.deletedAt).map(d => {
            const isPdf = d.type === 'pdf' || d.url?.toLowerCase().includes('.pdf');
            return {
              id: d.id,
              spaceId: space.id,
              name: d.title || 'מסמך',
              type: 'file' as const,
              parentId: d.folderId || null,
              url: d.url,
              thumbnailUrl: d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined)),
              pages: d.pages || [d.url],
              fileType: isPdf ? 'pdf' as const : 'image' as const,
              size: d.fileSize || 0,
              createdAt: new Date(d.createdAt || Date.now()).getTime(),
              createdBy: d.addedBy || user?.id || 'user',
              creatorName: d.addedByName || user?.realName || 'משתמש'
            };
          })}
          spaceLogoUrl={space.features?.includes('business_card') ? space.logoUrl : undefined}
          businessCard={space.features?.includes('business_card') ? space.settings?.businessCard : undefined}
          onClose={() => setExternalShareItem(null)}
          onSaved={(newConfig?: ShareLinkConfig) => {
            const isShelf = shelves.some(s => s.id === externalShareItem.id);
            if (isShelf) {
              updateShelf(space.id, externalShareItem.id, { shareLink: newConfig || null } as any);
            } else if (externalShareItem.type === 'folder') {
              updateDocumentFolder(space.id, externalShareItem.id, { shareLink: newConfig || null } as any);
            } else {
              updateDocument(space.id, externalShareItem.id, { shareLink: newConfig || null } as any);
            }
          }}
        />
      )}
      {/* UNIFIED WINDOWS / DRIVE LONG-PRESS CONTEXT MENU ON SHELVES SCREEN (DRY Single Source of Truth) */}
      <VaultContextMenuPopover
        menu={contextMenu}
        clipboard={clipboard}
        onClose={() => setContextMenu(null)}
        onCut={() => {
          if (!contextMenu || contextMenu.itemType === 'canvas') return;
          handleStageClipboard('cut', contextMenu.itemType, [contextMenu.id], contextMenu.title);
        }}
        onCopy={() => {
          if (!contextMenu || contextMenu.itemType === 'canvas') return;
          handleStageClipboard('copy', contextMenu.itemType, [contextMenu.id], contextMenu.title);
        }}
        onPasteIntoTarget={() => {
          if (!contextMenu) return;
          if (contextMenu.itemType === 'shelf') {
            if (clipboard?.itemType === 'shelf') {
              handlePasteClipboardInto(null, null);
            } else {
              handlePasteClipboardInto(contextMenu.id, null);
              setActiveShelfId(contextMenu.id);
            }
          } else if (contextMenu.itemType === 'canvas') {
            handlePasteClipboardInto(null, null);
          }
        }}
        onCancelClipboard={() => clearClipboard()}
        onDelete={() => {
          if (!contextMenu || contextMenu.itemType !== 'shelf') return;
          const docCount = activeDocuments.filter(d => d.shelfId === contextMenu.id).length;
          setShelfToDelete({ id: contextMenu.id, name: contextMenu.title, count: docCount });
        }}
      />

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
