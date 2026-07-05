import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables, reconstruirCarteira } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * DELETE /api/carteira/importacoes/[batch_id]
 * Reverte (rollback) um lote de importação:
 * 1. Verifica que o lote pertence ao usuário e não foi revertido
 * 2. Deleta movimentações do lote
 * 3. Reconstrói carteira a partir da posição base + movimentações restantes
 * 4. Marca lote como revertido
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  const { batch_id } = await params

  await ensureCarteiraTables()
  const sql = getDb()

  // Verifica ownership e status
  const batch = await sql`
    SELECT id, revertido, total_ops FROM import_batches
    WHERE id = ${batch_id}::uuid AND user_id = ${userId}
  `
  if (!batch[0]) return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 })
  if (batch[0].revertido) return NextResponse.json({ error: 'Este lote já foi revertido.' }, { status: 409 })

  // Deleta movimentações do lote
  const deleted = await sql`
    DELETE FROM movimentacoes WHERE import_batch_id = ${batch_id}::uuid AND user_id = ${userId}
    RETURNING id
  `

  // Reconstrói a carteira a partir do zero (base + movimentações restantes)
  await reconstruirCarteira(userId)

  // Marca lote como revertido
  await sql`
    UPDATE import_batches SET revertido = TRUE, revertido_em = NOW()
    WHERE id = ${batch_id}::uuid
  `

  return NextResponse.json({ ok: true, ops_removidas: deleted.length })
}
