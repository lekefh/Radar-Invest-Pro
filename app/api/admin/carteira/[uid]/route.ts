import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureCarteiraTables } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  if (session.plano !== 'analista') return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })

  const { uid } = await params
  const userId = parseInt(uid)
  if (isNaN(userId)) return NextResponse.json({ erro: 'ID inválido.' }, { status: 400 })

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
}
