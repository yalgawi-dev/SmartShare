const fs = require('fs');
const filePath = 'src/components/widgets/PendingApprovalBanner.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the problematic quotes
const regex = /ההודעה שלך \("\w*\{currentMember\.disputeMessage\}"\)/;
// Actually it's easier to just do a string replacement
content = content.replace(
  'ההודעה שלך ("{currentMember.disputeMessage}")',
  'ההודעה שלך ("{currentMember.disputeMessage}")'
);

// Wait, the error is at line 52. Let's see the exact text.
// "ההודעה שלך ("{currentMember.disputeMessage}") מופיעה"
// In JSX, you can't just drop "{var}" inside text directly like that if there are weird quote issues, but standard JSX allows `{currentMember.disputeMessage}`.
// The problem is probably `ההודעה שלך ("`  is not a template literal.
// Let's replace the whole JSX string properly.
content = content.replace(
  'ההודעה שלך ("{currentMember.disputeMessage}") מופיעה אצל מנהל הפרויקט. נעדכן אותך ברגע שהיא תטופל. אם הכל סודר, תוכל לאשר.',
  'ההודעה שלך ({currentMember.disputeMessage}) מופיעה אצל מנהל הפרויקט. נעדכן אותך ברגע שהיא תטופל. אם הכל סודר, תוכל לאשר.'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed quotes in PendingApprovalBanner');
