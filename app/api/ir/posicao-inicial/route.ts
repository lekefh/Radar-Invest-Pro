import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureIRTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function uid(): Promise<number | null> {
  const s = await getSession(); return s ? Number(s.sub) : null
}

export async function GET() {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sql = getDb()
  await ensureIRTables()

  const posicoes = await sql`
    SELECT id, ticker, qtde::float, preco_medio::float, data_base, origem, criado_em
    FROM ir_posicao_inicial WHERE user_id = ${userId} ORDER BY ticker
  `
  const prej = await sql`
    SELECT modalidade, valor::float FROM ir_prejuizo_acumulado WHERE user_id = ${userId}
  `
  const prejMap = { swing: 0, day: 0 }
  for (const r of prej) prejMap[r.modalidade as 'swing' | 'day'] = Number(r.valor)

  return NextResponse.json({ posicoes, prejuizo: prejMap })
}

export async function POST(req: NextRequest) {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sql = getDb()
  await ensureIRTables()

  const body = await req.json()
  const { action } = body

  if (action === 'upsert_posicao') {
    const { ticker, qtde, preco_medio, data_base, origem } = body
    if (!ticker || qtde == null || preco_medio == null || !data_base)
      return NextResponse.json({ error: 'Campos obrigatórios: ticker, qtde, preco_medio, data_base' }, { status: 400 })

    await sql`
      INSERT INTO ir_posicao_inicial (user_id, ticker, qtde, preco_medio, data_base, origem)
      VALUES (${userId}, ${ticker.toUpperCase()}, ${qtde}, ${preco_medio}, ${data_base}, ${origem || 'declaracao'})
      ON CONFLICT (user_id, ticker)
      DO UPDATE SET qtde=${qtde}, preco_medio=${preco_medio}, data_base=${data_base}, origem=${origem || 'declaracao'}
    `
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_prejuizo') {
    const { swing, day } = body
    for (const [mod, val] of [['swing', swing ?? 0], ['day', day ?? 0]] as [string, number][]) {
      await sql`
        INSERT INTO ir_prejuizo_acumulado (user_id, modalidade, valor)
        VALUES (${userId}, ${mod}, ${val})
        ON CONFLICT (user_id, modalidade) DO UPDATE SET valor=${val}, atualizado_em=NOW()
      `
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_posicao') {
    const { ticker } = body
    await sql`DELETE FROM ir_posicao_inicial WHERE user_id=${userId} AND ticker=${ticker}`
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 })
}
