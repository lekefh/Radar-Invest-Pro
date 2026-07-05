import { NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

/** GET /api/carteira/importacoes — lista lotes de importação do usuário */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  const rows = await sql`
    SELECT id, importado_em, total_ops,
           data_inicio::text, data_fim::text,
           descricao, revertido, revertido_em
    FROM import_batches
    WHERE user_id = ${userId}
    ORDER BY importado_em DESC
    LIMIT 50
  `
  return NextResponse.json({ importacoes: rows })
}
