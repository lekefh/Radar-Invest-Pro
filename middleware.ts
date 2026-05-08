import { NextRequest, NextResponse } from 'next/server'

const PROTEGIDAS = ['/dashboard', '/carteira', '/dcf', '/admin']

export function middleware(req: NextRequest) {
  const token = req.cookies.get('radar_token')?.value
  const { pathname } = req.nextUrl

  if (PROTEGIDAS.some(r => pathname.startsWith(r)) && !token) {
    const url = new URL('/login', req.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/carteira/:path*',
    '/dcf/:path*',
    '/admin/:path*',
  ],
}
