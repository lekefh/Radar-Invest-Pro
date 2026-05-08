import { NextResponse } from 'next/server'
import { getSession, initUsersTable, listUsers } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }
  if (session.plano !== 'analista') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }

  await initUsersTable()
  const usuarios = await listUsers()
  return NextResponse.json({ usuarios })
}
