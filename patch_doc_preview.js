const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

const oldTimeline = `            onRemoveComment={(id, cid) => removeShelfEventComment(space.id, id, cid)} 
            onUploadAndLink={async (eventId, url) => {`;
            
const newTimeline = `            onRemoveComment={(id, cid) => removeShelfEventComment(space.id, id, cid)} 
            onPreviewDocs={(docs, index) => setPreviewState({ docs, index })}
            onUploadAndLink={async (eventId, url) => {`;

tx = tx.replace(oldTimeline, newTimeline);
fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', tx);
