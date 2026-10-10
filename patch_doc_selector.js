const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

// The doc selector modal currently renders the documents like this:
/*
                {shelfDocs.length > 0 ? shelfDocs.map(doc => (
                  <div 
                    key={doc.id}
                    onClick={() => {
                      if (showDocSelector.taskId) {
                        // Attach to task
                        handleToggleTask(showDocSelector.eventId, showDocSelector.taskId, undefined, doc.id);
                      } else {
                        // Attach to event
                        const event = events.find(e => e.id === showDocSelector.eventId);
                        if (event && !event.documentIds?.includes(doc.id)) {
                          onUpdateEvent(event.id, { documentIds: [...(event.documentIds || []), doc.id] });
                        }
                      }
                      setShowDocSelector(null);
                    }}
                    style={{ width: '100%', aspectRatio: '1/1.4', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                    title={doc.title}
                  >
                    {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                  </div>
                )) : (
*/

const oldMapCode = `{shelfDocs.length > 0 ? shelfDocs.map(doc => (`;

const newMapCode = `{shelfDocs.length > 0 ? shelfDocs.map(doc => {
                  const event = events.find(e => e.id === showDocSelector?.eventId);
                  const isSelected = event ? event.documentIds?.includes(doc.id) : false;
                  return (
`;

tx = tx.replace(oldMapCode, newMapCode);

// Now replace the onClick logic and styles to use `isSelected`
const oldOnClickAndDiv = `                  <div 
                    key={doc.id}
                    onClick={() => {
                      if (showDocSelector.taskId) {
                        // Attach to task
                        handleToggleTask(showDocSelector.eventId, showDocSelector.taskId, undefined, doc.id);
                      } else {
                        // Attach to event
                        const event = events.find(e => e.id === showDocSelector.eventId);
                        if (event && !event.documentIds?.includes(doc.id)) {
                          onUpdateEvent(event.id, { documentIds: [...(event.documentIds || []), doc.id] });
                        }
                      }
                      setShowDocSelector(null);
                    }}
                    style={{ width: '100%', aspectRatio: '1/1.4', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? \`url(\${doc.thumbnailUrl || doc.url})\` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                    title={doc.title}
                  >
                    {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                  </div>
                )) : (`;

const newOnClickAndDiv = `                  <div 
                    key={doc.id}
                    onClick={() => {
                      if (showDocSelector.taskId) {
                        // Attach to task
                        handleToggleTask(showDocSelector.eventId, showDocSelector.taskId, undefined, doc.id);
                        setShowDocSelector(null);
                      } else {
                        // Attach to event
                        const ev = events.find(e => e.id === showDocSelector.eventId);
                        if (ev) {
                          if (ev.documentIds?.includes(doc.id)) {
                             onUpdateEvent(ev.id, { documentIds: ev.documentIds.filter(id => id !== doc.id) });
                          } else {
                             onUpdateEvent(ev.id, { documentIds: [...(ev.documentIds || []), doc.id] });
                          }
                        }
                      }
                      // DO NOT CLOSE MODAL ON EVENT ATTACH, LET THEM TOGGLE MULTIPLE!
                    }}
                    style={{ width: '100%', aspectRatio: '1/1.4', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? \`url(\${doc.thumbnailUrl || doc.url})\` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: isSelected ? '3px solid #10b981' : '1px solid #cbd5e1', opacity: isSelected ? 1 : 0.6 }}
                    title={doc.title}
                  >
                    {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                    {isSelected && <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#10b981', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</div>}
                  </div>
                );
              }) : (`;

tx = tx.replace(oldOnClickAndDiv, newOnClickAndDiv);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
console.log('Patched doc selector toggle!');
