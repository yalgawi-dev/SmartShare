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
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      inlineData = {
        data: buffer.toString('base64'),
        mimeType: response.headers.get('content-type') || 'image/jpeg'
      };
    }

    const prompt = `
      You are an expert Israeli accountant AI. Your job is to extract exact billing data from the provided image of an Israeli invoice/receipt (חשבונית מס / קבלה).
      
      Extract the following fields and return ONLY a valid JSON object without markdown formatting. If a field cannot be found with high confidence, set its value to null.
      
      {
        "vendor": "String. The name of the business (ספק). Look at the top logo or the biggest text at the header. Do NOT include legal prefixes/suffixes like 'עוסק מורשה' or 'ח.פ.', just the pure business name.",
        "amount": "Number (float). The FINAL total amount to pay (סה\"כ לתשלום / סך הכל / לתשלום). Look for the highest monetary value usually at the bottom. Do NOT confuse with sub-total (סה\"כ לפני מע\"מ), VAT amount (סכום מע\"מ), or phone numbers. Return ONLY the number without currency symbols.",
        "date": "String in YYYY-MM-DD format. The date the invoice was issued (תאריך חשבונית / תאריך הפקה / תאריך). CRITICAL: Do NOT extract the 'Pay by' date (לתשלום עד) or 'Value date' (תאריך ערך)!",
        "vatNumber": "String. The 9-digit Osek Murshe (עוסק מורשה) or Het Pe (ח.פ) number. It is usually 9 digits long.",
        "invoiceNumber": "String. The invoice or receipt number (מספר חשבונית / מס' קבלה). Usually located at the top near the date."
      }
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
