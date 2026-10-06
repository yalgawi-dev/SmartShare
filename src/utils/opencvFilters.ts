/* eslint-disable */
// @ts-nocheck
import { compressCanvas } from './imageOptimizer';

export interface Point {
  x: number;
  y: number;
}



/**
 * Attempts to auto-detect a document contour in the given canvas.
 * v17.7 Engine: Boundary Line Gradient Alignment + Paper Luminance Uniformity 
 * + Header/Footer Protection + Multi-Pass Canny/Otsu/HSV + Universal 4-Corner Snapping.
 * Returns an array of 4 ordered points (TL, TR, BR, BL) if found, otherwise returns null.
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
    if (!tempCtx) return null;
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

    let src = cv.imread(tempCanvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    const imgArea = tempCanvas.width * tempCanvas.height;
    let rawCandidates: { pts: Point[]; area: number; solidity: number; weightFactor: number }[] = [];

    // Helper: Sort 4 points strictly in clockwise order (TL, TR, BR, BL)
    const orderPoints = (pts: Point[]): Point[] => {
      if (pts.length !== 4) return pts;
      const centerX = pts.reduce((sum, p) => sum + p.x, 0) / 4;
      const centerY = pts.reduce((sum, p) => sum + p.y, 0) / 4;

      const sorted = [...pts].sort((a, b) => {
        const angleA = Math.atan2(a.y - centerY, a.x - centerX);
        const angleB = Math.atan2(b.y - centerY, b.x - centerX);
        return angleA - angleB;
      });

      let minVal = Infinity;
      let minDistIdx = 0;
      for (let i = 0; i < 4; i++) {
        const val = sorted[i].x + sorted[i].y;
        if (val < minVal) {
          minVal = val;
          minDistIdx = i;
        }
      }

      const reordered: Point[] = [];
      for (let i = 0; i < 4; i++) {
        reordered.push(sorted[(minDistIdx + i) % 4]);
      }
      return reordered;
    };

    // Universal 4-Corner Parallelogram Snapping: Fixes ANY single drifting corner (TL/TR/BR/BL)
    const snapAnyOutlierCorner = (pts: Point[]): Point[] => {
      if (pts.length !== 4) return pts;
      const expPoints = [
        { x: pts[1].x + (pts[3].x - pts[2].x), y: pts[1].y + (pts[3].y - pts[2].y) }, // TL exp
        { x: pts[0].x + (pts[2].x - pts[3].x), y: pts[0].y + (pts[2].y - pts[3].y) }, // TR exp
        { x: pts[1].x + (pts[3].x - pts[0].x), y: pts[1].y + (pts[3].y - pts[0].y) }, // BR exp
        { x: pts[0].x + (pts[2].x - pts[1].x), y: pts[0].y + (pts[2].y - pts[1].y) }  // BL exp
      ];

      const avgSide = (
        Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) +
        Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y) +
        Math.hypot(pts[3].x - pts[2].x, pts[3].y - pts[2].y) +
        Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y)
      ) / 4;

      if (avgSide <= 0) return pts;

      let maxDevRatio = 0;
      let outlierIdx = -1;

      for (let i = 0; i < 4; i++) {
        const dist = Math.hypot(pts[i].x - expPoints[i].x, pts[i].y - expPoints[i].y);
        const ratio = dist / avgSide;
        if (ratio > maxDevRatio) {
          maxDevRatio = ratio;
          outlierIdx = i;
        }
      }

      if (outlierIdx >= 0 && maxDevRatio > 0.12) {
        const newPts = [...pts];
        newPts[outlierIdx] = {
          x: pts[outlierIdx].x * 0.25 + expPoints[outlierIdx].x * 0.75,
          y: pts[outlierIdx].y * 0.25 + expPoints[outlierIdx].y * 0.75
        };
        return newPts;
      }

      return pts;
    };

    // Helper: Extract 4 bounding corners
    const extractBest4Corners = (cnt: any): Point[] | null => {
      let peri = cv.arcLength(cnt, true);
      let approx = new cv.Mat();

      for (let eps of [0.02, 0.03, 0.04, 0.05, 0.015, 0.06]) {
        cv.approxPolyDP(cnt, approx, eps * peri, true);
        if (approx.rows === 4) {
          let pts: Point[] = [];
          for (let i = 0; i < 4; i++) {
            pts.push({
              x: approx.data32S[i * 2] / tempScale,
              y: approx.data32S[i * 2 + 1] / tempScale
            });
          }
          approx.delete();
          return snapAnyOutlierCorner(orderPoints(pts));
        }
      }
      approx.delete();

      let hull = new cv.Mat();
      cv.convexHull(cnt, hull, false, true);

      if (hull.rows >= 4) {
        let hullPts: Point[] = [];
        for (let i = 0; i < hull.rows; i++) {
          hullPts.push({
            x: hull.data32S[i * 2],
            y: hull.data32S[i * 2 + 1]
          });
        }
        hull.delete();

        let bestArea = 0;
        let best4: Point[] | null = null;
        const n = hullPts.length;

        let step = Math.max(1, Math.floor(n / 16));
        let sampledPts: Point[] = [];
        for (let i = 0; i < n; i += step) {
          sampledPts.push(hullPts[i]);
        }

        const sn = sampledPts.length;
        if (sn >= 4) {
          for (let i = 0; i < sn - 3; i++) {
            for (let j = i + 1; j < sn - 2; j++) {
              for (let k = j + 1; k < sn - 1; k++) {
                for (let l = k + 1; l < sn; l++) {
                  const p1 = sampledPts[i], p2 = sampledPts[j], p3 = sampledPts[k], p4 = sampledPts[l];
                  const qArea = 0.5 * Math.abs(
                    (p1.x * p2.y - p2.x * p1.y) +
                    (p2.x * p3.y - p3.x * p2.y) +
                    (p3.x * p4.y - p4.x * p3.y) +
                    (p4.x * p1.y - p1.x * p4.y)
                  );
                  if (qArea > bestArea) {
                    bestArea = qArea;
                    best4 = [
                      { x: p1.x / tempScale, y: p1.y / tempScale },
                      { x: p2.x / tempScale, y: p2.y / tempScale },
                      { x: p3.x / tempScale, y: p3.y / tempScale },
                      { x: p4.x / tempScale, y: p4.y / tempScale }
                    ];
                  }
                }
              }
            }
          }
        }
        if (best4) return snapAnyOutlierCorner(orderPoints(best4));
      } else {
        hull.delete();
      }

      let rect = cv.minAreaRect(cnt);
      let vertices = cv.RotatedRect.points(rect);
      let pts: Point[] = [];
      for (let i = 0; i < 4; i++) {
        pts.push({
          x: vertices[i].x / tempScale,
          y: vertices[i].y / tempScale
        });
      }
      return snapAnyOutlierCorner(orderPoints(pts));
    };

    // Helper: Compute Boundary Line Gradient Step Strength across 4 sides
    const getBoundaryGradientStep = (quad: Point[]): number => {
      try {
        let totalStep = 0;
        let count = 0;

        for (let i = 0; i < 4; i++) {
          const p1 = quad[i];
          const p2 = quad[(i + 1) % 4];

          const p1x = p1.x * tempScale;
          const p1y = p1.y * tempScale;
          const p2x = p2.x * tempScale;
          const p2y = p2.y * tempScale;

          const dx = p2x - p1x;
          const dy = p2y - p1y;
          const len = Math.hypot(dx, dy);

          if (len <= 0) continue;
          const nx = -dy / len;
          const ny = dx / len;

          for (let step = 0.2; step <= 0.8; step += 0.1) {
            const sx = Math.round(p1x + dx * step);
            const sy = Math.round(p1y + dy * step);

            const inX = Math.min(Math.max(0, Math.round(sx - nx * 3)), gray.cols - 1);
            const inY = Math.min(Math.max(0, Math.round(sy - ny * 3)), gray.rows - 1);
            const outX = Math.min(Math.max(0, Math.round(sx + nx * 3)), gray.cols - 1);
            const outY = Math.min(Math.max(0, Math.round(sy + ny * 3)), gray.rows - 1);

            const valIn = gray.ucharPtr(inY, inX)[0];
            const valOut = gray.ucharPtr(outY, outX)[0];

            totalStep += Math.abs(valIn - valOut);
            count++;
          }
        }
        return count > 0 ? (totalStep / count) : 0;
      } catch (e) {
        return 0;
      }
    };

    // Helper: Compute Paper Luminance & Uniformity
    const getPaperUniformityScore = (quad: Point[]): number => {
      try {
        let mask = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
        let ptsVector = new cv.MatVector();
        let matPts = cv.matFromArray(4, 1, cv.CV_32SC2, [
          Math.round(quad[0].x * tempScale), Math.round(quad[0].y * tempScale),
          Math.round(quad[1].x * tempScale), Math.round(quad[1].y * tempScale),
          Math.round(quad[2].x * tempScale), Math.round(quad[2].y * tempScale),
          Math.round(quad[3].x * tempScale), Math.round(quad[3].y * tempScale)
        ]);
        ptsVector.push_back(matPts);
        cv.fillPoly(mask, ptsVector, new cv.Scalar(255));

        let meanStd = new cv.Mat();
        let stdDevMat = new cv.Mat();
        cv.meanStdDev(gray, meanStd, stdDevMat, mask);

        let meanLum = meanStd.doubleAt(0, 0);
        let stdDev = stdDevMat.doubleAt(0, 0);

        mask.delete(); ptsVector.delete(); matPts.delete(); meanStd.delete(); stdDevMat.delete();

        // High luminance (light paper) & moderate variance = uniform paper background
        if (meanLum >= 160 && stdDev <= 55) return 2.0;
        if (meanLum < 130) return 0.2; // Penalty for dark furniture
        return 1.0;
      } catch (e) {
        return 1.0;
      }
    };

    // Helper: Check Header/Footer Ink Truncation
    const getHeaderFooterTruncationPenalty = (quad: Point[]): number => {
      try {
        let edges = new cv.Mat();
        cv.Canny(gray, edges, 40, 120);

        let qMinY = Math.min(...quad.map(p => p.y * tempScale));
        let qMaxY = Math.max(...quad.map(p => p.y * tempScale));

        let topOutsideCount = 0;
        let bottomOutsideCount = 0;

        for (let y = 0; y < edges.rows; y++) {
          if (y < qMinY - 5) {
            for (let x = 0; x < edges.cols; x++) {
              if (edges.ucharPtr(y, x)[0] > 0) topOutsideCount++;
            }
          } else if (y > qMaxY + 5) {
            for (let x = 0; x < edges.cols; x++) {
              if (edges.ucharPtr(y, x)[0] > 0) bottomOutsideCount++;
            }
          }
        }
        edges.delete();

        // If inner quad cuts off top header logo/text (like HB logo in Image 2) or bottom text:
        if (topOutsideCount > 40 || bottomOutsideCount > 40) {
          return 0.05; // Severe truncation penalty!
        }
        return 1.0;
      } catch (e) {
        return 1.0;
      }
    };

    // Candidate Collector
    const collectContourCandidate = (cnt: any, weightFactor: number = 1.0) => {
      let area = cv.contourArea(cnt);
      if (area < imgArea * 0.04 || area > imgArea * 0.96) return;

      let quad = extractBest4Corners(cnt);
      if (!quad || quad.length !== 4) return;

      const widthA = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
      const widthB = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
      const heightA = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
      const heightB = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);

      const avgW = (widthA + widthB) / 2;
      const avgH = (heightA + heightB) / 2;

      if (avgW < 25 || avgH < 25) return;
      const aspect = avgW / avgH;
      if (aspect < 0.2 || aspect > 5.0) return;

      let hull = new cv.Mat();
      cv.convexHull(cnt, hull);
      let hullArea = cv.contourArea(hull);
      hull.delete();

      let solidity = hullArea > 0 ? (area / hullArea) : 0.8;
      rawCandidates.push({ pts: quad, area, solidity, weightFactor });
    };

    // --- PASS 1: Multi-Threshold Canny Passes ---
    const cannyThresholdPairs = [
      { low: 30, high: 100, weight: 1.0 },
      { low: 50, high: 150, weight: 1.1 },
      { low: 75, high: 200, weight: 1.0 }
    ];

    for (let tPair of cannyThresholdPairs) {
      let blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0);

      let edged = new cv.Mat();
      cv.Canny(blurred, edged, tPair.low, tPair.high);

      let M = cv.Mat.ones(3, 3, cv.CV_8U);
      let closed = new cv.Mat();
      cv.morphologyEx(edged, closed, cv.MORPH_CLOSE, M);

      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); i++) {
        collectContourCandidate(contours.get(i), tPair.weight);
      }

      contours.delete(); hierarchy.delete(); closed.delete(); M.delete(); edged.delete(); blurred.delete();
    }

    // --- PASS 2: Otsu Adaptive Thresholding Pass ---
    let blurredGray = new cv.Mat();
    cv.GaussianBlur(gray, blurredGray, new cv.Size(5, 5), 0, 0);

    let otsuMat = new cv.Mat();
    cv.threshold(blurredGray, otsuMat, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    let otsuClosed = new cv.Mat();
    let M2 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(otsuMat, otsuClosed, cv.MORPH_CLOSE, M2);

    let otsuContours = new cv.MatVector();
    let otsuHierarchy = new cv.Mat();
    cv.findContours(otsuClosed, otsuContours, otsuHierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < otsuContours.size(); i++) {
      collectContourCandidate(otsuContours.get(i), 1.25);
    }

    otsuContours.delete(); otsuHierarchy.delete(); otsuClosed.delete(); M2.delete(); otsuMat.delete(); blurredGray.delete();

    // --- PASS 3: HSV Saturation Paper Boundary Pass ---
    let hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
    let hsvPlanes = new cv.MatVector();
    cv.split(hsv, hsvPlanes);
    let satChannel = hsvPlanes.get(1);

    let paperMask = new cv.Mat();
    cv.threshold(satChannel, paperMask, 25, 255, cv.THRESH_BINARY_INV);

    let satClosed = new cv.Mat();
    let M3 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(paperMask, satClosed, cv.MORPH_CLOSE, M3);

    let satContours = new cv.MatVector();
    let satHierarchy = new cv.Mat();
    cv.findContours(satClosed, satContours, satHierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < satContours.size(); i++) {
      collectContourCandidate(satContours.get(i), 1.6);
    }

    satContours.delete(); satHierarchy.delete(); satClosed.delete(); M3.delete(); paperMask.delete();
    satChannel.delete(); hsvPlanes.delete(); hsv.delete();

    // Helper: Check if Quad A is contained inside Quad B
    const isInsideOtherQuad = (target: Point[], container: Point[]): boolean => {
      let tMinX = Math.min(...target.map(p => p.x));
      let tMaxX = Math.max(...target.map(p => p.x));
      let tMinY = Math.min(...target.map(p => p.y));
      let tMaxY = Math.max(...target.map(p => p.y));

      let cMinX = Math.min(...container.map(p => p.x));
      let cMaxX = Math.max(...container.map(p => p.x));
      let cMinY = Math.min(...container.map(p => p.y));
      let cMaxY = Math.max(...container.map(p => p.y));

      return (tMinX >= cMinX - 10 && tMaxX <= cMaxX + 10 && tMinY >= cMinY - 10 && tMaxY <= cMaxY + 10);
    };

    // --- STAGE 2: Advanced Multi-Factor Scoring (v17.7) ---
    let scoredCandidates: { pts: Point[]; score: number }[] = [];

    for (let candidate of rawCandidates) {
      const quad = candidate.pts;

      // 1. Center Prior Weighting
      const quadCx = quad.reduce((sum, p) => sum + p.x, 0) / 4;
      const quadCy = quad.reduce((sum, p) => sum + p.y, 0) / 4;
      const imgCx = canvas.width / 2;
      const imgCy = canvas.height / 2;
      const normDist = Math.hypot(quadCx - imgCx, quadCy - imgCy) / Math.hypot(imgCx, imgCy);
      const centerWeight = Math.exp(-1.5 * normDist * normDist);

      // 2. Boundary Line Gradient Step Strength across 4 sides
      const edgeGradientStep = getBoundaryGradientStep(quad);
      let boundaryScore = 1.0 + Math.min(edgeGradientStep / 10, 3.0); // Boost for sharp 4-side paper boundary!

      // 3. Paper Luminance Uniformity
      const paperUniformity = getPaperUniformityScore(quad);

      // 4. Header/Footer Ink Truncation Penalty
      const truncationPenalty = getHeaderFooterTruncationPenalty(quad);

      // 5. Inner Quad Priority
      let innerBonus = 1.0;
      for (let other of rawCandidates) {
        if (other.area > candidate.area * 2.0 && isInsideOtherQuad(quad, other.pts)) {
          innerBonus = 3.0;
          break;
        }
      }

      // 6. Penalize massive outer boundary frames (> 75% screen area)
      let areaPenalty = 1.0;
      if (candidate.area > imgArea * 0.75) {
        areaPenalty = 0.05;
      }

      let score = (candidate.solidity * 2.0) * candidate.weightFactor * centerWeight * boundaryScore * paperUniformity * truncationPenalty * innerBonus * areaPenalty;

      scoredCandidates.push({ pts: quad, score });
    }

    gray.delete(); src.delete();
    // Removed dangerous cleanupMats block that crashed OpenCV.js when .isDeleted() was undefined
    // Memory leaks are prevented by explicitly deleting Mats in their respective blocks.

    if (scoredCandidates.length > 0) {
      scoredCandidates.sort((a, b) => b.score - a.score);
      return scoredCandidates[0].pts;
    }

    return null;
  } catch (err) {
    console.warn("Auto-detect failed", err);
    return null;
  }
}

/**
 * Applies perspective crop and industry-standard enhancement filters.
 * Returns an object with Data URLs for cropped, bw, and color versions.
 */
export function applyPerspectiveAndFilters(snapshot: string, pts: Point[], forcedProfile: 'auto' | 'text' | 'photo' | 'mixed' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' = 'auto'): Promise<{ filtered: string, activeProfile: string, detectedType?: string, timings?: { mathMs: number, encodeMs: number, totalMs: number, breakdown?: any } }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = snapshot;
    img.onload = () => {
      const t0_total = performance.now();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failed'));
      ctx.drawImage(img, 0, 0);

      try {
        let finalHybrid: any;
        const cv = (window as any).cv;
        const t0_math = performance.now();
        let t_warp = 0, t_bw = 0, t_hsv = 0, t_hull = 0, t_engine = 0;
        let mark = performance.now();
          let src = cv.imread(canvas);
        
        const widthA = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
        const widthB = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        let maxWidth = Math.round(Math.max(widthA, widthB));

        const heightA = Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y);
        const heightB = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
        let maxHeight = Math.round(Math.max(heightA, heightB));
        
        let scaleRatio = 1.0;
        const MAX_PROCESSING_WIDTH = 2200;
        if (maxWidth > MAX_PROCESSING_WIDTH) {
            scaleRatio = MAX_PROCESSING_WIDTH / maxWidth;
            maxWidth = MAX_PROCESSING_WIDTH;
            maxHeight = Math.round(maxHeight * scaleRatio);
        }
        
        const getK = (size: number) => {
            let s = Math.round(size * scaleRatio);
            if (s % 2 === 0) s += 1;
            return Math.max(3, s);
        };
        
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
        
        t_warp = performance.now() - mark; mark = performance.now();
        // Reset canvas to match the exact cropped image dimension before showing/compressing
        canvas.width = dst.cols;
        canvas.height = dst.rows;
        
        
        

        if (forcedProfile === 'original') {
            cv.imshow(canvas, dst);
            const originalUrl = compressCanvas(canvas, 1.0);
            resolve({ filtered: originalUrl, activeProfile: 'original', timings: { mathMs: 0, encodeMs: Math.round(performance.now() - t0_math), totalMs: Math.round(performance.now() - t0_total) } });
            
            try {
                src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
            } catch(e) {}
            return;
        }


        if (forcedProfile === 'original') {
            cv.imshow(canvas, dst);
            const originalUrl = compressCanvas(canvas, 1.0);
            resolve({ filtered: originalUrl, activeProfile: 'original' });
            try {
                src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
            } catch(e) {}
            return;
        }

        let photoRgb = new cv.Mat();
        let finalPureRgba = new cv.Mat();
        let finalSmartPlusRgba = new cv.Mat();
        finalHybrid = undefined;
        
        // --- MINIATURIZED AUTO-DETECT & MASKS ---
        // We run the Auto-Detect logic on a highly downscaled thumbnail (20% size) to save 1.5 seconds!
        let smallDst = new cv.Mat();
        cv.resize(dst, smallDst, new cv.Size(0, 0), 0.2, 0.2, cv.INTER_AREA);
        
        let smallGray = new cv.Mat();
        cv.cvtColor(smallDst, smallGray, cv.COLOR_RGBA2GRAY, 0);
        
        // 1. Fast Thumbnail B&W (For Auto-Detect Black Ratio & Text Collisions)
        let bgKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(Math.max(3, Math.round(getK(21)*0.2))|1, Math.max(3, Math.round(getK(21)*0.2))|1));
        let bgSmallest = new cv.Mat();
        cv.morphologyEx(smallGray, bgSmallest, cv.MORPH_CLOSE, bgKernelSmall);
        cv.GaussianBlur(bgSmallest, bgSmallest, new cv.Size(3, 3), 0, 0);
        bgKernelSmall.delete();
        
        let flatGraySmall = new cv.Mat();
        cv.divide(smallGray, bgSmallest, flatGraySmall, 255, -1);
        bgSmallest.delete();
        
        let smallBw = new cv.Mat();
        cv.adaptiveThreshold(flatGraySmall, smallBw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, Math.max(3, Math.round(getK(61)*0.2))|1, 15);
        flatGraySmall.delete();
        
        let darkMaskSmall = new cv.Mat();
        cv.threshold(smallGray, darkMaskSmall, 50, 255, cv.THRESH_BINARY_INV);
        
        // 2. Fast Thumbnail HSV
        let totalSmallPixels = smallBw.rows * smallBw.cols;
        let hsvCheck = new cv.Mat();
        let rgbCheck = new cv.Mat();
        cv.cvtColor(smallDst, rgbCheck, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgbCheck, hsvCheck, cv.COLOR_RGB2HSV);
        let hsvPlanesCheck = new cv.MatVector();
        cv.split(hsvCheck, hsvPlanesCheck);
        let sCheck = hsvPlanesCheck.get(1);
        let vCheck = hsvPlanesCheck.get(2);
        
        let colorMask = new cv.Mat();
        cv.threshold(sCheck, colorMask, 35, 255, cv.THRESH_BINARY);
        let notPaperMask = new cv.Mat();
        cv.threshold(vCheck, notPaperMask, 250, 255, cv.THRESH_BINARY_INV); 
        
        let targetMask = new cv.Mat();
        cv.bitwise_and(colorMask, notPaperMask, targetMask);
        
        let openedMask = new cv.Mat();
        let openKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.morphologyEx(targetMask, openedMask, cv.MORPH_OPEN, openKernelSmall);
        let colorfulPixels = cv.countNonZero(openedMask);
        let colorfulRatio = colorfulPixels / totalSmallPixels;
        openKernelSmall.delete();
        
        let brightMask = new cv.Mat();
        cv.threshold(vCheck, brightMask, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
        let nonColorMask = new cv.Mat();
        cv.threshold(sCheck, nonColorMask, 40, 255, cv.THRESH_BINARY_INV);
        let paperMask = new cv.Mat();
        cv.bitwise_and(brightMask, nonColorMask, paperMask);
        let paperPixels = cv.countNonZero(paperMask);
        let paperRatio = paperPixels / totalSmallPixels;
        
        let whitePixels = cv.countNonZero(smallBw);
        let blackPixels = totalSmallPixels - whitePixels;
        let blackRatio = blackPixels / totalSmallPixels;
        
        let smallMask = new cv.Mat();
        openedMask.copyTo(smallMask);
        
        t_hsv = performance.now() - mark; mark = performance.now();
        
        // --- CONVEX HULL CLUSTERING (On Thumbnail!) ---
        let cleanKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.morphologyEx(smallMask, smallMask, cv.MORPH_OPEN, cleanKernelSmall);
        let groupKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        cv.morphologyEx(smallMask, smallMask, cv.MORPH_CLOSE, groupKernelSmall);
        
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(smallMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        let hullMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
        let smallTextMask = new cv.Mat();
        cv.bitwise_not(smallBw, smallTextMask); 
        
        let maxC = Math.min(contours.size(), 300); for (let i = 0; i < maxC; ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            if (area > 2) { 
                let contourMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
                let cntVector = new cv.MatVector();
                cntVector.push_back(cnt);
                cv.drawContours(contourMask, cntVector, 0, new cv.Scalar(255), -1);
                
                let rect = cv.boundingRect(cnt);
                let boxMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
                let point1 = new cv.Point(rect.x, rect.y);
                let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
                cv.rectangle(boxMask, point1, point2, new cv.Scalar(255), -1);
                
                let diffMask = new cv.Mat();
                cv.bitwise_xor(boxMask, contourMask, diffMask);
                
                let collisionMask = new cv.Mat();
                cv.bitwise_and(diffMask, smallTextMask, collisionMask);
                let textPixels = cv.countNonZero(collisionMask);
                let diffPixels = cv.countNonZero(diffMask);
                
                let textDensity = diffPixels > 0 ? (textPixels / diffPixels) : 0;
                if (textDensity > 0.03) {
                    cv.bitwise_or(hullMask, contourMask, hullMask);
                } else {
                    cv.bitwise_or(hullMask, boxMask, hullMask);
                }
                
                contourMask.delete(); boxMask.delete(); diffMask.delete(); collisionMask.delete(); cntVector.delete();
            }
            cnt.delete();
        }
        smallTextMask.delete();
        
        let dilateKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.dilate(hullMask, hullMask, dilateKernelSmall, new cv.Point(-1, -1), 1);
        cv.GaussianBlur(hullMask, hullMask, new cv.Size(5, 5), 0, 0);
        
        let hybridMask = new cv.Mat();
        cv.resize(hullMask, hybridMask, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_LINEAR);
        
        hullMask.delete(); contours.delete(); hierarchy.delete(); groupKernelSmall.delete(); smallMask.delete(); cleanKernelSmall.delete(); dilateKernelSmall.delete();
        vCheck.delete(); colorMask.delete(); notPaperMask.delete(); targetMask.delete(); openedMask.delete(); 
        hsvCheck.delete(); rgbCheck.delete(); hsvPlanesCheck.delete(); sCheck.delete();
        brightMask.delete(); nonColorMask.delete(); paperMask.delete();
        smallBw.delete(); smallGray.delete(); smallDst.delete(); darkMaskSmall.delete();
        
        t_hull = performance.now() - mark; mark = performance.now();

        // --- LAZY EVALUATION RESOLUTION ---
        let detectedType = 'text_color';
        let aspectRatio = Math.max(dst.cols / dst.rows, dst.rows / dst.cols);
        
        if (colorfulRatio > 0.15 || blackRatio > 0.40) {
            detectedType = 'photo';
        } else if (colorfulRatio > 0.03) {
            if (paperRatio > 0.05) {
                detectedType = 'mixed';
            } else {
                detectedType = 'photo';
            }
        } else if (colorfulRatio <= 0.005 && aspectRatio > 1.7) {
            detectedType = 'text_bw';
        } else {
            detectedType = 'text_color';
        }

        let activeProfile = forcedProfile;
        if (activeProfile === 'auto' || activeProfile === 'text' || activeProfile === 'photo' || activeProfile === 'mixed') {
          if (detectedType === 'photo') {
            activeProfile = 'pure_color';
          } else if (detectedType === 'mixed') {
            activeProfile = 'hybrid';
          } else if (detectedType === 'text_bw') {
            activeProfile = 'bw';
          } else {
            activeProfile = 'smart_plus';
          }
        }

        // --- LAZY B&W ENGINE ---
        let bwRgba = new cv.Mat();
        let bw = new cv.Mat();
        let gray = new cv.Mat();
        let darkMask = new cv.Mat();
        let blackMat = new cv.Mat();
        
        if (activeProfile === 'bw' || activeProfile === 'hybrid') {
            cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
            let small = new cv.Mat();
            cv.resize(gray, small, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);
            
            let bgSmall = new cv.Mat();
            let bgKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(getK(21), getK(21)));
            cv.morphologyEx(small, bgSmall, cv.MORPH_CLOSE, bgKernel);
            cv.GaussianBlur(bgSmall, bgSmall, new cv.Size(getK(5), getK(5)), 0, 0);
            bgKernel.delete();
            small.delete();
            
            let bg = new cv.Mat();
            cv.resize(bgSmall, bg, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_CUBIC);
            bgSmall.delete();
            
            let flatGray = new cv.Mat();
            cv.divide(gray, bg, flatGray, 255, -1);
            bg.delete();
            
            let blurred = new cv.Mat();
            cv.GaussianBlur(flatGray, blurred, new cv.Size(0, 0), 2);
            let sharpened = new cv.Mat();
            cv.addWeighted(flatGray, 2.0, blurred, -1.0, 0, sharpened);
            blurred.delete(); flatGray.delete();
            
            cv.adaptiveThreshold(sharpened, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, getK(61), 15);
            sharpened.delete();
            
            let noiseKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
            cv.morphologyEx(bw, bw, cv.MORPH_CLOSE, noiseKernel);
            noiseKernel.delete();
            
            cv.threshold(gray, darkMask, 50, 255, cv.THRESH_BINARY_INV);
            
            blackMat.create(bw.rows, bw.cols, bw.type());
            blackMat.setTo(new cv.Scalar(0));
            blackMat.copyTo(bw, darkMask);
            
            cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        }
        t_bw = performance.now() - mark; mark = performance.now();

        if (activeProfile === 'pure_color' || activeProfile === 'hybrid') {
        // --- Photo Mode (Professional Photo Enhancement) ---
        photoRgb = new cv.Mat();
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

        finalPureRgba = new cv.Mat();
        cv.cvtColor(finalPhotoRgb, finalPureRgba, cv.COLOR_RGB2RGBA);

        
        

        // Cleanup Photo resources
        photoHsv.delete(); photoHsvPlanes.delete(); satChannel.delete(); 
        popRgb.delete(); blurredPhoto.delete(); finalPhotoRgb.delete();
        
        // Do not delete photoRgb and finalPureRgba yet, we need them for hybrid


        }

        if (activeProfile === 'smart_plus' || activeProfile === 'hybrid') {
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
        cv.GaussianBlur(grayForMask, grayForMask, new cv.Size(getK(3), getK(3)), 0, 0);
        
        let mask = new cv.Mat();
        cv.adaptiveThreshold(grayForMask, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 15);
        grayForMask.delete();
        cv.GaussianBlur(mask, mask, new cv.Size(getK(3), getK(3)), 0, 0);

        // 2. RGB Retinex Flattening (Restores TRUE colors under colored shadows!)
        let smallRgb = new cv.Mat();
        cv.resize(plusRgb, smallRgb, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);
        
        // Inpaint colorful logos so they don't become part of the background illumination map!
        // This prevents Retinex from erasing the logo, and eliminates gray halos around it.
        let hsvLogo = new cv.Mat();
        cv.cvtColor(smallRgb, hsvLogo, cv.COLOR_RGB2HSV);
        let hsvLogoPlanes = new cv.MatVector();
        cv.split(hsvLogo, hsvLogoPlanes);
        
        let hLogo = hsvLogoPlanes.get(0);
        let sLogo = hsvLogoPlanes.get(1);
        
        let smallLogoMask = new cv.Mat();
        // Base logo mask: Saturation > 85 (Only STRONGLY colored logos/pens, ignores medium stains!)
        cv.threshold(sLogo, smallLogoMask, 85, 255, cv.THRESH_BINARY);
        
        // Find warm/yellow/brown shadows (Hue 8 to 42 - slightly widened to catch reddish/greenish edges)
        let hueHigh = new cv.Mat();
        cv.threshold(hLogo, hueHigh, 8, 255, cv.THRESH_BINARY);
        let hueLow = new cv.Mat();
        cv.threshold(hLogo, hueLow, 42, 255, cv.THRESH_BINARY_INV);
        
        let warmShadowMask = new cv.Mat();
        cv.bitwise_and(hueHigh, hueLow, warmShadowMask); // 10 < H <= 40
        
        // Exclude warm shadows from the logo mask!
        cv.bitwise_not(warmShadowMask, warmShadowMask);
        cv.bitwise_and(smallLogoMask, warmShadowMask, smallLogoMask);
        
        warmShadowMask.delete(); hueHigh.delete(); hueLow.delete();
        hLogo.delete(); sLogo.delete(); hsvLogoPlanes.delete(); hsvLogo.delete();
        
        // Expand the logo mask slightly so inpainting covers the edges
        let dilateLogo = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.dilate(smallLogoMask, smallLogoMask, dilateLogo);
        dilateLogo.delete();
        
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
        cv.GaussianBlur(bgSmall2, bgSmall2, new cv.Size(getK(3), getK(3)), 0, 0); // Fast smooth on downscaled image!
        
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

        finalSmartPlusRgba = new cv.Mat();
        cv.cvtColor(finalSmartPlusRgb, finalSmartPlusRgba, cv.COLOR_RGB2RGBA);
        finalSmartPlusRgb.delete();
        plusRgb.delete();

        
        


        }

        if (activeProfile === 'hybrid') {
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
            
            finalHybrid = new cv.Mat();
            hybridFloat.convertTo(finalHybrid, cv.CV_8U);
            
            
            
            
            maskRgba.delete(); maskFloat.delete(); pureFloat.delete(); smartFloat.delete();
            oneMinusMask.delete(); scalar1.delete(); term1.delete(); term2.delete(); hybridFloat.delete();
            hybridMask.delete();
        }

        
        

        
        

        }
        
        // --- EXPERIMENTAL ENGINE (Background Division) ---
        let finalExperimentalRgba = new cv.Mat();
        
        let finalHybridShadowRgba = new cv.Mat();
        if (activeProfile === 'hybrid_shadow' || forcedProfile === 'hybrid_shadow') {
            const hsT0 = performance.now();
            
            let hsRgb = new cv.Mat();
            cv.cvtColor(dst, hsRgb, cv.COLOR_RGBA2RGB);
            
            let smallRgb = new cv.Mat();
            let scale = 0.2;
            cv.resize(hsRgb, smallRgb, new cv.Size(0,0), scale, scale, cv.INTER_AREA);
            
            let k = Math.floor(Math.max(dst.cols, dst.rows) / 8);
            let smallK = Math.floor(k * scale);
            if (smallK % 2 === 0) smallK++;
            if (smallK < 15) smallK = 15;
            
            cv.GaussianBlur(smallRgb, smallRgb, new cv.Size(smallK, smallK), 0, 0, cv.BORDER_DEFAULT);
            let bgMapRgb = new cv.Mat();
            cv.resize(smallRgb, bgMapRgb, new cv.Size(hsRgb.cols, hsRgb.rows), 0, 0, cv.INTER_LINEAR);
            
            let flatRgb = new cv.Mat();
            cv.divide(hsRgb, bgMapRgb, flatRgb, 255.0, -1);
            
            let punchyRgb = new cv.Mat();
              // Darken the ink uniformly so faint text doesn't turn white
              flatRgb.convertTo(punchyRgb, -1, 1.2, -80); 
              
              let flatGray = new cv.Mat();
              cv.cvtColor(flatRgb, flatGray, cv.COLOR_RGB2GRAY);
              
              let mask = new cv.Mat();
              // C=4 is highly sensitive, catching faint lines and filling holes
              cv.adaptiveThreshold(flatGray, mask, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, getK(61), 4);
              
              let finalRgb = new cv.Mat(hsRgb.rows, hsRgb.cols, cv.CV_8UC3, new cv.Scalar(255, 255, 255));
              punchyRgb.copyTo(finalRgb, mask);
            
            cv.cvtColor(finalRgb, finalHybridShadowRgba, cv.COLOR_RGB2RGBA);
            
            hsRgb.delete(); smallRgb.delete(); bgMapRgb.delete(); 
            flatRgb.delete(); punchyRgb.delete(); flatGray.delete(); 
            mask.delete(); finalRgb.delete();
            
            t_engine = performance.now() - hsT0;
        }

        if (activeProfile === 'experimental' || forcedProfile === 'experimental') {
            const expT0 = performance.now();
            let expRgb = new cv.Mat();
            cv.cvtColor(dst, expRgb, cv.COLOR_RGBA2RGB, 0);
            
            // 1. Create a COLOR background map (Illumination Map)
            let bgMapRgb = new cv.Mat();
            let smallRgb = new cv.Mat();
            let scale = 0.2; // Downscale to 20% for lightning fast processing
            cv.resize(expRgb, smallRgb, new cv.Size(0,0), scale, scale, cv.INTER_AREA);
            
            let expK = Math.floor(Math.max(dst.cols, dst.rows) / 8);
            let smallK = Math.floor(expK * scale);
            if (smallK % 2 === 0) smallK++;
            if (smallK < 15) smallK = 15;
            
            cv.GaussianBlur(smallRgb, smallRgb, new cv.Size(smallK, smallK), 0, 0, cv.BORDER_DEFAULT);
            // Upscale back to original size
            cv.resize(smallRgb, bgMapRgb, new cv.Size(expRgb.cols, expRgb.rows), 0, 0, cv.INTER_LINEAR);
            smallRgb.delete();
            
            // 3. Divide RGB image by RGB background map to flatten lighting but keep colors!
            let dividedRgb = new cv.Mat();
            cv.divide(expRgb, bgMapRgb, dividedRgb, 255.0, -1);
            
            // 4. Mild contrast stretch to darken text and punch up colors, without destroying anti-aliasing
            let stretchedRgb = new cv.Mat();
            // alpha = 1.4, beta = -50
            // 250 -> 255 (white stays white)
            // 150 -> 160
            // 100 -> 90
            // 50 -> 20 (darker shadows)
            dividedRgb.convertTo(stretchedRgb, -1, 3.0, -470);
            
            cv.cvtColor(stretchedRgb, finalExperimentalRgba, cv.COLOR_RGB2RGBA);
            
            expRgb.delete(); bgMapRgb.delete(); dividedRgb.delete(); stretchedRgb.delete();
            t_engine = performance.now() - expT0;
        }

        // --- LAZY EVALUATION: Choose the active profile and encode ONLY that one! ---
        activeProfile = forcedProfile;
        
        // Auto-Detect Mapping
        if (activeProfile === 'auto' || activeProfile === 'text' || activeProfile === 'photo' || activeProfile === 'mixed') {
          if (detectedType === 'photo') {
            activeProfile = 'pure_color';
          } else if (detectedType === 'mixed') {
            activeProfile = 'hybrid';
          } else if (detectedType === 'text_bw') {
            activeProfile = 'bw';
          } else {
            activeProfile = 'smart_plus';
          }
        }

        t_engine = performance.now() - mark; mark = performance.now();
        const t1_math = performance.now();
        let finalUrl = '';
        if (activeProfile === 'original') {
          cv.imshow(canvas, dst);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'bw') {
          cv.imshow(canvas, bwRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'pure_color') {
          cv.imshow(canvas, finalPureRgba);
          finalUrl = compressCanvas(canvas, 0.85);

        } else if (activeProfile === 'hybrid_shadow') {
          cv.imshow(canvas, finalHybridShadowRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'experimental') {
          cv.imshow(canvas, finalExperimentalRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'smart_plus') {
          cv.imshow(canvas, finalSmartPlusRgba);
          finalUrl = compressCanvas(canvas, 0.85);
        } else if (activeProfile === 'hybrid') {
          if (typeof finalHybrid !== 'undefined') {
             cv.imshow(canvas, finalHybrid);
             finalUrl = compressCanvas(canvas, 0.85);
          } else {
             cv.imshow(canvas, finalSmartPlusRgba);
             finalUrl = compressCanvas(canvas, 0.85);
          }
        } else {
          cv.imshow(canvas, dst);
          finalUrl = compressCanvas(canvas, 0.85);
        }

        const t1_total = performance.now();
        resolve({ 
          filtered: finalUrl,
          activeProfile: activeProfile,
          detectedType: detectedType,
          timings: { mathMs: Math.round(t1_math - t0_math), encodeMs: Math.round(t1_total - t1_math), totalMs: Math.round(t1_total - t0_total), breakdown: { warp: Math.round(t_warp), bw: Math.round(t_bw), hsv: Math.round(t_hsv), hull: Math.round(t_hull), engine: Math.round(t_engine), res: `${maxWidth}x${maxHeight}` } }
        });
        
        try {
          src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();
          gray.delete(); bw.delete(); 
          darkMask.delete(); blackMat.delete(); 
          if(typeof bwRgba !== 'undefined' && !bwRgba.isDeleted()) bwRgba.delete();
          if(typeof photoRgb !== 'undefined' && !photoRgb.isDeleted()) photoRgb.delete();
          if(typeof finalPureRgba !== 'undefined' && !finalPureRgba.isDeleted()) finalPureRgba.delete();
          if(typeof finalSmartPlusRgba !== 'undefined' && !finalSmartPlusRgba.isDeleted()) finalSmartPlusRgba.delete();
          if(typeof finalHybrid !== 'undefined' && !finalHybrid.isDeleted()) finalHybrid.delete();
          
          // Cleanup all local Mat references that might have leaked
          const locals = [
             typeof smallDst !== 'undefined' ? smallDst : null,
             typeof smallGray !== 'undefined' ? smallGray : null,
             typeof bgKernelSmall !== 'undefined' ? bgKernelSmall : null,
             typeof bgSmallest !== 'undefined' ? bgSmallest : null,
             typeof smallBw !== 'undefined' ? smallBw : null,
             typeof smallMask !== 'undefined' ? smallMask : null,
             typeof contours !== 'undefined' ? contours : null,
             typeof hierarchy !== 'undefined' ? hierarchy : null,
             typeof hullMask !== 'undefined' ? hullMask : null,
             typeof dilateKernelSmall !== 'undefined' ? dilateKernelSmall : null,
             typeof hybridMask !== 'undefined' ? hybridMask : null,
             typeof flatRgb !== 'undefined' ? flatRgb : null,
             typeof blurredFlat !== 'undefined' ? blurredFlat : null,
             typeof flatHsv !== 'undefined' ? flatHsv : null,
             typeof planesHsv !== 'undefined' ? planesHsv : null,
             typeof v !== 'undefined' ? v : null,
             typeof smallLogoMask !== 'undefined' ? smallLogoMask : null,
             typeof inpaintedSmallRgb !== 'undefined' ? inpaintedSmallRgb : null,
             typeof bgSmall2 !== 'undefined' ? bgSmall2 : null,
             typeof bgRgb !== 'undefined' ? bgRgb : null,
             typeof planesRgb !== 'undefined' ? planesRgb : null,
             typeof planesBg !== 'undefined' ? planesBg : null,
             typeof textMask !== 'undefined' ? textMask : null,
             typeof edges !== 'undefined' ? edges : null
          ];
          for (let m of locals) {
             if (m && typeof m.delete === 'function' && !m.isDeleted()) m.delete();
          }
        } catch(e) {}


      } catch (err) {
        console.error("OpenCV processing failed", err);
        reject(err);
      }
    };
    img.onerror = reject;
  });
}
