import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const rows = await sql`SELECT saldo_inicial::float, grupos_config FROM financas_config WHERE user_id = ${userId}`
    const defaultGrupos = { necessidades: 50, conforto: 25, investimentos: 20, imprevistos: 5 }
    return NextResponse.json({
      saldo_inicial: rows[0]?.saldo_inicial ?? 0,
      grupos_config: rows[0]?.grupos_config ?? defaultGrupos,
    })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const { saldo_inicial, grupos_config } = await req.json()
    const valor = Number(saldo_inicial) ?? 0

    if (grupos_config !== undefined) {
      // Não inclui saldo_inicial aqui: INSERT usa o DEFAULT da tabela (0),
      // ON CONFLICT preserva o valor já salvo — evita sobrescrever com NaN.
      await sql`
        INSERT INTO financas_config (user_id, grupos_config, atualizado_em)
        VALUES (${userId}, ${JSON.stringify(grupos_config)}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET grupos_config = ${JSON.stringify(grupos_config)}, atualizado_em = NOW()
      `
    } else {
      await sql`
        INSERT INTO financas_config (user_id, saldo_inicial, atualizado_em)
        VALUES (${userId}, ${valor}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET saldo_inicial = ${valor}, atualizado_em = NOW()
      `
    }

    return NextResponse.json({ ok: true, saldo_inicial: valor })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
