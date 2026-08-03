import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'Missing GEMINI_API_KEY', 
        vendor: 'שגיאה: חסר מפתח API',
        amount: 0 
      }, { status: 500 });
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
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      inlineData = {
        data: buffer.toString('base64'),
        mimeType: response.headers.get('content-type') || 'image/jpeg'
      };
    }

    const prompt = `
      You are an expert Israeli accountant. Analyze this invoice/receipt.
      Extract the following information and return ONLY a valid JSON object without markdown formatting:
      {
        "vendor": "Name of the business. Do not include the words 'עוסק מורשה' or 'ח.פ.', just the pure business name. Find the name usually above the Osek Murshe number.",
        "amount": Total final amount to pay (number only, no currency symbol. Make sure it's the total including VAT (סה"כ לתשלום) and not a phone number),
        "date": "Date of the invoice in YYYY-MM-DD format (if found)",
        "vatNumber": "The 9-digit Osek Murshe (עוסק מורשה) or Het Pe (ח.פ) number"
      }
      If a field is not found, leave it as null.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [ { text: prompt }, { inlineData } ] }
      ]
    });

    const text = response.text || '';
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Cloud OCR Error:", error);
    return NextResponse.json({ error: 'Failed to process OCR' }, { status: 500 });
  }
}
