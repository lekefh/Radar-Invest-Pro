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

// Renomear categoria em todos os lançamentos do usuário
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const { de, para } = await req.json()
    if (!de?.trim() || !para?.trim()) return NextResponse.json({ erro: 'Campos "de" e "para" obrigatórios' }, { status: 400 })

    const result = await sql`
      UPDATE transacoes_pessoais
      SET categoria = ${para.trim()}
      WHERE user_id = ${userId} AND categoria = ${de.trim()}
    ` as unknown as { count?: number }

    return NextResponse.json({ ok: true, atualizados: result.count ?? 0 })

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
