const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Remove the previously inserted DND block
const oldStateBlockRegex = /  const \[trayOrder, setTrayOrder\] = React\.useState<string\[\]>\(\[\]\);[\s\S]*?    if \(changed \|\| cleanOrder\.length !== trayOrder\.length\) \{\n       setTrayOrder\(cleanOrder\);\n    \}\n  \}, \[derivedTrayItems, trayOrder\]\);\n/m;
code = code.replace(oldStateBlockRegex, '');

// 2. Insert it AFTER `previewIndex`
const targetLine = "const [previewIndex, setPreviewIndex] = useState<number | null>(null);";
const stateToAdd = `  const [trayOrder, setTrayOrder] = React.useState<string[]>([]);
  const [previewType, setPreviewType] = React.useState<'scanned' | 'pending' | null>(null);
  
  // Derived state for sorting tray
  const derivedTrayItems = React.useMemo(() => {
    const items: TrayItem[] = [
      ...scannedPages.map(p => ({ id: p.id, type: 'scanned' as const, url: p.imageUrl, pageNum: p.pageNum })),
      ...(step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? [{ id: 'active-doc', type: 'active' as const, url: imageCache[mode] || rawSnapshot }] : []),
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
code = code.replace(targetLine, `${targetLine}\n${stateToAdd}`);

// 3. Also fix `const [previewType, setPreviewType]` which might have been left over at the old spot
code = code.replace(`  const [previewType, setPreviewType] = React.useState<'scanned' | 'pending' | null>(null);\n`, ''); // it will be added in stateToAdd

// 4. Fix currentImg in handleDone
const newHandleDone = `const handleDone = async (routingType?: 'receipt' | 'document' | 'image') => {
    setIsProcessing(true);
    const currentImg = imageCache[mode];
    
    let allPageUrls: string[] = [];`;
code = code.replace(/const handleDone = async \([\s\S]*?let allPageUrls: string\[\] = \[\];/m, newHandleDone);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Fixed variable scope and currentImg error');
