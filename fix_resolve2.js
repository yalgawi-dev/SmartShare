const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const targetStr = `        resolve({ \r
          filtered: finalUrl,\r
          activeProfile: activeProfile,\r
          detectedType: detectedType\r
        });`;

const replacement = `        const t1_total = performance.now();\r
        resolve({ \r
          filtered: finalUrl,\r
          activeProfile: activeProfile,\r
          detectedType: detectedType,\r
          timings: { mathMs: Math.round(t1_math - t0_math), encodeMs: Math.round(t1_total - t1_math), totalMs: Math.round(t1_total - t0_total) }\r
        });`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/utils/opencvFilters.ts', code);
