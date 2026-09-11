import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const rows = await sql`
      SELECT id, banco, importado_em::text, total_transacoes, data_inicio::text, data_fim::text, descricao, revertido
      FROM extrato_batches
      WHERE user_id = ${userId}
      ORDER BY importado_em DESC
      LIMIT 50
    `

    return NextResponse.json({ batches: rows })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    const sql    = getDb()
    const userId = Number(session.sub)

    const { batch_id } = await req.json()
    if (!batch_id) return NextResponse.json({ erro: 'batch_id obrigatório' }, { status: 400 })

    // Verifica que o batch pertence ao usuário
    const [batch] = await sql`SELECT id FROM extrato_batches WHERE id = ${batch_id} AND user_id = ${userId}`
    if (!batch) return NextResponse.json({ erro: 'Importação não encontrada' }, { status: 404 })

    // Remove transações do batch
    const del = await sql`DELETE FROM transacoes_pessoais WHERE batch_id = ${batch_id} AND user_id = ${userId}`
    await sql`UPDATE extrato_batches SET revertido = TRUE, revertido_em = NOW() WHERE id = ${batch_id}`

    return NextResponse.json({ ok: true, removidas: del.length })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
