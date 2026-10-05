const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// 1. Wrap ManualCropper in TransformWrapper
let cropperIdx = code.indexOf("{step === 'cropping' && rawSnapshot && (");
if (cropperIdx !== -1) {
    let endIdx = code.indexOf(")}", cropperIdx + 40);
    if (endIdx !== -1) {
        const replacement = `{step === 'cropping' && rawSnapshot && (
          <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit panning={{ excluded: ['no-pan'] }}>
             <TransformComponent wrapperStyle={{ width: '100%', height: '100%', flex: 1, minHeight: '300px' }} contentStyle={{ width: '100%', height: '100%' }}>
                <ManualCropper 
                  imageUrl={rawSnapshot} 
                  initialPoints={cropPoints} 
                  onChange={setCropPoints} 
                />
             </TransformComponent>
          </TransformWrapper>
        `;
        code = code.substring(0, cropperIdx) + replacement + code.substring(endIdx);
    }
}

// 2. Fix handlePointerDown
let ptrDownIdx = code.indexOf("const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {");
if (ptrDownIdx !== -1) {
    let endIdx = code.indexOf("setActiveHandle", ptrDownIdx);
    const replacement = `const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation(); // VERY IMPORTANT: stops TransformWrapper from panning!
    `;
    code = code.substring(0, ptrDownIdx) + replacement + code.substring(endIdx);
}

// 3. Fix toNatural
let toNatIdx = code.indexOf("const toNatural = (clientX: number, clientY: number) => {");
if (toNatIdx !== -1) {
    let endIdx = code.indexOf("};", toNatIdx + 50) + 2;
    const replacement = `const toNatural = (clientX: number, clientY: number) => {
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
  };`;
    code = code.substring(0, toNatIdx) + replacement + code.substring(endIdx);
}

// 4. Add className="no-pan" to edges
code = code.replace(
  /onPointerDown=\{\(e\) => handlePointerDown\('edge', idx, e\)\}/g,
  `className="no-pan"\n                  onPointerDown={(e) => handlePointerDown('edge', idx, e)}`
);

// 5. Add className="no-pan" to corners
code = code.replace(
  /onPointerDown=\{\(e\) => handlePointerDown\('corner', idx, e\)\}/g,
  `className="no-pan"\n                  onPointerDown={(e) => handlePointerDown('corner', idx, e)}`
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Patched properly');
