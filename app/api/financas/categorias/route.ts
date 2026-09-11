import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const rows = await sql`
      SELECT id, user_id, nome, tipo, cor, oculta
      FROM categorias_pessoais
      WHERE user_id IS NULL OR user_id = ${userId}
      ORDER BY tipo, nome
    `

    return NextResponse.json({ categorias: rows })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const { nome, tipo, cor } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ erro: 'Nome obrigatório' }, { status: 400 })

    const [row] = await sql`
      INSERT INTO categorias_pessoais (user_id, nome, tipo, cor)
      VALUES (${userId}, ${nome.trim()}, ${tipo || 'despesa'}, ${cor || null})
      RETURNING *
    `

    return NextResponse.json({ categoria: row })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
