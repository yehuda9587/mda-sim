import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Put blocked IPs here
const BLOCKED_IPS = [
  '1.2.3.4',
  '5.6.7.8',
]

export function middleware(request: NextRequest) {
  // Get IP (safe version)
  const ip =
    request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''

  // Debug (optional)
  console.log('Visitor IP:', ip)

  // Block check
  if (BLOCKED_IPS.includes(ip)) {
    return new NextResponse('Access denied', { status: 403 })
  }

  return NextResponse.next()
}

// Apply to all routes
export const config = {
  matcher: '/:path*',
}
