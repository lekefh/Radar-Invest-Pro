import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)
  await ensureCarteiraTables()
  const sql = getDb()

  const rows = await sql`
    SELECT id, data::text, ticker, tipo, quantidade::float, preco::float, valor_total::float,
           corretora, nota_num
    FROM movimentacoes
    WHERE user_id = ${userId}
    ORDER BY data DESC, id DESC
    LIMIT 1000
  `
  return NextResponse.json({ movimentacoes: rows })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)
  await ensureCarteiraTables()
  const sql = getDb()

  const { data, ticker, tipo, quantidade, preco, corretora } = await req.json()
  if (!data || !ticker || !tipo || quantidade == null || preco == null)
    return NextResponse.json({ error: 'Informe data, ticker, tipo, quantidade e preco.' }, { status: 400 })
  if (tipo !== 'C' && tipo !== 'V')
    return NextResponse.json({ error: 'Tipo deve ser C ou V.' }, { status: 400 })

  const t   = String(ticker).toUpperCase().trim()
  const qty = Math.abs(Number(quantidade))
  const prc = Number(preco)
  const vt  = qty * prc
  const cor = corretora || 'Manual'

  const [row] = await sql`
    INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total, corretora, nota_num)
    VALUES (${userId}, ${data}::date, ${t}, ${tipo}, ${qty}, ${prc}, ${vt}, ${cor}, 'manual')
    RETURNING id
  `
  return NextResponse.json({ ok: true, id: row.id })
}

export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)
  await ensureCarteiraTables()
  const sql = getDb()

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Informe id.' }, { status: 400 })

  const deleted = await sql`
    DELETE FROM movimentacoes WHERE id = ${Number(id)} AND user_id = ${userId} RETURNING id
  `
  if (deleted.length === 0)
    return NextResponse.json({ error: 'Operação não encontrada.' }, { status: 404 })

  return NextResponse.json({ ok: true, id: deleted[0].id })
}
