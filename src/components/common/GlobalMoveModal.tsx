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

interface TreeNode extends FolderTargetItem {
  depth: number;
  relation: 'current' | 'ancestor' | 'sibling' | 'child' | 'other';
  hasChildren: boolean;
}

export const GlobalMoveModal: React.FC<GlobalMoveModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  itemCount,
  currentFolderId,
  currentShelfId,
  currentSpaceId,
  isShelfTransfer = false,
  canCopy = true,
  shelves,
  folders,
  onConfirmMove,
  onConfirmCrossSpace,
  onCreateSubfolder,
  rootLabel = 'רמה ראשית (ללא תיקייה)',
  rootDescription = 'שכבת הבסיס הראשית'
}) => {
  const { spaces, addDocumentFolder, updateFileShareItems } = useSpaces();
  const { user } = useAuth();

  const [destinationMode, setDestinationMode] = useState<'current' | 'other'>(() => {
    return isShelfTransfer ? 'other' : 'current';
  });
  const [actionType, setActionType] = useState<'copy' | 'move'>('move');

  // Cross space state
  const [targetSpaceId, setTargetSpaceId] = useState<string>('');
  const [targetSpaceShelfId, setTargetSpaceShelfId] = useState<string>('');
  const [targetSpaceFolderId, setTargetSpaceFolderId] = useState<string | null>(null);
  const [isCrossSaving, setIsCrossSaving] = useState(false);
  const [crossError, setCrossError] = useState('');

  // Local navigation state
  const hasShelves = Array.isArray(shelves) && shelves.length > 0;
  const [selectedShelfId, setSelectedShelfId] = useState<string>(
    currentShelfId || (hasShelves ? shelves[0].id : '')
  );
  const [selectedLocalFolderId, setSelectedLocalFolderId] = useState<string | null>(null);

  // Inline create new folder state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [extraCreatedFolders, setExtraCreatedFolders] = useState<FolderTargetItem[]>([]);

  const normId = (id?: string | null) => (id && String(id).trim().length > 0 ? String(id).trim() : null);
  const activeCurrentFolderId = normId(currentFolderId);

  useEffect(() => {
    if (isOpen) {
      setDestinationMode(isShelfTransfer ? 'other' : 'current');
      setSelectedShelfId(currentShelfId || (hasShelves && shelves ? shelves[0].id : ''));
      setSelectedLocalFolderId(null);
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  }, [isOpen, isShelfTransfer, currentShelfId, hasShelves]);

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

  const currentSpaceObj = useMemo(() => {
    if (!Array.isArray(spaces) || !currentSpaceId) return null;
    return spaces.find(s => s.id === currentSpaceId) || null;
  }, [spaces, currentSpaceId]);

  const otherAvailableSpaces = useMemo(() => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter(s => isAuthorizedMemberOfSpace(s) && s.id !== currentSpaceId);
  }, [spaces, currentSpaceId, isAuthorizedMemberOfSpace]);

  useEffect(() => {
    if (destinationMode === 'other' && otherAvailableSpaces.length > 0 && !targetSpaceId) {
      setTargetSpaceId(otherAvailableSpaces[0].id);
    }
  }, [destinationMode, otherAvailableSpaces, targetSpaceId]);

  const selectedTargetSpace = useMemo(() => {
    return otherAvailableSpaces.find(s => s.id === targetSpaceId) || null;
  }, [otherAvailableSpaces, targetSpaceId]);

  const targetSpaceShelves = useMemo(() => {
    return selectedTargetSpace?.shelves || [];
  }, [selectedTargetSpace]);

  useEffect(() => {
    if (targetSpaceShelves.length > 0) {
      setTargetSpaceShelfId(targetSpaceShelves[0].id);
    } else {
      setTargetSpaceShelfId('');
    }
    setTargetSpaceFolderId(null);
  }, [targetSpaceId, targetSpaceShelves]);

  // All folders in target space
  const targetSpaceFolders = useMemo(() => {
    if (!selectedTargetSpace) return [];
    const docFolders = (selectedTargetSpace.documentFolders || [])
      .filter((f: any) => !f.deletedAt)
      .map((f: any) => ({
        id: String(f.id),
        name: f.name || 'תיקייה',
        parentId: f.parentId ? String(f.parentId) : null,
        shelfId: f.shelfId ? String(f.shelfId) : null,
      }));
    const fileFolders = (selectedTargetSpace.fileShareItems || [])
      .filter((i: any) => i && i.type === 'folder' && !i.deletedAt)
      .map((f: any) => ({
        id: String(f.id),
        name: f.name || 'תיקייה',
        parentId: f.parentId ? String(f.parentId) : null,
        shelfId: null,
      }));

    const allTargetFolders = [...docFolders, ...fileFolders];
    if (targetSpaceShelfId) {
      return allTargetFolders.filter((f: any) => !f.shelfId || f.shelfId === targetSpaceShelfId);
    }
    return allTargetFolders;
  }, [selectedTargetSpace, targetSpaceShelfId]);

  // Merge passed folders with any newly created inline folders
  const allLocalFolders = useMemo(() => {
    const map = new Map<string, FolderTargetItem>();
    folders.forEach(f => map.set(String(f.id), f));
    extraCreatedFolders.forEach(f => map.set(String(f.id), f));
    return Array.from(map.values());
  }, [folders, extraCreatedFolders]);

  const scopedFolders = useMemo(() => {
    return hasShelves
      ? allLocalFolders.filter(f => !f.shelfId || f.shelfId === selectedShelfId)
      : allLocalFolders;
  }, [allLocalFolders, hasShelves, selectedShelfId]);

  useEffect(() => {
    setSelectedLocalFolderId(null);
  }, [selectedShelfId]);

  // Compute current origin breadcrumb path so user ALWAYS knows where the item currently sits
  const originLocationBreadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (currentSpaceObj?.title) {
      parts.push(`🏠 ${currentSpaceObj.title}`);
    }
    if (hasShelves && currentShelfId && shelves) {
      const sh = shelves.find(s => s.id === currentShelfId);
      if (sh) parts.push(`${sh.icon || '🗂️'} ${sh.name}`);
    }
    if (activeCurrentFolderId) {
      const chain: string[] = [];
      let curr: string | null = activeCurrentFolderId;
      let guard = 0;
      while (curr && guard < 15) {
        guard++;
        const found = allLocalFolders.find(f => normId(f.id) === curr);
        if (found) {
          chain.unshift(`📁 ${found.name}`);
          curr = normId(found.parentId);
        } else {
          break;
        }
      }
      if (chain.length > 0) parts.push(...chain);
    } else if (!isShelfTransfer) {
      parts.push('ראשי (ללא תיקייה)');
    }
    return parts.join('  ⬅  ');
  }, [currentSpaceObj, hasShelves, currentShelfId, shelves, activeCurrentFolderId, allLocalFolders, isShelfTransfer]);

  // Build flat visual hierarchy tree with depth and relationship to current folder
  const buildVisualTree = (folderList: FolderTargetItem[], refCurrentFolderId: string | null): TreeNode[] => {
    // Find ancestor set of refCurrentFolderId
    const ancestorIds = new Set<string>();
    const currentFolderObj = refCurrentFolderId
      ? folderList.find(f => normId(f.id) === refCurrentFolderId)
      : null;
    const currentParentId = currentFolderObj ? normId(currentFolderObj.parentId) : null;

    let ptr = currentParentId;
    let safety = 0;
    while (ptr && safety < 20) {
      safety++;
      ancestorIds.add(ptr);
      const pObj = folderList.find(f => normId(f.id) === ptr);
      ptr = pObj ? normId(pObj.parentId) : null;
    }

    const result: TreeNode[] = [];
    const visited = new Set<string>();

    const traverse = (parentId: string | null, depth: number) => {
      const children = folderList.filter(f => normId(f.parentId) === parentId);
      for (const child of children) {
        const cid = String(child.id);
        if (visited.has(cid)) continue;
        visited.add(cid);

        const hasSub = folderList.some(f => normId(f.parentId) === cid);
        let relation: TreeNode['relation'] = 'other';
        if (refCurrentFolderId && cid === refCurrentFolderId) {
          relation = 'current';
        } else if (ancestorIds.has(cid)) {
          relation = 'ancestor';
        } else if (refCurrentFolderId && normId(child.parentId) === refCurrentFolderId) {
          relation = 'child';
        } else if (refCurrentFolderId && normId(child.parentId) === currentParentId) {
          relation = 'sibling';
        }

        result.push({
          ...child,
          depth,
          relation,
          hasChildren: hasSub
        });

        traverse(cid, depth + 1);
      }
    };

    traverse(null, 1);

    // Append any orphan folders whose parent wasn't in the list
    for (const f of folderList) {
      const fid = String(f.id);
      if (!visited.has(fid)) {
        visited.add(fid);
        result.push({
          ...f,
          depth: 1,
          relation: fid === refCurrentFolderId ? 'current' : 'other',
          hasChildren: folderList.some(c => normId(c.parentId) === fid)
        });
      }
    }

    return result;
  };

  const localTreeNodes = useMemo(() => {
    const isSameShelf = !hasShelves || selectedShelfId === currentShelfId;
    return buildVisualTree(scopedFolders, isSameShelf ? activeCurrentFolderId : null);
  }, [scopedFolders, hasShelves, selectedShelfId, currentShelfId, activeCurrentFolderId]);

  const crossTreeNodes = useMemo(() => {
    return buildVisualTree(targetSpaceFolders, null);
  }, [targetSpaceFolders]);

  if (!isOpen) return null;

  const isSameShelf = !hasShelves || selectedShelfId === currentShelfId;
  const isCurrentLocationSelected = isSameShelf && normId(selectedLocalFolderId) === activeCurrentFolderId;

  const selectedLocalFolderName = selectedLocalFolderId
    ? (scopedFolders.find(f => normId(f.id) === normId(selectedLocalFolderId))?.name || 'תיקייה נבחרת')
    : rootLabel;

  const selectedCrossFolderName = targetSpaceFolderId
    ? (targetSpaceFolders.find((f: any) => normId(f.id) === normId(targetSpaceFolderId))?.name || 'תיקייה נבחרת')
    : 'ראשי (ללא תיקייה)';

  const handleCreateInlineFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    if (destinationMode === 'current') {
      const parentForNew = selectedLocalFolderId || null;
      if (onCreateSubfolder) {
        const maybeId = await onCreateSubfolder(trimmed, parentForNew, hasShelves ? selectedShelfId : null);
        if (typeof maybeId === 'string' && maybeId) {
          setExtraCreatedFolders(prev => [...prev, { id: maybeId, name: trimmed, parentId: parentForNew, shelfId: hasShelves ? selectedShelfId : null }]);
          setSelectedLocalFolderId(maybeId);
        }
      } else if (currentSpaceId && hasShelves && selectedShelfId) {
        const createdId = addDocumentFolder(currentSpaceId, {
          name: trimmed,
          shelfId: selectedShelfId,
          parentId: parentForNew,
          allowedPartners: []
        });
        setExtraCreatedFolders(prev => [...prev, { id: createdId, name: trimmed, parentId: parentForNew, shelfId: selectedShelfId }]);
        setSelectedLocalFolderId(createdId);
      } else if (currentSpaceId && currentSpaceObj && Array.isArray(currentSpaceObj.fileShareItems)) {
        const newId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newFolderItem = {
          id: newId,
          spaceId: currentSpaceId,
          name: trimmed,
          type: 'folder' as const,
          parentId: parentForNew,
          createdAt: Date.now(),
          createdBy: user?.id || 'me',
          creatorName: user?.realName || user?.nickname || 'שותף',
          allowedPartners: []
        };
        await updateFileShareItems(currentSpaceId, [...currentSpaceObj.fileShareItems, newFolderItem]);
        setExtraCreatedFolders(prev => [...prev, { id: newId, name: trimmed, parentId: parentForNew, shelfId: null }]);
        setSelectedLocalFolderId(newId);
      }
    } else if (destinationMode === 'other' && selectedTargetSpace) {
      const parentForNew = targetSpaceFolderId || null;
      if (targetSpaceShelves.length > 0 && targetSpaceShelfId) {
        const createdId = addDocumentFolder(selectedTargetSpace.id, {
          name: trimmed,
          shelfId: targetSpaceShelfId,
          parentId: parentForNew,
          allowedPartners: []
        });
        setTargetSpaceFolderId(createdId);
      } else {
        const newId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newFolderItem = {
          id: newId,
          spaceId: selectedTargetSpace.id,
          name: trimmed,
          type: 'folder' as const,
          parentId: parentForNew,
          createdAt: Date.now(),
          createdBy: user?.id || 'me',
          creatorName: user?.realName || user?.nickname || 'שותף',
          allowedPartners: []
        };
        const existing = selectedTargetSpace.fileShareItems || [];
        await updateFileShareItems(selectedTargetSpace.id, [...existing, newFolderItem]);
        setTargetSpaceFolderId(newId);
      }
    }

    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleCrossSpaceSubmit = async () => {
    if (!targetSpaceId || !onConfirmCrossSpace) return;
    setIsCrossSaving(true);
    setCrossError('');
    try {
      await onConfirmCrossSpace(targetSpaceId, targetSpaceShelfId || null, targetSpaceFolderId, actionType);
      onClose();
    } catch (err: any) {
      console.error('Cross-space transfer failed:', err);
      setCrossError(err?.message || 'שגיאה בהעברה למרחב אחר');
    } finally {
      setIsCrossSaving(false);
    }
  };

  const handleLocalSubmit = () => {
    if (isCurrentLocationSelected && actionType === 'move') return;
    onConfirmMove(selectedLocalFolderId, hasShelves ? selectedShelfId : undefined, actionType);
    onClose();
  };

  const getRelationBadge = (relation: TreeNode['relation']) => {
    switch (relation) {
      case 'current':
        return { text: '📍 נמצא כאן כעת', bg: '#fef3c7', color: '#b45309', border: '#fcd34d' };
      case 'ancestor':
        return { text: '⬆️ תיקייה מעליך', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
      case 'child':
        return { text: '⬇️ תת-תיקייה פנימית', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'sibling':
        return { text: '↔️ באותה רמה', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      default:
        return null;
    }
  };

  const renderFolderTree = (
    nodes: TreeNode[],
    selectedId: string | null,
    onSelect: (id: string | null) => void,
    isSameShelfContext: boolean
  ) => {
    const isRootSelected = selectedId === null;
    const isRootCurrent = isSameShelfContext && activeCurrentFolderId === null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '8px', background: '#f8fafc' }}>
        {/* Root Level Item (Level 0) */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{
            width: '100%',
            textAlign: 'right',
            padding: '9px 12px',
            background: isRootSelected ? '#eff6ff' : '#ffffff',
            borderRadius: '10px',
            border: isRootSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'all 0.15s ease',
            boxShadow: isRootSelected ? '0 2px 8px rgba(37,99,235,0.15)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '1.05rem' }}>🏠</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: isRootSelected ? '#1d4ed8' : '#0f172a' }}>
                {rootLabel}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                {rootDescription}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {isRootCurrent && (
              <span style={{ fontSize: '0.65rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', padding: '2px 6px', borderRadius: '6px', fontWeight: 800 }}>
                📍 נמצא כאן כעת
              </span>
            )}
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: isRootSelected ? '5px solid #2563eb' : '2px solid #cbd5e1',
              background: '#fff',
              boxSizing: 'border-box'
            }} />
          </div>
        </button>

        {/* Hierarchical Tree Nodes */}
        {nodes.map((node) => {
          const isSelected = normId(selectedId) === normId(node.id);
          const badge = isSameShelfContext ? getRelationBadge(node.relation) : null;
          const indentPx = Math.min(node.depth * 18, 72);

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect(node.id)}
              style={{
                width: `calc(100% - ${indentPx}px)`,
                marginRight: `${indentPx}px`,
                textAlign: 'right',
                padding: '8px 10px',
                background: isSelected ? '#eff6ff' : (node.relation === 'current' && isSameShelfContext ? '#fffbeb' : '#ffffff'),
                borderRadius: '10px',
                border: isSelected
                  ? '2px solid #2563eb'
                  : (node.relation === 'current' && isSameShelfContext ? '1.5px dashed #f59e0b' : '1px solid #e2e8f0'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                  ↳
                </span>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                  {isSelected ? '📂' : '📁'}
                </span>
                <span style={{
                  fontSize: '0.84rem',
                  fontWeight: isSelected ? 800 : 700,
                  color: isSelected ? '#1d4ed8' : '#1e293b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {node.name}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {badge && (
                  <span style={{
                    fontSize: '0.64rem',
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                    padding: '1px 6px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap'
                  }}>
                    {badge.text}
                  </span>
                )}
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: isSelected ? '5px solid #2563eb' : '2px solid #cbd5e1',
                  background: '#fff',
                  boxSizing: 'border-box'
                }} />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px',
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '22px',
          width: '100%',
          maxWidth: '450px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px',
          boxShadow: '0 24px 55px rgba(0,0,0,0.4)',
          color: '#0f172a',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.2rem' }}>📦</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              {title || (isShelfTransfer ? 'העברה או שכפול נושא שלם' : 'העברה או שכפול מיקום')}
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

        {/* Clear Origin & Item Context Box ("איפה אני עכשיו?") */}
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '8px 12px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {subtitle && (
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
              פריט נבחר: <span style={{ color: '#2563eb' }}>{subtitle}</span>
            </div>
          )}
          <div style={{ fontSize: '0.74rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: '#334155' }}>📍 מיקום נוכחי:</span>
            <span style={{ background: '#ffffff', padding: '1px 7px', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#1e293b' }}>
              {originLocationBreadcrumb || 'ראשי'}
            </span>
          </div>
        </div>

        {/* Step 1: Action Type (Move vs Copy) */}
        {canCopy && (
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '10px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setActionType('move')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '9px',
                border: 'none',
                background: actionType === 'move' ? '#ffffff' : 'transparent',
                color: actionType === 'move' ? '#2563eb' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: actionType === 'move' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              📦 העברה (הזז למיקום חדש)
            </button>
            <button
              type="button"
              onClick={() => setActionType('copy')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '9px',
                border: 'none',
                background: actionType === 'copy' ? '#ffffff' : 'transparent',
                color: actionType === 'copy' ? '#2563eb' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: actionType === 'copy' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              📋 שכפול (צור עותק נוסף)
            </button>
          </div>
        )}

        {/* Step 2: Scope Selector (Within this Space vs Another Space) */}
        {!isShelfTransfer && Boolean(onConfirmCrossSpace) && otherAvailableSpaces.length > 0 && (
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '12px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setDestinationMode('current')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '9px',
                border: 'none',
                background: destinationMode === 'current' ? '#ffffff' : 'transparent',
                color: destinationMode === 'current' ? '#0f172a' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: destinationMode === 'current' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              📍 בתוך מרחב זה ({currentSpaceObj?.title || 'נוכחי'})
            </button>
            <button
              type="button"
              onClick={() => setDestinationMode('other')}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '9px',
                border: 'none',
                background: destinationMode === 'other' ? '#ffffff' : 'transparent',
                color: destinationMode === 'other' ? '#0f172a' : '#64748b',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: destinationMode === 'other' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              🌐 למרחב עבודה אחר...
            </button>
          </div>
        )}

        {/* Center Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '2px' }}>
          {destinationMode === 'other' ? (
            /* ================= CROSS SPACE MODE ================= */
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                  1. בחר לאיזה מרחב להעביר:
                </label>
                {otherAvailableSpaces.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>לא נמצאו מרחבים נוספים</div>
                ) : (
                  <select
                    value={targetSpaceId}
                    onChange={(e) => setTargetSpaceId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      background: '#fff',
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {otherAvailableSpaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.icon || '🏠'} {s.title || 'מרחב ללא שם'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!isShelfTransfer && targetSpaceShelves.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    2. בחר נושא (מדף) במרחב היעד:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {targetSpaceShelves.map((sh: any) => {
                      const isSelected = sh.id === targetSpaceShelfId;
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => setTargetSpaceShelfId(sh.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            color: isSelected ? '#1d4ed8' : '#475569',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sh.icon || '🗂️'} {sh.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isShelfTransfer && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
                      {targetSpaceShelves.length > 0 ? '3.' : '2.'} בחר מיקום בעץ התיקיות:
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(prev => !prev)}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#2563eb',
                        borderRadius: '8px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {isCreatingFolder ? '✕ ביטול' : '+ תיקייה חדשה כאן'}
                    </button>
                  </div>

                  {isCreatingFolder && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        placeholder={`שם תיקייה חדשה תחת "${selectedCrossFolderName}"...`}
                        autoFocus
                        style={{ flex: 1, padding: '7px 10px', borderRadius: '9px', border: '1.5px solid #2563eb', fontSize: '0.82rem', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={handleCreateInlineFolder}
                        style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '9px', padding: '0 12px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        צור
                      </button>
                    </div>
                  )}

                  {renderFolderTree(crossTreeNodes, targetSpaceFolderId, setTargetSpaceFolderId, false)}
                </div>
              )}

              {isShelfTransfer && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px', fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                  💡 הנושא <strong>{subtitle}</strong> יועבר בשלמותו (כולל כל התיקיות, תתי-התיקיות והמסמכים שבתוכו) כנושא ראשי במרחב <strong>{selectedTargetSpace?.title || ''}</strong>.
                </div>
              )}

              {crossError && (
                <div style={{ color: '#dc2626', fontSize: '0.8rem', background: '#fef2f2', padding: '8px 10px', borderRadius: '10px', border: '1px solid #fecaca', fontWeight: 600 }}>
                  {crossError}
                </div>
              )}
            </>
          ) : (
            /* ================= CURRENT SPACE MODE ================= */
            <>
              {hasShelves && shelves && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    1. בחר נושא (מדף):
                  </label>
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {shelves.map((sh) => {
                      const isSelected = sh.id === selectedShelfId;
                      const isCurrentShelf = sh.id === currentShelfId;
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => setSelectedShelfId(sh.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            color: isSelected ? '#1d4ed8' : '#475569',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{sh.icon || '🗂️'}</span>
                          <span>{sh.name}</span>
                          {isCurrentShelf && (
                            <span style={{ fontSize: '0.62rem', background: '#dbeafe', color: '#1e40af', padding: '0 4px', borderRadius: '4px' }}>
                              נוכחי
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
                    {hasShelves ? '2.' : '1.'} בחר מיקום בעץ התיקיות:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(prev => !prev)}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      borderRadius: '8px',
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {isCreatingFolder ? '✕ ביטול' : '+ תיקייה חדשה כאן'}
                  </button>
                </div>

                {isCreatingFolder && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      placeholder={`שם תיקייה חדשה תחת "${selectedLocalFolderName}"...`}
                      autoFocus
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '9px', border: '1.5px solid #2563eb', fontSize: '0.82rem', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateInlineFolder}
                      style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '9px', padding: '0 12px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      צור
                    </button>
                  </div>
                )}

                {renderFolderTree(localTreeNodes, selectedLocalFolderId, setSelectedLocalFolderId, isSameShelf)}
              </div>
            </>
          )}
        </div>

        {/* Summary & Confirm Button */}
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
          {destinationMode === 'other' ? (
            <button
              type="button"
              disabled={isCrossSaving || !targetSpaceId}
              onClick={handleCrossSpaceSubmit}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: isCrossSaving || !targetSpaceId
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: isCrossSaving || !targetSpaceId ? 'not-allowed' : 'pointer',
                boxShadow: isCrossSaving || !targetSpaceId ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isCrossSaving
                ? (actionType === 'copy' ? 'משכפל...' : 'מעביר...')
                : isShelfTransfer
                  ? (actionType === 'copy'
                      ? `📋 שכפל נושא אל "${selectedTargetSpace?.title || ''}"`
                      : `📦 העבר נושא אל "${selectedTargetSpace?.title || ''}"`)
                  : (actionType === 'copy'
                      ? `📋 שכפל אל "${selectedTargetSpace?.title || ''}" ⬅ "${selectedCrossFolderName}"`
                      : `📦 העבר אל "${selectedTargetSpace?.title || ''}" ⬅ "${selectedCrossFolderName}"`)}
            </button>
          ) : (
            <button
              type="button"
              disabled={isCurrentLocationSelected && actionType === 'move'}
              onClick={handleLocalSubmit}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: (isCurrentLocationSelected && actionType === 'move')
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: (isCurrentLocationSelected && actionType === 'move') ? '#64748b' : '#fff',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: (isCurrentLocationSelected && actionType === 'move') ? 'not-allowed' : 'pointer',
                boxShadow: (isCurrentLocationSelected && actionType === 'move') ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isCurrentLocationSelected && actionType === 'move'
                ? '📍 הפריט כבר נמצא במיקום זה (בחר תיקייה אחרת)'
                : actionType === 'copy'
                  ? `📋 צור עותק ב-"${selectedLocalFolderName}"`
                  : `📦 העבר אל "${selectedLocalFolderName}"`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalMoveModal;
