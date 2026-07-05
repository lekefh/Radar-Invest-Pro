import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function getUserId(): Promise<number | null> {
  const session = await getSession()
  return session ? Number(session.sub) : null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sql = getDb()
    const { id } = await params
    const body = await req.json()
    const { quantidade, preco_medio, data_compra, notas, excluir_calculo, data_vencimento } = body

    const rows = await sql`
      UPDATE carteira SET
        quantidade      = COALESCE(${quantidade != null ? Number(quantidade) : null}::numeric, quantidade),
        preco_medio     = COALESCE(${preco_medio != null ? Number(preco_medio) : null}::numeric, preco_medio),
        data_compra     = COALESCE(${data_compra ? String(data_compra) : null}::date, data_compra),
        notas           = COALESCE(${notas != null ? String(notas) : null}, notas),
        excluir_calculo = COALESCE(${excluir_calculo != null ? Boolean(excluir_calculo) : null}::boolean, excluir_calculo),
        data_vencimento = COALESCE(${data_vencimento ? String(data_vencimento) : null}::date, data_vencimento),
        atualizado_em   = NOW()
      WHERE id = ${Number(id)} AND user_id = ${userId}
      RETURNING id, ticker, quantidade::float, preco_medio::float, data_compra, notas, excluir_calculo, data_vencimento
    `

    if (!rows[0]) return NextResponse.json({ error: 'Posição não encontrada' }, { status: 404 })
    return NextResponse.json({ posicao: rows[0] })
  } catch (e) {
    console.error('[PUT /api/carteira/id]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const sql = getDb()
    const { id } = await params
    const rows = await sql`
      DELETE FROM carteira WHERE id = ${Number(id)} AND user_id = ${userId}
      RETURNING ticker
    `
    if (!rows[0]) return NextResponse.json({ error: 'Posição não encontrada' }, { status: 404 })
    return NextResponse.json({ ok: true, ticker: rows[0].ticker })
  } catch (e) {
    console.error('[DELETE /api/carteira/id]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
