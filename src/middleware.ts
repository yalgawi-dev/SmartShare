import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.method === 'POST' && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/share-target';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/']
};
