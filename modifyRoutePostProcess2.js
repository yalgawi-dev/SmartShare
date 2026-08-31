const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const postProcessingTarget = "data = JSON.parse(text);";
const postProcessingReplacement = `data = JSON.parse(text);
      
      // --- POST-PROCESSING: Fix Gemini Hallucinations ---
      if (data.clientName && data.vendor) {
        const cName = data.clientName.trim().toLowerCase();
        const vName = data.vendor.trim().toLowerCase();
        
        if (cName === vName || cName.includes(vName) || vName.includes(cName)) {
          data.clientName = null;
        }
      }`;

content = content.replace(postProcessingTarget, postProcessingReplacement);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated route.ts with post-processing properly");
