'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db, uploadBlobToStorage, uploadImageToStorage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { FileShareItem, formatFileSize, ShareLinkConfig, revokePublicShare } from '@/utils/fileShareUtils';
import { FileShareItemCard } from './FileShareItemCard';
import { CreateShareLinkModal } from './CreateShareLinkModal';
import { ImportExistingFileModal } from './ImportExistingFileModal';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';

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

  // raw items from space
  const allItems: FileShareItem[] = useMemo(() => {
    return Array.isArray(space?.fileShareItems) ? space.fileShareItems : [];
  }, [space?.fileShareItems]);

  const isCreator = space.creatorId === user?.id || (user?.email && space.creatorEmail === user.email);
  const currentUserId = user?.id || '';

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

    return () => {
      window.removeEventListener('smartshare:add_folder', handleAddFolder);
      window.removeEventListener('smartshare:fileshare_add_folder', handleAddFolder);
      window.removeEventListener('smartshare:fileshare_upload', handleUpload);
      window.removeEventListener('smartshare:fileshare_import', handleImport);
    };
  }, []);

  // Breadcrumbs path computation
  const breadcrumbTrail = useMemo(() => {
    const trail: { id: string | null; name: string }[] = [{ id: null, name: 'ראשי' }];
    let currId = currentFolderId;
    const visited = new Set<string>();

    const path: { id: string | null; name: string }[] = [];
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const parentFolder = allItems.find(i => i.id === currId && i.type === 'folder');
      if (parentFolder) {
        path.unshift({ id: parentFolder.id, name: parentFolder.name });
        currId = parentFolder.parentId;
      } else {
        break;
      }
    }
    return [...trail, ...path];
  }, [currentFolderId, allItems]);

  // Current folder's items filtered by access and search
  const visibleItems = useMemo(() => {
    return allItems.filter(item => {
      // 1. Must match current folder
      if (item.parentId !== currentFolderId) return false;

      // 2. Permission check (Rule 20: default open to all members, unless restricted)
      if (Array.isArray(item.allowedPartners) && item.allowedPartners.length > 0) {
        if (item.allowedPartners.includes('__creator_vault_secret__')) {
          if (!isCreator) return false;
        } else if (item.allowedPartners.includes('__only_me__')) {
          if (item.createdBy !== currentUserId && !isCreator) return false;
        } else {
          // Specific partners list
          if (!isCreator && currentUserId && !item.allowedPartners.includes(currentUserId) && item.createdBy !== currentUserId) {
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
  const saveItems = async (updatedItems: FileShareItem[]) => {
    try {
      const spaceRef = doc(db, 'spaces', space.id);
      await updateDoc(spaceRef, { fileShareItems: updatedItems });
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

  // Delete item
  const handleDeleteItem = async (item: FileShareItem) => {
    const isFolder = item.type === 'folder';
    const confirmMsg = isFolder
      ? `האם למחוק את התיקייה "${item.name}" ואת כל הקבצים שבתוכה?`
      : `האם למחוק את הקובץ "${item.name}"?`;

    if (!confirm(confirmMsg)) return;

    if (item.shareLink?.token) {
      await revokePublicShare(item.shareLink.token);
    }

    if (isFolder) {
      // Recursively remove folder and all children
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
    } else {
      const next = allItems.filter(i => i.id !== item.id);
      await saveItems(next);
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
    await saveItems(next);
  };

  // Save partner permissions
  const handleSavePrivacy = async () => {
    if (!privacyItem) return;
    const next = allItems.map(i => {
      if (i.id === privacyItem.id) {
        return {
          ...i,
          allowedPartners: selectedAllowedPartners
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
              <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                v3.4.65
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              פורטל שיתוף תיקיות ומסמכים מאובטח בקישורים חיצוניים
            </p>
          </div>
        </div>

        {/* Global Stats Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.74rem', background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-light)', padding: '3px 9px', borderRadius: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            {folders.length} תיקיות • {files.length} קבצים
          </span>
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
            return (
              <React.Fragment key={crumb.id || 'root'}>
                {idx > 0 && <span style={{ color: 'var(--text-secondary)' }}>/</span>}
                <span
                  onClick={() => !isLast && setCurrentFolderId(crumb.id)}
                  style={{
                    color: isLast ? 'var(--text-primary)' : 'var(--primary)',
                    fontWeight: isLast ? 800 : 600,
                    cursor: isLast ? 'default' : 'pointer',
                    textDecoration: isLast ? 'none' : 'underline'
                  }}
                >
                  {crumb.id === null ? '🏠 ראשי' : `📁 ${crumb.name}`}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

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

      {/* 4. ITEMS LIST (FOLDERS FIRST, THEN FILES) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {/* FOLDERS SECTION */}
        {folders.map(folder => (
          <FileShareItemCard
            key={folder.id}
            item={folder}
            onOpen={handleOpenItem}
            onManageLink={item => setActiveShareItem(item)}
            onManagePermissions={item => {
              setPrivacyItem(item);
              setSelectedAllowedPartners(item.allowedPartners || []);
            }}
            onDelete={handleDeleteItem}
          />
        ))}

        {/* FILES SECTION */}
        {files.map(file => (
          <FileShareItemCard
            key={file.id}
            item={file}
            onOpen={handleOpenItem}
            onManageLink={item => setActiveShareItem(item)}
            onManagePermissions={item => {
              setPrivacyItem(item);
              setSelectedAllowedPartners(item.allowedPartners || []);
            }}
            onDelete={handleDeleteItem}
          />
        ))}

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
        item={activeShareItem}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto' }}>
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
                  onChange={() => setSelectedAllowedPartners([])}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>🌐 פתוח לכל חברי המרחב (ברירת מחדל)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>כל מי שיש לו גישה למרחב יכול לצפות בפריט זה</div>
                </div>
              </label>

              {/* Option 2: 👤 Only Me */}
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
                  onChange={() => setSelectedAllowedPartners(['__only_me__'])}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>👤 רק לעצמי (פרטי לחלוטין)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>רק אתה תוכל לצפות בפריט זה</div>
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
                  onChange={() => setSelectedAllowedPartners(['__creator_vault_secret__'])}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ color: 'var(--text-primary)' }}>🛡️ מנהלי המרחב בלבד</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>גישה ליוצר ומנהלי המרחב בלבד</div>
                </div>
              </label>

              {/* Option 4: Specific Members / Partners (if any exist) */}
              {activePartners.length > 0 && (
                <div style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    🔒 או הגבל לחברים / שותפים ספציפיים:
                  </div>
                  {activePartners.map((m: any) => {
                    const partnerId = m.userId || m.id;
                    const isChecked = selectedAllowedPartners.includes(partnerId);
                    return (
                      <label 
                        key={partnerId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.8rem',
                          background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedAllowedPartners(prev => prev.filter(id => id !== partnerId));
                            } else {
                              setSelectedAllowedPartners(prev => [
                                ...prev.filter(id => id !== '__only_me__' && id !== '__creator_vault_secret__'),
                                partnerId
                              ]);
                            }
                          }}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span>{m.name || m.email || 'חבר מרחב'} {m.role === 'creator' ? '(יוצר המרחב)' : ''}</span>
                      </label>
                    );
                  })}
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
    </div>
  );
}
