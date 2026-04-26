import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_IPS = [
  '1.2.3.4', // ⬅️ put the IPs you want to block here
  '5.6.7.8',
]

export function middleware(request: NextRequest) {
  // Get user IP (Vercel safe method)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.ip ||
    'unknown'

  // Debug (optional)
  console.log('Visitor IP:', ip)

  // Block logic
  if (BLOCKED_IPS.includes(ip)) {
    return new NextResponse(ip)
  }

  return NextResponse.next()
}

// Run middleware on all routes
export const config = {
  matcher: '/:path*',
}
