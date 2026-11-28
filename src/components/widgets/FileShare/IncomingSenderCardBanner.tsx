'use client';

import React from 'react';
import type { FileShareItem } from '@/utils/fileShareUtils';

interface IncomingSenderCardBannerProps {
  folder: FileShareItem;
  allItems: FileShareItem[];
  filesCount: number;
  onOpenChat?: (channelId: string) => void;
}

/**
 * Modular Sender Business Card displayed at the top of any incoming guest/contractor submission folder.
 * Works both for new folders (with structured `senderContactCard`) AND retroactively for existing folders
 * by matching `shareLink.recipients[]` and parsing phone/name from `creatorName`.
 */
export const IncomingSenderCardBanner: React.FC<IncomingSenderCardBannerProps> = ({
  folder,
  allItems,
  filesCount,
  onOpenChat,
}) => {
  const cleanFolderBaseName = (folder.name || '')
    .replace(/^📥\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();

  // 1. Try structured card first
  let name = folder.senderContactCard?.name || cleanFolderBaseName || 'שולח חיצוני';
  let phone = folder.senderContactCard?.phone || '';
  let profession = folder.senderContactCard?.profession || '';
  let roleLabel = folder.senderContactCard?.roleLabel || '';
  let chatChannelId = folder.senderContactCard?.chatChannelId || '';

  // 2. Enrich retroactively from matching shareLink.recipients[] across the space
  const subRecipientId = folder.id.startsWith('sub_folder_') ? folder.id.replace('sub_folder_', '') : '';
  if (!phone || !profession || !chatChannelId) {
    for (const it of allItems) {
      const recs = it.shareLink?.recipients;
      if (!Array.isArray(recs)) continue;
      const match = recs.find(
        (r) =>
          (subRecipientId && r.id === subRecipientId) ||
          (cleanFolderBaseName && (r.recipientName || '').trim().toLowerCase() === cleanFolderBaseName.toLowerCase())
      );
      if (match) {
        if (!name || name === 'שולח חיצוני') name = match.recipientName || name;
        if (!phone && match.phone) phone = match.phone;
        if (!profession && match.profession) profession = match.profession;
        if (!chatChannelId && (match.chatChannelId || match.id)) {
          chatChannelId = match.chatChannelId || `guest_${match.id}`;
        }
        if (!roleLabel && match.role) {
          roleLabel = match.role === 'provider' ? 'ספק / קבלן' : match.role === 'client' ? 'לקוח' : '';
        }
        break;
      }
    }
  }

  // 3. Fallback phone extraction from creatorName (e.g. "ארקור בנייה (0527433886)")
  if (!phone && folder.creatorName) {
    const phoneMatch = folder.creatorName.match(/0\d[\d\s-]{7,11}/);
    if (phoneMatch) phone = phoneMatch[0].trim();
  }

  const digits = phone.replace(/\D/g, '');
  const waDigits = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;

  return (
    <div
      dir="rtl"
      style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)',
        border: '1.5px solid #c7d2fe',
        borderRadius: '16px',
        padding: '0.8rem 0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem',
              flexShrink: 0,
            }}
          >
            🏢
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#4f46e5' }}>
              כרטיס ביקור של השולח
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0f172a', wordBreak: 'break-word' }}>
              {name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '2px' }}>
              {profession && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: '#e0e7ff',
                    color: '#3730a3',
                    padding: '1px 7px',
                    borderRadius: '999px',
                  }}
                >
                  🛠️ {profession}
                </span>
              )}
              {roleLabel && !profession && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    background: '#f1f5f9',
                    color: '#475569',
                    padding: '1px 7px',
                    borderRadius: '999px',
                  }}
                >
                  {roleLabel}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: '#ecfdf5',
                  color: '#047857',
                  padding: '1px 7px',
                  borderRadius: '999px',
                }}
              >
                📎 {filesCount} {filesCount === 1 ? 'קובץ' : 'קבצים'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Tap Direct Contact Actions */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {phone && (
          <a
            href={`tel:${phone}`}
            style={{
              flex: 1,
              minWidth: '110px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.48rem 0.65rem',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1.5px solid #bfdbfe',
              color: '#1d4ed8',
              fontWeight: 900,
              fontSize: '0.78rem',
              textDecoration: 'none',
            }}
          >
            <span>📞</span>
            <span dir="ltr">{phone}</span>
          </a>
        )}
        {waDigits.length >= 9 && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              minWidth: '105px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.48rem 0.65rem',
              borderRadius: '10px',
              background: '#dcfce7',
              border: '1.5px solid #86efac',
              color: '#15803d',
              fontWeight: 900,
              fontSize: '0.78rem',
              textDecoration: 'none',
            }}
          >
            <span>💬</span>
            <span>וואטסאפ</span>
          </a>
        )}
        {chatChannelId && onOpenChat && (
          <button
            type="button"
            onClick={() => onOpenChat(chatChannelId)}
            style={{
              flex: 1,
              minWidth: '105px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.48rem 0.65rem',
              borderRadius: '10px',
              background: '#4f46e5',
              border: 'none',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            <span>✉️</span>
            <span>הודעה</span>
          </button>
        )}
      </div>
    </div>
  );
};
