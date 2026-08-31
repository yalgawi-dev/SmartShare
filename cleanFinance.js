const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');

// The line currently says: addGuestPartner(space.id, 'אורח/ת', isRetroactive, shadowToken);
// We want to remove this line.

const badLine = "addGuestPartner(space.id, 'אורח/ת', isRetroactive, shadowToken);";
if (content.includes(badLine)) {
  content = content.replace(badLine, "");
} else {
  // Try another variation
  const regex = /addGuestPartner\([^)]+\);/;
  content = content.replace(regex, "");
}

// Remove addGuestPartner from context usage
content = content.replace("const { addGuestPartner } = useSpaces() as any;", "");

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content, 'utf-8');
console.log('FinanceWidget clean of addGuestPartner');
