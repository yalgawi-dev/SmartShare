const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8').split('\n');
let idx1 = lines.findIndex(l => l.includes('function SharesEditorModal'));
if (idx1 > -1) {
    lines.splice(idx1);
    lines.splice(1, 0, 'import { SharesEditorModal } from "../Partners/SharesEditorModal";');
    fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', lines.join('\n'));
    console.log('Cleaned FinanceSummary.tsx');
}
