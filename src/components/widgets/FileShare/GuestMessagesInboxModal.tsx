'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildGuestReplyWhatsAppUrl } from '@/utils/fileShareUtils';

export interface GuestInboxThread {
  convoId: string;
  guestName: string;
  guestPhone?: string;
  itemName?: string;
  shareToken?: string;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt: number;
  totalMessages: number;
}

interface GuestMessagesInboxModalProps {
  isOpen: boolean;
  threads: GuestInboxThread[];
  onClose: () => void;
  onSelectThread: (convoId: string) => void;
}

function formatShortTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export function GuestMessagesInboxModal({
  isOpen,
  threads,
  onClose,
  onSelectThread,
}: GuestMessagesInboxModalProps) {
  const [search, setSearch] = useState('');

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? threads.filter(
          (t) =>
            t.guestName.toLowerCase().includes(q) ||
            (t.guestPhone || '').includes(q) ||
            (t.itemName || '').toLowerCase().includes(q) ||
            t.lastMessageText.toLowerCase().includes(q)
        )
      : threads;

    return [...list].sort((a, b) => {
      if ((a.unreadCount > 0) !== (b.unreadCount > 0)) {
        return a.unreadCount > 0 ? -1 : 1;
      }
      return b.lastMessageAt - a.lastMessageAt;
    });
  }, [threads, search]);

  if (!isOpen || typeof document === 'undefined') return null;

  const totalUnread = threads.reduce((acc, t) => acc + t.unreadCount, 0);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 999995,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '82vh',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.95rem 1.15rem',
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1rem' }}>
                הודעות אורחים ({threads.length})
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)' }}>
                {totalUnread > 0 ? `${totalUnread} הודעות שלא נקראו` : 'כל ההודעות נקראו ✓'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.16)',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        {threads.length > 3 && (
          <div style={{ padding: '0.7rem 0.9rem 0.35rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 חפש לפי שם שולח, טלפון או תוכן..."
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem',
                borderRadius: '11px',
                border: '1px solid #cbd5e1',
                fontSize: '0.84rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Thread List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            background: '#f8fafc',
          }}
        >
          {filteredThreads.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
              {threads.length === 0
                ? 'אין עדיין הודעות מאורחים בקישורי השיתוף.'
                : 'לא נמצאו התכתבויות תואמות לחיפוש.'}
            </div>
          ) : (
            filteredThreads.map((t) => {
              const waUrl = buildGuestReplyWhatsAppUrl({
                phone: t.guestPhone,
                guestName: t.guestName,
                itemName: t.itemName,
                shareToken: t.shareToken,
              });
              return (
                <div
                  key={t.convoId}
                  onClick={() => onSelectThread(t.convoId)}
                  style={{
                    background: t.unreadCount > 0 ? '#f0fdf4' : '#ffffff',
                    border: t.unreadCount > 0 ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '0.72rem 0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                    transition: 'transform 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                      <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.guestName}
                      </span>
                      {t.unreadCount > 0 && (
                        <span
                          style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '999px',
                            padding: '1px 7px',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            flexShrink: 0,
                          }}
                        >
                          {t.unreadCount} חדש
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, flexShrink: 0 }}>
                      {formatShortTime(t.lastMessageAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.79rem',
                      color: '#334155',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.lastMessageText || 'פתח שיחה'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {t.itemName ? `📁 ${t.itemName}` : ''}
                      {t.guestPhone ? `${t.itemName ? ' • ' : ''}📞 ${t.guestPhone}` : ''}
                    </span>

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📲 עדכן בוואטסאפ
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
