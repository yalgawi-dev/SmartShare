const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);
const app = express();
app.use(cors({ origin: true }));

const CACHE_DIR = '/tmp/pdf-cache';
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Keep track of cached PDFs in /tmp (LRU up to 5 files)
const cachedFiles = [];

async function getLocalPdfPath(pdfUrl) {
  const hash = crypto.createHash('sha256').update(pdfUrl).digest('hex').slice(0, 16);
  const filePath = path.join(CACHE_DIR, `${hash}.pdf`);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  const res = await fetch(pdfUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  cachedFiles.push(filePath);
  if (cachedFiles.length > 5) {
    const oldest = cachedFiles.shift();
    if (oldest && oldest !== filePath && fs.existsSync(oldest)) {
      try { fs.unlinkSync(oldest); } catch (_) {}
    }
  }

  return filePath;
}

async function getPdfPageDimensions(pdfPath, pageNum = 1) {
  const { stdout } = await execFileAsync('pdfinfo', ['-f', String(pageNum), '-l', String(pageNum), pdfPath]);
  // Look for: Page    1 size: 36850.4 x 2551.18 pts
  const match = stdout.match(/Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/i) ||
                stdout.match(/Page size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/i);
  if (!match) {
    throw new Error('Could not parse PDF page dimensions from pdfinfo');
  }
  return {
    widthPts: parseFloat(match[1]),
    heightPts: parseFloat(match[2]),
  };
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', engine: 'mupdf+poppler-cpp' });
});

/**
 * GET /slice
 * Query params:
 * - pdfUrl: URL to PDF
 * - page: page number (default 1)
 * - cropX, cropY, cropW, cropH: normalized [0..1]
 * - outW, outH: target output pixel dimensions (e.g. 1024x1600)
 * - quality: WebP quality (default 88)
 */
app.get('/slice', async (req, res) => {
  const start = Date.now();
  try {
    const {
      pdfUrl,
      page = '1',
      cropX = '0',
      cropY = '0',
      cropW = '1',
      cropH = '1',
      outW = '1200',
      outH = '1600',
      quality = '88',
    } = req.query;

    if (!pdfUrl) {
      return res.status(400).json({ error: 'Missing required parameter: pdfUrl' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const normX = Math.max(0, Math.min(1, parseFloat(cropX) || 0));
    const normY = Math.max(0, Math.min(1, parseFloat(cropY) || 0));
    const normW = Math.max(0.01, Math.min(1 - normX, parseFloat(cropW) || 1));
    const normH = Math.max(0.01, Math.min(1 - normY, parseFloat(cropH) || 1));
    const targetW = Math.min(Math.max(parseInt(outW, 10) || 1200, 100), 3000);
    const targetH = Math.min(Math.max(parseInt(outH, 10) || 1600, 100), 3000);
    const webpQuality = Math.min(Math.max(parseInt(quality, 10) || 88, 50), 100);

    const pdfPath = await getLocalPdfPath(pdfUrl);
    const { widthPts, heightPts } = await getPdfPageDimensions(pdfPath, pageNum);

    // 1 point = 1/72 inch. Compute DPI needed so cropped region matches targetW/targetH
    const cropWidthInches = (normW * widthPts) / 72;
    const cropHeightInches = (normH * heightPts) / 72;
    const dpiX = targetW / cropWidthInches;
    const dpiY = targetH / cropHeightInches;
    const dpi = Math.min(Math.max(Math.round(Math.min(dpiX, dpiY)), 72), 600);

    // Full page pixel dimensions at this DPI
    const fullW = Math.round((widthPts / 72) * dpi);
    const fullH = Math.round((heightPts / 72) * dpi);

    const pxX = Math.max(0, Math.floor(normX * fullW));
    const pxY = Math.max(0, Math.floor(normY * fullH));
    const pxW = Math.max(1, Math.min(fullW - pxX, Math.ceil(normW * fullW)));
    const pxH = Math.max(1, Math.min(fullH - pxY, Math.ceil(normH * fullH)));

    const outPrefix = path.join(CACHE_DIR, `slice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    // Run C++ pdftoppm cropping ONLY the requested rectangle
    await execFileAsync('pdftoppm', [
      '-png',
      '-singlefile',
      '-f', String(pageNum),
      '-l', String(pageNum),
      '-r', String(dpi),
      '-x', String(pxX),
      '-y', String(pxY),
      '-W', String(pxW),
      '-H', String(pxH),
      pdfPath,
      outPrefix,
    ]);

    const pngPath = `${outPrefix}.png`;
    if (!fs.existsSync(pngPath)) {
      throw new Error('pdftoppm did not produce output PNG');
    }

    const webpBuffer = await sharp(pngPath)
      .webp({ quality: webpQuality, effort: 3 })
      .toBuffer();

    try { fs.unlinkSync(pngPath); } catch (_) {}

    const elapsedMs = Date.now() - start;
    res.set('Content-Type', 'image/webp');
    res.set('X-Render-Time-Ms', String(elapsedMs));
    res.set('Cache-Control', 'public, max-age=604800, s-maxage=604800');
    return res.status(200).send(webpBuffer);
  } catch (err) {
    console.error('C++ slice error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`SmartShare C++ Tiler listening on port ${PORT}`);
});
