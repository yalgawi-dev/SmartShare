'use client';

import React, { useState, useMemo } from 'react';
import { useSpaces } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';
import { FileShareItem, formatFileSize } from '@/utils/fileShareUtils';
import UniversalViewerModal, { ViewerDocument } from '@/components/common/ViewerEngine/UniversalViewerModal';

interface CandidateFile {
  id: string;
  sourceSpaceId: string;
  sourceSpaceTitle: string;
  sourceType: 'vault' | 'expense' | 'fileshare' | 'gallery';
  name: string;
  url: string;
  pages?: string[];
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
  const { spaces } = useSpaces();
  const { user } = useAuth();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'vault' | 'expense' | 'fileshare'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewState, setPreviewState] = useState<{ docs: ViewerDocument[]; index: number } | null>(null);

  // Extract all existing files across other spaces
  const otherSpacesFiles = useMemo(() => {
    if (!Array.isArray(spaces)) return [];

    const result: CandidateFile[] = [];

    spaces.forEach(s => {
      // Exclude current space
      if (s.id === currentSpaceId) return;

      const spaceTitle = s.title || 'מרחב';

      // 1. Files from FileShare feature in other spaces
      if (Array.isArray(s.fileShareItems)) {
        s.fileShareItems.forEach((f: any) => {
          if (f.type === 'file' && f.url) {
            result.push({
              id: `fileshare_${s.id}_${f.id}`,
              sourceSpaceId: s.id,
              sourceSpaceTitle: spaceTitle,
              sourceType: 'fileshare',
              name: f.name || 'קובץ שיתוף',
              url: f.url,
              pages: f.pages || (f.url ? [f.url] : []),
              fileType: f.fileType || (f.url.endsWith('.pdf') ? 'pdf' : 'image'),
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
            result.push({
              id: `vault_${s.id}_${d.id}`,
              sourceSpaceId: s.id,
              sourceSpaceTitle: spaceTitle,
              sourceType: 'vault',
              name: d.name || d.title || 'מסמך מחסן',
              url: d.url,
              pages: d.pages || (d.url ? [d.url] : []),
              fileType: d.url.includes('.pdf') ? 'pdf' : 'image',
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
            const fileUrl = e.attachmentUrl || (e.pages && e.pages[0]);
            if (fileUrl) {
              const expenseTitle = e.supplier 
                ? `חשבונית: ${e.supplier}${e.amount ? ` (${e.amount} ₪)` : ''}`
                : (e.note || 'קבלה מצורפת');

              result.push({
                id: `expense_${s.id}_${e.id}`,
                sourceSpaceId: s.id,
                sourceSpaceTitle: spaceTitle,
                sourceType: 'expense',
                name: expenseTitle,
                url: fileUrl,
                pages: e.pages || [fileUrl],
                fileType: fileUrl.includes('.pdf') ? 'pdf' : 'image',
                createdAt: typeof e.date === 'string' ? new Date(e.date).getTime() : Date.now()
              });
            }
          }
        });
      }
    });

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [spaces, currentSpaceId]);

  // List of other spaces available
  const availableOtherSpaces = useMemo(() => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter(s => s.id !== currentSpaceId);
  }, [spaces, currentSpaceId]);

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
              <option value="all">🌐 כל המרחבים שלי ({otherSpacesFiles.length} קבצים)</option>
              {availableOtherSpaces.map(s => {
                const count = otherSpacesFiles.filter(f => f.sourceSpaceId === s.id).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.icon || '📁'} {s.title} ({count})
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
                  padding: '0.75rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s'
                }}
              >
                {/* File Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0
                  }}>
                    {getItemIcon(candidate)}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-word',
                      lineHeight: 1.25
                    }}>
                      {candidate.name}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '3px', fontSize: '0.72rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{candidate.sourceSpaceTitle}</span>
                      <span>• {getSourceTypeHeb(candidate.sourceType)}</span>
                      {candidate.size ? <span>• {formatFileSize(candidate.size)}</span> : null}
                      {candidate.pages && candidate.pages.length > 1 ? <span>• {candidate.pages.length} עמ׳</span> : null}
                    </div>
                  </div>
                </div>

                {/* Actions (Preview with 30x Zoom Engine & Import Button) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(candidate)}
                    style={{
                      padding: '0.4rem 0.65rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-main, #f8fafc)',
                      color: 'var(--text-primary)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                    title="תצוגה מקדימה מלאה (זום עד פי 30, סיבוב ומעבר עמודים)"
                  >
                    <span>👁️</span> תצוגה
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectFile(candidate)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)'
                    }}
                  >
                    <span>📥</span> ייבא לכאן
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
