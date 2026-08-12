'use client';

import React, { useRef, useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { createPortal } from 'react-dom';
import { compressCanvas } from '../../utils/imageOptimizer';
import { useCamera } from '../../hooks/useCamera';
import { detectDocument, applyPerspectiveAndFilters, Point, ScannerOptions } from '../../utils/opencvFilters';


interface ScannerModalProps {
  onClose: () => void;
  onComplete: (imageDataUrl: string, ocrDataUrl?: string) => void;
}

export default function ScannerModal({ onClose, onComplete }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null as unknown as HTMLVideoElement);
  const guideRef = useRef<HTMLDivElement>(null);
  
  // Ref to store the latest stable contour points in video scale
  const lastContourRef = useRef<Point[] | null>(null);
  const missedFramesRef = useRef<number>(0);
  
  const [cvLoaded, setCvLoaded] = useState(false);
  const [step, setStep] = useState<'scanning' | 'cropping' | 'review'>('scanning');
  
  const {
    stream,
    torchOn,
    zoom,
    setZoom,
    error: cameraError,
    cycleCamera,
    toggleTorch,
    stopCamera
  } = useCamera(videoRef, step === 'scanning');
  
  const [rawSnapshot, setRawSnapshot] = useState<string | null>(null);
  const [cropPoints, setCropPoints] = useState<Point[]>([]);
  const [croppedSnapshot, setCroppedSnapshot] = useState<string | null>(null);
  const [bwSnapshot, setBwSnapshot] = useState<string | null>(null);
  const [colorSnapshot, setColorSnapshot] = useState<string | null>(null);
  const [pureColorSnapshot, setPureColorSnapshot] = useState<string | null>(null);
  const [mode, setMode] = useState<'bw' | 'color' | 'pure_color' | 'original'>('pure_color');
  
  const [devOptions, setDevOptions] = useState<ScannerOptions>({
    gamma: 0.5,
    erodeWeight: 0.5,
    saturationBoost: 1.8,
    bgBlurSize: 21,
    whiteClip: 210
  });
  const [showDevTools, setShowDevTools] = useState(false);

  // 1. Load OpenCV.js safely
  useEffect(() => {
    // @ts-ignore
    if (window.cv && window.cv.Mat) {
      setCvLoaded(true);
      return;
    }

    if (document.getElementById('opencv-script')) {
      const interval = setInterval(() => {
        // @ts-ignore
        if (window.cv && window.cv.Mat) {
          setCvLoaded(true);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.id = 'opencv-script';
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.cv && typeof window.cv.onRuntimeInitialized !== 'undefined') {
        // @ts-ignore
        window.cv.onRuntimeInitialized = () => setCvLoaded(true);
      } else {
        const interval = setInterval(() => {
          // @ts-ignore
          if (window.cv && window.cv.Mat) {
            setCvLoaded(true);
            clearInterval(interval);
          }
        }, 500);
      }
    };
    document.body.appendChild(script);
  }, []);


  const handleCapture = () => {
    if (!videoRef.current || !guideRef.current) return;
    const video = videoRef.current;
    const guideBox = guideRef.current.getBoundingClientRect();
    const videoBox = video.getBoundingClientRect();
    
    const w = video.videoWidth;
    const h = video.videoHeight;

    const canvas = document.createElement('canvas');
    
    // Calculate a scale factor that targets exactly ~1000px width.
    // 1000px is enough for Tesseract OCR to read text but significantly faster than 1500px or 4K.
    const scaleFactor = 1000 / videoBox.width;
    canvas.width = videoBox.width * scaleFactor;
    canvas.height = videoBox.height * scaleFactor;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Crucial for preventing "foggy" or "aliased" artifacts when downscaling 4K video to 1000px
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoRatio = w / h;
    const boxRatio = videoBox.width / videoBox.height;
    
    let renderW = canvas.width;
    let renderH = canvas.height;
    let renderX = 0;
    let renderY = 0;

    if (videoRatio > boxRatio) {
      // cover: wider
      renderH = canvas.height;
      renderW = canvas.height * videoRatio;
      renderX = (canvas.width - renderW) / 2;
    } else {
      // cover: taller
      renderW = canvas.width;
      renderH = canvas.width / videoRatio;
      renderY = (canvas.height - renderH) / 2;
    }

    ctx.drawImage(video, renderX, renderY, renderW, renderH);
    
    // Since the canvas exactly matches the videoBox visually (scaled by scaleFactor),
    // mapping the guideBox is trivial:
    const gLeft = (guideBox.left - videoBox.left) * scaleFactor;
    const gTop = (guideBox.top - videoBox.top) * scaleFactor;
    const gRight = (guideBox.right - videoBox.left) * scaleFactor;
    const gBottom = (guideBox.bottom - videoBox.top) * scaleFactor;

    let defaultPts = [
      { x: gLeft, y: gTop },
      { x: gRight, y: gTop },
      { x: gRight, y: gBottom },
      { x: gLeft, y: gBottom }
    ];
    
    const detectedPts = detectDocument(canvas);
    if (detectedPts) {
      defaultPts = detectedPts;
    }
    
    setCropPoints(defaultPts);
    
    // OPTIMIZATION: Using Single Source of Truth for compression (0.5 quality)
    const snapshotUrl = compressCanvas(canvas);
    setRawSnapshot(snapshotUrl);
    
    stopCamera();
    setStep('cropping');
  };

  const [profile, setProfile] = useState<'auto' | 'text' | 'photo'>('auto');
  const [detectedType, setDetectedType] = useState<'text' | 'photo' | null>(null);

  // 5. Apply Perspective Crop
  const performCrop = async (snapshot: string, pts: Point[], options?: ScannerOptions, targetProfile?: 'auto' | 'text' | 'photo') => {
    try {
      const activeProfile = targetProfile || profile;
      let cropOptions: ScannerOptions | undefined = options;
      
      // If no explicit devOptions were passed (meaning the user clicked a profile button instead of 'Apply Changes')
      if (!options) {
        if (activeProfile === 'text') {
          cropOptions = { gamma: 1.4, bgBlurSize: 51, erodeWeight: 0.5, saturationBoost: 2.6 };
        } else if (activeProfile === 'photo') {
          cropOptions = { gamma: 0.8, bgBlurSize: 49, erodeWeight: 0.3, saturationBoost: 2.2 };
        }
        // If activeProfile is 'auto', cropOptions remains undefined, letting opencvFilters decide.
      }
      
      const results = await applyPerspectiveAndFilters(snapshot, pts, cropOptions);
      setCroppedSnapshot(results.cropped);
      setBwSnapshot(results.bw);
      setColorSnapshot(results.color);
      setPureColorSnapshot(results.pureColor);
      
      if (results.detectedType) {
        setDetectedType(results.detectedType as 'text' | 'photo');
        if (activeProfile === 'auto') {
          setProfile(results.detectedType as 'text' | 'photo');
        }
      }
      if (results.appliedOptions && showDevTools) {
        setDevOptions(results.appliedOptions);
      }
    } catch (err: any) {
      console.error("Crop failed:", err);
      alert("Error in crop: " + (err?.message || err));
    }
  };

  const handleCropComplete = async () => {
    if (!rawSnapshot || cropPoints.length !== 4) return;
    await performCrop(rawSnapshot, cropPoints);
    setStep('review');
  };

  const handleApplyDevOptions = async () => {
    if (!rawSnapshot || cropPoints.length !== 4) return;
    await performCrop(rawSnapshot, cropPoints, devOptions, profile !== 'auto' ? profile : undefined);
  };

  const handleRetake = () => {
    setStep('scanning');
    setRawSnapshot(null);
    setCroppedSnapshot(null);
    setBwSnapshot(null);
    setColorSnapshot(null);
    setPureColorSnapshot(null);
    setProfile('auto');
    setDetectedType(null);
  };

  const handleDone = () => {
    let finalImage = bwSnapshot;
    if (mode === 'color') finalImage = colorSnapshot;
    if (mode === 'pure_color') finalImage = pureColorSnapshot;
    if (mode === 'original') finalImage = croppedSnapshot;
    
    // Always pass the bwSnapshot as the second argument for OCR, since Tesseract needs high-contrast B&W
    if (finalImage) onComplete(finalImage, bwSnapshot || finalImage);
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column', color: 'white' }}>
      {/* Header */}
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <button onClick={onClose} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>✕ סגור</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>סורק מסמכים</span>
          </h2>
        </div>
        
        <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {step === 'scanning' && stream && (
            <button onClick={toggleTorch} style={{ background: 'transparent', color: torchOn ? '#FFD700' : 'white', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
              🔦
            </button>
          )}
          {!cvLoaded && step === 'scanning' && <span style={{fontSize: '0.8rem', color: '#ccc'}}>טוען מנוע...</span>}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        {cameraError && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', background: 'red', color: 'white', padding: '10px', borderRadius: '8px', zIndex: 100 }}>
            {cameraError}
          </div>
        )}

        {step === 'scanning' && (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
            {/* Dark Overlay with Transparent Center for Document Alignment */}
            <div 
              ref={guideRef}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(95%, 75vh)', 
                aspectRatio: '1 / 1.414',
                border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '12px',
                boxShadow: '0 0 0 4000px rgba(0,0,0,0.85)', pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
              }}>
               <div style={{ background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '20px', color: 'white', position: 'absolute', top: '50%', transform: 'translateY(-50%)', textAlign: 'center', zIndex: 10 }}>
                 הכנס את המסמך למסגרת
               </div>
               
               {/* Green Scanning Line */}
               <div style={{
                 position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                 background: '#00FF00', boxShadow: '0 0 10px #00FF00',
                 animation: 'scanLine 2.5s infinite linear', opacity: 0.7
               }} />
               <style>
                 {`
                   @keyframes scanLine {
                     0% { top: 0%; opacity: 0; }
                     10% { opacity: 0.7; }
                     90% { opacity: 0.7; }
                     100% { top: 100%; opacity: 0; }
                   }
                 `}
               </style>
               
               <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '4px solid #FFD700', borderLeft: '4px solid #FFD700' }} />
               <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '4px solid #FFD700', borderRight: '4px solid #FFD700' }} />
               <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #FFD700', borderLeft: '4px solid #FFD700' }} />
               <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #FFD700', borderRight: '4px solid #FFD700' }} />
            </div>
          </>
        )}

        {step === 'cropping' && rawSnapshot && (
          <ManualCropper 
            imageUrl={rawSnapshot} 
            initialPoints={cropPoints} 
            onChange={setCropPoints} 
          />
        )}

        {step === 'review' && (
           <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
             <TransformComponent wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden' }} contentStyle={{ width: '100%', height: '100%' }}>
               <img 
                 src={mode === 'original' ? (croppedSnapshot || '') : mode === 'bw' ? (bwSnapshot || '') : mode === 'pure_color' ? (pureColorSnapshot || '') : (colorSnapshot || '')} 
                 style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                 alt="Scanned document" 
               />
             </TransformComponent>
           </TransformWrapper>
        )}
      </div>

      {/* Footer Controls */}
      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 1000 }}>
        
        {step === 'scanning' && (
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
             
             {/* Zoom Buttons */}
             <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '24px' }}>
               <button 
                 onClick={() => setZoom(1.0)} 
                 style={{ background: zoom === 1.0 ? 'white' : 'transparent', color: zoom === 1.0 ? 'black' : 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                 1x
               </button>
               <button 
                 onClick={() => setZoom(2.0)} 
                 style={{ background: zoom === 2.0 ? 'white' : 'transparent', color: zoom === 2.0 ? 'black' : 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                 2x
               </button>
             </div>

             <button onClick={handleCapture} style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'white', border: '4px solid #ccc', cursor: 'pointer' }} />
           </div>
        )}

        {step === 'cropping' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={handleRetake} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              צלם שוב
            </button>
            <button onClick={handleCropComplete} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              חתוך ✂️
            </button>
          </div>
        )}

        {step === 'review' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setMode('original')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: mode === 'original' ? '#fff' : 'transparent', color: mode === 'original' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.9rem', cursor: 'pointer' }}>
                  מקור
                </button>
                <button 
                onClick={() => setMode('pure_color')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: mode === 'pure_color' ? '#fff' : 'transparent', color: mode === 'pure_color' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.9rem', cursor: 'pointer' }}>
                  צבע טהור
                </button>
                <button 
                onClick={() => setMode('color')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: mode === 'color' ? '#fff' : 'transparent', color: mode === 'color' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.9rem', cursor: 'pointer' }}>
                  צבע רגיל
                </button>
                <button 
                onClick={() => setMode('bw')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.9rem', cursor: 'pointer' }}>
                  שחור-לבן
                </button>
            </div>
            
            {(mode === 'color' || mode === 'pure_color') && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => { setProfile('text'); performCrop(rawSnapshot!, cropPoints, undefined, 'text'); }} 
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '16px', border: '1px solid #aaa', background: profile === 'text' ? '#444' : 'transparent', color: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>
                    📝 טקסט
                  </button>
                  <button 
                    onClick={() => { setProfile('photo'); performCrop(rawSnapshot!, cropPoints, undefined, 'photo'); }} 
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '16px', border: '1px solid #aaa', background: profile === 'photo' ? '#444' : 'transparent', color: 'white', fontSize: '0.8rem', cursor: 'pointer' }}>
                    🖼️ צילום
                  </button>
                  <button 
                    onClick={() => setShowDevTools(!showDevTools)} 
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '16px', border: '1px solid #FFD700', background: showDevTools ? '#FFD700' : 'transparent', color: showDevTools ? 'black' : '#FFD700', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>
                    ⚙️
                  </button>
                </div>
                
                {showDevTools && (
                  <div style={{ background: 'rgba(50,50,50,0.9)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>Gamma (Darkens text) ({devOptions.gamma})</label>
                      <input type="range" min="0.5" max="3.5" step="0.1" value={devOptions.gamma} onChange={e => setDevOptions({...devOptions, gamma: parseFloat(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>Erode (Thickens text) ({devOptions.erodeWeight})</label>
                      <input type="range" min="0" max="1.0" step="0.1" value={devOptions.erodeWeight} onChange={e => setDevOptions({...devOptions, erodeWeight: parseFloat(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>Saturation (Colors pop) ({devOptions.saturationBoost})</label>
                      <input type="range" min="1.0" max="3.0" step="0.1" value={devOptions.saturationBoost} onChange={e => setDevOptions({...devOptions, saturationBoost: parseFloat(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>Shadow Radius (px) ({devOptions.bgBlurSize})</label>
                      <input type="range" min="3" max="51" step="2" value={devOptions.bgBlurSize} onChange={e => setDevOptions({...devOptions, bgBlurSize: parseFloat(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label>White Clip ({devOptions.whiteClip})</label>
                      <input type="range" min="150" max="255" step="1" value={devOptions.whiteClip} onChange={e => setDevOptions({...devOptions, whiteClip: parseFloat(e.target.value)})} />
                    </div>
                    <button onClick={handleApplyDevOptions} style={{ background: '#FFD700', color: 'black', border: 'none', padding: '0.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}>
                      החל שינויים
                    </button>
                  </div>
                )}
              </>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button onClick={() => setStep('cropping')} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
                חזור לעריכה
              </button>
              <button onClick={handleDone} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                אשר וצרף ✔
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Custom 4-Point Cropper Component with Edge Dragging
// ----------------------------------------------------
function ManualCropper({ imageUrl, initialPoints, onChange }: { imageUrl: string, initialPoints: Point[], onChange: (pts: Point[]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [activeHandle, setActiveHandle] = useState<{type: 'corner' | 'edge', index: number} | null>(null);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [initialPointsAtDragStart, setInitialPointsAtDragStart] = useState<Point[] | null>(null);
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);
  const [naturalSize, setNaturalSize] = useState({w: 1, h: 1});

  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        setImgRect(imgRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleImgLoad = () => {
    if (imgRef.current) {
      setImgRect(imgRef.current.getBoundingClientRect());
      setNaturalSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
  const getRenderedDimensions = () => {
    if (!imgRect || naturalSize.w === 1) return null;
    const ratio = Math.min(imgRect.width / naturalSize.w, imgRect.height / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (imgRect.width - renderedWidth) / 2;
    const offsetY = (imgRect.height - renderedHeight) / 2;
    return { ratio, offsetX, offsetY };
  };

  // Convert natural image coordinates to screen coordinates
  const toScreen = (p: Point) => {
    const dims = getRenderedDimensions();
    if (!dims) return { x: 0, y: 0 };
    return {
      x: p.x * dims.ratio + dims.offsetX,
      y: p.y * dims.ratio + dims.offsetY
    };
  };

  // Convert screen coordinates to natural image coordinates
  const toNatural = (clientX: number, clientY: number) => {
    const dims = getRenderedDimensions();
    if (!dims || !imgRect) return { x: 0, y: 0 };
    
    // Position relative to the actual rendered image area
    const relX = clientX - imgRect.left - dims.offsetX;
    const relY = clientY - imgRect.top - dims.offsetY;
    
    return {
      x: Math.max(0, Math.min(naturalSize.w, relX / dims.ratio)),
      y: Math.max(0, Math.min(naturalSize.h, relY / dims.ratio))
    };
  };

  const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    setActiveHandle({ type, index: idx });
    setDragStartPos(toNatural(e.clientX, e.clientY));
    setInitialPointsAtDragStart([...points]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !dragStartPos || !initialPointsAtDragStart) return;
    
    const currentNatural = toNatural(e.clientX, e.clientY);
    const dx = currentNatural.x - dragStartPos.x;
    const dy = currentNatural.y - dragStartPos.y;
    
    const newPoints = [...initialPointsAtDragStart];
    
    if (activeHandle.type === 'corner') {
      newPoints[activeHandle.index] = {
        x: Math.max(0, Math.min(naturalSize.w, newPoints[activeHandle.index].x + dx)),
        y: Math.max(0, Math.min(naturalSize.h, newPoints[activeHandle.index].y + dy))
      };
    } else if (activeHandle.type === 'edge') {
      const idx1 = activeHandle.index;
      const idx2 = (activeHandle.index + 1) % 4;
      newPoints[idx1] = {
        x: Math.max(0, Math.min(naturalSize.w, newPoints[idx1].x + dx)),
        y: Math.max(0, Math.min(naturalSize.h, newPoints[idx1].y + dy))
      };
      newPoints[idx2] = {
        x: Math.max(0, Math.min(naturalSize.w, newPoints[idx2].x + dx)),
        y: Math.max(0, Math.min(naturalSize.h, newPoints[idx2].y + dy))
      };
    }
    
    setPoints(newPoints);
    onChange(newPoints);
  };

  const handlePointerUp = () => {
    setActiveHandle(null);
    setDragStartPos(null);
    setInitialPointsAtDragStart(null);
  };

  // Compute edge midpoints
  const midpoints = points.map((p1, idx) => {
    const p2 = points[(idx + 1) % 4];
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  });

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img 
        ref={imgRef}
        src={imageUrl} 
        alt="Raw" 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onLoad={handleImgLoad}
        draggable={false}
      />
      
      {imgRect && (
        <svg 
          style={{ 
            position: 'absolute', 
            top: imgRect.top - (containerRef.current?.getBoundingClientRect().top || 0), 
            left: imgRect.left - (containerRef.current?.getBoundingClientRect().left || 0),
            width: imgRect.width, 
            height: imgRect.height,
            pointerEvents: 'none'
          }}
        >
          {/* Dim the outside */}
          <mask id="cutout">
            <rect width="100%" height="100%" fill="white" />
            <polygon 
              points={points.map(p => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')} 
              fill="black" 
            />
          </mask>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cutout)" />

          {/* Border */}
          <polygon 
            points={points.map(p => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')} 
            fill="none" 
            stroke="#FFD700" 
            strokeWidth="3" 
          />

          {/* Edge midpoints (drag edges) */}
          {midpoints.map((p, idx) => {
            const s = toScreen(p);
            const isActive = activeHandle?.type === 'edge' && activeHandle.index === idx;
            return (
              <g 
                key={`edge-${idx}`}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onPointerDown={(e) => handlePointerDown('edge', idx, e)}
              >
                <circle cx={s.x} cy={s.y} r="25" fill="transparent" />
                <rect x={s.x - 6} y={s.y - 6} width="12" height="12" fill="#FFD700" stroke="white" strokeWidth="2" rx="2" />
              </g>
            );
          })}

          {/* Draggable corners */}
          {points.map((p, idx) => {
            const s = toScreen(p);
            const isActive = activeHandle?.type === 'corner' && activeHandle.index === idx;
            return (
              <g 
                key={`corner-${idx}`}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onPointerDown={(e) => handlePointerDown('corner', idx, e)}
              >
                {/* Invisible larger touch target */}
                <circle cx={s.x} cy={s.y} r="30" fill="transparent" />
                {/* Visible handle */}
                <circle cx={s.x} cy={s.y} r={isActive ? "12" : "8"} fill="#FFD700" stroke="white" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      )}
      
      <div style={{ position: 'absolute', top: '10px', left: 0, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem' }}>
          גרור את הפינות כדי לעטוף את החשבונית
        </span>
      </div>
    </div>
  );
}
