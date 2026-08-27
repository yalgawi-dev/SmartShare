const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// 1. Remove the old activeProfile mapping from the very bottom
const bottomMapping = `        // --- LAZY EVALUATION: Choose the active profile and encode ONLY that one! ---
        let activeProfile = forcedProfile;
        
        // Auto-Detect Mapping
        if (activeProfile === 'auto' || activeProfile === 'text' || activeProfile === 'photo' || activeProfile === 'mixed') {
          if (detectedType === 'photo') {
            activeProfile = 'pure_color';
          } else if (detectedType === 'mixed') {
            activeProfile = 'hybrid';
          } else if (detectedType === 'text_bw') {
            activeProfile = 'bw';
          } else {
            activeProfile = 'smart_plus';
          }
        }`;

code = code.replace(bottomMapping, `        // Using early resolved activeProfile instead of re-calculating`);

// 2. Insert the activeProfile mapping earlier in the file (right before Photo Mode `if` statement)
const newMapping = `
        // --- LAZY EVALUATION RESOLUTION ---
        let activeProfile = forcedProfile;
        if (activeProfile === 'auto' || activeProfile === 'text' || activeProfile === 'photo' || activeProfile === 'mixed') {
          if (detectedType === 'photo') {
            activeProfile = 'pure_color';
          } else if (detectedType === 'mixed') {
            activeProfile = 'hybrid';
          } else if (detectedType === 'text_bw') {
            activeProfile = 'bw';
          } else {
            activeProfile = 'smart_plus';
          }
        }
`;

// Insert it right after `let bwRgba = new cv.Mat(); cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);`
let bwRgbaLine = `        cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);`;
let index = code.indexOf(bwRgbaLine);
if (index !== -1) {
    code = code.substring(0, index + bwRgbaLine.length) + newMapping + code.substring(index + bwRgbaLine.length);
} else {
    console.error("Could not find bwRgba line");
}

// 3. Change all the `if (forcedProfile === ...)` blocks to use `activeProfile` and remove 'auto' from conditions!
code = code.replace(/if \(forcedProfile === 'auto' \|\| forcedProfile === 'pure_color' \|\| forcedProfile === 'hybrid'\) \{/g, `if (activeProfile === 'pure_color' || activeProfile === 'hybrid') {`);

code = code.replace(/if \(forcedProfile === 'auto' \|\| forcedProfile === 'smart_color'\) \{/g, `if (activeProfile === 'smart_color') {`);

code = code.replace(/if \(forcedProfile === 'auto' \|\| forcedProfile === 'smart_plus' \|\| forcedProfile === 'hybrid'\) \{/g, `if (activeProfile === 'smart_plus' || activeProfile === 'hybrid') {`);

code = code.replace(/if \(forcedProfile === 'auto' \|\| forcedProfile === 'hybrid'\) \{/g, `if (activeProfile === 'hybrid') {`);

fs.writeFileSync('src/utils/opencvFilters.ts', code);
console.log("Done");
