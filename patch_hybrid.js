const fs = require('fs');

// 1. Patch opencvFilters.ts
let filters = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

// Add 'hybrid_shadow' to forcedProfile type
filters = filters.replace(
  `forcedProfile?: 'bw' | 'smart' | 'smart_plus' | 'pure_color' | 'experimental'`,
  `forcedProfile?: 'bw' | 'smart' | 'smart_plus' | 'pure_color' | 'experimental' | 'hybrid_shadow'`
);

// Add the new engine case
const newEngineCode = `
          case 'hybrid_shadow': {
              const hsT0 = performance.now();
              
              let hsRgb = new cv.Mat();
              cv.cvtColor(dst, hsRgb, cv.COLOR_RGBA2RGB);
              
              // 1. Color Background Division (Flatten lighting)
              let smallRgb = new cv.Mat();
              let scale = 0.2;
              cv.resize(hsRgb, smallRgb, new cv.Size(0,0), scale, scale, cv.INTER_AREA);
              
              let k = Math.floor(Math.max(dst.cols, dst.rows) / 8);
              let smallK = Math.floor(k * scale);
              if (smallK % 2 === 0) smallK++;
              if (smallK < 15) smallK = 15;
              
              cv.GaussianBlur(smallRgb, smallRgb, new cv.Size(smallK, smallK), 0, 0, cv.BORDER_DEFAULT);
              let bgMapRgb = new cv.Mat();
              cv.resize(smallRgb, bgMapRgb, new cv.Size(hsRgb.cols, hsRgb.rows), 0, 0, cv.INTER_LINEAR);
              
              let flatRgb = new cv.Mat();
              cv.divide(hsRgb, bgMapRgb, flatRgb, 255.0, -1);
              
              let punchyRgb = new cv.Mat();
              // Mild contrast stretch to enrich ink color
              flatRgb.convertTo(punchyRgb, -1, 1.5, -50); 
              
              // 2. Adaptive Mask on the flattened image for absolute precision
              let flatGray = new cv.Mat();
              cv.cvtColor(flatRgb, flatGray, cv.COLOR_RGB2GRAY);
              
              let mask = new cv.Mat();
              let maskK = getK(61);
              cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, maskK, 15);
              
              // 3. The Magic Mix: Paint the punchy true-color text onto a 100% pure white canvas
              let finalRgb = new cv.Mat(hsRgb.rows, hsRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
              punchyRgb.copyTo(finalRgb, mask);
              
              cv.cvtColor(finalRgb, finalExperimentalRgba, cv.COLOR_RGB2RGBA);
              
              hsRgb.delete(); smallRgb.delete(); bgMapRgb.delete(); 
              flatRgb.delete(); punchyRgb.delete(); flatGray.delete(); 
              mask.delete(); finalRgb.delete();
              
              t_engine = performance.now() - hsT0;
              break;
          }
`;

// Insert the new case right after case 'experimental': block
const insertPoint = `t_engine = performance.now() - expT0;\n          }`;
const idx = filters.indexOf(insertPoint) + insertPoint.length;
filters = filters.slice(0, idx) + newEngineCode + filters.slice(idx);

fs.writeFileSync('src/utils/opencvFilters.ts', filters);
console.log('Added hybrid_shadow engine');

// 2. Patch ScannerModal.tsx
let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const advancedFiltersUI = `<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>`;

const newAdvancedFiltersUI = `<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleFilterSwitch('hybrid_shadow')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'hybrid_shadow' ? '#8b5cf6' : 'transparent', color: mode === 'hybrid_shadow' ? '#fff' : '#8b5cf6', border: '1px solid #8b5cf6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני 2 (היברידי)</button>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>`;

sm = sm.replace(advancedFiltersUI, newAdvancedFiltersUI);
sm = sm.replace(/v19\.2[0-9]/g, 'v19.27');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);
console.log('Added UI button');

// 3. Patch page.tsx
let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.[0-9]+/g, 'v6.5.85');
fs.writeFileSync('src/app/page.tsx', page);
console.log('Bumped version');
