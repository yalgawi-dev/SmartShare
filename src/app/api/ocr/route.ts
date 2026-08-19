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
    const prompt = "Please read this Israeli invoice/receipt carefully and extract the requested fields. Leave fields null if not found.";

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash-8b',
      contents: [
        { role: 'user', parts: [ { text: prompt }, { inlineData } ] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor: { type: Type.STRING, description: "Name of the business (ספק)" },
            amount: { type: Type.NUMBER, description: "Total amount to pay (סה\"כ לתשלום)" },
            date: { type: Type.STRING, description: "Date of invoice in YYYY-MM-DD format" },
            invoiceNumber: { type: Type.STRING, description: "Invoice number (מספר מסמך)" },
            vatNumber: { type: Type.STRING, description: "VAT Number / Osek Murshe (ח.פ / ע.מ)" }
          }
        }
      }
    });
    const t1 = Date.now();
    const aiTimeMs = t1 - t0;

    let text = response.text || '';
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
  } catch (error) {
    console.error("Cloud OCR Error:", error);
    return NextResponse.json({ error: 'Failed to process OCR' }, { status: 500 });
  }
}

