import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

const USER_ID = 1

/* ── PUT /api/carteira/[id] — atualizar posição ─────────────────────────── */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { quantidade, preco_medio, data_compra, notas, excluir_calculo } = await req.json()

  const [row] = await sql`
    UPDATE carteira SET
      quantidade      = COALESCE(${quantidade ?? null}::numeric, quantidade),
      preco_medio     = COALESCE(${preco_medio ?? null}::numeric, preco_medio),
      data_compra     = COALESCE(${data_compra ?? null}::date, data_compra),
      notas           = COALESCE(${notas ?? null}, notas),
      excluir_calculo = COALESCE(${excluir_calculo ?? null}::boolean, excluir_calculo),
      atualizado_em   = NOW()
    WHERE id = ${id} AND user_id = ${USER_ID}
    RETURNING id, ticker, quantidade::float, preco_medio::float, data_compra, notas, excluir_calculo
  `

  if (!row) return NextResponse.json({ error: 'Posição não encontrada' }, { status: 404 })
  return NextResponse.json({ posicao: row })
}

/* ── DELETE /api/carteira/[id] — remover posição ────────────────────────── */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [row] = await sql`
    DELETE FROM carteira WHERE id = ${id} AND user_id = ${USER_ID}
    RETURNING ticker
  `

  if (!row) return NextResponse.json({ error: 'Posição não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true, ticker: row.ticker })
}
