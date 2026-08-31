const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const postProcessingTarget = "if (cName === vName || cName.includes(vName) || vName.includes(cName)) {";
const postProcessingReplacement = `// --- POST-PROCESSING: Calculate VAT if missing ---
      if (data.amount && !data.vatAmount) {
        // Calculate VAT component from the total amount
        const vatComponent = data.amount - (data.amount / (1 + (vatRate / 100)));
        data.vatAmount = Number(vatComponent.toFixed(2));
      }
      
      if (cName === vName || cName.includes(vName) || vName.includes(cName)) {`;

content = content.replace(postProcessingTarget, postProcessingReplacement);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated route.ts with VAT math post-processing");
