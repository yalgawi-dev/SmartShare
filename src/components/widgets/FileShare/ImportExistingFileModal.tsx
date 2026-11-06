'use client';

import React, { useState, useMemo } from 'react';
import { useSpaces } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';
import { FileShareItem, formatFileSize } from '@/utils/fileShareUtils';
import { canAccessItem } from '@/utils/permissionUtils';
import UniversalViewerModal, { ViewerDocument } from '@/components/common/ViewerEngine/UniversalViewerModal';

interface CandidateFile {
  id: string;
  sourceSpaceId: string;
  sourceSpaceTitle: string;
  sourceType: 'vault' | 'expense' | 'fileshare' | 'gallery';
  name: string;
  url: string;
  pages?: string[];
  thumbnailUrl?: string;
  fileType: 'pdf' | 'image' | 'sheet' | 'doc' | 'other';
  size?: number;
  createdAt: number;
}

interface ImportExistingFileModalProps {
  isOpen: boolean;
  currentSpaceId: string;
  currentFolderId: string | null;
  onClose: () => void;
  onImport: (importedItem: FileShareItem) => void;
}

export function ImportExistingFileModal({
  isOpen,
  currentSpaceId,
  currentFolderId,
  onClose,
  onImport
}: ImportExistingFileModalProps) {
  const { spaces, getRoleForSpace, getTokenForSpace } = useSpaces();
  const { user } = useAuth();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'vault' | 'expense' | 'fileshare'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewState, setPreviewState] = useState<{ docs: ViewerDocument[]; index: number } | null>(null);

  // Check if current user is strictly an authorized creator/member of a space (Rule 20 / Strict Access Control)
  const isAuthorizedMemberOfSpace = useMemo(() => {
    return (s: any): boolean => {
      if (!s || s.status === 'pending_deletion') return false;
      if (!user?.id) return false;

      // 1. Direct creator
      if (s.creatorId && user.id === s.creatorId) return true;
      if (user.spaceKeys?.[s.id]?.role === 'creator') return true;

      // 2. Explicit active member in space.members
      if (Array.isArray(s.members)) {
        const m = s.members.find((mem: any) => mem.userId === user.id);
        if (m && m.status !== 'removed' && m.isActive !== false) {
          return true;
        }
      }

      // 3. Authenticated partner key
      if (user.spaceKeys?.[s.id] && (user.spaceKeys[s.id].role === 'creator' || user.spaceKeys[s.id].role === 'partner')) {
        return true;
      }

      return false;
    };
  }, [user?.id, user?.spaceKeys]);

  // List of other spaces the user is strictly authorized to access
  const authorizedOtherSpaces = useMemo(() => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter(s => s.id !== currentSpaceId && isAuthorizedMemberOfSpace(s));
  }, [spaces, currentSpaceId, isAuthorizedMemberOfSpace]);

  // Extract all permitted files across authorized other spaces
  const otherSpacesFiles = useMemo(() => {
    const result: CandidateFile[] = [];

    authorizedOtherSpaces.forEach(s => {
      const spaceTitle = s.title || 'מרחב';
      const spaceRole = getRoleForSpace(s.id);
      const partnerToken = getTokenForSpace(s.id);
      const isCreatorOrAdmin = spaceRole === 'creator' || spaceRole === 'admin';
      const isManagedMode = Boolean(s.settings?.isManagedMode);

      // 1. Files from FileShare feature in other spaces
      if (Array.isArray(s.fileShareItems)) {
        s.fileShareItems.forEach((f: any) => {
          if (f.type === 'file' && f.url) {
            // Strict Item-Level Permission Check
            if (Array.isArray(f.allowedPartners) && f.allowedPartners.length > 0) {
              if (f.allowedPartners.includes('__creator_vault_secret__')) {
                if (!isCreatorOrAdmin) return;
              } else if (f.allowedPartners.includes('__only_me__')) {
                if (f.createdBy !== user?.id && !isCreatorOrAdmin) return;
              } else {
                const userMatch = Boolean(user?.id && f.allowedPartners.includes(user.id));
                const tokenMatch = Boolean(partnerToken && f.allowedPartners.includes(partnerToken));
                const isOwner = Boolean(user?.id && f.createdBy === user.id);
                if (!isCreatorOrAdmin && !userMatch && !tokenMatch && !isOwner) return;
              }
            }

            const isPdf = f.fileType === 'pdf' || f.url.toLowerCase().endsWith('.pdf');
            const thumb = f.thumbnailUrl || (Array.isArray(f.pages) && f.pages.length > 0 ? f.pages[0] : (!isPdf ? f.url : undefined));

            result.push({
              id: `fileshare_${s.id}_${f.id}`,
              sourceSpaceId: s.id,
              sourceSpaceTitle: spaceTitle,
              sourceType: 'fileshare',
              name: f.name || 'קובץ שיתוף',
              url: f.url,
              pages: f.pages || (f.url ? [f.url] : []),
              thumbnailUrl: thumb,
              fileType: f.fileType || (isPdf ? 'pdf' : 'image'),
              size: f.size,
              createdAt: f.createdAt || Date.now()
            });
          }
        });
      }

      // 2. Documents from Vault (מחסן מסמכים)
      if (Array.isArray(s.documents)) {
        s.documents.forEach((d: any) => {
          if (!d.deletedAt && d.url) {
            // Strict canAccessItem Check (Handles __only_me__, __creator_vault_secret__, partner lists, and managed mode)
            const hasAccess = canAccessItem({
              spaceRole: spaceRole as any,
              userId: user?.id,
              partnerToken,
              creatorId: s.creatorId,
              isManagedMode,
              ownerId: d.addedBy || d.userId,
              allowedPartners: d.allowedPartners || d.permissions || []
            });
            if (!hasAccess) return;

            const isPdf = d.type === 'pdf' || d.url.toLowerCase().includes('.pdf');
            const thumb = d.thumbnailUrl || (Array.isArray(d.pages) && d.pages.length > 0 ? d.pages[0] : (!isPdf ? d.url : undefined));

            result.push({
              id: `vault_${s.id}_${d.id}`,
              sourceSpaceId: s.id,
              sourceSpaceTitle: spaceTitle,
              sourceType: 'vault',
              name: d.name || d.title || 'מסמך מחסן',
              url: d.url,
              pages: d.pages || (d.url ? [d.url] : []),
              thumbnailUrl: thumb,
              fileType: isPdf ? 'pdf' : 'image',
              size: d.fileSize || d.size,
              createdAt: typeof d.createdAt === 'string' ? new Date(d.createdAt).getTime() : (d.createdAt || Date.now())
            });
          }
        });
      }

      // 3. Attachments from Invoices / Expenses (חשבוניות וקבלות עם קובץ מצורף)
      const invoiceList = Array.isArray(s.invoices) ? s.invoices : (Array.isArray((s as any).expenses) ? (s as any).expenses : []);
      if (invoiceList.length > 0) {
        invoiceList.forEach((e: any) => {
          if (e.hasAttachment && (e.attachmentUrl || (e.pages && e.pages.length > 0))) {
            // Check exclusion
            if (Array.isArray(e.excludedMembers)) {
              if (user?.id && e.excludedMembers.includes(user.id)) return;
              if (partnerToken && e.excludedMembers.includes(partnerToken)) return;
            }
            if (isManagedMode && !isCreatorOrAdmin && e.payerId !== user?.id && e.payerId !== partnerToken) {
              return;
            }

            const fileUrl = e.attachmentUrl || (e.pages && e.pages[0]);
            if (fileUrl) {
              const expenseTitle = e.supplier 
                ? `חשבונית: ${e.supplier}${e.amount ? ` (${e.amount} ₪)` : ''}`
                : (e.note || 'קבלה מצורפת');
              const isPdf = fileUrl.toLowerCase().includes('.pdf');
              const thumb = e.thumbnailUrl || (Array.isArray(e.pages) && e.pages.length > 0 ? e.pages[0] : (!isPdf ? fileUrl : undefined));

              result.push({
                id: `expense_${s.id}_${e.id}`,
                sourceSpaceId: s.id,
                sourceSpaceTitle: spaceTitle,
                sourceType: 'expense',
                name: expenseTitle,
                url: fileUrl,
                pages: e.pages || [fileUrl],
                thumbnailUrl: thumb,
                fileType: isPdf ? 'pdf' : 'image',
                createdAt: typeof e.date === 'string' ? new Date(e.date).getTime() : Date.now()
              });
            }
          }
        });
      }
    });

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [authorizedOtherSpaces, getRoleForSpace, getTokenForSpace, user?.id]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    return otherSpacesFiles.filter(item => {
      // 1. Space filter
      if (selectedSpaceId !== 'all' && item.sourceSpaceId !== selectedSpaceId) {
        return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'all' && item.sourceType !== categoryFilter) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesSpace = item.sourceSpaceTitle.toLowerCase().includes(q);
        return matchesName || matchesSpace;
      }

      return true;
    });
  }, [otherSpacesFiles, selectedSpaceId, categoryFilter, searchQuery]);

  if (!isOpen) return null;

  const handleSelectFile = (candidate: CandidateFile) => {
    const newItem: FileShareItem = {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      spaceId: currentSpaceId,
      name: candidate.name,
      type: 'file',
      parentId: currentFolderId,
      url: candidate.url,
      pages: candidate.pages || [candidate.url],
      fileType: candidate.fileType,
      size: candidate.size,
      createdAt: Date.now(),
      createdBy: user?.id || '',
      creatorName: user?.realName || user?.nickname || 'שותף',
      allowedPartners: [] // Open by default (Rule 20)
    };

    onImport(newItem);
    onClose();
  };

  const handleOpenPreview = (candidate: CandidateFile) => {
    const doc: ViewerDocument = {
      id: candidate.id,
      url: candidate.url,
      title: candidate.name,
      type: candidate.fileType,
      pages: candidate.pages || [candidate.url]
    };
    setPreviewState({ docs: [doc], index: 0 });
  };

  const getSourceTypeHeb = (st: CandidateFile['sourceType']) => {
    if (st === 'vault') return 'מחסן מסמכים';
    if (st === 'expense') return 'הוצאות וקבלות';
    if (st === 'fileshare') return 'שיתוף קבצים';
    return 'גלריה';
  };

  const getItemIcon = (candidate: CandidateFile) => {
    if (candidate.fileType === 'pdf') return '📕';
    if (candidate.fileType === 'image') return '🖼️';
    if (candidate.fileType === 'sheet') return '📊';
    return '📄';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, rgba(99, 102, 241, 0.04), transparent)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>📥</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ייבוא קובץ קיים ממרחב אחר
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.76rem', color: '#059669', fontWeight: 700 }}>
              ⚡ חיסכון מקסימלי: הקובץ יקושר ישירות ללא שכפול נפח בענן (0 בייטים כפולים)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: 'var(--text-secondary)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid var(--border-light)' }}>
          {/* Search bar */}
          <input
            type="text"
            placeholder="🔍 חפש קובץ לפי שם, ספק או מרחב..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
              background: '#ffffff',
              fontSize: '0.85rem',
              boxSizing: 'border-box'
            }}
          />

          {/* Space selector & Category filter */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={selectedSpaceId}
              onChange={e => setSelectedSpaceId(e.target.value)}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '0.45rem 0.65rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}
            >
              <option value="all">🌐 כל המרחבים שלי ({authorizedOtherSpaces.length} מרחבים • {otherSpacesFiles.length} קבצים)</option>
              {authorizedOtherSpaces.map(s => {
                const count = otherSpacesFiles.filter(f => f.sourceSpaceId === s.id).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.icon || '📁'} {s.title} ({count} קבצים)
                  </option>
                );
              })}
            </select>

            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              {(['all', 'vault', 'expense', 'fileshare'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: categoryFilter === cat ? 'var(--primary)' : '#ffffff',
                    color: categoryFilter === cat ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  {cat === 'all' ? 'הכל' : cat === 'vault' ? 'מחסן' : cat === 'expense' ? 'חשבוניות' : 'שיתופים'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Files List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          maxHeight: '420px'
        }}>
          {filteredFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                לא נמצאו קבצים מתאימים
              </h4>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem' }}>
                נסה לשנות את החיפוש או לבחור מרחב אחר.
              </p>
            </div>
          ) : (
            filteredFiles.map(candidate => (
              <div
                key={candidate.id}
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s'
                }}
              >
                {/* Top Row: Thumbnail + Title & Metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                  {/* Real Image Thumbnail or PDF Badge */}
                  <div
                    onClick={() => handleOpenPreview(candidate)}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      position: 'relative'
                    }}
                    title="לחץ לתצוגה מקדימה מלאה"
                  >
                    {candidate.thumbnailUrl ? (
                      <img
                        src={candidate.thumbnailUrl}
                        alt={candidate.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <span style={{ fontSize: '1.4rem' }}>{getItemIcon(candidate)}</span>
                    )}
                    {candidate.pages && candidate.pages.length > 1 && (
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        background: 'rgba(15,23,42,0.85)',
                        color: 'white',
                        fontSize: '0.55rem',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        fontWeight: 800
                      }}>
                        {candidate.pages.length}p
                      </span>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3
                      }}
                      title={candidate.name}
                    >
                      {candidate.name}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      marginTop: '4px',
                      fontSize: '0.74rem',
                      color: 'var(--text-secondary)',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{
                        background: '#e0e7ff',
                        color: '#4338ca',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        fontWeight: 700
                      }}>
                        {candidate.sourceSpaceTitle}
                      </span>
                      <span>• {getSourceTypeHeb(candidate.sourceType)}</span>
                      {candidate.size ? <span>• {formatFileSize(candidate.size)}</span> : null}
                      {candidate.pages && candidate.pages.length > 1 ? <span>• {candidate.pages.length} עמודים</span> : null}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Actions Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  paddingTop: '0.45rem',
                  borderTop: '1px solid rgba(226, 232, 240, 0.6)'
                }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(candidate)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.6rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light, #cbd5e1)',
                      background: 'var(--bg-main, #f8fafc)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>👁️</span> תצוגה מקדימה (זום פי 30)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectFile(candidate)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.75rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'var(--primary, #4f46e5)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    <span>📥</span> ייבא למרחב
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.85rem 1.5rem',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-main, #f8fafc)'
        }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            נמצאו <strong>{filteredFiles.length}</strong> קבצים זמינים לייבוא ישיר
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-light)',
              background: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            סגור
          </button>
        </div>
      </div>

      {/* Global Universal Viewer Engine (Zoom up to 30x, rotate, multi-page scroll) */}
      {previewState && (
        <UniversalViewerModal
          docs={previewState.docs}
          initialIndex={previewState.index}
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}
