import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { createHmac } from 'crypto'
import { getDb } from '@/lib/db'

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

// Mapeamento de valor → plano
function detectarPlano(valor: number): string {
  if (valor >= 80)  return 'pro'
  if (valor >= 40)  return 'essencial'
  return 'gratuito'
}

function validarAssinatura(req: NextRequest, body: string): boolean {
  const secret = process.env.MP_CLIENT_SECRET
  if (!secret) return false

  const xSignature = req.headers.get('x-signature') || ''
  const xRequestId = req.headers.get('x-request-id') || ''

  const ts    = xSignature.match(/ts=([^,]+)/)?.[1] || ''
  const v1    = xSignature.match(/v1=([^,]+)/)?.[1] || ''

  // Extrai data.id do body para montar o template
  let dataId = ''
  try { dataId = JSON.parse(body)?.data?.id || '' } catch {}

  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const assinatura = createHmac('sha256', secret).update(template).digest('hex')

  return assinatura === v1
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  // Valida assinatura MP (pula em desenvolvimento)
  if (process.env.NODE_ENV === 'production') {
    if (!validarAssinatura(req, body)) {
      console.warn('[webhook] Assinatura inválida')
      return NextResponse.json({ ok: false }, { status: 401 })
    }
  }

  let payload: { type?: string; data?: { id?: string } }
  try { payload = JSON.parse(body) } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Só processa notificações de assinatura
  if (payload.type !== 'subscription_preapproval') {
    return NextResponse.json({ ok: true })
  }

  const subscriptionId = payload.data?.id
  if (!subscriptionId) return NextResponse.json({ ok: true })

  try {
    const preApproval = new PreApproval(client)
    const assinatura  = await preApproval.get({ id: subscriptionId })

    const status = assinatura.status        // 'authorized' | 'paused' | 'cancelled'
    const valor  = assinatura.auto_recurring?.transaction_amount || 0
    const email  = assinatura.payer_email   || ''

    const sql = getDb()

    if (status === 'authorized') {
      const plano = detectarPlano(valor)
      // Calcula expiração: +35 dias (buffer para próxima cobrança)
      const expira = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000)

      await sql`
        UPDATE usuarios_web
        SET plano               = ${plano},
            mp_subscription_id  = ${subscriptionId},
            plano_expira        = ${expira.toISOString()}
        WHERE LOWER(email) = LOWER(${email})
           OR mp_subscription_id = ${subscriptionId}
      `
      console.log(`[webhook] ${email} → plano=${plano} até ${expira.toDateString()}`)

    } else if (status === 'cancelled' || status === 'paused') {
      await sql`
        UPDATE usuarios_web
        SET plano = 'gratuito', plano_expira = NULL
        WHERE mp_subscription_id = ${subscriptionId}
      `
      console.log(`[webhook] Assinatura ${subscriptionId} ${status} → downgrade gratuito`)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook]', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
