import { NextResponse } from 'next/server'
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
