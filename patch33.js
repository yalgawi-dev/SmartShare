const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
const regex = /PartnerControlPanel[\s\S]*?viewMode=["']partner["']/g;
const match = regex.exec(c);
if (match) {
  console.log("Found");
} else {
  console.log("Not found");
}
