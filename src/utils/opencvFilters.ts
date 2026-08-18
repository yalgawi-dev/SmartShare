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

export function applyPerspectiveAndFilters(snapshot: string, pts: Point[]): Promise<{ cropped: string, bw: string, color: string }> {
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

        let finalColorRgba = new cv.Mat();
        cv.cvtColor(photoRgb, finalColorRgba, cv.COLOR_RGB2RGBA);

        cv.imshow(canvas, finalColorRgba);
        const colorUrl = compressCanvas(canvas);
        
        photoRgb.delete(); finalColorRgba.delete();

        // Cleanup General objects
        src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
        gray.delete(); blurred.delete(); sharpened.delete(); bw.delete(); 
        darkMask.delete(); blackMat.delete(); bwRgba.delete();
        
        resolve({ 
          cropped: croppedUrl, 
          bw: bwUrl, 
          color: colorUrl
        });

      } catch (err) {
        console.error("OpenCV processing failed", err);
        reject(err);
      }
    };
    img.onerror = reject;
  });
}
