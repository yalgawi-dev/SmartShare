'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SpaceDocument, DocumentFolder, DocumentShelf } from '@/app/context/SpacesContext';
import { formatFileSize } from '@/utils/documentUtils';

interface LinkDocumentsModalProps {
  isOpen: boolean;
  doc: SpaceDocument | null;
  allDocs: SpaceDocument[];
  contextDocs?: SpaceDocument[];
  folders?: DocumentFolder[];
  shelves?: DocumentShelf[];
  onClose: () => void;
  onSave: (docId: string, linkedDocIds: string[]) => void;
  onPreviewDoc?: (doc: SpaceDocument) => void;
}

type ScopeFilter = 'same_folder' | 'nearby' | 'all_shelf';

export const LinkDocumentsModal: React.FC<LinkDocumentsModalProps> = ({
  isOpen,
  doc,
  allDocs,
  contextDocs,
  folders = [],
  shelves = [],
  onClose,
  onSave,
  onPreviewDoc
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('same_folder');

  const activeFolders = useMemo(() => folders.filter(f => !f.deletedAt), [folders]);

  useEffect(() => {
    if (doc) {
      setSelectedIds(doc.linkedDocIds || []);
      setSearchTerm('');
      // Default to same_folder if there are documents in the same folder, otherwise nearby
      const docFolderId = doc.folderId || null;
      const sameFolderCount = allDocs.filter(
        d => d.id !== doc.id && !d.deletedAt && d.shelfId === doc.shelfId && (d.folderId || null) === docFolderId
      ).length;
      setScopeFilter(sameFolderCount > 0 ? 'same_folder' : 'nearby');
    }
  }, [doc, allDocs]);

  if (!isOpen || !doc) return null;

  const docFolderId = doc.folderId || null;
  const currentFolder = docFolderId ? activeFolders.find(f => f.id === docFolderId) : null;
  const parentFolderId = currentFolder ? (currentFolder.parentId || null) : null;
  const currentShelf = shelves.find(s => s.id === doc.shelfId);

  const getFolderLabel = (folderId?: string | null, shelfId?: string): string => {
    if (!folderId) {
      const sh = shelves.find(s => s.id === shelfId);
      return sh ? `רמה ראשית (${sh.name})` : 'רמה ראשית במדף';
    }
    const found = activeFolders.find(f => f.id === folderId);
    return found ? found.name : 'תיקייה';
  };

  // Classify relationship of any candidate document to `doc`
  const classifyRelation = (candidate: SpaceDocument): {
    group: 'same_folder' | 'child_folder' | 'parent_folder' | 'sibling_folder' | 'other_shelf';
    badgeText: string;
    badgeColor: string;
    badgeBg: string;
  } => {
    const candFolderId = candidate.folderId || null;

    // 1. Exact same folder in the same shelf
    if (candidate.shelfId === doc.shelfId && candFolderId === docFolderId) {
      return {
        group: 'same_folder',
        badgeText: docFolderId ? `📁 באותה תיקייה (${getFolderLabel(docFolderId, doc.shelfId)})` : '📂 באותה רמה ראשית',
        badgeColor: '#047857',
        badgeBg: '#d1fae5'
      };
    }

    if (candidate.shelfId === doc.shelfId) {
      const candFolder = candFolderId ? activeFolders.find(f => f.id === candFolderId) : null;

      // 2. Child subfolder of current folder (or top-level folder when doc is at root)
      if (candFolder && (candFolder.parentId || null) === docFolderId) {
        return {
          group: 'child_folder',
          badgeText: `↳ תיקיית-בן: ${candFolder.name}`,
          badgeColor: '#1d4ed8',
          badgeBg: '#dbeafe'
        };
      }

      // 3. Parent folder of current folder
      if (docFolderId && candFolderId === parentFolderId) {
        return {
          group: 'parent_folder',
          badgeText: `↰ תיקיית-אב: ${getFolderLabel(parentFolderId, doc.shelfId)}`,
          badgeColor: '#7c3aed',
          badgeBg: '#ede9fe'
        };
      }

      // 4. Sibling folder at the same level (shares same parentId)
      if (docFolderId && candFolder && (candFolder.parentId || null) === parentFolderId) {
        return {
          group: 'sibling_folder',
          badgeText: `📁 תיקייה סמוכה: ${candFolder.name}`,
          badgeColor: '#0369a1',
          badgeBg: '#e0f2fe'
        };
      }
    }

    // 5. Other folder in shelf
    return {
      group: 'other_shelf',
      badgeText: `📁 ${getFolderLabel(candFolderId, candidate.shelfId)}`,
      badgeColor: '#64748b',
      badgeBg: '#f1f5f9'
    };
  };

  // Restrict base candidates to the same shelf ( plus any already-selected linked docs so user can always see/uncheck them )
  const shelfCandidates = allDocs.filter(
    d => d.id !== doc.id && !d.deletedAt && (d.shelfId === doc.shelfId || selectedIds.includes(d.id))
  );

  const sameFolderDocs = shelfCandidates.filter(d => classifyRelation(d).group === 'same_folder');
  const nearbyDocs = shelfCandidates.filter(d => {
    const g = classifyRelation(d).group;
    return g === 'same_folder' || g === 'child_folder' || g === 'parent_folder' || g === 'sibling_folder' || selectedIds.includes(d.id);
  });

  // Apply scope filter (when searching by text, search across the current shelf so nothing is unreachable)
  const scopedCandidates = searchTerm.trim()
    ? shelfCandidates
    : scopeFilter === 'same_folder'
    ? sameFolderDocs
    : scopeFilter === 'nearby'
    ? nearbyDocs
    : shelfCandidates;

  const filteredCandidates = scopedCandidates.filter(d =>
    !searchTerm.trim() || (d.title || '').toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredCandidates.map(d => d.id);
    const allSelected = allFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleSave = () => {
    onSave(doc.id, selectedIds);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100030,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.15rem 1.35rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
            {/* Source doc mini preview thumbnail */}
            <div
              onClick={() => onPreviewDoc && onPreviewDoc(doc)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#f1f5f9',
                border: '1.5px solid #cbd5e1',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onPreviewDoc ? 'pointer' : 'default',
                position: 'relative'
              }}
              title={onPreviewDoc ? 'לחץ לצפייה מקדימה במסמך המקור' : undefined}
            >
              {doc.thumbnailUrl ? (
                <img src={doc.thumbnailUrl} alt={doc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (doc.url && !doc.url.toLowerCase().includes('.pdf')) ? (
                <img src={doc.url} alt={doc.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.25rem' }}>📄</span>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                  הצמדת וקישור מסמכים
                </h3>
                {(() => {
                  const numPool = (contextDocs && contextDocs.length > 0) ? contextDocs : allDocs;
                  const idx = numPool.findIndex(d => d.id === doc.id);
                  const num = idx >= 0 ? `#${idx + 1}` : (doc.docNumber ? `#${doc.docNumber}` : '');
                  return num ? (
                    <span style={{ background: '#2563eb', color: 'white', borderRadius: '6px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: 800 }}>
                      {num}
                    </span>
                  ) : null;
                })()}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                מסמך מקור: <span style={{ fontWeight: 700, color: '#1e293b' }}>{doc.title}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📍 מיקום נוכחי:</span>
                <span>{currentFolder ? `תיקיית "${currentFolder.name}"` : `רמה ראשית (${currentShelf?.name || 'מדף'})`}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.95rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Informative explanation */}
        <div style={{ padding: '0.65rem 1.35rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: '0.77rem', color: '#475569', lineHeight: 1.4 }}>
          💡 <strong>מה יוצג לאחר הקישור?</strong> על גבי המסמכים יופיעו תגי הצמדה עם מספרי המסמכים המקושרים (למשל: <strong>🔗 מוצמד ל-#X</strong> ו-<strong>📎 מוצמד מ-#Y</strong>) — לחיצה על התג תפתח מיד חלון המציג את שני המסמכים יחד לצפייה ישירה.
        </div>

        {/* Proximity Scope Filter Tabs (Same Folder -> Nearby Folders -> Entire Shelf) */}
        <div style={{ padding: '0.6rem 1.35rem 0.25rem 1.35rem', display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={() => setScopeFilter('same_folder')}
            style={{
              flex: 1,
              padding: '0.45rem 0.4rem',
              borderRadius: '10px',
              border: scopeFilter === 'same_folder' ? '1.5px solid #059669' : '1px solid #e2e8f0',
              background: scopeFilter === 'same_folder' ? '#ecfdf5' : '#f8fafc',
              color: scopeFilter === 'same_folder' ? '#047857' : '#64748b',
              fontSize: '0.74rem',
              fontWeight: scopeFilter === 'same_folder' ? 800 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span>📁 באותה תיקייה</span>
            <span style={{ background: scopeFilter === 'same_folder' ? '#059669' : '#cbd5e1', color: 'white', borderRadius: '999px', padding: '0px 6px', fontSize: '0.66rem', fontWeight: 800 }}>
              {sameFolderDocs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScopeFilter('nearby')}
            style={{
              flex: 1,
              padding: '0.45rem 0.4rem',
              borderRadius: '10px',
              border: scopeFilter === 'nearby' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
              background: scopeFilter === 'nearby' ? '#eff6ff' : '#f8fafc',
              color: scopeFilter === 'nearby' ? '#1d4ed8' : '#64748b',
              fontSize: '0.74rem',
              fontWeight: scopeFilter === 'nearby' ? 800 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span>🌿 תיקיות צמודות</span>
            <span style={{ background: scopeFilter === 'nearby' ? '#2563eb' : '#cbd5e1', color: 'white', borderRadius: '999px', padding: '0px 6px', fontSize: '0.66rem', fontWeight: 800 }}>
              {nearbyDocs.length}
            </span>
          </button>

          {shelfCandidates.length > nearbyDocs.length && (
            <button
              type="button"
              onClick={() => setScopeFilter('all_shelf')}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: '10px',
                border: scopeFilter === 'all_shelf' ? '1.5px solid #475569' : '1px solid #e2e8f0',
                background: scopeFilter === 'all_shelf' ? '#f1f5f9' : '#ffffff',
                color: scopeFilter === 'all_shelf' ? '#0f172a' : '#64748b',
                fontSize: '0.72rem',
                fontWeight: scopeFilter === 'all_shelf' ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              כל הנושא ({shelfCandidates.length})
            </button>
          )}
        </div>

        {/* Search & Bulk select */}
        <div style={{ padding: '0.5rem 1.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 חפש מסמך או חשבונית לפי שם..."
            style={{
              flex: 1,
              padding: '0.5rem 0.85rem',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
          {filteredCandidates.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {filteredCandidates.every(d => selectedIds.includes(d.id)) ? 'בטל הכל' : 'בחר הכל'}
            </button>
          )}
        </div>

        {/* Documents List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.35rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {filteredCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: '#64748b', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
              <div>
                {scopeFilter === 'same_folder'
                  ? 'אין מסמכים נוספים באותה תיקייה.'
                  : 'לא נמצאו מסמכים ברמה זו.'}
              </div>
              {scopeFilter === 'same_folder' && nearbyDocs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScopeFilter('nearby')}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '10px',
                    border: '1px solid #93c5fd',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🌿 הצג מסמכים מתיקיות צמודות (אב / בן / אחיות) ({nearbyDocs.length})
                </button>
              )}
            </div>
          ) : (
            filteredCandidates.map(d => {
              const isSelected = selectedIds.includes(d.id);
              const rel = classifyRelation(d);
              const numPool = (contextDocs && contextDocs.length > 0) ? contextDocs : allDocs;
              const candIdx = numPool.findIndex(item => item.id === d.id);
              const candNum = candIdx >= 0 ? `#${candIdx + 1}` : (d.docNumber ? `#${d.docNumber}` : '');

              return (
                <div
                  key={d.id}
                  onClick={() => toggleSelect(d.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '14px',
                    border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                    background: isSelected ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: isSelected ? '2px solid #10b981' : '2px solid #cbd5e1', background: isSelected ? '#10b981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                      {isSelected ? '✓' : ''}
                    </div>

                    {/* Mini Thumbnail Card */}
                    <div
                      onClick={(e) => {
                        if (onPreviewDoc) {
                          e.stopPropagation();
                          onPreviewDoc(d);
                        }
                      }}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: onPreviewDoc ? 'pointer' : 'default',
                        position: 'relative'
                      }}
                      title={onPreviewDoc ? 'לחץ לפתיחת תצוגה מקדימה של המסמך' : undefined}
                    >
                      {d.thumbnailUrl ? (
                        <img src={d.thumbnailUrl} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (d.url && !d.url.toLowerCase().includes('.pdf')) ? (
                        <img src={d.url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.1rem' }}>📄</span>
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {candNum && (
                          <span style={{ background: isSelected ? '#059669' : '#0284c7', color: 'white', borderRadius: '5px', padding: '1px 5px', fontSize: '0.68rem', fontWeight: 800, flexShrink: 0 }}>
                            {candNum}
                          </span>
                        )}
                        <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 800 : 700, color: '#1e293b', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.25 }}>
                          {d.title}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.69rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{ background: rel.badgeBg, color: rel.badgeColor, padding: '1px 6px', borderRadius: '5px', fontWeight: 700, fontSize: '0.65rem' }}>
                          {rel.badgeText}
                        </span>
                        <span>📅 {new Date(d.createdAt).toLocaleDateString('he-IL')}</span>
                        {d.fileSize && <span>⚖️ {formatFileSize(d.fileSize)}</span>}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '6px', flexShrink: 0, marginRight: '0.4rem' }}>
                      מקושר
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem', background: '#ffffff' }}>
          <button
            type="button"
            onClick={handleSave}
            style={{
              flex: 2,
              padding: '0.75rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
          >
            שמור קישור ({selectedIds.length} נבחרו)
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer'
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

interface LinkedDocsPreviewModalProps {
  isOpen: boolean;
  parentDoc: SpaceDocument | null;
  allDocs: SpaceDocument[];
  contextDocs?: SpaceDocument[];
  onClose: () => void;
  onOpenDoc: (doc: SpaceDocument, allLinked: SpaceDocument[]) => void;
  onEditLinks: (doc: SpaceDocument) => void;
}

export const LinkedDocsPreviewModal: React.FC<LinkedDocsPreviewModalProps> = ({
  isOpen,
  parentDoc,
  allDocs,
  contextDocs,
  onClose,
  onOpenDoc,
  onEditLinks
}) => {
  if (!isOpen || !parentDoc) return null;

  const linkedIds = parentDoc.linkedDocIds || [];
  const linkedDocs = allDocs.filter(d => linkedIds.includes(d.id) && !d.deletedAt);
  // Total linked cluster: parent doc first, followed by all target linked docs
  const docCluster = [parentDoc, ...linkedDocs];

  // Match the exact visible number from the active view/context (#1, #2...)
  const numPool = (contextDocs && contextDocs.length > 0) ? contextDocs : allDocs;
  const parentIdx = numPool.findIndex(d => d.id === parentDoc.id);
  const parentNum = parentIdx >= 0 ? `#${parentIdx + 1}` : (parentDoc.docNumber ? `#${parentDoc.docNumber}` : '#');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100030,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              🔗
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                מסמכים מוצמדים ומקושרים
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                צמד/קבוצת מסמכים מקושרים ({docCluster.length} מסמכים)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.95rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* SECTION 1: PARENT / PRIMARY DOC */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📌</span>
              <span>מסמך ראשי / מקשר (המצמיד):</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '16px',
                background: '#eff6ff',
                border: '1.5px solid #93c5fd',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.92rem', fontWeight: 800, flexShrink: 0 }}>
                  {parentNum}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e3a8a', wordBreak: 'break-word', lineHeight: 1.25 }}>
                    {parentDoc.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '3px' }}>
                    <span>📅 {new Date(parentDoc.createdAt).toLocaleDateString('he-IL')}</span>
                    {parentDoc.fileSize && <span>⚖️ {formatFileSize(parentDoc.fileSize)}</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenDoc(parentDoc, docCluster)}
                style={{
                  padding: '0.45rem 0.85rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                }}
              >
                👁️ הצג מסמך
              </button>
            </div>
          </div>

          {/* CONNECTOR DIVIDER */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.1rem 0.5rem' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              🔗 מסמכים מוצמדים אליו ({linkedDocs.length})
            </span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          </div>

          {/* SECTION 2: LINKED TARGET DOCS */}
          {linkedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.8rem 1rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.3rem' }}>📎</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>אין מסמכים מוצמדים כעת</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>לחץ על הכפתור למטה כדי להצמיד מסמכים</div>
            </div>
          ) : (
            linkedDocs.map((doc) => {
              const docIdx = numPool.findIndex(d => d.id === doc.id);
              const docNum = docIdx >= 0 ? `#${docIdx + 1}` : (doc.docNumber ? `#${doc.docNumber}` : '#');

              return (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, flexShrink: 0 }}>
                      {docNum}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', wordBreak: 'break-word', lineHeight: 1.25 }}>
                        {doc.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '3px' }}>
                        <span>📅 {new Date(doc.createdAt).toLocaleDateString('he-IL')}</span>
                        {doc.fileSize && <span>⚖️ {formatFileSize(doc.fileSize)}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDoc(doc, docCluster)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: '#0284c7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                    }}
                  >
                    👁️ הצג מסמך
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.75rem', background: '#ffffff' }}>
          <button
            type="button"
            onClick={() => onEditLinks(parentDoc)}
            style={{
              flex: 1,
              padding: '0.7rem',
              background: '#f8fafc',
              color: '#0f172a',
              border: '1.5px solid #cbd5e1',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            ✏️ ערוך הצמדת מסמכים
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.7rem 1.4rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
