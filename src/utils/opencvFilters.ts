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
        
        // --- B&W Enhancement (Ultimate CamScanner Retinex Engine) ---
        // We use MORPH_CLOSE on a downscaled image to perfectly erase text and estimate background illumination (shadows).
        // MORPH_CLOSE mathematically guarantees erasure of dark objects, unlike medianBlur which fails on thick text!
        
        let small = new cv.Mat();
        cv.resize(sharpened, small, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);
        
        let bgSmall = new cv.Mat();
        let bgKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(21, 21)); // 21px on 0.1 scale = 210px in original!
        cv.morphologyEx(small, bgSmall, cv.MORPH_CLOSE, bgKernel);
        cv.GaussianBlur(bgSmall, bgSmall, new cv.Size(5, 5), 0, 0); // Fast smooth on downscaled image!
        bgKernel.delete();
        small.delete();
        
        let bg = new cv.Mat();
        cv.resize(bgSmall, bg, new cv.Size(sharpened.cols, sharpened.rows), 0, 0, cv.INTER_CUBIC);
        bgSmall.delete();
        
        let flatGray = new cv.Mat();
        cv.divide(sharpened, bg, flatGray, 255, -1);
        bg.delete();
        
        // Now that the lighting is mathematically perfectly flat (shadows are GONE),
        // we can use a very standard, robust Adaptive Threshold without fear of shadow blobs!
        cv.adaptiveThreshold(flatGray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 15);
        flatGray.delete();
        
        // Clean up tiny 1px pepper noise (compression artifacts) in the flat white paper
        let noiseKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        cv.morphologyEx(bw, bw, cv.MORPH_CLOSE, noiseKernel);
        noiseKernel.delete();
        
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
        
        // 1. Identify Colorful regions (Saturation > 65, prevents shadows/noise from being detected as logos!)
        let colorMask = new cv.Mat();
        cv.threshold(sCheck, colorMask, 65, 255, cv.THRESH_BINARY);
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
        
        // --- Photo Mode (Raw Original Camera Image) ---
        // The user asked "Why doesn't it just take what it sees?". We remove all artificial OpenCV boosts.
        // Modern smartphones natively apply massive HDR, sharpening, and color correction.
        // Applying our own HSV boosts on top of that creates unnatural tints (like turning gray shadows blue).
        let photoRgb = new cv.Mat();
        cv.cvtColor(dst, photoRgb, cv.COLOR_RGBA2RGB);

        let finalPureRgba = new cv.Mat();
        cv.cvtColor(photoRgb, finalPureRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalPureRgba);
        const pureColorUrl = compressCanvas(canvas, 0.85);
        
        // Do not delete photoRgb and finalPureRgba yet, we need them for hybrid

        // --- Smart Color (v12.5 Ultimate Masked Color Engine - CamScanner Style) ---
        // We use the flawless B&W mask to perfectly isolate text from the paper.
        // Pure paper is forced to [255, 255, 255] (zero noise, zero shadows).
        // Text keeps its original raw camera color, but is gently darkened/sharpened to pop.
        let smartRgb = new cv.Mat();
        cv.cvtColor(dst, smartRgb, cv.COLOR_RGBA2RGB);

        // 1. Unsharp Mask the original image to make text edges crisp
        let smartSharp = new cv.Mat();
        cv.GaussianBlur(smartRgb, smartSharp, new cv.Size(0, 0), 1.0);
        cv.addWeighted(smartRgb, 2.0, smartSharp, -1.0, 0, smartSharp);

        // 2. Anti-alias the flawless B&W mask so text edges are smooth, not jagged.
        let smoothMask = new cv.Mat();
        cv.GaussianBlur(bw, smoothMask, new cv.Size(3, 3), 0, 0);

        let smartData = smartSharp.data;
        let maskData = smoothMask.data;
        let numPixels = smartSharp.rows * smartSharp.cols;

        for (let i = 0; i < numPixels; i++) {
            let maskVal = maskData[i];
            
            if (maskVal === 255) {
                // Fast Path: Pure paper -> Pure Brilliant White
                smartData[i * 3] = 255;
                smartData[i * 3 + 1] = 255;
                smartData[i * 3 + 2] = 255;
            } else {
                let alphaPaper = maskVal / 255.0; // 1.0 for paper, 0.0 for core text
                let alphaText = 1.0 - alphaPaper; // 0.0 for paper, 1.0 for core text
                
                // Keep original vivid color, just darken it slightly (subtract 40) so it's bold like fresh ink.
                let r = Math.max(0, smartData[i * 3] - 40);
                let g = Math.max(0, smartData[i * 3 + 1] - 40);
                let b = Math.max(0, smartData[i * 3 + 2] - 40);
                
                // Blend perfectly between the vivid dark ink and the pure white paper
                smartData[i * 3] = r * alphaText + 255 * alphaPaper;
                smartData[i * 3 + 1] = g * alphaText + 255 * alphaPaper;
                smartData[i * 3 + 2] = b * alphaText + 255 * alphaPaper;
            }
        }
        
        smoothMask.delete();
        smartRgb.delete();

        let finalSmartRgba = new cv.Mat();
        cv.cvtColor(smartSharp, finalSmartRgba, cv.COLOR_RGB2RGBA);
        smartSharp.delete();

        cv.imshow(canvas, finalSmartRgba);
        const smartColorUrl = compressCanvas(canvas, 0.85);

        // --- Smart Plus (v17.0 Pure CamScanner Magic Color) ---
        // Completely independent of the B&W mask! Uses direct HSV manipulation.
        let plusRgb = new cv.Mat();
        cv.cvtColor(dst, plusRgb, cv.COLOR_RGBA2RGB);

        // Enhance edges gently
        let plusSharp = new cv.Mat();
        cv.GaussianBlur(plusRgb, plusSharp, new cv.Size(0, 0), 1.0);
        cv.addWeighted(plusRgb, 2.0, plusSharp, -1.0, 0, plusRgb);
        plusSharp.delete();
        
        let plusHsv = new cv.Mat();
        cv.cvtColor(plusRgb, plusHsv, cv.COLOR_RGB2HSV);
        let plusHsvPlanes = new cv.MatVector();
        cv.split(plusHsv, plusHsvPlanes);

        let plusH = plusHsvPlanes.get(0);
        let plusS = plusHsvPlanes.get(1);
        let plusV = plusHsvPlanes.get(2);

        // 1. Create a flawless binary mask of the text (ignores shadows completely)
        let grayForMask = new cv.Mat();
        cv.cvtColor(plusRgb, grayForMask, cv.COLOR_RGB2GRAY);
        cv.GaussianBlur(grayForMask, grayForMask, new cv.Size(3, 3), 0, 0);
        
        let mask = new cv.Mat();
        cv.adaptiveThreshold(grayForMask, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 61, 15);
        grayForMask.delete();
        cv.GaussianBlur(mask, mask, new cv.Size(3, 3), 0, 0);

        // 2. RGB Retinex Flattening (Restores TRUE colors under colored shadows!)
        let smallRgb = new cv.Mat();
        cv.resize(plusRgb, smallRgb, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);
        
        // Inpaint colorful logos so they don't become part of the background illumination map!
        // This prevents Retinex from erasing the logo, and eliminates gray halos around it.
        let binaryHybrid = new cv.Mat();
        cv.threshold(hybridMask, binaryHybrid, 50, 255, cv.THRESH_BINARY);
        let smallLogoMask = new cv.Mat();
        cv.resize(binaryHybrid, smallLogoMask, new cv.Size(smallRgb.cols, smallRgb.rows), 0, 0, cv.INTER_NEAREST);
        binaryHybrid.delete();
        
        let inpaintedSmallRgb = new cv.Mat();
        if (colorfulRatio < 0.4 && cv.countNonZero(smallLogoMask) > 0) {
            cv.inpaint(smallRgb, smallLogoMask, inpaintedSmallRgb, 3, cv.INPAINT_TELEA);
        } else {
            smallRgb.copyTo(inpaintedSmallRgb);
        }
        smallLogoMask.delete();
        smallRgb.delete();
        
        let bgSmall2 = new cv.Mat();
        cv.medianBlur(inpaintedSmallRgb, bgSmall2, 15); // Erases text, keeps shadows (logos are inpainted out so they are protected!)
        inpaintedSmallRgb.delete();
        cv.GaussianBlur(bgSmall2, bgSmall2, new cv.Size(3, 3), 0, 0); // Fast smooth on downscaled image!
        
        let bgRgb = new cv.Mat();
        cv.resize(bgSmall2, bgRgb, new cv.Size(plusRgb.cols, plusRgb.rows), 0, 0, cv.INTER_CUBIC);
        bgSmall2.delete();
        
        let flatRgb = new cv.Mat();
        let planesRgb = new cv.MatVector();
        cv.split(plusRgb, planesRgb);
        let planesBg = new cv.MatVector();
        cv.split(bgRgb, planesBg);
        
        // Divide channel by channel to physically neutralize the shadow's ambient light
        for (let i = 0; i < 3; i++) {
            let p = planesRgb.get(i);
            let bgP = planesBg.get(i);
            cv.divide(p, bgP, p, 255, -1);
            planesRgb.set(i, p);
            p.delete(); bgP.delete();
        }
        cv.merge(planesRgb, flatRgb);
        planesRgb.delete(); planesBg.delete(); bgRgb.delete();

        // 3. Create the Vivid Ink layer using the color-restored image!
        let flatHsv = new cv.Mat();
        cv.cvtColor(flatRgb, flatHsv, cv.COLOR_RGB2HSV);
        let planes = new cv.MatVector();
        cv.split(flatHsv, planes);
        
        // 2.5x Saturation for popping ink colors
        let S = planes.get(1);
        S.convertTo(S, -1, 2.5, 0);
        planes.set(1, S);
        S.delete();
        
        // Darken the flattened ink to make it bold
        let V = planes.get(2);
        let VCurve = new cv.Mat();
        V.convertTo(VCurve, -1, 1.2, -40); 
        planes.set(2, VCurve);
        V.delete(); VCurve.delete();
        
        cv.merge(planes, flatHsv);
        let boostedRgb = new cv.Mat();
        cv.cvtColor(flatHsv, boostedRgb, cv.COLOR_HSV2RGB);
        flatHsv.delete(); planes.delete(); flatRgb.delete();

        // 4. Alpha Blending: Vivid Ink (where mask=255) + Pure White Paper (where mask=0)
        let combinedMask = new cv.Mat();
        if (colorfulRatio < 0.4) {
            let hardHybrid = new cv.Mat();
            cv.threshold(hybridMask, hardHybrid, 10, 255, cv.THRESH_BINARY);
            cv.bitwise_or(mask, hardHybrid, combinedMask);
            hardHybrid.delete();
        } else {
            mask.copyTo(combinedMask);
        }
        
        let maskFloat = new cv.Mat();
        combinedMask.convertTo(maskFloat, cv.CV_32F, 1.0 / 255.0);
        mask.delete();
        combinedMask.delete();
        
        let mask3 = new cv.Mat();
        cv.cvtColor(maskFloat, mask3, cv.COLOR_GRAY2RGB);
        maskFloat.delete();
        
        let invMask3 = new cv.Mat();
        let scalar1 = new cv.Mat(mask3.rows, mask3.cols, mask3.type(), new cv.Scalar(1.0, 1.0, 1.0));
        cv.subtract(scalar1, mask3, invMask3);
        scalar1.delete();
        
        let boostedFloat = new cv.Mat();
        boostedRgb.convertTo(boostedFloat, cv.CV_32FC3);
        boostedRgb.delete();
        
        let whiteRgb = new cv.Mat(plusRgb.rows, plusRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
        let whiteFloat = new cv.Mat();
        whiteRgb.convertTo(whiteFloat, cv.CV_32FC3);
        whiteRgb.delete();
        
        let term1 = new cv.Mat();
        cv.multiply(boostedFloat, mask3, term1);
        boostedFloat.delete();
        
        let term2 = new cv.Mat();
        cv.multiply(whiteFloat, invMask3, term2);
        whiteFloat.delete(); invMask3.delete(); mask3.delete();
        
        let finalFloat = new cv.Mat();
        cv.add(term1, term2, finalFloat);
        term1.delete(); term2.delete();
        
        let finalSmartPlusRgb = new cv.Mat();
        finalFloat.convertTo(finalSmartPlusRgb, cv.CV_8UC3);
        finalFloat.delete();

        let finalSmartPlusRgba = new cv.Mat();
        cv.cvtColor(finalSmartPlusRgb, finalSmartPlusRgba, cv.COLOR_RGB2RGBA);
        finalSmartPlusRgb.delete();
        plusRgb.delete();

        cv.imshow(canvas, finalSmartPlusRgba);
        const smartPlusUrl = compressCanvas(canvas, 0.85);

        // --- Hybrid Color ---
        let hybridUrl = undefined;
        if (hybridMask) {
            let maskRgba = new cv.Mat();
            cv.cvtColor(hybridMask, maskRgba, cv.COLOR_GRAY2RGBA);
            
            let maskFloat = new cv.Mat();
            maskRgba.convertTo(maskFloat, cv.CV_32F, 1.0 / 255.0);
            
            let pureFloat = new cv.Mat();
            finalPureRgba.convertTo(pureFloat, cv.CV_32F);
            
            let smartFloat = new cv.Mat();
            // In hybrid mode, use Smart Plus instead of Smart Color to compare
            finalSmartPlusRgba.convertTo(smartFloat, cv.CV_32F);
            
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
        finalSmartRgba.delete(); finalSmartPlusRgba.delete();

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
          smartPlus: smartPlusUrl,
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
