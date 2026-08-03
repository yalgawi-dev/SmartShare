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
    // Regex for numbers with optional decimals (e.g., 1,234.56 or 123.4)
    const amountRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/g;
    
    for (const line of lines) {
      const matches = line.match(amountRegex);
      if (matches) {
        for (const match of matches) {
          const val = parseFloat(match.replace(/,/g, ''));
          // Reasonable limits for a single receipt
          if (!isNaN(val) && val > 0 && val < 200000) {
            const isTotalLine = /(סה"כ|סך הכל|לתשלום|חשבון|סהכ|סה״כ)/i.test(line);
            if (isTotalLine) {
              // If it's explicitly labeled as total, we prefer it unless we already found a bigger explicitly labeled one.
              if (val > maxAmount) maxAmount = val;
            } else if (val > maxAmount) {
              // Otherwise, just keep track of the largest number (often the total)
              maxAmount = val;
            }
          }
        }
      }
    }
    if (maxAmount > 0) result.amount = maxAmount;
    
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
      result.date = `${year}-${month}-${day}`; // input type="date" format
    }
    
    // 3. Extract Vendor
    // Usually the first or second line with Hebrew letters.
    // Must be at least 4 chars and ideally contain at least two words or be a long word.
    for (const line of lines) {
      if (line.length > 3 && /[א-ת]/.test(line)) {
        const cleanedLine = line.replace(/[^א-תa-zA-Z0-9 "'-]/g, ' ').replace(/\s+/g, ' ').trim();
        // Exclude common non-vendor header words if they are the ONLY thing on the line
        if (
          !/^(עוסק מורשה|חשבונית מס|קבלה|חשבונית מס קבלה|ע"מ|ח\.פ|תאריך|שעה|לכבוד|שם לקוח|מקור|העתק|טלפון|פקס|כתובת)/i.test(cleanedLine) &&
          cleanedLine.length > 3
        ) {
           result.vendor = cleanedLine;
           break;
        }
      }
    }
    
  } catch (error) {
    console.error("OCR Error:", error);
  }
  
  return result;
}
