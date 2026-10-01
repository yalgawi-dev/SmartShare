'use client';

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces } from '../../../app/context/SpacesContext';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => void;
}

interface DocumentsWidgetProps {
  space: Space;
  activePartnersCount: number;
}

export const DocumentsWidget = forwardRef<DocumentsWidgetRef, DocumentsWidgetProps>(({ space, activePartnersCount }, ref) => {
  const { user } = useAuth();
  const { addShelf, updateShelf, addDocument, updateDocument, removeDocument } = useSpaces();
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleCreateFirstShelf = () => {
    addShelf(space.id, {
      name: 'כללי',
      allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : []
    });
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

  const filteredShelves = shelves.filter(s => s.name.includes(searchQuery) || documents.some(d => d.shelfId === s.id && d.title.includes(searchQuery)));

  if (shelves.length === 0) {
    return (
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗄️</div>
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>ברוכים הבאים למחסן המסמכים</h2>
        <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: '1.6' }}>
          כאן תוכלו לשמור, לארגן ולשתף כל מסמך חשוב. צרו מדפים וחלוקות, סרקו מסמכים, ונהלו את המידע החשוב לכם במקום אחד.
        </p>
        <button 
          onClick={handleCreateFirstShelf}
          style={{ marginTop: '2rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
          צור מדף ראשון
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem' }}>מחסן מסמכים</h2>
        <button onClick={handleCreateShelf} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>
          + מדף חדש
        </button>
      </div>

      <input 
        type="text" 
        placeholder="חיפוש מסמכים או מדפים..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', outline: 'none' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {filteredShelves.map(shelf => {
          const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
          const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
          return (
            <div key={shelf.id} style={{ background: '#ffffff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <h3 onClick={() => handleRenameShelf(shelf.id, shelf.name)} style={{ margin: 0, fontSize: '1.1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <span style={{ color: '#94a3b8' }}>🗂️</span> {shelf.name}
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>✏️</span>
                </h3>
                {isPrivate && (
                  <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>
                    🔒 פרטי
                  </span>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(() => {
                  if (shelfDocs.length === 0) return <div style={{ color: '#cbd5e1', fontSize: '0.9rem', padding: '1rem 0' }}>המדף ריק. המצלמה תסרוק לכאן.</div>;
                  
                  // Group by partition
                  const partitions: Record<string, typeof shelfDocs> = {};
                  shelfDocs.forEach(d => {
                    const p = d.partitionName || '_general';
                    if (!partitions[p]) partitions[p] = [];
                    partitions[p].push(d);
                  });

                  return Object.keys(partitions).map(partName => (
                    <div key={partName}>
                      {partName !== '_general' && (
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>📂</span> {partName}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {partitions[partName].map(doc => (
                          <div key={doc.id} style={{ width: '120px', flexShrink: 0, background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                            <div style={{ height: '140px', background: '#e2e8f0', backgroundImage: 'url(' + doc.url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                            <div style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {doc.title}
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9' }}>
                              <div onClick={() => handleMoveDocument(doc.id, shelf.id)} style={{ flex: 1, padding: '0.4rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', background: '#f8fafc', cursor: 'pointer' }}>
                                🔄 העבר
                              </div>
                              <div style={{ width: '1px', background: '#e2e8f0' }} />
                              <div onClick={() => { const newPart = window.prompt('שם המחיצה (למשל: רופא עיניים):', doc.partitionName || ''); if (newPart !== null) updateDocument(space.id, doc.id, { partitionName: newPart }); }} style={{ flex: 1, padding: '0.4rem', textAlign: 'center', fontSize: '0.75rem', color: '#3b82f6', background: '#f1f5f9', cursor: 'pointer' }}>
                                + מחיצה
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

DocumentsWidget.displayName = 'DocumentsWidget';
