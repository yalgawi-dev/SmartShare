

---

## ADR-006: מעבר למנוע PDFium WASM (`@embedpdf/pdfium`) עבור רינדור, ניתוח מבנה (Dual-Check) ו-Focus Slicing
- **החלטה:** להשתמש ב-**PDFium WASM** (מנוע ה-C++ של Chrome, רישיון Apache/BSD) כמקור אמת ראשי (Single Source of Truth) עבור:
  1. **ניתוח מבנה הקובץ (`analyzePdfStructure` דרך `inspectPdfStructureWithPdfium`):**
     - בדיקת חתימה דיגיטלית ב-C++ (`FPDF_GetSignatureCount`).
     - ספירת תווי טקסט וקטורי חי (`FPDFText_LoadPage` + `FPDFText_CountChars`).
     - זיהוי אובייקטים בעמוד (`FPDFPage_CountObjects` + `FPDFPageObj_GetType`: `TEXT=1`, `PATH/VECTOR=2`, `IMAGE=3`).
  2. **מערכת החלטה "או" (`OR`) לפי ADR סעיפים 1 ו-6 (`isTrueOriginalPdf`):**
     - נשמר כ-**PDF מקורי** אם מתקיים **לפחות אחד ("או")** מהתנאים:
       1. יש חתימה דיגיטלית חוקית (`hasDigitalSignature`) – שימור תוקף משפטי.
       2. **או:** יש שכבת טקסט וקטורי חי (`hasTextLayer`) או נתיבים וקטוריים (`hasVectorPaths`) וצפיפות הדף קלה (`<= 700KB` לעמוד) – אפילו ללא חתימה דיגיטלית!
     - מומר ל-**WebP** אך ורק כאשר מדובר ב**סריקה עטופה (`isWrappedRasterScan`)**: אין חתימה דיגיטלית, והקובץ הוא תמונות סרוקות כבדות (`> 700KB` לעמוד או ללא טקסט/וקטורים).
  3. **חילוץ ורינדור עמודים (`extractAllPagesWithPdfium`, `renderFullPageWithPdfium`, `PdfThumbnail`) ו-Focus Slicing (בשרטוטים רחבים בלבד, ללא הפעלה אוטומטית על דפי A4).**
- **ממה להימנע:**
  1. **אין להשתמש ב-`PDF.js` (`page.render`)** כמנוע ראשי לרינדור או לחילוץ (משמש כ-Fallback בלבד).
  2. **אין להשתמש ב-`MuPDF` WASM** באפליקציה מסחרית סגורה עקב רישיון AGPL.
  3. **חובה להעביר `bytes.slice()`** ל-`PDF.js` כאשר הוא משמש כ-Fallback, כדי שה-Worker שלו לא ינתק (`detach`) את ה-`ArrayBuffer` של `PDFium`.
