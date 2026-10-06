const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const target = `    const cleanupMats = [
        typeof approx !== 'undefined' ? approx : null,
        typeof hull !== 'undefined' ? hull : null,
        typeof mask !== 'undefined' ? mask : null,
        typeof ptsVector !== 'undefined' ? ptsVector : null,
        typeof meanStd !== 'undefined' ? meanStd : null,
        typeof stdDevMat !== 'undefined' ? stdDevMat : null,
        typeof edges !== 'undefined' ? edges : null,
        typeof blurred !== 'undefined' ? blurred : null,
        typeof edged !== 'undefined' ? edged : null,
        typeof closed !== 'undefined' ? closed : null,
        typeof contours !== 'undefined' ? contours : null,
        typeof hierarchy !== 'undefined' ? hierarchy : null,
        typeof blurredGray !== 'undefined' ? blurredGray : null,
        typeof otsuMat !== 'undefined' ? otsuMat : null,
        typeof otsuClosed !== 'undefined' ? otsuClosed : null,
        typeof otsuContours !== 'undefined' ? otsuContours : null,
        typeof otsuHierarchy !== 'undefined' ? otsuHierarchy : null,
        typeof hsv !== 'undefined' ? hsv : null,
        typeof hsvPlanes !== 'undefined' ? hsvPlanes : null,
        typeof paperMask !== 'undefined' ? paperMask : null,
        typeof satClosed !== 'undefined' ? satClosed : null,
        typeof satContours !== 'undefined' ? satContours : null,
        typeof satHierarchy !== 'undefined' ? satHierarchy : null
    ];
    for (let m of cleanupMats) {
        if (m && typeof m.delete === 'function' && !m.isDeleted()) m.delete();
    }`;

if (code.includes(target)) {
    code = code.replace(target, `    // Removed dangerous cleanupMats block that crashed OpenCV.js when .isDeleted() was undefined
    // Memory leaks are prevented by explicitly deleting Mats in their respective blocks.`);
    fs.writeFileSync('src/utils/opencvFilters.ts', code);
    console.log("Patched detectDocument!");
} else {
    console.log("Target not found");
}
