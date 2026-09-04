
const fs = require("fs");
let pageCode = fs.readFileSync("src/app/space/[id]/settings/page.tsx", "utf8");

// 1. Add import
pageCode = pageCode.replace(
  "import { useRouter } from 'next/navigation';", 
  "import { useRouter } from 'next/navigation';\nimport { PartnersSettingsList } from '../../../../components/widgets/Partners/PartnersSettingsList';"
);

// 2. Replace the featureId === "partners" block
const startStr = "{featureId === 'partners' && (";
const targetStartIndex = pageCode.indexOf(startStr);
const endStr = "                {/* Generic features message */}";
const targetEndIndex = pageCode.indexOf(endStr);

const chunkToReplace = pageCode.substring(targetStartIndex, targetEndIndex);
const newChunk = `{featureId === 'partners' && (
                  <PartnersSettingsList space={space} user={user} />
                )}

`;
pageCode = pageCode.replace(chunkToReplace, newChunk);

// Bump version
pageCode = pageCode.replace("הגדרות המרחב (v1.3)", "הגדרות המרחב (v1.5)");
pageCode = pageCode.replace("הגדרות המרחב (v1.4)", "הגדרות המרחב (v1.5)");

fs.writeFileSync("src/app/space/[id]/settings/page.tsx", pageCode, "utf8");
console.log("REPLACED");

