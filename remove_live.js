const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Strip out the useEffect that runs live detection
const useEffectRegex = /useEffect\(\(\) => \{[\s\S]*?const THROTTLE_MS[\s\S]*?cancelAnimationFrame\(liveLoopRef\.current\);\s*\}\s*\}, \[step, cvLoaded\]\);/g;
content = content.replace(useEffectRegex, '');

// Strip out the SVG overly
const svgRegex = /\{\/\* Live contour overlay.*?\{\/\* Dark Overlay/s;
content = content.replace(svgRegex, '{/* Dark Overlay');

fs.writeFileSync(file, content, 'utf8');
console.log('Removed live preview logic');
