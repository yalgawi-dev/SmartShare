const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceTransactions.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('<button onClick={() => setFilter("all")}', '<button id="finance-tab-all" onClick={() => setFilter("all")}');
content = content.replace('<button onClick={() => setFilter("archive")}', '<button id="finance-tab-archive" onClick={() => setFilter("archive")}');
content = content.replace('<button onClick={() => setFilter("pending_me")}', '<button id="finance-tab-pending_me" onClick={() => setFilter("pending_me")}');
content = content.replace('<button onClick={() => setFilter("pending_partners")}', '<button id="finance-tab-pending_partners" onClick={() => setFilter("pending_partners")}');

fs.writeFileSync(file, content, 'utf8');
