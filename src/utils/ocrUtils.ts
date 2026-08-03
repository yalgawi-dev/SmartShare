import Tesseract from 'tesseract.js';

export interface OcrResult {
  amount?: number;
  date?: string;
  vendor?: string;
  rawText: string;
}

export async function extractInvoiceData(imageUrl: string): Promise<OcrResult> {
  const result: OcrResult = { rawText: '' };
  
  try {
    // Run OCR with Hebrew and English
    const { data: { text } } = await Tesseract.recognize(
      imageUrl,
      'heb+eng',
      { logger: m => console.log(m) }
    );
    
    result.rawText = text;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // 1. Extract Amount
    let maxAmount = 0;
    let explicitTotal = 0;
    const amountRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g;
    
    for (const line of lines) {
      const matches = line.match(amountRegex);
      if (matches) {
        for (const match of matches) {
          const val = parseFloat(match.replace(/,/g, ''));
          // Ignore obvious non-amounts like 9-digit IDs, years, or long serials unless explicitly tagged
          if (!isNaN(val) && val > 0 && val < 100000 && match.length < 7) {
            const isTotalLine = /(סה"כ|סך הכל|לתשלום|חשבון|סהכ|סה״כ|יתרה|סכום)/i.test(line);
            if (isTotalLine) {
              if (val > explicitTotal) explicitTotal = val;
            } else if (val > maxAmount) {
              maxAmount = val;
            }
          }
        }
      }
    }
    // Prefer explicit total if found, otherwise fallback to max amount found
    if (explicitTotal > 0) {
      result.amount = explicitTotal;
    } else if (maxAmount > 0) {
      result.amount = maxAmount;
    }
    
    // 2. Extract Date (DD/MM/YYYY or DD.MM.YY)
    const dateRegex = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      let day = dateMatch[1];
      let month = dateMatch[2];
      let year = dateMatch[3];
      if (day.length === 1) day = '0' + day;
      if (month.length === 1) month = '0' + month;
      if (year.length === 2) year = '20' + year;
      result.date = `${year}-${month}-${day}`;
    }
    
    // 3. Extract Vendor - SMART HEURISTIC
    // In Israel, invoices almost always have "עוסק מורשה" (Osek Murshe) or "ח.פ." followed by a 9-digit number.
    // The vendor name is typically 1-2 lines ABOVE this ID number.
    let foundVendor = false;
    for (let i = 0; i < lines.length; i++) {
      if (/(עוסק מורשה|ע"מ|ע\.מ|ח\.פ|ח"פ)/.test(lines[i]) || /\b\d{9}\b/.test(lines[i])) {
        // Look at the previous 1-3 lines for a valid name
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const candidate = lines[j].replace(/[^א-תa-zA-Z0-9 "'-]/g, ' ').replace(/\s+/g, ' ').trim();
          if (candidate.length > 2 && !/^(עוסק מורשה|חשבונית מס|קבלה|חשבונית מס קבלה|ע"מ|ח\.פ|תאריך|שעה|לכבוד|שם לקוח|מקור|העתק|טלפון|פקס|כתובת)/i.test(candidate)) {
            result.vendor = candidate;
            foundVendor = true;
            break;
          }
        }
        if (foundVendor) break;
      }
    }
    
    // Fallback if no ID found: use the first valid looking text line
    if (!foundVendor) {
      for (const line of lines) {
        const cleanedLine = line.replace(/[^א-תa-zA-Z0-9 "'-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanedLine.length > 3 && /[א-ת]/.test(cleanedLine)) {
          if (!/^(עוסק מורשה|חשבונית מס|קבלה|חשבונית מס קבלה|ע"מ|ח\.פ|תאריך|שעה|לכבוד|שם לקוח|מקור|העתק|טלפון|פקס|כתובת|מקור|העתק)/i.test(cleanedLine)) {
             result.vendor = cleanedLine;
             break;
          }
        }
      }
    }
    
  } catch (error) {
    console.error("OCR Error:", error);
  }
  
  return result;
}
