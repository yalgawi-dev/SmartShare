const fs = require('fs');

// Patch 1: ScannerModal.tsx
let modalCode = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
modalCode = modalCode.replace(
  `...(step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? [{ id: 'active-doc', type: 'active' as const, url: imageCache[mode] || rawSnapshot }] : []),`,
  `...(step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? [{ id: 'active-doc', type: 'active' as const, url: imageCache[mode] || rawSnapshot, isEdited: step === 'review' }] : []),`
);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', modalCode);

// Patch 2: SortableTray.tsx
let trayCode = fs.readFileSync('src/components/widgets/SortableTray.tsx', 'utf8');
trayCode = trayCode.replace(
  `  pageNum?: number;
}`,
  `  pageNum?: number;
  isEdited?: boolean;
}`
);
trayCode = trayCode.replace(
  `              url={item.url}`,
  `              url={item.url}\n              isEdited={item.isEdited}`
);
fs.writeFileSync('src/components/widgets/SortableTray.tsx', trayCode);

// Patch 3: SortableTrayItem.tsx
let itemCode = fs.readFileSync('src/components/widgets/SortableTrayItem.tsx', 'utf8');
itemCode = itemCode.replace(
  `  onClick: () => void;`,
  `  onClick: () => void;\n  isEdited?: boolean;`
);
itemCode = itemCode.replace(
  `export function SortableTrayItem({ id, index, status, url, onClick }: SortableTrayItemProps) {`,
  `export function SortableTrayItem({ id, index, status, url, onClick, isEdited }: SortableTrayItemProps) {`
);
itemCode = itemCode.replace(
  `  let borderColor = '#ef4444'; // default red (unedited)
  if (status === 'cropped') borderColor = '#10b981'; // green (edited)`,
  `  let borderColor = '#ef4444'; // default red (unedited)
  if (status === 'cropped' || isEdited) borderColor = '#10b981'; // green (edited)`
);

// Add visual feedback when dragging
itemCode = itemCode.replace(
  `    opacity: isDragging ? 0.8 : 1,`,
  `    opacity: isDragging ? 0.7 : 1,
    transform: isDragging ? 'scale(1.1)' : 'none', // Pop out effect to indicate drag started`
);
fs.writeFileSync('src/components/widgets/SortableTrayItem.tsx', itemCode);

console.log('Patched UI properties');
