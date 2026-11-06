'use client';

import React from 'react';
import { FileShareItem, formatFileSize } from '@/utils/fileShareUtils';

interface FileShareItemCardProps {
  item: FileShareItem;
  onOpen: (item: FileShareItem) => void;
  onManageLink: (item: FileShareItem) => void;
  onManagePermissions?: (item: FileShareItem) => void;
  onDelete: (item: FileShareItem) => void;
}

export function FileShareItemCard({
  item,
  onOpen,
  onManageLink,
  onManagePermissions,
  onDelete
}: FileShareItemCardProps) {
  const isFolder = item.type === 'folder';
  const isPublicLinkActive = Boolean(item.shareLink?.enabled && item.shareLink?.token);
  const isOnlyMe = Array.isArray(item.allowedPartners) && item.allowedPartners.includes('__only_me__');
  const isOnlyAdmins = Array.isArray(item.allowedPartners) && item.allowedPartners.includes('__creator_vault_secret__');
  const isRestricted = Array.isArray(item.allowedPartners) && item.allowedPartners.length > 0;

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
    return { text: '🌐 פתוח', bg: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', title: 'פתוח לכל חברי המרחב (לחץ לעריכת הרשאות)' };
  };

  const privacyBadge = getPrivacyBadge();

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
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }}
      onClick={() => onOpen(item)}
    >
      {/* Right side: Icon + Name + Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: isFolder ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          flexShrink: 0
        }}>
          {getItemIcon()}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <h4 style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
              lineHeight: 1.3
            }}>
              {item.name}
            </h4>

            {/* Privacy Badge (Rule 20) */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            {!isFolder && item.size ? <span>{formatFileSize(item.size)}</span> : null}
            {!isFolder && item.pages && item.pages.length > 1 ? <span>• {item.pages.length} עמודים</span> : null}
            <span>• {new Date(item.createdAt).toLocaleDateString('he-IL')}</span>

            {/* Public Link Badge */}
            {isPublicLinkActive && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onManageLink(item);
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#047857',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  cursor: 'pointer'
                }}
                title="לחץ לעריכת קישור השיתוף או שיתוף בוואטסאפ / אימייל"
              >
                🔗 קישור חיצוני פעיל {item.shareLink?.viewCount ? `• 👁️ ${item.shareLink.viewCount}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Left side: Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {/* Share Link Button */}
        <button
          type="button"
          onClick={() => onManageLink(item)}
          style={{
            background: isPublicLinkActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-main, #f1f5f9)',
            border: isPublicLinkActive ? '1.5px solid #10b981' : '1px solid var(--border-light, #cbd5e1)',
            color: isPublicLinkActive ? '#047857' : 'var(--primary, #4f46e5)',
            padding: '0.4rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-sm)'
          }}
          title="צור קישור כניסה / שיתוף לצפייה חיצונית (וואטסאפ, אימייל)"
        >
          <span>🔗</span>
          <span>{isPublicLinkActive ? 'ניהול לינק' : 'שלח לינק'}</span>
        </button>

        {/* Delete Button */}
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
  );
}
