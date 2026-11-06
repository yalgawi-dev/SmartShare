'use client';

import React, { useState, useEffect } from 'react';
import { FileShareItem, formatFileSize } from '@/utils/fileShareUtils';
import PdfThumbnail from '@/components/shared/PdfThumbnail';

interface FileShareItemCardProps {
  item: FileShareItem;
  onOpen: (item: FileShareItem) => void;
  onManageLink: (item: FileShareItem) => void;
  onManagePermissions?: (item: FileShareItem) => void;
  onRename?: (item: FileShareItem, newName: string) => void;
  onDelete: (item: FileShareItem) => void;
}

export function FileShareItemCard({
  item,
  onOpen,
  onManageLink,
  onManagePermissions,
  onRename,
  onDelete
}: FileShareItemCardProps) {
  const isFolder = item.type === 'folder';
  const isPublicLinkActive = Boolean(item.shareLink?.enabled && item.shareLink?.token);
  const isOnlyMe = Array.isArray(item.allowedPartners) && item.allowedPartners.includes('__only_me__');
  const isOnlyAdmins = Array.isArray(item.allowedPartners) && item.allowedPartners.includes('__creator_vault_secret__');
  const isRestricted = Array.isArray(item.allowedPartners) && item.allowedPartners.length > 0;

  // Inline rename state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(item.name);

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

  const getPrivacyBadge = () => {
    if (isOnlyMe) {
      return { text: '👤 רק לעצמי', bg: '#fef3c7', color: '#92400e', title: 'גלוי רק לעצמך ולמנהל המרחב' };
    }
    if (isOnlyAdmins) {
      return { text: '🛡️ מנהלים', bg: '#fee2e2', color: '#991b1b', title: 'גלוי למנהלי המרחב בלבד' };
    }
    if (isRestricted) {
      return { text: '🔒 מוגבל', bg: '#ede9fe', color: '#6d28d9', title: 'גלוי לשותפים נבחרים בלבד' };
    }
    return { text: '🌐 פתוח לכולם', bg: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary, #4f46e5)', title: 'פתוח לכל חברי המרחב (לחץ להגדרת הרשאות)' };
  };

  const privacyBadge = getPrivacyBadge();

  // Preview thumbnail detection
  const isPdf = item.fileType === 'pdf' || (item.url && item.url.toLowerCase().includes('.pdf'));
  const previewUrl = item.thumbnailUrl || (Array.isArray(item.pages) && item.pages.length > 0 ? item.pages[0] : (!isPdf && item.url ? item.url : ''));

  const getItemIcon = () => {
    if (isFolder) return '📁';
    if (item.fileType === 'pdf') return '📕';
    if (item.fileType === 'image') return '🖼️';
    if (item.fileType === 'sheet') return '📊';
    return '📄';
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--border-light, #e2e8f0)',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }}
      onClick={() => onOpen(item)}
    >
      {/* Top Row: Thumbnail + Title & Privacy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minWidth: 0 }}>
        {/* Real Thumbnail (48x48) */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: isFolder ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.08)',
          border: '1px solid var(--border-light, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          flexShrink: 0,
          position: 'relative'
        }}>
          {isFolder ? (
            '📁'
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : isPdf && item.url ? (
            <PdfThumbnail url={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            getItemIcon()
          )}
          {!isFolder && item.pages && item.pages.length > 1 && (
            <span style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              background: 'rgba(15,23,42,0.85)',
              color: 'white',
              fontSize: '0.55rem',
              padding: '1px 3px',
              borderRadius: '4px',
              fontWeight: 800
            }}>
              {item.pages.length}p
            </span>
          )}
        </div>

        {/* Title Container: 100% full width, nowrap with ellipsis */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditingName ? (
            <form
              onSubmit={handleRenameSubmit}
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}
            >
              <input
                type="text"
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                autoFocus
                style={{
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--primary, #4f46e5)',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  outline: 'none',
                  flex: 1,
                  minWidth: 0
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 800
                }}
                title="שמור שם"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(false);
                  setEditNameValue(item.name);
                }}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 800
                }}
                title="בטל"
              >
                ✕
              </button>
            </form>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%', minWidth: 0 }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.94rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    direction: 'rtl',
                    flex: 1,
                    minWidth: 0
                  }}
                  title={item.name}
                >
                  {item.name}
                </h4>
                {onRename && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingName(true);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '0.78rem',
                      opacity: 0.6,
                      lineHeight: 1,
                      flexShrink: 0
                    }}
                    title="ערוך שם"
                  >
                    ✏️
                  </button>
                )}
              </div>

              {/* Sub-line: Privacy Badge */}
              <div style={{ marginTop: '3px' }}>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onManagePermissions) onManagePermissions(item);
                  }}
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: privacyBadge.bg,
                    color: privacyBadge.color,
                    fontWeight: 700,
                    cursor: onManagePermissions ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  title={privacyBadge.title}
                >
                  {privacyBadge.text}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Metadata & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.45rem',
          borderTop: '1px solid rgba(226, 232, 240, 0.6)',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Metadata info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
          {!isFolder && item.size ? <span>{formatFileSize(item.size)}</span> : null}
          {!isFolder && item.pages && item.pages.length > 1 ? <span>• {item.pages.length} עמודים</span> : null}
          <span>• {new Date(item.createdAt).toLocaleDateString('he-IL')}</span>
          {isPublicLinkActive && (
            <span
              onClick={() => onManageLink(item)}
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#047857',
                padding: '2px 6px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.68rem',
                cursor: 'pointer'
              }}
              title="לחץ לעריכת קישור השיתוף או שיתוף בוואטסאפ / אימייל"
            >
              🔗 לינק פעיל {item.shareLink?.viewCount ? `• 👁️ ${item.shareLink.viewCount}` : ''}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => onManageLink(item)}
            style={{
              background: isPublicLinkActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-main, #f1f5f9)',
              border: isPublicLinkActive ? '1.5px solid #10b981' : '1px solid var(--border-light, #cbd5e1)',
              color: isPublicLinkActive ? '#047857' : 'var(--primary, #4f46e5)',
              padding: '0.35rem 0.7rem',
              borderRadius: '10px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-xs)'
            }}
            title="צור קישור כניסה / שיתוף לצפייה חיצונית (וואטסאפ, אימייל)"
          >
            <span>🔗</span>
            <span>{isPublicLinkActive ? 'ניהול לינק' : 'שלח לינק'}</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(item)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '0.35rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
            title="מחק"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}