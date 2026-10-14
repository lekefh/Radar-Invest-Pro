import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()
  if (!session || session.sub !== '1') {
    return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })
  }

  const sql = getDb()

  const result = await sql`
    UPDATE usuarios_web
    SET plano = 'starter',
        plano_expira = NOW() + INTERVAL '60 days'
    WHERE plano = 'gratuito'
      AND ativo = true
    RETURNING id, nome, email, telefone
  `

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result as any[]
  const semTelefone = rows.filter(u => !u.telefone)

  return NextResponse.json({
    ok: true,
    total_atualizado: rows.length,
    sem_telefone: semTelefone.length,
    usuarios: rows.map(u => ({ id: u.id, nome: u.nome, email: u.email, tem_telefone: !!u.telefone })),
    expira_em: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
  })
}
