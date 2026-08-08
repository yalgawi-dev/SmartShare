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
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ 
        error: 'API Request Failed', 
        status: res.status, 
        details: data 
      }, { status: 500 });
    }

    // Extract just the names of the models
    const availableModels = data.models ? data.models.map((m: any) => m.name) : [];

    return NextResponse.json({ 
      status: 'SUCCESS',
      available_models: availableModels,
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
