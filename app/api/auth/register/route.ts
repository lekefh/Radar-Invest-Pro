import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  initUsersTable, findByEmail, findByUsername,
  createUser, generateToken
} from '@/lib/auth'

function gerarUsername(nome: string): string {
  const base = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
  return base || 'usuario'
}

export async function POST(req: NextRequest) {
  try {
    const { nome, email, senha } = await req.json()

    if (!nome?.trim() || !email?.trim() || !senha) {
      return NextResponse.json({ erro: 'Preencha todos os campos.' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ erro: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    await initUsersTable()

    if (await findByEmail(email.toLowerCase())) {
      return NextResponse.json({ erro: 'E-mail já cadastrado.' }, { status: 409 })
    }

    // Username gerado automaticamente do nome, com sufixo numérico se já existir
    const base = gerarUsername(nome.trim())
    let username = base
    let sufixo = 2
    while (await findByUsername(username)) {
      username = `${base}${sufixo++}`
    }

    const confirmToken = generateToken()
    const tokenExpira  = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    await createUser({
      nome:            nome.trim(),
      username,
      email:           email.toLowerCase().trim(),
      senha,
      plano:           'gratuito',
      ativo:           false,
      emailConfirmado: false,
      token:           confirmToken,
      tokenExpira,
    })

    // E-mail de ativação (não-bloqueante)
    try {
      const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
      const host   = process.env.NEXT_PUBLIC_URL || 'https://radarinvestpro.com.br'
      const link   = `${host}/api/auth/confirmar?token=${confirmToken}`
      await resend.emails.send({
        from:    process.env.EMAIL_FROM || 'Radar Invest Pro <onboarding@resend.dev>',
        to:      email,
        subject: 'Ative sua conta — Radar Invest Pro',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f1923;color:#e0e0e0;padding:32px;border-radius:8px">
            <h1 style="color:#e8a020;font-size:22px;margin:0 0 8px">Radar Invest Pro</h1>
            <h2 style="color:#fff;font-size:18px;margin:0 0 16px">Olá, ${nome.trim()}! Confirme seu e-mail</h2>
            <p style="color:#a0b4c8;margin:0 0 20px">Clique no botão abaixo para ativar sua conta. O link expira em 24 horas.</p>
            <a href="${link}"
               style="display:inline-block;background:#e8a020;color:#050d1a;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin:0 0 24px">
              Ativar minha conta →
            </a>
            <p style="color:#4a5d73;font-size:12px;margin:0">
              Se você não se cadastrou, ignore este e-mail.<br>
              Link direto: ${link}
            </p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[register] email error:', emailErr)
    }

    return NextResponse.json({ ok: true, pendente: true })
  } catch (e) {
    console.error('[register]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
