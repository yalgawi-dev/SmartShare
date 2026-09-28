const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetEffect = `  // 💡 Live Contour Detection Loop ------------------------------------------------
  // Runs detectDocument on a downscaled video frame every 300ms.
  // Detected quad is drawn as a green SVG overlay so the user can
  // position the document before pressing capture.
  useEffect(() => {
    if (step !== 'scanning' || !cvLoaded) {
      // Clean up when not scanning
      if (liveLoopRef.current) cancelAnimationFrame(liveLoopRef.current);
      liveContourRef.current = null;
      setLiveContour(null);
      return;
    }

    const THROTTLE_MS = 300; // run detection ~3x per second

    const detect = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        liveLoopRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = Date.now();
      if (now - lastDetectTimeRef.current > THROTTLE_MS) {
        lastDetectTimeRef.current = now;

        // Snapshot video to offscreen canvas at reduced size for speed
        const W = 250;
        const H = Math.round(video.videoHeight * (W / video.videoWidth));
        const offscreen = document.createElement('canvas');
        offscreen.width = W;
        offscreen.height = H;
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, W, H);
          const detected = detectDocument(offscreen, true);
          if (detected) {
            // Scale points back from 480px space to video native size
            const scaleX = video.videoWidth / W;
            const scaleY = video.videoHeight / H;
            const scaled = detected.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
            liveContourRef.current = scaled;
            setLiveContour(scaled);
          } else {
            liveContourRef.current = null;
            setLiveContour(null);
          }
        }
      }

      liveLoopRef.current = requestAnimationFrame(detect);
    };

    liveLoopRef.current = requestAnimationFrame(detect);
    return () => {
      if (liveLoopRef.current) cancelAnimationFrame(liveLoopRef.current);
    };
  }, [step, cvLoaded]);`;

content = content.replace(targetEffect, '');
fs.writeFileSync(file, content, 'utf8');
console.log('Removed useEffect manually');
