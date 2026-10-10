const fs = require('fs');
let tx = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

tx = tx.replace(
  "addDocument: (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>) => void;",
  "addDocument: (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>) => string;"
);

const oldAddDoc = `const addDocument = (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      documents: [{ ...doc, id: \`doc-\${Date.now()}\`, createdAt: new Date().toISOString() }, ...(space.documents || [])]
    }));
  };`;

const newAddDoc = `const addDocument = (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>) => {
    const docId = \`doc-\${Date.now()}\`;
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      documents: [{ ...doc, id: docId, createdAt: new Date().toISOString() }, ...(space.documents || [])]
    }));
    return docId;
  };`;

tx = tx.replace(oldAddDoc, newAddDoc);
fs.writeFileSync('src/app/context/SpacesContext.tsx', tx);
