import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

const GRUPOS_VALIDOS = ['necessidades', 'conforto', 'investimentos', 'imprevistos', 'outros']

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

    // 1. Mapa nome → grupo (preferência do usuário sobre sistema)
    const cats = await sql`
      SELECT DISTINCT ON (nome) nome, COALESCE(grupo, 'outros') as grupo
      FROM categorias_pessoais
      WHERE user_id = ${userId} OR user_id IS NULL
      ORDER BY nome, user_id NULLS LAST
    `
    const grupoMap: Record<string, string> = {}
    for (const c of cats) {
      grupoMap[c.nome as string] = GRUPOS_VALIDOS.includes(c.grupo as string) ? c.grupo as string : 'outros'
    }

    // 2. Totais de despesa por categoria no período
    const transRows = periodo
      ? await sql`
          SELECT categoria, SUM(ABS(valor))::float as total
          FROM transacoes_pessoais
          WHERE user_id = ${userId} AND tipo_lancamento = 'despesa' AND ignorar = FALSE AND periodo = ${periodo}
          GROUP BY categoria
        `
      : await sql`
          SELECT categoria, SUM(ABS(valor))::float as total
          FROM transacoes_pessoais
          WHERE user_id = ${userId} AND tipo_lancamento = 'despesa' AND ignorar = FALSE
          GROUP BY categoria
        `

    // 3. Agrega por grupo
    const totais: Record<string, number> = { necessidades: 0, conforto: 0, investimentos: 0, imprevistos: 0, outros: 0 }
    for (const row of transRows) {
      const g = grupoMap[row.categoria as string] || 'outros'
      totais[g] = (totais[g] || 0) + Number(row.total)
    }

    const totalGeral = Object.values(totais).reduce((s, v) => s + v, 0)

    return NextResponse.json({
      grupos: GRUPOS_VALIDOS.filter(g => g !== 'outros').map(g => ({
        grupo: g,
        total: Math.round((totais[g] || 0) * 100) / 100,
        pct_real: totalGeral > 0 ? Math.round((totais[g] / totalGeral) * 1000) / 10 : 0,
      })),
      outros: Math.round((totais.outros || 0) * 100) / 100,
      total_despesas: Math.round(totalGeral * 100) / 100,
    })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
