import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)
    const periodo = req.nextUrl.searchParams.get('periodo') || ''

    // 1. Metas por categoria
    const metas = await sql`
      SELECT categoria, valor_meta::float FROM orcamento_categorias WHERE user_id = ${userId}
    `
    const metaMap: Record<string, number> = {}
    for (const m of metas) metaMap[m.categoria as string] = Number(m.valor_meta)

    // 2. Gastos reais por categoria no período
    const reaisRows = periodo
      ? await sql`
          SELECT categoria, SUM(ABS(valor))::float as total
          FROM transacoes_pessoais
          WHERE user_id = ${userId} AND tipo_lancamento = 'despesa' AND ignorar = FALSE AND periodo = ${periodo}
          GROUP BY categoria ORDER BY total DESC
        `
      : await sql`
          SELECT categoria, SUM(ABS(valor))::float as total
          FROM transacoes_pessoais
          WHERE user_id = ${userId} AND tipo_lancamento = 'despesa' AND ignorar = FALSE
          GROUP BY categoria ORDER BY total DESC
        `
    const realMap: Record<string, number> = {}
    for (const r of reaisRows) realMap[r.categoria as string] = Number(r.total)

    // 3. Grupos das categorias (categorias_pessoais + todas de transações)
    const cats = await sql`
      SELECT DISTINCT ON (nome) nome, COALESCE(grupo, 'outros') as grupo
      FROM categorias_pessoais
      WHERE user_id = ${userId} OR user_id IS NULL
      ORDER BY nome, user_id NULLS LAST
    `
    const grupoMap: Record<string, string> = {}
    for (const c of cats) grupoMap[c.nome as string] = c.grupo as string

    // 4. Todas as categorias: com meta + com gasto no período + com gasto em qualquer período (despesa)
    const todasTxRows = await sql`
      SELECT DISTINCT categoria as nome FROM transacoes_pessoais
      WHERE user_id = ${userId} AND tipo_lancamento = 'despesa' AND ignorar = FALSE
        AND categoria IS NOT NULL AND categoria != ''
    `
    const todasCats = new Set([
      ...Object.keys(metaMap),
      ...Object.keys(realMap),
      ...todasTxRows.map(r => r.nome as string),
    ])

    const linhas = [...todasCats].map(cat => ({
      categoria: cat,
      grupo:     grupoMap[cat] || 'outros',
      meta:      metaMap[cat] ?? 0,
      real:      realMap[cat] ?? 0,
      diff:      Math.round(((metaMap[cat] ?? 0) - (realMap[cat] ?? 0)) * 100) / 100,
      pct:       (metaMap[cat] ?? 0) > 0
        ? Math.round(((realMap[cat] ?? 0) / (metaMap[cat] ?? 0)) * 1000) / 10
        : null,
    }))

    // Ordenar: com meta primeiro, depois por grupo, depois por real desc
    const GRUPO_ORDER = ['necessidades', 'conforto', 'investimentos', 'imprevistos', 'outros']
    linhas.sort((a, b) => {
      const temMetaA = a.meta > 0 ? 0 : 1
      const temMetaB = b.meta > 0 ? 0 : 1
      if (temMetaA !== temMetaB) return temMetaA - temMetaB
      const ga = GRUPO_ORDER.indexOf(a.grupo)
      const gb = GRUPO_ORDER.indexOf(b.grupo)
      if (ga !== gb) return ga - gb
      return b.real - a.real
    })

    const totalMeta = linhas.reduce((s, l) => s + l.meta, 0)
    const totalReal = linhas.reduce((s, l) => s + l.real, 0)

    return NextResponse.json({ linhas, totalMeta, totalReal })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}

// Replicar gastos reais de um mês como novas metas de orçamento
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

    const { periodo_ref } = await req.json()
    if (!periodo_ref || !/^\d{4}-\d{2}$/.test(periodo_ref)) {
      return NextResponse.json({ erro: 'periodo_ref obrigatório (YYYY-MM)' }, { status: 400 })
    }

    const gastos = await sql`
      SELECT categoria, ROUND(SUM(ABS(valor))::numeric, 2)::float AS total
      FROM transacoes_pessoais
      WHERE user_id = ${userId} AND tipo_lancamento = 'despesa' AND ignorar = FALSE
        AND periodo = ${periodo_ref} AND categoria IS NOT NULL AND categoria != ''
      GROUP BY categoria
    `

    if (gastos.length === 0) {
      return NextResponse.json({ erro: `Nenhuma despesa encontrada em ${periodo_ref}` }, { status: 404 })
    }

    for (const g of gastos) {
      await sql`
        INSERT INTO orcamento_categorias (user_id, categoria, valor_meta)
        VALUES (${userId}, ${g.categoria as string}, ${g.total as number})
        ON CONFLICT (user_id, categoria) DO UPDATE SET valor_meta = EXCLUDED.valor_meta
      `
    }

    return NextResponse.json({ ok: true, categorias: gastos.length })
  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}

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

    const { categoria, valor_meta } = await req.json()
    if (!categoria?.trim()) return NextResponse.json({ erro: 'Categoria obrigatória' }, { status: 400 })
    const valor = Math.max(0, Number(valor_meta) || 0)

    if (valor === 0) {
      await sql`DELETE FROM orcamento_categorias WHERE user_id = ${userId} AND categoria = ${categoria.trim()}`
    } else {
      await sql`
        INSERT INTO orcamento_categorias (user_id, categoria, valor_meta)
        VALUES (${userId}, ${categoria.trim()}, ${valor})
        ON CONFLICT (user_id, categoria) DO UPDATE SET valor_meta = ${valor}
      `
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
