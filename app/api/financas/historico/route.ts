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

    const params     = req.nextUrl.searchParams
    const meses      = Math.min(24, Number(params.get('meses') || 12))
    const categorias = params.get('categorias') || '' // vírgula-separado

    // Evolução mensal filtrada por categorias (se fornecidas)
    const evolucao = await sql`
      SELECT
        periodo,
        SUM(CASE WHEN tipo_lancamento = 'receita' AND NOT ignorar
              AND (${categorias} = '' OR categoria = ANY(string_to_array(${categorias}, ',')))
            THEN ABS(valor) ELSE 0 END)::float AS entradas,
        SUM(CASE WHEN tipo_lancamento = 'despesa' AND NOT ignorar
              AND (${categorias} = '' OR categoria = ANY(string_to_array(${categorias}, ',')))
            THEN ABS(valor) ELSE 0 END)::float AS saidas,
        SUM(CASE WHEN tipo_lancamento = 'pagamento_cartao' AND NOT ignorar
              AND (${categorias} = '' OR categoria = ANY(string_to_array(${categorias}, ',')))
            THEN ABS(valor) ELSE 0 END)::float AS pgto_cartao
      FROM transacoes_pessoais
      WHERE user_id = ${userId}
        AND data >= NOW() - (${meses} || ' months')::interval
      GROUP BY periodo
      ORDER BY periodo ASC
    `

    // Top 10 categorias de despesa (todos os períodos ou filtro)
    const periodo = params.get('periodo') || ''
    const topCats = await sql`
      SELECT
        categoria,
        SUM(ABS(valor))::float AS total
      FROM transacoes_pessoais
      WHERE user_id = ${userId}
        AND tipo_lancamento = 'despesa'
        AND NOT ignorar
        AND (${periodo} = '' OR periodo = ${periodo})
      GROUP BY categoria
      ORDER BY total DESC
      LIMIT 10
    `

    return NextResponse.json({ evolucao, top_categorias: topCats })

  } catch (e: unknown) {
    console.error('[historico GET]', e)
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
