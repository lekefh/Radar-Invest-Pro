import { NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables, reconstruirCarteira } from '@/lib/db'
import { getSession } from '@/lib/auth'

const TICKERS = ['AZZAX195', 'AZZAX222', 'CYREX212', 'PSSAH533']

/**
 * POST /api/carteira/fix-vpo
 * Endpoint temporário — remove movimentacoes (vpo + adições manuais) dos 4 tickers
 * e reconstrói carteira a partir da posição base. Remover após uso.
 */
export async function POST() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  // Remove TODAS as movimentacoes desses tickers (vpo + adições manuais acidentais)
  const deleted = await sql`
    DELETE FROM movimentacoes
    WHERE user_id = ${userId}
      AND ticker = ANY(${TICKERS}::text[])
    RETURNING id, ticker, tipo, nota_num
  `

  // Reconstrói carteira — posicao_base_itens ainda tem esses tickers, voltam limpos
  await reconstruirCarteira(userId)

  return NextResponse.json({
    ok: true,
    removidas: deleted.length,
    detalhes: deleted,
    msg: 'Movimentações removidas. Carteira reconstruída a partir da posição base.'
  })
}
