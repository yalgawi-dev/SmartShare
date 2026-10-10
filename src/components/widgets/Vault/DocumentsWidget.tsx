'use client';

import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { universalSearch, universalSort } from '../../../utils/searchEngine';
import { useAuth } from '../../../app/context/AuthContext';
import { Space, useSpaces } from '../../../app/context/SpacesContext';
import { ShelfCoverPicker } from './ShelfCoverPicker';
import ShelfTimeline from './ShelfTimeline';
import { uploadImageToStorage } from '@/lib/firebase';

export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => void;
  uploadAndLinkDocument?: (shelfId: string, eventId: string, url: string, type: 'document' | 'image' | 'pdf') => Promise<void>;
}

interface DocumentsWidgetProps {
  space: Space;
  activePartnersCount: number;
}

type ViewMode = 'feed' | 'grid' | 'circles';

export const DocumentsWidget = forwardRef<DocumentsWidgetRef, DocumentsWidgetProps>(({ space, activePartnersCount }, ref) => {
  const { user } = useAuth();
  const { addShelf, updateShelf, addDocument, updateDocument, removeDocument, addShelfEvent, updateShelfEvent, removeShelfEvent, addShelfEventComment, removeShelfEventComment } = useSpaces();
  
  const shelves = space.shelves || [];
  const documents = space.documents || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'vault'>('timeline');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
    const [pendingImport, setPendingImport] = useState<{ docId?: string, url?: string, type?: 'document' | 'image' | 'pdf', allPages?: string[] } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingDocs, setUploadingDocs] = useState<{ id: string, shelfId: string, url: string, title: string, type: string }[]>([]);
    const [previewState, setPreviewState] = useState<{ docs: any[], index: number } | null>(null);
    const [dragOverDocId, setDragOverDocId] = useState<string | null>(null);
    const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);

  React.useEffect(() => {
    if (activeShelfId) {
      window.dispatchEvent(new CustomEvent('smartshare:shelf_opened'));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:shelf_closed'));
    }
  }, [activeShelfId]);
  React.useEffect(() => {
    const handler = () => {
      const name = window.prompt('שם המדף החדש:');
      if (name && name.trim()) {
        addShelf(space.id, {
          name: name.trim(),
          allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : []
        });
      }
    };
    window.addEventListener('smartshare:add_shelf', handler);
    return () => window.removeEventListener('smartshare:add_shelf', handler);
  }, [space.id, activePartnersCount, user?.id, addShelf]);
  
  const [editingShelfCoverId, setEditingShelfCoverId] = useState<string | null>(null);
  useImperativeHandle(ref, () => ({
    addDocument: (url, type, allPages) => {
      let targetShelfId = activeShelfId;
      
      if (!targetShelfId) {
        if (shelves.length === 1) {
           targetShelfId = shelves[0].id;
        } else if (shelves.length > 1) {
           setPendingImport({ url, type: typeof type !== 'undefined' ? type : 'document', allPages: typeof allPages !== 'undefined' ? allPages : [] });
           return;
        } else {
           const newShelfId = 'shelf_' + Date.now();
           addShelf(space.id, { name: 'כללי', allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [] });
           targetShelfId = newShelfId;
        }
      }
      
      handleSaveDocument(targetShelfId, url, typeof type !== 'undefined' ? type : 'document', allPages);
    }
  }));

  
const shareDocument = async (url: string, title: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const isPdf = url.includes('.pdf') || blob.type === 'application/pdf';
    const ext = isPdf ? 'pdf' : 'jpg';
    const mime = isPdf ? 'application/pdf' : 'image/jpeg';
    const file = new File([blob], `${title || 'document'}.${ext}`, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || 'מסמך' });
    } else {
      const a = document.createElement('a');
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = `${title || 'document'}.${ext}`;
      a.click();
      URL.revokeObjectURL(objUrl);
    }
  } catch (e) {
    console.error('Error sharing', e);
    alert('שגיאה בשיתוף מסמך');
  }
};

  const handleRenameShelf = (shelfId: string, currentName: string) => {
    const name = window.prompt('שינוי שם למדף:', currentName);
    if (name && name.trim()) {
      updateShelf(space.id, shelfId, { name: name.trim() });
    }
  };

    const handleDeleteDocument = (docId: string) => {
      if (window.confirm('האם אתה בטוח שברצונך למחוק מסמך זה?')) {
        removeDocument(space.id, docId);
      }
    };

    
    
    const handleTouchDragStart = (e: React.TouchEvent | React.MouseEvent, docId: string) => {
      setDraggedDocId(docId);
      document.body.style.overflow = 'hidden';
    };

    const handleTouchDragMove = (e: React.TouchEvent) => {
      if (!draggedDocId) return;
      // Note: we can't always e.preventDefault() here without passing { passive: false } to the event listener, 
      // but React passive events allow it if not on document level in some cases.
      const touch = e.touches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetCard = elem?.closest('[data-doc-id]');
      if (targetCard) {
        const targetId = targetCard.getAttribute('data-doc-id');
        if (targetId && targetId !== dragOverDocId) {
          setDragOverDocId(targetId);
        }
      }
    };

    const handleTouchDragEnd = () => {
      if (!draggedDocId) return; // FIX: Don't re-render or cancel clicks if we weren't dragging!
      if (dragOverDocId && draggedDocId !== dragOverDocId) {
        const docA = documents.find(d => d.id === draggedDocId);
        const docB = documents.find(d => d.id === dragOverDocId);
        if (docA && docB) {
          updateDocument(space.id, docA.id, { createdAt: docB.createdAt });
          updateDocument(space.id, docB.id, { createdAt: docA.createdAt });
        }
      }
      setDraggedDocId(null);
      document.body.style.overflow = '';
      setDragOverDocId(null);
    };

    const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => {
      // Optimistic UI update
      const tempId = 'temp-' + Date.now();
      const title = type === 'image' ? 'תמונה סרוקה' : 'מסמך סרוק';
      
      let previewUrl = (allPages && allPages.length > 0) ? allPages[0] : (url.startsWith('data:image') ? url : undefined);
      setUploadingDocs(prev => [...prev, { id: tempId, shelfId, url, title, type, thumbnailUrl: previewUrl }]);
      
      try {
        let finalUrl = url;
        let finalThumbnailUrl = previewUrl;
        if (url.startsWith('data:image') || url.startsWith('data:application/pdf')) {
          const ext = url.startsWith('data:application/pdf') ? 'pdf' : 'jpg';
          const path = `documents/${space.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          finalUrl = await uploadImageToStorage(url, path);
        }

        if (previewUrl && previewUrl.startsWith('data:image')) {
          const thumbPath = `documents/${space.id}/thumb_${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          finalThumbnailUrl = await uploadImageToStorage(previewUrl, thumbPath);
        }

        // Save to real database
        const docId = addDocument(space.id, { shelfId, url: finalUrl, type, title, addedBy: user?.id || '', thumbnailUrl: finalThumbnailUrl });
        return docId;
      } catch (e) {
        console.error("Failed to upload document", e);
        alert("שגיאה בהעלאת המסמך");
      } finally {
        // Remove from optimistic UI
        setUploadingDocs(prev => prev.filter(d => d.id !== tempId));
      }
    };



    
    

  const handleMoveDocument = (docId: string, currentShelfId: string) => {
      setPendingImport({ docId });
    };

  const sortedShelves = useMemo(() => {
    return universalSort(
      shelves, 
      (s) => {
        const docs = documents.filter(d => d.shelfId === s.id);
        return docs.length > 0 ? Math.max(...docs.map(d => new Date(d.createdAt).getTime())) : new Date(s.createdAt || 0).getTime();
      },
      (s) => s.name
    );
  }, [shelves, documents]);

  const filteredShelves = universalSearch(sortedShelves, searchQuery, ['name']);

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

  if (activeShelfId) {
    const activeShelf = shelves.find(s => s.id === activeShelfId);
    if (!activeShelf) {
      setActiveShelfId(null);
      return null;
    }
    const shelfDocs = [...documents.filter(d => d.shelfId === activeShelfId), ...uploadingDocs.filter(d => d.shelfId === activeShelfId).map(d => ({ ...d, createdAt: new Date().toISOString(), addedBy: user?.id || '' }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as any[];
    

    return (
      <>
        <div style={{ padding: '0', paddingBottom: '6rem' }}>
        <div style={{ position: 'sticky', top: '56px', zIndex: 100, background: 'var(--bg-main, #f8fafc)', borderBottom: '1px solid #e2e8f0', margin: '0 -1rem 1rem -1rem', padding: '0.5rem 1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setActiveShelfId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b', padding: '0' }}>
              ←
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 onClick={() => handleRenameShelf(activeShelf.id, activeShelf.name)} style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                {activeShelf.icon || '🗂️'} {activeShelf.name} <span style={{ fontSize: '0.75rem', color: '#3b82f6', marginLeft: '0.2rem' }}>v2.4</span>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>✏️</span>
              </h2>
            </div>
            <button onClick={() => setEditingShelfCoverId(activeShelf.id)} style={{ background: 'transparent', border: 'none', padding: '0', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>
              🎨 עיצוב
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button onClick={() => setActiveTab('timeline')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'timeline' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'timeline' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
              ציר זמן (הסיפור)
            </button>
            <button onClick={() => setActiveTab('vault')} style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'vault' ? '3px solid #3b82f6' : '3px solid transparent', color: activeTab === 'vault' ? '#3b82f6' : '#64748b', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
              מחסן מסמכים
            </button>
          </div>
        </div>

        {editingShelfCoverId === activeShelf.id && (
          <ShelfCoverPicker 
            onClose={() => setEditingShelfCoverId(null)}
            onSelect={(url, icon, color) => {
              updateShelf(space.id, activeShelf.id, { coverImage: url, icon, highlightColor: color });
              setEditingShelfCoverId(null);
            }} 
          />
        )}

        {activeTab === 'timeline' ? (
          <ShelfTimeline 
            space={space} 
            activeShelfId={activeShelfId} 
            shelfDocs={shelfDocs} 
            onAddEvent={(e) => addShelfEvent(space.id, e)} 
            onUpdateEvent={(id, u) => updateShelfEvent(space.id, id, u)} 
            onRemoveEvent={(id) => removeShelfEvent(space.id, id)} 
            onAddComment={(id, text) => addShelfEventComment(space.id, id, text)} 
            onRemoveComment={(id, cid) => removeShelfEventComment(space.id, id, cid)} 
            onUploadAndLink={async (eventId, url) => {
               const docId = await handleSaveDocument(activeShelfId, url, 'document');
               if (docId) {
                  const ev = space.shelfEvents?.find(e => e.id === eventId);
                  if (ev) {
                     updateShelfEvent(space.id, eventId, { documentIds: [...(ev.documentIds || []), docId] });
                  }
               }
            }}
          />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '4px', borderRadius: '12px', alignSelf: 'flex-start' }}>
            <button onClick={() => setFilterLinked('all')} style={{ background: filterLinked === 'all' ? 'white' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: filterLinked === 'all' ? 'bold' : 'normal', color: filterLinked === 'all' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: filterLinked === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>הכל</button>
            <button onClick={() => setFilterLinked('linked')} style={{ background: filterLinked === 'linked' ? 'white' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: filterLinked === 'linked' ? 'bold' : 'normal', color: filterLinked === 'linked' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: filterLinked === 'linked' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>מקושרים</button>
            <button onClick={() => setFilterLinked('unlinked')} style={{ background: filterLinked === 'unlinked' ? 'white' : 'transparent', border: 'none', padding: '4px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: filterLinked === 'unlinked' ? 'bold' : 'normal', color: filterLinked === 'unlinked' ? '#0f172a' : '#64748b', cursor: 'pointer', boxShadow: filterLinked === 'unlinked' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>לא מקושרים</button>
          </div>
          {(() => {
            const activeShelfEvents = space.shelfEvents?.filter(e => e.shelfId === activeShelfId) || [];
            const filteredDocs = shelfDocs.filter(doc => {
              const isLinked = activeShelfEvents.some(e => e.documentIds?.includes(doc.id));
              if (filterLinked === 'linked') return isLinked;
              if (filterLinked === 'unlinked') return !isLinked;
              return true;
            });
            if (filteredDocs.length === 0) return <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>אין מסמכים תואמים.</div>;
            
            return (
              <div onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd} onMouseUp={handleTouchDragEnd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                {filteredDocs.map(doc => {
                  const linkedEvent = activeShelfEvents.find(e => e.documentIds?.includes(doc.id));
                  return (
                    <div key={doc.id} data-doc-id={doc.id} style={{ background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: dragOverDocId === doc.id ? '2px dashed #3b82f6' : '1px solid #e2e8f0', position: 'relative', opacity: draggedDocId === doc.id ? 0.4 : (doc.id.startsWith('temp-') ? 0.6 : 1), transition: 'all 0.2s', transform: dragOverDocId === doc.id ? 'scale(1.02)' : 'scale(1)', display: 'flex', flexDirection: 'column' }}>
                      {doc.id.startsWith('temp-') && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', zIndex: 20 }}>מעלה...</div>}
                      <button onClick={() => handleDeleteDocument(doc.id)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✕</button>
                      {((doc.url && doc.url.includes('.pdf')) || doc.url?.startsWith('data:application/pdf') || doc.type === 'pdf') ? (
                        <div onClick={(e) => { e.stopPropagation(); window.open(doc.url, '_blank'); }} style={{ height: '140px', background: '#e2e8f0', backgroundImage: doc.thumbnailUrl ? 'url(' + doc.thumbnailUrl + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in', position: 'relative' }}>
                          {!doc.thumbnailUrl && <span style={{ fontSize: '3rem' }}>📄</span>}
                          <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '1px' }}>PDF</div>
                        </div>
                      ) : (
                        <div onClick={(e) => { e.stopPropagation(); setPreviewState({ docs: filteredDocs.filter(d => !d.url?.includes('.pdf') && !d.url?.startsWith('data:application/pdf') && d.type !== 'pdf'), index: filteredDocs.filter(d => !d.url?.includes('.pdf') && !d.url?.startsWith('data:application/pdf') && d.type !== 'pdf').findIndex(d => d.id === doc.id) }); }} style={{ height: '140px', background: '#e2e8f0', backgroundImage: 'url(' + doc.url + ')', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'zoom-in', position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '1px' }}>JPG</div>
                        </div>
                      )}
                      
                      <div onTouchStart={(e) => handleTouchDragStart(e, doc.id)} onMouseDown={(e) => handleTouchDragStart(e, doc.id)} style={{ display: 'flex', justifyContent: 'center', padding: '0.4rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', cursor: 'grab' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '2px' }}>|||</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div onClick={(e) => { e.stopPropagation(); const newTitle = window.prompt('הזן כותרת למסמך:', doc.title); if (newTitle && newTitle.trim()) { updateDocument(space.id, doc.id, { title: newTitle.trim() }); } }} style={{ padding: '0.5rem 0.5rem 0.2rem 0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} title="לחץ לשינוי שם">
                          {doc.title}
                        </div>
                        <div style={{ padding: '0 0.5rem 0.2rem 0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
                          {new Date(doc.createdAt).toLocaleDateString('he-IL')}
                        </div>
                        
                        {linkedEvent && (
                          <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
                            <div 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setActiveTab('timeline'); 
                                setTimeout(() => {
                                  const el = document.getElementById('event-' + linkedEvent.id);
                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                              }} 
                              style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontWeight: 'bold', maxWidth: '100%' }}
                              title={'מקושר ל: ' + linkedEvent.title}
                            >
                              🔗 <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linkedEvent.title}</span>
                            </div>
                          </div>
                        )}
                        
                        <div style={{ marginTop: 'auto', display: 'flex', borderTop: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                          <div onClick={() => handleMoveDocument(doc.id, activeShelf.id)} style={{ flex: 1, padding: '0.4rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer' }}>
                            🔄 העבר
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        )}
      </div>
      {pendingImport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', color: '#1e293b', fontSize: '1.25rem' }}>{pendingImport?.docId ? 'לאיזה מדף להעביר את המסמך?' : 'לאיזה מדף לשמור את הקובץ?'}</h3>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: 0 }}>{pendingImport?.docId ? 'בחר את המדף שאליו תרצה להעביר את המסמך' : 'בחר את המדף שאליו יתווסף המסמך החדש'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              {shelves.map(shelf => {
                 return (
                  <button key={shelf.id} onClick={() => {
                      if (pendingImport.docId) {
                        updateDocument(space.id, pendingImport.docId, { shelfId: shelf.id });
                      } else {
                        handleSaveDocument(shelf.id, pendingImport.url!, pendingImport.type || 'document', pendingImport.allPages);
                      }
                      setPendingImport(null);
                    }} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', textAlign: 'right', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: shelf.highlightColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: shelf.highlightColor ? `0 0 10px ${shelf.highlightColor}80` : 'none', fontSize: '1.2rem' }}>
                      {shelf.icon || '📁'}
                    </div>
                    {shelf.name}
                  </button>
                 );
              })}
            </div>
            <button onClick={() => setPendingImport(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '1rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>ביטול פעולה</button>
          </div>
        </div>
      )}

      
      {previewState && (
        <div 
          onClick={(e) => {
            // Close if background is clicked
            if (e.target === e.currentTarget) setPreviewState(null);
          }} 
          onTouchStart={(e) => {
              const touch = e.touches[0];
              const startX = touch.clientX;
              let hasSwiped = false;
              
              const handleTouchMove = (moveEvent) => {
                if (hasSwiped) return;
                const currentX = moveEvent.touches[0].clientX;
                const diff = startX - currentX;
                
                if (Math.abs(diff) > 50) {
                  hasSwiped = true;
                  setPreviewState(prev => {
                    if (!prev) return prev;
                    if (diff > 0 && prev.index < prev.docs.length - 1) return { ...prev, index: prev.index + 1 };
                    if (diff < 0 && prev.index > 0) return { ...prev, index: prev.index - 1 };
                    return prev;
                  });
                }
              };
              
              const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
              };
              
              document.addEventListener('touchmove', handleTouchMove, { passive: true });
              document.addEventListener('touchend', handleTouchEnd);
            }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {previewState.index > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setPreviewState(prev => ({ ...prev!, index: prev!.index - 1 })); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', fontSize: '2rem', cursor: 'pointer', zIndex: 20001, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>‹</button>
          )}
          
          {((previewState.docs[previewState.index].url && previewState.docs[previewState.index].url.includes('.pdf')) || previewState.docs[previewState.index].type === 'pdf' || previewState.docs[previewState.index].url?.startsWith('data:application/pdf')) ? (
              <iframe src={previewState.docs[previewState.index].url} style={{ width: '90%', height: '85%', border: 'none', background: 'white', borderRadius: '8px' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
              <img src={previewState.docs[previewState.index].url} style={{ maxWidth: '100%', maxHeight: '80%', objectFit: 'contain', transition: 'all 0.3s' }} alt="Preview" />
              <button onClick={(e) => { e.stopPropagation(); shareDocument(previewState.docs[previewState.index].url, previewState.docs[previewState.index].title); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 20002 }}>
                   <span>שתף מסמך 📤</span>
              </button>
            </div>
            )}
          
          {previewState.index < previewState.docs.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setPreviewState(prev => ({ ...prev!, index: prev!.index + 1 })); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', fontSize: '2rem', cursor: 'pointer', zIndex: 20001, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>›</button>
          )}
          
          <button onClick={() => setPreviewState(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20001, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>✕</button>
          
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.9rem', zIndex: 20001 }}>
             {previewState.index + 1} / {previewState.docs.length}
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div style={{ padding: '0', paddingBottom: '6rem' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(10px)', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem', display: 'flex', flexDirection: 'column', lineHeight: '1', minWidth: '70px' }}>
          מחסן
          <span style={{ fontSize: '0.6rem', color: '#3b82f6', marginTop: '2px' }}>v2.5</span>
        </h2>
        <input 
          type="text" 
          placeholder="חיפוש מדפים..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', minWidth: 0, fontSize: '0.9rem' }}
        />
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowViewMenu(!showViewMenu)} 
            style={{ height: '100%', padding: '0 0.75rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#475569', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', fontSize: '0.9rem' }}
          >
            <span>{viewMode === 'feed' ? '📑' : viewMode === 'grid' ? '▦' : '⭕'} תצוגה</span>
          </button>
          {showViewMenu && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', padding: '0.5rem', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '130px' }}>
              <button onClick={() => { setViewMode('feed'); setShowViewMenu(false); }} style={{ background: viewMode === 'feed' ? '#f8fafc' : 'transparent', border: 'none', padding: '0.75rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: viewMode === 'feed' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📑</span> רשימה
              </button>
              <button onClick={() => { setViewMode('grid'); setShowViewMenu(false); }} style={{ background: viewMode === 'grid' ? '#f8fafc' : 'transparent', border: 'none', padding: '0.75rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: viewMode === 'grid' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>▦</span> כרטיסיות
              </button>
              <button onClick={() => { setViewMode('circles'); setShowViewMenu(false); }} style={{ background: viewMode === 'circles' ? '#f8fafc' : 'transparent', border: 'none', padding: '0.75rem', textAlign: 'right', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontWeight: viewMode === 'circles' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⭕</span> עיגולים
              </button>
            </div>
          )}
        </div>
      </div>

      {editingShelfCoverId && (
        <ShelfCoverPicker 
          onClose={() => setEditingShelfCoverId(null)}
          onSelect={(url, icon, color) => {
            updateShelf(space.id, editingShelfCoverId, { coverImage: url, icon, highlightColor: color });
            setEditingShelfCoverId(null);
          }} 
        />
      )}

      {viewMode === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => d.addedBy !== user?.id && (Date.now() - new Date(d.createdAt).getTime() < 86400000));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : {});

            return (
              <div key={shelf.id} style={{ background: '#ffffff', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', position: 'relative', ...highlightStyle }}>
                {hasNewRemoteDoc && <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px', background: '#ef4444', borderRadius: '50%', border: '2px solid white' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div onClick={() => setActiveShelfId(shelf.id)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', cursor: 'pointer' }}>
                      {!shelf.coverImage && (shelf.icon || '🗂️')}
                    </div>
                    <h3 onClick={() => setActiveShelfId(shelf.id)} style={{ margin: 0, fontSize: '1.1rem', color: '#334155', cursor: 'pointer' }}>
                      {shelf.name} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>({shelfDocs.length})</span>
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isPrivate && <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold' }}>🔒</span>}
                    <button onClick={() => setEditingShelfCoverId(shelf.id)} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>🎨</button>
                  </div>
                </div>
                
                {/* Removed document previews here per user request, user must click shelf to see contents */}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', padding: '0 1rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const hasNewRemoteDoc = shelfDocs.some(d => d.addedBy !== user?.id && (Date.now() - new Date(d.createdAt).getTime() < 86400000));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '2px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '2px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '40' } : { border: '1px solid #f1f5f9' });

            return (
              <div key={shelf.id} style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column', position: 'relative', ...highlightStyle }}>
                {hasNewRemoteDoc && <div style={{ position: 'absolute', top: '8px', right: '8px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }} />}
                
                <div onClick={() => setActiveShelfId(shelf.id)} style={{ height: '100px', background: '#e2e8f0', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                </div>
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                  <div onClick={() => setActiveShelfId(shelf.id)} style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{shelf.name}</div>
                  <div onClick={() => setActiveShelfId(shelf.id)} style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{shelfDocs.length} מסמכים</div>
                  <div onClick={() => setActiveShelfId(shelf.id)} style={{ color: '#cbd5e1', fontSize: '0.65rem', marginTop: '0.25rem' }}>נוצר: {new Date(shelf.createdAt).toLocaleDateString('he-IL')}</div>
                  <button onClick={(e) => { e.stopPropagation(); setEditingShelfCoverId(shelf.id); }} style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', background: '#f1f5f9', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎨</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'circles' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'flex-start', padding: '0 1rem' }}>
          {filteredShelves.map(shelf => {
            const shelfDocs = documents.filter(d => d.shelfId === shelf.id);
            const isPrivate = shelf.allowedPartners && shelf.allowedPartners.length > 0;
            const hasNewRemoteDoc = shelfDocs.some(d => d.addedBy !== user?.id && (Date.now() - new Date(d.createdAt).getTime() < 86400000));
            const hasRecentDoc = shelfDocs.some(d => (Date.now() - new Date(d.createdAt).getTime() < 60000)); // Just added (1 min)
            const highlightStyle = hasRecentDoc ? { border: '3px solid #3b82f6', boxShadow: '0 0 20px rgba(59,130,246,0.6)' } : (shelf.highlightColor ? { border: '3px solid ' + shelf.highlightColor, boxShadow: '0 0 15px ' + shelf.highlightColor + '60' } : { border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' });

            return (
              <div key={shelf.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: '90px', position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setEditingShelfCoverId(shelf.id); }} style={{ position: 'absolute', top: 0, left: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', zIndex: 10, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>🎨</button>
                {hasNewRemoteDoc && <div style={{ position: 'absolute', top: '4px', right: '4px', width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', border: '2px solid white', zIndex: 10 }} />}
                
                <div onClick={() => setActiveShelfId(shelf.id)} style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f8fafc', backgroundImage: shelf.coverImage ? 'url(' + shelf.coverImage + ')' : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', ...highlightStyle, position: 'relative' }}>
                  {!shelf.coverImage && (shelf.icon || '🗂️')}
                  {isPrivate && <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#ef4444', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: '2px solid white' }}>🔒</div>}
                  <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', color: '#334155', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{shelfDocs.length}</div>
                </div>
                <div onClick={() => setActiveShelfId(shelf.id)} style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.2', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shelf.name}</div>
              </div>
            );
          })}
        </div>
      )}
    
      {pendingImport && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center', color: '#1e293b', fontSize: '1.25rem' }}>{pendingImport?.docId ? 'לאיזה מדף להעביר את המסמך?' : 'לאיזה מדף לשמור את הקובץ?'}</h3>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: 0 }}>{pendingImport?.docId ? 'בחר את המדף שאליו תרצה להעביר את המסמך' : 'בחר את המדף שאליו יתווסף המסמך החדש'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              {shelves.map(shelf => {
                 return (
                  <button key={shelf.id} onClick={() => {
                      if (pendingImport.docId) {
                        updateDocument(space.id, pendingImport.docId, { shelfId: shelf.id });
                      } else {
                        handleSaveDocument(shelf.id, pendingImport.url!, pendingImport.type || 'document', pendingImport.allPages);
                      }
                      setPendingImport(null);
                    }} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s', textAlign: 'right', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: shelf.highlightColor || '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: shelf.highlightColor ? `0 0 10px ${shelf.highlightColor}80` : 'none', fontSize: '1.2rem' }}>
                      {shelf.icon || '📁'}
                    </div>
                    {shelf.name}
                  </button>
                 );
              })}
            </div>
            <button onClick={() => setPendingImport(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '1rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>ביטול פעולה</button>
          </div>
        </div>
      )}

      
      {previewState && (
        <div 
          onClick={(e) => {
            // Close if background is clicked
            if (e.target === e.currentTarget) setPreviewState(null);
          }} 
          onTouchStart={(e) => {
              const touch = e.touches[0];
              const startX = touch.clientX;
              let hasSwiped = false;
              
              const handleTouchMove = (moveEvent) => {
                if (hasSwiped) return;
                const currentX = moveEvent.touches[0].clientX;
                const diff = startX - currentX;
                
                if (Math.abs(diff) > 50) {
                  hasSwiped = true;
                  setPreviewState(prev => {
                    if (!prev) return prev;
                    if (diff > 0 && prev.index < prev.docs.length - 1) return { ...prev, index: prev.index + 1 };
                    if (diff < 0 && prev.index > 0) return { ...prev, index: prev.index - 1 };
                    return prev;
                  });
                }
              };
              
              const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
              };
              
              document.addEventListener('touchmove', handleTouchMove, { passive: true });
              document.addEventListener('touchend', handleTouchEnd);
            }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {previewState.index > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setPreviewState(prev => ({ ...prev!, index: prev!.index - 1 })); }} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', fontSize: '2rem', cursor: 'pointer', zIndex: 20001, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>‹</button>
          )}
          
          {((previewState.docs[previewState.index].url && previewState.docs[previewState.index].url.includes('.pdf')) || previewState.docs[previewState.index].url?.startsWith('data:application/pdf') || previewState.docs[previewState.index].type === 'pdf') ? (
            <div style={{ width: '90%', height: '80%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
               <iframe src={previewState.docs[previewState.index].url} style={{ width: '100%', height: '100%', border: 'none', background: 'white', borderRadius: '12px' }} title="PDF Preview" />
               <div style={{ display: 'flex', gap: '1rem', zIndex: 20002 }}>
                 <button onClick={(e) => { e.stopPropagation(); window.open(previewState.docs[previewState.index].url, '_blank'); }} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <span>הורדה / צפייה</span>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); shareDocument(previewState.docs[previewState.index].url, previewState.docs[previewState.index].title); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <span>שתף 📤</span>
                 </button>
               </div>
            </div>
          ) : (
            <img src={previewState.docs[previewState.index].url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'all 0.3s' }} alt="Preview" />
          )}
          
          {previewState.index < previewState.docs.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setPreviewState(prev => ({ ...prev!, index: prev!.index + 1 })); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', fontSize: '2rem', cursor: 'pointer', zIndex: 20001, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>›</button>
          )}
          
          <button onClick={() => setPreviewState(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20001, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>✕</button>
          
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.9rem', zIndex: 20001 }}>
             {previewState.index + 1} / {previewState.docs.length}
          </div>
        </div>
      )}
    </div>
  );
});

DocumentsWidget.displayName = 'DocumentsWidget';
