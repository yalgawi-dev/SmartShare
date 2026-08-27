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
export function applyPerspectiveAndFilters(snapshot: string, pts: Point[], forcedProfile: 'auto' | 'text' | 'photo' = 'auto'): Promise<{ cropped: string, bw: string, pureColor: string, smartColor: string, smartPlus?: string, hybridColor?: string, detectedType?: 'text_bw' | 'text_color' | 'photo' | 'mixed' }> {
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
        
        // --- OPTIMIZATION: Cap Processing Resolution ---
        // 12 Megapixel captures cause a 5-second UI freeze and huge base64 API payloads.
        // Capping to 1500px cuts OpenCV processing time to < 1s and API upload time by 90%!
        const MAX_DIM = 1500;
        if (dst.cols > MAX_DIM || dst.rows > MAX_DIM) {
            const scale = MAX_DIM / Math.max(dst.cols, dst.rows);
            const newW = Math.round(dst.cols * scale);
            const newH = Math.round(dst.rows * scale);
            cv.resize(dst, dst, new cv.Size(newW, newH), 0, 0, cv.INTER_AREA);
            canvas.width = newW;
            canvas.height = newH;
        } else {
            canvas.width = dst.cols;
            canvas.height = dst.rows;
        }
        
        cv.imshow(canvas, dst);
        const croppedUrl = compressCanvas(canvas);

        // --- B&W Enhancement (Sauvola Adaptive Thresholding for Thermal Receipts) ---
        let gray = new cv.Mat();
        cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
        
        // --- B&W Enhancement (Ultimate CamScanner Retinex Engine) ---
        // We use MORPH_CLOSE on a downscaled image to perfectly erase text and estimate background illumination (shadows).
        
        let small = new cv.Mat();
        cv.resize(gray, small, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);
        
        let bgSmall = new cv.Mat();
        let bgKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(21, 21)); // 21px on 0.1 scale = 210px in original!
        cv.morphologyEx(small, bgSmall, cv.MORPH_CLOSE, bgKernel);
        cv.GaussianBlur(bgSmall, bgSmall, new cv.Size(5, 5), 0, 0); // Fast smooth on downscaled image!
        bgKernel.delete();
        small.delete();
        
        let bg = new cv.Mat();
        cv.resize(bgSmall, bg, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_CUBIC);
        bgSmall.delete();
        
        let flatGray = new cv.Mat();
        cv.divide(gray, bg, flatGray, 255, -1);
        bg.delete();
        
        // 1. Sharpening AFTER flattening: crucial for blurry dot-matrix thermal receipts
        let blurred = new cv.Mat();
        cv.GaussianBlur(flatGray, blurred, new cv.Size(0, 0), 2);
        let sharpened = new cv.Mat();
        cv.addWeighted(flatGray, 2.0, blurred, -1.0, 0, sharpened);
        blurred.delete(); flatGray.delete();
        
        let bw = new cv.Mat();
        bw.create(sharpened.rows, sharpened.cols, cv.CV_8UC1);
        
        // Now that the lighting is mathematically perfectly flat (shadows are GONE),
        // we can use a robust Adaptive Threshold! 
        // Block size 61 perfectly ignores soft smudges (21 was too sensitive and caught them!)
        cv.adaptiveThreshold(sharpened, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 61, 15);
        sharpened.delete();
        
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
        
        // 1. Identify Colorful regions 
        // We lowered Saturation threshold from 40 to 20 to catch extreme pastel colors (faint light blue/yellow/hair edge).
        let colorMask = new cv.Mat();
        cv.threshold(sCheck, colorMask, 20, 255, cv.THRESH_BINARY);
        
        // Exclude only absolute blinding white (V > 250)
        let notPaperMask = new cv.Mat();
        cv.threshold(vCheck, notPaperMask, 250, 255, cv.THRESH_BINARY_INV); 
        
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
        
        // --- CONVEX HULL CLUSTERING (Document Layout Analysis) ---
        // 1. Group nearby colors so a fragmented drawing becomes one connected blob.
        // Increased from 25 to 31 to bridge wider white gaps (like glare on the edge of the head).
        let groupKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(31, 31));
        cv.morphologyEx(smallMask, smallMask, cv.MORPH_CLOSE, groupKernel);
        
        // 2. Find the outer boundaries of these color blobs
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(smallMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        // 3. Hybrid Layout Analysis (Decision Mechanism: Straight Box vs. Contour)
        let hullMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
        
        // Prepare text mask for collision detection (bw has text as black/0, so we invert it)
        let smallTextMask = new cv.Mat();
        cv.resize(bw, smallTextMask, new cv.Size(smallMask.cols, smallMask.rows), 0, 0, cv.INTER_NEAREST);
        cv.bitwise_not(smallTextMask, smallTextMask); 
        
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            // Filter out tiny noise
            if (area > 20) {
                // Option B: Contour (curvy, exact)
                let contourMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
                let cntVector = new cv.MatVector();
                cntVector.push_back(cnt);
                cv.drawContours(contourMask, cntVector, 0, new cv.Scalar(255), -1);
                
                // Option A: Bounding Box (straight lines, protects peninsulas)
                let rect = cv.boundingRect(cnt);
                let boxMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
                let point1 = new cv.Point(rect.x, rect.y);
                let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
                cv.rectangle(boxMask, point1, point2, new cv.Scalar(255), -1);
                
                // Diff: The "Disputed Territory" (space inside Box but outside Contour)
                let diffMask = new cv.Mat();
                cv.bitwise_xor(boxMask, contourMask, diffMask);
                
                // Scan for text in the Disputed Territory
                let collisionMask = new cv.Mat();
                cv.bitwise_and(diffMask, smallTextMask, collisionMask);
                let textPixels = cv.countNonZero(collisionMask);
                let diffPixels = cv.countNonZero(diffMask);
                
                // If text density > 3%, it's wrapping text! Use Contour to save text. Else use Box to save peninsulas!
                let textDensity = diffPixels > 0 ? (textPixels / diffPixels) : 0;
                if (textDensity > 0.03) {
                    cv.bitwise_or(hullMask, contourMask, hullMask);
                } else {
                    cv.bitwise_or(hullMask, boxMask, hullMask);
                }
                
                contourMask.delete();
                boxMask.delete();
                diffMask.delete();
                collisionMask.delete();
                cntVector.delete();
            }
            cnt.delete();
        }
        smallTextMask.delete();
        
        // 4. Safety Margin: Expand the contour outward to capture colorless peninsulas (like the broom/hair).
        // Reverted to 9x9 per user request.
        let dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
        cv.dilate(hullMask, hullMask, dilateKernel, new cv.Point(-1, -1), 1);
        cv.GaussianBlur(hullMask, hullMask, new cv.Size(15, 15), 0, 0);
        
        cv.resize(hullMask, hybridMask, new cv.Size(openedMask.cols, openedMask.rows), 0, 0, cv.INTER_LINEAR);
        
        hullMask.delete();
        contours.delete();
        hierarchy.delete();
        groupKernel.delete();
        smallMask.delete();
        cleanKernel.delete();
        dilateKernel.delete();

        // Auto-Detect Logic to determine default mode
        let detectedType: 'text_bw' | 'text_color' | 'photo' | 'mixed' = 'text_color';
        
        let aspectRatio = Math.max(dst.cols / dst.rows, dst.rows / dst.cols);
        
        if (colorfulRatio > 0.15 || blackRatio > 0.40) {
            // Massive color or massive dark texture -> Pure Photo
            detectedType = 'photo';
        } else if (colorfulRatio > 0.03) {
            // Moderate color
            if (paperRatio > 0.05) {
                // There is also bright paper -> Mixed / Collage
                detectedType = 'mixed';
            } else {
                // No paper -> Photo
                detectedType = 'photo';
            }
        } else if (colorfulRatio <= 0.005 && aspectRatio > 1.7) {
            // Zero color AND extreme aspect ratio (long/narrow) -> Thermal Receipt
            detectedType = 'text_bw';
        } else {
            // Very little color, OR it's a standard A4 shape with no color -> SmartPlus (best shadow removal)
            detectedType = 'text_color';
        }

        vCheck.delete(); colorMask.delete(); notPaperMask.delete(); targetMask.delete(); openedMask.delete(); openKernel.delete();
        hsvCheck.delete(); rgbCheck.delete(); hsvPlanesCheck.delete(); sCheck.delete();
        brightMask.delete(); nonColorMask.delete(); paperMask.delete();
        
        let blackMat = new cv.Mat(bw.rows, bw.cols, bw.type(), new cv.Scalar(0));
        blackMat.copyTo(bw, darkMask);
        
        let bwRgba = new cv.Mat();
        cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        cv.imshow(canvas, bwRgba);
        const bwUrl = compressCanvas(canvas, 0.85);
        
        // --- Photo Mode (Professional Photo Enhancement) ---
        let photoRgb = new cv.Mat();
        cv.cvtColor(dst, photoRgb, cv.COLOR_RGBA2RGB);

        // 1. Saturation Boost (Make colors pop, countering faded prints)
        let photoHsv = new cv.Mat();
        cv.cvtColor(photoRgb, photoHsv, cv.COLOR_RGB2HSV);
        let photoHsvPlanes = new cv.MatVector();
        cv.split(photoHsv, photoHsvPlanes);
        let satChannel = photoHsvPlanes.get(1);
        
        // Increase saturation by 35% (was 15%)
        satChannel.convertTo(satChannel, -1, 1.35, 0);
        photoHsvPlanes.set(1, satChannel);
        cv.merge(photoHsvPlanes, photoHsv);
        
        let popRgb = new cv.Mat();
        cv.cvtColor(photoHsv, popRgb, cv.COLOR_HSV2RGB);

        // 2. Pro Contrast & Brightness Boost (Simulate professional scan lighting)
        // alpha = 1.15 (15% contrast increase), beta = 10 (brightness bump)
        popRgb.convertTo(popRgb, -1, 1.15, 10);

        // 3. Strong Unsharp Mask (Fix macro-lens blur from smartphones)
        let blurredPhoto = new cv.Mat();
        // Larger radius (3.0) for deeper depth, stronger weight (1.6 / -0.6)
        cv.GaussianBlur(popRgb, blurredPhoto, new cv.Size(0, 0), 3.0);
        let finalPhotoRgb = new cv.Mat();
        cv.addWeighted(popRgb, 1.6, blurredPhoto, -0.6, 0, finalPhotoRgb);

        let finalPureRgba = new cv.Mat();
        cv.cvtColor(finalPhotoRgb, finalPureRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalPureRgba);
        const pureColorUrl = compressCanvas(canvas, 0.85);

        // Cleanup Photo resources
        photoHsv.delete(); photoHsvPlanes.delete(); satChannel.delete(); 
        popRgb.delete(); blurredPhoto.delete(); finalPhotoRgb.delete();
        
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

        // Enhance edges gently (Removed Unsharp Mask because it amplifies JPG chroma noise into rainbow dots!)
        
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
        // Apply Unsharp Mask to the flattened image to thicken and darken text while strictly preserving colors!
        let blurredFlat = new cv.Mat();
        cv.GaussianBlur(flatRgb, blurredFlat, new cv.Size(0, 0), 2.0);
        cv.addWeighted(flatRgb, 1.8, blurredFlat, -0.8, 0, flatRgb);
        blurredFlat.delete();

        let flatHsv = new cv.Mat();
        cv.cvtColor(flatRgb, flatHsv, cv.COLOR_RGB2HSV);
        let planes = new cv.MatVector();
        cv.split(flatHsv, planes);
        
        // 1.25x Saturation for popping ink colors
        let S = planes.get(1);
        S.convertTo(S, -1, 1.25, 0);
        planes.set(1, S);
        S.delete();
        
        // Darken the flattened ink slightly (-20) so black text is strong, but blue ink stays blue!
        let V = planes.get(2);
        let VCurve = new cv.Mat();
        V.convertTo(VCurve, -1, 1.1, -20); 
        planes.set(2, VCurve);
        V.delete(); VCurve.delete();
        
        cv.merge(planes, flatHsv);
        let boostedRgb = new cv.Mat();
        cv.cvtColor(flatHsv, boostedRgb, cv.COLOR_HSV2RGB);
        flatHsv.delete(); planes.delete(); flatRgb.delete();

        // Thicken the text mask slightly so the text doesn't look thin and "blinding"
        let maskDilateKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
        cv.dilate(mask, mask, maskDilateKernel);
        maskDilateKernel.delete();

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

        // --- Hybrid Color (Restored Masked Blending) ---
        // Uses the powerful hybridMask to perfectly blend the pure Photo engine (for drawings) 
        // with the flawless SmartPlus engine (for text and white paper)!
        let hybridUrl = undefined;
        if (hybridMask) {
            let maskRgba = new cv.Mat();
            cv.cvtColor(hybridMask, maskRgba, cv.COLOR_GRAY2RGBA);
            
            let maskFloat = new cv.Mat();
            maskRgba.convertTo(maskFloat, cv.CV_32F, 1.0 / 255.0);
            
            let pureFloat = new cv.Mat();
            finalPureRgba.convertTo(pureFloat, cv.CV_32F);
            
            let smartFloat = new cv.Mat();
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
            hybridUrl = compressCanvas(canvas, 0.85);
            
            maskRgba.delete(); maskFloat.delete(); pureFloat.delete(); smartFloat.delete();
            oneMinusMask.delete(); scalar1.delete(); term1.delete(); term2.delete(); hybridFloat.delete(); finalHybrid.delete();
            hybridMask.delete();
        }

        photoRgb.delete(); finalPureRgba.delete();
        finalSmartRgba.delete(); finalSmartPlusRgba.delete();

        // Cleanup General and Pure objects
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); bw.delete(); 
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
