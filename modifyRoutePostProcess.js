const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

// Add post-processing for duplication
const postProcessingTarget = /return NextResponse\.json\(\{ success: true, \.\.\.parsedData/m;
const postProcessingReplacement = `
        // --- POST-PROCESSING: Fix Gemini Hallucinations ---
        if (parsedData.clientName && parsedData.vendor) {
          // If clientName is basically identical to vendor name, nullify it.
          const cName = parsedData.clientName.trim().toLowerCase();
          const vName = parsedData.vendor.trim().toLowerCase();
          
          if (cName === vName || cName.includes(vName) || vName.includes(cName)) {
            parsedData.clientName = null;
          }
        }
        
        return NextResponse.json({ success: true, ...parsedData`;

content = content.replace(postProcessingTarget, postProcessingReplacement);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated route.ts with post-processing");
