const fs = require('fs');

let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Add Import
const importToAdd = `import SortableTray from './SortableTray';\nimport type { TrayItem } from './SortableTray';\n`;
code = code.replace(`import { jsPDF } from "jspdf";`, `import { jsPDF } from "jspdf";\n${importToAdd}`);

// 2. Add trayOrder and previewType state
const stateToAdd = `  const [trayOrder, setTrayOrder] = useState<string[]>([]);
  const [previewType, setPreviewType] = useState<'scanned' | 'pending' | null>(null);
  
  // Derived state for sorting tray
  const derivedTrayItems = React.useMemo(() => {
    const items: TrayItem[] = [
      ...scannedPages.map(p => ({ id: p.id, type: 'scanned' as const, url: p.imageUrl, pageNum: p.pageNum })),
      ...(step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? [{ id: 'active-doc', type: 'active' as const, url: imageCache[mode] || rawSnapshot! }] : []),
      ...pendingImports.map((url, i) => ({ id: \`pending-\${i}-\${url.substring(0,10)}\`, type: 'pending' as const, url }))
    ];
    return items;
  }, [scannedPages, step, rawSnapshot, imageCache, mode, pendingImports]);

  const sortedTrayItems = React.useMemo(() => {
    return [...derivedTrayItems].sort((a, b) => {
      const idxA = trayOrder.indexOf(a.id);
      const idxB = trayOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [derivedTrayItems, trayOrder]);

  React.useEffect(() => {
    const allIds = derivedTrayItems.map(i => i.id);
    let changed = false;
    const newOrder = [...trayOrder];
    allIds.forEach(id => {
      if (!newOrder.includes(id)) {
         newOrder.push(id);
         changed = true;
      }
    });
    const cleanOrder = newOrder.filter(id => allIds.includes(id));
    if (changed || cleanOrder.length !== trayOrder.length) {
       setTrayOrder(cleanOrder);
    }
  }, [derivedTrayItems, trayOrder]);
`;
code = code.replace(`  const [pendingImports, setPendingImports] = useState<string[]>([]);`, `  const [pendingImports, setPendingImports] = useState<string[]>([]);\n${stateToAdd}`);

// 3. Replace handleDone logic to use sortedTrayItems
const oldHandleDoneRegex = /const handleDone = async \([\s\S]*?if \(allPageUrls\.length === 0\) \{/m;
const newHandleDone = `const handleDone = async (routingType?: 'receipt' | 'document' | 'image') => {
    setIsProcessing(true);
    
    let allPageUrls: string[] = [];
    
    // Process everything in sorted order
    for (const item of sortedTrayItems) {
      if (item.type === 'scanned' || item.type === 'active') {
        allPageUrls.push(item.url);
      } else if (item.type === 'pending') {
         const img = new Image();
         img.src = item.url;
         await new Promise((res) => { img.onload = res; });
         let w = img.width; let h = img.height;
         if (w > 2000) { h = Math.round(h * (2000 / w)); w = 2000; }
         const canvas = document.createElement('canvas');
         canvas.width = w; canvas.height = h;
         const ctx = canvas.getContext('2d');
         if (ctx) {
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            allPageUrls.push(compressCanvas(canvas, 0.82));
         }
      }
    }
    setPendingImports([]);
    
    if (allPageUrls.length === 0) {`;

code = code.replace(oldHandleDoneRegex, newHandleDone);

// 4. Also replace the bottom tray UI
const oldTrayRegex = /\{\/\* GLOBAL TRAYS \*\/\}[\s\S]*?\{\/\* MAIN ACTION BUTTONS \*\/\}/;

const newTray = `{/* GLOBAL TRAYS */}
        <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.8)', overflowX: 'auto', display: 'flex', borderTop: '1px solid #334155' }}>
          <SortableTray 
             items={sortedTrayItems}
             onReorder={(newItems) => setTrayOrder(newItems.map(i => i.id))}
             onItemClick={(item) => {
                if (item.type === 'scanned') {
                   setPreviewType('scanned');
                   setPreviewIndex(scannedPages.findIndex(p => p.id === item.id));
                } else if (item.type === 'pending') {
                   setPreviewType('pending');
                   setPreviewIndex(pendingImports.findIndex(p => p === item.url));
                } else {
                   setPreviewType(null);
                   setPreviewIndex(null);
                }
             }}
          />
        </div>

        {/* MAIN ACTION BUTTONS */}`;

code = code.replace(oldTrayRegex, newTray);

// 5. Update preview UI src attribute logic
code = code.replace(
  `src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]}`,
  `src={previewIndex !== null ? (previewType === 'pending' ? pendingImports[previewIndex] : scannedPages[previewIndex]?.imageUrl) : imageCache[mode]}`
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("ScannerModal patched for DND!");
