const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', 'utf-8');

c = c.replace(
  "export function SharesEditorModal({",
  "import { useSpaces } from '../../../app/context/SpacesContext';\nexport function SharesEditorModal({"
);

c = c.replace(
  "const total = myShare + Object.values(partnerShares).reduce((a,b)=>a+b, 0);",
  "const total = myShare + Object.values(partnerShares).reduce((a,b)=>a+b, 0);\n  const { updateSpaceSettings } = useSpaces();\n  const [expHours, setExpHours] = useState(space.settings?.pendingExpirationHours || 1);"
);

c = c.replace(
  "updateSharesBulk(space.id, myShare, partnerShares);",
  "updateSharesBulk(space.id, myShare, partnerShares);\n      if (updateSpaceSettings) {\n        updateSpaceSettings(space.id, { pendingExpirationHours: expHours });\n      }"
);

c = c.replace(
  `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>`,
  `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <span style={{ fontWeight: 'bold' }}>סה"כ:</span>`
); // Let's find the exact block

fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', c);
console.log('Modified SharesEditorModal part 1');
