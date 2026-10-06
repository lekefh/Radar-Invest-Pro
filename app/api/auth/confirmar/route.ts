import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { confirmEmail, findByToken, initUsersTable } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/login?erro=token_ausente', req.url))
  }
  await initUsersTable()

  const usuario = await findByToken(token)
  const ok = await confirmEmail(token)
  if (!ok) {
    return NextResponse.redirect(new URL('/login?erro=link_invalido', req.url))
  }

  // Envia e-mail de boas-vindas após ativação
  if (usuario?.email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY || '')
      const ehTrial = usuario.plano === 'starter'
      const base = process.env.NEXT_PUBLIC_URL || 'https://radarinvestpro.com.br'
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Radar Invest Pro <onboarding@resend.dev>',
        to:   usuario.email,
        subject: ehTrial
          ? '🎉 Sua conta está ativa — 30 dias grátis começando agora!'
          : '🎉 Sua conta Radar Invest Pro está ativa!',
        html: ehTrial ? `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#050d1a;color:#e0e0e0;padding:36px;border-radius:10px">
            <h1 style="color:#e8a020;font-size:22px;margin:0 0 6px">Radar Invest Pro</h1>
            <h2 style="color:#fff;font-size:19px;margin:0 0 18px">Olá, ${usuario.nome}! Sua conta está ativa 🎉</h2>

            <div style="background:#0b1829;border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:18px 20px;margin-bottom:22px">
              <p style="color:#22c55e;font-weight:700;font-size:15px;margin:0 0 8px">✅ 30 dias grátis ativados</p>
              <p style="color:#a0b4c8;font-size:13px;margin:0;line-height:1.7">
                Você tem acesso completo à <strong style="color:#fff">aba Finanças</strong> durante 30 dias — sem custo, sem cartão.
                Importe seus extratos, veja onde o dinheiro vai e descubra quanto sobra para investir todo mês.
              </p>
            </div>

            <p style="color:#a0b4c8;font-size:13px;margin:0 0 10px">O que você pode fazer agora:</p>
            <ul style="color:#a0b4c8;font-size:13px;padding-left:18px;margin:0 0 24px;line-height:2">
              <li>📥 Importar extrato do banco (OFX, CSV, PDF)</li>
              <li>📊 Ver resumo mensal de entradas e despesas</li>
              <li>🎯 Configurar metas pelo sistema 50/25/20/5</li>
              <li>📈 Acompanhar ações com indicadores fundamentalistas</li>
            </ul>

            <a href="${base}/dashboard"
               style="display:inline-block;background:#e8a020;color:#050d1a;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin-bottom:24px">
              Acessar a plataforma →
            </a>

            <p style="color:#4a5d73;font-size:12px;margin:0;line-height:1.6">
              Após 30 dias, o plano muda automaticamente para gratuito — você recebe um aviso antes.<br>
              Qualquer dúvida, responda este e-mail.
            </p>
          </div>
        ` : `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#050d1a;color:#e0e0e0;padding:36px;border-radius:10px">
            <h1 style="color:#e8a020;font-size:22px;margin:0 0 6px">Radar Invest Pro</h1>
            <h2 style="color:#fff;font-size:19px;margin:0 0 18px">Olá, ${usuario.nome}! Sua conta está ativa 🎉</h2>
            <p style="color:#a0b4c8;margin:0 0 24px">Você já pode acessar o Mapa de Dividendos, Carteira e Teses de Investimento gratuitamente.</p>
            <a href="${base}/dashboard"
               style="display:inline-block;background:#e8a020;color:#050d1a;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">
              Acessar a plataforma →
            </a>
          </div>
        `,
      })
    } catch (err) {
      console.error('[confirmar] welcome email error:', err)
    }
  }

  return NextResponse.redirect(new URL('/login?ativado=1', req.url))
}
