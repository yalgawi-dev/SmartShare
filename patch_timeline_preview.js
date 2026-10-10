const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

// 1. Add prop to interface
tx = tx.replace(
  "onUploadAndLink?: (eventId: string, url: string) => Promise<void>;\n}",
  "onUploadAndLink?: (eventId: string, url: string) => Promise<void>;\n  onPreviewDocs?: (docs: SpaceDocument[], index: number) => void;\n}"
);

// 2. Add prop to destructuring
tx = tx.replace(
  "onRemoveComment, onUploadAndLink }: ShelfTimelineProps)",
  "onRemoveComment, onUploadAndLink, onPreviewDocs }: ShelfTimelineProps)"
);

// 3. Update eventDocs.map
const oldMap = `{eventDocs.map(doc => (
                            <div 
                              key={doc.id} 
                              onClick={() => window.open(doc.url, '_blank')}`;
const newMap = `{eventDocs.map((doc, docIdx) => (
                            <div 
                              key={doc.id} 
                              onClick={() => {
                                if (onPreviewDocs) {
                                  onPreviewDocs(eventDocs, docIdx);
                                } else {
                                  window.open(doc.url, '_blank');
                                }
                              }}`;
tx = tx.replace(oldMap, newMap);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
