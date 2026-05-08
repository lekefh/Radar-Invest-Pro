import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const API =
  process.env.RAILWAY_API_URL ||
  'https://radar-invest-pro-backend-production.up.railway.app'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
  try {
    const { nome, username, email, senha } = await req.json()

    const res = await fetch(`${API}/auth/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, username, email, senha }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { erro: data.detail || 'Erro ao cadastrar.' },
        { status: res.status }
      )
    }

    if (data.token_confirmacao) {
      const host =
        process.env.NEXT_PUBLIC_URL || 'https://radarinvestpro.com.br'
      const link = `${host}/confirmar-email?token=${data.token_confirmacao}`

      await resend.emails.send({
        from:
          process.env.EMAIL_FROM ||
          'Radar Invest Pro <onboarding@resend.dev>',
        to: email,
        subject: 'Confirme seu e-mail — Radar Invest Pro',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f1923;color:#e0e0e0;padding:32px;border-radius:8px">
            <h1 style="color:#e8a020;font-size:22px;margin:0 0 8px">Radar Invest Pro</h1>
            <h2 style="color:#fff;font-size:18px;margin:0 0 20px;font-weight:600">Confirme seu e-mail</h2>
            <p style="margin:0 0 8px">Olá, <strong>${nome}</strong>!</p>
            <p style="margin:0 0 20px;color:#a0b4c8">Clique no botão abaixo para confirmar seu e-mail e começar a usar a plataforma:</p>
            <a href="${link}" style="display:inline-block;background:#1565C0;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">
              Confirmar E-mail
            </a>
            <p style="color:#6b84a8;font-size:13px;margin:24px 0 0">O link expira em 24 horas. Se não foi você, ignore este e-mail.</p>
            <hr style="border:none;border-top:1px solid #1a2632;margin:24px 0">
            <p style="color:#3d4f6a;font-size:12px;margin:0">radarinvestpro.com.br</p>
          </div>
        `,
      })
    }

    return NextResponse.json({
      ok: true,
      mensagem: data.mensagem,
      precisa_confirmar: !!data.token_confirmacao,
    })
  } catch (e) {
    console.error('[register]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
