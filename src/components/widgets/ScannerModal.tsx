'use client';

import { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface ScannerModalProps {
  onClose: () => void;
  onComplete: (imageDataUrl: string) => void;
}

export default function ScannerModal({ onClose, onComplete }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  
  // Ref to store the latest stable contour points in video scale
  const lastContourRef = useRef<Point[] | null>(null);
  const missedFramesRef = useRef<number>(0);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [step, setStep] = useState<'scanning' | 'cropping' | 'review'>('scanning');
  
  const [rawSnapshot, setRawSnapshot] = useState<string | null>(null);
  
  // Points for the manual 4-point cropper (in intrinsic image pixel coordinates)
  const [cropPoints, setCropPoints] = useState<Point[]>([]);
  
  const [croppedSnapshot, setCroppedSnapshot] = useState<string | null>(null);
  const [bwSnapshot, setBwSnapshot] = useState<string | null>(null);
  const [mode, setMode] = useState<'bw' | 'color'>('bw');
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  
  // Load saved zoom on mount
  useEffect(() => {
    const savedZoom = localStorage.getItem('myspace_scanner_zoom');
    if (savedZoom) {
      setZoom(parseFloat(savedZoom));
    }
  }, []);

  // Save zoom when changed and attempt native hardware zoom
  useEffect(() => {
    localStorage.setItem('myspace_scanner_zoom', zoom.toString());
    
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        // @ts-ignore
        if (capabilities.zoom) {
          try {
            // @ts-ignore
            track.applyConstraints({ advanced: [{ zoom }] });
          } catch (e) {
            console.warn("Native zoom failed", e);
          }
        }
      }
    }
  }, [zoom, stream]);
  
  const [error, setError] = useState('');

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

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState<number>(0);

  // 2. Start Camera
  useEffect(() => {
    let animationFrameId: number;

    async function startCamera() {
      try {
        let devices = videoDevices;
        if (devices.length === 0) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          devices = allDevices.filter(d => d.kind === 'videoinput');
          setVideoDevices(devices);
        }
        
        let constraints: MediaStreamConstraints = {
          video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1920 } }
        };

        if (devices.length > 0 && currentDeviceIndex < devices.length) {
          const deviceId = devices[currentDeviceIndex].deviceId;
          if (deviceId) {
            constraints = {
              video: { deviceId: { exact: deviceId }, width: { ideal: 1080 }, height: { ideal: 1920 } }
            };
          }
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError('לא ניתן לגשת למצלמה. אנא אשר הרשאות בדפדפן.');
        console.error(err);
      }
    }
    
    if (step === 'scanning') {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentDeviceIndex]);

  const cycleCamera = () => {
    if (videoDevices.length > 1) {
      setCurrentDeviceIndex((prev) => (prev + 1) % videoDevices.length);
    } else {
      alert('לא נמצאו מצלמות נוספות במכשיר זה.');
    }
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;
    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn } as any]
        });
        setTorchOn(!torchOn);
      } catch (err) {
        console.error("Torch failed", err);
      }
    } else {
      alert("פנס לא נתמך במכשיר זה.");
    }
  };

  // 3. (Removed Live Edge Detection for a cleaner static guide UX)
  
  // 4. Capture Full Res Snapshot -> Move to Manual Cropping
  const handleCapture = () => {
    if (!videoRef.current || !guideRef.current) return;
    const video = videoRef.current;
    
    const w = video.videoWidth;
    const h = video.videoHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Fill with black background in case video is scaled out
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Apply the same scale the user sees to the captured image!
    // If zoom < 1.0, the image is smaller and centered.
    // If zoom > 1.0, the image is larger and cropped.
    const scaledW = w * zoom;
    const scaledH = h * zoom;
    const offsetX = (w - scaledW) / 2;
    const offsetY = (h - scaledH) / 2;

    ctx.drawImage(video, offsetX, offsetY, scaledW, scaledH);
    
    // Map guide DOM Rect to object-fit: contain intrinsic video coordinates
    const guideBox = guideRef.current.getBoundingClientRect();
    const videoBox = video.getBoundingClientRect();
    
    // We assume object-fit: cover.
    // Find the intrinsic video rect inside the videoBox
    const videoRatio = w / h;
    const boxRatio = videoBox.width / videoBox.height;
    
    let renderedW = videoBox.width;
    let renderedH = videoBox.height;
    let renderedLeft = videoBox.left;
    let renderedTop = videoBox.top;

    if (videoRatio > boxRatio) {
      // cover: video is wider than container, height matches, width overflows
      renderedH = videoBox.height;
      renderedW = videoBox.height * videoRatio;
      renderedLeft = videoBox.left + (videoBox.width - renderedW) / 2;
      renderedTop = videoBox.top;
    } else {
      // cover: video is taller than container, width matches, height overflows
      renderedW = videoBox.width;
      renderedH = videoBox.width / videoRatio;
      renderedLeft = videoBox.left;
      renderedTop = videoBox.top + (videoBox.height - renderedH) / 2;
    }

    const intrinsicScaleX = w / renderedW;
    const intrinsicScaleY = h / renderedH;

    // Convert guide bounds relative to the rendered video area
    const gLeft = (guideBox.left - renderedLeft) * intrinsicScaleX;
    const gTop = (guideBox.top - renderedTop) * intrinsicScaleY;
    const gRight = (guideBox.right - renderedLeft) * intrinsicScaleX;
    const gBottom = (guideBox.bottom - renderedTop) * intrinsicScaleY;

    let defaultPts = [
      { x: gLeft, y: gTop },
      { x: gRight, y: gTop },
      { x: gRight, y: gBottom },
      { x: gLeft, y: gBottom }
    ];
    
    // Try to auto-detect the document using the OpenCV algorithm from the Skill!
    try {
      const cv = (window as any).cv;
      if (cv && cv.Mat) {
        // Create scaled down temp canvas for performance
        const tempScale = 300 / w;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 300;
        tempCanvas.height = Math.round(h * tempScale);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx?.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        let src = cv.imread(tempCanvas);
        let gray = new cv.Mat();
        let blurred = new cv.Mat();
        let edged = new cv.Mat();
        
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // Apply CLAHE to improve contrast for edge detection in bad lighting
        let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(gray, gray);
        clahe.delete();
        
        let ksize = new cv.Size(5, 5);
        cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(blurred, edged, 75, 200, 3, false);
        
        let M = cv.Mat.ones(3, 3, cv.CV_8U);
        let closed = new cv.Mat();
        cv.morphologyEx(edged, closed, cv.MORPH_CLOSE, M);
        
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        
        let maxArea = 0;
        let bestContour = null;
        
        for (let i = 0; i < contours.size(); ++i) {
          let cnt = contours.get(i);
          let area = cv.contourArea(cnt);
          // Require between 10% and 90% of screen to avoid snapping to the whole room/wall
          if (area > src.rows * src.cols * 0.10 && area < src.rows * src.cols * 0.90) { 
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            // INCREASED to 0.05: This makes the algorithm much more forgiving of fingers holding the paper 
            // or curved/wrinkled edges, forcing it to approximate it into 4 corners.
            cv.approxPolyDP(cnt, approx, 0.05 * peri, true);
            if (approx.rows === 4 && area > maxArea) {
              maxArea = area;
              if (bestContour) bestContour.delete();
              bestContour = approx.clone();
            }
            approx.delete();
          }
        }
        
        if (bestContour) {
          let pts = [];
          for (let i = 0; i < 4; i++) {
            pts.push({
              x: bestContour.data32S[i * 2] / tempScale,
              y: bestContour.data32S[i * 2 + 1] / tempScale
            });
          }
          
          // Sort to TL, TR, BR, BL order
          pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
          const tl = pts[0];
          const br = pts[3];
          const remain = [pts[1], pts[2]].sort((a, b) => (b.x - b.y) - (a.x - a.y));
          const tr = remain[0];
          const bl = remain[1];
          
          defaultPts = [tl, tr, br, bl];
          bestContour.delete();
        }
        
        M.delete(); closed.delete(); contours.delete(); hierarchy.delete();
        gray.delete(); blurred.delete(); edged.delete(); src.delete();
      }
    } catch (err) {
      console.warn("Auto-detect failed, using static guide fallback", err);
    }
    
    setCropPoints(defaultPts);
    
    const snapshotUrl = canvas.toDataURL('image/jpeg', 0.9);
    setRawSnapshot(snapshotUrl);
    
    if (stream) stream.getTracks().forEach(t => t.stop());
    
    // Show cropping screen for user verification
    setStep('cropping');
  };

  // 5. Apply Perspective Crop
  const performCrop = (snapshot: string, pts: Point[]) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = snapshot;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject();
        ctx.drawImage(img, 0, 0);

        try {
          const cv = (window as any).cv;
          let src = cv.imread(canvas);
          
          const widthA = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
          const widthB = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const maxWidth = Math.round(Math.max(widthA, widthB));

          const heightA = Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y);
          const heightB = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
          const maxHeight = Math.round(Math.max(heightA, heightB));
          
          let dst = new cv.Mat();
          let dsize = new cv.Size(maxWidth, maxHeight);
          
          let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            pts[0].x, pts[0].y,
            pts[1].x, pts[1].y,
            pts[2].x, pts[2].y,
            pts[3].x, pts[3].y
          ]);
          
          let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            maxWidth, 0,
            maxWidth, maxHeight,
            0, maxHeight
          ]);
          
          let M = cv.getPerspectiveTransform(srcTri, dstTri);
          cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
          
          // Render back to canvas
          cv.imshow(canvas, dst);
          const croppedUrl = canvas.toDataURL('image/jpeg', 0.9);
          setCroppedSnapshot(croppedUrl);

          // Run Industry-Standard Grayscale Document Enhancement
          let gray = new cv.Mat();
          cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
          
          // 1. Unsharp Mask (Sharpening to bring out faint text and darken it)
          let blurred = new cv.Mat();
          cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 2);
          let sharpened = new cv.Mat();
          cv.addWeighted(gray, 1.7, blurred, -0.7, 0, sharpened);
          
          let bw = new cv.Mat();
          // 2. Adaptive Threshold (Extracts text evenly across shadows)
          // Larger block size (41) and C (12) for a much cleaner paper background while retaining text.
          cv.adaptiveThreshold(sharpened, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 41, 12);
          
          // 3. Preserve solid black boxes (which adaptiveThreshold ruins)
          let darkMask = new cv.Mat();
          // CHANGED TO 50: This ensures only pure black printed ink is kept. 
          // Shadows and fingers (which are > 80) will no longer become black blobs!
          cv.threshold(gray, darkMask, 50, 255, cv.THRESH_BINARY_INV); 
          
          let blackMat = new cv.Mat(bw.rows, bw.cols, bw.type(), new cv.Scalar(0));
          blackMat.copyTo(bw, darkMask); // Overwrite bw with black where darkMask is true
          
          let bwRgba = new cv.Mat();
          cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
          cv.imshow(canvas, bwRgba);
          
          setBwSnapshot(canvas.toDataURL('image/jpeg', 0.9));
          
          // Cleanup all Mats safely
          src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
          gray.delete(); blurred.delete(); sharpened.delete(); bw.delete(); 
          darkMask.delete(); blackMat.delete(); bwRgba.delete();
          
          resolve();

        } catch (err) {
          console.error("OpenCV Crop/Binarize Failed", err);
          reject(err);
        }
      };
    });
  };

  const handleCropComplete = async () => {
    if (!rawSnapshot || cropPoints.length !== 4) return;
    await performCrop(rawSnapshot, cropPoints);
    setStep('review');
  };

  const handleRetake = () => {
    setStep('scanning');
    setRawSnapshot(null);
    setCroppedSnapshot(null);
    setBwSnapshot(null);
  };

  const handleDone = () => {
    const finalImage = mode === 'color' ? croppedSnapshot : bwSnapshot;
    if (finalImage) onComplete(finalImage);
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
          {step === 'scanning' && videoDevices.length > 1 && (
            <button onClick={cycleCamera} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }} title="החלף מצלמה">
              🔄
            </button>
          )}
          {step === 'scanning' && stream && (
            <button onClick={toggleTorch} style={{ background: 'transparent', color: torchOn ? '#FFD700' : 'white', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
              🔦
            </button>
          )}
          {!cvLoaded && step === 'scanning' && <span style={{fontSize: '0.8rem', color: '#ccc'}}>טוען מנוע...</span>}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {step === 'scanning' && (
          <>
              <video 
              ref={videoRef}
              autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }}
            />
            
            {/* Static Guide Overlay with Scanning Animation */}
            <div 
              ref={guideRef}
              style={{
                position: 'absolute', top: '50%', left: '50%', 
                transform: 'translate(-50%, -50%)',
                width: 'min(90%, 60vh)', 
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
               
               {/* Corner Markers inside the guide */}
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
           <img src={mode === 'bw' ? (bwSnapshot || '') : (croppedSnapshot || '')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Scanned document" />
        )}
      </div>

      {/* Footer Controls */}
      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 1000 }}>
        
        {step === 'scanning' && (
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
             
             {/* Zoom Slider */}
             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '300px', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '24px' }}>
               <span style={{ fontSize: '1.2rem' }}>-</span>
               <input 
                 type="range" min="0.1" max="3" step="0.1" value={zoom} 
                 onChange={(e) => setZoom(parseFloat(e.target.value))} 
                 style={{ flex: 1, accentColor: '#FFD700' }} 
               />
               <span style={{ fontSize: '1.2rem' }}>+</span>
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setMode('color')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid white', background: mode === 'color' ? 'white' : 'transparent', color: mode === 'color' ? 'black' : 'white', cursor: 'pointer' }}>
                תמונה מקורית
              </button>
              <button 
                onClick={() => setMode('bw')} 
                style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid white', background: mode === 'bw' ? 'white' : 'transparent', color: mode === 'bw' ? 'black' : 'white', cursor: 'pointer' }}>
                ניקוי לשחור-לבן
              </button>
            </div>
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
