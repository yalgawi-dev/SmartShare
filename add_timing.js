const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// 1. Update signature
code = code.replace(
    `Promise<{ filtered: string, activeProfile: string, detectedType?: string }>`,
    `Promise<{ filtered: string, activeProfile: string, detectedType?: string, timings?: { mathMs: number, encodeMs: number, totalMs: number } }>`
);

// 2. Add performance.now() at the start of the image onload (Total Time start)
code = code.replace(
    `img.onload = () => {\n        const canvas = document.createElement('canvas');`,
    `img.onload = () => {\n        const t0_total = performance.now();\n        const canvas = document.createElement('canvas');`
);

// 3. Add performance.now() right before cv.imread (Math Time start)
code = code.replace(
    `let src = cv.imread(canvas);`,
    `const t0_math = performance.now();\n          let src = cv.imread(canvas);`
);

// 4. Add performance.now() right before compressCanvas logic (Math Time end / Encode Time start)
code = code.replace(
    `let finalUrl = '';\n        if (activeProfile === 'original') {`,
    `const t1_math = performance.now();\n        let finalUrl = '';\n        if (activeProfile === 'original') {`
);

// 5. Add performance.now() right before resolve (Encode Time end / Total Time end)
code = code.replace(
    `resolve({\n          filtered: finalUrl,\n          activeProfile: activeProfile,\n          detectedType: detectedType\n        });`,
    `const t1_total = performance.now();\n        resolve({\n          filtered: finalUrl,\n          activeProfile: activeProfile,\n          detectedType: detectedType,\n          timings: { mathMs: Math.round(t1_math - t0_math), encodeMs: Math.round(t1_total - t1_math), totalMs: Math.round(t1_total - t0_total) }\n        });`
);

// Also early exit in original profile
code = code.replace(
    `resolve({ filtered: originalUrl, activeProfile: 'original' });`,
    `resolve({ filtered: originalUrl, activeProfile: 'original', timings: { mathMs: 0, encodeMs: Math.round(performance.now() - t0_math), totalMs: Math.round(performance.now() - t0_total) } });`
);


fs.writeFileSync('src/utils/opencvFilters.ts', code);
