import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

function db() {
  return neon(process.env.DATABASE_URL!)
}

function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }

    const { telefone } = await req.json()
    if (!telefone?.trim()) {
      return NextResponse.json({ erro: 'Informe o celular.' }, { status: 400 })
    }

    const digitos = apenasDigitos(telefone)
    if (digitos.length < 10 || digitos.length > 11) {
      return NextResponse.json({ erro: 'Informe um celular válido com DDD.' }, { status: 400 })
    }

    const sql = db()
    await sql`
      UPDATE usuarios_web
      SET telefone = ${telefone.trim()}
      WHERE id = ${Number(session.sub)}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[perfil/telefone]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
