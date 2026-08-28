const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const targetStr = `        resolve({ 
          filtered: finalUrl,
          activeProfile: activeProfile,
          detectedType: detectedType
        });`;

const replacement = `        const t1_total = performance.now();
        resolve({ 
          filtered: finalUrl,
          activeProfile: activeProfile,
          detectedType: detectedType,
          timings: { mathMs: Math.round(t1_math - t0_math), encodeMs: Math.round(t1_total - t1_math), totalMs: Math.round(t1_total - t0_total) }
        });`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/utils/opencvFilters.ts', code);
