'use client';

import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces } from '../../../app/context/SpacesContext';
import { ShelfCoverPicker } from './ShelfCoverPicker';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => void;
}

interface DocumentsWidgetProps {
  space: Space;
  activePartnersCount: number;
}

type ViewMode = 'feed' | 'grid' | 'circles';

export const DocumentsWidget = forwardRef<DocumentsWidgetRef, DocumentsWidgetProps>(({ space, activePartnersCount }, ref) => {
  const { user } = useAuth();
  const { addShelf, updateShelf, addDocument, updateDocument, removeDocument } = useSpaces();
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  
  // For the icon picker
  const [editingShelfCoverId, setEditingShelfCoverId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    addDocument: (url, type, allPages) => {
      let targetShelf = shelves[0];
      if (!targetShelf) {
        const newShelfId = 'shelf_' + Date.now();
        addShelf(space.id, {
          name: 'כללי',
          allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : []
        });
        targetShelf = { id: newShelfId } as any; 
      }
      
      addDocument(space.id, {
        shelfId: targetShelf.id,
        url,
        title: type === 'image' ? 'תמונה חדשה' : 'מסמך חדש',
        type,
        addedBy: user?.id || ''
      });
    }
  }));

  const handleCreateShelf = () => {
    const name = window.prompt('שם המדף החדש:');
    if (name && name.trim()) {
      addShelf(space.id, {
        name: name.trim(),
        allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : []
      });
    }
  };

  const handleRenameShelf = (shelfId: string, currentName: string) => {
    const name = window.prompt('שינוי שם למדף:', currentName);
    if (name && name.trim()) {
      updateShelf(space.id, shelfId, { name: name.trim() });
    }
  };

  const handleMoveDocument = (docId: string, currentShelfId: string) => {
    const options = shelves.filter(s => s.id !== currentShelfId).map(s => `${s.name} (ID: ${s.id})`).join('\\n');
    const newShelfId = window.prompt('לאיזה מזהה מדף להעביר?\\n' + options);
    if (newShelfId && shelves.some(s => s.id === newShelfId)) {
      updateDocument(space.id, docId, { shelfId: newShelfId });
    } else if (newShelfId) {
      alert('מזהה מדף לא תקין');
    }
  };

  // --- SORTING LOGIC ---
  // The most active shelf (newest document) comes first
  const sortedShelves = useMemo(() => {
    return [...shelves].sort((a, b) => {
      const docsA = documents.filter(d => d.shelfId === a.id);
      const docsB = documents.filter(d => d.shelfId === b.id);
      
      const timeA = docsA.length > 0 ? Math.max(...docsA.map(d => new Date(d.createdAt).getTime())) : new Date(a.createdAt || 0).getTime();
      const timeB = docsB.length > 0 ? Math.max(...docsB.map(d => new Date(d.createdAt).getTime())) : new Date(b.createdAt || 0).getTime();
      
      return timeB - timeA;
    });
  }, [shelves, documents]);

  const filteredShelves = sortedShelves.filter(s => s.name.includes(searchQuery) || documents.some(d => d.shelfId === s.id && d.title.includes(searchQuery)));

  if (shelves.length === 0) {
    return (
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗄️</div>
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>ברוכים הבאים למחסן המסמכים</h2>
        <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: '1.6' }}>
          כאן תוכלו לשמור, לארגן ולשתף כל מסמך חשוב. צרו מדפים וחלוקות, סרקו מסמכים, ונהלו את המידע החשוב לכם במקום אחד.
        </p>
        <button 
          onClick={() => addShelf(space.id, { name: 'כללי', allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [] })}
          style={{ marginTop: '2rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
          צור מדף ראשון
        </button>
      </div>
    );
  }

  // Active Shelf View (Interior)
  if (activeShelfId) {
    const activeShelf = shelves.find(s => s.id === activeShelfId);
    if (!activeShelf) {
      setActiveShelfId(null);
      return null;
    }
    const shelfDocs = documents.filter(d => d.shelfId === activeShelfId);
    const partitions: Record<string, typeof shelfDocs> = {};
    shelfDocs.forEach(d => {
      const p = d.partitionName || '_general';
      if (!partitions[p]) partitions[p] = [];
      partitions[p].push(d);
    });

    return (
      <div style={{ padding: '1rem', paddingBottom: '6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setActiveShelfId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
            ←
          </button>
          <div style={{ flex: 1 }}>
            <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              {activeShelf.icon || '🗂️'} {activeShelf.name} <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>✏️</span>
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>נוצר: {new Date(activeShelf.createdAt).toLocaleDateString('he-IL')}</div>
          </div>
          <button onClick={() => setEditingShelfCoverId(activeShelf.id)} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
            🖼️ עיצוב מדף
          </button>
        </div>

        {editingShelfCoverId === activeShelf.id && (
          <ShelfCoverPicker 
            onClose={() => setEditingShelfCoverId(null)}
            onSelect={(url, icon) => {
              updateShelf(space.id, activeShelf.id, { coverImage: url, icon });
              setEditingShelfCoverId(null);
            }} 
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {shelfDocs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>המדף ריק.</div>
          ) : (
            Object.keys(partitions).map(partName => (
              <div key={partName}>
                {partName !== '_general' && (
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#475569', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                    {partName}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                  {partitions[partName].map(doc => (
                    <div key={doc.id} style={{ background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div style={{ height: '140px', background: '#e2e8f0', backgroundImage: 'url(' + doc.url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <div style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.title}
                      </div>
                      <div style={{ display: 'flex', borderTop: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                        <div onClick={() => handleMoveDocument(doc.id, activeShelf.id)} style={{ flex: 1, padding: '0.4rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer' }}>
                          🔄 העבר
                        </div>
                        <div style={{ width: '1px', background: '#cbd5e1' }} />
                        <div onClick={() => { const newPart = window.prompt('שם המחיצה:', doc.partitionName || ''); if (newPart !== null) updateDocument(space.id, doc.id, { partitionName: newPart }); }} style={{ flex: 1, padding: '0.4rem', textAlign: 'center', fontSize: '0.75rem', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}>
                          + מחיצה
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- OVERVIEW MODE ---
  return (
    <div style={{ padding: '1rem', paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem' }}>מחסן מסמכים</h2>
        <button onClick={handleCreateShelf} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>
          + מדף חדש
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input 
          type="text" 
          placeholder="חיפוש מסמכים או מדפים..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0', outline: 'none' }}
        />
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '16px', padding: '0.25rem' }}>
          <button onClick={() => setViewMode('feed')} style={{ background: viewMode === 'feed' ? 'white' : 'transparent', border: 'none', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: viewMode === 'feed' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
            📑
          </button>
          <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'white' : 'transparent', border: 'none', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
            ▦
          </button>
          <button onClick={() => setViewMode('circles')} style={{ background: viewMode === 'circles' ? 'white' : 'transparent', border: 'none', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: viewMode === 'circles' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
            ⭕
          </button>
        </div>
      </div>

      {editingShelfCoverId && (
        <ShelfCoverPicker 
          onClose={() => setEditingShelfCoverId(null)}
          onSelect={(url, icon) => {
            updateShelf(space.id, editingShelfCoverId, { coverImage: url, icon });
            setEditingShelfCoverId(null);
          }} 
        />
      )}

      {/* RENDER MODES */}
      {viewMode === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
            return (
              <div key={shelf.id} style={{ background: '#ffffff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div onClick={() => setActiveShelfId(shelf.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', cursor: 'pointer' }}>
                      {!shelf.coverImage && (shelf.icon || '🗂️')}
                    </div>
                    <h3 onClick={() => setActiveShelfId(shelf.id)} style={{ margin: 0, fontSize: '1.1rem', color: '#334155', cursor: 'pointer' }}>
                      {shelf.name}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isPrivate && <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>🔒</span>}
                    <button onClick={() => setEditingShelfCoverId(shelf.id)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>🎨</button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {shelfDocs.length === 0 ? (
                    <div style={{ color: '#cbd5e1', fontSize: '0.9rem', padding: '1rem 0' }}>המדף ריק. המצלמה תסרוק לכאן.</div>
                  ) : (
                    shelfDocs.map(doc => (
                      <div key={doc.id} style={{ width: '100px', flexShrink: 0, background: '#f8fafc', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <div style={{ height: '120px', background: '#e2e8f0', backgroundImage: 'url(' + doc.url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div style={{ padding: '0.4rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.title}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            return (
              <div key={shelf.id} onClick={() => setActiveShelfId(shelf.id)} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '100px', background: '#e2e8f0', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                </div>
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{shelf.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{shelfDocs.length} מסמכים</div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.65rem', marginTop: '0.25rem' }}>נוצר: {new Date(shelf.createdAt).toLocaleDateString('he-IL')}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'circles' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
          {filteredShelves.map(shelf => {
            const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
            return (
              <div key={shelf.id} onClick={() => setActiveShelfId(shelf.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: '90px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', position: 'relative' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                  {isPrivate && <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#ef4444', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: '2px solid white' }}>🔒</div>}
                </div>
                <div style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.2' }}>{shelf.name}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

DocumentsWidget.displayName = 'DocumentsWidget';
