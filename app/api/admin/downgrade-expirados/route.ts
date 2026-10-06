import { NextResponse } from 'next/server'
import { getSession, initUsersTable } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function POST() {
  const session = await getSession()
  if (!session || session.plano !== 'analista') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  await initUsersTable()
  const sql = getDb()

  const resultado = await sql`
    UPDATE usuarios_web
    SET plano = 'gratuito', plano_expira = NULL
    WHERE plano_expira IS NOT NULL
      AND plano_expira < NOW()
    RETURNING id, nome, email
  `

  return NextResponse.json({ rebaixados: resultado.length, usuarios: resultado })
}
