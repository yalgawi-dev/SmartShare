'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export interface FolderTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  shelfId?: string;
  isShelf?: boolean;
  itemCount?: number;
}

interface FolderTreeExplorerModalProps {
  isOpen: boolean;
  title: string;
  spaceTitle: string;
  mode: 'vault' | 'fileshare';
  nodes: FolderTreeNode[];
  selectedShelfId?: string;
  selectedFolderId: string | null;
  onSelect: (shelfId: string, folderId: string | null) => void;
  onClose: () => void;
}

/**
 * DRY Interactive Folder Tree Explorer Modal (Vault & FileShare).
 * Supports climbing UP & DOWN the hierarchy (expand/collapse + drill-down + parent breadcrumbs),
 * instant search across all depths, item counts, and 1-tap destination selection.
 */
export function FolderTreeExplorerModal({
  isOpen,
  title,
  spaceTitle,
  mode,
  nodes,
  selectedShelfId,
  selectedFolderId,
  onSelect,
  onClose,
}: FolderTreeExplorerModalProps) {
  const [search, setSearch] = useState('');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const nodeMap = useMemo(() => {
    const m = new Map<string, FolderTreeNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const childrenMap = useMemo(() => {
    const m = new Map<string, FolderTreeNode[]>();
    nodes.forEach((n) => {
      const key = n.parentId || '__root__';
      const arr = m.get(key) || [];
      arr.push(n);
      m.set(key, arr);
    });
    return m;
  }, [nodes]);

  // Build clickable breadcrumb path for climbing UP the tree from current focusNodeId
  const focusBreadcrumbs = useMemo(() => {
    const trail: FolderTreeNode[] = [];
    let curr = focusNodeId ? nodeMap.get(focusNodeId) : undefined;
    const guard = new Set<string>();
    while (curr && !guard.has(curr.id)) {
      guard.add(curr.id);
      trail.unshift(curr);
      curr = curr.parentId ? nodeMap.get(curr.parentId) : undefined;
    }
    return trail;
  }, [focusNodeId, nodeMap]);

  // Build selected path preview
  const selectedPathText = useMemo(() => {
    const parts: string[] = [spaceTitle];
    if (mode === 'vault') {
      const shelf = selectedShelfId ? nodeMap.get(selectedShelfId) : undefined;
      if (shelf) parts.push(shelf.name);
      if (selectedFolderId) {
        const chain: string[] = [];
        let curr = nodeMap.get(selectedFolderId);
        const guard = new Set<string>();
        while (curr && !curr.isShelf && !guard.has(curr.id)) {
          guard.add(curr.id);
          chain.unshift(curr.name);
          curr = curr.parentId ? nodeMap.get(curr.parentId) : undefined;
        }
        parts.push(...chain);
      }
    } else {
      parts.push('קיר שיתוף');
      if (selectedFolderId) {
        const chain: string[] = [];
        let curr = nodeMap.get(selectedFolderId);
        const guard = new Set<string>();
        while (curr && !guard.has(curr.id)) {
          guard.add(curr.id);
          chain.unshift(curr.name);
          curr = curr.parentId ? nodeMap.get(curr.parentId) : undefined;
        }
        parts.push(...chain);
      } else {
        parts.push('רמה ראשית');
      }
    }
    return parts.join(' ← ');
  }, [spaceTitle, mode, selectedShelfId, selectedFolderId, nodeMap]);

  const matchingIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set<string>();
    nodes.forEach((n) => {
      if (n.name.toLowerCase().includes(q)) {
        matched.add(n.id);
        // Include all ancestors so full path remains visible
        let p = n.parentId ? nodeMap.get(n.parentId) : undefined;
        const guard = new Set<string>();
        while (p && !guard.has(p.id)) {
          guard.add(p.id);
          matched.add(p.id);
          p = p.parentId ? nodeMap.get(p.parentId) : undefined;
        }
      }
    });
    return matched;
  }, [search, nodes, nodeMap]);

  if (!isOpen || typeof document === 'undefined') return null;

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => setCollapsedIds({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    nodes.forEach((n) => {
      if ((childrenMap.get(n.id) || []).length > 0) next[n.id] = true;
    });
    setCollapsedIds(next);
  };

  const isNodeSelected = (node: FolderTreeNode) => {
    if (mode === 'vault') {
      if (node.isShelf) {
        return selectedShelfId === node.id && !selectedFolderId;
      }
      return selectedFolderId === node.id;
    }
    return selectedFolderId === node.id;
  };

  const handleChooseNode = (node: FolderTreeNode) => {
    if (mode === 'vault') {
      if (node.isShelf) {
        onSelect(node.id, null);
      } else {
        onSelect(node.shelfId || selectedShelfId || '', node.id);
      }
    } else {
      onSelect('', node.id);
    }
    onClose();
  };

  const renderBranch = (parentKey: string, depth: number): React.ReactNode => {
    const list = (childrenMap.get(parentKey) || []).filter(
      (n) => !matchingIds || matchingIds.has(n.id)
    );
    if (list.length === 0) return null;

    return list.map((node) => {
      const children = (childrenMap.get(node.id) || []).filter(
        (c) => !matchingIds || matchingIds.has(c.id)
      );
      const hasChildren = children.length > 0;
      const isCollapsed = !matchingIds && Boolean(collapsedIds[node.id]);
      const selected = isNodeSelected(node);

      return (
        <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 0.65rem',
              marginRight: `${Math.min(depth, 5) * 16}px`,
              borderRadius: '11px',
              background: selected
                ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)'
                : node.isShelf
                  ? '#f8fafc'
                  : '#ffffff',
              border: selected ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
              boxShadow: selected ? '0 2px 8px rgba(79,70,229,0.16)' : 'none',
            }}
          >
            {/* Expand/Collapse Toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                title={isCollapsed ? 'פתח תתי-תיקיות' : 'כווץ תתי-תיקיות'}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCollapsed ? '◀' : '▼'}
              </button>
            ) : (
              <span style={{ width: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', flexShrink: 0 }}>
                {depth > 0 ? '↳' : '•'}
              </span>
            )}

            {/* Main clickable label — selects destination immediately */}
            <button
              type="button"
              onClick={() => handleChooseNode(node)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                textAlign: 'right',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: 0,
              }}
            >
              <span style={{ fontSize: '1rem' }}>{node.isShelf ? '🗂️' : '📁'}</span>
              <span
                style={{
                  fontWeight: selected || node.isShelf ? 800 : 700,
                  fontSize: '0.84rem',
                  color: selected ? '#312e81' : '#0f172a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.name}
              </span>
              {typeof node.itemCount === 'number' && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    flexShrink: 0,
                  }}
                >
                  {node.itemCount}
                </span>
              )}
              {selected && (
                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#4f46e5', flexShrink: 0 }}>
                  ✓ נבחר
                </span>
              )}
            </button>

            {/* Drill-down into subtree button */}
            {hasChildren && (
              <button
                type="button"
                onClick={() => setFocusNodeId(node.id)}
                title="רד לתוך תיקייה זו"
                style={{
                  padding: '3px 7px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                היכנס ↲
              </button>
            )}
          </div>

          {hasChildren && !isCollapsed && renderBranch(node.id, depth + 1)}
        </div>
      );
    });
  };

  const rootKey = focusNodeId || '__root__';
  const parentOfFocus = focusNodeId ? nodeMap.get(focusNodeId)?.parentId || null : null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 999999,
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
          maxHeight: '84vh',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.32)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.9rem 1.1rem',
            background: 'linear-gradient(135deg, #312e81, #4f46e5)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.98rem' }}>🌳 {title}</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.82)', marginTop: '2px' }}>
              לחץ על כל תיקייה לבחירה, או על ◀ / ▼ ו-היכנס ↲ לניווט בעץ
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Selected Path Preview */}
        <div
          style={{
            padding: '0.55rem 0.9rem',
            background: '#eef2ff',
            borderBottom: '1px solid #c7d2fe',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#3730a3',
            lineHeight: 1.4,
          }}
        >
          📍 יעד נוכחי: {selectedPathText}
        </div>

        {/* Search + Expand/Collapse + Climb Up */}
        <div style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 חפש תיקייה לפי שם..."
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.84rem',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              {focusNodeId && (
                <button
                  type="button"
                  onClick={() => setFocusNodeId(parentOfFocus)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '8px',
                    border: '1px solid #818cf8',
                    background: '#eef2ff',
                    color: '#3730a3',
                    fontWeight: 800,
                    fontSize: '0.73rem',
                    cursor: 'pointer',
                  }}
                >
                  ⬆️ עלה רמה
                </button>
              )}
              {focusBreadcrumbs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFocusNodeId(null)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  🏠 כל העץ
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={expandAll}
                style={{
                  padding: '3px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.71rem',
                  cursor: 'pointer',
                }}
              >
                פתח הכל
              </button>
              <button
                type="button"
                onClick={collapseAll}
                style={{
                  padding: '3px 8px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.71rem',
                  cursor: 'pointer',
                }}
              >
                כווץ הכל
              </button>
            </div>
          </div>
        </div>

        {/* Tree Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.7rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: '#f8fafc',
          }}
        >
          {/* In FileShare mode, allow picking root level directly */}
          {mode === 'fileshare' && !focusNodeId && !search.trim() && (
            <button
              type="button"
              onClick={() => {
                onSelect('', null);
                onClose();
              }}
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '11px',
                border: !selectedFolderId ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                background: !selectedFolderId ? '#eef2ff' : '#ffffff',
                color: !selectedFolderId ? '#312e81' : '#0f172a',
                fontWeight: 800,
                fontSize: '0.84rem',
                textAlign: 'right',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>🌐 קיר השיתוף — רמה ראשית (ללא תיקייה)</span>
              {!selectedFolderId && <span style={{ color: '#4f46e5', fontSize: '0.72rem' }}>✓ נבחר</span>}
            </button>
          )}

          {renderBranch(rootKey, 0) || (
            <div style={{ padding: '1.75rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
              {search.trim() ? 'לא נמצאו תיקיות תואמות לחיפוש.' : 'אין תיקיות נוספות ברמה זו.'}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
