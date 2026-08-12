import { compressCanvas } from './imageOptimizer';

export interface Point {
  x: number;
  y: number;
}

/**
 * Attempts to auto-detect a document contour in the given canvas.
 * Returns an array of 4 points if found, otherwise returns null.
 */
export function detectDocument(canvas: HTMLCanvasElement): Point[] | null {
  try {
    const cv = (window as any).cv;
    if (!cv || !cv.Mat) return null;

    const tempScale = 300 / canvas.width;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 300;
    tempCanvas.height = Math.round(canvas.height * tempScale);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx?.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    
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
    
    // Draw white border to force open edges to connect
    cv.rectangle(edged, new cv.Point(0, 0), new cv.Point(edged.cols - 1, edged.rows - 1), new cv.Scalar(255, 255, 255, 255), 2);
    
    let M = cv.Mat.ones(3, 3, cv.CV_8U);
    let closed = new cv.Mat();
    cv.morphologyEx(edged, closed, cv.MORPH_CLOSE, M);
    
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    
    let maxArea = 0;
    let bestContour: any = null;
    
    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt);
      if (area > src.rows * src.cols * 0.15 && area < src.rows * src.cols * 0.95) { 
        let peri = cv.arcLength(cnt, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.04 * peri, true);
        if (approx.rows >= 4 && approx.rows <= 8 && area > maxArea) {
          maxArea = area;
          if (bestContour) bestContour.delete();
          bestContour = approx.clone();
        }
        approx.delete();
      }
    }
    
    let defaultPts = null;
    if (bestContour) {
      let pts = [];
      for (let i = 0; i < bestContour.rows; i++) {
        pts.push({
          x: bestContour.data32S[i * 2] / tempScale,
          y: bestContour.data32S[i * 2 + 1] / tempScale
        });
      }
      
      pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
      const tl = pts[0];
      const br = pts[pts.length - 1];
      
      pts.sort((a, b) => (a.x - a.y) - (b.x - b.y));
      const bl = pts[0];
      const tr = pts[pts.length - 1];
      
      defaultPts = [tl, tr, br, bl];
      bestContour.delete();
    }
    
    M.delete(); closed.delete(); contours.delete(); hierarchy.delete();
    gray.delete(); blurred.delete(); edged.delete(); src.delete();

    return defaultPts;
  } catch (err) {
    console.warn("Auto-detect failed", err);
    return null;
  }
}

export interface ScannerOptions {
  contrastAlpha?: number;
  contrastBeta?: number;
  erodeWeight?: number;
  saturationBoost?: number;
}

/**
 * Applies perspective crop and industry-standard enhancement filters.
 * Returns an object with Data URLs for cropped, bw, and color versions.
 */
export function applyPerspectiveAndFilters(snapshot: string, pts: Point[], options: ScannerOptions = {}): Promise<{ cropped: string, bw: string, color: string, detectedType?: string, appliedOptions?: ScannerOptions }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = snapshot;
    img.onload = () => {
      try {
        const src = cv.imread(img);
        
        // 1. Perspective Transform
        const dst = new cv.Mat();
        const w = Math.max(
          Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y)
        );
        const h = Math.max(
          Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y),
          Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y)
        );
        
        const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          pts[0].x, pts[0].y, pts[1].x, pts[1].y,
          pts[2].x, pts[2].y, pts[3].x, pts[3].y
        ]);
        
        const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0, 0, w, 0, w, h, 0, h
        ]);
        
        const M = cv.getPerspectiveTransform(srcTri, dstTri);
        cv.warpPerspective(src, dst, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        
        const canvas = document.createElement('canvas');
        cv.imshow(canvas, dst);
        const croppedUrl = compressCanvas(canvas);
        
        // --- B&W Processing ---
        let gray = new cv.Mat();
        cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
        
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 1.5);
        let sharpened = new cv.Mat();
        cv.addWeighted(gray, 1.8, blurred, -0.8, 0, sharpened);
        
        let bw = new cv.Mat();
        // C=12 instead of 15 makes the lines naturally thicker and connected, without blobbing!
        cv.adaptiveThreshold(sharpened, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 55, 12);
        
        // Use a very light Cross kernel (not a Rect) if we want to bridge gaps, 
        // but threshold tuning is usually enough. Let's do a light cross.
        let bwKernel = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
        // We do a very light erode (iterations: 1) only to connect thin lines, cross prevents blocky blobs
        cv.erode(bw, bw, bwKernel, new cv.Point(-1, -1), 1);
        bwKernel.delete();
        
        let darkMask = new cv.Mat();
        cv.threshold(gray, darkMask, 50, 255, cv.THRESH_BINARY_INV); 
        
        let blackMat = new cv.Mat(bw.rows, bw.cols, bw.type(), new cv.Scalar(0));
        blackMat.copyTo(bw, darkMask);
        
        let bwRgba = new cv.Mat();
        cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        cv.imshow(canvas, bwRgba);
        const bwUrl = compressCanvas(canvas);
        
        // --- Auto-Detect Document Type ---
        let rgbDownscaled = new cv.Mat();
        cv.resize(dst, rgbDownscaled, new cv.Size(0, 0), 0.05, 0.05, cv.INTER_AREA);
        
        let smallHsv = new cv.Mat();
        cv.cvtColor(rgbDownscaled, smallHsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(smallHsv, smallHsv, cv.COLOR_RGB2HSV);
        let smallHsvPlanes = new cv.MatVector();
        cv.split(smallHsv, smallHsvPlanes);
        let smallSat = smallHsvPlanes.get(1); // Saturation channel
        
        let meanStd = new cv.Mat();
        let mean = new cv.Mat();
        cv.meanStdDev(smallSat, mean, meanStd);
        let avgSaturation = mean.data64F[0];
        
        meanStd.delete(); mean.delete(); smallSat.delete(); smallHsvPlanes.delete(); smallHsv.delete(); rgbDownscaled.delete();
        
        // A standard text document (even with blue ink) has very low average saturation.
        // A color photo / magazine has high average saturation.
        const isTextDocument = avgSaturation < 35;
        const detectedType = isTextDocument ? 'text' : 'photo';
        
        // --- Determine Final Options (Auto vs Manual) ---
        // If the user provided a specific manual override (e.g., via sliders), use it.
        // Otherwise, fallback to the golden parameters discovered for each type.
        let finalBlurSize = options.bgBlurSize ?? (isTextDocument ? 51 : 49);
        let finalGamma = options.gamma ?? (isTextDocument ? 1.4 : 0.8);
        let finalErode = options.erodeWeight ?? (isTextDocument ? 0.5 : 0.3);
        let finalSat = options.saturationBoost ?? (isTextDocument ? 2.6 : 2.2);

        // --- Color Enhancement ---
        let grayColor = new cv.Mat();
        cv.cvtColor(dst, grayColor, cv.COLOR_RGBA2GRAY);
        
        let grayDownscaled = new cv.Mat();
        cv.resize(grayColor, grayDownscaled, new cv.Size(0, 0), 0.05, 0.05, cv.INTER_AREA);
        
        // --- SMART BACKGROUND ESTIMATION ---
        // Dilate expands the bright pixels (paper) over the dark pixels (text), effectively erasing the text
        // and leaving only the uneven lighting and shadows of the paper!
        let kernelSize = Math.min(21, Math.max(5, finalBlurSize)); 
        if (kernelSize % 2 === 0) kernelSize += 1;
        let bgKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
        
        let background = new cv.Mat();
        cv.dilate(grayDownscaled, background, bgKernel);
        bgKernel.delete();
        
        // Smooth the background map so we don't get hard edges
        cv.GaussianBlur(background, background, new cv.Size(kernelSize, kernelSize), 0);
        
        let illuminationMap = new cv.Mat();
        cv.resize(background, illuminationMap, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_CUBIC);
        background.delete();
        
        let rgb = new cv.Mat();
        cv.cvtColor(dst, rgb, cv.COLOR_RGBA2RGB);
        let rgbPlanes = new cv.MatVector();
        cv.split(rgb, rgbPlanes);
        
        // SAFE Gamma Array in JS Memory (prevents cv.LUT crashes)
        let lutArray = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            lutArray[i] = Math.min(255, Math.pow(i / 255.0, finalGamma) * 255.0);
        }
        
        // Memory-safe channel processing
        let tempChannels = [];
        for (let i = 0; i < 3; i++) {
            let channel = rgbPlanes.get(i);
            
            // Divide out the shadows to make the paper perfectly white
            cv.divide(channel, illuminationMap, channel, 255, -1);
            
            // Manual Gamma apply for total safety
            let data = channel.data;
            for (let j = 0; j < data.length; j++) {
                data[j] = lutArray[data[j]];
            }
            
            rgbPlanes.set(i, channel);
            tempChannels.push(channel); 
            // DO NOT delete channel here, it corrupts rgbPlanes before merge
        }
        
        cv.merge(rgbPlanes, rgb);
        
        // Safe Memory Cleanup for split channels
        tempChannels.forEach(ch => ch.delete());
        
        // Thicken the text - Use ELLIPSE instead of RECT for smoother text per user request
        let eroded = new cv.Mat();
        let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.erode(rgb, eroded, kernel);
        cv.addWeighted(rgb, 1 - finalErode, eroded, finalErode, 0, rgb);
        kernel.delete(); eroded.delete();
        
        let smoothed = new cv.Mat();
        cv.bilateralFilter(rgb, smoothed, 5, 50, 50, cv.BORDER_DEFAULT);

        // Smart Sharpening (Unsharp Mask)
        let colorBlurred = new cv.Mat();
        cv.GaussianBlur(smoothed, colorBlurred, new cv.Size(0, 0), 3);
        let sharp = new cv.Mat();
        cv.addWeighted(smoothed, 2.5, colorBlurred, -1.5, 0, sharp);
        
        let hsv = new cv.Mat();
        cv.cvtColor(sharp, hsv, cv.COLOR_RGB2HSV);
        let hsvPlanes = new cv.MatVector();
        cv.split(hsv, hsvPlanes);
        
        let s = hsvPlanes.get(1);
        s.convertTo(s, -1, finalSat, 0); 
        
        hsvPlanes.set(1, s);
        cv.merge(hsvPlanes, hsv);
        s.delete(); // Safe because it's after merge
        
        // Cleanup remaining hsv planes
        let hPlane = hsvPlanes.get(0); hPlane.delete();
        let vPlane = hsvPlanes.get(2); vPlane.delete();
        
        let finalRgb = new cv.Mat();
        cv.cvtColor(hsv, finalRgb, cv.COLOR_HSV2RGB);
        
        let finalRgba = new cv.Mat();
        cv.cvtColor(finalRgb, finalRgba, cv.COLOR_RGB2RGBA);
        
        cv.imshow(canvas, finalRgba);
        const colorUrl = compressCanvas(canvas);
        
        // Cleanup all allocated Mats to prevent memory leaks
        finalRgb.delete();
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); blurred.delete(); sharpened.delete(); bw.delete(); 
        darkMask.delete(); blackMat.delete(); bwRgba.delete();
        grayColor.delete(); grayDownscaled.delete(); illuminationMap.delete(); 
        rgb.delete(); rgbPlanes.delete();
        smoothed.delete(); colorBlurred.delete(); sharp.delete(); 
        hsv.delete(); hsvPlanes.delete(); 
        finalRgba.delete();
        
        resolve({ 
          cropped: croppedUrl, 
          bw: bwUrl, 
          color: colorUrl,
          detectedType: detectedType,
          appliedOptions: { gamma: finalGamma, erodeWeight: finalErode, saturationBoost: finalSat, bgBlurSize: finalBlurSize }
        });

      } catch (err) {
        console.error("OpenCV processing failed", err);
        reject(err);
      }
    };
    img.onerror = reject;
  });
}
