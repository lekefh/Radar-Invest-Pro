import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import {
  initUsersTable, findByEmail, findByUsername,
  createUser, createToken
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

    const usuario = await createUser({
      nome:            nome.trim(),
      username,
      email:           email.toLowerCase().trim(),
      senha,
      plano:           'gratuito',
      ativo:           true,
      emailConfirmado: true,
      token:           null,
      tokenExpira:     null,
    })

    // Login automático — mesmo fluxo do /api/auth/login
    const token = await createToken({
      sub:      String(usuario.id),
      username: usuario.username,
      nome:     usuario.nome,
      email:    usuario.email,
      plano:    usuario.plano,
    })

    const store = await cookies()
    store.set('radar_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })

    // E-mail de boas-vindas (não-bloqueante)
    try {
      const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
      const host   = process.env.NEXT_PUBLIC_URL || 'https://radarinvestpro.com.br'
      await resend.emails.send({
        from:    process.env.EMAIL_FROM || 'Radar Invest Pro <onboarding@resend.dev>',
        to:      email,
        subject: 'Bem-vindo ao Radar Invest Pro!',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f1923;color:#e0e0e0;padding:32px;border-radius:8px">
            <h1 style="color:#e8a020;font-size:22px;margin:0 0 8px">Radar Invest Pro</h1>
            <h2 style="color:#fff;font-size:18px;margin:0 0 20px">Bem-vindo, ${nome}! 🎉</h2>
            <p style="color:#a0b4c8">Sua conta está ativa. Acesse agora:</p>
            <a href="${host}/dashboard"
               style="display:inline-block;background:#1565C0;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin:20px 0">
              Acessar a Plataforma →
            </a>
            <p style="color:#4a5d73;font-size:12px;margin-top:24px">
              Você se cadastrou em radarinvestpro.com.br
            </p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[register] email error:', emailErr)
    }

    return NextResponse.json({
      ok: true,
      usuario: {
        id:       usuario.id,
        nome:     usuario.nome,
        username: usuario.username,
        plano:    usuario.plano,
      },
    })
  } catch (e) {
    console.error('[register]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
