'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileShareItem, formatFileSize } from '@/utils/fileShareUtils';
import PdfThumbnail from '@/components/shared/PdfThumbnail';

interface FileShareItemCardProps {
  item: FileShareItem;
  itemIndex?: number;
  onOpen: (item: FileShareItem) => void;
  onManageLink: (item: FileShareItem) => void;
  onManagePermissions?: (item: FileShareItem) => void;
  onRename?: (item: FileShareItem, newName: string) => void;
  onDelete: (item: FileShareItem) => void;
  onMove?: (item: FileShareItem) => void;
  onToggleFavorite?: (item: FileShareItem) => void;
  onEditInScanner?: (item: FileShareItem) => void;
  hasScanner?: boolean;
  isMultiSelect?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: FileShareItem) => void;
  onLongPressSelect?: (item: FileShareItem) => void;
}

export function FileShareItemCard({
  item,
  itemIndex,
  onOpen,
  onManageLink,
  onManagePermissions,
  onRename,
  onDelete,
  onMove,
  onToggleFavorite,
  onEditInScanner,
  hasScanner = false,
  isMultiSelect = false,
  isSelected = false,
  onToggleSelect,
  onLongPressSelect
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

  const startLongPress = () => {
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (onLongPressSelect) {
        onLongPressSelect(item);
      } else if (onToggleSelect) {
        onToggleSelect(item);
      }
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

  const getPrivacyBadge = () => {
    if (isOnlyMe) {
      return { icon: '👤', text: 'רק לעצמי', bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
    }
    if (isOnlyAdmins) {
      return { icon: '🛡️', text: 'מנהלים', bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
    }
    if (isRestricted) {
      return { icon: '🔒', text: 'מוגבל', bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' };
    }
    return { icon: '🌐', text: 'פתוח לכולם', bg: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary, #4f46e5)', border: 'rgba(99, 102, 241, 0.25)' };
  };

  const privacyBadge = getPrivacyBadge();

  // Preview thumbnail detection
  const isPdf = item.fileType === 'pdf' || (item.url && item.url.toLowerCase().includes('.pdf'));
  const previewUrl = item.thumbnailUrl || (Array.isArray(item.pages) && item.pages.length > 0 ? item.pages[0] : (!isPdf && item.url ? item.url : ''));

  // FOLDER CARD VIEW (Uniform with Vault Folders)
  if (isFolder) {
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
          borderRadius: '14px',
          border: isSelected
            ? '2px solid #2563eb'
            : (item.isFavorite ? '2px solid #f59e0b' : '1px solid #e2e8f0'),
          padding: '0.75rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden', flex: 1 }}>
          {isMultiSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(item)}
              onClick={e => e.stopPropagation()}
              style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
          )}
          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📁</span>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            {isEditingName ? (
              <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setIsEditingName(true); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', opacity: 0.6 }}
                  title="ערוך שם"
                >
                  ✏️
                </button>
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{new Date(item.createdAt).toLocaleDateString('he-IL')}</span>
              {isPublicLinkActive && (
                <span style={{ color: '#047857', fontWeight: 700 }}>• 🔗 לינק פעיל</span>
              )}
            </div>
          </div>
        </div>

        {/* Action icons for folder */}
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
          {onManagePermissions && (
            <button
              type="button"
              onClick={() => onManagePermissions(item)}
              style={{ background: privacyBadge.bg, color: privacyBadge.color, border: `1px solid ${privacyBadge.border}`, borderRadius: '7px', padding: '3px 6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              title={privacyBadge.text}
            >
              {privacyBadge.icon}
            </button>
          )}
          {onMove && (
            <button
              type="button"
              onClick={() => onMove(item)}
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: '7px', padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
              title="העבר תיקייה"
            >
              📦
            </button>
          )}
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
            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '7px', padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
            title="מחק לסל אשפה"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  }

  // FILE / DOCUMENT CARD VIEW (Identical Flagship Layout to Vault Document Card)
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
          height: '135px',
          background: '#e2e8f0',
          backgroundImage: previewUrl ? `url(${previewUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
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

        {/* Fallback Icon / PDF Thumbnail */}
        {!previewUrl && (
          isPdf && item.url ? (
            <PdfThumbnail url={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                📤
              </button>

              {/* Move to folder button */}
              {onMove && (
                <button
                  type="button"
                  onClick={() => onMove(item)}
                  style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '2px 5px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 'bold', cursor: 'pointer' }}
                  title="העבר לתיקייה"
                >
                  📁
                </button>
              )}
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
                    {onMove && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDotsMenu(false);
                          onMove(item);
                        }}
                        style={{ background: 'transparent', border: 'none', padding: '0.45rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}
                      >
                        📁 העבר לתיקייה
                      </button>
                    )}
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
