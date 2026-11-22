'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import type { FileShareItem, RecipientRole, RecipientShareLink } from '@/utils/fileShareUtils';
import {
  loadSavedShareDirectory,
  saveSavedShareDirectory,
  type SavedShareContact,
  type SavedShareDirectory,
  type SavedShareGroup,
} from '@/utils/shareContactsStore';
import { APP_VERSION } from '@/constants/version';

interface ShareHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceTitle: string;
  items: FileShareItem[];
  wallShareConfig?: any;
  wallShareItem?: FileShareItem;
  onOpenItemShare: (item: FileShareItem) => void;
}

interface AggregatedPersonShare {
  key: string;
  name: string;
  phone?: string;
  role?: RecipientRole;
  totalViews: number;
  entries: Array<{
    item: FileShareItem;
    recipient: RecipientShareLink;
  }>;
}

const GROUP_ICONS = ['🏗️', '📐', '🏠', '🤝', '⚡', '⭐'];

export const ShareHubModal: React.FC<ShareHubModalProps> = ({
  isOpen,
  onClose,
  spaceTitle,
  items,
  wallShareConfig,
  wallShareItem,
  onOpenItemShare,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'people' | 'directory' | 'items'>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Permanent Address Book & Groups state
  const [directory, setDirectory] = useState<SavedShareDirectory>({ contacts: [], groups: [], updatedAt: 0 });
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState<RecipientRole>('provider');

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('🏗️');
  const [selectedGroupContactIds, setSelectedGroupContactIds] = useState<string[]>([]);

  useHardwareBack(isOpen, onClose, 'share_hub_modal');

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    loadSavedShareDirectory(user.id).then(setDirectory).catch(() => {});
  }, [isOpen, user?.id]);

  // Collect all shareable items (wall + folders + files) that have shareLink
  const allSharedItems = useMemo(() => {
    const list: FileShareItem[] = [];
    if (wallShareItem && (wallShareConfig?.enabled || wallShareConfig?.recipients?.length)) {
      list.push({ ...wallShareItem, shareLink: wallShareConfig });
    }
    for (const it of items || []) {
      if (it?.shareLink?.enabled || (it?.shareLink?.recipients && it.shareLink.recipients.length > 0)) {
        list.push(it);
      }
    }
    return list;
  }, [items, wallShareConfig, wallShareItem]);

  // Group all recipient links by person (normalized phone or name)
  const peopleList = useMemo<AggregatedPersonShare[]>(() => {
    const map = new Map<string, AggregatedPersonShare>();
    for (const item of allSharedItems) {
      const recs = Array.isArray(item.shareLink?.recipients) ? item.shareLink!.recipients : [];
      for (const r of recs) {
        const cleanName = String(r?.recipientName || '').trim();
        if (!cleanName) continue;
        const rawPhone = r?.phone ? String(r.phone) : '';
        const phoneDigits = rawPhone.replace(/\D/g, '');
        const key = phoneDigits.length >= 7 ? `ph_${phoneDigits.slice(-9)}` : `nm_${cleanName.toLowerCase()}`;
        const existing = map.get(key);
        if (existing) {
          existing.totalViews += Number(r.viewCount || 0);
          if (!existing.phone && rawPhone) existing.phone = rawPhone;
          existing.entries.push({ item, recipient: r });
        } else {
          map.set(key, {
            key,
            name: cleanName,
            phone: rawPhone || undefined,
            role: r.role,
            totalViews: Number(r.viewCount || 0),
            entries: [{ item, recipient: r }],
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.entries.length - a.entries.length || b.totalViews - a.totalViews);
  }, [allSharedItems]);

  const q = searchQuery.trim().toLowerCase();
  const filteredPeople = useMemo(() => {
    if (!q) return peopleList;
    return peopleList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        p.entries.some((e) => (e.item.name || '').toLowerCase().includes(q))
    );
  }, [peopleList, q]);

  const filteredItems = useMemo(() => {
    if (!q) return allSharedItems;
    return allSharedItems.filter(
      (it) =>
        (it.name || '').toLowerCase().includes(q) ||
        (it.shareLink?.recipients || []).some((r) => (r.recipientName || '').toLowerCase().includes(q))
    );
  }, [allSharedItems, q]);

  // Helper: resolve the actual files contained inside a shared folder (or the file itself)
  const getContainedFileNames = (sharedItem: FileShareItem): string[] => {
    if (sharedItem.type !== 'folder') return [];
    const includeSubtree = Boolean(sharedItem.shareLink?.includeSubtree);
    if (!includeSubtree) {
      return (items || [])
        .filter((f) => f.type !== 'folder' && f.parentId === sharedItem.id)
        .map((f) => f.name)
        .filter(Boolean);
    }
    // Collect recursive folder IDs when subtree sharing is enabled
    const folderIds = new Set<string>([sharedItem.id]);
    let added = true;
    while (added) {
      added = false;
      for (const f of items || []) {
        if (f.type === 'folder' && f.parentId && folderIds.has(f.parentId) && !folderIds.has(f.id)) {
          folderIds.add(f.id);
          added = true;
        }
      }
    }
    return (items || [])
      .filter((f) => f.type !== 'folder' && f.parentId && folderIds.has(f.parentId))
      .map((f) => f.name)
      .filter(Boolean);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://smart-share-tvwn-delta.vercel.app';
  const senderPersonName = user?.realName || user?.nickname || (user as any)?.displayName || 'חבר';
  const senderDisplay = spaceTitle ? `${senderPersonName} ממרחב "${spaceTitle}"` : senderPersonName;

  const handleCopyLink = async (item: FileShareItem, r: RecipientShareLink) => {
    const url = `${currentOrigin}/share/${r.token}`;
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const msg = `שלום ${r.recipientName},\n${senderDisplay} שיתף איתך ${itemTypeHeb} "${item.name}" באפליקציית MySpace.\nלצפייה מאובטחת והעלאת קבצים לחץ כאן:\n${url}`;
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedToken(r.token);
    setTimeout(() => setCopiedToken(null), 2200);
  };

  const handleWhatsApp = (item: FileShareItem, r: RecipientShareLink) => {
    const url = `${currentOrigin}/share/${r.token}`;
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const text = encodeURIComponent(`שלום ${r.recipientName},\n${senderDisplay} שיתף איתך ${itemTypeHeb} "${item.name}":\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleAddContact = async () => {
    const cleanName = newContactName.trim();
    if (!cleanName || !user?.id) return;
    const nextContact: SavedShareContact = {
      id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      phone: newContactPhone.trim() || undefined,
      role: newContactRole,
      createdAt: Date.now(),
    };
    const nextDir: SavedShareDirectory = {
      ...directory,
      contacts: [nextContact, ...directory.contacts],
      updatedAt: Date.now(),
    };
    setDirectory(nextDir);
    setNewContactName('');
    setNewContactPhone('');
    await saveSavedShareDirectory(user.id, nextDir);
  };

  const handleDeleteContact = async (id: string) => {
    if (!user?.id) return;
    const nextDir: SavedShareDirectory = {
      contacts: directory.contacts.filter((c) => c.id !== id),
      groups: directory.groups.map((g) => ({ ...g, contactIds: g.contactIds.filter((cid) => cid !== id) })),
      updatedAt: Date.now(),
    };
    setDirectory(nextDir);
    await saveSavedShareDirectory(user.id, nextDir);
  };

  const handleImportSpacePeople = async () => {
    if (!user?.id || peopleList.length === 0) return;
    const nextContacts = [...directory.contacts];
    let addedCount = 0;
    for (const p of peopleList) {
      const exists = nextContacts.some(
        (c) =>
          c.name.toLowerCase() === p.name.toLowerCase() ||
          (p.phone && c.phone && c.phone.replace(/\D/g, '') === p.phone.replace(/\D/g, ''))
      );
      if (!exists) {
        nextContacts.unshift({
          id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${addedCount}`,
          name: p.name,
          phone: p.phone,
          role: p.role || 'provider',
          createdAt: Date.now(),
        });
        addedCount++;
      }
    }
    if (addedCount > 0) {
      const nextDir: SavedShareDirectory = { ...directory, contacts: nextContacts, updatedAt: Date.now() };
      setDirectory(nextDir);
      await saveSavedShareDirectory(user.id, nextDir);
    }
  };

  const handleSaveGroup = async () => {
    const cleanName = newGroupName.trim();
    if (!cleanName || selectedGroupContactIds.length === 0 || !user?.id) return;
    const nextGroup: SavedShareGroup = {
      id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      icon: newGroupIcon,
      contactIds: selectedGroupContactIds,
      createdAt: Date.now(),
    };
    const nextDir: SavedShareDirectory = {
      ...directory,
      groups: [nextGroup, ...directory.groups],
      updatedAt: Date.now(),
    };
    setDirectory(nextDir);
    setNewGroupName('');
    setSelectedGroupContactIds([]);
    setIsCreatingGroup(false);
    await saveSavedShareDirectory(user.id, nextDir);
  };

  const handleDeleteGroup = async (id: string) => {
    if (!user?.id) return;
    const nextDir: SavedShareDirectory = {
      ...directory,
      groups: directory.groups.filter((g) => g.id !== id),
      updatedAt: Date.now(),
    };
    setDirectory(nextDir);
    await saveSavedShareDirectory(user.id, nextDir);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100020,
        background: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        direction: 'rtl',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          background: '#ffffff',
          borderRadius: '22px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px 12px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem' }}>🔗</span>
              <span style={{ fontWeight: 900, fontSize: '1rem' }}>מרכז השיתופים, אנשי קשר וקבוצות</span>
              <span style={{ background: 'rgba(255,255,255,0.16)', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '999px', fontWeight: 700 }}>
                {APP_VERSION}
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#cbd5e1' }}>
              מרחב: {spaceTitle} • {peopleList.length} נמענים פעילים ב-{allSharedItems.length} פריטים
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 900,
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* 3 Flagship Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '6px',
            padding: '10px 12px 6px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          {[
            { id: 'people', label: `👥 אנשים (${peopleList.length})` },
            { id: 'directory', label: `📇 קבועים (${directory.contacts.length})` },
            { id: 'items', label: `📂 פריטים (${allSharedItems.length})` },
          ].map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  padding: '8px 6px',
                  borderRadius: '11px',
                  border: active ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                  background: active ? '#eef2ff' : '#ffffff',
                  color: active ? '#3730a3' : '#475569',
                  fontWeight: 800,
                  fontSize: '0.73rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search bar on People & Items tabs */}
        {activeTab !== 'directory' && (
          <div style={{ padding: '8px 12px 4px', background: '#f8fafc' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 חפש איש קשר, טלפון, תיקייה או קובץ..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: '11px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                background: '#ffffff',
              }}
            />
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}>
          {/* TAB 1: BY PEOPLE */}
          {activeTab === 'people' && (
            <>
              {filteredPeople.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>👥</div>
                  <div style={{ fontWeight: 800, color: '#334155', marginBottom: '4px' }}>אין עדיין נמענים משותפים במרחב זה</div>
                  <div>שתף תיקייה, קובץ או את הקיר כולו — וכל הנמענים יופיעו כאן מרוכזים לפי אדם!</div>
                </div>
              ) : (
                filteredPeople.map((person) => (
                  <div
                    key={person.key}
                    style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      padding: '11px 12px',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#0f172a' }}>{person.name}</span>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background: person.role === 'provider' ? '#fef3c7' : '#e0f2fe',
                              color: person.role === 'provider' ? '#b45309' : '#0369a1',
                            }}
                          >
                            {person.role === 'provider' ? '🛠️ ספק' : '👤 לקוח'}
                          </span>
                        </div>
                        {person.phone && (
                          <span style={{ fontSize: '0.73rem', color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                            📞 {person.phone}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          color: '#4f46e5',
                          background: '#eef2ff',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {person.entries.length} פריטים • 👁️ {person.totalViews}
                      </span>
                    </div>

                    {/* Shared items chips for this person — including exact contained file names! */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {person.entries.map(({ item, recipient }) => {
                        const containedFiles = getContainedFileNames(item);
                        return (
                          <div
                            key={`${item.id}_${recipient.id}`}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '120px', flex: 1 }}>
                                <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1e293b' }}>
                                  {item.type === 'folder' ? '📁 תיקייה:' : '📄 קובץ:'} {item.name}
                                  {containedFiles.length > 0 && (
                                    <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#4f46e5', marginRight: '5px' }}>
                                      ({containedFiles.length} קבצים)
                                    </span>
                                  )}
                                </span>
                                <span style={{ fontSize: '0.67rem', color: '#64748b' }}>
                                  {recipient.enabled ? `🟢 פעיל • 👁️ ${recipient.viewCount || 0} צפיות` : '🔴 חסום'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleWhatsApp(item, recipient)}
                                  disabled={!recipient.enabled}
                                  style={{
                                    background: '#25D366',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: recipient.enabled ? 'pointer' : 'not-allowed',
                                    opacity: recipient.enabled ? 1 : 0.45,
                                  }}
                                >
                                  וואטסאפ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyLink(item, recipient)}
                                  disabled={!recipient.enabled}
                                  style={{
                                    background: '#ffffff',
                                    color: '#1e293b',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: recipient.enabled ? 'pointer' : 'not-allowed',
                                    opacity: recipient.enabled ? 1 : 0.45,
                                  }}
                                >
                                  {copiedToken === recipient.token ? '✓ הועתק' : 'העתק'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onOpenItemShare(item);
                                  }}
                                  title="ניהול קישור וחסימה"
                                  style={{
                                    background: '#eef2ff',
                                    color: '#4338ca',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: '8px',
                                    padding: '4px 7px',
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ⚙️
                                </button>
                              </div>
                            </div>

                            {/* Exact shared files inside this folder so user knows immediately WHAT was shared! */}
                            {containedFiles.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                                {containedFiles.slice(0, 6).map((fname, fIdx) => (
                                  <span
                                    key={fIdx}
                                    style={{
                                      background: '#ffffff',
                                      border: '1px solid #dbeafe',
                                      color: '#1e40af',
                                      borderRadius: '7px',
                                      padding: '2px 7px',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      maxWidth: '100%',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    📄 {fname}
                                  </span>
                                ))}
                                {containedFiles.length > 6 && (
                                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, padding: '2px 4px' }}>
                                    +{containedFiles.length - 6} נוספים
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 2: PERMANENT CONTACTS & GROUPS */}
          {activeTab === 'directory' && (
            <>
              {/* Groups Section */}
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#0f172a' }}>👥 קבוצות שיתוף ({directory.groups.length})</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingGroup((v) => !v)}
                    style={{
                      background: isCreatingGroup ? '#f1f5f9' : '#4f46e5',
                      color: isCreatingGroup ? '#475569' : '#ffffff',
                      border: 'none',
                      borderRadius: '9px',
                      padding: '5px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {isCreatingGroup ? 'ביטול' : '+ קבוצה חדשה'}
                  </button>
                </div>

                {isCreatingGroup && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        value={newGroupIcon}
                        onChange={(e) => setNewGroupIcon(e.target.value)}
                        style={{ padding: '6px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.9rem' }}
                      >
                        {GROUP_ICONS.map((ic) => (
                          <option key={ic} value={ic}>{ic}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="שם הקבוצה (למשל: צוות אינסטלציה ויועצים)"
                        style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>בחר אנשי קשר לקבוצה:</div>
                    {directory.contacts.length === 0 ? (
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>הוסף קודם אנשי קשר קבועים למטה כדי לשייך אותם לקבוצה.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {directory.contacts.map((c) => {
                          const selected = selectedGroupContactIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setSelectedGroupContactIds((prev) =>
                                  selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                )
                              }
                              style={{
                                padding: '4px 9px',
                                borderRadius: '999px',
                                border: selected ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                                background: selected ? '#eef2ff' : '#ffffff',
                                color: selected ? '#3730a3' : '#334155',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {selected ? '✓ ' : '+ '}
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveGroup}
                      disabled={!newGroupName.trim() || selectedGroupContactIds.length === 0}
                      style={{
                        background: !newGroupName.trim() || selectedGroupContactIds.length === 0 ? '#cbd5e1' : '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '9px',
                        padding: '7px',
                        fontWeight: 800,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      שמור קבוצה ({selectedGroupContactIds.length} נבחרו)
                    </button>
                  </div>
                )}

                {directory.groups.length === 0 && !isCreatingGroup ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    צור קבוצות קבועות (למשל "קבלנים", "יועצים", "משפחה") כדי להזמין את כולם לתיקייה או קובץ בלחיצה אחת.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {directory.groups.map((g) => {
                      const memberNames = g.contactIds
                        .map((id) => directory.contacts.find((c) => c.id === id)?.name)
                        .filter(Boolean);
                      return (
                        <div
                          key={g.id}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>
                              {g.icon || '👥'} {g.name} ({memberNames.length})
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{memberNames.join(' • ') || 'קבוצה ריקה'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(g.id)}
                            title="מחק קבוצה"
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', padding: '4px 7px', fontSize: '0.72rem', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Permanent Address Book Section */}
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#0f172a' }}>📇 ספר כתובות קבוע ({directory.contacts.length})</span>
                  {peopleList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportSpacePeople}
                      style={{
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        borderRadius: '9px',
                        padding: '4px 9px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ⬇️ ייבא נמענים מהמרחב ({peopleList.length})
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="שם מלא (למשל: אלי אינסטלטור)"
                    style={{ flex: 1, minWidth: '130px', padding: '7px 10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="טלפון (אופציונלי)"
                    style={{ width: '120px', padding: '7px 10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                  <select
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value as any)}
                    style={{ padding: '7px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '0.76rem', background: '#ffffff' }}
                  >
                    <option value="provider">🛠️ ספק</option>
                    <option value="client">👤 לקוח</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    disabled={!newContactName.trim()}
                    style={{
                      background: !newContactName.trim() ? '#cbd5e1' : '#4f46e5',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9px',
                      padding: '7px 12px',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    + הוסף
                  </button>
                </div>

                {directory.contacts.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    אנשי קשר שתוסיף כאן (או תייבא מהמרחב) יישמרו קבוע לשימוש חוזר בכל המרחבים והתיקיות.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {directory.contacts.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '9px',
                          padding: '7px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#0f172a' }}>{c.name}</span>
                          {c.phone && <span style={{ fontSize: '0.72rem', color: '#64748b', marginRight: '8px' }}>📞 {c.phone}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(c.id)}
                          title="הסר מספר הכתובות"
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '7px', padding: '3px 7px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 3: BY FILES & FOLDERS */}
          {activeTab === 'items' && (
            <>
              {filteredItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                  אין עדיין פריטים משותפים במרחב זה.
                </div>
              ) : (
                filteredItems.map((it) => {
                  const recs = it.shareLink?.recipients || [];
                  const totalViews =
                    Number(it.shareLink?.viewCount || 0) +
                    recs.reduce((acc, r) => acc + Number(r.viewCount || 0), 0);
                  return (
                    <div
                      key={it.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '13px',
                        border: '1px solid #e2e8f0',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                          {it.type === 'folder' ? '📁' : '📄'} {it.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          👥 {recs.length} נמענים אישיים • 👁️ {totalViews} צפיות
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenItemShare(it);
                        }}
                        style={{
                          background: '#eef2ff',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe',
                          borderRadius: '9px',
                          padding: '6px 10px',
                          fontWeight: 800,
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ⚙️ נהל שיתוף
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
