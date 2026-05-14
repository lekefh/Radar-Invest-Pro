import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.id) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const sql = getDb()
    const rows = await sql`
      SELECT plano, plano_expira, mp_subscription_id
      FROM usuarios_web WHERE id = ${session.id}
    `
    if (!rows[0]) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    const { plano, plano_expira, mp_subscription_id } = rows[0]
    const ativo = plano !== 'gratuito' && (!plano_expira || new Date(plano_expira) > new Date())

    return NextResponse.json({ plano, plano_expira, mp_subscription_id, ativo })
  } catch (e) {
    console.error('[status]', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
