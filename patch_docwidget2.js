const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

const oldHandle = `const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf' = 'document', allPages?: string[]) => {`;
const newHandle = `const handleSaveDocument = async (shelfId: string, url: string, type: 'document' | 'image' | 'pdf' = 'document', allPages?: string[]): Promise<string | undefined> => {`;
tx = tx.replace(oldHandle, newHandle);

const oldSaveDb = `// Save to real database
        addDocument(space.id, { shelfId, url: finalUrl, type, title, addedBy: user?.id || '', thumbnailUrl: finalThumbnailUrl });
      } catch (e) {`;
const newSaveDb = `// Save to real database
        const docId = addDocument(space.id, { shelfId, url: finalUrl, type, title, addedBy: user?.id || '', thumbnailUrl: finalThumbnailUrl });
        return docId;
      } catch (e) {`;
tx = tx.replace(oldSaveDb, newSaveDb);

// Also we need to export handleSaveDocument in DocumentsWidgetRef
const oldRef = `export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => void;
}`;
const newRef = `export interface DocumentsWidgetRef {
  addDocument: (url: string, type: 'document' | 'image' | 'pdf', allPages?: string[]) => void;
  uploadAndLinkDocument?: (shelfId: string, eventId: string, url: string, type: 'document' | 'image' | 'pdf') => Promise<void>;
}`;
tx = tx.replace(oldRef, newRef);

const oldUseImp = `useImperativeHandle(ref, () => ({
    addDocument: (url: string, type: 'document' | 'image' | 'pdf' = 'document', allPages?: string[]) => {
      let targetShelfId = activeShelfId;
      if (!targetShelfId) {
        // If not in a shelf, find "כללי" or create it
        const generalShelf = space.shelves?.find(s => s.name === 'כללי');
        if (generalShelf) {
           targetShelfId = generalShelf.id;
        } else {
           const newShelfId = \`shelf-\${Date.now()}\`;
           addShelf(space.id, { name: 'כללי', allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [] });
           targetShelfId = newShelfId;
        }
      }
      
      handleSaveDocument(targetShelfId, url, typeof type !== 'undefined' ? type : 'document', allPages);
    }
  }));`;

const newUseImp = `useImperativeHandle(ref, () => ({
    addDocument: (url: string, type: 'document' | 'image' | 'pdf' = 'document', allPages?: string[]) => {
      let targetShelfId = activeShelfId;
      if (!targetShelfId) {
        // If not in a shelf, find "כללי" or create it
        const generalShelf = space.shelves?.find(s => s.name === 'כללי');
        if (generalShelf) {
           targetShelfId = generalShelf.id;
        } else {
           const newShelfId = \`shelf-\${Date.now()}\`;
           addShelf(space.id, { name: 'כללי', allowedPartners: activePartnersCount === 0 ? [user?.id || ''] : [] });
           targetShelfId = newShelfId;
        }
      }
      
      handleSaveDocument(targetShelfId, url, typeof type !== 'undefined' ? type : 'document', allPages);
    },
    uploadAndLinkDocument: async (shelfId: string, eventId: string, url: string, type: 'document' | 'image' | 'pdf' = 'document') => {
      const docId = await handleSaveDocument(shelfId, url, type);
      if (docId) {
        const ev = space.shelfEvents?.find(e => e.id === eventId);
        if (ev) {
          updateShelfEvent(space.id, eventId, { documentIds: [...(ev.documentIds || []), docId] });
        }
      }
    }
  }));`;

tx = tx.replace(oldUseImp, newUseImp);

fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', tx);
