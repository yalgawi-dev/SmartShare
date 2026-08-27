const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

function wrapBlock(startText, endText, condition) {
    let startIndex = code.indexOf(startText);
    let endIndex = code.indexOf(endText);
    if (startIndex === -1 || endIndex === -1) {
        console.error("Could not find blocks for: ", startText);
        return;
    }
    
    let block = code.substring(startIndex, endIndex);
    
    // Convert 'let x = new cv.Mat()' to 'x = new cv.Mat()' inside the block
    // ONLY for the specific variables we declare outside!
    
    let newCode = code.substring(0, startIndex) + `
        if (${condition}) {
${block}
        }
` + code.substring(endIndex);
    
    code = newCode;
}

// First, declare ALL output Mats right after the Original early exit, so they are in scope for the whole function
let insertionPoint = code.indexOf(`        // --- B&W Enhancement (Sauvola Adaptive Thresholding for Thermal Receipts) ---`);

let earlyExitForOriginal = `
        if (forcedProfile === 'original') {
            cv.imshow(canvas, dst);
            const originalUrl = compressCanvas(canvas, 0.95);
            resolve({ filtered: originalUrl, activeProfile: 'original' });
            try {
                src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
            } catch(e) {}
            return;
        }

        let photoRgb = new cv.Mat();
        let finalPureRgba = new cv.Mat();
        let finalSmartRgba = new cv.Mat();
        let finalSmartPlusRgba = new cv.Mat();
        let finalHybrid = undefined;
`;

code = code.substring(0, insertionPoint) + earlyExitForOriginal + code.substring(insertionPoint);

// Remove the `let ` keywords from the original declarations in the code
code = code.replace(/let finalPureRgba = new cv\.Mat\(\);/g, 'finalPureRgba = new cv.Mat();');
code = code.replace(/let photoRgb = new cv\.Mat\(\);/g, 'photoRgb = new cv.Mat();');
code = code.replace(/let finalSmartRgba = new cv\.Mat\(\);/g, 'finalSmartRgba = new cv.Mat();');
code = code.replace(/let finalSmartPlusRgba = new cv\.Mat\(\);/g, 'finalSmartPlusRgba = new cv.Mat();');
code = code.replace(/let finalHybrid = new cv\.Mat\(\);/g, 'finalHybrid = new cv.Mat();');

// Now wrap the blocks
wrapBlock(
    "        // --- Photo Mode (Professional Photo Enhancement) ---",
    "        // --- Smart Color (v12.5 Ultimate Masked Color Engine - CamScanner Style) ---",
    "forcedProfile === 'auto' || forcedProfile === 'pure_color' || forcedProfile === 'hybrid'"
);

wrapBlock(
    "        // --- Smart Color (v12.5 Ultimate Masked Color Engine - CamScanner Style) ---",
    "        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---",
    "forcedProfile === 'auto' || forcedProfile === 'smart_color'"
);

wrapBlock(
    "        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---",
    "        // --- Hybrid Color (Restored Masked Blending) ---",
    "forcedProfile === 'auto' || forcedProfile === 'smart_plus' || forcedProfile === 'hybrid'"
);

wrapBlock(
    "        // --- Hybrid Color (Restored Masked Blending) ---",
    "        // --- LAZY EVALUATION: Choose the active profile and encode ONLY that one! ---",
    "forcedProfile === 'auto' || forcedProfile === 'hybrid'"
);

fs.writeFileSync('src/utils/opencvFilters.ts', code);
console.log("Done.");
