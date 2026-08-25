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

/**
 * Applies perspective crop and industry-standard enhancement filters.
 * Returns an object with Data URLs for cropped, bw, and color versions.
 */
export function applyPerspectiveAndFilters(snapshot: string, pts: Point[], forcedProfile: 'auto' | 'text' | 'photo' = 'auto'): Promise<{ cropped: string, bw: string, pureColor: string, smartColor: string, hybridColor?: string, detectedType?: 'text' | 'photo' | 'mixed' }> {
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

        // --- B&W Enhancement (Sauvola Adaptive Thresholding for Thermal Receipts) ---
        let gray = new cv.Mat();
        cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // 1. Sharpening: crucial for blurry dot-matrix thermal receipts
        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(0, 0), 2);
        let sharpened = new cv.Mat();
        // Strongly boost edges to help faint text survive the threshold
        cv.addWeighted(gray, 2.0, blurred, -1.0, 0, sharpened);
        blurred.delete();
        
        let bw = new cv.Mat();
        bw.create(sharpened.rows, sharpened.cols, cv.CV_8UC1);
        
        const w = sharpened.cols;
        const h = sharpened.rows;
        const grayData = sharpened.data;
        const bwData = bw.data;
        
        // 2. Compute mean & variance integral images in O(N)
        const intImg = new Uint32Array(w * h);
        const intSqImg = new Float64Array(w * h);
        for (let y = 0; y < h; y++) {
          let sum = 0;
          let sqSum = 0;
          for (let x = 0; x < w; x++) {
            const val = grayData[y * w + x];
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

        // 3. Sauvola Local Adaptive Thresholding parameters
        const S = 31; // Larger window to encompass whole words, not just strokes
        const k = 0.05; // Lower K to preserve very faint text (was 0.12)
        const R = 128; // Dynamic range standard deviation for 8-bit gray
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const pix = grayData[idx];
            
            // Bounds for local window
            const x1 = Math.max(0, x - Math.floor(S / 2));
            const x2 = Math.min(w - 1, x + Math.floor(S / 2));
            const y1 = Math.max(0, y - Math.floor(S / 2));
            const y2 = Math.min(h - 1, y + Math.floor(S / 2));
            
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            
            // Get local mean
            let sum = intImg[y2 * w + x2];
            if (x1 > 0) sum -= intImg[y2 * w + (x1 - 1)];
            if (y1 > 0) sum -= intImg[(y1 - 1) * w + x2];
            if (x1 > 0 && y1 > 0) sum += intImg[(y1 - 1) * w + (x1 - 1)];
            
            // Get local standard deviation
            let sqSum = intSqImg[y2 * w + x2];
            if (x1 > 0) sqSum -= intSqImg[y2 * w + (x1 - 1)];
            if (y1 > 0) sqSum -= intSqImg[(y1 - 1) * w + x2];
            if (x1 > 0 && y1 > 0) sqSum += intSqImg[(y1 - 1) * w + (x1 - 1)];
            
            const mean = sum / count;
            const variance = (sqSum / count) - (mean * mean);
            const std = Math.sqrt(Math.max(0, variance));
            
            const threshold = mean * (1 + k * (std / R - 1));
            
            let val = 255;
            if (pix < threshold) {
              val = 0; // Black
            }
            
            // Force dark pixels to black to guarantee text readability (Threshold ~130)
            // Skip in shadow areas (local mean < 140) to prevent black blob artifacting
            if (pix < 130 && mean >= 140) {
              val = 0;
            }
            
            bwData[idx] = val;
          }
        }
        
        // 4. Magic Pepper-Noise Removal!
        // Median blur completely destroys isolated 1-pixel or 2-pixel black dots (like sensor noise in shadows)
        // while perfectly preserving the solid, connected lines of the text.
        cv.medianBlur(bw, bw, 3);
        
        let darkMask = new cv.Mat();
        cv.threshold(gray, darkMask, 50, 255, cv.THRESH_BINARY_INV);
        
        // --- Auto-Detect Profile (Photo vs Text vs Mixed) ---
        let totalPixels = bw.rows * bw.cols;
        
        let hsvCheck = new cv.Mat();
        let rgbCheck = new cv.Mat();
        cv.cvtColor(dst, rgbCheck, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgbCheck, hsvCheck, cv.COLOR_RGB2HSV);
        let hsvPlanesCheck = new cv.MatVector();
        cv.split(hsvCheck, hsvPlanesCheck);
        let sCheck = hsvPlanesCheck.get(1);
        let vCheck = hsvPlanesCheck.get(2);
        
        // 1. Identify Colorful regions (Saturation > 35, not pure white/black)
        let colorMask = new cv.Mat();
        cv.threshold(sCheck, colorMask, 35, 255, cv.THRESH_BINARY);
        let notPaperMask = new cv.Mat();
        cv.threshold(vCheck, notPaperMask, 210, 255, cv.THRESH_BINARY_INV); // Exclude bright white from color
        let targetMask = new cv.Mat();
        cv.bitwise_and(colorMask, notPaperMask, targetMask);
        
        let openedMask = new cv.Mat();
        let openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(15, 15));
        cv.morphologyEx(targetMask, openedMask, cv.MORPH_OPEN, openKernel);
        let colorfulPixels = cv.countNonZero(openedMask);
        let colorfulRatio = colorfulPixels / totalPixels;

        // 2. Identify Paper regions (Adaptive Lighting, Low Saturation)
        let brightMask = new cv.Mat();
        // Use Otsu's method to automatically find the perfect threshold for the lighting in the room!
        cv.threshold(vCheck, brightMask, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
        let nonColorMask = new cv.Mat();
        cv.threshold(sCheck, nonColorMask, 40, 255, cv.THRESH_BINARY_INV);
        let paperMask = new cv.Mat();
        cv.bitwise_and(brightMask, nonColorMask, paperMask);
        let paperPixels = cv.countNonZero(paperMask);
        let paperRatio = paperPixels / totalPixels;

        // 3. Identify Dark/Noisy regions (B&W threshold black area)
        let whitePixels = cv.countNonZero(bw);
        let blackPixels = totalPixels - whitePixels;
        let blackRatio = blackPixels / totalPixels;

        let isPhoto = false;
        let isMixed = false;

        // ALWAYS calculate hybrid mask so it's available for manual override
        let hybridMask = new cv.Mat();
        let smallMask = new cv.Mat();
        cv.resize(openedMask, smallMask, new cv.Size(0, 0), 0.2, 0.2, cv.INTER_NEAREST);
        
        let cleanKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        cv.morphologyEx(smallMask, smallMask, cv.MORPH_OPEN, cleanKernel);
        
        let dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
        cv.dilate(smallMask, smallMask, dilateKernel, new cv.Point(-1, -1), 1);
        
        cv.GaussianBlur(smallMask, smallMask, new cv.Size(9, 9), 0, 0);
        
        cv.resize(smallMask, hybridMask, new cv.Size(openedMask.cols, openedMask.rows), 0, 0, cv.INTER_LINEAR);
        
        smallMask.delete();
        cleanKernel.delete();
        dilateKernel.delete();

        // Auto-Detect Logic to determine default mode
        if (colorfulRatio > 0.15 || blackRatio > 0.40) {
            // Massive color or massive dark texture -> Pure Photo
            isPhoto = true;
        } else if (colorfulRatio > 0.03) {
            // Moderate color
            if (paperRatio > 0.05) {
                // There is also bright paper -> Mixed / Collage
                isMixed = true;
            } else {
                // No paper -> Photo
                isPhoto = true;
            }
        } else {
            // Very little color, mostly black & white -> Text/Invoice
            // Fallback for extremely weird edge cases, though technically it should be `isPhoto = false; isMixed = false;` which defaults to text.
        }

        vCheck.delete(); colorMask.delete(); notPaperMask.delete(); targetMask.delete(); openedMask.delete(); openKernel.delete();
        hsvCheck.delete(); rgbCheck.delete(); hsvPlanesCheck.delete(); sCheck.delete();
        brightMask.delete(); nonColorMask.delete(); paperMask.delete();
        
        let detectedType: 'text' | 'photo' | 'mixed' = isPhoto ? 'photo' : (isMixed ? 'mixed' : 'text');
        let blackMat = new cv.Mat(bw.rows, bw.cols, bw.type(), new cv.Scalar(0));
        blackMat.copyTo(bw, darkMask);
        
        let bwRgba = new cv.Mat();
        cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        cv.imshow(canvas, bwRgba);
        const bwUrl = compressCanvas(canvas, 0.85);
        
        // --- Photo Mode (v12.0 Professional Scanner Engine - For Photos) ---
        // Specially tuned for Illustrations, Photos, and colored documents.
        // Perfect for colored images (preserves exact Hue and Saturation).
        let photoRgb = new cv.Mat();
        cv.cvtColor(dst, photoRgb, cv.COLOR_RGBA2RGB);

        let photoHsv = new cv.Mat();
        cv.cvtColor(photoRgb, photoHsv, cv.COLOR_RGB2HSV);
        let photoHsvPlanes = new cv.MatVector();
        cv.split(photoHsv, photoHsvPlanes);

        let photoV = photoHsvPlanes.get(2);
        // Brightness and Contrast boost to simulate "turning on the light"
        // Increased contrast to 1.25 and brightness to 20 for stronger lighting
        photoV.convertTo(photoV, -1, 1.25, 20);

        // Clarity / Pop (הבלטה): Stronger Unsharp Mask with larger radius
        // Targets local contrast to give depth without plastic halos
        let blurredV = new cv.Mat();
        cv.GaussianBlur(photoV, blurredV, new cv.Size(0, 0), 2.0);
        cv.addWeighted(photoV, 1.75, blurredV, -0.75, 0, photoV);
        blurredV.delete();

        photoHsvPlanes.set(2, photoV);
        photoV.delete();

        let photoS = photoHsvPlanes.get(1);
        // Slightly richer saturation boost (1.25) to compensate for the extra brightness
        photoS.convertTo(photoS, -1, 1.25, 10);
        photoHsvPlanes.set(1, photoS);
        photoS.delete();

        cv.merge(photoHsvPlanes, photoHsv);

        cv.cvtColor(photoHsv, photoRgb, cv.COLOR_HSV2RGB);
        photoHsvPlanes.delete();
        photoHsv.delete();

        // 3. Raw Camera Preservation
        // We removed all artificial OpenCV sharpening, blurring, and bilateral filters!
        // Modern smartphones already apply massive sharpening and noise reduction natively.
        // Applying OpenCV sharpening on top creates "Plastic/Glass" halos around text.
        // We simply pass the raw, color-boosted camera pixels forward.

        let finalPureRgba = new cv.Mat();
        cv.cvtColor(photoRgb, finalPureRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalPureRgba);
        const pureColorUrl = compressCanvas(canvas, 0.85);
        
        // Do not delete photoRgb and finalPureRgba yet, we need them for hybrid

        // --- Smart Color (v11.3 Retinex + Post-Sharpening) ---
        // Perfect for text and invoices.
        let smartRgb = new cv.Mat();
        cv.cvtColor(dst, smartRgb, cv.COLOR_RGBA2RGB);

        let smartGray = new cv.Mat();
        cv.cvtColor(smartRgb, smartGray, cv.COLOR_RGB2GRAY);

        let smartDownscaled = new cv.Mat();
        // Downscale aggressively to ensure faint text is completely destroyed in the background estimation
        cv.resize(smartGray, smartDownscaled, new cv.Size(0, 0), 0.05, 0.05, cv.INTER_AREA);

        // Use a smaller Dilation kernel instead of MORPH_CLOSE.
        // MORPH_CLOSE (dilate then erode) spreads bright paper into dark shadows, ruining the shadow map.
        // Dilation alone (taking local maximum) is enough to erase thin black text,
        // while perfectly maintaining the shape and depth of large soft shadows!
        let smartKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        cv.dilate(smartDownscaled, smartDownscaled, smartKernel);
        smartKernel.delete();

        // Lighter blur to perfectly map the shadows without bleeding them
        cv.GaussianBlur(smartDownscaled, smartDownscaled, new cv.Size(5, 5), 0, 0);

        let smartBg = new cv.Mat();
        cv.resize(smartDownscaled, smartBg, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_CUBIC);
        smartDownscaled.delete();

        let smartRgbPlanes = new cv.MatVector();
        cv.split(smartRgb, smartRgbPlanes);

        for (let i = 0; i < 3; i++) {
            let channel = smartRgbPlanes.get(i);
            // Divide original by background. Paper becomes 255 (white), text stays dark.
            cv.divide(channel, smartBg, channel, 255, -1);
            smartRgbPlanes.set(i, channel);
            channel.delete();
        }
        cv.merge(smartRgbPlanes, smartRgb);
        smartRgbPlanes.delete();

        // 1. Connect dot-matrix dots (Morphological Erosion expands dark pixels)
        // This solves the "hollow letters" problem on thermal receipts by physically 
        // bridging the tiny gaps between printed dots before we sharpen them.
        let connectKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        cv.erode(smartRgb, smartRgb, connectKernel);
        connectKernel.delete();

        // 2. Unsharp Masking (Post-Division)
        // Now that the paper is uniformly pure white and dots are connected, 
        // we can safely apply Unsharp Masking to darken the text WITHOUT creating bright halos!
        let smartSharp = new cv.Mat();
        cv.GaussianBlur(smartRgb, smartSharp, new cv.Size(0, 0), 1.0);
        cv.addWeighted(smartRgb, 2.5, smartSharp, -1.5, 0, smartRgb);
        smartSharp.delete();

        let smartHsv = new cv.Mat();
        cv.cvtColor(smartRgb, smartHsv, cv.COLOR_RGB2HSV);
        let smartHsvPlanes = new cv.MatVector();
        cv.split(smartHsv, smartHsvPlanes);

        // 1. Boost Saturation
        let smartS = smartHsvPlanes.get(1);
        smartS.convertTo(smartS, -1, 1.5, 0);
        cv.threshold(smartS, smartS, 70, 255, cv.THRESH_TOZERO);
        smartHsvPlanes.set(1, smartS);
        smartS.delete();

        // 2. Linear Contrast Stretch on Brightness to make faint text perfectly black
        let smartV = smartHsvPlanes.get(2);
        smartV.convertTo(smartV, -1, 1.5, -120);
        smartHsvPlanes.set(2, smartV);
        smartV.delete();

        cv.merge(smartHsvPlanes, smartHsv);
        cv.cvtColor(smartHsv, smartRgb, cv.COLOR_HSV2RGB);
        smartHsvPlanes.delete();
        smartHsv.delete();

        let finalSmartRgba = new cv.Mat();
        cv.cvtColor(smartRgb, finalSmartRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalSmartRgba);
        const smartColorUrl = compressCanvas(canvas, 0.85);

        let hybridUrl = undefined;
        if (hybridMask) {
            let maskRgba = new cv.Mat();
            cv.cvtColor(hybridMask, maskRgba, cv.COLOR_GRAY2RGBA);
            
            let maskFloat = new cv.Mat();
            maskRgba.convertTo(maskFloat, cv.CV_32F, 1.0 / 255.0);
            
            let pureFloat = new cv.Mat();
            finalPureRgba.convertTo(pureFloat, cv.CV_32F);
            
            let smartFloat = new cv.Mat();
            finalSmartRgba.convertTo(smartFloat, cv.CV_32F);
            
            let oneMinusMask = new cv.Mat();
            let scalar1 = new cv.Mat(maskFloat.rows, maskFloat.cols, maskFloat.type(), new cv.Scalar(1.0, 1.0, 1.0, 1.0));
            cv.subtract(scalar1, maskFloat, oneMinusMask);
            
            let term1 = new cv.Mat();
            cv.multiply(pureFloat, maskFloat, term1);
            
            let term2 = new cv.Mat();
            cv.multiply(smartFloat, oneMinusMask, term2);
            
            let hybridFloat = new cv.Mat();
            cv.add(term1, term2, hybridFloat);
            
            let finalHybrid = new cv.Mat();
            hybridFloat.convertTo(finalHybrid, cv.CV_8U);
            
            cv.imshow(canvas, finalHybrid);
            hybridUrl = compressCanvas(canvas);
            
            maskRgba.delete(); maskFloat.delete(); pureFloat.delete(); smartFloat.delete();
            oneMinusMask.delete(); scalar1.delete(); term1.delete(); term2.delete(); hybridFloat.delete(); finalHybrid.delete();
            hybridMask.delete();
        }

        photoRgb.delete(); finalPureRgba.delete();
        smartRgb.delete(); smartGray.delete(); smartBg.delete(); finalSmartRgba.delete();

        // Cleanup General and Pure objects
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); sharpened.delete(); bw.delete(); 
        darkMask.delete(); blackMat.delete(); bwRgba.delete();
        
        // Legacy pure objects were replaced by photo objects and already cleaned up.
        resolve({ 
          cropped: croppedUrl, 
          bw: bwUrl, 
          pureColor: pureColorUrl,
          smartColor: smartColorUrl,
          hybridColor: hybridUrl,
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
