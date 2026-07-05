import { NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables, reconstruirCarteira } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * POST /api/carteira/reconstruir
 * Reconstrói a tabela carteira a partir de posicao_base + movimentacoes.
 * Útil após limpeza manual de movimentacoes ou correção de dados.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  await reconstruirCarteira(userId)

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM carteira WHERE user_id = ${userId}`

  return NextResponse.json({ ok: true, total_ativos: count })
}
