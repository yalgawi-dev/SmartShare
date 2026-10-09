const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');
tx = tx.replace("<div style={{ position: 'relative', zIndex: 1, paddingRight: '3rem' }}>", "<div id={`event-${event.id}`} style={{ position: 'relative', zIndex: 1, paddingRight: '3rem' }}>");
fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', tx);
console.log('Patched ShelfTimeline');
