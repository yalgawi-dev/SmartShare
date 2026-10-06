const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const getRenderedDimensionsRegex = /const getRenderedDimensions = \(\) => {[\s\S]*?return { ratio, offsetX, offsetY };\s*};/;

const replacement = `const getRenderedDimensions = () => {
    const container = containerRef.current;
    if (!container || naturalSize.w === 1) return null;
    
    // Account for the padding we added in v6.5.46
    const paddingLeft = 32;
    const paddingRight = 32;
    const paddingTop = 40;
    const paddingBottom = 80;
    
    const cw = container.clientWidth - paddingLeft - paddingRight;
    const ch = container.clientHeight - paddingTop - paddingBottom;
    
    const ratio = Math.min(cw / naturalSize.w, ch / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    
    // The offset is relative to the SVG, which covers the entire container (including padding).
    // So we must add the padding back to the offset so the SVG points align with the image!
    const offsetX = (cw - renderedWidth) / 2 + paddingLeft;
    const offsetY = (ch - renderedHeight) / 2 + paddingTop;
    return { ratio, offsetX, offsetY };
  };`;

if (getRenderedDimensionsRegex.test(code)) {
    code = code.replace(getRenderedDimensionsRegex, replacement);
    fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
    console.log("Fixed getRenderedDimensions!");
} else {
    console.log("Not found!");
}
