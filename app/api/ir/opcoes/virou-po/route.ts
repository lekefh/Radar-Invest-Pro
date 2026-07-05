import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * POST /api/ir/opcoes/virou-po
 *
 * Registra o desfecho de vencimento "virou pó" de uma opção:
 *   - Titular (qtde_liquida > 0): insere V a R$0 → apurar registrará prejuízo = prêmio pago
 *   - Lançador (qtde_liquida < 0): insere C a R$0 → fecha posição; ganho já foi taxado na abertura
 */
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
