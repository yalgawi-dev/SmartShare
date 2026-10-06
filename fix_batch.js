const fs = require('fs');

let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// --- 1. Fix scroll_pdf dimension crash ---
// Find processMultiPage and the scroll_pdf section
let scrollPdfRegex = /(const pdf = new jsPDF\(\{ orientation: 'p', unit: 'px', format: \[maxWidth, totalHeight\] \}\);\s+let currentY = 0;\s+for \(let i = 0; i < loadedImages\.length; i\+\+\) \{\s+const img = loadedImages\[i\];\s+pdf\.addImage\(urls\[i\], 'JPEG', 0, currentY, img\.width, img\.height\);\s+currentY \+= img\.height;\s+\})/g;

let scrollPdfReplacement = `
                let scale = 1.0;
                if (totalHeight > 14000) {
                    scale = 14000 / totalHeight;
                }
                const pdfHeight = totalHeight * scale;
                const pdfWidth = maxWidth * scale;
                const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [pdfWidth, pdfHeight] });
                
                let currentY = 0;
                for (let i = 0; i < loadedImages.length; i++) {
                   const img = loadedImages[i];
                   const imgW = img.width * scale;
                   const imgH = img.height * scale;
                   pdf.addImage(urls[i], 'JPEG', 0, currentY, imgW, imgH);
                   currentY += imgH;
                }
`;
scanner = scanner.replace(scrollPdfRegex, scrollPdfReplacement);

// --- 2. Fix pending items loop in handleShare and handleDone ---
// We need to replace the pending logic to actually use OpenCV auto-crop instead of just raw resize!

let pendingLogicRegex = /if \(w > 2600\) \{ h = Math\.round\(h \* \(2600 \/ w\)\); w = 2600; \}\s+const canvas = document\.createElement\('canvas'\);\s+canvas\.width = w; canvas\.height = h;\s+const ctx = canvas\.getContext\('2d'\);\s+if \(ctx\) \{\s+ctx\.imageSmoothingEnabled = true; ctx\.imageSmoothingQuality = 'high';\s+ctx\.drawImage\(img, 0, 0, w, h\);\s+const data = compressCanvas\(canvas, 0\.82\);\s+if \(data && data !== 'data:,'\) \{\s+allPageUrls\.push\(data\);\s+\}\s+\}/g;

let autoCropPendingLogic = `
           if (w > 4000) { h = Math.round(h * (4000 / w)); w = 4000; }
           const canvas = document.createElement('canvas');
           canvas.width = w; canvas.height = h;
           const ctx = canvas.getContext('2d');
           if (ctx) {
              ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, w, h);
              
              // Auto-crop magic for batch imports!
              const pts = detectDocument(canvas) || [
                {x: w * 0.1, y: h * 0.1},
                {x: w * 0.9, y: h * 0.1},
                {x: w * 0.9, y: h * 0.9},
                {x: w * 0.1, y: h * 0.9}
              ];
              const snapshotUrl = compressCanvas(canvas, 1.0);
              
              try {
                  const result = await applyPerspectiveAndFilters(snapshotUrl, pts, 'smart_plus');
                  
                  // Now compress the processed smart_plus image
                  const imgProcessed = new Image();
                  imgProcessed.src = result.filtered;
                  await new Promise((r) => { imgProcessed.onload = r; imgProcessed.onerror = r; });
                  
                  const processedCanvas = document.createElement('canvas');
                  processedCanvas.width = imgProcessed.width; processedCanvas.height = imgProcessed.height;
                  const pCtx = processedCanvas.getContext('2d');
                  if (pCtx) {
                      pCtx.drawImage(imgProcessed, 0, 0);
                      const data = compressCanvas(processedCanvas, 0.82);
                      if (data && data !== 'data:,') {
                          allPageUrls.push(data);
                      }
                  }
              } catch (e) {
                  // Fallback to raw if OpenCV fails
                  console.error("Batch crop failed", e);
                  const data = compressCanvas(canvas, 0.82);
                  if (data && data !== 'data:,') {
                      allPageUrls.push(data);
                  }
              }
           }
`;

scanner = scanner.replace(pendingLogicRegex, autoCropPendingLogic);

// --- 3. Fix the unedited loop when scanning a new batch ---
let uneditedLogicRegex = /if \(w > 4000\) \{\s+h = Math\.round\(h \* \(4000 \/ w\)\);\s+w = 4000;\s+\}\s+const canvas = document\.createElement\('canvas'\);\s+canvas\.width = w; canvas\.height = h;\s+const ctx = canvas\.getContext\('2d'\);\s+if \(ctx\) \{\s+ctx\.imageSmoothingEnabled = true; ctx\.imageSmoothingQuality = 'high';\s+ctx\.drawImage\(img, 0, 0, w, h\);\s+newPages\.push\(\{\s+id: pItem\.id,\s+imageUrl: compressCanvas\(canvas, 0\.82\),\s+rawImageUrl: compressCanvas\(canvas, 1\.0\),\s+pageNum: scannedPages\.length \+ \(step !== 'scanning' && \(rawSnapshot \|\| imageCache\[mode\]\) \? 1 : 0\) \+ idx \+ 1\s+\}\);\s+\}/g;

let autoCropUneditedLogic = `
                           if (w > 4000) { h = Math.round(h * (4000 / w)); w = 4000; }
                           const canvas = document.createElement('canvas');
                           canvas.width = w; canvas.height = h;
                           const ctx = canvas.getContext('2d');
                           if (ctx) {
                             ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
                             ctx.drawImage(img, 0, 0, w, h);
                             
                             // Auto-crop magic for batch imports!
                             const pts = detectDocument(canvas) || [
                               {x: w * 0.1, y: h * 0.1},
                               {x: w * 0.9, y: h * 0.1},
                               {x: w * 0.9, y: h * 0.9},
                               {x: w * 0.1, y: h * 0.9}
                             ];
                             const snapshotUrl = compressCanvas(canvas, 1.0);
                             
                             let finalData = compressCanvas(canvas, 0.82);
                             try {
                                 const result = await applyPerspectiveAndFilters(snapshotUrl, pts, 'smart_plus');
                                 const imgProcessed = new Image();
                                 imgProcessed.src = result.filtered;
                                 await new Promise((r) => { imgProcessed.onload = r; imgProcessed.onerror = r; });
                                 const processedCanvas = document.createElement('canvas');
                                 processedCanvas.width = imgProcessed.width; processedCanvas.height = imgProcessed.height;
                                 const pCtx = processedCanvas.getContext('2d');
                                 if (pCtx) {
                                     pCtx.drawImage(imgProcessed, 0, 0);
                                     finalData = compressCanvas(processedCanvas, 0.82);
                                 }
                             } catch (e) {
                                 console.error("Batch crop failed", e);
                             }

                             newPages.push({
                               id: pItem.id,
                               imageUrl: finalData,
                               rawImageUrl: snapshotUrl,
                               pageNum: scannedPages.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0) + idx + 1
                             });
                           }
`;

scanner = scanner.replace(uneditedLogicRegex, autoCropUneditedLogic);


// 4. Update versions
scanner = scanner.replace(/v19\.14/g, 'v19.15');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.72/g, 'v6.5.73');
fs.writeFileSync('src/app/page.tsx', page);

console.log("Applied Batch Auto-Crop and Scroll PDF fix!");
