'use client';

import { useEffect, useRef, useState } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

interface ScannerModalProps {
  onClose: () => void;
  onComplete: (imageDataUrl: string) => void;
}

export default function ScannerModal({ onClose, onComplete }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [step, setStep] = useState<'scanning' | 'cropping' | 'review'>('scanning');
  
  const [rawSnapshot, setRawSnapshot] = useState<string | null>(null);
  const [croppedSnapshot, setCroppedSnapshot] = useState<string | null>(null);
  const [bwSnapshot, setBwSnapshot] = useState<string | null>(null);
  const [mode, setMode] = useState<'bw' | 'color'>('bw');
  
  const cropperRef = useRef<HTMLImageElement>(null);
  
  const [error, setError] = useState('');

  // 1. Load OpenCV.js
  useEffect(() => {
    // @ts-ignore
    if (!window.cv) {
      const script = document.createElement('script');
      script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
      script.async = true;
      script.onload = () => {
        // @ts-ignore
        window.cv.onRuntimeInitialized = () => setCvLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setCvLoaded(true);
    }
  }, []);

  // 2. Start Camera
  useEffect(() => {
    let animationFrameId: number;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
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
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 3. Real-time Edge Detection Loop
  useEffect(() => {
    if (step !== 'scanning' || !cvLoaded || !videoRef.current || !overlayRef.current || !hiddenCanvasRef.current) return;
    
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const hidden = hiddenCanvasRef.current;
    
    let animationFrameId: number;
    let isProcessing = false;

    const processFrame = () => {
      if (video.videoWidth === 0 || isProcessing) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }
      
      isProcessing = true;
      
      try {
        // Match overlay size to video
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        
        // Use a smaller hidden canvas for performance
        const scale = 300 / video.videoWidth;
        hidden.width = 300;
        hidden.height = Math.round(video.videoHeight * scale);
        
        const hCtx = hidden.getContext('2d');
        hCtx?.drawImage(video, 0, 0, hidden.width, hidden.height);
        
        // @ts-ignore
        const cv = window.cv;
        let src = cv.imread(hidden);
        let gray = new cv.Mat();
        let blurred = new cv.Mat();
        let edged = new cv.Mat();
        
        // Grayscale, Blur, Canny
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        let ksize = new cv.Size(5, 5);
        cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
        cv.Canny(blurred, edged, 75, 200, 3, false);
        
        // Morphological Close
        let M = cv.Mat.ones(3, 3, cv.CV_8U);
        let closed = new cv.Mat();
        cv.morphologyEx(edged, closed, cv.MORPH_CLOSE, M);
        
        // Contours
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        
        let maxArea = 0;
        let bestContour = null;
        
        for (let i = 0; i < contours.size(); ++i) {
          let cnt = contours.get(i);
          let area = cv.contourArea(cnt);
          if (area > src.rows * src.cols * 0.15) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4 && area > maxArea) {
              maxArea = area;
              if (bestContour) bestContour.delete();
              bestContour = approx.clone();
            }
            approx.delete();
          }
        }
        
        const oCtx = overlay.getContext('2d');
        if (oCtx) {
          oCtx.clearRect(0, 0, overlay.width, overlay.height);
          if (bestContour) {
            oCtx.beginPath();
            oCtx.lineWidth = 4;
            oCtx.strokeStyle = 'yellow';
            oCtx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            
            for (let i = 0; i < 4; i++) {
              const x = bestContour.data32S[i * 2] / scale;
              const y = bestContour.data32S[i * 2 + 1] / scale;
              if (i === 0) oCtx.moveTo(x, y);
              else oCtx.lineTo(x, y);
            }
            oCtx.closePath();
            oCtx.stroke();
            oCtx.fill();
            
            bestContour.delete();
          }
        }
        
        M.delete(); closed.delete(); contours.delete(); hierarchy.delete();
        gray.delete(); blurred.delete(); edged.delete(); src.delete();
        
      } catch (err) {
        // Ignore cv errors on frame
      }
      
      isProcessing = false;
      animationFrameId = requestAnimationFrame(processFrame);
    };

    video.addEventListener('play', () => {
      animationFrameId = requestAnimationFrame(processFrame);
    });

    return () => cancelAnimationFrame(animationFrameId);
  }, [step, cvLoaded]);

  // 4. Capture Full Res Snapshot -> Move to Cropping
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setRawSnapshot(canvas.toDataURL('image/jpeg', 0.9));
    
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStep('cropping');
  };

  // 5. Apply Crop -> Move to Review (and Binarize)
  const handleCropComplete = () => {
    const imageElement: any = cropperRef?.current;
    const cropper = imageElement?.cropper;
    if (!cropper) return;
    
    const croppedCanvas = cropper.getCroppedCanvas();
    const croppedUrl = croppedCanvas.toDataURL('image/jpeg', 0.9);
    setCroppedSnapshot(croppedUrl);
    
    // Run Sauvola on cropped image
    const ctx = croppedCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
    const data = imgData.data;
    const w = croppedCanvas.width;
    const h = croppedCanvas.height;

    const gray = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }

    const intImg = new Uint32Array(w * h);
    const intSqImg = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let sqSum = 0;
      for (let x = 0; x < w; x++) {
        const val = gray[y * w + x];
        sum += val;
        sqSum += val * val;
        if (y === 0) {
          intImg[y * w + x] = sum;
          intSqImg[y * w + x] = sqSum;
        } else {
          intImg[y * w + x] = intImg[(y - 1) * w + x] + sum;
          intSqImg[y * w + x] = intSqImg[(y - 1) * w + x] + sqSum;
        }
      }
    }

    const S = Math.floor(w / 16); 
    const k = 0.12; 
    const R = 128; 

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const pix = gray[idx];
        
        const x1 = Math.max(0, x - Math.floor(S / 2));
        const x2 = Math.min(w - 1, x + Math.floor(S / 2));
        const y1 = Math.max(0, y - Math.floor(S / 2));
        const y2 = Math.min(h - 1, y + Math.floor(S / 2));
        
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        
        let sum = intImg[y2 * w + x2];
        if (x1 > 0) sum -= intImg[y2 * w + (x1 - 1)];
        if (y1 > 0) sum -= intImg[(y1 - 1) * w + x2];
        if (x1 > 0 && y1 > 0) sum += intImg[(y1 - 1) * w + (x1 - 1)];
        
        let sqSum = intSqImg[y2 * w + x2];
        if (x1 > 0) sqSum -= intSqImg[y2 * w + (x1 - 1)];
        if (y1 > 0) sqSum -= intSqImg[(y1 - 1) * w + x2];
        if (x1 > 0 && y1 > 0) sqSum += intSqImg[(y1 - 1) * w + (x1 - 1)];
        
        const mean = sum / count;
        const variance = (sqSum / count) - (mean * mean);
        const std = Math.sqrt(Math.max(0, variance));
        
        const threshold = mean * (1 + k * (std / R - 1));
        
        let val = 255;
        if (pix < threshold) val = 0; 
        if (pix < 130 && mean >= 140) val = 0;
        
        const dataIdx = idx * 4;
        data[dataIdx] = val;
        data[dataIdx+1] = val;
        data[dataIdx+2] = val;
        data[dataIdx+3] = 255;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    setBwSnapshot(croppedCanvas.toDataURL('image/jpeg', 0.9));
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
        <h3 style={{ margin: 0 }}>סורק חכם (Auto-Crop)</h3>
        <div style={{ width: '50px' }}>
          {!cvLoaded && step === 'scanning' && <span style={{fontSize: '0.8rem', color: '#ccc'}}>טוען מנוע...</span>}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {step === 'scanning' && (
          <>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
          </>
        )}

        {step === 'cropping' && rawSnapshot && (
          <div style={{ width: '100%', height: '100%' }}>
            <Cropper
              src={rawSnapshot}
              style={{ height: '100%', width: '100%' }}
              // Cropper options
              initialAspectRatio={NaN} // free crop
              guides={true}
              ref={cropperRef}
              background={false}
              viewMode={1} // Restrict crop box to not exceed the canvas
            />
          </div>
        )}

        {step === 'review' && (
           <img src={mode === 'bw' ? (bwSnapshot || '') : (croppedSnapshot || '')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Scanned document" />
        )}
      </div>

      {/* Footer Controls */}
      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {step === 'scanning' && (
           <div style={{ display: 'flex', justifyContent: 'center' }}>
             <button onClick={handleCapture} style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'white', border: '4px solid #ccc', cursor: 'pointer' }} />
           </div>
        )}

        {step === 'cropping' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={handleRetake} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              צלם שוב
            </button>
            <button onClick={handleCropComplete} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              המשך ✂️
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
                חזור לחיתוך
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
