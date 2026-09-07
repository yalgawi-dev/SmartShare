const fs = require('fs'); 
const str = fs.readFileSync('src/components/widgets/Partners/PendingApprovalBanner.tsx', 'utf8');
if (str.includes('לא צוין שם')) console.log('Hebrew found');
else console.log('Hebrew MISSING');

