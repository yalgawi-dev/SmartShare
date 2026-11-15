'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

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

interface SpaceOption {
  id: string;
  name: string;
  icon?: string;
  type?: string;
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
  const user = auth.currentUser;
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [targetKind, setTargetKind] = useState<'document' | 'invoice'>('document');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'ראשי' },
  ]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load user's spaces
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    let active = true;
    setIsLoadingSpaces(true);
    setErrorMsg('');

    const loadSpaces = async () => {
      try {
        const q = query(collection(db, 'spaces'), where('members', 'array-contains', user.uid));
        const snap = await getDocs(q);
        const list: SpaceOption[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'מרחב ללא שם',
          icon: d.data().icon || '📁',
          type: d.data().type || '',
        }));
        // Sort so file-sharing spaces appear first
        list.sort((a, b) => {
          const aShare = a.name.includes('שיתוף') || a.type === 'file_share' ? -1 : 0;
          const bShare = b.name.includes('שיתוף') || b.type === 'file_share' ? -1 : 0;
          return aShare - bShare;
        });
        if (active) {
          setSpaces(list);
          const firstOther = list.find((s) => s.id !== currentSpaceId) || list[0];
          if (firstOther) setSelectedSpaceId(firstOther.id);
        }
      } catch (err) {
        console.error('Failed loading spaces:', err);
        if (active) setErrorMsg('שגיאה בטעינת המרחבים');
      } finally {
        if (active) setIsLoadingSpaces(false);
      }
    };

    loadSpaces();
    return () => {
      active = false;
    };
  }, [isOpen, user?.uid, currentSpaceId]);

  // Load folders for selected space
  useEffect(() => {
    if (!isOpen || !selectedSpaceId || targetKind !== 'document') {
      setFolders([]);
      return;
    }
    let active = true;
    const loadFolders = async () => {
      try {
        const q = query(
          collection(db, 'file_share_folders'),
          where('spaceId', '==', selectedSpaceId)
        );
        const snap = await getDocs(q);
        if (active) {
          setFolders(
            snap.docs.map((d) => ({
              id: d.id,
              name: d.data().name || 'תיקייה',
              parentId: d.data().parentId || null,
            }))
          );
          setCurrentFolderId(null);
          setFolderPath([{ id: null, name: 'ראשי' }]);
        }
      } catch (err) {
        console.error('Failed loading folders:', err);
      }
    };
    loadFolders();
    return () => {
      active = false;
    };
  }, [isOpen, selectedSpaceId, targetKind]);

  if (!isOpen || !file) return null;

  const visibleFolders = folders.filter((f) => (f.parentId || null) === currentFolderId);

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !selectedSpaceId || !user?.uid) return;
    try {
      const docRef = await addDoc(collection(db, 'file_share_folders'), {
        spaceId: selectedSpaceId,
        name: trimmed,
        parentId: currentFolderId,
        createdAt: Date.now(),
        createdBy: user.uid,
        isPublicToSpace: true,
      });
      const created: FolderOption = { id: docRef.id, name: trimmed, parentId: currentFolderId };
      setFolders((prev) => [...prev, created]);
      setCurrentFolderId(docRef.id);
      setFolderPath((prev) => [...prev, { id: docRef.id, name: trimmed }]);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      console.error('Failed creating folder:', err);
      setErrorMsg('שגיאה ביצירת תיקייה');
    }
  };

  const handleConfirm = async () => {
    if (!selectedSpaceId || !user?.uid || !file) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      if (targetKind === 'document') {
        await addDoc(collection(db, 'file_share_items'), {
          spaceId: selectedSpaceId,
          folderId: currentFolderId,
          name: file.name,
          url: file.url,
          size: file.size || 0,
          type: file.type || 'application/octet-stream',
          thumbnailUrl: file.thumbnailUrl || null,
          createdAt: Date.now(),
          createdBy: user.uid,
          creatorName: user.displayName || user.email || 'משתמש',
          isPublicToSpace: true,
        });
      } else {
        await addDoc(collection(db, 'expenses'), {
          spaceId: selectedSpaceId,
          description: file.name,
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          category: 'כללי',
          receiptUrl: file.url,
          createdAt: Date.now(),
          createdBy: user.uid,
          status: 'pending',
        });
      }
      const spaceName = spaces.find((s) => s.id === selectedSpaceId)?.name || 'המרחב';
      onSuccess?.(spaceName);
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
          borderRadius: '18px',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: '20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
            🗂️ העברה למרחב אחר
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#475569', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', marginBottom: '14px', wordBreak: 'break-word' }}>
          קובץ: <strong>{file.name}</strong>
        </div>

        {/* 1. Target Space */}
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
          1. בחר מרחב יעד:
        </label>
        {isLoadingSpaces ? (
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>טוען מרחבים...</div>
        ) : (
          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              marginBottom: '14px',
              fontSize: '0.88rem',
              background: '#fff',
            }}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
        )}

        {/* 2. Document vs Invoice */}
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
          2. שמור בתור:
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button
            type="button"
            onClick={() => setTargetKind('document')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              border: targetKind === 'document' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: targetKind === 'document' ? '#eff6ff' : '#fff',
              color: targetKind === 'document' ? '#1d4ed8' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            📄 מסמך / קובץ
          </button>
          <button
            type="button"
            onClick={() => setTargetKind('invoice')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              border: targetKind === 'invoice' ? '2px solid #059669' : '1px solid #cbd5e1',
              background: targetKind === 'invoice' ? '#ecfdf5' : '#fff',
              color: targetKind === 'invoice' ? '#047857' : '#334155',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            🧾 חשבונית / הוצאה
          </button>
        </div>

        {/* 3. Folder Navigation + New Folder */}
        {targetKind === 'document' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>3. תיקיית יעד:</label>
              <button
                type="button"
                onClick={() => setIsCreatingFolder((v) => !v)}
                style={{
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ➕ תיקייה חדשה
              </button>
            </div>

            {/* Breadcrumbs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '0.75rem', marginBottom: '8px' }}>
              {folderPath.map((crumb, idx) => (
                <button
                  key={crumb.id || 'root'}
                  type="button"
                  onClick={() => {
                    setCurrentFolderId(crumb.id);
                    setFolderPath((prev) => prev.slice(0, idx + 1));
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '2px 7px',
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
                  placeholder="שם תיקייה חדשה..."
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid #93c5fd',
                    fontSize: '0.82rem',
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  צור
                </button>
              </div>
            )}

            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '4px' }}>
              {visibleFolders.length === 0 ? (
                <div style={{ padding: '10px', textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                  יישמר בתיקייה הנוכחית ({folderPath[folderPath.length - 1]?.name})
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
                      padding: '7px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>📁 {f.name}</span>
                    <span style={{ color: '#94a3b8' }}>‹</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '10px', fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          disabled={isSaving || !selectedSpaceId}
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: '12px',
            border: 'none',
            background: isSaving ? '#94a3b8' : '#2563eb',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'מעביר...' : '🗂️ העבר למרחב הנבחר'}
        </button>
      </div>
    </div>
  );
};
