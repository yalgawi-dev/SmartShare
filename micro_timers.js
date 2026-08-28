const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// 1. Add Timing variables at start of math
let mathStart = `        const t0_math = performance.now();`;
code = code.replace(mathStart, `        const t0_math = performance.now();
        let t_warp = 0, t_bw = 0, t_hsv = 0, t_hull = 0, t_engine = 0;
        let mark = performance.now();`);

// 2. Measure Warp
let warpEnd = `        // Reset canvas to match the exact cropped image dimension`;
code = code.replace(warpEnd, `        t_warp = performance.now() - mark; mark = performance.now();
        // Reset canvas to match the exact cropped image dimension`);

// 3. Measure B&W Math
let bwEnd = `        // --- Auto-Detect Profile (Photo vs Text vs Mixed) ---`;
code = code.replace(bwEnd, `        t_bw = performance.now() - mark; mark = performance.now();
        // --- Auto-Detect Profile (Photo vs Text vs Mixed) ---`);

// 4. Measure HSV & Masks
let hullStart = `        // --- CONVEX HULL CLUSTERING (Document Layout Analysis) ---`;
code = code.replace(hullStart, `        t_hsv = performance.now() - mark; mark = performance.now();
        // --- CONVEX HULL CLUSTERING (Document Layout Analysis) ---`);

// 5. Measure Hull
let hullEnd = `        // --- LAZY EVALUATION RESOLUTION ---`;
code = code.replace(hullEnd, `        t_hull = performance.now() - mark; mark = performance.now();
        // --- LAZY EVALUATION RESOLUTION ---`);

// 6. Measure Engine Math
let engineEnd = `        const t1_math = performance.now();`;
code = code.replace(engineEnd, `        t_engine = performance.now() - mark; mark = performance.now();
        const t1_math = performance.now();`);

// 7. Update Interface
code = code.replace(
    `timings?: { mathMs: number, encodeMs: number, totalMs: number }`,
    `timings?: { mathMs: number, encodeMs: number, totalMs: number, breakdown?: any }`
);

// 8. Update Resolve to include breakdown
code = code.replace(
    `timings: { mathMs: Math.round(t1_math - t0_math), encodeMs: Math.round(t1_total - t1_math), totalMs: Math.round(t1_total - t0_total) }`,
    `timings: { mathMs: Math.round(t1_math - t0_math), encodeMs: Math.round(t1_total - t1_math), totalMs: Math.round(t1_total - t0_total), breakdown: { warp: Math.round(t_warp), bw: Math.round(t_bw), hsv: Math.round(t_hsv), hull: Math.round(t_hull), engine: Math.round(t_engine) } }`
);

fs.writeFileSync('src/utils/opencvFilters.ts', code);
