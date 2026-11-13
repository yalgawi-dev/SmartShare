const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

// Alias canvas to @napi-rs/canvas inside Node module cache so pdfjs-dist finds it cleanly!
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "canvas") {
    return originalRequire.call(this, "@napi-rs/canvas");
  }
  return originalRequire.call(this, id);
};

let pdfjsLib = null;
let napiCanvas = null;
let sharp = null;

// In-memory LRU cache for PDF bytes on warm instances (avoids re-downloading 20MB on every zoom/pan)
const pdfBytesCache = new Map();
const MAX_CACHED_PDFS = 3;

function getDependencies() {
  if (!napiCanvas) {
    napiCanvas = require("@napi-rs/canvas");
  }
  if (!pdfjsLib) {
    pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = false;
  }
  if (!sharp) {
    sharp = require("sharp");
  }
  return { pdfjsLib, napiCanvas, sharp };
}

class NodeCanvasFactory {
  create(width, height) {
    const canvas = napiCanvas.createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * renderBlueprint:
 * Converts a PDF page (or a specific normalized viewport crop) into an ultra-sharp WebP image.
 */
exports.renderBlueprint = onRequest(
  {
    memory: "2GiB",
    timeoutSeconds: 120,
    cors: true,
    invoker: "public",
  },
  (req, res) => {
    return cors(req, res, async () => {
      try {
        const {
          pdfUrl,
          page = 1,
          targetWidth = 4500,
          quality = 85,
          cropX,
          cropY,
          cropW,
          cropH,
          canvasW,
          canvasH,
        } = req.query;

        if (!pdfUrl) {
          return res.status(400).json({ error: "Missing required parameter: pdfUrl" });
        }

        const pageNum = parseInt(page, 10) || 1;
        const widthLimit = Math.min(Math.max(parseInt(targetWidth, 10) || 4500, 1000), 6000);
        const webpQuality = Math.min(Math.max(parseInt(quality, 10) || 85, 50), 100);

        const { pdfjsLib: pdfjs, sharp: shp } = getDependencies();

        // Check warm instance cache first
        let uint8Array = pdfBytesCache.get(pdfUrl);
        if (!uint8Array) {
          const pdfResponse = await fetch(pdfUrl);
          if (!pdfResponse.ok) {
            return res.status(502).json({ error: `Failed to fetch PDF: ${pdfResponse.statusText}` });
          }
          const arrayBuffer = await pdfResponse.arrayBuffer();
          uint8Array = new Uint8Array(arrayBuffer);

          if (pdfBytesCache.size >= MAX_CACHED_PDFS) {
            const firstKey = pdfBytesCache.keys().next().value;
            pdfBytesCache.delete(firstKey);
          }
          pdfBytesCache.set(pdfUrl, uint8Array);
        }

        const loadingTask = pdfjs.getDocument({
          data: uint8Array.slice(), // pass a copy so worker/parser doesn't detach cached buffer
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/",
        });

        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        if (pageNum < 1 || pageNum > totalPages) {
          return res.status(400).json({ error: `Page ${pageNum} out of range (1 - ${totalPages})` });
        }

        const pdfPage = await pdfDoc.getPage(pageNum);
        const initialViewport = pdfPage.getViewport({ scale: 1.0 });

        const hasCrop =
          cropX !== undefined &&
          cropY !== undefined &&
          cropW !== undefined &&
          cropH !== undefined;

        const canvasFactory = new NodeCanvasFactory();
        let canvasAndContext;

        if (hasCrop) {
          // Focused Viewport Slicing mode
          const normX = Math.max(0, Math.min(1, parseFloat(cropX) || 0));
          const normY = Math.max(0, Math.min(1, parseFloat(cropY) || 0));
          const normW = Math.max(0.01, Math.min(1 - normX, parseFloat(cropW) || 1));
          const normH = Math.max(0.01, Math.min(1 - normY, parseFloat(cropH) || 1));

          const outW = Math.min(Math.max(parseInt(canvasW, 10) || 1000, 100), 3000);
          const outH = Math.min(Math.max(parseInt(canvasH, 10) || 1600, 100), 3000);

          const pdfX = normX * initialViewport.width;
          const pdfY = normY * initialViewport.height;
          const pdfW = normW * initialViewport.width;
          const pdfH = normH * initialViewport.height;

          const renderScale = Math.min(outW / pdfW, outH / pdfH);
          const scaledViewport = pdfPage.getViewport({ scale: renderScale });

          canvasAndContext = canvasFactory.create(outW, outH);
          canvasAndContext.context.fillStyle = "#ffffff";
          canvasAndContext.context.fillRect(0, 0, outW, outH);

          const transform = [1, 0, 0, 1, -pdfX * renderScale, -pdfY * renderScale];

          await pdfPage.render({
            canvasContext: canvasAndContext.context,
            viewport: scaledViewport,
            transform,
            canvasFactory,
          }).promise;
        } else {
          // Full page mode
          const unscaledMax = Math.max(initialViewport.width, initialViewport.height);
          const scale = Math.min(widthLimit / unscaledMax, 30000 / unscaledMax);
          const viewport = pdfPage.getViewport({ scale });

          canvasAndContext = canvasFactory.create(
            Math.floor(viewport.width),
            Math.floor(viewport.height)
          );
          canvasAndContext.context.fillStyle = "#ffffff";
          canvasAndContext.context.fillRect(0, 0, canvasAndContext.canvas.width, canvasAndContext.canvas.height);

          await pdfPage.render({
            canvasContext: canvasAndContext.context,
            viewport,
            canvasFactory,
          }).promise;
        }

        const rawPngBuffer = canvasAndContext.canvas.toBuffer("image/png");
        canvasFactory.destroy(canvasAndContext);

        const webpBuffer = await shp(rawPngBuffer)
          .webp({ quality: webpQuality, effort: 4 })
          .toBuffer();

        res.set("Content-Type", "image/webp");
        res.set("Cache-Control", "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400");
        return res.status(200).send(webpBuffer);
      } catch (err) {
        console.error("renderBlueprint error:", err);
        return res.status(500).json({ error: err.message || "Internal server error" });
      }
    });
  }
);
