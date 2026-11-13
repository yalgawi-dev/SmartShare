const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

// Lazy-load heavier libraries only when a request actually arrives,
// preventing deployment timeouts during cold discovery.
let pdfjsLib = null;
let createCanvas = null;
let sharp = null;

function getDependencies() {
  if (!pdfjsLib) {
    pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = false;
  }
  if (!createCanvas) {
    const napi = require("@napi-rs/canvas");
    createCanvas = napi.createCanvas;
  }
  if (!sharp) {
    sharp = require("sharp");
  }
  return { pdfjsLib, createCanvas, sharp };
}

class NodeCanvasFactory {
  constructor(canvasFn) {
    this.createCanvas = canvasFn;
  }

  create(width, height) {
    const canvas = this.createCanvas(width, height);
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
 * Converts a PDF page (blueprint / garmushka) into an ultra-sharp WebP image (~4500px width).
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
        const { pdfUrl, page = 1, targetWidth = 4500, quality = 85 } = req.query;

        if (!pdfUrl) {
          return res.status(400).json({ error: "Missing required parameter: pdfUrl" });
        }

        const pageNum = parseInt(page, 10) || 1;
        const widthLimit = Math.min(Math.max(parseInt(targetWidth, 10) || 4500, 1000), 6000);
        const webpQuality = Math.min(Math.max(parseInt(quality, 10) || 85, 50), 100);

        const { pdfjsLib: pdfjs, createCanvas: cvsFn, sharp: shp } = getDependencies();

        // Fetch PDF file buffer
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
          return res.status(502).json({ error: `Failed to fetch PDF: ${pdfResponse.statusText}` });
        }
        const arrayBuffer = await pdfResponse.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Load PDF document
        const loadingTask = pdfjs.getDocument({
          data: uint8Array,
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

        // Calculate scale to achieve targetWidth
        const scale = widthLimit / initialViewport.width;
        const viewport = pdfPage.getViewport({ scale });

        // Create canvas with calculated dimensions
        const canvasFactory = new NodeCanvasFactory(cvsFn);
        const canvasAndContext = canvasFactory.create(
          Math.floor(viewport.width),
          Math.floor(viewport.height)
        );

        const renderContext = {
          canvasContext: canvasAndContext.context,
          viewport: viewport,
          canvasFactory: canvasFactory,
        };

        await pdfPage.render(renderContext).promise;

        // Extract raw buffer and compress to WebP using sharp
        const rawPngBuffer = canvasAndContext.canvas.toBuffer("image/png");
        canvasFactory.destroy(canvasAndContext);

        const webpBuffer = await shp(rawPngBuffer)
          .webp({ quality: webpQuality, effort: 4 })
          .toBuffer();

        // Send high-res WebP image
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
