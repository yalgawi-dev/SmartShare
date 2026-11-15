'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSpaces } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';
import { FileShareItem } from '@/utils/fileShareUtils';

export interface ExportableFilePayload {
  name: string;
  url: string;
  size?: number;
  type?: string;
  thumbnailUrl?: string;
  isInvoice?: boolean;
}

interface ExportToSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: ExportableFilePayload | null;
  currentSpaceId?: string;
  onSuccess?: (targetSpaceName: string) => void;
}

interface FolderOption {
  id: string;
  name: string;
  parentId?: string | null;
}

export const ExportToSpaceModal: React.FC<ExportToSpaceModalProps> = ({
  isOpen,
  onClose,
  file,
  currentSpaceId,
  onSuccess,
}) => {
  const { spaces, updateFileShareItems, addInvoice } = useSpaces();
  const { user } = useAuth();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [targetKind, setTargetKind] = useState<'document' | 'invoice'>('document');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'ראשי' },
  ]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Authorized spaces calculation (Single Source of Truth, identical to ImportExistingFileModal)
  const isAuthorizedMemberOfSpace = useMemo(() => {
    return (s: any): boolean => {
      if (!s || s.status === 'pending_deletion' || s.id === '__global_announcement__') return false;
      if (!user?.id) return false;

      // 1. Direct creator
      if (s.creatorId && user.id === s.creatorId) return true;
      if (user.spaceKeys?.[s.id]?.role === 'creator') return true;

      // 2. Explicit active member in space.members
      if (Array.isArray(s.members) && s.members.length > 0) {
        const m = s.members.find((mem: any) => mem && (mem.userId === user.id || (mem.userId && user.spaceKeys?.[s.id]?.token === mem.userId)));
        if (m && m.status !== 'removed' && m.isActive !== false) {
          return true;
        }
      }

      // 3. Authenticated partner key
      const partnerKey = user.spaceKeys?.[s.id];
      if (partnerKey && (partnerKey.role === 'creator' || partnerKey.role === 'partner' || partnerKey.role === 'admin')) {
        if (Array.isArray(s.members)) {
          const m = s.members.find((mem: any) => mem && (mem.userId === user.id || mem.userId === partnerKey.token));
          if (m && (m.status === 'removed' || m.isActive === false)) return false;
        }
        return true;
      }

      return false;
    };
  }, [user?.id, user?.spaceKeys]);

  const availableSpaces = useMemo(() => {
    if (!Array.isArray(spaces)) return [];
    const list = spaces.filter(s => isAuthorizedMemberOfSpace(s));
    // Sort: file-sharing spaces first, then others, prioritizing other spaces over currentSpaceId
    return list.sort((a, b) => {
      const aShare = (a.title && a.title.includes('שיתוף')) || a.icon === '📁' ? -1 : 0;
      const bShare = (b.title && b.title.includes('שיתוף')) || b.icon === '📁' ? -1 : 0;
      if (aShare !== bShare) return aShare - bShare;
      if (a.id === currentSpaceId) return 1;
      if (b.id === currentSpaceId) return -1;
      return 0;
    });
  }, [spaces, currentSpaceId, isAuthorizedMemberOfSpace]);

  // Set default selected space when modal opens or spaces load
  useEffect(() => {
    if (!isOpen) return;
    if (availableSpaces.length > 0) {
      if (!selectedSpaceId || !availableSpaces.some(s => s.id === selectedSpaceId)) {
        const defaultSpace = availableSpaces.find(s => s.id !== currentSpaceId) || availableSpaces[0];
        setSelectedSpaceId(defaultSpace.id);
      }
    }
  }, [isOpen, availableSpaces, selectedSpaceId, currentSpaceId]);

  // Reset folder navigation when target space changes
  useEffect(() => {
    setCurrentFolderId(null);
    setFolderPath([{ id: null, name: 'ראשי' }]);
    setIsCreatingFolder(false);
    setNewFolderName('');
    setErrorMsg('');
  }, [selectedSpaceId, targetKind]);

  const targetSpace = useMemo(() => {
    return availableSpaces.find(s => s.id === selectedSpaceId) || null;
  }, [availableSpaces, selectedSpaceId]);

  // Folders inside target space (from targetSpace.fileShareItems)
  const targetSpaceFolders = useMemo<FolderOption[]>(() => {
    if (!targetSpace || !Array.isArray(targetSpace.fileShareItems)) return [];
    return targetSpace.fileShareItems
      .filter((i: any) => i && i.type === 'folder' && !i.deletedAt)
      .map((f: any) => ({
        id: String(f.id),
        name: f.name || 'תיקייה',
        parentId: f.parentId ? String(f.parentId) : null,
      }));
  }, [targetSpace]);

  const visibleFolders = useMemo(() => {
    return targetSpaceFolders.filter(f => (f.parentId || null) === currentFolderId);
  }, [targetSpaceFolders, currentFolderId]);

  if (!isOpen || !file) return null;

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !selectedSpaceId || !targetSpace) return;
    try {
      const newFolderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newFolderItem: FileShareItem = {
        id: newFolderId,
        spaceId: selectedSpaceId,
        name: trimmed,
        type: 'folder',
        parentId: currentFolderId,
        createdAt: Date.now(),
        createdBy: user?.id || 'user',
        creatorName: user?.realName || user?.nickname || 'שותף',
        allowedPartners: [],
      };

      const existingItems: FileShareItem[] = Array.isArray(targetSpace.fileShareItems)
        ? [...targetSpace.fileShareItems]
        : [];
      const updatedItems = [...existingItems, newFolderItem];

      await updateFileShareItems(selectedSpaceId, updatedItems);

      // Navigate immediately into the newly created folder
      setCurrentFolderId(newFolderId);
      setFolderPath((prev) => [...prev, { id: newFolderId, name: trimmed }]);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      console.error('Failed creating folder:', err);
      setErrorMsg('שגיאה ביצירת התיקייה');
    }
  };

  const handleConfirm = async () => {
    if (!selectedSpaceId || !targetSpace || !file) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      if (targetKind === 'document') {
        const newFileItem: FileShareItem = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          spaceId: selectedSpaceId,
          name: file.name,
          type: 'file',
          url: file.url,
          size: file.size || 0,
          fileType: (file.type === 'pdf' || (file.url && file.url.toLowerCase().includes('.pdf'))) ? 'pdf' : 'image',
          thumbnailUrl: file.thumbnailUrl || (file.type !== 'pdf' ? file.url : undefined),
          parentId: currentFolderId,
          createdAt: Date.now(),
          createdBy: user?.id || 'user',
          creatorName: user?.realName || user?.nickname || 'שותף',
          allowedPartners: [],
        };

        const existingItems: FileShareItem[] = Array.isArray(targetSpace.fileShareItems)
          ? [...targetSpace.fileShareItems]
          : [];
        const updatedItems = [...existingItems, newFileItem];

        await updateFileShareItems(selectedSpaceId, updatedItems);
      } else {
        // Save as Invoice / Expense in target space
        addInvoice(selectedSpaceId, {
          title: file.name,
          vendor: file.name,
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          category: 'כללי',
          files: file.url ? [{
            id: `inv_file_${Date.now()}`,
            name: file.name,
            url: file.url,
            type: file.type || 'application/pdf',
            size: file.size || 0,
          }] : [],
          status: 'pending',
          paymentStatus: 'unpaid',
          notes: 'הועבר ממרחב אחר',
          createdAt: new Date().toISOString(),
          addedBy: user?.id || 'user',
          uploaderName: user?.realName || user?.nickname || 'משתמש',
        } as any);
      }

      const targetTitle = targetSpace.title || 'המרחב';
      onSuccess?.(targetTitle);
      onClose();
    } catch (err) {
      console.error('Failed exporting file to space:', err);
      setErrorMsg('שגיאה בהעברת הקובץ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🗂️</span>
            <span>העברה למרחב אחר</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#475569', background: '#f8fafc', padding: '9px 12px', borderRadius: '10px', marginBottom: '14px', wordBreak: 'break-word', border: '1px solid #f1f5f9' }}>
          קובץ: <strong style={{ color: '#0f172a' }}>{file.name}</strong>
        </div>

        {/* 1. Target Space */}
        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>
          1. בחר מרחב יעד:
        </label>
        {availableSpaces.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>לא נמצאו מרחבים זמינים</div>
        ) : (
          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1.5px solid #cbd5e1',
              marginBottom: '14px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: '#fff',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {availableSpaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon || '📁'} {s.title || 'מרחב ללא שם'} {s.id === currentSpaceId ? '(המרחב הנוכחי)' : ''}
              </option>
            ))}
          </select>
        )}

        {/* 2. Document vs Invoice */}
        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>
          2. שמור בתור:
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => setTargetKind('document')}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: '12px',
              border: targetKind === 'document' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: targetKind === 'document' ? '#eff6ff' : '#fff',
              color: targetKind === 'document' ? '#1d4ed8' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.84rem',
              transition: 'all 0.15s ease',
            }}
          >
            📄 מסמך / קובץ
          </button>
          <button
            type="button"
            onClick={() => setTargetKind('invoice')}
            style={{
              flex: 1,
              padding: '9px',
              borderRadius: '12px',
              border: targetKind === 'invoice' ? '2px solid #059669' : '1px solid #cbd5e1',
              background: targetKind === 'invoice' ? '#ecfdf5' : '#fff',
              color: targetKind === 'invoice' ? '#047857' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.84rem',
              transition: 'all 0.15s ease',
            }}
          >
            🧾 חשבונית / הוצאה
          </button>
        </div>

        {/* 3. Folder Navigation + New Folder */}
        {targetKind === 'document' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700 }}>3. תיקיית יעד:</label>
              <button
                type="button"
                onClick={() => setIsCreatingFolder((v) => !v)}
                style={{
                  background: isCreatingFolder ? '#fee2e2' : '#eff6ff',
                  color: isCreatingFolder ? '#dc2626' : '#2563eb',
                  border: isCreatingFolder ? '1px solid #fca5a5' : '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isCreatingFolder ? '✕ ביטול' : '➕ תיקייה חדשה'}
              </button>
            </div>

            {/* Breadcrumbs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '0.78rem', marginBottom: '8px' }}>
              {folderPath.map((crumb, idx) => (
                <button
                  key={crumb.id || 'root'}
                  type="button"
                  onClick={() => {
                    setCurrentFolderId(crumb.id);
                    setFolderPath((prev) => prev.slice(0, idx + 1));
                  }}
                  style={{
                    background: idx === folderPath.length - 1 ? '#2563eb' : '#f1f5f9',
                    color: idx === folderPath.length - 1 ? '#fff' : '#334155',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontWeight: idx === folderPath.length - 1 ? 800 : 500,
                  }}
                >
                  {crumb.name} {idx < folderPath.length - 1 ? '‹' : ''}
                </button>
              ))}
            </div>

            {isCreatingFolder && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateFolder();
                    }
                  }}
                  placeholder="שם תיקייה חדשה..."
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #3b82f6',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  style={{
                    background: newFolderName.trim() ? '#2563eb' : '#94a3b8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0 14px',
                    fontWeight: 700,
                    cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.84rem',
                  }}
                >
                  צור
                </button>
              </div>
            )}

            <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '4px', background: '#f8fafc' }}>
              {visibleFolders.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                  יישמר בתיקייה: <strong>{folderPath[folderPath.length - 1]?.name}</strong>
                </div>
              ) : (
                visibleFolders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setCurrentFolderId(f.id);
                      setFolderPath((prev) => [...prev, { id: f.id, name: f.name }]);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'right',
                      padding: '8px 12px',
                      background: '#fff',
                      borderRadius: '8px',
                      marginBottom: '3px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: '#1e293b',
                    }}
                  >
                    <span>📁 {f.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>‹</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '10px', fontWeight: 600, background: '#fef2f2', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          disabled={isSaving || !selectedSpaceId}
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '14px',
            border: 'none',
            background: isSaving ? '#94a3b8' : '#2563eb',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.94rem',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            boxShadow: isSaving ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
          }}
        >
          {isSaving ? 'מעביר...' : '🗂️ העבר למרחב הנבחר'}
        </button>
      </div>
    </div>
  );
};
