import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
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

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { plano, ciclo } = await req.json()
    if (!PLANOS[plano]) return NextResponse.json({ erro: 'Plano inválido' }, { status: 400 })

    const sql = getDb()
    await ensureAssinaturaCols()

    const rows = await sql`SELECT email, plano FROM usuarios_web WHERE id=${Number(session.sub)}`
    if (!rows[0]) return NextResponse.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    const usuario = rows[0]
    const info = PLANOS[plano]
    const ehAnual = ciclo === 'anual'
    const valor = ehAnual ? info.anual : info.mensal

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const preApproval = new PreApproval(client)

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.radarinvestpro.com.br'

    const resultado = await preApproval.create({
      body: {
        reason: `Radar Invest Pro — Plano ${info.nome} (${ehAnual ? 'anual' : 'mensal'})`,
        auto_recurring: {
          frequency: ehAnual ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: ehAnual ? Math.round((valor / 12) * 100) / 100 : valor,
          currency_id: 'BRL',
        },
        back_url: `${baseUrl}/dashboard?plano_ativado=1`,
        payer_email: usuario.email,
        status: 'pending',
      },
    })

    if (!resultado.init_point) {
      return NextResponse.json({ erro: 'Falha ao criar assinatura no Mercado Pago' }, { status: 500 })
    }

    // Salva o ID da assinatura pendente para rastrear no webhook
    await sql`
      UPDATE usuarios_web
      SET mp_subscription_id = ${resultado.id}
      WHERE id = ${Number(session.sub)}
    `

    return NextResponse.json({ init_point: resultado.init_point })
  } catch (e) {
    console.error('[checkout]', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
