const fs = require('fs');

// 1. Update PartnersInviteModal WhatsApp Text
let modalTx = fs.readFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', 'utf8');
modalTx = modalTx.replace(
  `shareText: isFinancial ? \`היי! צירפתי אותך לפרויקט "\${space.title}" עם חלק של \${plannedGuestShare}%. לחץ כאן כדי להיכנס:\\n\${link}\` : \`היי! הוזמנת לשתף פעולה במרחב "\${space.title}". לחץ כאן כדי להיכנס:\\n\${link}\``,
  `shareText: isFinancial ? \`היי! הוזמנת על ידי \${creatorName} להצטרף לפרויקט "\${space.title}" עם חלק של \${plannedGuestShare}%. לחץ כאן כדי להיכנס:\\n\${link}\` : \`היי! הוזמנת על ידי \${creatorName} לשתף פעולה במרחב "\${space.title}". לחץ כאן כדי להיכנס:\\n\${link}\``
);
fs.writeFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', modalTx);

// 2. Update WelcomeGate to remove 0% logic if not financial
let gateTx = fs.readFileSync('src/components/widgets/Partners/WelcomeGate.tsx', 'utf8');
gateTx = gateTx.replace(
  `{displayShare ? \` עם חלק של \${displayShare}%.\` : '.'}`,
  `{isFinancial && displayShare !== undefined ? \` עם חלק של \${displayShare}%.\` : '.'}`
);
fs.writeFileSync('src/components/widgets/Partners/WelcomeGate.tsx', gateTx);

// 3. Update main page pending invites 0% removal
let pageTx = fs.readFileSync('src/app/page.tsx', 'utf8');
pageTx = pageTx.replace(
  `הוזמנת להצטרף למרחב <strong>{item.spaceTitle}</strong> כשותף ({item.invite.guestShare}%)`,
  `הוזמנת להצטרף למרחב <strong>{item.spaceTitle}</strong> {item.invite.guestShare > 0 ? \`כשותף (\${item.invite.guestShare}%)\` : 'כמשתף פעולה'}`
);
fs.writeFileSync('src/app/page.tsx', pageTx);

console.log("Patched 1 & 2");
