import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session || session.sub !== '1') {
    return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 })
  }

  const sql = getDb()

  const rows = await sql`
    SELECT
      u.id,
      u.nome,
      u.email,
      u.plano,
      u.ultimo_login,
      COUNT(DISTINCT c.ticker)::int        AS tickers_carteira,
      COUNT(DISTINCT m.id)::int            AS movimentacoes,
      COUNT(DISTINCT tp.id)::int           AS transacoes_financas,
      COUNT(DISTINCT ir.ano_mes)::int      AS meses_ir_apurado
    FROM usuarios_web u
    LEFT JOIN carteira              c  ON c.user_id  = u.id
    LEFT JOIN movimentacoes         m  ON m.user_id  = u.id
    LEFT JOIN transacoes_pessoais   tp ON tp.user_id = u.id
    LEFT JOIN ir_apuracao_mensal    ir ON ir.user_id = u.id
    WHERE u.ativo = true
    GROUP BY u.id, u.nome, u.email, u.plano, u.ultimo_login
    ORDER BY u.ultimo_login DESC NULLS LAST
  `

  return NextResponse.json({ atividade: rows })
}
