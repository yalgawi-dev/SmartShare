'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db, uploadBlobToStorage, uploadImageToStorage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { useSpaces } from '@/app/context/SpacesContext';
import { FileShareItem, formatFileSize, ShareLinkConfig, revokePublicShare, FolderPartnerPermission } from '@/utils/fileShareUtils';
import { FileShareItemCard } from './FileShareItemCard';
import { CreateShareLinkModal } from './CreateShareLinkModal';
import { ImportExistingFileModal } from './ImportExistingFileModal';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';
import VersionBadge from '@/components/common/VersionBadge';
import BatchActionToolbar, { BatchToolbarAction } from '@/components/common/BatchActionToolbar';
import GlobalMoveModal from '@/components/common/GlobalMoveModal';
import GlobalRecycleBinModal, { TrashItem } from '@/components/common/GlobalRecycleBinModal';
import ConfirmModal from '@/components/common/ConfirmModal';

interface FileShareWidgetProps {
  space: any;
  hasPartners?: boolean;
  hasScanner?: boolean;
  activePartnersCount?: number;
  onOpenScanner?: () => void;
}

export function FileShareWidget({
  space,
  hasPartners = false,
  hasScanner = false,
  activePartnersCount = 0,
  onOpenScanner
}: FileShareWidgetProps) {
  const { user } = useAuth();
  const { updateFileShareItems } = useSpaces();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShareItem, setActiveShareItem] = useState<FileShareItem | null>(null);
  const [previewState, setPreviewState] = useState<{ docs: any[]; index: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  
  // Folder creation prompt modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Import existing file modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Partner Permission Modal state
  const [privacyItem, setPrivacyItem] = useState<FileShareItem | null>(null);
  const [selectedAllowedPartners, setSelectedAllowedPartners] = useState<string[]>([]);
  const [folderPartnersConfig, setFolderPartnersConfig] = useState<FolderPartnerPermission[]>([]);

  // Multi-select and batch operations (Rule DRY / Single Source of Truth)
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [moveModalState, setMoveModalState] = useState<{ itemIds: string[]; currentFolderId: string | null } | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // View Mode: grid_medium (125px) / grid_large (175px) / list (Table)
  const [viewMode, setViewMode] = useState<'grid_medium' | 'grid_large' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smartshare_fileshare_view_mode');
      if (saved === 'list' || saved === 'grid_medium' || saved === 'grid_large') return saved;
    }
    return 'grid_medium';
  });
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  const handleSetViewMode = (mode: 'grid_medium' | 'grid_large' | 'list') => {
    setViewMode(mode);
    setShowViewDropdown(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('smartshare_fileshare_view_mode', mode);
    }
  };

  // raw items from space
  const allItems: FileShareItem[] = useMemo(() => {
    return Array.isArray(space?.fileShareItems) ? space.fileShareItems : [];
  }, [space?.fileShareItems]);

  // Active items (not deleted)
  const activeItems = useMemo(() => {
    return allItems.filter(i => !i.deletedAt);
  }, [allItems]);

  // Deleted items in recycle bin (deleted within 12 hours)
  const deletedItems = useMemo(() => {
    return allItems.filter(i => !!i.deletedAt);
  }, [allItems]);

  // Auto purge items older than 12 hours (Rule: 12-hour recycle bin auto-cleanup)
  useEffect(() => {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = deletedItems.filter(i => i.deletedAt && (now - new Date(i.deletedAt).getTime()) > TWELVE_HOURS_MS);
    if (expired.length > 0) {
      const expiredIds = new Set(expired.map(i => i.id));
      // Revoke any public links
      expired.forEach(i => {
        if (i.shareLink?.token) revokePublicShare(i.shareLink.token);
      });
      const remaining = allItems.filter(i => !expiredIds.has(i.id));
      saveItems(remaining);
    }
  }, [deletedItems, allItems]);

  const isCreator = space.creatorId === user?.id || (user?.email && space.creatorEmail === user.email);
  const currentUserId = user?.id || '';

  // Check if current user is folder admin or creator for current folder
  const currentFolderItem = useMemo(() => {
    if (!currentFolderId) return null;
    return activeItems.find(i => i.id === currentFolderId && i.type === 'folder') || null;
  }, [currentFolderId, activeItems]);

  const isCurrentFolderAdmin = useMemo(() => {
    if (isCreator) return true;
    if (!currentFolderItem) return true; // root level
    if (currentFolderItem.createdBy === currentUserId) return true;
    if (Array.isArray(currentFolderItem.folderPartners)) {
      const p = currentFolderItem.folderPartners.find(fp => fp.partnerId === currentUserId);
      if (p && p.role === 'admin') return true;
    }
    return false;
  }, [isCreator, currentFolderItem, currentUserId]);

  // Listen to floating dock events (Rule DRY / Single Source of Action)
  useEffect(() => {
    const handleAddFolder = () => {
      setNewFolderName('');
      setShowNewFolderModal(true);
    };
    const handleUpload = () => {
      fileInputRef.current?.click();
    };
    const handleImport = () => {
      setShowImportModal(true);
    };

    window.addEventListener('smartshare:add_folder', handleAddFolder);
    window.addEventListener('smartshare:fileshare_add_folder', handleAddFolder);
    window.addEventListener('smartshare:fileshare_upload', handleUpload);
    window.addEventListener('smartshare:fileshare_import', handleImport);

    const handleBackStep = (e: any) => {
      if (currentFolderId) {
        const parent = activeItems.find(i => i.id === currentFolderId && i.type === 'folder');
        setCurrentFolderId(parent?.parentId || null);
        if (e?.detail) e.detail.handled = true;
      }
    };
    window.addEventListener('smartshare:navigate_back_one_step', handleBackStep);

    return () => {
      window.removeEventListener('smartshare:add_folder', handleAddFolder);
      window.removeEventListener('smartshare:fileshare_add_folder', handleAddFolder);
      window.removeEventListener('smartshare:fileshare_upload', handleUpload);
      window.removeEventListener('smartshare:fileshare_import', handleImport);
      window.removeEventListener('smartshare:navigate_back_one_step', handleBackStep);
    };
  }, [currentFolderId, activeItems]);

  // Breadcrumbs path computation
  const breadcrumbTrail = useMemo(() => {
    const trail: { id: string | null; name: string }[] = [{ id: null, name: 'ראשי' }];
    let currId = currentFolderId;
    const visited = new Set<string>();

    const path: { id: string | null; name: string }[] = [];
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const parentFolder = activeItems.find(i => i.id === currId && i.type === 'folder');
      if (parentFolder) {
        path.unshift({ id: parentFolder.id, name: parentFolder.name });
        currId = parentFolder.parentId;
      } else {
        break;
      }
    }
    return [...trail, ...path];
  }, [currentFolderId, activeItems]);

  // Notify floating action bar when entering / exiting subfolders (Rule DRY: Uniform Back button)
  useEffect(() => {
    if (currentFolderId) {
      window.dispatchEvent(new CustomEvent('smartshare:fileshare_folder_entered'));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:fileshare_folder_exited'));
    }
  }, [currentFolderId]);
  const visibleItems = useMemo(() => {
    return activeItems.filter(item => {
      // 1. Must match current folder
      if (item.parentId !== currentFolderId) return false;

      // 2. Permission check (Rule 20: default open to all members, unless restricted)
      if (Array.isArray(item.allowedPartners) && item.allowedPartners.length > 0) {
        if (item.allowedPartners.includes('__creator_vault_secret__')) {
          if (!isCreator) return false;
        } else if (item.allowedPartners.includes('__only_me__')) {
          if (item.createdBy !== currentUserId && !isCreator) return false;
        } else {
          // Check if user is in allowedPartners OR in folderPartners
          const hasFolderPartnerAccess = Array.isArray(item.folderPartners) && item.folderPartners.some(fp => fp.partnerId === currentUserId);
          if (!isCreator && currentUserId && !item.allowedPartners.includes(currentUserId) && !hasFolderPartnerAccess && item.createdBy !== currentUserId) {
            return false;
          }
        }
      }

      // 3. Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return item.name.toLowerCase().includes(q);
      }

      return true;
    });
  }, [allItems, currentFolderId, isCreator, currentUserId, searchQuery]);

  // Split into folders and files
  const folders = useMemo(() => visibleItems.filter(i => i.type === 'folder'), [visibleItems]);
  const files = useMemo(() => visibleItems.filter(i => i.type === 'file'), [visibleItems]);

  // Save updated items list to Firestore
  
  // Toggle selection for single item
  const handleToggleSelectItem = (item: FileShareItem) => {
    setSelectedItemIds(prev =>
      prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
    );
  };

  // Confirm move items to target folder
  const handleConfirmMoveItems = async (targetFolderId: string | null) => {
    if (!moveModalState) return;
    const movingIds = new Set(moveModalState.itemIds);
    const next = allItems.map(i => {
      if (movingIds.has(i.id)) {
        return { ...i, parentId: targetFolderId };
      }
      return i;
    });
    await saveItems(next);
    setSelectedItemIds([]);
    setIsMultiSelect(false);
    setMoveModalState(null);
  };

  // Confirm batch delete items (Move to Recycle Bin for 12 hours)
  const handleConfirmBatchDelete = async () => {
    const deletingIds = new Set(selectedItemIds);
    // Recursively collect all children if any selected item is a folder
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      allItems.forEach(i => {
        if (i.parentId && deletingIds.has(i.parentId) && !deletingIds.has(i.id)) {
          deletingIds.add(i.id);
          addedMore = true;
        }
      });
    }

    const nowIso = new Date().toISOString();
    const next = allItems.map(i => {
      if (deletingIds.has(i.id)) {
        return { ...i, deletedAt: nowIso };
      }
      return i;
    });

    await saveItems(next);
    setSelectedItemIds([]);
    setIsMultiSelect(false);
    setBatchDeleteConfirm(false);
  };

  const saveItems = async (updatedItems: FileShareItem[]) => {
    try {
      if (updateFileShareItems && space?.id) {
        await updateFileShareItems(space.id, updatedItems);
      } else {
        const spaceRef = doc(db, 'spaces', space.id);
        await updateDoc(spaceRef, { fileShareItems: updatedItems });
      }
    } catch (err) {
      console.error('Failed to update file share items:', err);
      alert('שגיאה בשמירת הנתונים. אנא נסה שוב.');
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const newFolder: FileShareItem = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      spaceId: space.id,
      name: newFolderName.trim(),
      type: 'folder',
      parentId: currentFolderId,
      createdAt: Date.now(),
      createdBy: currentUserId,
      creatorName: user?.realName || user?.nickname || 'שותף',
      allowedPartners: []
    };

    const next = [...allItems, newFolder];
    await saveItems(next);
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  // Handle direct file uploads (images, PDFs, documents)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(`מעלה ${selectedFiles.length} קבצים...`);

    const newUploadedItems: FileShareItem[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`מעלה קובץ ${i + 1} מתוך ${selectedFiles.length}: ${file.name}`);

        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        let fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'other' = 'other';
        if (fileExt === 'pdf' || file.type.includes('pdf')) fileType = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(fileExt) || file.type.includes('image')) fileType = 'image';
        else if (['xls', 'xlsx', 'csv'].includes(fileExt)) fileType = 'sheet';
        else if (['doc', 'docx', 'txt'].includes(fileExt)) fileType = 'doc';

        const storagePath = `spaces/${space.id}/fileshare/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const downloadUrl = await uploadBlobToStorage(file, storagePath);

        const newItem: FileShareItem = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          spaceId: space.id,
          name: file.name,
          type: 'file',
          parentId: currentFolderId,
          url: downloadUrl,
          thumbnailUrl: fileType === 'image' ? downloadUrl : undefined,
          fileType,
          size: file.size,
          createdAt: Date.now(),
          createdBy: currentUserId,
          creatorName: user?.realName || user?.nickname || 'שותף',
          allowedPartners: []
        };

        newUploadedItems.push(newItem);
      }

      await saveItems([...allItems, ...newUploadedItems]);
    } catch (err) {
      console.error('Error during file upload:', err);
      alert('חלק מהקבצים לא עלו בהצלחה. אנא נסה שוב.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Rename item (file or folder)
  const handleRenameItem = async (item: FileShareItem, newName: string) => {
    if (!newName.trim() || newName.trim() === item.name) return;
    const next = allItems.map(i => (i.id === item.id ? { ...i, name: newName.trim() } : i));
    await saveItems(next);
  };

  // Delete item (Move to Recycle Bin for 12 hours)
  const handleDeleteItem = async (item: FileShareItem) => {
    const isFolder = item.type === 'folder';
    const confirmMsg = isFolder
      ? `האם להעביר את התיקייה "${item.name}" וכל תכולתה לסל האשפה? (נשמרת למשך 12 שעות)`
      : `האם להעביר את הקובץ "${item.name}" לסל האשפה? (נשמר למשך 12 שעות)`;

    if (!confirm(confirmMsg)) return;

    const nowIso = new Date().toISOString();

    if (isFolder) {
      // Recursively mark folder and all children as deletedAt
      const toDeleteIds = new Set<string>([item.id]);
      let addedMore = true;
      while (addedMore) {
        addedMore = false;
        allItems.forEach(i => {
          if (i.parentId && toDeleteIds.has(i.parentId) && !toDeleteIds.has(i.id)) {
            toDeleteIds.add(i.id);
            addedMore = true;
          }
        });
      }
      const next = allItems.map(i => (toDeleteIds.has(i.id) ? { ...i, deletedAt: nowIso } : i));
      await saveItems(next);
    } else {
      const next = allItems.map(i => (i.id === item.id ? { ...i, deletedAt: nowIso } : i));
      await saveItems(next);
    }
  };

  // Restore item from recycle bin
  const handleRestoreItem = async (item: TrashItem) => {
    const next = allItems.map(i => {
      if (i.id === item.id) {
        const copy = { ...i };
        delete copy.deletedAt;
        return copy;
      }
      return i;
    });
    await saveItems(next);
  };

  // Permanently delete item
  const handlePermanentDeleteItem = async (item: TrashItem) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק לצמיתות את "${item.name}"? לא ניתן יהיה לשחזר אותו.`)) return;

    if (item.rawItem?.shareLink?.token) {
      await revokePublicShare(item.rawItem.shareLink.token);
    }

    const toDeleteIds = new Set<string>([item.id]);
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      allItems.forEach(i => {
        if (i.parentId && toDeleteIds.has(i.parentId) && !toDeleteIds.has(i.id)) {
          toDeleteIds.add(i.id);
          if (i.shareLink?.token) revokePublicShare(i.shareLink.token);
          addedMore = true;
        }
      });
    }

    const next = allItems.filter(i => !toDeleteIds.has(i.id));
    await saveItems(next);
  };

  // Toggle Favorite for single item (File or Folder)
  const handleToggleFavorite = async (item: FileShareItem) => {
    const next = allItems.map(i => {
      if (i.id === item.id) {
        return { ...i, isFavorite: !i.isFavorite };
      }
      return i;
    });
    await saveItems(next);
  };

  // Edit single item in scanner
  const handleEditInScanner = (item: FileShareItem) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', {
        detail: {
          doc: {
            id: item.id,
            title: item.name,
            url: item.url,
            pages: item.pages && item.pages.length > 0 ? item.pages : (item.url ? [item.url] : [])
          },
          itemType: 'fileshare'
        }
      }));
    }
  };

  // Open item (Folder: navigate down. File: open universal viewer)
  const handleOpenItem = (item: FileShareItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
      setSearchQuery('');
    } else if (item.url) {
      // Find all files in current view to allow swiping/prev/next
      const fileDocs = files.map(f => ({
        id: f.id,
        url: f.url || '',
        rawPdfUrl: f.rawPdfUrl || (f.fileType === 'pdf' || f.url?.toLowerCase().includes('.pdf') ? f.url : undefined),
        title: f.name,
        type: f.fileType || 'other',
        pages: f.pages || (f.url ? [f.url] : [])
      }));
      const idx = fileDocs.findIndex(d => d.id === item.id);
      setPreviewState({ docs: fileDocs, index: idx >= 0 ? idx : 0 });
    }
  };

  // Save public share link configuration
  const handleSaveShareLink = async (updatedLinkConfig?: ShareLinkConfig) => {
    if (!activeShareItem) return;
    const next = allItems.map(i => {
      if (i.id === activeShareItem.id) {
        return {
          ...i,
          shareLink: updatedLinkConfig
        };
      }
      return i;
    });
    // Update local activeShareItem state as well so re-opening modal reflects changes immediately
    setActiveShareItem(prev => (prev && prev.id === activeShareItem.id ? { ...prev, shareLink: updatedLinkConfig } : prev));
    await saveItems(next);
  };

  // Save partner permissions
  const handleSavePrivacy = async () => {
    if (!privacyItem) return;
    const next = allItems.map(i => {
      if (i.id === privacyItem.id) {
        return {
          ...i,
          allowedPartners: selectedAllowedPartners,
          folderPartners: privacyItem.type === 'folder' ? folderPartnersConfig : undefined
        };
      }
      return i;
    });
    await saveItems(next);
    setPrivacyItem(null);
  };

  // Folder files for sharing an entire folder
  const currentFolderContainedFiles = useMemo(() => {
    if (!activeShareItem || activeShareItem.type !== 'folder') return undefined;
    return allItems.filter(i => i.parentId === activeShareItem.id && i.type === 'file');
  }, [activeShareItem, allItems]);

  const activePartners = Array.isArray(space?.members) ? space.members.filter((m: any) => m.status === 'active' || m.role === 'partner' || m.role === 'creator') : [];

  return (
    <div style={{
      background: 'var(--bg-main, #f8fafc)',
      borderRadius: '24px',
      border: '1.5px solid var(--border-light, #e2e8f0)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: 'var(--shadow-sm)',
      direction: 'rtl'
    }}>
      {/* 1. WIDGET HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
          }}>
            📤
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 900 }}>
                שיתוף קבצים
              </h2>
              <VersionBadge />
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              פורטל שיתוף תיקיות ומסמכים מאובטח בקישורים חיצוניים
            </p>
          </div>
        </div>

        {/* Global Stats Counter, View Switcher & Recycle Bin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* View Mode Switcher (List / Medium Grid / Large Grid) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowViewDropdown(!showViewDropdown)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                padding: '4px 10px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: showViewDropdown ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                transition: 'all 0.15s ease'
              }}
              title="שינוי תצוגת פריסה (רשימה / בינוני / גדול)"
            >
              <span style={{ fontSize: '0.9rem' }}>
                {viewMode === 'list' ? '☰' : viewMode === 'grid_large' ? '☷' : '▦'}
              </span>
              <span>
                {viewMode === 'list' ? 'רשימה' : viewMode === 'grid_large' ? 'גדול' : 'בינוני'}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.65 }}>▾</span>
            </button>

            {showViewDropdown && (
              <>
                <div onClick={() => setShowViewDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
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
                    onClick={() => handleSetViewMode('list')}
                    style={{
                      border: 'none',
                      background: viewMode === 'list' ? '#eff6ff' : 'transparent',
                      color: viewMode === 'list' ? '#1d4ed8' : '#334155',
                      fontWeight: viewMode === 'list' ? 800 : 500,
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.78rem',
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
                    {viewMode === 'list' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetViewMode('grid_medium')}
                    style={{
                      border: 'none',
                      background: viewMode === 'grid_medium' ? '#eff6ff' : 'transparent',
                      color: viewMode === 'grid_medium' ? '#1d4ed8' : '#334155',
                      fontWeight: viewMode === 'grid_medium' ? 800 : 500,
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.78rem',
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
                    {viewMode === 'grid_medium' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetViewMode('grid_large')}
                    style={{
                      border: 'none',
                      background: viewMode === 'grid_large' ? '#eff6ff' : 'transparent',
                      color: viewMode === 'grid_large' ? '#1d4ed8' : '#334155',
                      fontWeight: viewMode === 'grid_large' ? 800 : 500,
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.78rem',
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
                    {viewMode === 'grid_large' && <span style={{ marginRight: 'auto', color: '#3b82f6', fontWeight: 900 }}>✓</span>}
                  </button>
                </div>
              </>
            )}
          </div>

          {deletedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRecycleBin(true)}
              style={{
                padding: '0.35rem 0.6rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#ef4444',
                fontWeight: 'bold',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                whiteSpace: 'nowrap'
              }}
              title="סל אשפה (קבצים ותיקיות שנמחקו ב-12 השעות האחרונות)"
            >
              <span>🗑️</span>
              <span>{deletedItems.length}</span>
            </button>
          )}

          <span style={{ fontSize: '0.74rem', background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-light)', padding: '3px 9px', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            {folders.length} תיקיות • {files.length} קבצים
          </span>
          {visibleItems.length > 0 && !isMultiSelect && (
            <button
              type="button"
              onClick={() => {
                setIsMultiSelect(true);
                setSelectedItemIds([]);
              }}
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--primary, #4f46e5)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                padding: '4px 10px',
                borderRadius: '10px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              title="בחר מספר קבצים או תיקיות לביצוע פעולה מרוכזת"
            >
              <span>☑️</span>
              <span>בחירה מרובה</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BREADCRUMBS BAR (Shown when navigating inside folders) */}
      {breadcrumbTrail.length > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          background: 'rgba(99, 102, 241, 0.06)',
          padding: '0.5rem 0.85rem',
          borderRadius: '12px',
          border: '1px solid rgba(99, 102, 241, 0.18)',
          fontSize: '0.84rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <button
            type="button"
            onClick={() => {
              const parentCrumb = breadcrumbTrail[breadcrumbTrail.length - 2];
              setCurrentFolderId(parentCrumb?.id || null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              padding: '0 0.2rem',
              color: 'var(--primary)'
            }}
            title="חזרה לתיקייה קודמת"
          >
            ↩️
          </button>
          {breadcrumbTrail.map((crumb, idx) => {
            const isLast = idx === breadcrumbTrail.length - 1;
            const crumbFolder = crumb.id ? activeItems.find(i => i.id === crumb.id) : null;
            const crumbPartners = crumbFolder?.folderPartners || [];

            return (
              <React.Fragment key={crumb.id || 'root'}>
                {idx > 0 && <span style={{ color: 'var(--text-secondary)' }}>/</span>}
                <span
                  onClick={() => !isLast && setCurrentFolderId(crumb.id)}
                  style={{
                    color: isLast ? 'var(--text-primary)' : 'var(--primary)',
                    fontWeight: isLast ? 800 : 600,
                    cursor: isLast ? 'default' : 'pointer',
                    textDecoration: isLast ? 'none' : 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{crumb.id === null ? '🏠 ראשי' : `📁 ${crumb.name}`}</span>
                  {crumbPartners.length > 0 && (
                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#e0e7ff', color: '#3730a3', fontWeight: 700 }}>
                      👥 {crumbPartners.map(p => p.name || 'שותף').join(', ')}
                    </span>
                  )}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* MULTI-SELECT FLOATING ACTION BAR */}
      {isMultiSelect && (() => {
        const currentItemIds = visibleItems.map(i => i.id);
        const isAllSelected = currentItemIds.length > 0 && currentItemIds.every(id => selectedItemIds.includes(id));

        const actions: BatchToolbarAction[] = [];

        // Single or Multi edit/merge in scanner
        if (hasScanner) {
          if (selectedItemIds.length === 1) {
            const targetItem = allItems.find(i => i.id === selectedItemIds[0]);
            if (targetItem && targetItem.type === 'file') {
              actions.push({
                id: 'edit',
                label: 'עריכה',
                icon: '✂️',
                variant: 'primary',
                title: 'עריכה ופילטור הקובץ בסורק',
                onClick: () => {
                  setIsMultiSelect(false);
                  setSelectedItemIds([]);
                  handleEditInScanner(targetItem);
                }
              });
            }
          } else if (selectedItemIds.length > 1) {
            const selectedFiles = selectedItemIds
              .map(id => allItems.find(i => i.id === id))
              .filter(i => i && i.type === 'file') as FileShareItem[];

            if (selectedFiles.length > 1) {
              actions.push({
                id: 'merge',
                label: 'איחוד',
                icon: '📜',
                variant: 'primary',
                title: 'איחוד הקבצים הנבחרים בסורק',
                onClick: () => {
                  setIsMultiSelect(false);
                  setSelectedItemIds([]);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', {
                      detail: {
                        docs: selectedFiles.map(f => ({
                          id: f.id,
                          title: f.name,
                          url: f.url,
                          pages: f.pages && f.pages.length > 0 ? f.pages : (f.url ? [f.url] : [])
                        })),
                        itemType: 'fileshare'
                      }
                    }));
                  }
                }
              });
            }
          }
        }

        actions.push({
          id: 'move',
          label: 'העבר לתיקייה',
          icon: '📁',
          variant: 'info',
          title: 'העבר פריטים נבחרים לתיקייה',
          onClick: () => setMoveModalState({ itemIds: selectedItemIds, currentFolderId })
        });

        actions.push({
          id: 'delete',
          label: 'מחק',
          icon: '🗑️',
          variant: 'danger',
          title: 'מחק פריטים נבחרים',
          onClick: () => setBatchDeleteConfirm(true)
        });

        return (
          <BatchActionToolbar
            selectedCount={selectedItemIds.length}
            totalCount={currentItemIds.length}
            isAllSelected={isAllSelected}
            onToggleSelectAll={() => {
              if (isAllSelected) {
                setSelectedItemIds(prev => prev.filter(id => !currentItemIds.includes(id)));
              } else {
                setSelectedItemIds(prev => Array.from(new Set([...prev, ...currentItemIds])));
              }
            }}
            onCancel={() => {
              setIsMultiSelect(false);
              setSelectedItemIds([]);
            }}
            actions={actions}
            topPosition="70px"
          />
        );
      })()}

      {/* 3. SEARCH BAR & HIDDEN UPLOAD INPUT (Actions reside in Floating Dock per Rule DRY) */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
        <input 
          ref={fileInputRef}
          type="file" 
          multiple 
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={handleFileUpload} 
          style={{ display: 'none' }}
        />

        {/* Search input */}
        <div style={{ flex: 1, width: '100%' }}>
          <input
            type="text"
            placeholder="🔍 חפש קובץ או תיקייה..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card, #ffffff)',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Uploading Status Banner */}
      {isUploading && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          padding: '0.65rem 1rem',
          borderRadius: '12px',
          fontSize: '0.82rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⏳</span>
          <span>{uploadProgress || 'מעלה נתונים לענן מאובטח...'}</span>
        </div>
      )}

      {/* 4. ITEMS LIST (FOLDERS & FILES ACCORDING TO VIEW MODE) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Table Header when in List View */}
        {viewMode === 'list' && (folders.length > 0 || files.length > 0) && (
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
            <span>שם הפריט</span>
            <span style={{ textAlign: 'right' }}>תאריך / משקל</span>
            <span style={{ textAlign: 'center' }}>פעולות</span>
          </div>
        )}

        {/* FOLDERS SECTION */}
        {folders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📁</span>
              <span>תיקיות ({folders.length}):</span>
            </div>

            <div style={{
              display: viewMode === 'list' ? 'flex' : 'grid',
              flexDirection: viewMode === 'list' ? 'column' : undefined,
              gridTemplateColumns: viewMode === 'grid_large' 
                ? 'repeat(auto-fill, minmax(175px, 1fr))' 
                : (viewMode === 'grid_medium' ? 'repeat(auto-fill, minmax(125px, 1fr))' : undefined),
              gap: '0.75rem'
            }}>
              {folders.map(folder => {
                const subItemCount = allItems.filter(i => i.parentId === folder.id && !i.deletedAt).length;
                return (
                  <FileShareItemCard
                    key={folder.id}
                    item={folder}
                    viewMode={viewMode}
                    containedItemCount={subItemCount}
                    onOpen={handleOpenItem}
                    onManageLink={item => setActiveShareItem(item)}
                    onManagePermissions={item => {
                      setPrivacyItem(item);
                      setSelectedAllowedPartners(item.allowedPartners || []);
                      setFolderPartnersConfig(item.folderPartners || []);
                    }}
                    onRename={handleRenameItem}
                    onDelete={handleDeleteItem}
                    onMove={item => setMoveModalState({ itemIds: [item.id], currentFolderId: item.parentId })}
                    onToggleFavorite={handleToggleFavorite}
                    isMultiSelect={isMultiSelect}
                    isSelected={selectedItemIds.includes(folder.id)}
                    onToggleSelect={handleToggleSelectItem}
                    onLongPressSelect={item => {
                      setIsMultiSelect(true);
                      setSelectedItemIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* FILES SECTION */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {folders.length > 0 && (
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📄</span>
                <span>קבצים ({files.length}):</span>
              </div>
            )}

            <div style={{
              display: viewMode === 'list' ? 'flex' : 'grid',
              flexDirection: viewMode === 'list' ? 'column' : undefined,
              gridTemplateColumns: viewMode === 'grid_large' 
                ? 'repeat(auto-fill, minmax(175px, 1fr))' 
                : (viewMode === 'grid_medium' ? 'repeat(auto-fill, minmax(125px, 1fr))' : undefined),
              gap: '0.75rem'
            }}>
              {files.map((file, idx) => (
                <FileShareItemCard
                  key={file.id}
                  item={file}
                  itemIndex={idx}
                  viewMode={viewMode}
                  onOpen={handleOpenItem}
                  onManageLink={item => setActiveShareItem(item)}
                  onManagePermissions={item => {
                    setPrivacyItem(item);
                    setSelectedAllowedPartners(item.allowedPartners || []);
                    setFolderPartnersConfig(item.folderPartners || []);
                  }}
                  onRename={handleRenameItem}
                  onDelete={handleDeleteItem}
                  onMove={item => setMoveModalState({ itemIds: [item.id], currentFolderId: item.parentId })}
                  onToggleFavorite={handleToggleFavorite}
                  onEditInScanner={handleEditInScanner}
                  hasScanner={hasScanner}
                  isMultiSelect={isMultiSelect}
                  isSelected={selectedItemIds.includes(file.id)}
                  onToggleSelect={handleToggleSelectItem}
                  onLongPressSelect={item => {
                    setIsMultiSelect(true);
                    setSelectedItemIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {folders.length === 0 && files.length === 0 && !isUploading && (
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '18px',
            border: '2px dashed var(--border-light)',
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              התיקייה ריקה
            </h3>
            <p style={{ margin: '0.35rem 0 1rem 0', fontSize: '0.8rem' }}>
              העלה קבצים מהמכשיר, צור תיקייה או ייבא ישירות קבצים ממרחבים אחרים (ללא שכפול נפח).
            </p>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--primary)',
                border: '1.5px solid var(--primary)',
                borderRadius: '12px',
                padding: '0.5rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-xs)'
              }}
            >
              <span>📥</span> ייבא קובץ קיים ממרחב אחר
            </button>
          </div>
        )}
      </div>

      {/* 5. CREATE / EDIT PUBLIC SHARE LINK MODAL */}
      <CreateShareLinkModal
        isOpen={Boolean(activeShareItem)}
        item={activeShareItem ? (allItems.find(i => i.id === activeShareItem.id) || activeShareItem) : null}
        spaceTitle={space.title || 'המרחב שלי'}
        folderFiles={currentFolderContainedFiles}
        onClose={() => setActiveShareItem(null)}
        onSaved={handleSaveShareLink}
      />

      {/* 6. GLOBAL PRIVACY & ACCESS MODAL (Rule 20) */}
      {privacyItem && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: 'rtl'
          }}
          onClick={() => setPrivacyItem(null)}
        >
          <div 
            style={{
              background: 'var(--bg-card, #ffffff)',
              width: '100%',
              maxWidth: '440px',
              borderRadius: '24px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                🔒 הגדרת הרשאות ופרטיות (גלובאלי)
              </h3>
              <button 
                type="button" 
                onClick={() => setPrivacyItem(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              קבע מי יכול לצפות בפריט: <strong>{privacyItem.name}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '360px', overflowY: 'auto' }}>
              {/* Option 1: 🌐 Open to everyone in space (Rule 20 default) */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.7rem 0.85rem',
                background: selectedAllowedPartners.length === 0 ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                border: selectedAllowedPartners.length === 0 ? '1.5px solid var(--primary)' : '1px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.84rem'
              }}>
                <input 
                  type="radio"
                  name="privacyScope"
                  checked={selectedAllowedPartners.length === 0}
                  onChange={() => {
                    setSelectedAllowedPartners([]);
                    setFolderPartnersConfig([]);
                  }}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>🌐 פתוח לכל חברי המרחב (ברירת מחדל)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>כל מי שיש לו גישה למרחב יכול לצפות בפריט זה</div>
                </div>
              </label>

              {/* Option 2: 👤 Solo / Only Me */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.7rem 0.85rem',
                background: selectedAllowedPartners.includes('__only_me__') ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                border: selectedAllowedPartners.includes('__only_me__') ? '1.5px solid var(--primary)' : '1px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.84rem'
              }}>
                <input 
                  type="radio"
                  name="privacyScope"
                  checked={selectedAllowedPartners.includes('__only_me__')}
                  onChange={() => {
                    setSelectedAllowedPartners(['__only_me__']);
                    setFolderPartnersConfig([]);
                  }}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>👤 פרויקט סולו (רק לעצמי - פרטי לחלוטין)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>רק אתה כמנהל המרחב תוכל לצפות ולנהל פריט זה</div>
                </div>
              </label>

              {/* Option 3: 🛡️ Admins Only */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.7rem 0.85rem',
                background: selectedAllowedPartners.includes('__creator_vault_secret__') ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                border: selectedAllowedPartners.includes('__creator_vault_secret__') ? '1.5px solid var(--primary)' : '1px solid transparent',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.84rem'
              }}>
                <input 
                  type="radio"
                  name="privacyScope"
                  checked={selectedAllowedPartners.includes('__creator_vault_secret__')}
                  onChange={() => {
                    setSelectedAllowedPartners(['__creator_vault_secret__']);
                    setFolderPartnersConfig([]);
                  }}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>🛡️ מנהלי המרחב בלבד</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>גישה ליוצר ומנהלי המרחב בלבד</div>
                </div>
              </label>

              {/* Option 4: Specific Members / Project Partners (Dedicated Local Role & Permissions) */}
              {activePartners.length > 0 && (
                <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    👥 שיוך שותפים ייעודיים {privacyItem?.type === 'folder' ? 'לפרויקט / תיקייה זו' : 'לפריט זה'}:
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    תוכל להגדיר שותף ספציפי כספק, לקוח או שותף כללי, ולקבוע אם יש לו הרשאת ניהול מקומית בתיקייה או הרשאת צפייה בלבד.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {activePartners.map((m: any) => {
                      const partnerId = m.userId || m.id;
                      const isChecked = selectedAllowedPartners.includes(partnerId);
                      const currentPartnerConfig = folderPartnersConfig.find(fp => fp.partnerId === partnerId) || {
                        partnerId,
                        role: 'admin' as const,
                        partnerType: 'general' as const
                      };

                      return (
                        <div
                          key={partnerId}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            padding: '0.55rem 0.75rem',
                            background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-main, #f8fafc)',
                            border: isChecked ? '1.5px solid var(--primary, #4f46e5)' : '1px solid var(--border-light, #e2e8f0)',
                            borderRadius: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <label 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              fontWeight: isChecked ? 800 : 600
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedAllowedPartners(prev => prev.filter(id => id !== partnerId));
                                    setFolderPartnersConfig(prev => prev.filter(fp => fp.partnerId !== partnerId));
                                  } else {
                                    setSelectedAllowedPartners(prev => [
                                      ...prev.filter(id => id !== '__only_me__' && id !== '__creator_vault_secret__'),
                                      partnerId
                                    ]);
                                    setFolderPartnersConfig(prev => [
                                      ...prev.filter(fp => fp.partnerId !== partnerId),
                                      {
                                        partnerId,
                                        name: m.name || m.email,
                                        role: 'admin',
                                        partnerType: 'general',
                                        assignedAt: Date.now()
                                      }
                                    ]);
                                  }
                                }}
                                style={{ accentColor: 'var(--primary)' }}
                              />
                              <span>{m.name || m.email || 'חבר מרחב'} {m.role === 'creator' ? '(יוצר המרחב)' : ''}</span>
                            </div>
                            {isChecked && (
                              <span style={{ fontSize: '0.68rem', color: '#4f46e5', fontWeight: 800, background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
                                מורשה ✓
                              </span>
                            )}
                          </label>

                          {/* Role & Partner Type Controls (Shown when partner is checked and item is a folder) */}
                          {isChecked && privacyItem?.type === 'folder' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', paddingTop: '0.35rem', borderTop: '1px dashed #cbd5e1', flexWrap: 'wrap' }}>
                              {/* Partner Type: Client / Provider / General */}
                              <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>תפקיד:</span>
                                {(
                                  [
                                    { id: 'client', label: '👤 לקוח' },
                                    { id: 'provider', label: '🛠️ ספק' },
                                    { id: 'general', label: '🤝 שותף' }
                                  ] as const
                                ).map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                      setFolderPartnersConfig(prev => {
                                        const exists = prev.find(fp => fp.partnerId === partnerId);
                                        if (exists) {
                                          return prev.map(fp => fp.partnerId === partnerId ? { ...fp, partnerType: t.id } : fp);
                                        }
                                        return [...prev, { partnerId, name: m.name, role: 'admin', partnerType: t.id, assignedAt: Date.now() }];
                                      });
                                    }}
                                    style={{
                                      padding: '2px 5px',
                                      borderRadius: '6px',
                                      fontSize: '0.68rem',
                                      fontWeight: currentPartnerConfig.partnerType === t.id ? 800 : 500,
                                      border: currentPartnerConfig.partnerType === t.id ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                                      background: currentPartnerConfig.partnerType === t.id ? '#4f46e5' : '#ffffff',
                                      color: currentPartnerConfig.partnerType === t.id ? '#ffffff' : '#475569',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>

                              {/* Local Access Permission: Admin vs Viewer */}
                              <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', marginRight: 'auto' }}>
                                <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>הרשאה:</span>
                                {(
                                  [
                                    { id: 'admin', label: '⚡ מנהל תיקייה' },
                                    { id: 'viewer', label: '👁️ צפייה בלבד' }
                                  ] as const
                                ).map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setFolderPartnersConfig(prev => {
                                        const exists = prev.find(fp => fp.partnerId === partnerId);
                                        if (exists) {
                                          return prev.map(fp => fp.partnerId === partnerId ? { ...fp, role: p.id } : fp);
                                        }
                                        return [...prev, { partnerId, name: m.name, role: p.id, partnerType: 'general', assignedAt: Date.now() }];
                                      });
                                    }}
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '6px',
                                      fontSize: '0.68rem',
                                      fontWeight: currentPartnerConfig.role === p.id ? 800 : 500,
                                      border: currentPartnerConfig.role === p.id ? '1px solid #059669' : '1px solid #e2e8f0',
                                      background: currentPartnerConfig.role === p.id ? '#ecfdf5' : '#ffffff',
                                      color: currentPartnerConfig.role === p.id ? '#059669' : '#475569',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPrivacyItem(null)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSavePrivacy}
                style={{ flex: 1.5, padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: '#ffffff', cursor: 'pointer', fontWeight: 800 }}
              >
                שמור הרשאות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL MOVE MODAL */}
      {moveModalState && (() => {
        const count = moveModalState.itemIds.length;
        // Recursively exclude descendant folders if any moving item is a folder to prevent circular nesting
        const getDescendantFolderIds = (parentId: string): string[] => {
          const direct = allItems.filter(i => i.type === 'folder' && i.parentId === parentId).map(i => i.id);
          let all = [...direct];
          direct.forEach(subId => {
            all = [...all, ...getDescendantFolderIds(subId)];
          });
          return all;
        };
        const invalidFolderIds = new Set<string>(moveModalState.itemIds);
        moveModalState.itemIds.forEach(id => {
          getDescendantFolderIds(id).forEach(descId => invalidFolderIds.add(descId));
        });

        const availableFolders = allItems.filter(i => i.type === 'folder' && !invalidFolderIds.has(i.id));

        return (
          <GlobalMoveModal
            isOpen={Boolean(moveModalState)}
            itemCount={count}
            subtitle={count > 1 ? `נבחרו ${count} פריטים להעברה` : undefined}
            currentFolderId={moveModalState.currentFolderId}
            folders={availableFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId }))}
            onClose={() => setMoveModalState(null)}
            onConfirmMove={handleConfirmMoveItems}
            rootLabel="תיקייה ראשית (ללא תיקייה)"
            rootDescription="ברמה הראשית של שיתוף הקבצים"
          />
        );
      })()}

      {/* BATCH DELETE CONFIRM MODAL */}
      <ConfirmModal
        isOpen={batchDeleteConfirm}
        title="מחיקת פריטים נבחרים"
        message={`האם אתה בטוח שברצונך למחוק ${selectedItemIds.length} פריטים נבחרים? פעולה זו תמחק גם את כל הקבצים שבתוך תיקיות שנבחרו.`}
        confirmText="מחק פריטים"
        onConfirm={handleConfirmBatchDelete}
        onClose={() => setBatchDeleteConfirm(false)}
      />

      {/* 7. NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: 'rtl'
          }}
          onClick={() => setShowNewFolderModal(false)}
        >
          <div 
            style={{
              background: 'var(--bg-card, #ffffff)',
              width: '100%',
              maxWidth: '380px',
              borderRadius: '24px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              📁 יצירת תיקייה חדשה
            </h3>

            <input
              type="text"
              placeholder="שם התיקייה..."
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder();
              }}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '12px',
                border: '1.5px solid var(--primary)',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                style={{ flex: 1.5, padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: '#ffffff', cursor: 'pointer', fontWeight: 800 }}
              >
                צור תיקייה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. IMPORT EXISTING FILE MODAL (Zero Storage Duplication) */}
      <ImportExistingFileModal
        isOpen={showImportModal}
        currentSpaceId={space.id}
        currentFolderId={currentFolderId}
        onClose={() => setShowImportModal(false)}
        onImport={async (importedItem) => {
          const next = [...allItems, importedItem];
          await saveItems(next);
        }}
      />

      {/* 9. UNIVERSAL VIEWER FOR IN-APP PREVIEW */}
      {previewState && (
        <UniversalViewerModal
          docs={previewState.docs}
          initialIndex={previewState.index}
          onClose={() => setPreviewState(null)}
        />
      )}

      {/* 10. GLOBAL RECYCLE BIN MODAL (Single Source of Truth) */}
      {showRecycleBin && (
        <GlobalRecycleBinModal
          isOpen={showRecycleBin}
          onClose={() => setShowRecycleBin(false)}
          items={deletedItems.map(item => {
            const parentF = item.parentId ? allItems.find(p => p.id === item.parentId) : null;
            const origin = parentF ? `שיתוף קבצים / תיקיית "${parentF.name}"` : 'שיתוף קבצים / ראשי';
            return {
              id: item.id,
              name: item.name,
              type: item.type === 'folder' ? 'folder' : 'file',
              originLocation: origin,
              deletedAt: item.deletedAt,
              thumbnailUrl: item.thumbnailUrl,
              url: item.url,
              pages: item.pages,
              rawItem: item
            };
          })}
          onRestore={handleRestoreItem}
          onPermanentDelete={handlePermanentDeleteItem}
          onPreviewItem={(item) => {
            if (item.url) {
              setPreviewState({
                docs: [{
                  id: item.id,
                  url: item.url,
                  title: item.name,
                  pages: item.pages || [item.url]
                }],
                index: 0
              });
            }
          }}
        />
      )}
    </div>
  );
}
