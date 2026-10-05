const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Replace getRenderedDimensions
const getRenderedTarget = `  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
  const getRenderedDimensions = () => {
    if (!imgRect || naturalSize.w === 1) return null;
    const ratio = Math.min(imgRect.width / naturalSize.w, imgRect.height / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (imgRect.width - renderedWidth) / 2;
    const offsetY = (imgRect.height - renderedHeight) / 2;
    return { ratio, offsetX, offsetY };
  };`;

const getRenderedReplacement = `  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
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
code = code.replace(getRenderedTarget, getRenderedReplacement);

// 2. Replace toNatural
const toNatStart = `  // Convert screen coordinates to natural image coordinates
  const toNatural = (clientX: number, clientY: number) => {`;
const toNatEnd = `    };
  };`;

const toNatIdx = code.indexOf(toNatStart);
const toNatEndIdx = code.indexOf(toNatEnd, toNatIdx);

if (toNatIdx !== -1 && toNatEndIdx !== -1) {
  const replacement = `  // Convert screen coordinates to natural image coordinates
  const toNatural = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container || naturalSize.w === 1) return { x: 0, y: 0 };
    
    const currentContainerRect = container.getBoundingClientRect();
    
    const ratio = Math.min(container.clientWidth / naturalSize.w, container.clientHeight / naturalSize.h);
    const zoomScale = currentContainerRect.width / container.clientWidth;
    const currentRatio = ratio * zoomScale;
    
    const renderedWidth = naturalSize.w * currentRatio;
    const renderedHeight = naturalSize.h * currentRatio;
    const offsetX = (currentContainerRect.width - renderedWidth) / 2;
    const offsetY = (currentContainerRect.height - renderedHeight) / 2;
    
    const relX = clientX - currentContainerRect.left - offsetX;
    const relY = clientY - currentContainerRect.top - offsetY;
    
    return {
      x: Math.max(0, Math.min(naturalSize.w, relX / currentRatio)),
      y: Math.max(0, Math.min(naturalSize.h, relY / currentRatio))
    };
  };`;
  code = code.substring(0, toNatIdx) + replacement + code.substring(toNatEndIdx + toNatEnd.length);
}

// 3. Replace SVG style
const svgTarget = `{imgRect && (
        <svg 
          style={{ 
            position: 'absolute', 
            top: imgRect.top - (containerRef.current?.getBoundingClientRect().top || 0), 
            left: imgRect.left - (containerRef.current?.getBoundingClientRect().left || 0),
            width: imgRect.width, 
            height: imgRect.height,
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >`;
const svgReplacement = `{naturalSize.w > 1 && (
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
code = code.replace(svgTarget, svgReplacement);

// 4. Force a re-render of ManualCropper on mount so containerRef.current is populated for the SVG
const cropperMountTarget = `  useEffect(() => {
    const handleResize = () => {`;
const cropperMountReplacement = `  const [, setTick] = useState(0);
  useEffect(() => {
    setTick(t => t + 1); // Force re-render once containerRef is mounted
    const handleResize = () => {`;
code = code.replace(cropperMountTarget, cropperMountReplacement);

// Remove the unused imgRect state
code = code.replace(`  const [imgRect, setImgRect] = useState<DOMRect | null>(null);`, `  // imgRect removed`);
code = code.replace(`setImgRect(imgRef.current.getBoundingClientRect());`, `setTick(t => t+1);`);
code = code.replace(`setImgRect(imgRef.current.getBoundingClientRect());`, `setTick(t => t+1);`);

// Bump version
code = code.replace(/v18\.6/g, 'v18.7');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Math patched');
