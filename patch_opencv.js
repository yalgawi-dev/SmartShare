const fs = require('fs');
const file = 'src/utils/opencvFilters.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `export function detectDocument(canvas: HTMLCanvasElement): Point[] | null {`,
  `export function detectDocument(canvas: HTMLCanvasElement, isLivePreview = false): Point[] | null {`
);

const oldTargetCode = `
    // 600px for better edge resolution (was 300px)
    const TARGET_W = 600;
    const scale = TARGET_W / canvas.width;
    const tmp = document.createElement('canvas');
    tmp.width = TARGET_W;
    tmp.height = Math.round(canvas.height * scale);
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) return null;
    tmpCtx.drawImage(canvas, 0, 0, tmp.width, tmp.height);

    const src = cv.imread(tmp);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // CLAHE: boost local contrast (helps in dim / warm lighting)
    const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
    clahe.apply(gray, gray);
    clahe.delete();

    // Strategy 1: Canny with adaptive Otsu thresholds
    let result = detectWithCanny(cv, src, gray, scale);
    if (result && isValidQuad(result, canvas.width, canvas.height)) {
      gray.delete(); src.delete();
      return result;
    }

    // Strategy 2: Adaptive threshold (fallback for low-contrast backgrounds)
    result = detectWithAdaptive(cv, src, gray, scale);
    if (result && isValidQuad(result, canvas.width, canvas.height)) {
      gray.delete(); src.delete();
      return result;
    }

    gray.delete(); src.delete();
    return null;
`;

const newTargetCode = `
    // Shrink size heavily for live preview to prevent freezing, use higher for final snap
    const TARGET_W = isLivePreview ? 250 : 500;
    const scale = TARGET_W / canvas.width;
    const tmp = document.createElement('canvas');
    tmp.width = TARGET_W;
    tmp.height = Math.round(canvas.height * scale);
    const tmpCtx = tmp.getContext('2d', { willReadFrequently: true });
    if (!tmpCtx) return null;
    tmpCtx.drawImage(canvas, 0, 0, tmp.width, tmp.height);

    const src = cv.imread(tmp);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // Only run heavy contrast boosting on final snap
    if (!isLivePreview) {
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(gray, gray);
      clahe.delete();
    }

    // Fast Canny is sufficient for most edges
    let result = detectWithCanny(cv, src, gray, scale);
    if (result && isValidQuad(result, canvas.width, canvas.height)) {
      gray.delete(); src.delete();
      return result;
    }

    // If Canny fails and it's a final snap, try heavy Adaptive Threshold
    if (!isLivePreview) {
      result = detectWithAdaptive(cv, src, gray, scale);
      if (result && isValidQuad(result, canvas.width, canvas.height)) {
        gray.delete(); src.delete();
        return result;
      }
    }

    gray.delete(); src.delete();
    return null;
`;

if (content.includes('const TARGET_W = 600;')) {
  content = content.replace(oldTargetCode, newTargetCode);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched detectDocument');
} else {
  console.log('Failed to find replace block');
}
