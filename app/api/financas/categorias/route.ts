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
      SELECT DISTINCT ON (nome) id, user_id, nome, tipo, cor, oculta, COALESCE(grupo, 'outros') as grupo
      FROM categorias_pessoais
      WHERE user_id IS NULL OR user_id = ${userId}
      ORDER BY nome, user_id NULLS LAST
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

// Atualiza o grupo de uma categoria do usuário (cria registro próprio se era do sistema)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const { nome, grupo } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ erro: 'Nome obrigatório' }, { status: 400 })

    // Upsert: se categoria do usuário já existe atualiza, senão insere nova (cópia da sistema)
    const existing = await sql`
      SELECT id FROM categorias_pessoais WHERE user_id = ${userId} AND nome = ${nome.trim()}
    `
    if (existing.length > 0) {
      await sql`
        UPDATE categorias_pessoais SET grupo = ${grupo || 'outros'}
        WHERE user_id = ${userId} AND nome = ${nome.trim()}
      `
    } else {
      // Busca dados da categoria sistema para copiar tipo/cor
      const sistema = await sql`SELECT tipo, cor FROM categorias_pessoais WHERE user_id IS NULL AND nome = ${nome.trim()} LIMIT 1`
      await sql`
        INSERT INTO categorias_pessoais (user_id, nome, tipo, cor, grupo)
        VALUES (${userId}, ${nome.trim()}, ${sistema[0]?.tipo || 'despesa'}, ${sistema[0]?.cor || null}, ${grupo || 'outros'})
      `
    }

    return NextResponse.json({ ok: true })
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

    const { nome, tipo, cor, grupo } = await req.json()
    if (!nome?.trim()) return NextResponse.json({ erro: 'Nome obrigatório' }, { status: 400 })

    const [row] = await sql`
      INSERT INTO categorias_pessoais (user_id, nome, tipo, cor, grupo)
      VALUES (${userId}, ${nome.trim()}, ${tipo || 'despesa'}, ${cor || null}, ${grupo || 'outros'})
      RETURNING *
    `

    return NextResponse.json({ categoria: row })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
