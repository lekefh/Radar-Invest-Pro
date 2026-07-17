import { NextRequest, NextResponse } from 'next/server'
import { confirmEmail, initUsersTable } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login?erro=token_ausente', req.url))
  }
  await initUsersTable()
  const ok = await confirmEmail(token)
  if (!ok) {
    return NextResponse.redirect(new URL('/login?erro=link_invalido', req.url))
  }
  return NextResponse.redirect(new URL('/login?ativado=1', req.url))
}
