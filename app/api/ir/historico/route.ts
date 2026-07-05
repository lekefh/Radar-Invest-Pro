import { NextResponse } from 'next/server'
import { getDb, ensureIRTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)
  const sql = getDb()
  await ensureIRTables()

  const rows = await sql`
    SELECT
      ano_mes, vendas_acao_sw::float, lucro_acao_sw::float, lucro_opcao_sw::float,
      lucro_day::float, isento_swing, prej_swing_ac::float, prej_day_ac::float,
      ir_swing::float, ir_day::float, irrf_day::float,
      ir_devido_swing::float, ir_devido_day::float, calculado_em
    FROM ir_apuracao_mensal
    WHERE user_id = ${userId}
    ORDER BY ano_mes DESC
  `

  const prej = await sql`
    SELECT modalidade, valor::float FROM ir_prejuizo_acumulado WHERE user_id = ${userId}
  `
  const prejMap: Record<string, number> = {}
  for (const r of prej) prejMap[String(r.modalidade)] = Number(r.valor)

  return NextResponse.json({ historico: rows, prejuizoAtual: prejMap })
}
