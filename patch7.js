const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('{hasPartners && (', '{hasPartners && isCreatorMe && (');

fs.writeFileSync(file, content, 'utf8');
