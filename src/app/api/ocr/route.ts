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
      Return ONLY a raw JSON object (no markdown, no backticks, no markdown codeblocks) with exactly these fields:
      {
        "vendor": "Name of the business (ספק)",
        "amount": Total amount to pay as a number (סה"כ לתשלום),
        "date": "Date of invoice in YYYY-MM-DD format",
        "invoiceNumber": "Invoice number or Receipt number (מספר מסמך / חשבונית)",
        "vatNumber": "Company VAT Number / Osek Murshe (ח.פ / עוסק מורשה)"
      }
      If you cannot find a field, leave it null. Do not include any other text.
    `;

    const totalT0 = Date.now();
    let retries = 3;
    let delay = 1000;
    
    let totalWaitMs = 0;
    let retryCount = 0;
    let pureInferenceMs = 0;
    let rawText = '';
    
    // We will use the lightweight and fast 1.5-flash-8b model via REST
    const model = 'gemini-1.5-flash-8b';
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
      const callT0 = Date.now();
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        pureInferenceMs = Date.now() - callT0;
        
        if (!res.ok) {
           const errText = await res.text();
           if (res.status === 503 || errText.includes('503') || errText.includes('UNAVAILABLE') || errText.includes('high demand')) {
              console.warn(`[OCR] Google REST API 503 error, retries left: ${retries - 1}`);
              retries--;
              retryCount++;
              if (retries === 0) throw new Error(`Google API failed after retries: ${errText}`);
              await new Promise(resolve => setTimeout(resolve, delay));
              totalWaitMs += delay;
              delay += 500;
              continue; // Try again
           } else {
              throw new Error(`Google API Error ${res.status}: ${errText}`);
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
         if (retries === 0) throw err;
         retries--;
         retryCount++;
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
           aiTimeMs, retryCount, pureInferenceMs, totalWaitMs
         }, { status: 400 });
      }
    } catch(e) {
      return NextResponse.json({ error: 'Failed to parse Gemini JSON. Raw output: ' + text, debugRaw: text, aiTimeMs, retryCount, pureInferenceMs, totalWaitMs }, { status: 400 });
    }

    data._debug = { aiTimeMs, retryCount, pureInferenceMs, totalWaitMs };
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Cloud OCR REST Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process OCR', stack: error.stack }, { status: 500 });
  }
}
