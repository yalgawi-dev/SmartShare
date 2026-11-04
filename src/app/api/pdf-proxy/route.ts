import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');
  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return new NextResponse(`Failed to fetch remote PDF: ${res.statusText}`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/pdf';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    console.error('PDF proxy error:', err);
    return new NextResponse(err?.message || 'Proxy error', { status: 500 });
  }
}
