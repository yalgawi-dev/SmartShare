'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSpaces } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';
import { APP_VERSION } from '@/constants/version';

export interface FolderTargetItem {
  id: string;
  name: string;
  parentId?: string | null;
  shelfId?: string | null;
}

export interface ShelfTargetItem {
  id: string;
  name: string;
  icon?: string;
  highlightColor?: string;
}

export interface GlobalMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  itemCount: number;
  currentFolderId?: string | null;
  currentShelfId?: string | null;
  currentSpaceId?: string;
  isShelfTransfer?: boolean;
  canCopy?: boolean;
  shelves?: ShelfTargetItem[];
  folders: FolderTargetItem[];
  onConfirmMove: (targetFolderId: string | null, targetShelfId?: string, actionType?: 'copy' | 'move') => Promise<void> | void;
  onConfirmCrossSpace?: (targetSpaceId: string, targetShelfId: string | null, targetFolderId: string | null, actionType: 'copy' | 'move') => Promise<void> | void;
  onCreateSubfolder?: (name: string, parentId: string | null, shelfId?: string | null) => Promise<string | void> | string | void;
  rootLabel?: string;
  rootDescription?: string;
}

export const GlobalMoveModal: React.FC<GlobalMoveModalProps> = ({
  isOpen,
  onClose,
  subtitle,
  currentFolderId,
  currentShelfId,
  currentSpaceId,
  isShelfTransfer = false,
  canCopy = true,
  shelves,
  folders,
  onConfirmMove,
  onConfirmCrossSpace,
}) => {
  const { spaces } = useSpaces();
  const { user } = useAuth();

  // 1. Action type: העברה vs העתקה
  const [actionType, setActionType] = useState<'move' | 'copy'>('move');

  // 2. Space selection: ברירת מחדל היא המרחב הנוכחי!
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(currentSpaceId || '');

  // 3. Shelf selection (if space has shelves / themes)
  const [selectedShelfId, setSelectedShelfId] = useState<string>(currentShelfId || '');

  // 4. Current selected target folder
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // 5. Expanded folders set (Windows Explorer style tree toggle)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // Authorized spaces calculation
  const isAuthorizedMemberOfSpace = useMemo(() => {
    return (s: any): boolean => {
      if (!s || s.status === 'pending_deletion' || s.id === '__global_announcement__') return false;
      if (!user?.id) return false;
      if (s.creatorId && user.id === s.creatorId) return true;
      if (user.spaceKeys?.[s.id]?.role === 'creator') return true;
      if (Array.isArray(s.members) && s.members.length > 0) {
        const m = s.members.find((mem: any) => mem && (mem.userId === user.id || (mem.userId && user.spaceKeys?.[s.id]?.token === mem.userId)));
        if (m && m.status !== 'removed' && m.isActive !== false) return true;
      }
      const partnerKey = user.spaceKeys?.[s.id];
      if (partnerKey && (partnerKey.role === 'creator' || partnerKey.role === 'partner' || (partnerKey.role as string) === 'admin')) {
        return true;
      }
      return false;
    };
  }, [user?.id, user?.spaceKeys]);

  const availableSpaces = useMemo(() => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter(s => isAuthorizedMemberOfSpace(s));
  }, [spaces, isAuthorizedMemberOfSpace]);

  // Selected space object
  const activeSpaceObj = useMemo(() => {
    return availableSpaces.find(s => s.id === selectedSpaceId) || null;
  }, [availableSpaces, selectedSpaceId]);

  const isCurrentSpace = selectedSpaceId === currentSpaceId;

  // Active shelves in the selected space - sorted so current shelf appears FIRST!
  const availableShelves = useMemo(() => {
    let rawShelves: ShelfTargetItem[] = [];
    if (isCurrentSpace && Array.isArray(shelves) && shelves.length > 0) {
      rawShelves = shelves;
    } else if (activeSpaceObj && Array.isArray(activeSpaceObj.shelves) && activeSpaceObj.shelves.length > 0) {
      rawShelves = activeSpaceObj.shelves;
    }

    if (!rawShelves.length) return [];

    // Sort: currentShelfId first
    return [...rawShelves].sort((a, b) => {
      if (a.id === currentShelfId) return -1;
      if (b.id === currentShelfId) return 1;
      return 0;
    });
  }, [isCurrentSpace, shelves, activeSpaceObj, currentShelfId]);

  const hasShelves = availableShelves.length > 0;

  // Selected shelf object name
  const currentShelfObj = useMemo(() => {
    return availableShelves.find(s => s.id === selectedShelfId) || null;
  }, [availableShelves, selectedShelfId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSpaceId(currentSpaceId || (availableSpaces[0]?.id || ''));
      setSelectedShelfId(currentShelfId || (hasShelves ? availableShelves[0].id : ''));
      setSelectedFolderId(null);
      setActionType('move');
      // Auto-expand all folders so user sees the tree clearly
      const allIds = new Set<string>();
      folders.forEach(f => allIds.add(String(f.id)));
      setExpandedFolderIds(allIds);
    }
  }, [isOpen, currentSpaceId, currentShelfId, hasShelves, folders]);

  // When selected space changes, update shelf
  useEffect(() => {
    if (isCurrentSpace) {
      setSelectedShelfId(currentShelfId || (hasShelves ? availableShelves[0].id : ''));
    } else {
      setSelectedShelfId(hasShelves ? availableShelves[0].id : '');
    }
    setSelectedFolderId(null);
  }, [selectedSpaceId]);

  // Folders for active space & selected shelf
  const activeSpaceFolders = useMemo<FolderTargetItem[]>(() => {
    let pool: FolderTargetItem[] = [];
    if (isCurrentSpace) {
      pool = folders;
    } else if (activeSpaceObj) {
      const docFolders = (activeSpaceObj.documentFolders || [])
        .filter((f: any) => !f.deletedAt)
        .map((f: any) => ({
          id: String(f.id),
          name: f.name || 'תיקייה',
          parentId: f.parentId ? String(f.parentId) : null,
          shelfId: f.shelfId ? String(f.shelfId) : null,
        }));
      const fileFolders = (activeSpaceObj.fileShareItems || [])
        .filter((i: any) => i && i.type === 'folder' && !i.deletedAt)
        .map((f: any) => ({
          id: String(f.id),
          name: f.name || 'תיקייה',
          parentId: f.parentId ? String(f.parentId) : null,
          shelfId: null,
        }));
      pool = [...docFolders, ...fileFolders];
    }

    if (hasShelves && selectedShelfId) {
      return pool.filter(f => !f.shelfId || f.shelfId === selectedShelfId);
    }
    return pool;
  }, [isCurrentSpace, folders, activeSpaceObj, hasShelves, selectedShelfId]);

  const normId = (id?: string | null) => (id && String(id).trim().length > 0 ? String(id).trim() : null);
  const activeCurrentFolderId = normId(currentFolderId);

  // Check if chosen destination is identical to origin
  const isSameShelf = !hasShelves || selectedShelfId === currentShelfId;
  const isDestinationSameAsOrigin = isCurrentSpace && isSameShelf && normId(selectedFolderId) === activeCurrentFolderId;

  // Toggle folder open/close
  const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isDestinationSameAsOrigin && actionType === 'move') return;

    if (isCurrentSpace) {
      // In current space
      await onConfirmMove(selectedFolderId, hasShelves ? selectedShelfId : undefined, actionType);
      onClose();
    } else {
      // Cross space transfer
      if (onConfirmCrossSpace) {
        const targetShelf = hasShelves ? selectedShelfId : null;
        await onConfirmCrossSpace(selectedSpaceId, targetShelf, selectedFolderId, actionType);
        onClose();
      }
    }
  };

  // Build recursive Windows Explorer style tree
  const renderFolderBranch = (parentId: string | null, depth: number) => {
    const children = activeSpaceFolders.filter(f => normId(f.parentId) === parentId);
    if (children.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {children.map(folder => {
          const folderId = String(folder.id);
          const hasChildren = activeSpaceFolders.some(f => normId(f.parentId) === folderId);
          const isExpanded = expandedFolderIds.has(folderId);
          const isSelected = normId(selectedFolderId) === folderId;
          const isCurrentOrigin = isCurrentSpace && isSameShelf && folderId === activeCurrentFolderId;
          const indentPx = depth * 20;

          return (
            <div key={folderId} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                onClick={() => setSelectedFolderId(folderId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  marginRight: `${indentPx}px`,
                  borderRadius: '10px',
                  background: isSelected ? '#eff6ff' : isCurrentOrigin ? '#fffbeb' : '#ffffff',
                  border: isSelected ? '1.5px solid #2563eb' : isCurrentOrigin ? '1.5px dashed #f59e0b' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {/* Expand / Collapse Chevron */}
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => toggleFolderExpand(folderId, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        fontSize: '0.85rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease'
                      }}
                      title={isExpanded ? 'סגור תיקייה' : 'פתח תיקייה'}
                    >
                      ◀
                    </button>
                  ) : (
                    <span style={{ width: '16px' }} />
                  )}

                  <span style={{ fontSize: '1.1rem' }}>{isExpanded ? '📂' : '📁'}</span>
                  <span style={{
                    fontSize: '0.86rem',
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? '#1d4ed8' : '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {folder.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isCurrentOrigin && (
                    <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', padding: '1px 6px', borderRadius: '5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      אתה כאן
                    </span>
                  )}
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: isSelected ? '5px solid #2563eb' : '2px solid #cbd5e1',
                    background: '#fff'
                  }} />
                </div>
              </div>

              {/* Recursive child branches if expanded */}
              {hasChildren && isExpanded && (
                <div style={{ marginTop: '3px' }}>
                  {renderFolderBranch(folderId, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const isRootSelected = selectedFolderId === null;
  const isRootCurrentOrigin = isCurrentSpace && isSameShelf && activeCurrentFolderId === null;

  // Clear label for the base shelf / root level
  const rootDisplayLabel = currentShelfObj 
    ? `רמה ראשית (בסיס נושא "${currentShelfObj.name}")` 
    : 'רמה ראשית (ללא תיקייה)';

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
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '430px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          color: '#0f172a',
        }}
      >
        {/* 1. Clean Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.2rem' }}>{actionType === 'move' ? '📦' : '📋'}</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              העברה / הדבקה
            </h3>
            <span style={{ fontSize: '0.62rem', background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '6px', fontWeight: 800, border: '1px solid #bfdbfe' }}>
              {APP_VERSION}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#475569',
            }}
          >
            ✕
          </button>
        </div>

        {/* 2. What was selected to move */}
        {subtitle && (
          <div style={{ fontSize: '0.82rem', color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
            נבחר: <strong style={{ color: '#0f172a' }}>{subtitle}</strong>
          </div>
        )}

        {/* 3. Action Buttons: העברה vs העתקה */}
        {canCopy && (
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '12px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActionType('move')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '9px',
                border: 'none',
                background: actionType === 'move' ? '#ffffff' : 'transparent',
                color: actionType === 'move' ? '#2563eb' : '#64748b',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: actionType === 'move' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              העברה
            </button>
            <button
              type="button"
              onClick={() => setActionType('copy')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '9px',
                border: 'none',
                background: actionType === 'copy' ? '#ffffff' : 'transparent',
                color: actionType === 'copy' ? '#2563eb' : '#64748b',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: actionType === 'copy' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              העתקה
            </button>
          </div>
        )}

        {/* 4. Space Selector (Default: Current Space) */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>
            מרחב יעד:
          </label>
          <select
            value={selectedSpaceId}
            onChange={(e) => {
              setSelectedSpaceId(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.88rem',
              fontWeight: 700,
              background: '#fff',
              color: '#0f172a',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {availableSpaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon || '🏠'} {s.title || 'מרחב ללא שם'} {s.id === currentSpaceId ? '(המרחב הנוכחי)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Shelf / Theme Selector (Sorted with CURRENT shelf FIRST!) */}
        {hasShelves && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>
              נושא (מדף) יעד:
            </label>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {availableShelves.map((sh) => {
                const isSelected = sh.id === selectedShelfId;
                const isCurrent = isCurrentSpace && sh.id === currentShelfId;
                return (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => {
                      setSelectedShelfId(sh.id);
                      setSelectedFolderId(null);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? '#1d4ed8' : '#475569',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{sh.icon || '🗂️'}</span>
                    <span>{sh.name}</span>
                    {isCurrent && (
                      <span style={{ fontSize: '0.62rem', background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                        נוכחי
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Folder Tree (Windows Explorer style: Primary folders, clear current location indication) */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '160px', maxHeight: '250px', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '8px', background: '#f8fafc', marginBottom: '14px' }}>
          {/* Main / Root folder */}
          <div
            onClick={() => setSelectedFolderId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 10px',
              borderRadius: '10px',
              background: isRootSelected ? '#eff6ff' : isRootCurrentOrigin ? '#fffbeb' : '#ffffff',
              border: isRootSelected ? '1.5px solid #2563eb' : isRootCurrentOrigin ? '1.5px dashed #f59e0b' : '1px solid #e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>🏠</span>
              <span style={{ fontSize: '0.86rem', fontWeight: isRootSelected ? 800 : 700, color: isRootSelected ? '#1d4ed8' : '#0f172a' }}>
                {rootDisplayLabel}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isRootCurrentOrigin && (
                <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', padding: '1px 6px', borderRadius: '5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  אתה כאן
                </span>
              )}
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: isRootSelected ? '5px solid #2563eb' : '2px solid #cbd5e1',
                background: '#fff'
              }} />
            </div>
          </div>

          {/* Render top-level folders of this shelf and their branches */}
          {renderFolderBranch(null, 0)}
        </div>

        {/* 7. Confirm / Submit Button */}
        <div>
          <button
            type="button"
            disabled={isDestinationSameAsOrigin && actionType === 'move'}
            onClick={handleConfirm}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '12px',
              border: 'none',
              background: (isDestinationSameAsOrigin && actionType === 'move')
                ? '#cbd5e1'
                : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: (isDestinationSameAsOrigin && actionType === 'move') ? '#64748b' : '#fff',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: (isDestinationSameAsOrigin && actionType === 'move') ? 'not-allowed' : 'pointer',
              boxShadow: (isDestinationSameAsOrigin && actionType === 'move') ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            {isDestinationSameAsOrigin && actionType === 'move'
              ? 'נמצא במיקום זה'
              : actionType === 'copy'
                ? 'בצע העתקה'
                : 'בצע העברה'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalMoveModal;
