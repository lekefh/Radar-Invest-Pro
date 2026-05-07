import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const USER_ID = 1

export async function GET() {
  const sql = getDb()
  const rows = await sql`
    SELECT id, ticker, quantidade::float, preco_medio::float,
           data_compra, notas, excluir_calculo
    FROM carteira
    WHERE user_id = ${USER_ID}
    ORDER BY ticker
  `
  return NextResponse.json({ carteira: rows })
}

export async function POST(req: NextRequest) {
  const sql = getDb()
  const { ticker, quantidade, preco_medio, data_compra, notas } = await req.json()

  if (!ticker || !quantidade || !preco_medio)
    return NextResponse.json({ error: 'ticker, quantidade e preco_medio são obrigatórios' }, { status: 400 })

  const [row] = await sql`
    INSERT INTO carteira (user_id, ticker, quantidade, preco_medio, data_compra, notas)
    VALUES (${USER_ID}, ${ticker.toUpperCase()}, ${quantidade}, ${preco_medio},
            ${data_compra || null}, ${notas || null})
    ON CONFLICT (user_id, ticker) DO UPDATE
      SET quantidade     = EXCLUDED.quantidade,
          preco_medio    = EXCLUDED.preco_medio,
          data_compra    = COALESCE(EXCLUDED.data_compra, carteira.data_compra),
          notas          = COALESCE(EXCLUDED.notas, carteira.notas),
          atualizado_em  = NOW()
    RETURNING id, ticker, quantidade::float, preco_medio::float, data_compra, notas, excluir_calculo
  `

  await sql`
    INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total)
    VALUES (${USER_ID}, ${data_compra || new Date().toISOString().slice(0,10)},
            ${ticker.toUpperCase()}, 'C', ${quantidade}, ${preco_medio},
            ${(quantidade * preco_medio).toFixed(2)})
  `

  return NextResponse.json({ posicao: row }, { status: 201 })
}
