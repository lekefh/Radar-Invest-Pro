const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'email inválido' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- HEADER -->
        <tr><td style="background:#050d1a;border-radius:16px 16px 0 0;padding:36px 48px;text-align:center">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:16px">
              <div style="width:52px;height:52px;border-radius:50%;border:2px solid #e8a020;display:inline-flex;align-items:center;justify-content:center;position:relative">
                <div style="width:10px;height:10px;background:#e8a020;border-radius:50%"></div>
              </div>
            </td></tr>
            <tr><td align="center">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Radar Invest </span><span style="font-size:22px;font-weight:700;color:#e8a020;letter-spacing:-0.5px">Pro</span>
            </td></tr>
          </table>
        </td></tr>

        <!-- LINHA DOURADA -->
        <tr><td style="background:linear-gradient(90deg,#050d1a,#e8a020,#050d1a);height:2px;font-size:0">&nbsp;</td></tr>

        <!-- CORPO -->
        <tr><td style="background:#0d1a2e;padding:48px 48px 40px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#e8a020;letter-spacing:1.5px;text-transform:uppercase">Acesso Antecipado</p>
          <h1 style="margin:0 0 28px;font-size:28px;font-weight:700;color:#ffffff;line-height:1.3">Caro Investidor,</h1>
          <p style="margin:0 0 20px;font-size:16px;color:#a8bdd4;line-height:1.8">
            É um prazer ter você aqui neste momento especial.
          </p>
          <p style="margin:0 0 20px;font-size:16px;color:#a8bdd4;line-height:1.8">
            O <strong style="color:#ffffff">Radar Invest Pro</strong> nasceu de uma necessidade real: colocar nas mãos do investidor individual as mesmas ferramentas de análise que os grandes gestores de fundo utilizam — valuation DCF, análise fundamentalista setorial e alocação racional de carteira — tudo em uma única plataforma, acessível e profissional.
          </p>

          <!-- DESTAQUE -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0">
            <tr><td style="background:rgba(232,160,32,0.08);border:1px solid rgba(232,160,32,0.25);border-radius:12px;padding:24px 28px">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#e8a020;letter-spacing:1px;text-transform:uppercase">✅ Cadastro Confirmado</p>
              <p style="margin:0;font-size:16px;font-weight:600;color:#ffffff;line-height:1.6">
                Você está na lista de acesso antecipado.<br>
                <span style="font-size:14px;font-weight:400;color:#a8bdd4">Assim que a plataforma estiver pronta, você será um dos primeiros a receber o link para criar sua conta e explorar todas as funcionalidades gratuitamente durante o período de teste.</span>
              </p>
            </td></tr>
          </table>

          <p style="margin:0 0 32px;font-size:16px;color:#a8bdd4;line-height:1.8">
            Até lá, qualquer dúvida estou à disposição.
          </p>

          <!-- ASSINATURA -->
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:16px;vertical-align:top">
                <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,rgba(232,160,32,0.3),rgba(232,160,32,0.05));border:1px solid rgba(232,160,32,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#e8a020;text-align:center;line-height:48px">AH</div>
              </td>
              <td style="vertical-align:top">
                <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff">Alexander Faria Hurtado</p>
                <p style="margin:2px 0 0;font-size:13px;color:#e8a020">Fundador — Radar Invest Pro</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#081120;border-radius:0 0 16px 16px;padding:24px 48px;text-align:center">
          <p style="margin:0 0 8px;font-size:13px;color:#4a6080">
            <a href="https://radarinvestpro.com.br" style="color:#e8a020;text-decoration:none">radarinvestpro.com.br</a>
            &nbsp;·&nbsp;
            <a href="mailto:contato@radarinvestpro.com.br" style="color:#4a6080;text-decoration:none">contato@radarinvestpro.com.br</a>
          </p>
          <p style="margin:0;font-size:12px;color:#2d4060">© 2026 Radar Invest Pro · Marca registrada INPI nº 943514495 · Cuiabá, MT</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    // E-mail de boas-vindas para o lead
    await transporter.sendMail({
      from: '"Radar Invest Pro" <contato@radarinvestpro.com.br>',
      to: email,
      subject: 'Bem-vindo ao Radar Invest Pro 📡',
      html,
    });

    // Notificação interna
    await transporter.sendMail({
      from: '"Radar Invest Pro Site" <contato@radarinvestpro.com.br>',
      to: 'contato@radarinvestpro.com.br',
      subject: `Novo lead — ${email}`,
      text: `Novo cadastro de interesse:\n\nE-mail: ${email}\nData: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}`,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
