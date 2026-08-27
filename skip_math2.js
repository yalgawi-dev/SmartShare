const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

function wrapBlock(startText, endText, condition, varDecl) {
    let startIndex = code.indexOf(startText);
    let endIndex = code.indexOf(endText);
    if (startIndex === -1 || endIndex === -1) {
        console.error("Could not find blocks for: ", startText);
        return;
    }
    
    let block = code.substring(startIndex, endIndex);
    
    // Remove the block from the code first
    let newCode = code.substring(0, startIndex) + `
        ${varDecl}
        if (${condition}) {
${block}
        }
` + code.substring(endIndex);
    
    code = newCode;
}

wrapBlock(
    "        // --- Photo Mode (Professional Photo Enhancement) ---",
    "        // --- Smart Color (v12.5 Ultimate Masked Color Engine - CamScanner Style) ---",
    "forcedProfile === 'auto' || forcedProfile === 'pure_color' || forcedProfile === 'hybrid'",
    "let photoRgb = new cv.Mat();\n        let finalPureRgba = new cv.Mat();"
);

// We need to fix let finalPureRgba in the Photo block since it's now declared above.
code = code.replace(/let finalPureRgba = new cv\.Mat\(\);/g, 'finalPureRgba = new cv.Mat();');
code = code.replace(/let photoRgb = new cv\.Mat\(\);/g, 'photoRgb = new cv.Mat();');

wrapBlock(
    "        // --- Smart Color (v12.5 Ultimate Masked Color Engine - CamScanner Style) ---",
    "        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---",
    "forcedProfile === 'auto' || forcedProfile === 'smart_color'",
    "let finalSmartRgba = new cv.Mat();"
);
code = code.replace(/let finalSmartRgba = new cv\.Mat\(\);/g, 'finalSmartRgba = new cv.Mat();');


wrapBlock(
    "        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---",
    "        // --- Hybrid Color (Restored Masked Blending) ---",
    "forcedProfile === 'auto' || forcedProfile === 'smart_plus' || forcedProfile === 'hybrid'",
    "let finalSmartPlusRgba = new cv.Mat();"
);
code = code.replace(/let finalSmartPlusRgba = new cv\.Mat\(\);/g, 'finalSmartPlusRgba = new cv.Mat();');


wrapBlock(
    "        // --- Hybrid Color (Restored Masked Blending) ---",
    "        // --- LAZY EVALUATION: Choose the active profile and encode ONLY that one! ---",
    "forcedProfile === 'auto' || forcedProfile === 'hybrid'",
    "let finalHybrid = undefined;"
);
// It already uses finalHybrid without let inside the block

fs.writeFileSync('src/utils/opencvFilters.ts', code);
console.log("Done.");
