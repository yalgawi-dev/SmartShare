const fs = require('fs');
const path = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(path, 'utf-8');

const oldString = `'אני (שלי)'`;
const newString = `'אורח אנונימי'`;

if (content.includes(oldString)) {
  content = content.replace(oldString, newString);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("Replaced 'אני (שלי)' with 'אורח אנונימי'");
} else {
  console.log("String not found");
}
