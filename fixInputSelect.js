const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', 'utf-8');

c = c.replace(
  `onChange={e => setPartnerShares({ ...partnerShares, [m.userId]: Number(e.target.value) })}`,
  `onChange={e => setPartnerShares({ ...partnerShares, [m.userId]: Number(e.target.value) })} onFocus={e => e.target.select()}`
);

fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', c);
console.log('Added auto-select to partner shares input');
