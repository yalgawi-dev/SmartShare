const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const target = `  const sortedTrayItems = React.useMemo(() => {
    return [...derivedTrayItems].sort((a, b) => {
      const idxA = trayOrder.indexOf(a.id);
      const idxB = trayOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [derivedTrayItems, trayOrder]);`;

const replacement = `  const sortedTrayItems = React.useMemo(() => {
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
    setTrayOrder(prev => {
      const newIds = derivedTrayItems.map(i => i.id).filter(id => !prev.includes(id));
      if (newIds.length > 0) {
        return [...prev, ...newIds];
      }
      return prev;
    });
  }, [derivedTrayItems]);`;

code = code.replace(target, replacement);

// Also need to make sure activeDocId is in the dependency array for derivedTrayItems!
// It was missing!
const depTarget = `  }, [scannedPages, step, rawSnapshot, imageCache, mode, pendingImports]);`;
const depReplacement = `  }, [scannedPages, step, rawSnapshot, imageCache, mode, pendingImports, activeDocId]);`;
code = code.replace(depTarget, depReplacement);

// Bump version
code = code.replace(/v18\.8/g, 'v18.9');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Tray order synced');
