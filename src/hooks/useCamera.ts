import { useState, useEffect, RefObject } from 'react';

export function useCamera(videoRef: RefObject<HTMLVideoElement>, isScanning: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState<number>(0);
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [error, setError] = useState('');

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

  // Start Camera
  useEffect(() => {
    async function startCamera() {
      try {
        let devices = videoDevices;
        if (devices.length === 0) {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          devices = allDevices.filter(d => d.kind === 'videoinput');
          setVideoDevices(devices);
        }
        
        let constraints: MediaStreamConstraints = {
          video: { facingMode: 'environment', width: { ideal: 4000 }, height: { ideal: 4000 } }
        };

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
    
    if (isScanning) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, currentDeviceIndex]);

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
    
    try {
      // Always try applying it first, regardless of what getCapabilities says.
      // Some browsers hide the capability but still apply it.
      await track.applyConstraints({
        advanced: [{ fillLightMode: torchOn ? 'off' : 'flash' }]
      }).catch(() => {}); // ignore error for fillLightMode
      
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.warn("Direct torch application failed, checking capabilities...", err);
      
      try {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if ((capabilities as any).torch) {
          await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
          setTorchOn(!torchOn);
        } else {
          alert("הפלאש כנראה לא נתמך בדפדפן או במכשיר הזה.");
        }
      } catch (innerErr) {
        alert("לא ניתן להפעיל פלאש במכשיר זה.");
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  return {
    stream,
    torchOn,
    zoom,
    setZoom,
    error,
    cycleCamera,
    toggleTorch,
    stopCamera
  };
}
