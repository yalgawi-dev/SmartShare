const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8');
c = c.replace(/\{viewMode !== 'peer' && \(/g, "{true && (");
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnerControlPanel.tsx', c, 'utf8');
