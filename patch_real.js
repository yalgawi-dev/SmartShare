const fs = require('fs');

let f = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const engineCode = `
        let finalHybridShadowRgba = new cv.Mat();
        if (activeProfile === 'hybrid_shadow' || forcedProfile === 'hybrid_shadow') {
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
            
            cv.cvtColor(finalRgb, finalHybridShadowRgba, cv.COLOR_RGB2RGBA);
            
            hsRgb.delete(); smallRgb.delete(); bgMapRgb.delete(); 
            flatRgb.delete(); punchyRgb.delete(); flatGray.delete(); 
            mask.delete(); finalRgb.delete();
            
            t_engine = performance.now() - hsT0;
        }`;

const insertTarget = `if (activeProfile === 'experimental' || forcedProfile === 'experimental') {`;

if (!f.includes('finalHybridShadowRgba')) {
    f = f.replace(insertTarget, engineCode + "\n\n        " + insertTarget);
    f = f.replace(/forcedProfile\?: 'auto' \| 'text' \| 'photo' \| 'mixed' \| 'bw' \| 'pure_color' \| 'smart_plus' \| 'hybrid' \| 'experimental' \| 'original'/g, "forcedProfile?: 'auto' | 'text' | 'photo' | 'mixed' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow'");
    
    // add it to the final fallback block
    const canvasOutput = `} else if (activeProfile === 'experimental') {
            finalExperimentalRgba.copyTo(finalToEncode);`;
    const newCanvasOutput = `} else if (activeProfile === 'hybrid_shadow') {
            finalHybridShadowRgba.copyTo(finalToEncode);
        } else if (activeProfile === 'experimental') {
            finalExperimentalRgba.copyTo(finalToEncode);`;
    f = f.replace(canvasOutput, newCanvasOutput);
    
    // add to memory cleanup block
    f = f.replace('finalExperimentalRgba.delete();', 'finalExperimentalRgba.delete();\n        if (finalHybridShadowRgba && !finalHybridShadowRgba.isDeleted()) finalHybridShadowRgba.delete();');

    fs.writeFileSync('src/utils/opencvFilters.ts', f);
    console.log("Patched OpenCV with IF statement");
}

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
const advancedFiltersUI = `<button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>`;
const newAdvancedFiltersUI = `<button onClick={() => handleFilterSwitch('hybrid_shadow')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'hybrid_shadow' ? '#8b5cf6' : 'transparent', color: mode === 'hybrid_shadow' ? '#fff' : '#8b5cf6', border: '1px solid #8b5cf6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני 2 (היברידי)</button>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.8rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>`;

if (!sm.includes('hybrid_shadow')) {
    sm = sm.replace(advancedFiltersUI, newAdvancedFiltersUI);
}
sm = sm.replace(/v19\.2[0-9]/g, 'v19.30');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.[0-9]+/g, 'v6.5.88');
fs.writeFileSync('src/app/page.tsx', page);
console.log('Done v30');
