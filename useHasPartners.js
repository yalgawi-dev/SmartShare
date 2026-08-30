const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

// We inject const hasPartners = space.features?.includes('partners') || false;
const searchStr = "const myId = user?.id || 'me';";
content = content.replace(searchStr, "const myId = user?.id || 'me';\n  const hasPartners = space.features?.includes('partners') || false;");

// Now replace activePartnersCount > 0 with hasPartners for the 3 blocks I modified
// 1. Pending & Balance cubes
content = content.replace("{activePartnersCount > 0 && (", "{hasPartners && (");

// 2. The <th>מאזן</th>
content = content.replace("{activePartnersCount > 0 && <th style={{ padding: '0.75rem' }}>מאזן</th>}", "{hasPartners && <th style={{ padding: '0.75rem' }}>מאזן</th>}");

// 3. The <td>מאזן</td> wrapper
content = content.replace("{activePartnersCount > 0 && (", "{hasPartners && ("); // Since it replaces the first occurrence it finds, we can just replace all of them globally

// Actually let's just do a global replace for the injected conditionals I added
content = content.replace(/\{activePartnersCount > 0 && \(/g, "{hasPartners && (");
content = content.replace(/\{activePartnersCount > 0 && <th/g, "{hasPartners && <th");

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
console.log("Updated to use hasPartners instead of activePartnersCount");
