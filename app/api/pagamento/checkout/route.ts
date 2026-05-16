import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApproval, PreApprovalPlan } from 'mercadopago'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

const PLANOS: Record<string, { nome: string; mensal: number; anual: number }> = {
  essencial: { nome: 'Essencial', mensal: 49.90, anual: 499.00 },
  pro:       { nome: 'Pro',       mensal: 99.90, anual: 999.00 },
}

async function ensureAssinaturaCols() {
  const sql = getDb()
  await sql`ALTER TABLE usuarios_web ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT`
  await sql`ALTER TABLE usuarios_web ADD COLUMN IF NOT EXISTS plano_expira TIMESTAMPTZ`
}

// Retorna o ID do plano MP, criando-o se ainda não existir
async function getOrCreatePlanoId(
  client: MercadoPagoConfig,
  plano: string,
  ciclo: string,
  info: { nome: string; mensal: number; anual: number },
  baseUrl: string
): Promise<string> {
  const sql = getDb()

  await sql`
    CREATE TABLE IF NOT EXISTS mp_planos (
      chave     TEXT PRIMARY KEY,
      plan_id   TEXT NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const chave = `${plano}_${ciclo}`
  const rows = await sql`SELECT plan_id FROM mp_planos WHERE chave = ${chave}`
  if (rows[0]) return rows[0].plan_id

  const ehAnual = ciclo === 'anual'
  const valorMensal = ehAnual
    ? Math.round((info.anual / 12) * 100) / 100
    : info.mensal

  const planApi = new PreApprovalPlan(client)
  const resultado = await planApi.create({
    body: {
      reason: `Radar Invest Pro — Plano ${info.nome} (${ehAnual ? 'anual' : 'mensal'})`,
      auto_recurring: {
        frequency:          ehAnual ? 12 : 1,
        frequency_type:     'months',
        transaction_amount: valorMensal,
        currency_id:        'BRL',
      },
      back_url: `${baseUrl}/dashboard?plano_ativado=1`,
      status:   'active',
    },
  })

  if (!resultado.id) throw new Error('MP não retornou ID do plano')

  await sql`INSERT INTO mp_planos (chave, plan_id) VALUES (${chave}, ${resultado.id})`
  console.log(`[checkout] Plano criado no MP: ${chave} → ${resultado.id}`)

  return resultado.id
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { plano, ciclo } = await req.json()
    if (!PLANOS[plano]) return NextResponse.json({ erro: 'Plano inválido' }, { status: 400 })

    const sql = getDb()
    await ensureAssinaturaCols()

    const rows = await sql`SELECT id FROM usuarios_web WHERE id=${Number(session.sub)}`
    if (!rows[0]) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    const info    = PLANOS[plano]
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.radarinvestpro.com.br'
    const client  = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

    const planId = await getOrCreatePlanoId(client, plano, ciclo, info, baseUrl)

    const preApproval = new PreApproval(client)
    const resultado = await preApproval.create({
      body: {
        preapproval_plan_id: planId,
        external_reference:  String(session.sub),
        back_url:            `${baseUrl}/dashboard?plano_ativado=1`,
        status:              'pending',
      },
    })

    if (!resultado.init_point) {
      console.error('[checkout] MP não retornou init_point:', resultado)
      return NextResponse.json({ erro: 'Falha ao criar assinatura no Mercado Pago' }, { status: 500 })
    }

    await sql`
      UPDATE usuarios_web
      SET mp_subscription_id = ${resultado.id}
      WHERE id = ${Number(session.sub)}
    `

    return NextResponse.json({ init_point: resultado.init_point })
  } catch (e) {
    console.error('[checkout] erro:', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
