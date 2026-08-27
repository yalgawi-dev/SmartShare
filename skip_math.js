const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// 1. Move the lazy evaluation (auto-detect mapping) up, right after Auto-Detect Profile!
// Actually, if I want to skip B&W, I can't do auto-detect!
// Auto-detect REQUIRES bw.
// So if forcedProfile === 'auto', we MUST run bw and auto-detect.
// But if forcedProfile === 'original', we can skip EVERYTHING else!

let insertionPoint = code.indexOf(`        // --- B&W Enhancement (Sauvola Adaptive Thresholding for Thermal Receipts) ---`);

let earlyExitForOriginal = `
        let finalUrl = '';
        if (forcedProfile === 'original') {
            cv.imshow(canvas, dst);
            finalUrl = compressCanvas(canvas, 0.95);
            resolve({ filtered: finalUrl, activeProfile: 'original', detectedType: undefined });
            
            try {
                src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
            } catch(e) {}
            return; // Skip all other math!!!
        }
`;

code = code.substring(0, insertionPoint) + earlyExitForOriginal + code.substring(insertionPoint);

// What about other profiles?
// bw needs gray, small, flatGray, bw.
// photo needs photoHsv
// smart_color needs smoothMask
// smart_plus needs bw, hybridMask.

// To skip photo mode if we don't need it:
// "--- Photo Mode (Professional Photo Enhancement) ---"
let photoPoint = code.indexOf(`        // --- Photo Mode (Professional Photo Enhancement) ---`);
let photoEnd = code.indexOf(`        // --- Smart Color (v17.0 Pure CamScanner Magic Color) ---`);

let photoBlock = code.substring(photoPoint, photoEnd);
code = code.replace(photoBlock, `
        let finalPureRgba = new cv.Mat();
        let photoRgb = new cv.Mat();
        if (forcedProfile === 'auto' || forcedProfile === 'pure_color' || forcedProfile === 'hybrid') {
${photoBlock}
        }
`);

// To skip Smart Color if we don't need it:
let smartPoint = code.indexOf(`        // --- Smart Color (v17.0 Pure CamScanner Magic Color) ---`);
let smartEnd = code.indexOf(`        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---`);

let smartBlock = code.substring(smartPoint, smartEnd);
code = code.replace(smartBlock, `
        let finalSmartRgba = new cv.Mat();
        if (forcedProfile === 'smart_color') {
${smartBlock}
        }
`);

// To skip Smart Plus if we don't need it:
let plusPoint = code.indexOf(`        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---`);
let plusEnd = code.indexOf(`        // --- Hybrid Color (Restored Masked Blending) ---`);

let plusBlock = code.substring(plusPoint, plusEnd);
code = code.replace(plusBlock, `
        let finalSmartPlusRgba = new cv.Mat();
        if (forcedProfile === 'auto' || forcedProfile === 'smart_plus' || forcedProfile === 'hybrid') {
${plusBlock}
        }
`);

fs.writeFileSync('src/utils/opencvFilters.ts', code);
