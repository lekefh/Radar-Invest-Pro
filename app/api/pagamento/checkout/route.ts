import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

const PLANOS = {
  essencial: { nome: 'Essencial', mensal: 49.90, anual: 499.00 },
  pro:       { nome: 'Pro',       mensal: 99.90, anual: 999.00 },
} as const

async function ensureTables() {
  const sql = getDb()
  await sql`ALTER TABLE usuarios_web ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT`
  await sql`ALTER TABLE usuarios_web ADD COLUMN IF NOT EXISTS plano_expira TIMESTAMPTZ`
  await sql`
    CREATE TABLE IF NOT EXISTS mp_planos (
      chave      TEXT PRIMARY KEY,
      plan_id    TEXT NOT NULL,
      init_point TEXT,
      criado_em  TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE mp_planos ADD COLUMN IF NOT EXISTS init_point TEXT`
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { plano, ciclo } = await req.json()
    if (!PLANOS[plano as keyof typeof PLANOS]) {
      return NextResponse.json({ erro: 'Plano inválido' }, { status: 400 })
    }

    const sql    = getDb()
    await ensureTables()

    // Chave única por usuário + plano + ciclo — reutiliza plano existente
    const chave    = `${plano}_${ciclo}_u${session.sub}`
    const existing = await sql`SELECT plan_id, init_point FROM mp_planos WHERE chave = ${chave}`

    if (existing[0]?.init_point) {
      return NextResponse.json({ init_point: existing[0].init_point })
    }

    const info      = PLANOS[plano as keyof typeof PLANOS]
    const ehAnual   = ciclo === 'anual'
    const valorMensal = ehAnual ? Math.round((info.anual / 12) * 100) / 100 : info.mensal
    const baseUrl   = process.env.NEXT_PUBLIC_URL || 'https://www.radarinvestpro.com.br'
    const client    = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const planApi   = new PreApprovalPlan(client)

    // Cria um plano no MP com external_reference = userId para rastrear no webhook
    const resultado = await planApi.create({
      body: {
        reason: `Radar Invest Pro — Plano ${info.nome} (${ehAnual ? 'anual' : 'mensal'})`,
        auto_recurring: {
          frequency:          ehAnual ? 12 : 1,
          frequency_type:     'months',
          transaction_amount: valorMensal,
          currency_id:        'BRL',
        },
        back_url:           `${baseUrl}/dashboard?plano_ativado=1`,
        external_reference: String(session.sub),
        status:             'active',
      } as Parameters<typeof planApi.create>[0]['body'],
    })

    if (!resultado.id || !resultado.init_point) {
      console.error('[checkout] MP sem id/init_point:', resultado)
      return NextResponse.json({ erro: 'Mercado Pago não retornou link de pagamento.' }, { status: 500 })
    }

    await sql`
      INSERT INTO mp_planos (chave, plan_id, init_point)
      VALUES (${chave}, ${resultado.id}, ${resultado.init_point})
      ON CONFLICT (chave) DO UPDATE SET plan_id = ${resultado.id}, init_point = ${resultado.init_point}
    `

    console.log(`[checkout] plano criado: ${chave} → ${resultado.id}`)
    return NextResponse.json({ init_point: resultado.init_point })

  } catch (e: unknown) {
    const detail = (() => { try { return JSON.stringify(e, Object.getOwnPropertyNames(e as object)) } catch { return String(e) } })()
    console.error('[checkout] erro:', detail)
    return NextResponse.json({ erro: `MP: ${detail}` }, { status: 500 })
  }
}
