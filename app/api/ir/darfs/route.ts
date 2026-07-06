import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureIRTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function uid(): Promise<number | null> {
  const s = await getSession(); return s ? Number(s.sub) : null
}

function vencimentoDarf(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const m = mes === 12 ? 1 : mes + 1
  const a = mes === 12 ? ano + 1 : ano
  return `${a}-${String(m).padStart(2,'0')}-20`
}

export async function GET() {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sql = getDb()
  await ensureIRTables()

  const rows = await sql`
    SELECT id, competencia, codigo_receita, valor::float, vencimento::text, status, gerado_em
    FROM ir_darfs WHERE user_id = ${userId}
    ORDER BY competencia DESC
  `
  return NextResponse.json({ darfs: rows })
}

export async function POST(req: NextRequest) {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sql = getDb()
  await ensureIRTables()

  const { action, competencia, id, status } = await req.json()

  // Gerar DARFs a partir de uma apuração mensal
  if (action === 'gerar_de_apuracao') {
    if (!competencia) return NextResponse.json({ error: 'Informe competencia (YYYY-MM)' }, { status: 400 })

    const rows = await sql`
      SELECT ir_devido_swing::float, ir_devido_day::float
      FROM ir_apuracao_mensal
      WHERE user_id = ${userId} AND ano_mes = ${competencia}
    `
    if (!rows.length) return NextResponse.json({ error: 'Apuração não encontrada para esta competência. Calcule primeiro.' }, { status: 404 })

    const { ir_devido_swing, ir_devido_day } = rows[0] as { ir_devido_swing: number; ir_devido_day: number }
    const venc = vencimentoDarf(competencia)
    const gerados: { codigo: string; valor: number }[] = []

    if (ir_devido_swing >= 10) {
      await sql`
        INSERT INTO ir_darfs (user_id, competencia, codigo_receita, valor, vencimento)
        VALUES (${userId}, ${competencia}, '6015', ${ir_devido_swing}, ${venc})
        ON CONFLICT DO NOTHING
      `
      gerados.push({ codigo: '6015', valor: ir_devido_swing })
    }
    if (ir_devido_day >= 10) {
      await sql`
        INSERT INTO ir_darfs (user_id, competencia, codigo_receita, valor, vencimento)
        VALUES (${userId}, ${competencia}, '6010', ${ir_devido_day}, ${venc})
        ON CONFLICT DO NOTHING
      `
      gerados.push({ codigo: '6010', valor: ir_devido_day })
    }

    return NextResponse.json({ ok: true, gerados })
  }

  // Marcar / desmarcar DARF
  if (action === 'marcar_pago' || action === 'desmarcar_pago') {
    if (!id) return NextResponse.json({ error: 'Informe id' }, { status: 400 })
    const novoStatus = action === 'desmarcar_pago' ? 'pendente' : (status ?? 'pago')
    await sql`UPDATE ir_darfs SET status = ${novoStatus} WHERE id = ${id} AND user_id = ${userId}`
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sql = getDb()
  await ensureIRTables()

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Informe id' }, { status: 400 })

  const deleted = await sql`
    DELETE FROM ir_darfs WHERE id = ${Number(id)} AND user_id = ${userId} RETURNING id
  `
  if (deleted.length === 0)
    return NextResponse.json({ error: 'DARF não encontrado.' }, { status: 404 })

  return NextResponse.json({ ok: true, id: deleted[0].id })
}
