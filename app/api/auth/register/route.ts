import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  initUsersTable, countUsers, findByEmail, findByUsername,
  createUser, generateToken
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { nome, username, email, senha } = await req.json()

    if (!nome?.trim() || !username?.trim() || !email?.trim() || !senha) {
      return NextResponse.json({ erro: 'Preencha todos os campos.' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ erro: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    await initUsersTable()

    if (await findByUsername(username.toLowerCase())) {
      return NextResponse.json({ erro: 'Nome de usuário já está em uso.' }, { status: 409 })
    }
    if (await findByEmail(email.toLowerCase())) {
      return NextResponse.json({ erro: 'E-mail já cadastrado.' }, { status: 409 })
    }

    const total = await countUsers()
    const ehPrimeiro = total === 0
    const token = ehPrimeiro ? null : generateToken()
    const tokenExpira = token
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null

    await createUser({
      nome:            nome.trim(),
      username:        username.toLowerCase().trim(),
      email:           email.toLowerCase().trim(),
      senha,
      plano:           ehPrimeiro ? 'analista' : 'gratuito',
      ativo:           ehPrimeiro,
      emailConfirmado: ehPrimeiro,
      token,
      tokenExpira,
    })

    if (token) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')
        const host = process.env.NEXT_PUBLIC_URL || 'https://radarinvestpro.com.br'
        const link = `${host}/confirmar-email?token=${token}`
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Radar Invest Pro <onboarding@resend.dev>',
          to: email,
          subject: 'Confirme seu e-mail — Radar Invest Pro',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f1923;color:#e0e0e0;padding:32px;border-radius:8px">
              <h1 style="color:#e8a020;font-size:22px;margin:0 0 8px">Radar Invest Pro</h1>
              <h2 style="color:#fff;font-size:18px;margin:0 0 20px">Confirme seu e-mail</h2>
              <p>Olá, <strong>${nome}</strong>!</p>
              <p style="color:#a0b4c8">Clique no botão para ativar sua conta:</p>
              <a href="${link}" style="display:inline-block;background:#1565C0;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin:20px 0">
                Confirmar E-mail
              </a>
              <p style="color:#6b84a8;font-size:13px">O link expira em 24 horas.</p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('[register] email error:', emailErr)
        // não falha o cadastro por erro de email
      }
    }

    return NextResponse.json({
      ok: true,
      mensagem: ehPrimeiro
        ? 'Conta criada! Você já pode fazer login.'
        : 'Cadastro realizado! Confirme seu e-mail para acessar.',
      precisa_confirmar: !ehPrimeiro,
    })
  } catch (e) {
    console.error('[register]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
