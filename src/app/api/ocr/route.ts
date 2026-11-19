import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel

export async function POST(request: Request) {
  try {
    const { imageUrl, vatRate = 17, mode = 'extract' } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI OCR is not configured on the server.' }, { status: 500 });
    }

    let base64Data = '';
    let mimeType = 'image/jpeg';
    
    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(';base64,');
      mimeType = parts[0].split(':')[1];
      base64Data = parts[1];
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) {
         const text = await response.text();
         return NextResponse.json({ error: 'Failed to download image', debugText: text.substring(0, 200) }, { status: 400 });
      }
      const arrayBuffer = await response.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
      mimeType = response.headers.get('content-type') || 'image/jpeg';
    }

    // ── CLASSIFY MODE ────────────────────────────────────────────────────────
    if (mode === 'classify') {
      const classifyPrompt = `Look at this document image. Classify what type of document it is.
Return ONLY a valid JSON object with exactly these fields:
{
  "type": "INVOICE" | "RECEIPT" | "BILL" | "CONTRACT" | "WARRANTY" | "ID_DOC" | "OTHER",
  "confidence": <number 0-100>,
  "reason": "<one short sentence in Hebrew>"
}
Rules:
- INVOICE: חשבונית מס (clearly has VAT number, line items, monetary amounts)
- RECEIPT: קבלה (proof of payment)
- BILL: חשבון תשלום (utility bill, phone bill, etc.)
- CONTRACT: חוזה, הסכם, הצעת מחיר (agreement with text, possibly signatures)
- WARRANTY: תעודת אחריות, אחריות יצרן
- ID_DOC: תעודת זהות, דרכון, רישיון נהיגה
- OTHER: anything else that is NOT a financial document
Be strict about INVOICE/RECEIPT/BILL — require visible monetary amounts and invoice structure.`;

      const classifyRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: classifyPrompt },
              { inlineData: { mimeType, data: base64Data } }
            ]}],
            generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
          })
        }
      );

      if (classifyRes.ok) {
        const classifyData = await classifyRes.json();
        const rawText = classifyData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return NextResponse.json({ classifyResult: JSON.parse(jsonMatch[0]) });
          } catch { /* fall through */ }
        }
      }
      return NextResponse.json({ classifyResult: null });
    }

    const currentYear = new Date().getFullYear();
    const prompt = `
      Please read this Israeli invoice/receipt carefully.
      Return ONLY a valid JSON object with the following keys. If a field is missing, use null.
      
      {
        "vendor": "Name of the business (ספק). Look for the biggest text or logo.",
        "clientName": "Name of the CUSTOMER buying the service (לכבוד / עבור). Do not write the vendor's name here.",
        "amount": Total amount to pay as a NUMBER (סה"כ לתשלום).,
        "vatAmount": The VAT amount as a NUMBER.,
        "documentType": "String: One of ['חשבונית מס', 'קבלה', 'חשבונית מס קבלה', 'תעודת משלוח', 'הצעת מחיר', 'הזמנת עבודה', 'אחר']. Be precise.",
        "date": "Date of invoice in YYYY-MM-DD format. IMPORTANT: Israeli dates are written DD/MM/YY or DD/MM/YYYY. For example, handwritten '12/10/26' means 2026-10-12 (NOT 2021, and NOT month 12). Also beware: the year digits are almost always within 2-3 years of the current year (${currentYear}). Do NOT mistake handwritten '26' for '21'.",
        "isCreditInvoice": true/false (True ONLY if it says "חשבונית זיכוי"),
        "invoiceNumber": "Invoice or Receipt number",
        "vatNumber": "Company VAT Number (ח.פ / ע.מ)"
      }
    `;

    const totalT0 = Date.now();
    let retries = 3;
    let delay = 1000;
    
    let totalWaitMs = 0;
    let retryCount = 0;
    let pureInferenceMs = 0;
    let abortedTimeMs = 0;
    let rawText = '';
    
    // Use the latest flash-lite model for blazing fast OCR
    const model = 'gemini-flash-lite-latest';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    while (retries > 0) {
      if (Date.now() - totalT0 > 55000) {
          throw new Error("FATAL: Google API is completely unresponsive (Timeout exceeded 55s). Please try again later or upgrade your API key.");
      }
      
      const callT0 = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased to 45s to avoid aborting large files/slow Gemini
        
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        pureInferenceMs = Date.now() - callT0;
        
        if (!res.ok) {
           const errText = await res.text();
           const keySuffix = apiKey ? apiKey.slice(-4) : 'NONE';
           
           if (res.status === 402 || errText.includes('depleted') || errText.includes('RESOURCE_EXHAUSTED')) {
              throw new Error(`FATAL: 402 Billing Depleted (Key ending in ${keySuffix})`);
           } else if (res.status === 503 || errText.includes('503') || errText.includes('UNAVAILABLE') || errText.includes('high demand') || res.status === 429) {
              console.warn(`[OCR] Google REST API 503/429 error, retries left: ${retries - 1}`);
              if (retries <= 1) throw new Error(`FATAL_DETAILS (Key ending in ${keySuffix}): ${res.status} - ${errText.substring(0, 150)}`); throw new Error('503_RETRY');
           } else {
              throw new Error(`FATAL: Google API Error ${res.status}: ${errText}`);
           }
        }
        
        const json = await res.json();
        rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!rawText.trim()) {
           console.error("Empty rawText, full json:", JSON.stringify(json));
           rawText = "EMPTY_RESPONSE_DUMP: " + JSON.stringify(json);
        }
        
        break; // Success, exit loop
        
      } catch (err: any) {
         if (err?.name === 'AbortError') {
            abortedTimeMs += (Date.now() - callT0);
            console.warn(`[OCR] Google API request timed out after 20s, retries left: ${retries - 1}`);
         } else if (err?.message === '503_RETRY') {
            abortedTimeMs += (Date.now() - callT0);
         } else if (err?.message?.startsWith('FATAL')) {
            throw err;
         }
         
         retries--;
         retryCount++;
         if (retries === 0) throw new Error(`Google API failed after 3 retries. Last error: ${err?.message || 'Unknown error'}`);
         
         await new Promise(resolve => setTimeout(resolve, delay));
         totalWaitMs += delay;
         delay += 500;
      }
    }
    
    const aiTimeMs = Date.now() - totalT0;
    console.log(`[OCR Timing REST] AI Inference took ${aiTimeMs}ms. Raw Output:`, rawText);
    
    let text = rawText;
    if (text.includes('\`\`\`json')) {
      text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    } else if (text.includes('\`\`\`')) {
       text = text.replace(/\`\`\`/g, '').trim();
    }

        let data: any = {};
    try {
      const parsed = JSON.parse(text);
      // STRICT PRUNING to prevent Firestore "invalid nested array" crashes from Gemini hallucinations
      data = {
        vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
        clientName: typeof parsed.clientName === 'string' ? parsed.clientName : null,
        amount: typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount) || null,
        vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : Number(parsed.vatAmount) || null,
        documentType: typeof parsed.documentType === 'string' ? parsed.documentType : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        isCreditInvoice: !!parsed.isCreditInvoice,
        invoiceNumber: typeof parsed.invoiceNumber === 'string' ? parsed.invoiceNumber : (parsed.invoiceNumber ? String(parsed.invoiceNumber) : null),
        vatNumber: typeof parsed.vatNumber === 'string' ? parsed.vatNumber : (parsed.vatNumber ? String(parsed.vatNumber) : null),
      };
      
      // --- POST-PROCESSING: Fix Date Hallucinations ---
      if (data.date && typeof data.date === 'string') {
        const parts = data.date.split('-');
        if (parts.length === 3) {
          let [year, month, day] = parts.map(p => parseInt(p, 10));
          const currentYear = new Date().getFullYear();
          // If year was misread as 2021 or 201x while we are around 2024-2027, check if last digit was 6/something
          if (year < currentYear - 3 && year >= 2020) {
            // e.g. 2021 when current is 2026: often '6' misread as '1' in handwritten Hebrew dates
            const lastDigit = year % 10;
            if (lastDigit === 1 && currentYear % 10 === 6) {
              year = currentYear;
            }
          }
          // Validate month & day bounds
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            data.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }
      if (data.clientName && data.vendor && typeof data.clientName === 'string' && typeof data.vendor === 'string') {
        const cName = data.clientName.trim().toLowerCase();
        const vName = data.vendor.trim().toLowerCase();
        
        // --- POST-PROCESSING: Calculate VAT if missing ---
      if (data.amount && !data.vatAmount) {
        // Calculate VAT component from the total amount
        const vatComponent = data.amount - (data.amount / (1 + (vatRate / 100)));
        data.vatAmount = Number(vatComponent.toFixed(2));
      }
      
      if (cName === vName || cName.includes(vName) || vName.includes(cName)) {
          data.clientName = null;
        }
      }
      if (!data.vendor && !data.amount && !data.date) {
         return NextResponse.json({ 
           error: 'לא זיהינו פרטי חשבונית או קבלה בתמונה. ייתכן שמדובר במסמך כללי או שהטקסט לא ברור מספיק.', 
           debugRaw: text, 
           aiTimeMs, retryCount, pureInferenceMs, totalWaitMs, abortedTimeMs
         }, { status: 400 });
      }
    } catch(e) {
      return NextResponse.json({ error: 'לא הצלחנו לפענח את הנתונים מהתמונה. אנא ודא שהתמונה ברורה ונסה שוב.', debugRaw: text, aiTimeMs, retryCount, pureInferenceMs, totalWaitMs, abortedTimeMs }, { status: 400 });
    }

    data._debug = { aiTimeMs, retryCount, pureInferenceMs, totalWaitMs, abortedTimeMs };
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Cloud OCR REST Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process OCR', stack: error.stack }, { status: 500 });
  }
}
