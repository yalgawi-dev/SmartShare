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
  const [activeLensInfo, setActiveLensInfo] = useState<{ label: string; width?: number; height?: number } | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(true);
  
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

  // Apply torch constraints safely with capabilities inspection
  const applyHardwareTorch = useCallback(async (enable: boolean, currentStream?: MediaStream | null) => {
    const targetStream = currentStream || stream;
    if (!targetStream) return;
    const track = targetStream.getVideoTracks()[0];
    if (!track) return;

    if (track.getCapabilities) {
      const caps = track.getCapabilities() as any;
      if (caps && caps.torch === false) {
        setTorchSupported(false);
        setIsTorchPhysicallyOn(false);
        return;
      }
    }

    try {
      await track.applyConstraints({
        advanced: [{ torch: enable } as any]
      });
      setIsTorchPhysicallyOn(enable);
      setTorchSupported(true);
    } catch (err) {
      try {
        await track.applyConstraints({
          advanced: [{ fillLightMode: enable ? 'flash' : 'off' } as any]
        });
        setIsTorchPhysicallyOn(enable);
        setTorchSupported(true);
      } catch (fallbackErr) {
        console.warn("Torch hardware constraint failed on this lens", fallbackErr);
        setIsTorchPhysicallyOn(false);
        setTorchSupported(false);
      }
    }
  }, [stream]);

  // Discover all lenses and pick the best one by default
  const discoverLenses = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      const backLenses: CameraLens[] = [];
      const otherLenses: CameraLens[] = [];

      videoInputs.forEach((d, idx) => {
        const label = (d.label || '').toLowerCase();
        const isFront = label.includes('front') || label.includes('user') || label.includes('selfie') || label.includes('forward') || label.includes('face');
        const isExplicitBack = label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('main') || label.includes('wide') || label.includes('ultra');

        const lensItem: CameraLens = {
          deviceId: d.deviceId,
          label: d.label || `עדשה ${idx + 1}`,
          kind: d.kind,
          maxResolutionScore: isExplicitBack ? 1000 - idx : 100 - idx,
          isRecommended: false
        };

        if (isExplicitBack) {
          backLenses.push(lensItem);
        } else if (!isFront) {
          otherLenses.push(lensItem);
        }
      });

      const validLenses = backLenses.length > 0 ? backLenses : (otherLenses.length > 0 ? otherLenses : []);
      if (validLenses.length > 0) {
        validLenses[0].isRecommended = true;
      }
      setLenses(validLenses);
      return validLenses;
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
        let mediaStream: MediaStream | null = null;
        
        // Stop any currently running stream first so hardware sensor is released on Android
        if (activeStreamRef.current) {
          activeStreamRef.current.getTracks().forEach(t => t.stop());
          activeStreamRef.current = null;
        }

        // 1. If user selected a specific lens, try it first with EXACT hardware constraint
        if (activeLensId) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: activeLensId },
                width: { ideal: 3840 },
                height: { ideal: 2160 }
              }
            });
          } catch (lensErr) {
            console.warn("Exact lens constraint failed, falling back to direct deviceId", lensErr);
            try {
              mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: activeLensId,
                  width: { ideal: 3840 },
                  height: { ideal: 2160 }
                }
              });
            } catch (fallbackErr) {
              console.warn("Direct deviceId failed, will fall back to environment camera", fallbackErr);
            }
          }
        }

        // 2. Default camera startup: always start with environment camera (never block permissions)
        if (!mediaStream) {
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
                width: { ideal: 3840 },
                height: { ideal: 2160 }
              }
            });
          } catch (highResErr) {
            console.warn("High-res environment camera failed, falling back to standard video", highResErr);
            mediaStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' }
            });
          }
        }

        if (isCancelled) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        setStream(mediaStream);
        activeStreamRef.current = mediaStream;
        setError('');

        // Discover and populate lenses now that camera permission is actively granted
        if (navigator.mediaDevices?.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');

            // Find current active track deviceId
            const activeTrack = mediaStream.getVideoTracks()[0];
            const activeTrackSettings = activeTrack?.getSettings ? activeTrack.getSettings() : {};
            const currentDeviceId = activeTrackSettings.deviceId;

            // STRICT FILTER: Only back / rear / environment cameras! Never include front/selfie cameras in the document scanner.
            const backLenses: CameraLens[] = [];
            const otherLenses: CameraLens[] = [];

            videoInputs.forEach((d, idx) => {
              const label = (d.label || '').toLowerCase();
              const isFront = label.includes('front') || label.includes('user') || label.includes('selfie') || label.includes('forward') || label.includes('face');
              const isExplicitBack = label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('main') || label.includes('wide') || label.includes('ultra');

              const lensItem: CameraLens = {
                deviceId: d.deviceId,
                label: d.label || `עדשה ${idx + 1}`,
                kind: d.kind,
                maxResolutionScore: isExplicitBack ? 1000 - idx : 100 - idx,
                isRecommended: false
              };

              if (isExplicitBack) {
                backLenses.push(lensItem);
              } else if (!isFront) {
                otherLenses.push(lensItem);
              }
            });

            // If we found explicit back lenses, use ONLY them. Otherwise use devices that aren't marked as front.
            const validLenses = backLenses.length > 0 ? backLenses : (otherLenses.length > 0 ? otherLenses : []);

            if (validLenses.length > 0) {
              validLenses[0].isRecommended = true;
              setLenses(validLenses);
              // Ensure we are active on a valid back lens
              if (!activeLensId || !validLenses.some(l => l.deviceId === activeLensId)) {
                setActiveLensId(validLenses[0].deviceId);
              }
            }

            // Capture active track information for dev/quality verification
            const matchedLens = validLenses.find(l => l.deviceId === currentDeviceId) ||
                                (activeLensId ? validLenses.find(l => l.deviceId === activeLensId) : null);
            const fallbackLabel = activeTrack.label ? activeTrack.label : (activeLensId ? `מצלמה ${validLenses.findIndex(l => l.deviceId === activeLensId) + 1}` : 'מצלמה אחורית ראשית');
            setActiveLensInfo({
              label: matchedLens?.label || fallbackLabel,
              width: activeTrackSettings.width,
              height: activeTrackSettings.height
            });
          } catch (enumErr) {
            console.warn("Device enumeration after stream start failed", enumErr);
          }
        }

        // Apply initial flash state with a slight timeout to ensure hardware track is ready
        setTimeout(() => {
          if (flashMode === 'on') {
            applyHardwareTorch(true, mediaStream);
          } else {
            applyHardwareTorch(false, mediaStream);
          }
        }, 200);
      } catch (err) {
        if (!isCancelled) {
          setError('לא ניתן לגשת למצלמה. אנא ודא שהמצלמה אינה בשימוש באפליקציה אחרת ואשר הרשאות.');
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
  }, [isScanning, activeLensId]);

  // Periodic lightweight quality & ambient lighting sensor loop (runs every ~600ms)
  useEffect(() => {
    if (!isScanning || !stream) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && qualityAnalyzerRef.current) {
        const metrics = qualityAnalyzerRef.current.analyzeFrame(video);
        setQualityMetrics(metrics);

        // Auto-Flash management: in auto mode, the torch stays OFF during preview so it doesn't glare/blind,
        // and is fired as an exact synchronized strobe pulse only when capturing in low light!
        if (flashMode === 'auto') {
          if (isTorchPhysicallyOn) {
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
    } else {
      // For both 'off' and 'auto', torch is off during preview
      applyHardwareTorch(false);
    }
  };

  // Trigger focused strobe pulse during capture if needed (auto in low light, or forced 'on')
  const triggerFlashPulse = useCallback(async (): Promise<() => void> => {
    const shouldFlash = (flashMode === 'auto' && qualityMetrics.isLowLight) || flashMode === 'on';
    if (!shouldFlash) {
      return () => {};
    }

    try {
      await applyHardwareTorch(true);
      // Wait ~160ms for sensor AE (auto-exposure) convergence under the flash light
      await new Promise(res => setTimeout(res, 160));
    } catch (e) {
      console.warn("Flash pulse failed", e);
    }

    // Return cleanup callback to turn flash off after capture
    return () => {
      if (flashMode !== 'on') {
        applyHardwareTorch(false).catch(() => {});
      }
    };
  }, [flashMode, qualityMetrics.isLowLight, applyHardwareTorch]);

  const resetSmudgeAlert = useCallback(() => {
    if (qualityAnalyzerRef.current) {
      qualityAnalyzerRef.current.reset();
    }
    setQualityMetrics(prev => ({ ...prev, isSmudgedOrBlurry: false }));
  }, []);

  // Cycle to next lens
  const cycleCamera = () => {
    resetSmudgeAlert();
    if (lenses.length > 1) {
      const currentIdx = lenses.findIndex(l => l.deviceId === activeLensId);
      const nextIdx = (currentIdx + 1) % lenses.length;
      setActiveLensId(lenses[nextIdx].deviceId);
    } else {
      alert('לא נמצאו עדשות נוספות במכשיר זה.');
    }
  };

  const selectLens = (deviceId: string) => {
    resetSmudgeAlert();
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
    resetSmudgeAlert,
    activeLensInfo,
    torchSupported,
    zoom,
    setZoom,
    error,
    cycleCamera,
    stopCamera,
    triggerFlashPulse
  };
}

