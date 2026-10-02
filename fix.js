const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

const search = '<tr id={`partner-row-${b.userId}`} style={{ scrollMarginTop: "100px" }}';
const replace = '<tr id={`partner-row-${b.userId}`}';
txt = txt.replace(search, replace);

const styleSearch = "style={{ borderBottom: '1px solid var(--border-light)', background: expandedPartnerId === b.userId ? 'rgba(99,102,241,0.08)' : b.userId === user?.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1, cursor: isCreatorMe";
const styleReplace = "style={{ scrollMarginTop: '100px', borderBottom: '1px solid var(--border-light)', background: expandedPartnerId === b.userId ? 'rgba(99,102,241,0.08)' : b.userId === user?.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1, cursor: isCreatorMe";
txt = txt.replace(styleSearch, styleReplace);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', txt);
console.log('Replaced');
