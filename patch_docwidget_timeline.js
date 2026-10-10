const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

const oldTimeline = `<ShelfTimeline 
            space={space} 
            activeShelfId={activeShelfId} 
            shelfDocs={shelfDocs} 
            onAddEvent={(e) => addShelfEvent(space.id, e)} 
            onUpdateEvent={(id, u) => updateShelfEvent(space.id, id, u)} 
            onRemoveEvent={(id) => removeShelfEvent(space.id, id)} 
            onAddComment={(id, text) => addShelfEventComment(space.id, id, text)} 
            onRemoveComment={(id, cid) => removeShelfEventComment(space.id, id, cid)} 
          />`;

const newTimeline = `<ShelfTimeline 
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
          />`;

tx = tx.replace(oldTimeline, newTimeline);
fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', tx);
