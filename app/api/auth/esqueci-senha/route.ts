import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  initUsersTable, addResetTokenColumns,
  findByEmail, generateToken, saveResetToken,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email?.trim()) {
      return NextResponse.json({ erro: 'Informe o e-mail.' }, { status: 400 })
    }

    await initUsersTable()
    await addResetTokenColumns()

    const usuario = await findByEmail(email.trim())

    // Resposta genérica para não revelar se o e-mail existe
    if (!usuario) {
      return NextResponse.json({ ok: true })
    }

    const token = generateToken()
    const expira = new Date(Date.now() + 60 * 60 * 1000) // 1 hora
    await saveResetToken(email.trim(), token, expira)

    try {
      const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
      const host = process.env.NEXT_PUBLIC_URL || 'https://radarinvestpro.com.br'
      const link = `${host}/redefinir-senha?token=${token}`

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Radar Invest Pro <onboarding@resend.dev>',
        to: email.trim(),
        subject: 'Redefinição de senha — Radar Invest Pro',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f1923;color:#e0e0e0;padding:32px;border-radius:8px">
            <h1 style="color:#e8a020;font-size:22px;margin:0 0 8px">Radar Invest Pro</h1>
            <h2 style="color:#fff;font-size:18px;margin:0 0 20px">Redefinição de senha</h2>
            <p>Olá, <strong>${usuario.nome}</strong>!</p>
            <p style="color:#a0b4c8">Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>
            <a href="${link}" style="display:inline-block;background:#1565C0;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin:20px 0">
              Redefinir Senha
            </a>
            <p style="color:#6b84a8;font-size:13px">O link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
            <hr style="border-color:rgba(255,255,255,.1);margin:24px 0"/>
            <p style="color:#6b84a8;font-size:12px">Radar Invest Pro · radarinvestpro.com.br</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[esqueci-senha] email error:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[esqueci-senha]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
