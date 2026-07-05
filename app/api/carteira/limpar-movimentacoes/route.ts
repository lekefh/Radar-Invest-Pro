import { NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables, reconstruirCarteira } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET  /api/carteira/limpar-movimentacoes  — conta movimentações e lotes ativos
 * DELETE /api/carteira/limpar-movimentacoes — apaga TODAS movimentações do usuário,
 *   marca todos os lotes como revertidos e reconstrói a carteira (volta à posição base pura)
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  const [{ total_movs }] = await sql`
    SELECT COUNT(*)::int AS total_movs FROM movimentacoes WHERE user_id = ${userId}
  `
  const [{ lotes_ativos }] = await sql`
    SELECT COUNT(*)::int AS lotes_ativos FROM import_batches WHERE user_id = ${userId} AND NOT revertido
  `
  const [{ lotes_total }] = await sql`
    SELECT COUNT(*)::int AS lotes_total FROM import_batches WHERE user_id = ${userId}
  `

  return NextResponse.json({ total_movs, lotes_ativos, lotes_total })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  // Apaga todas as movimentações
  const [{ count: movs_removidas }] = await sql`
    DELETE FROM movimentacoes WHERE user_id = ${userId} RETURNING COUNT(*) AS count
  `

  // Marca todos os lotes como revertidos
  await sql`
    UPDATE import_batches SET revertido = TRUE, revertido_em = NOW()
    WHERE user_id = ${userId} AND NOT revertido
  `

  // Reconstrói carteira (vai mostrar só a posição base)
  await reconstruirCarteira(userId)

  const [{ total_ativos }] = await sql`SELECT COUNT(*)::int AS total_ativos FROM carteira WHERE user_id = ${userId}`

  return NextResponse.json({ ok: true, movs_removidas: Number(movs_removidas ?? 0), total_ativos })
}
