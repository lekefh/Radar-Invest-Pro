import { NextResponse } from 'next/server'
import { getSession, findById } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ autenticado: false }, { status: 401 })
  }
  return NextResponse.json({
    autenticado: true,
    id:          session.sub,
    nome:        session.nome,
    username:    session.username,
    plano:       session.plano,
  })
}
