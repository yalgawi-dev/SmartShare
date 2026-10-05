const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// The duplicated/broken block starts after the return of the new toNatural:
// Let's just find the exact boundaries.
const startSearch = "  // Convert screen coordinates to natural image coordinates\n  const toNatural = (clientX: number, clientY: number) => {";
const endSearch = "  const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {";

const startIndex = code.indexOf(startSearch);
const endIndex = code.indexOf(endSearch);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `  // Convert screen coordinates to natural image coordinates
  const toNatural = (clientX: number, clientY: number) => {
    const currentImgRect = imgRef.current?.getBoundingClientRect();
    if (!currentImgRect || naturalSize.w === 1) return { x: 0, y: 0 };
    
    const ratio = Math.min(currentImgRect.width / naturalSize.w, currentImgRect.height / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (currentImgRect.width - renderedWidth) / 2;
    const offsetY = (currentImgRect.height - renderedHeight) / 2;
    
    // Position relative to the actual rendered image area (this works flawlessly with CSS scales!)
    const relX = clientX - currentImgRect.left - offsetX;
    const relY = clientY - currentImgRect.top - offsetY;
    
    return {
      x: Math.max(0, Math.min(naturalSize.w, relX / ratio)),
      y: Math.max(0, Math.min(naturalSize.h, relY / ratio))
    };
  };

`;
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
    fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
    console.log("Fixed toNatural duplication");
} else {
    console.log("Could not find boundaries");
}
