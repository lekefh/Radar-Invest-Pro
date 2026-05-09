import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function getUserId(): Promise<number | null> {
  const session = await getSession()
  return session ? Number(session.sub) : null
}

export async function GET() {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    await ensureCarteiraTables()
    const sql = getDb()
    const rows = await sql`
      SELECT id, ticker, quantidade::float, preco_medio::float,
             data_compra, notas, excluir_calculo
      FROM carteira
      WHERE user_id = ${userId}
      ORDER BY ticker
    `
    return NextResponse.json({ carteira: rows })
  } catch (e) {
    console.error('[GET /api/carteira]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    await ensureCarteiraTables()
    const sql = getDb()
    const body = await req.json()
    const { ticker, quantidade, preco_medio, data_compra, notas } = body

    if (!ticker || quantidade == null || preco_medio == null)
      return NextResponse.json({ error: 'ticker, quantidade e preco_medio são obrigatórios' }, { status: 400 })

    const t  = String(ticker).toUpperCase()
    const qt = Number(quantidade)
    const pm = Number(preco_medio)
    const dt = data_compra ? String(data_compra) : new Date().toISOString().slice(0, 10)

    const rows = await sql`
      INSERT INTO carteira (user_id, ticker, quantidade, preco_medio, data_compra, notas)
      VALUES (${userId}, ${t}, ${qt}, ${pm}, ${dt}::date, ${notas ?? null})
      ON CONFLICT (user_id, ticker) DO UPDATE
        SET quantidade    = EXCLUDED.quantidade,
            preco_medio   = EXCLUDED.preco_medio,
            data_compra   = COALESCE(EXCLUDED.data_compra, carteira.data_compra),
            notas         = COALESCE(EXCLUDED.notas, carteira.notas),
            atualizado_em = NOW()
      RETURNING id, ticker, quantidade::float, preco_medio::float, data_compra, notas, excluir_calculo
    `

    try {
      await sql`
        INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total)
        VALUES (${userId}, ${dt}::date, ${t}, 'C', ${qt}, ${pm}, ${(qt * pm).toFixed(2)}::numeric)
      `
    } catch (movErr) {
      // Não falha o cadastro da posição por erro no histórico de movimentações
      console.warn('[POST /api/carteira] movimentacoes insert warn:', movErr)
    }

    return NextResponse.json({ posicao: rows[0] }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/carteira]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
