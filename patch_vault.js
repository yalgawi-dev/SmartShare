const fs = require('fs');
const lines = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes("<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0 1rem' }}>"));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes("      {pendingImport && ("));

if (startIndex !== -1 && endIndex !== -1) {
  const newLines = `        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
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
      </div>`.split('\n');

  lines.splice(startIndex, endIndex - startIndex - 2, ...newLines);
  
  // Need to make sure I don't remove the div end properly
  
  fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', lines.join('\n'));
  console.log('Patched');
} else {
  console.log('Not found: ', startIndex, endIndex);
}
