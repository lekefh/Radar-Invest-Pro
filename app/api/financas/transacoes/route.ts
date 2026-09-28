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
    const sqlTpl = getDb()
    // Cast necessário: neon suporta (string, params[]) em runtime mas o tipo TS só expõe template literal
    const sql    = sqlTpl as unknown as (q: string, p?: (string | number | boolean | null)[]) => Promise<Record<string, unknown>[]>
    const userId = Number(session.sub)

    const params    = req.nextUrl.searchParams
    const periodo   = params.get('periodo')   // YYYY-MM
    const categoria = params.get('categoria')
    const tipo      = params.get('tipo')       // despesa|receita|pagamento_cartao
    const extrato   = params.get('extrato')    // conta|cartao
    const banco     = params.get('banco')
    const busca     = params.get('busca')
    const valorRaw  = (params.get('valor') || '').trim().replace(',', '.')  // "17,50" → "17.50"
    const exportAll = params.get('exportar') === '1'  // sem paginação
    const page      = Math.max(1, Number(params.get('page') || 1))
    const limit     = 50
    const offset    = (page - 1) * limit

    // Ordenação server-side com whitelist (sem risco de SQL injection)
    const COLUNAS_VALIDAS: Record<string, string> = {
      data: 'data', valor: 'ABS(valor)', tipo: 'tipo_lancamento',
      categoria: 'categoria', banco: 'banco', historico: 'historico',
    }
    const sortColParam  = params.get('sort_col') || 'data'
    const sortDirParam  = params.get('sort_dir') || 'desc'
    const orderCol      = COLUNAS_VALIDAS[sortColParam] || 'data'
    const orderDir      = sortDirParam === 'asc' ? 'ASC' : 'DESC'
    // $1=userId $2=periodo $3=categoria $4=tipo $5=extrato $6=banco
    // $7=busca  $8=buscaLike  $9=valorRaw  $10=valorLike
    const buscaLike = '%' + (busca || '').toLowerCase() + '%'
    const valorLike = '%' + valorRaw + '%'

    const whereParams = [
      userId,
      periodo   || '',
      categoria || '',
      tipo      || '',
      extrato   || '',
      banco     || '',
      busca     || '',
      buscaLike,
      valorRaw,
      valorLike,
    ]

    const WHERE = `
      WHERE user_id = $1
        AND ($2 = '' OR periodo = $2)
        AND ($3 = '' OR categoria = $3)
        AND ($4 = '' OR tipo_lancamento = $4)
        AND ($5 = '' OR tipo_extrato = $5)
        AND ($6 = '' OR banco = $6)
        AND ($7 = '' OR LOWER(historico) LIKE $8)
        AND ($9 = '' OR CAST(ROUND(ABS(valor)::numeric, 2) AS TEXT) LIKE $10)
    `

    const rows = exportAll
      ? await sql(
          `SELECT id, data::text, historico, descricao, valor::float, tipo_lancamento, tipo_extrato, categoria, banco, periodo, ignorar
           FROM transacoes_pessoais ${WHERE}
           ORDER BY ${orderCol} ${orderDir}, id DESC`,
          whereParams,
        )
      : await sql(
          `SELECT id, data::text, historico, descricao, valor::float, tipo_lancamento, tipo_extrato, categoria, banco, periodo, ignorar, batch_id, criado_em::text
           FROM transacoes_pessoais ${WHERE}
           ORDER BY ${orderCol} ${orderDir}, id DESC
           LIMIT $11 OFFSET $12`,
          [...whereParams, limit, offset],
        )

    if (exportAll) {
      return NextResponse.json({ transacoes: rows, total: rows.length })
    }

    // Total para paginação (usa mesmos parâmetros do WHERE)
    const countRows = await sql(
      `SELECT COUNT(*)::int AS total FROM transacoes_pessoais ${WHERE}`,
      whereParams,
    )
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
