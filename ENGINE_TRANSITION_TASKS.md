# יומן מעקב ופרישת מנועים ישנים (Engine Transition & Cleanup Tracker)
# תאריך עדכון אחרון: 22/10/2026 (v2.6.9)

מסמך זה מהווה מקור יחיד (Single Source of Truth) למעקב אחר מנועים ישנים או ניסיוניים שהושארו בקוד לבדיקה, לצורך הסרתם המבוקרת לאחר אישור המשתמש (בהתאם לחוקים 12 ו-14).

---

## 📌 משימה 1: מנוע דחיסת תמונות (Image Compression Engine)
* **מיקום בקוד:** `src/utils/imageOptimizer.ts`
* **מצב נוכחי (v2.6.9):**
  - **מנוע פעיל ראשי:** מנוע **WebP** החדש (`compressCanvasWebP`, `compressImageWebP`, `compressToBudgetWebP`). כל הצינורות באפליקציה (`compressImage`, `compressCanvas`, `compressToBudget`, `downscaleBase64`, `convertPdfToOptimizedImage`, `extractPdfPages`) חוברו למנוע ה-WebP החדש.
  - **מנוע ישן מנותק (לשימור זמני):** מנוע ה-**JPEG** הוותיק (`legacyCompressCanvasJPEG`, `legacyCompressImageJPEG`, `legacyCompressToBudgetJPEG`) הושאר בקוד כמנוע גיבוי (Fallback) במקרה של דפדפן ישן ללא תמיכת WebP, אך נותק מכל הצינורות הפעילים.
* **פעולה נדרשת לסיום:**
  - לאחר שהמשתמש יבחן בייצור את פעולת ה-WebP (משקל קבצים קטן משמעותית, חדות מעולה וזמני טעינה מיידיים), לקבל את אישורו למחוק את פונקציות ה-JPEG הישנות כדי למנוע קוד מת.

---

## 📌 משימה 2: מנועי פילטרים וסריקה (Scanner Processing Engines)
* **מיקום בקוד:** `src/components/widgets/ScannerModal.tsx`, `src/utils/opencvFilters.ts`
* **מצב נוכחי:**
  - **מנוע פעיל ראשי:** `smart_plus` (מנוע הניקוי החכם לסריקת מסמכים).
  - **מנועים ישנים/ניסיוניים שנשמרו ל-A/B Testing:**
    1. `experimental` (Background Division algorithm) - כפתור ניסיוני בממשק הסורק.
    2. `hybrid` ו-`hybrid_shadow` - מנועי פילטרים קודמים שנשמרו לבדיקות.
* **פעולה נדרשת לסיום:**
  - ביצוע בדיקת איכות סופית מול המשתמש בסורק.
  - באישור המשתמש: הסרת המצבים `experimental` ו-`hybrid_shadow` והשארת `smart_plus` כמנוע בלעדי, רזה ונקי.

---

## 🔔 תזכורת חובה לסוכן (Agent Standing Directive)
בכל שיחה או סבב פיתוח, יש לעיין במסמך זה ולהציף למשתמש את סטטוס המנועים הממתינים למחיקה, כדי להבטיח קוד רזה, מודולרי וללא מנועים לא מנוצלים.
