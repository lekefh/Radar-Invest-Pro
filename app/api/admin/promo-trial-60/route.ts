import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

// POST /api/admin/promo-trial-60
// Aplica 60 dias de trial starter a todos os usuarios gratuitos ativos
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.sub !== '1') {
    return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 })
  }

  const sql = getDb()

  // Busca todos os gratuitos ativos para o relatório
  const antes = await sql`
    SELECT id, nome, email, telefone
    FROM usuarios_web
    WHERE plano = 'gratuito' AND ativo = true
  `

  // Aplica 60 dias de starter trial
  const result = await sql`
    UPDATE usuarios_web
    SET plano = 'starter',
        plano_expira = NOW() + INTERVAL '60 days'
    WHERE plano = 'gratuito'
      AND ativo = true
    RETURNING id, nome, email, telefone
  `

  const semTelefone = result.filter((u: { telefone: string | null }) => !u.telefone)

  return NextResponse.json({
    ok: true,
    total_atualizado: result.length,
    sem_telefone: semTelefone.length,
    usuarios: result.map((u: { id: number; nome: string; email: string; telefone: string | null }) => ({
      id: u.id, nome: u.nome, email: u.email, tem_telefone: !!u.telefone,
    })),
    expira_em: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    total_antes: antes.length,
  })
}
