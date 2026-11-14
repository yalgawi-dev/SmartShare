const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'myspace-da215.firebasestorage.app',
  });
}

const execFileAsync = promisify(execFile);
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

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
  let widthPts = parseFloat(match[1]);
  let heightPts = parseFloat(match[2]);

  // Check if page has /Rotate (90 or 270) and swap dimensions to match PDF.js & pdftoppm
  const rotMatch = stdout.match(/Page\s+\d+\s+rot:\s+(\d+)/i) || stdout.match(/Page rot:\s+(\d+)/i);
  const rot = rotMatch ? parseInt(rotMatch[1], 10) : 0;
  if (rot === 90 || rot === 270) {
    [widthPts, heightPts] = [heightPts, widthPts];
  }

  return { widthPts, heightPts };
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

/**
 * GET /tiles-manifest?docId=...
 * Fast check if pre-rendered tiles already exist in Firebase Storage.
 */
app.get('/tiles-manifest', async (req, res) => {
  try {
    const { docId } = req.query;
    if (!docId) return res.status(400).json({ error: 'Missing docId' });

    const bucket = admin.storage().bucket();
    const manifestFile = bucket.file(`rendered_tiles/${docId}/manifest.json`);
    const [exists] = await manifestFile.exists();
    if (!exists) {
      return res.status(404).json({ exists: false });
    }

    const [content] = await manifestFile.download();
    return res.status(200).json(JSON.parse(content.toString('utf8')));
  } catch (err) {
    console.error('tiles-manifest error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /pre-tile
 * Body: { pdfUrl, docId, page = 1 }
 * Pre-renders a blueprint into a grid of sharp WebP tiles in parallel using all 4 vCPUs,
 * uploads them to Firebase Storage, and saves manifest.json.
 */
app.post('/pre-tile', async (req, res) => {
  const start = Date.now();
  try {
    const { pdfUrl, docId, page = 1 } = req.body || {};
    if (!pdfUrl || !docId) {
      return res.status(400).json({ error: 'Missing required fields: pdfUrl, docId' });
    }

    const bucket = admin.storage().bucket();
    const manifestFile = bucket.file(`rendered_tiles/${docId}/manifest.json`);
    const [exists] = await manifestFile.exists();
    if (exists) {
      const [content] = await manifestFile.download();
      return res.status(200).json({ cached: true, ...JSON.parse(content.toString('utf8')) });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pdfPath = await getLocalPdfPath(pdfUrl);
    const { widthPts, heightPts } = await getPdfPageDimensions(pdfPath, pageNum);

    const aspect = widthPts / Math.max(1, heightPts);
    // Auto-determine grid: wide garmushka -> 8x2 (16 tiles), tall -> 2x8, standard -> 2x2
    let cols = 2;
    let rows = 2;
    if (aspect >= 2.5) {
      cols = 8;
      rows = 2;
    } else if (aspect <= 0.4) {
      cols = 2;
      rows = 8;
    } else if (aspect >= 1.5) {
      cols = 4;
      rows = 2;
    }

    const tileTargetPx = 1400;
    const tileNormW = 1 / cols;
    const tileNormH = 1 / rows;

    const cropWidthInches = (tileNormW * widthPts) / 72;
    const cropHeightInches = (tileNormH * heightPts) / 72;
    const dpi = Math.min(Math.max(Math.round(Math.min(tileTargetPx / cropWidthInches, tileTargetPx / cropHeightInches)), 72), 400);

    const fullW = Math.round((widthPts / 72) * dpi);
    const fullH = Math.round((heightPts / 72) * dpi);

    // Build tile job list
    const jobs = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        jobs.push({ col: c, row: r });
      }
    }

    const tiles = [];
    const CONCURRENCY = 4; // Utilize all 4 vCPUs in parallel

    async function processTile(job) {
      const { col, row } = job;
      const normX = col * tileNormW;
      const normY = row * tileNormH;
      const pxX = Math.floor(normX * fullW);
      const pxY = Math.floor(normY * fullH);
      const pxW = Math.min(fullW - pxX, Math.ceil(tileNormW * fullW));
      const pxH = Math.min(fullH - pxY, Math.ceil(tileNormH * fullH));

      const outPrefix = path.join(CACHE_DIR, `pretile_${docId}_${col}_${row}_${Date.now()}`);
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
      const webpBuffer = await sharp(pngPath)
        .webp({ quality: 86, effort: 3 })
        .toBuffer();
      try { fs.unlinkSync(pngPath); } catch (_) {}

      const storagePath = `rendered_tiles/${docId}/tile_${col}_${row}.webp`;
      const file = bucket.file(storagePath);
      await file.save(webpBuffer, {
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000',
        },
      });
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      tiles.push({
        col,
        row,
        normX,
        normY,
        normW: tileNormW,
        normH: tileNormH,
        url: publicUrl,
      });
    }

    // Run 4 workers in parallel
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      await Promise.all(jobs.slice(i, i + CONCURRENCY).map(processTile));
    }

    const manifest = {
      docId,
      cols,
      rows,
      widthPts,
      heightPts,
      dpi,
      renderTimeMs: Date.now() - start,
      tiles,
    };

    await manifestFile.save(JSON.stringify(manifest), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=31536000',
      },
    });
    await manifestFile.makePublic();

    return res.status(200).json(manifest);
  } catch (err) {
    console.error('pre-tile error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`SmartShare C++ Tiler listening on port ${PORT}`);
});
