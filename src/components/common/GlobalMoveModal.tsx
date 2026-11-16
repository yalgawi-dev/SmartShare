'use client';

import React, { useState, useMemo } from 'react';
import { useSpaces } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';

export interface FolderTargetItem {
  id: string;
  name: string;
  parentId?: string | null;
  shelfId?: string | null;
}

export interface ShelfTargetItem {
  id: string;
  name: string;
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
  rootLabel?: string;
  rootDescription?: string;
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
  rootLabel = 'תיקייה ראשית (ללא תיקייה)',
  rootDescription = 'שכבת הבסיס הראשית'
}) => {
  const { spaces } = useSpaces();
  const { user } = useAuth();

  const [destinationMode, setDestinationMode] = useState<'current' | 'other'>(() => {
    return isShelfTransfer ? 'other' : 'current';
  });
  const [crossActionType, setCrossActionType] = useState<'copy' | 'move'>('copy');
  const [targetSpaceId, setTargetSpaceId] = useState<string>('');
  const [targetSpaceShelfId, setTargetSpaceShelfId] = useState<string>('');
  const [targetSpaceFolderId, setTargetSpaceFolderId] = useState<string | null>(null);
  const [isCrossSaving, setIsCrossSaving] = useState(false);
  const [crossError, setCrossError] = useState('');

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
      if (partnerKey && (partnerKey.role === 'creator' || partnerKey.role === 'partner' || partnerKey.role === 'admin')) {
        return true;
      }
      return false;
    };
  }, [user?.id, user?.spaceKeys]);

  const otherAvailableSpaces = useMemo(() => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter(s => isAuthorizedMemberOfSpace(s) && s.id !== currentSpaceId);
  }, [spaces, currentSpaceId, isAuthorizedMemberOfSpace]);

  // Set default target space when switching to 'other'
  React.useEffect(() => {
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

  // Set default target shelf when space changes
  React.useEffect(() => {
    if (targetSpaceShelves.length > 0) {
      setTargetSpaceShelfId(targetSpaceShelves[0].id);
    } else {
      setTargetSpaceShelfId('');
    }
    setTargetSpaceFolderId(null);
  }, [targetSpaceId, targetSpaceShelves]);

  const targetSpaceFolders = useMemo(() => {
    if (!selectedTargetSpace) return [];
    const docFolders = (selectedTargetSpace.documentFolders || []).filter((f: any) => !f.deletedAt);
    if (targetSpaceShelfId) {
      return docFolders.filter((f: any) => !f.shelfId || f.shelfId === targetSpaceShelfId);
    }
    return docFolders;
  }, [selectedTargetSpace, targetSpaceShelfId]);

  if (!isOpen) return null;

  const hasShelves = Array.isArray(shelves) && shelves.length > 0;
  const [selectedShelfId, setSelectedShelfId] = useState<string>(
    currentShelfId || (hasShelves ? shelves[0].id : '')
  );

  const normId = (id?: string | null) => (id && String(id).trim().length > 0 ? String(id).trim() : null);
  const activeCurrentFolderId = normId(currentFolderId);

  // Filter folders by selected shelf if shelves exist
  const scopedFolders = hasShelves
    ? folders.filter(f => !f.shelfId || f.shelfId === selectedShelfId)
    : folders;

  const isSameShelf = !hasShelves || selectedShelfId === currentShelfId;
  const isRootCurrent = isSameShelf && !activeCurrentFolderId;

  // Current folder object
  const currentFolderObj = activeCurrentFolderId ? scopedFolders.find(f => normId(f.id) === activeCurrentFolderId) : null;
  const currentParentId = currentFolderObj ? normId(currentFolderObj.parentId) : null;

  // Sibling folders: share the exact same normalized parentId!
  const siblingFolders = scopedFolders.filter(f => {
    const fParentId = normId(f.parentId);
    return fParentId === currentParentId;
  });

  // Other folders: exist but have a different parentId
  const otherFolders = scopedFolders.filter(f => {
    const fParentId = normId(f.parentId);
    return fParentId !== currentParentId;
  });

  const [localActionType, setLocalActionType] = useState<'copy' | 'move'>('move');
  const [browsingParentId, setBrowsingParentId] = useState<string | null>(null);

  // When shelf changes, reset browsing to root
  React.useEffect(() => {
    setBrowsingParentId(null);
  }, [selectedShelfId]);

  // Compute folder trail (breadcrumbs) for currently browsed level
  const browsingTrail = useMemo(() => {
    const trail: FolderTargetItem[] = [];
    let curr = browsingParentId ? scopedFolders.find(f => normId(f.id) === normId(browsingParentId)) : null;
    while (curr) {
      trail.unshift(curr);
      curr = curr.parentId ? scopedFolders.find(f => normId(f.id) === normId(curr!.parentId)) : null;
    }
    return trail;
  }, [browsingParentId, scopedFolders]);

  // Direct children inside current browsed parent
  const currentChildFolders = useMemo(() => {
    return scopedFolders.filter(f => normId(f.parentId) === normId(browsingParentId));
  }, [scopedFolders, browsingParentId]);

  // Total count of subfolders inside any folder
  const getSubfolderCount = (fId: string) => {
    return scopedFolders.filter(f => normId(f.parentId) === normId(fId)).length;
  };

  const isCurrentFolderTarget = (targetFolderId: string | null) => {
    return isSameShelf && normId(targetFolderId) === activeCurrentFolderId;
  };

  const handleSelectTarget = (targetFolderId: string | null) => {
    onConfirmMove(targetFolderId, hasShelves ? selectedShelfId : undefined, localActionType);
  };

  const modalTitle = title || (itemCount > 1 
    ? (localActionType === 'copy' ? `שכפול ${itemCount} פריטים` : `העברת ${itemCount} פריטים`) 
    : (localActionType === 'copy' ? 'שכפול פריט' : 'העברה לתיקייה'));

  const handleCrossSpaceSubmit = async () => {
    if (!targetSpaceId || !onConfirmCrossSpace) return;
    setIsCrossSaving(true);
    setCrossError('');
    try {
      await onConfirmCrossSpace(targetSpaceId, targetSpaceShelfId || null, targetSpaceFolderId, crossActionType);
      onClose();
    } catch (err: any) {
      console.error('Cross-space folder transfer failed:', err);
      setCrossError(err?.message || 'שגיאה בהעברה למרחב אחר');
    } finally {
      setIsCrossSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: '460px',
          borderRadius: '24px',
          padding: '1.5rem',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          direction: 'rtl'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>
              {isShelfTransfer 
                ? (crossActionType === 'copy' ? 'שכפול נושא/מדף למרחב אחר' : 'העברת נושא/מדף למרחב אחר')
                : destinationMode === 'other' 
                  ? (crossActionType === 'copy' ? 'שכפול תיקייה למרחב אחר' : 'העברת תיקייה למרחב אחר') 
                  : modalTitle}
            </h3>
            {subtitle && (
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8'
            }}
          >
            ✕
          </button>
        </div>

        {/* Destination Mode Selector: In Current Space vs In Other Space */}
        {!isShelfTransfer && Boolean(onConfirmCrossSpace) && otherAvailableSpaces.length > 0 && (
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '1rem', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setDestinationMode('current')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '9px',
                border: 'none',
                background: destinationMode === 'current' ? '#ffffff' : 'transparent',
                color: destinationMode === 'current' ? '#1d4ed8' : '#64748b',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: destinationMode === 'current' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              📍 בתוך מרחב זה
            </button>
            <button
              type="button"
              onClick={() => setDestinationMode('other')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '9px',
                border: 'none',
                background: destinationMode === 'other' ? '#ffffff' : 'transparent',
                color: destinationMode === 'other' ? '#7c3aed' : '#64748b',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: destinationMode === 'other' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              🗂️ למרחב אחר...
            </button>
          </div>
        )}

        {/* MODE B: Cross Space Transfer */}
        {destinationMode === 'other' ? (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Action Type Toggle: Copy vs Move */}
            <div style={{ display: 'flex', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setCrossActionType('copy')}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: '9px',
                  border: 'none',
                  background: crossActionType === 'copy' ? '#ffffff' : 'transparent',
                  color: crossActionType === 'copy' ? '#2563eb' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: crossActionType === 'copy' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                📋 יצירת עותק (שמור כאן)
              </button>
              <button
                type="button"
                onClick={() => setCrossActionType('move')}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: '9px',
                  border: 'none',
                  background: crossActionType === 'move' ? '#ffffff' : 'transparent',
                  color: crossActionType === 'move' ? '#7c3aed' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: crossActionType === 'move' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                🗂️ העברה מלאה (מחק מכאן)
              </button>
            </div>

            {/* 1. Target Space Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                1. בחר מרחב יעד:
              </label>
              <select
                value={targetSpaceId}
                onChange={(e) => setTargetSpaceId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: '#fff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {otherAvailableSpaces.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon || '📁'} {s.title || 'מרחב ללא שם'}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Target Shelf Selection (if space has shelves) */}
            {!isShelfTransfer && targetSpaceShelves.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  2. בחר מדף יעד במרחב:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                  {targetSpaceShelves.map((sh: any) => {
                    const isSelected = sh.id === targetSpaceShelfId;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => setTargetSpaceShelfId(sh.id)}
                        style={{
                          padding: '0.45rem 0.75rem',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                          background: isSelected ? '#f5f3ff' : '#ffffff',
                          color: isSelected ? '#6d28d9' : '#475569',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🗄️ {sh.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Target Parent Folder inside target space */}
            {!isShelfTransfer && (
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  3. מיקום בתוך המרחב:
                </label>
                <select
                  value={targetSpaceFolderId || ''}
                  onChange={(e) => setTargetSpaceFolderId(e.target.value || null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    background: '#fff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">📁 רמה ראשית (ללא תיקיית אב)</option>
                  {targetSpaceFolders.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      📁 בתוך תיקיית: {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {crossError && (
              <div style={{ color: '#dc2626', fontSize: '0.82rem', background: '#fef2f2', padding: '8px 10px', borderRadius: '10px', border: '1px solid #fecaca', fontWeight: 600 }}>
                {crossError}
              </div>
            )}

            <button
              type="button"
              disabled={isCrossSaving || !targetSpaceId}
              onClick={handleCrossSpaceSubmit}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                background: isCrossSaving 
                  ? '#94a3b8' 
                  : crossActionType === 'copy'
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.94rem',
                cursor: isCrossSaving ? 'not-allowed' : 'pointer',
                boxShadow: isCrossSaving ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.25)',
                marginTop: '0.5rem'
              }}
            >
              {isCrossSaving 
                ? (crossActionType === 'copy' 
                    ? (isShelfTransfer ? 'משכפל נושא/מדף ומסמכים...' : 'משכפל תיקייה ומסמכים...') 
                    : (isShelfTransfer ? 'מעביר נושא/מדף ומסמכים...' : 'מעביר תיקייה ומסמכים...'))
                : (crossActionType === 'copy' 
                    ? (isShelfTransfer ? '📋 צור עותק של הנושא במרחב הנבחר' : '📋 צור עותק של התיקייה במרחב הנבחר') 
                    : (isShelfTransfer ? '🗂️ העבר את הנושא למרחב הנבחר' : '🗂️ העבר את התיקייה למרחב הנבחר'))}
            </button>
          </div>
        ) : (
          <>
            {/* Action Type Toggle (Copy vs Move in Current Space) */}
            {canCopy && (
              <div style={{ display: 'flex', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '4px', marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setLocalActionType('move')}
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    borderRadius: '9px',
                    border: 'none',
                    background: localActionType === 'move' ? '#ffffff' : 'transparent',
                    color: localActionType === 'move' ? '#1d4ed8' : '#64748b',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: localActionType === 'move' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  🗂️ העברה מלאה (מחק מכאן)
                </button>
                <button
                  type="button"
                  onClick={() => setLocalActionType('copy')}
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    borderRadius: '9px',
                    border: 'none',
                    background: localActionType === 'copy' ? '#ffffff' : 'transparent',
                    color: localActionType === 'copy' ? '#2563eb' : '#64748b',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    boxShadow: localActionType === 'copy' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  📋 יצירת עותק (שמור כאן)
                </button>
              </div>
            )}

            {/* Shelves Selector (if applicable) */}
            {hasShelves && (
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
              בחר מדף יעד:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.3rem' }}>
              {shelves.map(sh => {
                const isSelected = sh.id === selectedShelfId;
                return (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setSelectedShelfId(sh.id)}
                    style={{
                      padding: '0.5rem 0.8rem',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      color: isSelected ? '#1d4ed8' : '#475569',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🗄️ {sh.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BREADCRUMB EXPLORER HEADER */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '0.55rem 0.75rem',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.84rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <button
            type="button"
            onClick={() => setBrowsingParentId(null)}
            style={{
              background: browsingParentId === null ? '#dbeafe' : 'transparent',
              color: browsingParentId === null ? '#1d4ed8' : '#64748b',
              border: 'none',
              padding: '2px 6px',
              borderRadius: '6px',
              fontWeight: browsingParentId === null ? 800 : 600,
              cursor: 'pointer'
            }}
          >
            🏠 {rootLabel}
          </button>
          {browsingTrail.map((crumb, cIdx) => {
            const isLastCrumb = cIdx === browsingTrail.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <span style={{ color: '#cbd5e1' }}>/</span>
                <button
                  type="button"
                  onClick={() => setBrowsingParentId(crumb.id)}
                  style={{
                    background: isLastCrumb ? '#dbeafe' : 'transparent',
                    color: isLastCrumb ? '#1d4ed8' : '#64748b',
                    border: 'none',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontWeight: isLastCrumb ? 800 : 600,
                    cursor: 'pointer'
                  }}
                >
                  📁 {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* ACTION: SELECT CURRENT BROWSING FOLDER AS DESTINATION */}
        <div style={{ marginBottom: '0.75rem' }}>
          {(() => {
            const isTargetCurrent = isCurrentFolderTarget(browsingParentId);
            const currentFolderName = browsingParentId 
              ? (scopedFolders.find(f => normId(f.id) === normId(browsingParentId))?.name || 'תיקייה זו') 
              : rootLabel;

            return (
              <button
                type="button"
                disabled={isTargetCurrent}
                onClick={() => handleSelectTarget(browsingParentId)}
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  background: isTargetCurrent ? '#f1f5f9' : (localActionType === 'copy' ? '#eff6ff' : '#f0fdf4'),
                  border: isTargetCurrent ? '2px solid #94a3b8' : (localActionType === 'copy' ? '2px solid #2563eb' : '2px solid #16a34a'),
                  borderRadius: '14px',
                  cursor: isTargetCurrent ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'right',
                  boxShadow: isTargetCurrent ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{browsingParentId ? '🎯' : '🏠'}</span>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: isTargetCurrent ? '#64748b' : (localActionType === 'copy' ? '#1d4ed8' : '#15803d') }}>
                      {localActionType === 'copy' ? `📋 העתק לכאן (אל "${currentFolderName}")` : `🗂️ העבר לכאן (אל "${currentFolderName}")`}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {browsingParentId ? `בתוך: ${currentFolderName}` : rootDescription}
                    </div>
                  </div>
                </div>
                {isTargetCurrent ? (
                  <span style={{ background: '#e2e8f0', color: '#475569', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                    מיקום נוכחי
                  </span>
                ) : (
                  <span style={{ 
                    background: localActionType === 'copy' ? '#2563eb' : '#16a34a',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 800
                  }}>
                    בחר יעד זה ✓
                  </span>
                )}
              </button>
            );
          })()}
        </div>

        {/* LIST OF SUBFOLDERS AT THIS DRILL-DOWN LEVEL */}
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>📂</span>
          <span>{browsingParentId ? 'תתי-תיקיות בפנים (לחץ כדי להיכנס):' : 'תיקיות ברמה הראשית (לחץ כדי להיכנס):'}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '0.5rem' }}>
          {currentChildFolders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: '#94a3b8', fontSize: '0.85rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
              אין תתי-תיקיות נוספות כאן. ניתן ללחוץ על הכפתור למעלה כדי {localActionType === 'copy' ? 'להעתיק' : 'להעביר'} לכאן!
            </div>
          ) : (
            currentChildFolders.map(f => {
              const subCount = getSubfolderCount(f.id);
              const isTargetCurrent = isCurrentFolderTarget(f.id);

              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Click folder name to DRILL DOWN into it */}
                  <div
                    onClick={() => setBrowsingParentId(f.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1, minWidth: 0 }}
                    title="לחץ לפתיחת התיקייה ולניווט פנימה"
                  >
                    <span style={{ fontSize: '1.25rem' }}>📁</span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {subCount > 0 ? `${subCount} תתי-תיקיות פנימיות ⬅️` : 'אין תתי-תיקיות (לחץ לבחירה)'}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this folder */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    {subCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setBrowsingParentId(f.id)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="היכנס לתוך תיקייה זו"
                      >
                        היכנס פנימה ↵
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isTargetCurrent}
                      onClick={() => handleSelectTarget(f.id)}
                      style={{
                        background: isTargetCurrent ? '#f1f5f9' : (localActionType === 'copy' ? '#eff6ff' : '#f0fdf4'),
                        border: isTargetCurrent ? '1px solid #cbd5e1' : (localActionType === 'copy' ? '1px solid #bfdbfe' : '1px solid #bbf7d0'),
                        color: isTargetCurrent ? '#94a3b8' : (localActionType === 'copy' ? '#1d4ed8' : '#16a34a'),
                        padding: '4px 9px',
                        borderRadius: '8px',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        cursor: isTargetCurrent ? 'default' : 'pointer'
                      }}
                    >
                      {isTargetCurrent ? 'נוכחי' : (localActionType === 'copy' ? 'העתק לכאן ✓' : 'העבר לכאן ✓')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
      )}

        <button
          onClick={onClose}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.75rem',
            background: '#f1f5f9',
            color: '#64748b',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          ביטול
        </button>
      </div>
    </div>
  );
};

export default GlobalMoveModal;
