

---

## ADR-006: מעבר למנוע PDFium WASM (`@embedpdf/pdfium`) עבור רינדור ו-Focus Slicing
- **החלטה:** להשתמש ב-**PDFium WASM** (מנוע ה-C++ של Chrome, רישיון Apache/BSD) עבור רינדור עמודים, תמונות מוקטנות (`PdfThumbnail`), ו-Focus Slicing בזמן זום.
- **ממה להימנע:**
  1. **אין להשתמש ב-`PDF.js` (`page.render`)** לרינדור קבצי CAD/גרמושקות כבדים (~14–15 שניות לחיתוך לעומת ~0.8 שניות ב-PDFium WASM).
  2. **אין להשתמש ב-`MuPDF` WASM** באפליקציה מסחרית סגורה עקב רישיון AGPL.
  3. **חובה להעביר `bytes.slice()`** ל-`PDF.js` כאשר הוא משמש לקריאת מידות, כדי שה-Worker שלו לא ינתק (`detach`) את ה-`ArrayBuffer` של `PDFium`.
