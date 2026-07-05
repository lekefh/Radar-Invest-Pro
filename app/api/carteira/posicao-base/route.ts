import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables, ensureIRTables, reconstruirCarteira } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  await ensureIRTables()
  const sql = getDb()

  const [base] = await sql`SELECT data_base::text FROM posicao_base WHERE user_id = ${userId}`
  const itens  = await sql`
    SELECT ticker, quantidade::float, preco_medio::float, cnpj
    FROM posicao_base_itens WHERE user_id = ${userId} ORDER BY ticker
  `
  const prej = await sql`SELECT modalidade, valor::float FROM ir_prejuizo_acumulado WHERE user_id = ${userId}`

  return NextResponse.json({
    data_base:      base?.data_base ?? null,
    itens,
    prejuizo_swing: prej.find(p => p.modalidade === 'swing')?.valor ?? 0,
    prejuizo_day:   prej.find(p => p.modalidade === 'day')?.valor   ?? 0,
  })
}

/**
 * POST /api/carteira/posicao-base
 * Body: {
 *   data_base: "YYYY-MM-DD",
 *   itens: [{ ticker, quantidade, preco_medio, cnpj? }],
 *   prejuizo_swing?: number,
 *   prejuizo_day?:   number,
 * }
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  await ensureIRTables()
  const sql = getDb()

  const body = await req.json()
  const dataBase: string = body.data_base
  const itens: { ticker: string; quantidade: number; preco_medio: number; cnpj?: string }[] = body.itens ?? []
  const prejSwing = Number(body.prejuizo_swing ?? 0)
  const prejDay   = Number(body.prejuizo_day   ?? 0)

  if (!dataBase || !/^\d{4}-\d{2}-\d{2}$/.test(dataBase))
    return NextResponse.json({ error: 'data_base inválida (esperado YYYY-MM-DD).' }, { status: 400 })

  await sql`
    INSERT INTO posicao_base (user_id, data_base, atualizado_em)
    VALUES (${userId}, ${dataBase}::date, NOW())
    ON CONFLICT (user_id) DO UPDATE SET data_base = ${dataBase}::date, atualizado_em = NOW()
  `

  await sql`DELETE FROM posicao_base_itens WHERE user_id = ${userId}`
  for (const item of itens) {
    const t    = String(item.ticker).toUpperCase().trim()
    const qt   = Number(item.quantidade)
    const pm   = Number(item.preco_medio)
    const cnpj = item.cnpj?.trim() ?? null
    if (!t || isNaN(qt) || isNaN(pm) || qt <= 0 || pm <= 0) continue
    await sql`
      INSERT INTO posicao_base_itens (user_id, ticker, quantidade, preco_medio, cnpj)
      VALUES (${userId}, ${t}, ${qt}, ${pm}, ${cnpj})
    `
    // Registra no cadastro global de CNPJs (para declaração IR futura)
    if (cnpj) {
      await sql`
        INSERT INTO empresa_cnpj (ticker, cnpj, atualizado_em)
        VALUES (${t}, ${cnpj}, NOW())
        ON CONFLICT (ticker) DO UPDATE SET cnpj = ${cnpj}, atualizado_em = NOW()
      `
    }
  }

  for (const [modalidade, valor] of [['swing', prejSwing], ['day', prejDay]] as [string, number][]) {
    await sql`
      INSERT INTO ir_prejuizo_acumulado (user_id, modalidade, valor, atualizado_em)
      VALUES (${userId}, ${modalidade}, ${valor}, NOW())
      ON CONFLICT (user_id, modalidade) DO UPDATE SET valor = ${valor}, atualizado_em = NOW()
    `
  }

  await reconstruirCarteira(userId)

  return NextResponse.json({ ok: true, data_base: dataBase, total_itens: itens.length })
}
