import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET /api/ir/opcoes/virou-po — retorna tickers que já viraram pó (nota_num='vpo')
 * POST /api/ir/opcoes/virou-po — registra vencimento "virou pó"
 */
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  // Retorna apenas tickers onde a ÚLTIMA movimentação é a entrada de vpo.
  // Se o usuário re-abriu posição depois do vpo, a última entrada tem nota_num diferente
  // e o ticker NÃO é retornado — opção volta a aparecer na aba.
  const rows = await sql`
    SELECT ticker FROM (
      SELECT ticker, nota_num,
             ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY id DESC) AS rn
      FROM movimentacoes
      WHERE user_id = ${userId}
    ) t
    WHERE rn = 1 AND nota_num = 'vpo'
  `
  return NextResponse.json({ tickers: rows.map(r => r.ticker as string) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)

  const { ticker, qtde_liquida, data_vencimento } = await req.json()
  if (!ticker || qtde_liquida == null)
    return NextResponse.json({ error: 'Informe ticker e qtde_liquida' }, { status: 400 })

  await ensureCarteiraTables()
  const sql = getDb()

  const t     = String(ticker).toUpperCase().trim()
  const qty   = Math.abs(Number(qtde_liquida))
  const data  = data_vencimento ?? new Date().toISOString().slice(0, 10)
  // Titular: vende a 0 (realiza a perda). Lançador: compra a 0 (encerra posição).
  const tipo  = Number(qtde_liquida) > 0 ? 'V' : 'C'

  // Evita duplicata: não registrar se já existe uma operação de encerramento (preco=0) no mesmo dia
  const existe = await sql`
    SELECT id FROM movimentacoes
    WHERE user_id=${userId} AND ticker=${t} AND tipo=${tipo}
      AND data=${data}::date AND preco=0
    LIMIT 1
  `
  if (existe.length > 0)
    return NextResponse.json({ error: 'Vencimento já registrado para este ticker e data.' }, { status: 409 })

  await sql`
    INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total, corretora, nota_num)
    VALUES (${userId}, ${data}::date, ${t}, ${tipo}, ${qty}, 0, 0, 'Vencimento B3', 'vpo')
  `

  return NextResponse.json({ ok: true, tipo, ticker: t, qty, data })
}

/**
 * DELETE /api/ir/opcoes/virou-po
 * Body: { ticker }
 * Remove o último registro de virou-pó (nota_num='vpo') para o ticker.
 */
export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)

  const { ticker } = await req.json()
  if (!ticker) return NextResponse.json({ error: 'Informe ticker' }, { status: 400 })

  await ensureCarteiraTables()
  const sql = getDb()
  const t = String(ticker).toUpperCase().trim()

  // Deleta apenas a movimentação vpo mais recente do ticker
  const deleted = await sql`
    DELETE FROM movimentacoes
    WHERE id = (
      SELECT id FROM movimentacoes
      WHERE user_id = ${userId} AND ticker = ${t} AND nota_num = 'vpo'
      ORDER BY id DESC
      LIMIT 1
    )
    RETURNING id
  `

  if (deleted.length === 0)
    return NextResponse.json({ error: 'Nenhum registro vpo encontrado para este ticker.' }, { status: 404 })

  return NextResponse.json({ ok: true, ticker: t, deletado: deleted[0].id })
}
