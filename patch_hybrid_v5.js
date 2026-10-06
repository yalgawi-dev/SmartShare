const fs = require('fs');

let filters = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

filters = filters.replace(
  `forcedProfile?: 'bw' | 'smart' | 'smart_plus' | 'pure_color' | 'experimental'`,
  `forcedProfile?: 'bw' | 'smart' | 'smart_plus' | 'pure_color' | 'experimental' | 'hybrid_shadow'`
);

const newEngineCode = `
          case 'hybrid_shadow': {
              const hsT0 = performance.now();
              
              let hsRgb = new cv.Mat();
              cv.cvtColor(dst, hsRgb, cv.COLOR_RGBA2RGB);
              
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
              flatRgb.convertTo(punchyRgb, -1, 1.5, -50); 
              
              let flatGray = new cv.Mat();
              cv.cvtColor(flatRgb, flatGray, cv.COLOR_RGB2GRAY);
              
              let mask = new cv.Mat();
              cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 15);
              
              let finalRgb = new cv.Mat(hsRgb.rows, hsRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
              punchyRgb.copyTo(finalRgb, mask);
              
              cv.cvtColor(finalRgb, finalExperimentalRgba, cv.COLOR_RGB2RGBA);
              
              hsRgb.delete(); smallRgb.delete(); bgMapRgb.delete(); 
              flatRgb.delete(); punchyRgb.delete(); flatGray.delete(); 
              mask.delete(); finalRgb.delete();
              
              t_engine = performance.now() - hsT0;
              break;
          }`;

const insertTarget = `t_engine = performance.now() - expT0;
          }`;

if (filters.includes(insertTarget) && !filters.includes('hybrid_shadow":')) {
    filters = filters.replace(insertTarget, insertTarget + "\n" + newEngineCode);
    fs.writeFileSync('src/utils/opencvFilters.ts', filters);
    console.log('Added hybrid_shadow engine');
}

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
const advancedFiltersUI = `<button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>`;
const newAdvancedFiltersUI = `<button onClick={() => handleFilterSwitch('hybrid_shadow')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'hybrid_shadow' ? '#8b5cf6' : 'transparent', color: mode === 'hybrid_shadow' ? '#fff' : '#8b5cf6', border: '1px solid #8b5cf6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני 2 (היברידי)</button>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>`;

if (!sm.includes('hybrid_shadow')) {
    sm = sm.replace(advancedFiltersUI, newAdvancedFiltersUI);
}
sm = sm.replace(/v19\.2[0-9]/g, 'v19.28');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.[0-9]+/g, 'v6.5.86');
fs.writeFileSync('src/app/page.tsx', page);
