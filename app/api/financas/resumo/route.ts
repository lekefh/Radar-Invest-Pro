import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Recurso disponível a partir do plano Starter' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const params  = req.nextUrl.searchParams
    const periodo = params.get('periodo') // YYYY-MM, opcional

    // Resumo por mês — últimos 12 meses ou mês específico
    const mensal = await sql`
      SELECT
        periodo,
        SUM(CASE WHEN tipo_lancamento = 'receita'         AND NOT ignorar THEN ABS(valor) ELSE 0 END)::float AS entradas,
        SUM(CASE WHEN tipo_lancamento = 'despesa'         AND NOT ignorar THEN ABS(valor) ELSE 0 END)::float AS saidas,
        SUM(CASE WHEN tipo_lancamento = 'pagamento_cartao' AND NOT ignorar THEN ABS(valor) ELSE 0 END)::float AS pgto_cartao,
        COUNT(*)::int AS total_lancamentos
      FROM transacoes_pessoais
      WHERE user_id = ${userId}
        AND (${periodo || ''} = '' OR periodo = ${periodo || ''})
      GROUP BY periodo
      ORDER BY periodo DESC
      LIMIT 24
    `

    // Resumo por categoria no período
    const porCategoria = await sql`
      SELECT
        categoria,
        tipo_lancamento,
        SUM(ABS(valor))::float AS total,
        COUNT(*)::int AS qtd
      FROM transacoes_pessoais
      WHERE user_id = ${userId}
        AND NOT ignorar
        AND (${periodo || ''} = '' OR periodo = ${periodo || ''})
      GROUP BY categoria, tipo_lancamento
      ORDER BY total DESC
    `

    // Totais gerais (período filtrado ou tudo)
    const [totais] = await sql`
      SELECT
        SUM(CASE WHEN tipo_lancamento = 'receita'          AND NOT ignorar THEN ABS(valor) ELSE 0 END)::float AS entradas,
        SUM(CASE WHEN tipo_lancamento = 'despesa'          AND NOT ignorar THEN ABS(valor) ELSE 0 END)::float AS saidas,
        SUM(CASE WHEN tipo_lancamento = 'pagamento_cartao' AND NOT ignorar THEN ABS(valor) ELSE 0 END)::float AS pgto_cartao
      FROM transacoes_pessoais
      WHERE user_id = ${userId}
        AND (${periodo || ''} = '' OR periodo = ${periodo || ''})
    `

    // Períodos disponíveis (para o seletor)
    const periodos = await sql`
      SELECT DISTINCT periodo FROM transacoes_pessoais
      WHERE user_id = ${userId}
      ORDER BY periodo DESC
    `

    return NextResponse.json({
      totais,
      mensal,
      por_categoria: porCategoria,
      periodos: periodos.map(r => r.periodo),
    })

  } catch (e: unknown) {
    console.error('[resumo GET]', e)
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
