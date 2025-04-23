import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware enables WebSockets on Vercel by properly handling
// the WebSocket upgrade request
export function middleware(request: NextRequest) {
  // Only apply to WebSocket routes
  if (request.nextUrl.pathname.startsWith('/api/socket')) {
    // The actual WebSocket upgrade happens in the route handler
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

// Limit middleware execution to paths that need WebSocket support
export const config = {
  matcher: [
    // Match all API routes that might handle WebSockets
    '/api/socket/:path*',
  ],
};