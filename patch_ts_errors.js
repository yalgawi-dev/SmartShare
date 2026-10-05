const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// The original getRenderedDimensions
const getRenTarget = `  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
  const getRenderedDimensions = () => {
    if (!imgRect || naturalSize.w === 1) return null;
    const ratio = Math.min(imgRect.width / naturalSize.w, imgRect.height / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (imgRect.width - renderedWidth) / 2;
    const offsetY = (imgRect.height - renderedHeight) / 2;
    return { ratio, offsetX, offsetY };
  };`;

const getRenReplacement = `  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
  const getRenderedDimensions = () => {
    const container = containerRef.current;
    if (!container || naturalSize.w === 1) return null;
    
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    
    const ratio = Math.min(cw / naturalSize.w, ch / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (cw - renderedWidth) / 2;
    const offsetY = (ch - renderedHeight) / 2;
    return { ratio, offsetX, offsetY };
  };`;

if (code.includes(getRenTarget)) {
  code = code.replace(getRenTarget, getRenReplacement);
  console.log("getRenderedDimensions replaced successfully.");
} else {
  console.log("getRenderedDimensions target not found! Manual search...");
  // It's possible I used the wrong exact string. Let's just find the function bounds.
  const start = code.indexOf("const getRenderedDimensions = () => {");
  const end = code.indexOf("};", start) + 2;
  code = code.substring(0, start) + getRenReplacement.split('\n').slice(1).join('\n') + code.substring(end);
}

// 2. Remove imgRect from the entire ManualCropper component
// Also declare setTick.
const stateTarget = `  const [activeHandle, setActiveHandle] = useState<{type: 'corner' | 'edge', index: number} | null>(null);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [initialPointsAtDragStart, setInitialPointsAtDragStart] = useState<Point[] | null>(null);
  // imgRect removed
  const [naturalSize, setNaturalSize] = useState({w: 1, h: 1});`;

const stateReplacement = `  const [activeHandle, setActiveHandle] = useState<{type: 'corner' | 'edge', index: number} | null>(null);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [initialPointsAtDragStart, setInitialPointsAtDragStart] = useState<Point[] | null>(null);
  const [, setTick] = useState(0);
  const [naturalSize, setNaturalSize] = useState({w: 1, h: 1});`;
code = code.replace(stateTarget, stateReplacement);

// 3. The SVG still uses imgRect?
// "src/components/widgets/ScannerModal.tsx(1380,8): error TS2304: Cannot find name 'imgRect'."
// Let's replace the SVG wrapper!
const svgCodeStart = code.indexOf("{imgRect && (");
if (svgCodeStart !== -1) {
  const svgCodeEnd = code.indexOf(">", svgCodeStart + 150) + 1;
  const newSvgCode = `{naturalSize.w > 1 && (
        <svg 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0,
            width: '100%', 
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >`;
  code = code.substring(0, svgCodeStart) + newSvgCode + code.substring(svgCodeEnd);
}

// Finally, make sure setTick is used correctly on resize/load.
code = code.replace(/setTick\(t => t\+1\);/g, "setTick(t => t + 1);"); // just format

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Final TS patch done');
