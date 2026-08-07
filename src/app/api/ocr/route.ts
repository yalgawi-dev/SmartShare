import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Allow up to 60 seconds on Vercel

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
      Please read this Israeli invoice/receipt carefully.
      Do not format as JSON. Just write down the raw text you see, specifically:
      1. What is the name of the business (Vendor / ספק)?
      2. What is the total amount to pay (סה"כ לתשלום)?
      3. What is the date?
      Just give me the raw answers so I can debug if you see the text properly.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: [
        { role: 'user', parts: [ { text: prompt }, { inlineData } ] }
      ]
    });

    const text = response.text || 'No text returned from Gemini.';
    console.log("Raw Gemini Output:", text);
    
    // We mock the data so the UI doesn't crash, but we pass the raw text in the debug field
    return NextResponse.json({ 
      vendor: "RAW DEBUG MODE", 
      amount: 1, 
      date: "2000-01-01" 
    }, {
      // Use headers to send the raw debug text without failing the JSON parse on the client
      headers: {
        'x-debug-raw-text': encodeURIComponent(text)
      }
    });
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
