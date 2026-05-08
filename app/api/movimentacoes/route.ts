import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function getUserId(): Promise<number | null> {
  const session = await getSession()
  return session ? Number(session.sub) : null
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sql = getDb()
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')

  const rows = ticker
    ? await sql`
        SELECT id, data, ticker, tipo, quantidade::float, preco::float,
               valor_total::float, corretora, nota_num, criado_em
        FROM movimentacoes
        WHERE user_id = ${userId} AND ticker = ${ticker.toUpperCase()}
        ORDER BY data DESC, id DESC
      `
    : await sql`
        SELECT id, data, ticker, tipo, quantidade::float, preco::float,
               valor_total::float, corretora, nota_num, criado_em
        FROM movimentacoes
        WHERE user_id = ${userId}
        ORDER BY data DESC, id DESC
        LIMIT 200
      `

  return NextResponse.json({ movimentacoes: rows })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sql = getDb()
  const { data, ticker, tipo, quantidade, preco, corretora, nota_num } = await req.json()

  if (!data || !ticker || !tipo || !quantidade || !preco)
    return NextResponse.json({ error: 'Campos obrigatórios: data, ticker, tipo, quantidade, preco' }, { status: 400 })

  const valor_total = (quantidade * preco).toFixed(2)

  const [row] = await sql`
    INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total, corretora, nota_num)
    VALUES (${userId}, ${data}, ${ticker.toUpperCase()}, ${tipo.toUpperCase()},
            ${quantidade}, ${preco}, ${valor_total}, ${corretora || null}, ${nota_num || null})
    RETURNING id, data, ticker, tipo, quantidade::float, preco::float, valor_total::float
  `

  return NextResponse.json({ movimentacao: row }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sql = getDb()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  await sql`DELETE FROM movimentacoes WHERE id = ${id} AND user_id = ${userId}`
  return NextResponse.json({ ok: true })
}
