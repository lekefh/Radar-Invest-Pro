import { NextRequest, NextResponse } from 'next/server'
import { confirmEmail, initUsersTable } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ erro: 'Token ausente.' }, { status: 400 })
  }
  await initUsersTable()
  const ok = await confirmEmail(token)
  if (!ok) {
    return NextResponse.json({ erro: 'Link inválido ou expirado.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, mensagem: 'E-mail confirmado! Você já pode fazer login.' })
}
