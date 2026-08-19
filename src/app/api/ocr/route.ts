import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, customKey } = body;
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    const apiKey = customKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing from environment variables.");
      return NextResponse.json({ error: 'AI OCR is not configured on the server.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    let inlineData = undefined;
    if (imageUrl.startsWith('data:image')) {
      const parts = imageUrl.split(';base64,');
      const mimeType = parts[0].split(':')[1];
      const data = parts[1];
      inlineData = { data, mimeType };
    } else {
      const response = await fetch(imageUrl);
      if (!response.ok) {
         console.error("Failed to fetch Firebase image:", response.status, response.statusText);
         const text = await response.text();
         return NextResponse.json({ error: 'Failed to download image from cloud storage', debugStatus: response.status, debugText: text.substring(0, 200) }, { status: 400 });
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      inlineData = {
        data: buffer.toString('base64'),
        mimeType: response.headers.get('content-type') || 'image/jpeg'
      };
    }

    const t0 = Date.now();
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

    let response = null;
    let retries = 5;
    let delay = 2000;
    
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: [
            { role: 'user', parts: [ { text: prompt }, { inlineData } ] }
          ]
        });
        break; // Success, exit loop
      } catch (err: any) {
        if (err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE') || err.message?.includes('high demand')) {
          console.warn(`[OCR] Google API 503 error, retries left: ${retries - 1}`);
          retries--;
          if (retries === 0) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff (1s, 2s)
        } else {
          throw err; // Not a 503, fail immediately
        }
      }
    }
    const t1 = Date.now();
    const aiTimeMs = t1 - t0;

    let text = response?.text || '';
    console.log(`[OCR Timing] AI Inference took ${aiTimeMs}ms. Raw Output:`, text);
    
    // Clean up potential markdown formatting from Gemini
    if (text.includes('\`\`\`json')) {
      text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    } else if (text.includes('\`\`\`')) {
       text = text.replace(/\`\`\`/g, '').trim();
    }

    let data: any = {};
    try {
      data = JSON.parse(text);
      // Validate that we didn't just get an empty object
      if (!data.vendor && !data.amount && !data.date) {
         console.warn("Gemini returned empty data:", text);
         return NextResponse.json({ 
           error: 'Gemini could not find any data in the image.', 
           debugRaw: text, 
           debugMime: inlineData?.mimeType, 
           debugLength: inlineData?.data?.length,
           aiTimeMs
         }, { status: 400 });
      }
    } catch(e) {
      console.error("JSON parse error:", e, text);
      return NextResponse.json({ error: 'Failed to parse Gemini JSON', debugRaw: text, aiTimeMs }, { status: 400 });
    }

    // Attach timing info to the successful response
    data._debug = { aiTimeMs };

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Cloud OCR Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process OCR', stack: error.stack }, { status: 500 });
  }
}


