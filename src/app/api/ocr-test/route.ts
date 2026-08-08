import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customKey = searchParams.get('key');
    const apiKey = customKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    // Test if we can actually initialize the SDK and make a real call
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Test a tiny generation call to verify the key works for inference, not just listing models
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        { role: 'user', parts: [{ text: 'Reply with the word BINGO' }] }
      ]
    });

    return NextResponse.json({ 
      status: 'SUCCESS',
      model_response: response.text,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Test OCR Error:", error);
    return NextResponse.json({ 
      error: 'API Connection Failed',
      message: error.message,
    }, { status: 500 });
  }
}
