import { compressCanvas } from './imageOptimizer';

export interface Point {
  x: number;
  y: number;
}

export interface ScannerOptions {
  magicGamma?: number;
  magicErode?: number;
  magicSaturation?: number;
  magicBlackPoint?: number;
  magicWhiteClip?: number;
  
  // Pure Color (v4.0)
  pureGamma?: number;
  pureErode?: number;
  pureSaturation?: number;
  pureWhiteClip?: number;
  pureBlackPoint?: number;
  
  // Smart Color (v4.42)
  smartGamma?: number;
  smartSaturation?: number;
  smartWhiteClip?: number;
  smartBlackPoint?: number;
  smartSharpen?: number;

  // Shared
  bgBlurSize?: number;
  profile?: 'text' | 'photo' | 'auto';
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

/**
 * Applies perspective crop and industry-standard enhancement filters.
 * Returns an object with Data URLs for cropped, bw, and color versions.
 */
export function applyPerspectiveAndFilters(snapshot: string, pts: Point[], options: ScannerOptions = {}): Promise<{ cropped: string, bw: string, color: string, pureColor: string, smartColor: string, appliedOptions?: ScannerOptions, detectedType?: 'text' | 'photo' }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = snapshot;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));
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
        
        cv.imshow(canvas, dst);
        const croppedUrl = compressCanvas(canvas);

        // --- B&W Enhancement ---
        let gray = new cv.Mat();
        cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
        
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 2);
        let sharpened = new cv.Mat();
        cv.addWeighted(gray, 1.7, blurred, -0.7, 0, sharpened);
        
        let bw = new cv.Mat();
        cv.adaptiveThreshold(sharpened, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 55, 15);
        
        let darkMask = new cv.Mat();
        cv.threshold(gray, darkMask, 50, 255, cv.THRESH_BINARY_INV);
        
        // --- Auto-Detect Profile (Photo vs Text) ---
        // Adaptive thresholding makes mostly white pages with black text.
        // If more than 30% of the image became black, it's highly likely a photo (or a very noisy/dark image that shouldn't be processed as text).
        let totalPixels = bw.rows * bw.cols;
        let whitePixels = cv.countNonZero(bw);
        let blackPixels = totalPixels - whitePixels;
        let blackRatio = blackPixels / totalPixels;
        
        let detectedType: 'text' | 'photo' = blackRatio > 0.30 ? 'photo' : 'text';
        
        // If options.profile is 'auto' (or undefined), set options.profile so the rest of the pipeline uses the detected type!
        if (!options.profile || options.profile === 'auto') {
            options.profile = detectedType;
        } 
        
        let blackMat = new cv.Mat(bw.rows, bw.cols, bw.type(), new cv.Scalar(0));
        blackMat.copyTo(bw, darkMask);
        
        let bwRgba = new cv.Mat();
        cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        cv.imshow(canvas, bwRgba);
        const bwUrl = compressCanvas(canvas);
        
        // --- Color Enhancement ---
        let grayColor = new cv.Mat();
        cv.cvtColor(dst, grayColor, cv.COLOR_RGBA2GRAY);
        
        let grayDownscaled = new cv.Mat();
        cv.resize(grayColor, grayDownscaled, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA);
        let finalBlurSize = options.bgBlurSize ?? 21;
        cv.medianBlur(grayDownscaled, grayDownscaled, finalBlurSize);
        
        let illuminationMap = new cv.Mat();
        cv.resize(grayDownscaled, illuminationMap, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_CUBIC);
        
        let rgbForMask = new cv.Mat();
        cv.cvtColor(dst, rgbForMask, cv.COLOR_RGBA2RGB);
        let hsvForMask = new cv.Mat();
        cv.cvtColor(rgbForMask, hsvForMask, cv.COLOR_RGB2HSV);
        let hsvPlanesForMask = new cv.MatVector();
        cv.split(hsvForMask, hsvPlanesForMask);
        let sMap = hsvPlanesForMask.get(1);
        
        cv.addWeighted(illuminationMap, 1.0, sMap, 0.5, 0, illuminationMap);
        rgbForMask.delete(); hsvForMask.delete(); hsvPlanesForMask.delete(); sMap.delete();
        
        let rgb = new cv.Mat();
        cv.cvtColor(dst, rgb, cv.COLOR_RGBA2RGB);
        let rgbPlanes = new cv.MatVector();
        cv.split(rgb, rgbPlanes);
        
        // Use magic parameters for Magic Color
        let finalGamma = options.magicGamma ?? 1.3;
        let finalBlackPoint = options.magicBlackPoint ?? 40; // Default offset was 40 in 3.6
        
        let isPhoto = options.profile === 'photo';
        
        for (let i = 0; i < 3; i++) {
            let channel = rgbPlanes.get(i);
            if (!isPhoto) {
                cv.divide(channel, illuminationMap, channel, 255, -1);
            }
            rgbPlanes.set(i, channel);
            channel.delete();
        }
        cv.merge(rgbPlanes, rgb);
        
        // Apply White Clip for Magic Color BEFORE convertTo
        let magicWhiteClip = options.magicWhiteClip ?? 255; // Default 255 (no clip)
        if (!isPhoto && magicWhiteClip < 255) {
            let magicLut = new Uint8Array(256);
            for (let i = 0; i < 256; i++) {
                magicLut[i] = i >= magicWhiteClip ? 255 : i;
            }
            let rgbData = rgb.data;
            for (let j = 0; j < rgbData.length; j++) {
                rgbData[j] = magicLut[rgbData[j]];
            }
        }
        
        // Thicken the text (Erode) BEFORE contrast curve so that gray halos get crushed into black!
        let eroded = new cv.Mat();
        let kernel = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
        let finalErode = options.magicErode ?? 0.5;
        if (!isPhoto && finalErode > 0) {
            cv.erode(rgb, eroded, kernel);
            cv.addWeighted(rgb, 1.0 - finalErode, eroded, finalErode, 0, rgb);
        }
        kernel.delete(); eroded.delete();
        
        // Apply contrast curve (Gamma & Black Point)
        if (!isPhoto) {
            rgb.convertTo(rgb, -1, finalGamma, -finalBlackPoint); // Increased contrast for whiter page
        } else {
            rgb.convertTo(rgb, -1, finalGamma, -Math.floor(finalBlackPoint / 2)); // Gentle contrast for photos
        }
        
        let smoothed = new cv.Mat();
        cv.bilateralFilter(rgb, smoothed, 5, 50, 50, cv.BORDER_DEFAULT);

        let colorBlurred = new cv.Mat();
        cv.GaussianBlur(smoothed, colorBlurred, new cv.Size(0, 0), 2);
        let sharp = new cv.Mat();
        cv.addWeighted(smoothed, 3.5, colorBlurred, -2.5, 0, sharp);
        
        let hsv = new cv.Mat();
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        let hsvPlanes = new cv.MatVector();
        cv.split(hsv, hsvPlanes);
        let s = hsvPlanes.get(1);
        
        let finalSat = options.magicSaturation ?? 1.8;
        if (isPhoto) {
            finalSat = options.magicSaturation ?? 1.3;
        }
        
        s.convertTo(s, -1, finalSat, 0); 
        hsvPlanes.set(1, s);
        cv.merge(hsvPlanes, hsv);
        
        let enhancedRgb = new cv.Mat();
        cv.cvtColor(hsv, enhancedRgb, cv.COLOR_HSV2RGB);
        
        let lowSatMask = new cv.Mat();
        cv.threshold(s, lowSatMask, 50, 255, cv.THRESH_BINARY_INV);
        
        let bwColor = new cv.Mat();
        cv.cvtColor(bw, bwColor, cv.COLOR_GRAY2RGB);
        
        let magicColor = new cv.Mat();
        if (!isPhoto) {
            cv.min(enhancedRgb, bwColor, magicColor);
            magicColor.copyTo(enhancedRgb, lowSatMask);
        }
        
        let finalRgba = new cv.Mat();
        cv.cvtColor(enhancedRgb, finalRgba, cv.COLOR_RGB2RGBA);
        
        cv.imshow(canvas, finalRgba);
        const colorUrl = compressCanvas(canvas);
        
        let rgbPure = new cv.Mat();
        cv.cvtColor(dst, rgbPure, cv.COLOR_RGBA2RGB);
        let rgbPurePlanes = new cv.MatVector();
        cv.split(rgbPure, rgbPurePlanes);
        
        let whiteClipThreshold = options.pureWhiteClip ?? 210;
        let pureGamma = options.pureGamma ?? 0.5;
        let pureSat = options.pureSaturation ?? 1.8;
        let pureErodeWeight = options.pureErode ?? 0.5;
        let pureBlackPoint = options.pureBlackPoint ?? 0;
        
        let pureLut = new Uint8Array(256);
        let safeWhiteClip = Math.max(whiteClipThreshold, pureBlackPoint + 1);
        let range = safeWhiteClip - pureBlackPoint;
        
        for (let i = 0; i < 256; i++) {
            if (i >= safeWhiteClip) {
                pureLut[i] = 255;
            } else if (i <= pureBlackPoint) {
                pureLut[i] = 0;
            } else {
                let norm = Math.max(0, (i - pureBlackPoint) / range);
                let val = Math.pow(norm, pureGamma) * 255.0;
                pureLut[i] = isNaN(val) ? 0 : Math.min(255, val);
            }
        }
        
        // Step 1: Flatten lighting (Divide by illumination map)
        for (let i = 0; i < 3; i++) {
            let channel = rgbPurePlanes.get(i);
            if (!isPhoto) {
                cv.divide(channel, illuminationMap, channel, 255, -1);
            }
            rgbPurePlanes.set(i, channel);
            channel.delete();
        }
        cv.merge(rgbPurePlanes, rgbPure);
        
        // Step 2: Thicken text (Erode) BEFORE LUT
        if (!isPhoto && pureErodeWeight > 0) {
            let erodedPure = new cv.Mat();
            let pureKernel = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
            cv.erode(rgbPure, erodedPure, pureKernel);
            cv.addWeighted(rgbPure, 1.0 - pureErodeWeight, erodedPure, pureErodeWeight, 0, rgbPure);
            pureKernel.delete(); erodedPure.delete();
        }
        
        // Step 3: Apply Gamma & White Clip LUT directly on the merged rgb data
        let rgbData = rgbPure.data;
        if (!isPhoto) {
            for (let j = 0; j < rgbData.length; j++) {
                rgbData[j] = pureLut[rgbData[j]];
            }
        } else {
             let photoLut = new Uint8Array(256);
             for (let k = 0; k < 256; k++) {
                 if (k <= pureBlackPoint) {
                     photoLut[k] = 0;
                 } else {
                     let norm = Math.max(0, (k - pureBlackPoint) / (255 - pureBlackPoint));
                     let val = Math.pow(norm, pureGamma) * 255.0;
                     photoLut[k] = isNaN(val) ? 0 : Math.min(255, val);
                 }
             }
             for (let j = 0; j < rgbData.length; j++) {
                 rgbData[j] = photoLut[rgbData[j]];
             }
        }
        
        let hsvPure = new cv.Mat();
        cv.cvtColor(rgbPure, hsvPure, cv.COLOR_RGB2HSV);
        let hsvPurePlanes = new cv.MatVector();
        cv.split(hsvPure, hsvPurePlanes);
        let sPure = hsvPurePlanes.get(1);
        
        sPure.convertTo(sPure, -1, pureSat, 0); 
        hsvPurePlanes.set(1, sPure);
        cv.merge(hsvPurePlanes, hsvPure);
        
        let finalPureColor = new cv.Mat();
        cv.cvtColor(hsvPure, finalPureColor, cv.COLOR_HSV2RGB);
        let finalPureRgba = new cv.Mat();
        cv.cvtColor(finalPureColor, finalPureRgba, cv.COLOR_RGB2RGBA);
        
        cv.imshow(canvas, finalPureRgba);
        const pureColorUrl = compressCanvas(canvas);

        // --- Smart Color (v5.0 Pro Glass & Solid Color) ---
        // 1. PERFECT GLASS BACKGROUND: Erase text before illumination map
        let smartGrayColor = new cv.Mat();
        cv.cvtColor(dst, smartGrayColor, cv.COLOR_RGBA2GRAY);
        
        let smartDilatedBg = new cv.Mat();
        let eraseKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
        cv.dilate(smartGrayColor, smartDilatedBg, eraseKernel); // Erases dark text, leaving only background
        eraseKernel.delete();
        
        let smartGrayDownscaled = new cv.Mat();
        cv.resize(smartDilatedBg, smartGrayDownscaled, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA);
        cv.medianBlur(smartGrayDownscaled, smartGrayDownscaled, 21);
        
        let smartIlluminationMap = new cv.Mat();
        cv.resize(smartGrayDownscaled, smartIlluminationMap, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_CUBIC);
        smartDilatedBg.delete();
        
        let smartRgbForMask = new cv.Mat();
        cv.cvtColor(dst, smartRgbForMask, cv.COLOR_RGBA2RGB);
        let smartHsvForMask = new cv.Mat();
        cv.cvtColor(smartRgbForMask, smartHsvForMask, cv.COLOR_RGB2HSV);
        let smartHsvPlanesForMask = new cv.MatVector();
        cv.split(smartHsvForMask, smartHsvPlanesForMask);
        let smartSMap = smartHsvPlanesForMask.get(1);
        
        cv.addWeighted(smartIlluminationMap, 1.0, smartSMap, 0.5, 0, smartIlluminationMap);
        smartRgbForMask.delete(); smartHsvForMask.delete(); smartHsvPlanesForMask.delete(); smartSMap.delete();
        
        let smartRgb = new cv.Mat();
        cv.cvtColor(dst, smartRgb, cv.COLOR_RGBA2RGB);
        let smartRgbPlanes = new cv.MatVector();
        cv.split(smartRgb, smartRgbPlanes);
        
        for (let i = 0; i < 3; i++) {
            let channel = smartRgbPlanes.get(i);
            cv.divide(channel, smartIlluminationMap, channel, 255, -1);
            channel.convertTo(channel, -1, 1.3, -40); // Increased contrast for whiter page
            smartRgbPlanes.set(i, channel);
            channel.delete();
        }
        cv.merge(smartRgbPlanes, smartRgb);
        
        // 2. HOMOGENEOUS COLOR ENGINE: Solidify the colored ink
        // Thicken the text (Erode) with a slightly stronger blend (0.7) to fill gaps in pen strokes
        let smartEroded = new cv.Mat();
        let smartKernel = cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3));
        cv.erode(smartRgb, smartEroded, smartKernel);
        cv.addWeighted(smartRgb, 0.3, smartEroded, 0.7, 0, smartRgb);
        smartKernel.delete(); smartEroded.delete();
        
        let smartSmoothed = new cv.Mat();
        cv.bilateralFilter(smartRgb, smartSmoothed, 5, 50, 50, cv.BORDER_DEFAULT);

        // Gentler sharpening so we don't amplify noise in red ink!
        let smartColorBlurred = new cv.Mat();
        cv.GaussianBlur(smartSmoothed, smartColorBlurred, new cv.Size(0, 0), 2);
        let smartSharp = new cv.Mat();
        cv.addWeighted(smartSmoothed, 1.5, smartColorBlurred, -0.5, 0, smartSharp);
        
        let smartHsv = new cv.Mat();
        cv.cvtColor(smartSharp, smartHsv, cv.COLOR_RGB2HSV);
        let smartHsvPlanes = new cv.MatVector();
        cv.split(smartHsv, smartHsvPlanes);
        let smartS = smartHsvPlanes.get(1);
        smartS.convertTo(smartS, -1, 1.15, 0); 
        smartHsvPlanes.set(1, smartS);
        cv.merge(smartHsvPlanes, smartHsv);
        
        let smartEnhancedRgb = new cv.Mat();
        cv.cvtColor(smartHsv, smartEnhancedRgb, cv.COLOR_HSV2RGB);
        
        // 6. BLEND WITH B&W MASK (Magic Step)
        let smartLowSatMask = new cv.Mat();
        cv.threshold(smartS, smartLowSatMask, 50, 255, cv.THRESH_BINARY_INV); 
        
        let smartBwColor = new cv.Mat();
        cv.cvtColor(bw, smartBwColor, cv.COLOR_GRAY2RGB);
        
        let smartMagicColor = new cv.Mat();
        cv.min(smartEnhancedRgb, smartBwColor, smartMagicColor); 
        
        smartMagicColor.copyTo(smartEnhancedRgb, smartLowSatMask);
        
        let finalSmartRgba = new cv.Mat();
        cv.cvtColor(smartEnhancedRgb, finalSmartRgba, cv.COLOR_RGB2RGBA);
        
        cv.imshow(canvas, finalSmartRgba);
        const smartColorUrl = compressCanvas(canvas);
        
        // Cleanup smart objects
        smartGrayColor.delete(); smartGrayDownscaled.delete(); smartIlluminationMap.delete();
        smartRgb.delete(); smartRgbPlanes.delete(); smartSmoothed.delete();
        smartColorBlurred.delete(); smartSharp.delete(); smartHsv.delete(); smartHsvPlanes.delete(); smartS.delete();
        smartEnhancedRgb.delete(); smartLowSatMask.delete(); smartBwColor.delete(); smartMagicColor.delete();
        finalSmartRgba.delete();
        
        // Cleanup General and Pure objects
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); blurred.delete(); sharpened.delete(); bw.delete(); 
        darkMask.delete(); blackMat.delete(); bwRgba.delete();
        
        // Restore cleanup for MAIN Color Enhancement
        grayColor.delete(); grayDownscaled.delete(); illuminationMap.delete(); rgb.delete(); rgbPlanes.delete();
        smoothed.delete(); colorBlurred.delete(); sharp.delete(); hsv.delete(); hsvPlanes.delete(); s.delete();
        enhancedRgb.delete(); lowSatMask.delete(); bwColor.delete(); magicColor.delete(); finalRgba.delete();
        
        rgbPure.delete(); rgbPurePlanes.delete(); hsvPure.delete(); hsvPurePlanes.delete(); sPure.delete(); finalPureColor.delete(); finalPureRgba.delete();
        resolve({ 
          cropped: croppedUrl, 
          bw: bwUrl, 
          color: colorUrl,
          pureColor: pureColorUrl,
          smartColor: smartColorUrl,
          appliedOptions: {
            magicGamma: options.magicGamma,
            magicErode: options.magicErode,
            magicSaturation: options.magicSaturation,
            magicBlackPoint: options.magicBlackPoint,
            magicWhiteClip: options.magicWhiteClip,
            pureGamma: options.pureGamma,
            pureErode: options.pureErode,
            pureSaturation: options.pureSaturation,
            pureWhiteClip: options.pureWhiteClip,
            pureBlackPoint: options.pureBlackPoint,
            smartGamma: options.smartGamma,
            smartSaturation: options.smartSaturation,
            smartWhiteClip: options.smartWhiteClip,
            smartBlackPoint: options.smartBlackPoint,
            smartSharpen: options.smartSharpen,
            bgBlurSize: finalBlurSize,
            profile: options.profile
          },
          detectedType
        });

      } catch (err) {
        console.error("OpenCV processing failed", err);
        reject(err);
      }
    };
    img.onerror = reject;
  });
}
