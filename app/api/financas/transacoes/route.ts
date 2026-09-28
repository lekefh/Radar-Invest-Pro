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

    const params    = req.nextUrl.searchParams
    const periodo   = params.get('periodo')   || ''
    const categoria = params.get('categoria') || ''
    const tipo      = params.get('tipo')      || ''
    const extrato   = params.get('extrato')   || ''
    const banco     = params.get('banco')     || ''
    const busca     = params.get('busca')     || ''
    const valorRaw  = (params.get('valor') || '').trim().replace(',', '.')
    const exportAll = params.get('exportar') === '1'
    const page      = Math.max(1, Number(params.get('page') || 1))
    const limit     = 50
    const offset    = (page - 1) * limit

    const COLUNAS_VALIDAS = ['data', 'valor', 'tipo', 'categoria', 'banco', 'historico']
    const sc = COLUNAS_VALIDAS.includes(params.get('sort_col') || '') ? (params.get('sort_col') || 'data') : 'data'
    const sd = params.get('sort_dir') === 'asc' ? 'asc' : 'desc'
    const buscaLike = '%' + busca.toLowerCase() + '%'
    const valorLike = '%' + valorRaw + '%'

    // ORDER BY dinâmico via CASE WHEN — único padrão compatível com neon template literals
    const rows = exportAll
      ? await sql`
          SELECT id, data::text, historico, descricao, valor::float,
                 tipo_lancamento, tipo_extrato, categoria, banco, periodo, ignorar
          FROM transacoes_pessoais
          WHERE user_id = ${userId}
            AND (${periodo}   = '' OR periodo        = ${periodo})
            AND (${categoria} = '' OR categoria      = ${categoria})
            AND (${tipo}      = '' OR tipo_lancamento= ${tipo})
            AND (${extrato}   = '' OR tipo_extrato   = ${extrato})
            AND (${banco}     = '' OR banco          = ${banco})
            AND (${busca}     = '' OR LOWER(historico) LIKE ${buscaLike})
            AND (${valorRaw}  = '' OR CAST(ROUND(ABS(valor)::numeric,2) AS TEXT) LIKE ${valorLike})
          ORDER BY
            CASE WHEN ${sc}='data'      AND ${sd}='asc'  THEN data                END ASC  NULLS LAST,
            CASE WHEN ${sc}='data'      AND ${sd}='desc' THEN data                END DESC NULLS LAST,
            CASE WHEN ${sc}='valor'     AND ${sd}='asc'  THEN ABS(valor)          END ASC  NULLS LAST,
            CASE WHEN ${sc}='valor'     AND ${sd}='desc' THEN ABS(valor)          END DESC NULLS LAST,
            CASE WHEN ${sc}='tipo'      AND ${sd}='asc'  THEN tipo_lancamento     END ASC  NULLS LAST,
            CASE WHEN ${sc}='tipo'      AND ${sd}='desc' THEN tipo_lancamento     END DESC NULLS LAST,
            CASE WHEN ${sc}='categoria' AND ${sd}='asc'  THEN categoria           END ASC  NULLS LAST,
            CASE WHEN ${sc}='categoria' AND ${sd}='desc' THEN categoria           END DESC NULLS LAST,
            CASE WHEN ${sc}='banco'     AND ${sd}='asc'  THEN banco               END ASC  NULLS LAST,
            CASE WHEN ${sc}='banco'     AND ${sd}='desc' THEN banco               END DESC NULLS LAST,
            CASE WHEN ${sc}='historico' AND ${sd}='asc'  THEN historico           END ASC  NULLS LAST,
            CASE WHEN ${sc}='historico' AND ${sd}='desc' THEN historico           END DESC NULLS LAST,
            id DESC
        `
      : await sql`
          SELECT id, data::text, historico, descricao, valor::float,
                 tipo_lancamento, tipo_extrato, categoria, banco, periodo, ignorar, batch_id, criado_em::text
          FROM transacoes_pessoais
          WHERE user_id = ${userId}
            AND (${periodo}   = '' OR periodo        = ${periodo})
            AND (${categoria} = '' OR categoria      = ${categoria})
            AND (${tipo}      = '' OR tipo_lancamento= ${tipo})
            AND (${extrato}   = '' OR tipo_extrato   = ${extrato})
            AND (${banco}     = '' OR banco          = ${banco})
            AND (${busca}     = '' OR LOWER(historico) LIKE ${buscaLike})
            AND (${valorRaw}  = '' OR CAST(ROUND(ABS(valor)::numeric,2) AS TEXT) LIKE ${valorLike})
          ORDER BY
            CASE WHEN ${sc}='data'      AND ${sd}='asc'  THEN data                END ASC  NULLS LAST,
            CASE WHEN ${sc}='data'      AND ${sd}='desc' THEN data                END DESC NULLS LAST,
            CASE WHEN ${sc}='valor'     AND ${sd}='asc'  THEN ABS(valor)          END ASC  NULLS LAST,
            CASE WHEN ${sc}='valor'     AND ${sd}='desc' THEN ABS(valor)          END DESC NULLS LAST,
            CASE WHEN ${sc}='tipo'      AND ${sd}='asc'  THEN tipo_lancamento     END ASC  NULLS LAST,
            CASE WHEN ${sc}='tipo'      AND ${sd}='desc' THEN tipo_lancamento     END DESC NULLS LAST,
            CASE WHEN ${sc}='categoria' AND ${sd}='asc'  THEN categoria           END ASC  NULLS LAST,
            CASE WHEN ${sc}='categoria' AND ${sd}='desc' THEN categoria           END DESC NULLS LAST,
            CASE WHEN ${sc}='banco'     AND ${sd}='asc'  THEN banco               END ASC  NULLS LAST,
            CASE WHEN ${sc}='banco'     AND ${sd}='desc' THEN banco               END DESC NULLS LAST,
            CASE WHEN ${sc}='historico' AND ${sd}='asc'  THEN historico           END ASC  NULLS LAST,
            CASE WHEN ${sc}='historico' AND ${sd}='desc' THEN historico           END DESC NULLS LAST,
            id DESC
          LIMIT ${limit} OFFSET ${offset}
        `

    if (exportAll) {
      return NextResponse.json({ transacoes: rows, total: rows.length })
    }

    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM transacoes_pessoais
      WHERE user_id = ${userId}
        AND (${periodo}   = '' OR periodo        = ${periodo})
        AND (${categoria} = '' OR categoria      = ${categoria})
        AND (${tipo}      = '' OR tipo_lancamento= ${tipo})
        AND (${extrato}   = '' OR tipo_extrato   = ${extrato})
        AND (${banco}     = '' OR banco          = ${banco})
        AND (${busca}     = '' OR LOWER(historico) LIKE ${buscaLike})
        AND (${valorRaw}  = '' OR CAST(ROUND(ABS(valor)::numeric,2) AS TEXT) LIKE ${valorLike})
    `
    const countRow = countRows[0]

    return NextResponse.json({ transacoes: rows, total: countRow.total, page, limit })

  } catch (e: unknown) {
    console.error('[transacoes GET]', e)
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

    const body = await req.json()
    const { data, historico, valor, tipo_lancamento, tipo_extrato, categoria, banco, descricao } = body

    if (!data || !historico || valor === undefined || valor === null) {
      return NextResponse.json({ erro: 'data, historico e valor são obrigatórios' }, { status: 400 })
    }

    const periodo = String(data).substring(0, 7) // YYYY-MM
    const valorNum = Number(tipo_lancamento === 'despesa' || tipo_lancamento === 'pagamento_cartao'
      ? -Math.abs(Number(valor))
      : Math.abs(Number(valor)))

    const [nova] = await sql`
      INSERT INTO transacoes_pessoais
        (user_id, data, historico, descricao, valor, tipo_lancamento, tipo_extrato, categoria, banco, periodo)
      VALUES (
        ${userId}, ${data}, ${historico}, ${descricao || ''},
        ${valorNum}, ${tipo_lancamento || 'despesa'}, ${tipo_extrato || 'conta'},
        ${categoria || 'Outros'}, ${banco || ''}, ${periodo}
      )
      RETURNING id, data::text, historico, descricao, valor::float, tipo_lancamento, tipo_extrato, categoria, banco, periodo, ignorar
    `

    return NextResponse.json({ transacao: nova })

  } catch (e: unknown) {
    console.error('[transacoes POST]', e)
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
