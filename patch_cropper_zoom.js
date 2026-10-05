const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const toNaturalTarget = `  const toNatural = (clientX: number, clientY: number) => {
    const dims = getRenderedDimensions();
    if (!dims || !imgRect) return { x: 0, y: 0 };
    
    // Position relative to the actual rendered image area
    const relX = clientX - imgRect.left - dims.offsetX;
    const relY = clientY - imgRect.top - dims.offsetY;
    
    return {
      x: Math.max(0, Math.min(naturalSize.w, relX / dims.ratio)),
      y: Math.max(0, Math.min(naturalSize.h, relY / dims.ratio))
    };
  };`;

const toNaturalReplacement = `  const toNatural = (clientX: number, clientY: number) => {
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

code = code.replace(toNaturalTarget, toNaturalReplacement);

// Stop propagation on pointer down to prevent react-zoom-pan-pinch from panning when we grab a handle
const ptrDownTarget = `  const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    setActiveHandle({ type, index: idx });`;
    
const ptrDownReplacement = `  const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation(); // VERY IMPORTANT: stops TransformWrapper from panning!
    setActiveHandle({ type, index: idx });`;

code = code.replace(ptrDownTarget, ptrDownReplacement);

// Wrap ManualCropper in TransformWrapper
const cropperTarget = `{step === 'cropping' && rawSnapshot && (
          <ManualCropper 
            imageUrl={rawSnapshot} 
            initialPoints={cropPoints} 
            onChange={setCropPoints} 
          />
        )}`;

const cropperReplacement = `{step === 'cropping' && rawSnapshot && (
          <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit panning={{ excluded: ['no-pan'] }}>
             <TransformComponent wrapperStyle={{ width: '100%', height: '100%', flex: 1, minHeight: '300px' }} contentStyle={{ width: '100%', height: '100%' }}>
                <ManualCropper 
                  imageUrl={rawSnapshot} 
                  initialPoints={cropPoints} 
                  onChange={setCropPoints} 
                />
             </TransformComponent>
          </TransformWrapper>
        )}`;

code = code.replace(cropperTarget, cropperReplacement);

// We should also add className="no-pan" to the SVG handle groups in ManualCropper
code = code.replace(
  `                <g 
                  key={\`edge-\${idx}\`}
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  onPointerDown={(e) => handlePointerDown('edge', idx, e)}
                >`,
  `                <g 
                  key={\`edge-\${idx}\`}
                  className="no-pan"
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  onPointerDown={(e) => handlePointerDown('edge', idx, e)}
                >`
);
code = code.replace(
  `                <g 
                  key={\`corner-\${idx}\`}
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  onPointerDown={(e) => handlePointerDown('corner', idx, e)}
                >`,
  `                <g 
                  key={\`corner-\${idx}\`}
                  className="no-pan"
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  onPointerDown={(e) => handlePointerDown('corner', idx, e)}
                >`
);

// Bump version
code = code.replace(/v18\.4/g, 'v18.5');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Patched manual cropper zoom');
