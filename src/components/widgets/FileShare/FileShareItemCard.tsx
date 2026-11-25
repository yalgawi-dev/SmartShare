'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileShareItem, formatFileSize } from '@/utils/fileShareUtils';
import { getDocumentFormatInfo } from '@/utils/documentUtils';
import PdfThumbnail from '@/components/shared/PdfThumbnail';

interface FileShareItemCardProps {
  item: FileShareItem;
  itemIndex?: number;
  viewMode?: 'list' | 'grid_medium' | 'grid_large';
  containedItemCount?: number;
  onOpen: (item: FileShareItem) => void;
  onManageLink: (item: FileShareItem) => void;
  onManagePermissions?: (item: FileShareItem) => void;
  onRename?: (item: FileShareItem, newName: string) => void;
  onDelete: (item: FileShareItem) => void;
  onToggleFavorite?: (item: FileShareItem) => void;
  onEditInScanner?: (item: FileShareItem) => void;
  hasScanner?: boolean;
  isMultiSelect?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: FileShareItem) => void;
  onContextMenuAction?: (item: FileShareItem, x: number, y: number) => void;
}

export function FileShareItemCard({
  item,
  itemIndex,
  viewMode = 'grid_medium',
  containedItemCount = 0,
  onOpen,
  onManageLink,
  onManagePermissions,
  onRename,
  onDelete,
  onToggleFavorite,
  onEditInScanner,
  hasScanner = false,
  isMultiSelect = false,
  isSelected = false,
  onToggleSelect,
  onContextMenuAction
}: FileShareItemCardProps) {
  const isFolder = item.type === 'folder';
  const isPublicLinkActive = Boolean(item.shareLink?.enabled && item.shareLink?.token);
  const isOnlyMe = Array.isArray(item.allowedPartners) && item.allowedPartners.includes('__only_me__');
  const isOnlyAdmins = Array.isArray(item.allowedPartners) && item.allowedPartners.includes('__creator_vault_secret__');
  const isRestricted = Array.isArray(item.allowedPartners) && item.allowedPartners.length > 0;

  // Inline rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(item.name);
  const [showDotsMenu, setShowDotsMenu] = useState(false);

  // Long press timer ref & flag
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  useEffect(() => {
    setEditNameValue(item.name);
  }, [item.name]);

  const handleRenameSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (editNameValue.trim() && editNameValue.trim() !== item.name && onRename) {
      onRename(item, editNameValue.trim());
    }
    setIsEditingName(false);
  };

  const startLongPress = (e?: React.TouchEvent | React.MouseEvent) => {
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    let x = typeof window !== 'undefined' ? window.innerWidth / 2 : 180;
    let y = typeof window !== 'undefined' ? window.innerHeight / 2 : 240;
    if (e && 'touches' in e && e.touches?.[0]) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else if (e && 'clientX' in e) {
      x = e.clientX;
      y = e.clientY;
    }
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (onContextMenuAction && !isMultiSelect) {
        onContextMenuAction(item, x, y);
      } else if (onToggleSelect) {
        onToggleSelect(item);
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(45);
        }
      } catch (_) {}
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const getPrivacyBadge = () => {
    if (isOnlyMe) {
      return { icon: '👤', text: 'סולו', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
    }
    if (isOnlyAdmins) {
      return { icon: '🛡️', text: 'מנהלים', bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
    }
    if (Array.isArray(item.folderPartners) && item.folderPartners.length > 0) {
      const pCount = item.folderPartners.length;
      const firstRole = item.folderPartners[0].partnerType;
      const roleIcon = firstRole === 'provider' ? '🛠️' : (firstRole === 'client' ? '👤' : '🤝');
      return { 
        icon: roleIcon, 
        text: pCount > 1 ? `${roleIcon} ${pCount} שותפים` : `${roleIcon} ${item.folderPartners[0].name || 'שותף פרויקט'}`, 
        bg: '#eff6ff', 
        color: '#1d4ed8', 
        border: '#bfdbfe' 
      };
    }
    if (isRestricted) {
      return { icon: '🔒', text: 'מוגבל', bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' };
    }
    return { icon: '🌐', text: 'פתוח לכולם', bg: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary, #4f46e5)', border: 'rgba(99, 102, 241, 0.25)' };
  };

  const privacyBadge = getPrivacyBadge();

  const [thumbFailed, setThumbFailed] = useState(false);

  // Unified document format detection via getDocumentFormatInfo (Rule 2 - DRY Single Source of Truth)
  const formatInfo = getDocumentFormatInfo({
    url: item.url,
    rawPdfUrl: item.rawPdfUrl,
    type: item.fileType,
    title: item.name,
    thumbnailUrl: item.thumbnailUrl
  });

  const isPdf = formatInfo.category === 'pdf';
  const isCad = formatInfo.category === 'cad';
  const isImg = formatInfo.category === 'webp' || Boolean(item.url && item.url.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i));
  const isRealImageUrl = (u?: string) => {
    if (!u || typeof u !== 'string') return false;
    if ((isPdf || isCad) && item.url && u === item.url) return false;
    const low = u.toLowerCase();
    if (low.startsWith('data:image/')) return true;
    if (
      low.includes('.pdf') ||
      low.includes('.dwfx') ||
      low.includes('.dwf') ||
      low.includes('.dwg') ||
      low.includes('.dxf') ||
      low.includes('.doc') ||
      low.includes('.xls') ||
      low.includes('.zip') ||
      low.startsWith('data:application/')
    ) {
      return false;
    }
    return true;
  };
  const candidatePreview = isRealImageUrl(item.thumbnailUrl)
    ? item.thumbnailUrl!
    : (Array.isArray(item.pages) && item.pages.length > 0 && isRealImageUrl(item.pages[0])
      ? item.pages[0]
      : (isImg && isRealImageUrl(item.url) ? item.url! : ''));
  const previewUrl = thumbFailed ? '' : candidatePreview;

  // FOLDER CARD VIEW (Uniform with Vault Folders)
  if (isFolder) {
    if (viewMode === 'grid_medium' || viewMode === 'grid_large') {
      const folderIconSize = viewMode === 'grid_large' ? '3.4rem' : '2.6rem';

      return (
        <div
          onTouchStart={startLongPress}
          onTouchMove={cancelLongPress}
          onTouchEnd={cancelLongPress}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onContextMenu={(e) => {
            if (!onContextMenuAction || isMultiSelect) return;
            e.preventDefault();
            e.stopPropagation();
            cancelLongPress();
            onContextMenuAction(item, e.clientX, e.clientY);
          }}
          onClick={() => {
            if (isLongPressTriggeredRef.current) {
              isLongPressTriggeredRef.current = false;
              return;
            }
            if (isMultiSelect && onToggleSelect) onToggleSelect(item);
            else onOpen(item);
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.75rem 0.5rem 0.5rem 0.5rem',
            background: isSelected ? '#eff6ff' : (item.isFavorite ? '#fffdf7' : '#ffffff'),
            border: isSelected
              ? '2px solid #2563eb'
              : (item.isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0'),
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: isSelected ? '0 8px 20px rgba(37,99,235,0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
            textAlign: 'center',
            gap: '0.35rem',
            position: 'relative'
          }}
        >
          {/* Checkbox Overlay in MultiSelect */}
          {isMultiSelect && (
            <div style={{
              position: 'absolute',
              top: '6px',
              left: '6px',
              zIndex: 25,
              background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.9)',
              color: 'white',
              borderRadius: '6px',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isSelected ? 'none' : '1.5px solid #94a3b8',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              {isSelected ? '✓' : ''}
            </div>
          )}

          {/* Folder Icon with item count badge */}
          <div style={{ position: 'relative' }}>
            <span style={{ fontSize: folderIconSize, filter: 'drop-shadow(0 4px 6px rgba(245,158,11,0.25))' }}>📁</span>
            {containedItemCount > 0 && (
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
                {containedItemCount}
              </span>
            )}
          </div>

          {/* Folder Title */}
          {isEditingName ? (
            <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '3px', width: '100%', padding: '0 4px' }}>
              <input
                type="text"
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                autoFocus
                style={{ padding: '2px 4px', fontSize: '0.78rem', fontWeight: 800, borderRadius: '6px', border: '1.5px solid #2563eb', outline: 'none', width: '100%', textAlign: 'center' }}
              />
              <button type="submit" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 5px', fontSize: '0.7rem', fontWeight: 800 }}>✓</button>
              <button type="button" onClick={() => setIsEditingName(false)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 5px', fontSize: '0.7rem', fontWeight: 800 }}>✕</button>
            </form>
          ) : (
            <div style={{
              fontWeight: 800,
              fontSize: '0.82rem',
              color: '#0f172a',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 4px'
            }} title={item.name}>
              {item.name}
            </div>
          )}

          {/* Privacy badge */}
          {onManagePermissions && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onManagePermissions(item);
              }}
              style={{
                background: privacyBadge.bg,
                border: `1px solid ${privacyBadge.border}`,
                color: privacyBadge.color,
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
              title={`הרשאות תיקייה: ${privacyBadge.text} (לחץ לעריכה)`}
            >
              <span>{privacyBadge.icon}</span>
              <span>{privacyBadge.text}</span>
            </button>
          )}

          {/* Action buttons row */}
          {!isMultiSelect && (
            <div style={{ display: 'flex', gap: '3px', marginTop: '0.2rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(item)}
                  style={{ background: item.isFavorite ? '#fef3c7' : '#f8fafc', border: item.isFavorite ? '1px solid #f59e0b' : '1px solid #cbd5e1', borderRadius: '5px', padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                  title={item.isFavorite ? 'הסר ממועדפים' : 'סמן כמועדף'}
                >
                  {item.isFavorite ? '⭐' : '☆'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '1px 4px', fontSize: '0.68rem', cursor: 'pointer' }}
                title="ערוך שם"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => onManageLink(item)}
                style={{ background: isPublicLinkActive ? '#ecfdf5' : '#f8fafc', border: isPublicLinkActive ? '1px solid #10b981' : '1px solid #cbd5e1', color: isPublicLinkActive ? '#047857' : '#4f46e5', borderRadius: '5px', padding: '1px 5px', fontSize: '0.68rem', cursor: 'pointer' }}
                title="לינק שיתוף"
              >
                🔗
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '5px', padding: '1px 4px', fontSize: '0.68rem', cursor: 'pointer' }}
                title="מחק לסל אשפה"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      );
    }

    // LIST VIEW FOR FOLDER (Uniform with DocumentsWidget List Mode)
    return (
      <div
        onTouchStart={startLongPress}
        onTouchMove={cancelLongPress}
        onTouchEnd={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onClick={() => {
          if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            return;
          }
          if (isMultiSelect && onToggleSelect) onToggleSelect(item);
          else onOpen(item);
        }}
        style={{
          background: isSelected ? '#eff6ff' : (item.isFavorite ? '#fffdf7' : '#ffffff'),
          borderRadius: '12px',
          border: isSelected
            ? '2px solid #2563eb'
            : (item.isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0'),
          padding: '0.55rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.02)',
          transition: 'all 0.15s ease',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
          {isMultiSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(item)}
              onClick={e => e.stopPropagation()}
              style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
            />
          )}
          <span style={{ fontSize: '1.6rem', filter: 'drop-shadow(0 2px 4px rgba(245,158,11,0.25))', flexShrink: 0 }}>📁</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            {isEditingName ? (
              <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', maxWidth: '280px' }}>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  autoFocus
                  style={{ padding: '2px 6px', fontSize: '0.85rem', fontWeight: 800, borderRadius: '6px', border: '1.5px solid #2563eb', outline: 'none', flex: 1 }}
                />
                <button type="submit" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 800 }}>✓</button>
                <button type="button" onClick={() => setIsEditingName(false)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.75rem', fontWeight: 800 }}>✕</button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
                {onManagePermissions && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onManagePermissions(item);
                    }}
                    style={{
                      fontSize: '0.66rem',
                      background: privacyBadge.bg,
                      color: privacyBadge.color,
                      border: `1px solid ${privacyBadge.border}`,
                      padding: '1px 6px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                    title={`הרשאות תיקייה: ${privacyBadge.text} (לחץ לעריכה)`}
                  >
                    <span>{privacyBadge.icon}</span>
                    <span>{privacyBadge.text}</span>
                  </button>
                )}
                {isPublicLinkActive && (
                  <span style={{ fontSize: '0.66rem', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, border: '1px solid #a7f3d0' }}>
                    🔗 לינק פעיל
                  </span>
                )}
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
              {containedItemCount > 0 ? `${containedItemCount} פריטים • ` : ''}{new Date(item.createdAt).toLocaleDateString('he-IL')}
            </div>
          </div>
        </div>

        {/* Action icons for folder in List View */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              style={{ background: item.isFavorite ? '#fef3c7' : '#f8fafc', border: item.isFavorite ? '1px solid #f59e0b' : '1px solid #cbd5e1', borderRadius: '7px', padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
              title={item.isFavorite ? 'הסר ממועדפים' : 'סמן כמועדף'}
            >
              {item.isFavorite ? '⭐' : '☆'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
            title="ערוך שם"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onManageLink(item)}
            style={{ background: isPublicLinkActive ? '#ecfdf5' : '#f8fafc', border: isPublicLinkActive ? '1px solid #10b981' : '1px solid #cbd5e1', color: isPublicLinkActive ? '#047857' : '#4f46e5', borderRadius: '7px', padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
            title="לינק שיתוף"
          >
            🔗
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '3px 7px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
            title="מחק תיקייה"
          >
            🗑️
          </button>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem', marginRight: '4px' }}>❯</span>
        </div>
      </div>
    );
  }

  // FILE / DOCUMENT CARD VIEW (Identical Flagship Layout to Vault Document Card)
  if (viewMode === 'list') {
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
        <div
          onTouchStart={startLongPress}
          onTouchMove={cancelLongPress}
          onTouchEnd={cancelLongPress}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onContextMenu={(e) => {
            if (!onContextMenuAction || isMultiSelect) return;
            e.preventDefault();
            e.stopPropagation();
            cancelLongPress();
            onContextMenuAction(item, e.clientX, e.clientY);
          }}
          onClick={() => {
            if (isLongPressTriggeredRef.current) {
              isLongPressTriggeredRef.current = false;
              return;
            }
            if (isMultiSelect && onToggleSelect) onToggleSelect(item);
            else onOpen(item);
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: isMultiSelect ? '26px 36px 30px 38px minmax(130px, 1fr) 95px 125px' : '36px 30px 38px minmax(130px, 1fr) 95px 125px',
            minWidth: isMultiSelect ? '475px' : '445px',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.6rem',
            background: isSelected ? '#eff6ff' : (item.isFavorite ? '#fffbeb' : '#ffffff'),
            border: isSelected ? '1.5px solid #3b82f6' : (item.isFavorite ? '1.5px solid #f59e0b' : '1px solid #e2e8f0'),
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'background 0.15s ease, box-shadow 0.2s ease',
            boxShadow: item.isFavorite ? '0 2px 6px rgba(245,158,11,0.15)' : '0 1px 2px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={(e) => { if (!isSelected && !item.isFavorite) e.currentTarget.style.background = '#f8fafc'; }}
          onMouseLeave={(e) => { if (!isSelected && !item.isFavorite) e.currentTarget.style.background = '#ffffff'; }}
        >
        {isMultiSelect && (
          <div style={{ textAlign: 'center' }}>
            <input
              type="checkbox"
              checked={isSelected}
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
          #{typeof itemIndex === 'number' ? itemIndex + 1 : 1}
        </div>

        {/* Favorite Star Toggle */}
        <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '2px',
                lineHeight: 1
              }}
              title={item.isFavorite ? 'הסר ממועדפים' : 'סמן כמועדף'}
            >
              {item.isFavorite ? '⭐' : '☆'}
            </button>
          )}
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
          {previewUrl && !isCad ? (
            <img
              src={previewUrl}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : isCad ? (
            <span style={{ fontSize: '1.2rem' }}>📐</span>
          ) : isPdf ? (
            <span style={{ fontSize: '1.2rem' }}>📑</span>
          ) : (
            <span style={{ fontSize: '1.2rem' }}>📄</span>
          )}
        </div>

        {/* Title & Info */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name}
            </span>
            {item.isFavorite && (
              <span style={{ fontSize: '0.62rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>
                מועדף
              </span>
            )}
            {isPublicLinkActive && (
              <span style={{ fontSize: '0.62rem', color: '#047857', background: '#ecfdf5', padding: '1px 5px', borderRadius: '4px', fontWeight: 800, flexShrink: 0 }}>
                🔗 לינק פעיל
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
            {item.creatorName && (
              <span style={{ fontSize: '0.64rem', color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }} title={`הועלה ע"י: ${item.creatorName}`}>
                👤 {item.creatorName}
              </span>
            )}
          </div>
        </div>

        {/* Date & Size */}
        <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span>{new Date(item.createdAt).toLocaleDateString('he-IL')}</span>
          {item.size ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.62rem', background: formatInfo.badgeBg, color: formatInfo.badgeColor, padding: '1px 5px', borderRadius: '4px', fontWeight: 800, border: `1px solid ${formatInfo.badgeBorder}` }}>
                {formatInfo.tag}
              </span>
              <span style={{ fontSize: '0.62rem', background: '#f1f5f9', color: '#334155', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0' }} title="גודל הקובץ">
                ⚖️ {formatFileSize(item.size)}
              </span>
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          {onManagePermissions && (
            <button
              type="button"
              onClick={() => onManagePermissions(item)}
              title={`פרטיות והרשאות: ${privacyBadge.text}`}
              style={{ background: privacyBadge.bg, color: privacyBadge.color, border: `1px solid ${privacyBadge.border}`, borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
            >
              {privacyBadge.icon}
            </button>
          )}
          <button
            type="button"
            onClick={() => onManageLink(item)}
            title="שתף קישור"
            style={{ background: isPublicLinkActive ? '#ecfdf5' : '#f0fdf4', color: isPublicLinkActive ? '#047857' : '#059669', border: isPublicLinkActive ? '1px solid #10b981' : '1px solid #a7f3d0', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            🔗
          </button>
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            title="ערוך שם"
            style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            title="מחק לסל אשפה"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '2px 5px', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
    );
  }

  // Grid views: grid_medium / grid_large
  const docCardHeight = viewMode === 'grid_large' ? '185px' : '135px';

  return (
    <div
      onTouchStart={startLongPress}
      onTouchMove={cancelLongPress}
      onTouchEnd={cancelLongPress}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onContextMenu={(e) => {
        if (!onContextMenuAction || isMultiSelect) return;
        e.preventDefault();
        e.stopPropagation();
        cancelLongPress();
        onContextMenuAction(item, e.clientX, e.clientY);
      }}
      onClick={() => {
        if (isLongPressTriggeredRef.current) {
          isLongPressTriggeredRef.current = false;
          return;
        }
        if (isMultiSelect && onToggleSelect) onToggleSelect(item);
        else onOpen(item);
      }}
      style={{
        background: isSelected ? '#eff6ff' : (item.isFavorite ? '#fffdf7' : '#ffffff'),
        borderRadius: '14px',
        overflow: 'visible',
        border: isSelected
          ? '2px solid #2563eb'
          : (item.isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0'),
        position: 'relative',
        boxShadow: isSelected
          ? '0 6px 16px rgba(37,99,235,0.2)'
          : (item.isFavorite ? '0 4px 14px rgba(245,158,11,0.22)' : '0 2px 4px rgba(0,0,0,0.03)'),
        display: 'flex',
        flexDirection: 'column',
        cursor: isMultiSelect ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Checkbox Overlay */}
      {isMultiSelect && (
        <div style={{
          position: 'absolute',
          top: '6px',
          left: '6px',
          zIndex: 25,
          background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.9)',
          color: 'white',
          borderRadius: '6px',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: isSelected ? 'none' : '1.5px solid #94a3b8',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          fontSize: '0.75rem',
          fontWeight: 'bold'
        }}>
          {isSelected ? '✓' : ''}
        </div>
      )}

      {/* Preview Container */}
      <div
        style={{
          height: docCardHeight,
          background: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderTopLeftRadius: '13px',
          borderTopRightRadius: '13px',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt={item.name || 'תצוגה מקדימה'}
            onError={() => setThumbFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
          />
        )}
        {/* Index Badge */}
        {typeof itemIndex === 'number' && (
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
            #{itemIndex + 1}
          </div>
        )}

        {/* Favorite Star Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item);
            }}
            style={{
              position: 'absolute',
              top: '6px',
              left: isMultiSelect ? '32px' : '6px',
              zIndex: 26,
              background: item.isFavorite ? '#fef3c7' : 'rgba(255,255,255,0.9)',
              border: item.isFavorite ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
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
            title={item.isFavorite ? 'הסר ממועדפים' : 'סמן כמועדף'}
          >
            <span>{item.isFavorite ? '⭐' : '☆'}</span>
          </button>
        )}

        {/* Fallback Icon / PDFium Live Thumbnail / Crisp CAD Blueprint Card */}
        {!previewUrl && (
          isPdf && (item.rawPdfUrl || item.url) ? (
            <PdfThumbnail url={item.rawPdfUrl || item.url} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#ffffff' }} />
          ) : isCad ? (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #1e293b 0%, #312e81 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              color: '#e0e7ff',
              padding: '8px',
              textAlign: 'center',
              backgroundImage: 'radial-gradient(rgba(129, 140, 248, 0.22) 1px, transparent 1px)',
              backgroundSize: '14px 14px'
            }}>
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>📐</span>
              <span style={{
                background: 'rgba(99, 102, 241, 0.92)',
                color: '#ffffff',
                padding: '2px 9px',
                borderRadius: '999px',
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.03em'
              }}>
                {formatInfo.tag} • שרטוט CAD
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '2.5rem' }}>📄</span>
          )
        )}

        {/* Cloud Badge (☁️ ענן) */}
        <div style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          background: 'rgba(37, 99, 235, 0.9)',
          color: 'white',
          padding: '1px 5px',
          borderRadius: '5px',
          fontSize: '0.6rem',
          fontWeight: 700
        }}>
          ☁️ ענן
        </div>

        {/* Multi-page badge */}
        {item.pages && item.pages.length > 1 && (
          <div style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            background: 'rgba(15, 23, 42, 0.85)',
            color: 'white',
            padding: '1px 5px',
            borderRadius: '4px',
            fontSize: '0.6rem',
            fontWeight: 800
          }}>
            {item.pages.length}p
          </div>
        )}
      </div>

      {/* Content Details */}
      <div style={{ padding: '0.4rem 0.5rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.15rem' }}>
        {/* Title */}
        {isEditingName ? (
          <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '3px', width: '100%' }}>
            <input
              type="text"
              value={editNameValue}
              onChange={e => setEditNameValue(e.target.value)}
              autoFocus
              style={{ fontSize: '0.8rem', fontWeight: 800, padding: '2px 4px', borderRadius: '6px', border: '1.5px solid #2563eb', outline: 'none', flex: 1, minWidth: 0 }}
            />
            <button type="submit" style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 5px', fontSize: '0.72rem', fontWeight: 800 }}>✓</button>
            <button type="button" onClick={() => setIsEditingName(false)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 5px', fontSize: '0.72rem', fontWeight: 800 }}>✕</button>
          </form>
        ) : (
          <div
            onClick={(e) => {
              if (isMultiSelect) return;
              e.stopPropagation();
              setIsEditingName(true);
            }}
            style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
            title="לחץ לשינוי שם"
          >
            {item.name}
          </div>
        )}

        {/* Favorite Badge */}
        {item.isFavorite && (
          <div>
            <span style={{ fontSize: '0.62rem', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: 800, border: '1px solid #fcd34d' }}>
              ⭐ הצעה מועדפת
            </span>
          </div>
        )}

        {/* Metadata: Date, Size, Creator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: '#64748b' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span>{new Date(item.createdAt).toLocaleDateString('he-IL')}</span>
            <span style={{ fontSize: '0.6rem', background: formatInfo.badgeBg, color: formatInfo.badgeColor, padding: '1px 4px', borderRadius: '4px', fontWeight: 800, border: `1px solid ${formatInfo.badgeBorder}` }}>
              {formatInfo.tag}
            </span>
            {item.size ? (
              <span style={{ fontSize: '0.6rem', background: '#f1f5f9', color: '#334155', padding: '1px 4px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                ⚖️ {formatFileSize(item.size)}
              </span>
            ) : null}
            {item.creatorName && (
              <span style={{ fontSize: '0.6rem', color: '#475569', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px' }}>
                👤 {item.creatorName}
              </span>
            )}
          </span>
        </div>

        {/* Bottom Action Bar */}
        {!isMultiSelect && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {/* Privacy Badge button */}
              {onManagePermissions && (
                <button
                  type="button"
                  onClick={() => onManagePermissions(item)}
                  style={{ background: privacyBadge.bg, color: privacyBadge.color, border: `1px solid ${privacyBadge.border}`, padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                  title={`פרטיות והרשאות: ${privacyBadge.text}`}
                >
                  {privacyBadge.icon}
                </button>
              )}

              {/* Share link button */}
              <button
                type="button"
                onClick={() => onManageLink(item)}
                style={{ background: isPublicLinkActive ? '#ecfdf5' : '#f0fdf4', color: isPublicLinkActive ? '#047857' : '#059669', border: isPublicLinkActive ? '1px solid #10b981' : '1px solid #a7f3d0', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                title="שתף קישור חיצוני"
              >
                🔗
              </button>

              {/* Unified Cut/Copy/Paste happens via Long-Press / Right-Click Context Menu */}
            </div>

            {/* Dots Menu */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowDotsMenu(!showDotsMenu)}
                style={{ background: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '1px 4px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                ⋮
              </button>

              {showDotsMenu && (
                <>
                  <div onClick={() => setShowDotsMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                  <div style={{ position: 'absolute', bottom: '120%', left: 0, background: 'white', borderRadius: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', padding: '0.45rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '160px', direction: 'rtl' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDotsMenu(false);
                        onOpen(item);
                      }}
                      style={{ background: 'transparent', border: 'none', padding: '0.45rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}
                    >
                      👁️ צפה בקובץ
                    </button>
                    {hasScanner && onEditInScanner && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDotsMenu(false);
                          onEditInScanner(item);
                        }}
                        style={{ background: 'transparent', border: 'none', padding: '0.45rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <span>✂️</span>
                        <span>עריכה בסורק</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDotsMenu(false);
                        setIsEditingName(true);
                      }}
                      style={{ background: 'transparent', border: 'none', padding: '0.45rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}
                    >
                      ✏️ ערוך שם
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDotsMenu(false);
                        onDelete(item);
                      }}
                      style={{ background: 'transparent', border: 'none', padding: '0.45rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}
                    >
                      🗑️ העבר לסל אשפה
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
}
