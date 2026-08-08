import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key ? key.length : 0,
    prefix: key ? key.substring(0, 4) : null,
    envKeys: Object.keys(process.env).filter(k => k.includes('GEMINI'))
  });
}
