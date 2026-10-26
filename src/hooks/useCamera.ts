import { useState, useEffect, useRef, RefObject, useCallback } from 'react';
import { LensQualityAnalyzer, LensQualityMetrics } from '../utils/lensQualityAnalyzer';

export interface CameraLens {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  maxResolutionScore: number; // estimated quality score based on width/height capabilities
  isRecommended: boolean;
}

export type FlashMode = 'auto' | 'on' | 'off';

export function useCamera(videoRef: RefObject<HTMLVideoElement>, isScanning: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [lenses, setLenses] = useState<CameraLens[]>([]);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);
  
  // Flash management: 'auto' | 'on' | 'off'
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [isTorchPhysicallyOn, setIsTorchPhysicallyOn] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [error, setError] = useState('');

  // Real-time quality & ambient light metrics
  const [qualityMetrics, setQualityMetrics] = useState<LensQualityMetrics>({
    luminance: 128,
    isLowLight: false,
    sharpness: 100,
    isMotionDetected: false,
    isSmudgedOrBlurry: false
  });

  const qualityAnalyzerRef = useRef<LensQualityAnalyzer | null>(null);
  if (!qualityAnalyzerRef.current) {
    qualityAnalyzerRef.current = new LensQualityAnalyzer();
  }

  // Load saved zoom & flashMode on mount
  useEffect(() => {
    try {
      const savedZoom = localStorage.getItem('myspace_scanner_zoom');
      if (savedZoom) setZoom(parseFloat(savedZoom));
      const savedFlash = localStorage.getItem('myspace_scanner_flash_mode') as FlashMode;
      if (savedFlash) setFlashMode(savedFlash);
    } catch(e) {}
  }, []);

  // Save zoom when changed and attempt native hardware zoom
  useEffect(() => {
    try { localStorage.setItem('myspace_scanner_zoom', zoom.toString()); } catch(e) {}
    
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

  // Bind stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.onloadedmetadata = () => {
        video.play().catch(e => console.warn("Video play on loadedmetadata failed:", e));
      };
      video.play().catch(e => console.warn("Direct video play failed:", e));
    }
  }, [stream, videoRef]);

  // Apply torch constraints safely
  const applyHardwareTorch = useCallback(async (enable: boolean, currentStream?: MediaStream | null) => {
    const targetStream = currentStream || stream;
    if (!targetStream) return;
    const track = targetStream.getVideoTracks()[0];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: enable } as any]
      });
      setIsTorchPhysicallyOn(enable);
    } catch (err) {
      try {
        await track.applyConstraints({
          advanced: [{ fillLightMode: enable ? 'flash' : 'off' } as any]
        });
        setIsTorchPhysicallyOn(enable);
      } catch (fallbackErr) {
        console.warn("Torch hardware constraint failed on this lens", fallbackErr);
        setIsTorchPhysicallyOn(false);
      }
    }
  }, [stream]);

  // Discover all lenses and pick the best one by default
  const discoverLenses = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      // Separate environment (back) cameras if identifiable
      const detectedLenses: CameraLens[] = videoInputs.map((d, idx) => {
        const label = d.label || `מצלמה ${idx + 1}`;
        const isBack = /back|rear|environment|macro|telephoto|ultra/i.test(label) || (!/front|user|selfie/i.test(label));
        // Simple heuristic: main / wide rear cameras tend to have higher index or '0'
        return {
          deviceId: d.deviceId,
          label: label,
          kind: d.kind,
          maxResolutionScore: isBack ? 1000 - idx : 100 - idx,
          isRecommended: false
        };
      });

      // Mark the highest score as recommended
      if (detectedLenses.length > 0) {
        detectedLenses[0].isRecommended = true;
      }
      setLenses(detectedLenses);
      return detectedLenses;
    } catch (e) {
      console.warn("Could not discover lenses:", e);
      return [];
    }
  }, []);

  // Start Camera with selected or best lens
  useEffect(() => {
    let isCancelled = false;

    async function startCamera() {
      try {
        let availableLenses = lenses;
        if (availableLenses.length === 0) {
          availableLenses = await discoverLenses();
        }

        const targetDeviceId = activeLensId || (availableLenses.length > 0 ? availableLenses[0].deviceId : undefined);

        let mediaStream: MediaStream | null = null;
        try {
          const videoConstraints: MediaTrackConstraints = targetDeviceId ? {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 4000 },
            height: { ideal: 4000 }
          } : {
            facingMode: 'environment',
            width: { ideal: 4000 },
            height: { ideal: 4000 }
          };

          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
          });
        } catch (strictErr) {
          console.warn("High-res constraints failed, falling back to standard video:", strictErr);
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: 'environment' }
          });
        }

        if (isCancelled) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        setStream(mediaStream);
        activeStreamRef.current = mediaStream;
        setError('');

        // Re-evaluate lenses once permission is granted (labels are now readable!)
        if (mediaStream) {
          discoverLenses();
        }

        // Apply initial flash state
        if (flashMode === 'on') {
          applyHardwareTorch(true, mediaStream);
        } else {
          applyHardwareTorch(false, mediaStream);
        }
      } catch (err) {
        if (!isCancelled) {
          setError('לא ניתן לגשת למצלמה. אנא אשר הרשאות בדפדפן.');
          console.error("Camera access error:", err);
        }
      }
    }

    if (isScanning) {
      startCamera();
    } else {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
      setStream(null);
      setIsTorchPhysicallyOn(false);
      qualityAnalyzerRef.current?.reset();
    }

    return () => {
      isCancelled = true;
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }
    };
  }, [isScanning, activeLensId, discoverLenses, applyHardwareTorch]);

  // Periodic lightweight quality & ambient lighting sensor loop (runs every ~600ms)
  useEffect(() => {
    if (!isScanning || !stream) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && qualityAnalyzerRef.current) {
        const metrics = qualityAnalyzerRef.current.analyzeFrame(video);
        setQualityMetrics(metrics);

        // Auto-Flash management
        if (flashMode === 'auto') {
          if (metrics.isLowLight && !isTorchPhysicallyOn) {
            applyHardwareTorch(true);
          } else if (!metrics.isLowLight && metrics.luminance > 60 && isTorchPhysicallyOn) {
            applyHardwareTorch(false);
          }
        }
      }
    }, 600);

    return () => clearInterval(interval);
  }, [isScanning, stream, flashMode, isTorchPhysicallyOn, videoRef, applyHardwareTorch]);

  // Manual Flash Mode change
  const handleSetFlashMode = (mode: FlashMode) => {
    setFlashMode(mode);
    try { localStorage.setItem('myspace_scanner_flash_mode', mode); } catch(e) {}

    if (mode === 'on') {
      applyHardwareTorch(true);
    } else if (mode === 'off') {
      applyHardwareTorch(false);
    } else if (mode === 'auto') {
      if (qualityMetrics.isLowLight) {
        applyHardwareTorch(true);
      } else {
        applyHardwareTorch(false);
      }
    }
  };

  // Cycle to next lens
  const cycleCamera = () => {
    if (lenses.length > 1) {
      const currentIdx = lenses.findIndex(l => l.deviceId === activeLensId);
      const nextIdx = (currentIdx + 1) % lenses.length;
      setActiveLensId(lenses[nextIdx].deviceId);
    } else {
      alert('לא נמצאו עדשות נוספות במכשיר זה.');
    }
  };

  const selectLens = (deviceId: string) => {
    setActiveLensId(deviceId);
  };

  const stopCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setIsTorchPhysicallyOn(false);
  };

  return {
    stream,
    torchOn: isTorchPhysicallyOn,
    flashMode,
    setFlashMode: handleSetFlashMode,
    lenses,
    activeLensId,
    selectLens,
    qualityMetrics,
    zoom,
    setZoom,
    error,
    cycleCamera,
    stopCamera
  };
}

