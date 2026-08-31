const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/page.tsx", "utf-8");

// Remove PartnersWidget import
content = content.replace(/import PartnersWidget from '\.\.\/\.\.\/\.\.\/components\/widgets\/PartnersWidget';\n?/g, "");

// Remove the PartnersWidget usage block
const partnersWidgetRegex = /\{\/\* Partners Widget \*\/\}\s*\{hasPartners && !isGuestMode && \(\s*<PartnersWidget[\s\S]*?\/>\s*\)\}/g;
content = content.replace(partnersWidgetRegex, "");

// Remove onRemove from FinanceWidget
content = content.replace(/onRemove=\{[^}]+\}/g, "");
// But wait, what if ScannerWidget uses onRemove differently?
// let's just strip all `onRemove={...}`
// Wait! `ScannerWidget` expects it optionally.

// Let's do it carefully:
content = content.replace(/onRemove=\{\(\) => handleRemoveFeature\([^)]+\)\}/g, "");
content = content.replace(/onRemove=\{!isGuestMode \? \(\) => handleRemoveFeature\([^)]+\) : undefined\}/g, "");
content = content.replace(/onRemove=\{space\.templateId \? undefined : \(\) => handleRemoveFeature\([^)]+\)\}/g, "");

fs.writeFileSync("src/app/space/[id]/page.tsx", content, "utf-8");
console.log("Updated Space Wall Page");
