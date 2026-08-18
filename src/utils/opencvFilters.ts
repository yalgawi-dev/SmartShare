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
        
        // --- Photo Mode (Formerly Pure Color) ---
        // Specially tuned for Illustrations, ID Cards, and Books.
        // Preserves all gradients, gentle contrast stretch without erasing shadows.
        let photoRgb = new cv.Mat();
        cv.cvtColor(dst, photoRgb, cv.COLOR_RGBA2RGB);
        let photoHsv = new cv.Mat();
        cv.cvtColor(photoRgb, photoHsv, cv.COLOR_RGB2HSV);
        let photoHsvPlanes = new cv.MatVector();
        cv.split(photoHsv, photoHsvPlanes);
        
        let photoS = photoHsvPlanes.get(1);
        let photoV = photoHsvPlanes.get(2);
        
        // Gentle luminance stretch (makes darks a bit darker, keeps brights bright)
        // Gamma 0.8 is great for photos (x = 255 * (x/255)^0.8). But we can just use a mild linear stretch
        photoV.convertTo(photoV, -1, 1.1, -10); 
        
        // Gentle saturation boost to make illustrations lively
        photoS.convertTo(photoS, -1, 1.3, 0);
        
        photoHsvPlanes.set(1, photoS);
        photoHsvPlanes.set(2, photoV);
        cv.merge(photoHsvPlanes, photoHsv);
        
        let finalPhotoColor = new cv.Mat();
        cv.cvtColor(photoHsv, finalPhotoColor, cv.COLOR_HSV2RGB);
        let finalPureRgba = new cv.Mat();
        cv.cvtColor(finalPhotoColor, finalPureRgba, cv.COLOR_RGB2RGBA);
        
        cv.imshow(canvas, finalPureRgba);
        const pureColorUrl = compressCanvas(canvas);
        
        // Cleanup photo objects
        photoRgb.delete(); photoHsv.delete(); photoHsvPlanes.delete();
        photoS.delete(); photoV.delete(); finalPhotoColor.delete(); finalPureRgba.delete();

        // --- Smart Color (v10.0 CLAHE Mixed-Content Engine) ---
        // 1. Convert to RGB and then to LAB color space for Luminance separation
        let smartRgb = new cv.Mat();
        cv.cvtColor(dst, smartRgb, cv.COLOR_RGBA2RGB);

        let smartLab = new cv.Mat();
        cv.cvtColor(smartRgb, smartLab, cv.COLOR_RGB2Lab);
        let labPlanes = new cv.MatVector();
        cv.split(smartLab, labPlanes);

        let L = labPlanes.get(0);
        let a = labPlanes.get(1);
        let b = labPlanes.get(2);

        // 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
        // This equalizes contrast locally, completely destroying shadows while preserving global color and photos!
        let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(L, L);
        clahe.delete();

        // 3. Global White Point Adjustment
        // CLAHE pushes shadows towards white, but this guarantees paper is 100% pure white and text is bold.
        L.convertTo(L, -1, 1.3, -50);

        labPlanes.set(0, L);
        cv.merge(labPlanes, smartLab);
        
        let claheRgb = new cv.Mat();
        cv.cvtColor(smartLab, claheRgb, cv.COLOR_Lab2RGB);

        // 4. Color Enhancement (Saturation) & Noise Cleanup
        let smartHsv = new cv.Mat();
        cv.cvtColor(claheRgb, smartHsv, cv.COLOR_RGB2HSV);
        let hsvPlanes = new cv.MatVector();
        cv.split(smartHsv, hsvPlanes);

        let S = hsvPlanes.get(1);
        // Boost color by 1.5x so colored pens and pictures pop
        S.convertTo(S, -1, 1.5, 0);
        // Clean extreme faint chromatic noise (stains)
        cv.threshold(S, S, 20, 255, cv.THRESH_TOZERO);

        hsvPlanes.set(1, S);
        cv.merge(hsvPlanes, smartHsv);
        cv.cvtColor(smartHsv, claheRgb, cv.COLOR_HSV2RGB);

        // 5. Unsharp Mask for razor sharp text (Laser Scanner effect)
        let blurredText = new cv.Mat();
        cv.GaussianBlur(claheRgb, blurredText, new cv.Size(0, 0), 2.0);
        cv.addWeighted(claheRgb, 1.5, blurredText, -0.5, 0, claheRgb);
        blurredText.delete();

        // 6. Convert to output RGBA
        let finalSmartRgba = new cv.Mat();
        cv.cvtColor(claheRgb, finalSmartRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalSmartRgba);
        const smartColorUrl = compressCanvas(canvas);

        // Cleanup v10.0 Engine
        smartRgb.delete(); smartLab.delete(); labPlanes.delete(); L.delete(); a.delete(); b.delete();
        claheRgb.delete(); smartHsv.delete(); hsvPlanes.delete(); S.delete(); finalSmartRgba.delete();
        

        // Cleanup General and Pure objects
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); blurred.delete(); sharpened.delete(); bw.delete(); 
        darkMask.delete(); blackMat.delete(); bwRgba.delete();
        
        // Restore cleanup for MAIN Color Enhancement
        grayColor.delete(); grayDownscaled.delete(); illuminationMap.delete(); rgb.delete(); rgbPlanes.delete();
        smoothed.delete(); colorBlurred.delete(); sharp.delete(); hsv.delete(); hsvPlanes.delete(); s.delete();
        enhancedRgb.delete(); lowSatMask.delete(); bwColor.delete(); magicColor.delete(); finalRgba.delete();
        
        // Legacy pure objects were replaced by photo objects and already cleaned up.
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
