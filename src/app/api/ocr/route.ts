import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI OCR is not configured on the server.' }, { status: 500 });
    }

    let base64Data = '';
    let mimeType = 'image/jpeg';
    
    if (imageUrl.startsWith('data:image')) {
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

    const prompt = `
      Please read this Israeli invoice/receipt carefully.
      Extract the following fields and return them strictly in the JSON format requested by the schema.
      - "vendor": Name of the business (ספק). Look for the biggest text or the logo at the top.
      - "amount": Total amount to pay as a number (סה"כ לתשלום / סכום כולל מע"מ).
      - "date": Date of invoice in YYYY-MM-DD format.
      - "invoiceNumber": Invoice number or Receipt number (מספר מסמך / חשבונית / קבלה).
      - "vatNumber": Company VAT Number / Osek Murshe (ח.פ / עוסק מורשה / ע.מ). Usually a 9 digit number.
      
      If you cannot find a field, leave it null.
    `;

    const totalT0 = Date.now();
    let retries = 3;
    let delay = 1000;
    
    let totalWaitMs = 0;
    let retryCount = 0;
    let pureInferenceMs = 0;
    let abortedTimeMs = 0;
    let rawText = '';
    
    // We MUST use gemini-3.6-flash as Google deprecated 2.5 for new users
    const model = 'gemini-3.6-flash';
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
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            vendor: { type: "STRING", description: "Name of the business (ספק)" },
            amount: { type: "NUMBER", description: "Total amount to pay (סה\"כ לתשלום)" },
            date: { type: "STRING", description: "Date of invoice in YYYY-MM-DD format" },
            invoiceNumber: { type: "STRING", description: "Invoice number (מספר מסמך)" },
            vatNumber: { type: "STRING", description: "VAT Number / Osek Murshe (ח.פ / ע.מ)" }
          }
        }
      }
    };

    while (retries > 0) {
      if (Date.now() - totalT0 > 50000) {
          throw new Error("FATAL: Google API is completely unresponsive (Timeout exceeded 50s). Please try again later or upgrade your API key.");
      }
      
      const callT0 = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout per attempt
        
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
           if (res.status === 503 || errText.includes('503') || errText.includes('UNAVAILABLE') || errText.includes('high demand') || res.status === 429) {
              console.warn(`[OCR] Google REST API 503/429 error, retries left: ${retries - 1}`);
              throw new Error('503_RETRY');
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
      data = JSON.parse(text);
      if (!data.vendor && !data.amount && !data.date) {
         return NextResponse.json({ 
           error: 'Gemini could not find any data in the image. Raw output: ' + text, 
           debugRaw: text, 
           aiTimeMs, retryCount, pureInferenceMs, totalWaitMs, abortedTimeMs
         }, { status: 400 });
      }
    } catch(e) {
      return NextResponse.json({ error: 'Failed to parse Gemini JSON. Raw output: ' + text, debugRaw: text, aiTimeMs, retryCount, pureInferenceMs, totalWaitMs, abortedTimeMs }, { status: 400 });
    }

    data._debug = { aiTimeMs, retryCount, pureInferenceMs, totalWaitMs, abortedTimeMs };
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Cloud OCR REST Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process OCR', stack: error.stack }, { status: 500 });
  }
}
