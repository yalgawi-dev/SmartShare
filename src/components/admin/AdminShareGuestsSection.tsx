'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AggregatedShareGuest {
  key: string;
  name: string;
  phone: string;
  totalVisits: number;
  totalDurationSeconds: number;
  firstSeenAt: number;
  lastSeenAt: number;
  isReturning: boolean;
  channels: string[];
  sharedItems: Array<{ title: string; spaceTitle?: string; visits: number; lastSeenAt: number }>;
}

function formatDateTimeHe(ts?: number): string {
  if (!ts || ts <= 0) return 'לא ידוע';
  try {
    return new Date(ts).toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'לא ידוע';
  }
}

function formatDurationShort(sec: number): string {
  if (!sec || sec <= 0) return '< 1 דק׳';
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins === 0) return `${rem} שנ׳`;
  return `${mins} דק׳`;
}

/**
 * Modular Admin Section: External Share Guests Tracker (`shared_links` aggregation).
 * Shows every guest who opened a shared link (name, phone, visit count, returning badge,
 * first/last visit timestamps, dwell time & opened items).
 */
export const AdminShareGuestsSection: React.FC = () => {
  const [guests, setGuests] = useState<AggregatedShareGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyReturning, setOnlyReturning] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const loadGuests = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'shared_links'));
      const map = new Map<string, AggregatedShareGuest>();

      const upsertGuest = (entry: {
        name: string;
        phone: string;
        visits: number;
        duration: number;
        createdAt: number;
        lastViewedAt: number;
        channel?: string;
        itemTitle: string;
        spaceTitle?: string;
        token: string;
      }) => {
        const digits = (entry.phone || '').replace(/\D/g, '');
        const cleanName = (entry.name || '').trim();
        if (!digits && !cleanName) return;

        const key = digits.length >= 7 ? `phone:${digits}` : `name:${cleanName.toLowerCase()}:${entry.token}`;
        const existing = map.get(key);
        const visits = Math.max(entry.visits || 0, entry.lastViewedAt ? 1 : 0);
        const lastTs = entry.lastViewedAt || entry.createdAt || 0;
        const firstTs = entry.createdAt || entry.lastViewedAt || 0;

        if (!existing) {
          map.set(key, {
            key,
            name: cleanName || 'אורח ללא שם',
            phone: entry.phone || '',
            totalVisits: visits,
            totalDurationSeconds: entry.duration || 0,
            firstSeenAt: firstTs,
            lastSeenAt: lastTs,
            isReturning: visits >= 2,
            channels: entry.channel ? [entry.channel] : [],
            sharedItems: [
              {
                title: entry.itemTitle,
                spaceTitle: entry.spaceTitle,
                visits,
                lastSeenAt: lastTs,
              },
            ],
          });
        } else {
          existing.totalVisits += visits;
          existing.totalDurationSeconds += entry.duration || 0;
          if (cleanName && existing.name === 'אורח ללא שם') existing.name = cleanName;
          if (entry.phone && !existing.phone) existing.phone = entry.phone;
          if (firstTs > 0 && (existing.firstSeenAt === 0 || firstTs < existing.firstSeenAt)) {
            existing.firstSeenAt = firstTs;
          }
          if (lastTs > existing.lastSeenAt) {
            existing.lastSeenAt = lastTs;
          }
          if (entry.channel && !existing.channels.includes(entry.channel)) {
            existing.channels.push(entry.channel);
          }
          existing.sharedItems.push({
            title: entry.itemTitle,
            spaceTitle: entry.spaceTitle,
            visits,
            lastSeenAt: lastTs,
          });
          existing.isReturning = existing.totalVisits >= 2 || existing.sharedItems.length >= 2;
        }
      };

      snap.forEach((docSnap) => {
        const d: any = docSnap.data();
        const token = docSnap.id;
        const itemTitle = d.itemName || d.title || 'קובץ / תיקייה משותפת';
        const spaceTitle = d.spaceTitle || '';

        // 1. Multi-recipient & anonymous public link visitors stored in `recipients[]`
        if (Array.isArray(d.recipients) && d.recipients.length > 0) {
          d.recipients.forEach((r: any) => {
            if (!r) return;
            const vCount = Number(r.viewCount || 0);
            if (vCount <= 0 && !r.lastViewedAt) return; // Only count guests who actually entered!
            upsertGuest({
              name: r.recipientName || '',
              phone: r.phone || '',
              visits: vCount,
              duration: Number(r.totalDurationSeconds || 0),
              createdAt: Number(r.createdAt || d.createdAt || 0),
              lastViewedAt: Number(r.lastViewedAt || 0),
              channel: r.sourceChannel || r.origin || '',
              itemTitle,
              spaceTitle,
              token,
            });
          });
        }

        // 2. Direct single-recipient personal link (recipientName/recipientPhone directly on doc)
        if ((d.recipientName || d.recipientPhone) && (Number(d.viewCount || 0) > 0 || d.lastViewedAt)) {
          upsertGuest({
            name: d.recipientName || '',
            phone: d.recipientPhone || '',
            visits: Number(d.viewCount || 1),
            duration: Number(d.totalDurationSeconds || 0),
            createdAt: Number(d.createdAt || 0),
            lastViewedAt: Number(d.lastViewedAt || 0),
            channel: 'קישור אישי',
            itemTitle,
            spaceTitle,
            token,
          });
        }
      });

      const list = Array.from(map.values()).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      setGuests(list);
    } catch (err) {
      console.warn('[AdminShareGuestsSection] failed loading shared_links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuests();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (onlyReturning && !g.isReturning) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.phone.toLowerCase().includes(q) ||
        g.sharedItems.some((it) => it.title.toLowerCase().includes(q) || (it.spaceTitle || '').toLowerCase().includes(q))
      );
    });
  }, [guests, search, onlyReturning]);

  const returningCount = guests.filter((g) => g.isReturning).length;
  const totalVisitsAll = guests.reduce((sum, g) => sum + g.totalVisits, 0);

  return (
    <div
      dir="rtl"
      style={{
        background: '#ffffff',
        borderRadius: '18px',
        border: '1.5px solid #c7d2fe',
        padding: '1rem',
        marginBottom: '1.25rem',
        boxShadow: '0 4px 16px rgba(79,70,229,0.06)',
      }}
    >
      {/* Accordion Header */}
      <div
        onClick={() => setIsOpen((v) => !v)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.2rem' }}>🔗</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1e1b4b' }}>
            אורחים שנכנסו לקישורי שיתוף ({guests.length})
          </h3>
          {returningCount > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 900,
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                borderRadius: '999px',
                padding: '2px 8px',
              }}
            >
              🔄 {returningCount} חוזרים
            </span>
          )}
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              background: '#eef2ff',
              color: '#4338ca',
              borderRadius: '999px',
              padding: '2px 8px',
            }}
          >
            👁️ {totalVisitsAll} כניסות
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              loadGuests();
            }}
            style={{
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              borderRadius: '8px',
              padding: '0.25rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ↻ רענן
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Search & Returning Filter */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="חפש לפי שם אורח, טלפון או שם קובץ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: '180px',
                padding: '0.48rem 0.7rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
              }}
            />
            <button
              type="button"
              onClick={() => setOnlyReturning((v) => !v)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '10px',
                border: onlyReturning ? '2px solid #059669' : '1px solid #cbd5e1',
                background: onlyReturning ? '#ecfdf5' : '#f8fafc',
                color: onlyReturning ? '#065f46' : '#475569',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🔄 {onlyReturning ? 'מציג חוזרים בלבד' : 'סנן חוזרים בלבד'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.84rem' }}>
              טוען רשימת אורחי שיתוף...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.84rem', background: '#f8fafc', borderRadius: '12px' }}>
              לא נמצאו אורחי שיתוף תואמים.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
              {filtered.map((g) => {
                const waDigits = g.phone.replace(/\D/g, '').replace(/^0/, '972');
                return (
                  <div
                    key={g.key}
                    style={{
                      padding: '0.7rem 0.85rem',
                      borderRadius: '13px',
                      border: g.isReturning ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                      background: g.isReturning ? '#f0fdf4' : '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>👤 {g.name}</strong>
                        {g.phone && (
                          <a
                            href={`tel:${g.phone}`}
                            dir="ltr"
                            style={{ fontSize: '0.78rem', fontWeight: 800, color: '#2563eb', textDecoration: 'none' }}
                          >
                            📱 {g.phone}
                          </a>
                        )}
                        {waDigits.length >= 9 && (
                          <a
                            href={`https://wa.me/${waDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '1px 7px',
                              borderRadius: '999px',
                              textDecoration: 'none',
                            }}
                          >
                            💬 וואטסאפ
                          </a>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: g.isReturning ? '#16a34a' : '#e0e7ff',
                          color: g.isReturning ? '#ffffff' : '#3730a3',
                        }}
                      >
                        {g.isReturning ? `🔄 אורח חוזר • ${g.totalVisits} כניסות` : `🆕 ביקור ראשון (${g.totalVisits})`}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#475569', display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span>🕒 כניסה אחרונה: <strong>{formatDateTimeHe(g.lastSeenAt)}</strong></span>
                      {g.firstSeenAt > 0 && g.firstSeenAt !== g.lastSeenAt && (
                        <span>• ראשונה: {formatDateTimeHe(g.firstSeenAt)}</span>
                      )}
                      <span>• ⏱️ שהייה: <strong>{formatDurationShort(g.totalDurationSeconds)}</strong></span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '2px' }}>
                      {g.sharedItems.slice(0, 4).map((it, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '2px 7px',
                            color: '#334155',
                          }}
                        >
                          📄 {it.title}{it.spaceTitle ? ` (${it.spaceTitle})` : ''} • {it.visits}×
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
