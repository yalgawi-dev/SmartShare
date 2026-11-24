'use client';

import React, { useMemo, useState } from 'react';
import type { RecipientShareLink, RecipientRole } from '@/utils/fileShareUtils';
import type { SavedShareContact, SavedShareDirectory, SavedShareGroup } from '@/utils/shareContactsStore';
import type { SelectableMember } from './RegisteredMemberPickerModal';
import { filterAndSortContacts } from '@/utils/contactSearch';

const ROLE_LABELS: Record<RecipientRole, string> = {
  client: 'לקוח',
  provider: 'קבלן / ספק',
  general: 'שותף / כללי',
};

interface SharePeopleTabProps {
  currentOrigin: string;
  recipients: RecipientShareLink[];
  savedDirectory: SavedShareDirectory;
  registeredMembers: SelectableMember[];
  supportsContactPicker: boolean;
  newRecipientName: string;
  setNewRecipientName: (v: string) => void;
  newRecipientPhone: string;
  setNewRecipientPhone: (v: string) => void;
  newRecipientRole: RecipientRole;
  setNewRecipientRole: (v: RecipientRole) => void;
  newRecipientInternalNote: string;
  setNewRecipientInternalNote: (v: string) => void;
  newRecipientPublicMessage: string;
  setNewRecipientPublicMessage: (v: string) => void;
  showNoteFields: boolean;
  setShowNoteFields: (v: boolean) => void;
  quickPickPanel: 'none' | 'contacts' | 'groups';
  setQuickPickPanel: (v: 'none' | 'contacts' | 'groups') => void;
  copiedRecipientId: string | null;
  editingRecipientId: string | null;
  setEditingRecipientId: (v: string | null) => void;
  editInternalNote: string;
  setEditInternalNote: (v: string) => void;
  editPublicMessage: string;
  setEditPublicMessage: (v: string) => void;
  onOpenMemberPicker: () => void;
  onPickFromContacts: () => void;
  onAddSavedContact: (c: SavedShareContact) => void;
  onAddSavedGroup: (g: SavedShareGroup) => void;
  onAddRecipient: () => void;
  onWhatsAppRecipient: (r: RecipientShareLink) => void;
  onCopyRecipientLink: (r: RecipientShareLink) => void;
  onToggleRecipientBlock: (id: string) => void;
  onRemoveRecipient: (id: string) => void;
  onStartEditRecipient: (r: RecipientShareLink) => void;
  onSaveRecipientNotes: (id: string) => void;
}

export function SharePeopleTab({
  currentOrigin,
  recipients,
  savedDirectory,
  registeredMembers,
  supportsContactPicker,
  newRecipientName,
  setNewRecipientName,
  newRecipientPhone,
  setNewRecipientPhone,
  newRecipientRole,
  setNewRecipientRole,
  newRecipientInternalNote,
  setNewRecipientInternalNote,
  newRecipientPublicMessage,
  setNewRecipientPublicMessage,
  showNoteFields,
  setShowNoteFields,
  quickPickPanel,
  setQuickPickPanel,
  copiedRecipientId,
  editingRecipientId,
  setEditingRecipientId,
  editInternalNote,
  setEditInternalNote,
  editPublicMessage,
  setEditPublicMessage,
  onOpenMemberPicker,
  onPickFromContacts,
  onAddSavedContact,
  onAddSavedGroup,
  onAddRecipient,
  onWhatsAppRecipient,
  onCopyRecipientLink,
  onToggleRecipientBlock,
  onRemoveRecipient,
  onStartEditRecipient,
  onSaveRecipientNotes,
}: SharePeopleTabProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  const filteredSavedContacts = useMemo(
    () => filterAndSortContacts(savedDirectory.contacts || [], contactSearchQuery),
    [savedDirectory.contacts, contactSearchQuery]
  );

  // Live smart autocomplete when typing a name in the quick-add box
  const inlineMatchingContacts = useMemo(() => {
    if (quickPickPanel === 'contacts' || newRecipientName.trim().length < 2) return [];
    return filterAndSortContacts(savedDirectory.contacts || [], newRecipientName).slice(0, 6);
  }, [savedDirectory.contacts, newRecipientName, quickPickPanel]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Intuitive 2-Step Add Recipient Card: Tactile Source Buttons + Full-Width Manual Entry */}
      <div
        style={{
          background: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: '16px',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.7rem',
        }}
      >
        {/* Step 1: Clear Header + Tactile Source Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>
              ➕ הוסף אדם לשיתוף
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '1px' }}>
              בחר מאיפה לצרף נמען, או הקלד שם חדש למטה:
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.45rem',
            }}
          >
            {supportsContactPicker && (
              <button
                type="button"
                onClick={onPickFromContacts}
                style={{
                  padding: '0.6rem 0.5rem',
                  borderRadius: '12px',
                  border: '1.5px solid #94a3b8',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 6px rgba(15,23,42,0.06)',
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>📱</span>
                <span>אנשי קשר בטלפון</span>
              </button>
            )}

            {savedDirectory.contacts.length > 0 && (
              <button
                type="button"
                onClick={() => setQuickPickPanel(quickPickPanel === 'contacts' ? 'none' : 'contacts')}
                style={{
                  padding: '0.6rem 0.5rem',
                  borderRadius: '12px',
                  border: quickPickPanel === 'contacts' ? '2px solid #0284c7' : '1.5px solid #7dd3fc',
                  background: quickPickPanel === 'contacts' ? '#0284c7' : '#f0f9ff',
                  color: quickPickPanel === 'contacts' ? '#ffffff' : '#0369a1',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 6px rgba(2,132,199,0.1)',
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>📇</span>
                <span>שמורים ({savedDirectory.contacts.length})</span>
              </button>
            )}

            {registeredMembers.length > 0 && (
              <button
                type="button"
                onClick={onOpenMemberPicker}
                style={{
                  padding: '0.6rem 0.5rem',
                  borderRadius: '12px',
                  border: '1.5px solid #6ee7b7',
                  background: '#ecfdf5',
                  color: '#047857',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 6px rgba(16,185,129,0.1)',
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>👤</span>
                <span>חברי המרחב</span>
              </button>
            )}

            {savedDirectory.groups.length > 0 && (
              <button
                type="button"
                onClick={() => setQuickPickPanel(quickPickPanel === 'groups' ? 'none' : 'groups')}
                style={{
                  padding: '0.6rem 0.5rem',
                  borderRadius: '12px',
                  border: quickPickPanel === 'groups' ? '2px solid #4f46e5' : '1.5px solid #c7d2fe',
                  background: quickPickPanel === 'groups' ? '#4f46e5' : '#eef2ff',
                  color: quickPickPanel === 'groups' ? '#ffffff' : '#4338ca',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 6px rgba(79,70,229,0.1)',
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>👥</span>
                <span>קבוצות ({savedDirectory.groups.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Quick-Pick Chips */}
        {quickPickPanel === 'groups' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.45rem', background: '#fff', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
            {savedDirectory.groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onAddSavedGroup(g)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(99,102,241,0.3)',
                  background: 'rgba(99,102,241,0.08)',
                  color: '#4338ca',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + {g.name} ({g.contactIds.length})
              </button>
            ))}
          </div>
        )}

        {quickPickPanel === 'contacts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.5rem', background: '#fff', borderRadius: '10px', border: '1px solid rgba(2,132,199,0.25)' }}>
            <input
              type="text"
              value={contactSearchQuery}
              onChange={(e) => setContactSearchQuery(e.target.value)}
              placeholder="🔍 חפש איש קשר (בכל סדר מילים או חלק מטלפון)..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.42rem 0.65rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                background: '#f8fafc',
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
              {filteredSavedContacts.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.2rem' }}>
                  לא נמצאו אנשי קשר שמורים תואמים
                </span>
              ) : (
                filteredSavedContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onAddSavedContact(c);
                      setContactSearchQuery('');
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(2,132,199,0.3)',
                      background: 'rgba(2,132,199,0.07)',
                      color: '#0369a1',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + {c.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Live Smart Suggestions when typing in the name field (any word order!) */}
        {inlineMatchingContacts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0.35rem 0.45rem', background: '#f0f9ff', borderRadius: '9px', border: '1px solid #bae6fd' }}>
            <span style={{ width: '100%', fontSize: '0.68rem', fontWeight: 800, color: '#0369a1' }}>
              ✨ התאמות מאנשי הקשר השמורים:
            </span>
            {inlineMatchingContacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAddSavedContact(c)}
                style={{
                  padding: '0.25rem 0.55rem',
                  borderRadius: '999px',
                  border: '1px solid #7dd3fc',
                  background: '#ffffff',
                  color: '#0369a1',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Visual Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.1rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>או הוסף שם ידנית</span>
          <div style={{ flex: 1, height: '1px', background: '#cbd5e1' }} />
        </div>

        {/* Full-Width Name Input + Clear Role & Prominent Add Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <input
            type="text"
            value={newRecipientName}
            onChange={(e) => setNewRecipientName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddRecipient();
              }
            }}
            placeholder="הקלד שם מלא (למשל: עלי קבלן שלד)..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.65rem 0.75rem',
              borderRadius: '11px',
              border: '1.5px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.9rem',
              fontWeight: 600,
              outline: 'none',
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: '0.45rem' }}>
            <select
              value={newRecipientRole}
              onChange={(e) => setNewRecipientRole(e.target.value as RecipientRole)}
              aria-label="תפקיד נמען"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.6rem 0.55rem',
                borderRadius: '11px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '0.84rem',
                fontWeight: 700,
              }}
            >
              <option value="client">תפקיד: לקוח</option>
              <option value="provider">תפקיד: קבלן / ספק</option>
              <option value="general">תפקיד: שותף / כללי</option>
            </select>

            <button
              type="button"
              onClick={onAddRecipient}
              disabled={!newRecipientName.trim()}
              style={{
                width: '100%',
                padding: '0.6rem 0.85rem',
                borderRadius: '11px',
                border: newRecipientName.trim() ? 'none' : '1.5px solid #cbd5e1',
                background: newRecipientName.trim() ? 'linear-gradient(135deg, #4f46e5, #2563eb)' : '#e2e8f0',
                color: newRecipientName.trim() ? '#ffffff' : '#64748b',
                fontWeight: 900,
                fontSize: '0.86rem',
                cursor: newRecipientName.trim() ? 'pointer' : 'not-allowed',
                boxShadow: newRecipientName.trim() ? '0 4px 12px rgba(79,70,229,0.28)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              ➕ הוסף לשיתוף
            </button>
          </div>
        </div>

        {/* Optional Phone & Notes Toggle (Progressive Disclosure) */}
        <button
          type="button"
          onClick={() => setShowNoteFields(!showNoteFields)}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#4f46e5',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {showNoteFields ? '▲ הסתר טלפון והודעה אישית' : '+ הוסף טלפון / הודעה אישית לנמען (אופציונלי)'}
        </button>

        {showNoteFields && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingTop: '0.2rem' }}>
            <input
              type="tel"
              value={newRecipientPhone}
              onChange={(e) => setNewRecipientPhone(e.target.value)}
              placeholder="מספר טלפון (אופציונלי)"
              style={{
                padding: '0.48rem 0.65rem',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                background: '#fff',
                fontSize: '0.82rem',
              }}
            />
            <input
              type="text"
              value={newRecipientPublicMessage}
              onChange={(e) => setNewRecipientPublicMessage(e.target.value)}
              placeholder="✉️ הודעה אישית שתוצג לנמען בדף השיתוף"
              style={{
                padding: '0.48rem 0.65rem',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                background: '#fff',
                fontSize: '0.82rem',
              }}
            />
            <input
              type="text"
              value={newRecipientInternalNote}
              onChange={(e) => setNewRecipientInternalNote(e.target.value)}
              placeholder="🔒 הערה פנימית פרטית (רק לעיניך)"
              style={{
                padding: '0.48rem 0.65rem',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                background: '#fff',
                fontSize: '0.82rem',
              }}
            />
          </div>
        )}
      </div>

      {/* Recipients List */}
      {recipients.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '1.35rem 1rem',
            borderRadius: '14px',
            border: '1px dashed var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '0.84rem',
          }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>👥</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            עדיין לא נוספו נמענים
          </div>
          <div style={{ fontSize: '0.77rem' }}>
            הוסף שם למעלה או בחר מקבוצה — וכל נמען יקבל קישור אישי עם מעקב צפייה.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
            נמענים פעילים ({recipients.length})
          </div>
          {recipients.map((r) => {
            const isCopied = copiedRecipientId === r.id;
            const isEditing = editingRecipientId === r.id;
            const isMenuOpen = openMenuId === r.id;
            const recipientUrl = `${currentOrigin}/share/${r.token}`;

            return (
              <div
                key={r.id}
                style={{
                  border: r.enabled ? '1px solid var(--border-color)' : '1px solid rgba(239,68,68,0.35)',
                  background: r.enabled ? 'var(--bg-secondary)' : 'rgba(239,68,68,0.04)',
                  borderRadius: '13px',
                  padding: '0.7rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Row 1: Identity + Status + ⋯ Menu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: r.enabled ? 'var(--text-primary)' : '#b91c1c' }}>
                        {r.recipientName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.45rem',
                          borderRadius: '999px',
                          background: 'rgba(99,102,241,0.1)',
                          color: '#4338ca',
                        }}
                      >
                        {ROLE_LABELS[r.role] || 'לקוח'}
                      </span>
                      {!r.enabled && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '999px',
                            background: 'rgba(239,68,68,0.14)',
                            color: '#dc2626',
                          }}
                        >
                          חסום
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {r.viewCount && r.viewCount > 0 ? `👁️ נצפה ${r.viewCount} פעמים` : '⏳ טרם נפתח'}
                      {r.publicMessage ? ` • ✉️ "${r.publicMessage.slice(0, 26)}${r.publicMessage.length > 26 ? '…' : ''}"` : ''}
                    </div>
                  </div>

                  {/* Secondary Actions Toggle ⋯ */}
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(isMenuOpen ? null : r.id)}
                    title="אפשרויות נוספות"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: isMenuOpen ? 'rgba(99,102,241,0.12)' : '#fff',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    ⋯
                  </button>
                </div>

                {/* Row 2: 2 Clean Primary Action Buttons ONLY */}
                {r.enabled && (
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <button
                      type="button"
                      onClick={() => onWhatsAppRecipient(r)}
                      style={{
                        flex: 1,
                        padding: '0.46rem 0.65rem',
                        borderRadius: '9px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      💬 שלח בוואטסאפ
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyRecipientLink(r)}
                      style={{
                        flex: 1,
                        padding: '0.46rem 0.65rem',
                        borderRadius: '9px',
                        border: isCopied ? '1px solid #16a34a' : '1px solid rgba(37,99,235,0.3)',
                        background: isCopied ? '#dcfce7' : '#eff6ff',
                        color: isCopied ? '#15803d' : '#1d4ed8',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      {isCopied ? '✓ הועתק!' : '📋 העתק קישור'}
                    </button>
                  </div>
                )}

                {/* Secondary Actions Drawer (⋯) */}
                {isMenuOpen && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      paddingTop: '0.4rem',
                      borderTop: '1px dashed var(--border-color)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => window.open(recipientUrl, '_blank')}
                      style={{
                        padding: '0.32rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        color: 'var(--text-primary)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      👁️ פתח קישור
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onStartEditRecipient(r);
                        setOpenMenuId(null);
                      }}
                      style={{
                        padding: '0.32rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: '#fff',
                        color: 'var(--text-primary)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ הערה / הודעה
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleRecipientBlock(r.id);
                        setOpenMenuId(null);
                      }}
                      style={{
                        padding: '0.32rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(245,158,11,0.4)',
                        background: '#fffbeb',
                        color: '#b45309',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {r.enabled ? '🚫 חסום גישה' : '✅ בטל חסימה'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`למחוק את הנמען "${r.recipientName}" מהרשימה?`)) {
                          onRemoveRecipient(r.id);
                          setOpenMenuId(null);
                        }
                      }}
                      style={{
                        padding: '0.32rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.35)',
                        background: '#fef2f2',
                        color: '#dc2626',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ מחק
                    </button>
                  </div>
                )}

                {/* Inline Note/Message Editor */}
                {isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-color)' }}>
                    <input
                      type="text"
                      value={editPublicMessage}
                      onChange={(e) => setEditPublicMessage(e.target.value)}
                      placeholder="✉️ הודעה אישית לנמען (תוצג לו בדף)"
                      style={{ padding: '0.42rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '0.8rem' }}
                    />
                    <input
                      type="text"
                      value={editInternalNote}
                      onChange={(e) => setEditInternalNote(e.target.value)}
                      placeholder="🔒 הערה פנימית פרטית (רק לעיניך)"
                      style={{ padding: '0.42rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '0.8rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setEditingRecipientId(null)}
                        style={{ padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => onSaveRecipientNotes(r.id)}
                        style={{ padding: '0.3rem 0.7rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        שמור
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
