const fs = require('fs');
let widget = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

// 1. Change default view to 'grid'
widget = widget.replace(
  /const \[viewMode, setViewMode\] = useState<'feed' \| 'grid' \| 'circles'>\('feed'\);/,
  "const [viewMode, setViewMode] = useState<'feed' | 'grid' | 'circles'>('grid');"
);

// 2. Remove the "ייבוא" button and file input
// We need to find the <button onClick={() => fileInputRef.current?.click()} ...> block.
// It's in the header:
// <div style={{ display: 'flex', gap: '0.5rem' }}>
//   <button onClick={() => fileInputRef.current?.click()} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem', borderRadius: '20px', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
//     📥 ייבוא
//   </button>
//   <input type="file" ref={fileInputRef} onChange={handleLocalFileUpload} style={{ display: 'none' }} accept="image/*,application/pdf" />

const importBtnRegex = /<button onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}[\s\S]*?<input type="file" ref=\{fileInputRef\} onChange=\{handleLocalFileUpload\} style=\{\{ display: 'none' \}\} accept="image\/\*,application\/pdf" \/>/;
widget = widget.replace(importBtnRegex, "");

// We can optionally remove fileInputRef and handleLocalFileUpload but let's just leave them as unused variables to avoid regex mess, or let TS complain and we'll remove them. Let's remove them:
const refRegex = /const fileInputRef = useRef<HTMLInputElement>\(null\);/;
widget = widget.replace(refRegex, "");

const uploadFuncRegex = /const handleLocalFileUpload = \([\s\S]*?\n  \};\n/;
// Actually better not to risk breaking the file. The TS compiler might warn but not break if it's unused.

// 3. Remove Partitions logic!
// In `if (activeShelfId)`, we have:
/*
    const partitions: Record<string, typeof shelfDocs> = {};
    shelfDocs.forEach(d => {
      const p = d.partitionName || '_general';
      if (!partitions[p]) partitions[p] = [];
      partitions[p].push(d);
    });
*/
// And then:
/*
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
                <div onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd} onMouseUp={handleTouchDragEnd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                  {partitions[partName].map(doc => (
...
                        <div style={{ width: '1px', background: '#cbd5e1' }} />
                        <div onClick={() => { const newPart = window.prompt('שם המחיצה:', doc.partitionName || ''); if (newPart !== null) updateDocument(space.id, doc.id, { partitionName: newPart }); }} style={{ flex: 1, padding: '0.4rem', textAlign: 'center', fontSize: '0.75rem', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}>
                          + מחיצה
                        </div>
*/

// Let's replace the whole partName mapping with just a direct map on shelfDocs!

const oldPartitionLogic = `          {shelfDocs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '3rem' }}>המדף ריק.</div>
          ) : (
            Object.keys(partitions).map(partName => (
              <div key={partName}>
                {partName !== '_general' && (
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#475569', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                    {partName}
                  </div>
                )}
                <div onTouchMove={handleTouchDragMove} onTouchEnd={handleTouchDragEnd} onMouseUp={handleTouchDragEnd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                  {partitions[partName].map(doc => (
                    <div key={doc.id} data-doc-id={doc.id} style={{ background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: dragOverDocId === doc.id ? '2px dashed #3b82f6' : '1px solid #e2e8f0', position: 'relative', opacity: draggedDocId === doc.id ? 0.4 : (doc.id.startsWith('temp-') ? 0.6 : 1), transition: 'all 0.2s', transform: dragOverDocId === doc.id ? 'scale(1.02)' : 'scale(1)' }}>
                      {doc.id.startsWith('temp-') && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', zIndex: 20 }}>מעלה...</div>}
                      <button onClick={() => handleDeleteDocument(doc.id)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✕</button>
                      <div onClick={(e) => { e.stopPropagation(); setPreviewState({ docs: shelfDocs, index: shelfDocs.findIndex(d => d.id === doc.id) }); }} style={{ height: '140px', background: '#e2e8f0', backgroundImage: 'url(' + doc.url + ')', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'zoom-in' }} />
                      <div onTouchStart={(e) => handleTouchDragStart(e, doc.id)} onMouseDown={(e) => handleTouchDragStart(e, doc.id)} style={{ display: 'flex', justifyContent: 'center', padding: '0.4rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', cursor: 'grab' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', letterSpacing: '2px' }}>|||</span>
                        </div>
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
          )}`;

// Let's use regex to find the activeShelfDocs block and replace it.
const blockStartStr = "{shelfDocs.length === 0 ?";
const blockStartIndex = widget.indexOf(blockStartStr);
// The block ends at the closing brace of the mapped partitions before `</div>\n      </div>\n      {pendingImport &&`
// Actually, I can just replace the whole thing accurately with a regex or string extraction.
// Let's do it safely.
