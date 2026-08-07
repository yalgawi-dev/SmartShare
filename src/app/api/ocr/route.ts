import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing from environment variables.");
      return NextResponse.json({ error: 'AI OCR is not configured on the server.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
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

    const prompt = `
      You are an expert Israeli accountant AI. Extract exact billing data from this Israeli invoice/receipt.
      
      RULES FOR EXTRACTION:
      1. vendor: The name of the business (ספק). Look at the top logo or biggest text. Ignore legal prefixes like 'עוסק מורשה' or 'ח.פ.'.
      2. amount: The FINAL total amount to pay (סה"כ לתשלום). Do NOT extract sub-total or VAT amount. Return ONLY the number.
      3. date: The invoice issue date in YYYY-MM-DD format (תאריך חשבונית). CRITICAL: Ignore 'Pay by' (לתשלום עד) or 'Value date' (תאריך ערך).
      4. vatNumber: The 9-digit Osek Murshe (עוסק מורשה / ח.פ).
      5. invoiceNumber: The invoice or receipt number (מספר חשבונית / מס' קבלה).

      Return ONLY a valid raw JSON object exactly like this template (use null if not found):
      {
        "vendor": "string or null",
        "amount": 123.45,
        "date": "2024-01-01",
        "vatNumber": "123456789",
        "invoiceNumber": "string or null"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: [
        { role: 'user', parts: [ { text: prompt }, { inlineData } ] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            vendor: { type: "STRING", description: "The name of the business/supplier. Ignore legal prefixes." },
            amount: { type: "NUMBER", description: "The final total amount to pay (סה\"כ לתשלום)." },
            date: { type: "STRING", description: "The invoice issue date in YYYY-MM-DD format." },
            vatNumber: { type: "STRING", description: "The 9-digit Osek Murshe / Het Pe number." },
            invoiceNumber: { type: "STRING", description: "The invoice or receipt number." }
          }
        }
      }
    });

    const text = response.text || '{}';
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
           debugLength: inlineData?.data?.length 
         }, { status: 400 });
      }
    } catch(e) {
      console.error("JSON parse error:", e, text);
      return NextResponse.json({ error: 'Failed to parse Gemini JSON', debugRaw: text }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Cloud OCR Error:", error);
    return NextResponse.json({ error: 'Failed to process OCR' }, { status: 500 });
  }
}
