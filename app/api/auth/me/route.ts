import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const sessao = await getSession()
  if (!sessao) {
    return NextResponse.json({ autenticado: false }, { status: 401 })
  }
  return NextResponse.json({ autenticado: true, ...sessao })
}
