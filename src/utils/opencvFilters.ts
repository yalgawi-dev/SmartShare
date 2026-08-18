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
export function applyPerspectiveAndFilters(snapshot: string, pts: Point[], options: ScannerOptions = {}): Promise<{ cropped: string, bw: string, pureColor: string, smartColor: string, hybridColor?: string, appliedOptions?: ScannerOptions, detectedType?: 'text' | 'photo' | 'mixed' }> {
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
        
        let isPhoto = blackRatio > 0.30;
        let isMixed = false;
        let hybridMask: any = null;
        
        if (!isPhoto) {
            let hsvCheck = new cv.Mat();
            let rgbCheck = new cv.Mat();
            cv.cvtColor(dst, rgbCheck, cv.COLOR_RGBA2RGB);
            cv.cvtColor(rgbCheck, hsvCheck, cv.COLOR_RGB2HSV);
            let hsvPlanesCheck = new cv.MatVector();
            cv.split(hsvCheck, hsvPlanesCheck);
            let sCheck = hsvPlanesCheck.get(1);
            let vCheck = hsvPlanesCheck.get(2);
            
            let colorMask = new cv.Mat();
            cv.threshold(sCheck, colorMask, 35, 255, cv.THRESH_BINARY);
            
            let notPaperMask = new cv.Mat();
            cv.threshold(vCheck, notPaperMask, 210, 255, cv.THRESH_BINARY_INV);
            
            let targetMask = new cv.Mat();
            cv.bitwise_and(colorMask, notPaperMask, targetMask);
            
            let openedMask = new cv.Mat();
            let openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(15, 15));
            cv.morphologyEx(targetMask, openedMask, cv.MORPH_OPEN, openKernel);
            
            let colorfulPixels = cv.countNonZero(openedMask);
            let colorfulRatio = colorfulPixels / totalPixels;
            
            if (colorfulRatio > 0.15) {
                isPhoto = true;
            } else if (colorfulRatio > 0.005) {
                isMixed = true;
                hybridMask = new cv.Mat();
                let dilateKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(9, 9));
                cv.dilate(openedMask, hybridMask, dilateKernel, new cv.Point(-1, -1), 1);
                cv.GaussianBlur(hybridMask, hybridMask, new cv.Size(15, 15), 0, 0);
                dilateKernel.delete();
            }
            vCheck.delete(); colorMask.delete(); notPaperMask.delete(); targetMask.delete(); openedMask.delete(); openKernel.delete();
            hsvCheck.delete(); rgbCheck.delete(); hsvPlanesCheck.delete(); sCheck.delete();
        }
        
        let detectedType: 'text' | 'photo' | 'mixed' = isPhoto ? 'photo' : (isMixed ? 'mixed' : 'text');
        let blackMat = new cv.Mat(bw.rows, bw.cols, bw.type(), new cv.Scalar(0));
        blackMat.copyTo(bw, darkMask);
        
        let bwRgba = new cv.Mat();
        cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        cv.imshow(canvas, bwRgba);
        const bwUrl = compressCanvas(canvas);
        
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
        // Gentle contrast and brightness boost for photos (preserves shadows and natural lighting)
        photoV.convertTo(photoV, -1, 1.05, 5);
        photoHsvPlanes.set(2, photoV);
        photoV.delete();

        let photoS = photoHsvPlanes.get(1);
        // Gentle saturation boost to make colors pop naturally (do NOT threshold/zero out subtle colors)
        photoS.convertTo(photoS, -1, 1.2, 5);
        photoHsvPlanes.set(1, photoS);
        photoS.delete();

        cv.merge(photoHsvPlanes, photoHsv);
        cv.cvtColor(photoHsv, photoRgb, cv.COLOR_HSV2RGB);
        photoHsvPlanes.delete();
        photoHsv.delete();

        // 3. Crystal Clear Glass Effect
        let smoothed = new cv.Mat();
        // Bilateral filter smooths flat colors/noise while perfectly preserving edges
        cv.bilateralFilter(photoRgb, smoothed, 5, 50, 50, cv.BORDER_DEFAULT);

        let photoSharp = new cv.Mat();
        cv.GaussianBlur(smoothed, photoSharp, new cv.Size(0, 0), 2.0);
        // Stronger Unsharp Mask applied to the noise-free image creates a glossy/glass look
        cv.addWeighted(smoothed, 2.5, photoSharp, -1.5, 0, photoRgb);
        
        smoothed.delete();
        photoSharp.delete();

        let finalPureRgba = new cv.Mat();
        cv.cvtColor(photoRgb, finalPureRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalPureRgba);
        const pureColorUrl = compressCanvas(canvas);
        
        // Do not delete photoRgb and finalPureRgba yet, we need them for hybrid

        // --- Smart Color (v11.0 Retinex Illumination Division Engine - Restored for Invoices) ---
        // Perfect for text and invoices.
        let smartRgb = new cv.Mat();
        cv.cvtColor(dst, smartRgb, cv.COLOR_RGBA2RGB);

        let smartGray = new cv.Mat();
        cv.cvtColor(smartRgb, smartGray, cv.COLOR_RGB2GRAY);

        let smartDownscaled = new cv.Mat();
        cv.resize(smartGray, smartDownscaled, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);

        let smartKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.morphologyEx(smartDownscaled, smartDownscaled, cv.MORPH_CLOSE, smartKernel);
        smartKernel.delete();

        cv.GaussianBlur(smartDownscaled, smartDownscaled, new cv.Size(5, 5), 0, 0);

        let smartBg = new cv.Mat();
        cv.resize(smartDownscaled, smartBg, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_CUBIC);
        smartDownscaled.delete();

        let smartRgbPlanes = new cv.MatVector();
        cv.split(smartRgb, smartRgbPlanes);

        for (let i = 0; i < 3; i++) {
            let channel = smartRgbPlanes.get(i);
            cv.divide(channel, smartBg, channel, 255, -1);
            smartRgbPlanes.set(i, channel);
            channel.delete();
        }
        cv.merge(smartRgbPlanes, smartRgb);
        smartRgbPlanes.delete();

        let smartSharp = new cv.Mat();
        cv.GaussianBlur(smartRgb, smartSharp, new cv.Size(0, 0), 2.0);
        cv.addWeighted(smartRgb, 2.0, smartSharp, -1.0, 0, smartRgb);
        smartSharp.delete();

        let smartHsv = new cv.Mat();
        cv.cvtColor(smartRgb, smartHsv, cv.COLOR_RGB2HSV);
        let smartHsvPlanes = new cv.MatVector();
        cv.split(smartHsv, smartHsvPlanes);

        let smartS = smartHsvPlanes.get(1);
        smartS.convertTo(smartS, -1, 1.8, 0);
        // THRESH_TOZERO increased to 40 to eliminate the reddish stain from the shadow
        cv.threshold(smartS, smartS, 40, 255, cv.THRESH_TOZERO);

        smartHsvPlanes.set(1, smartS);
        cv.merge(smartHsvPlanes, smartHsv);
        cv.cvtColor(smartHsv, smartRgb, cv.COLOR_HSV2RGB);
        smartHsvPlanes.delete();
        smartS.delete();

        let finalSmartRgba = new cv.Mat();
        cv.cvtColor(smartRgb, finalSmartRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalSmartRgba);
        const smartColorUrl = compressCanvas(canvas);

        let hybridUrl = undefined;
        if (isMixed && hybridMask) {
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
        smartRgb.delete(); smartGray.delete(); smartBg.delete(); smartHsv.delete(); finalSmartRgba.delete();
        

        // Cleanup General and Pure objects
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); blurred.delete(); sharpened.delete(); bw.delete(); 
        darkMask.delete(); blackMat.delete(); bwRgba.delete();
        
        // Legacy pure objects were replaced by photo objects and already cleaned up.
        resolve({ 
          cropped: croppedUrl, 
          bw: bwUrl, 
          pureColor: pureColorUrl,
          smartColor: smartColorUrl,
          hybridColor: hybridUrl,
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
            bgBlurSize: options.bgBlurSize,
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
