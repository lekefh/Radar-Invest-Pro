'use client'
import { useState } from 'react'

const C = {
  bg:     '#050d1a',
  card:   '#0b1829',
  gold:   '#e8a020',
  green:  '#22c55e',
  red:    '#ef4444',
  white:  '#e8edf5',
  muted:  '#6b84a8',
  border: 'rgba(255,255,255,0.07)',
}

export default function OfertaFinancas() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null)

  const features = [
    { icon: '📥', titulo: 'Importação de extratos', desc: 'OFX, CSV, PDF e XLS de qualquer banco — Bradesco, Itaú, Nubank, Caixa e mais.' },
    { icon: '🏷️', titulo: 'Categorização inteligente', desc: 'Classifique despesas por categoria e veja onde seu dinheiro está indo.' },
    { icon: '📊', titulo: 'Resumo mensal visual', desc: 'Cards de entradas, despesas, fatura do cartão, saldo final — e quanto sobra para investir todo mês.' },
    { icon: '🎯', titulo: 'Sistema de grupos (50/25/20/5)', desc: 'Configure suas metas por necessidades, conforto, investimentos e imprevistos.' },
    { icon: '📈', titulo: 'Gráficos de evolução', desc: 'Veja como seu saldo e despesas evoluíram nos últimos 12 meses.' },
    { icon: '💰', titulo: 'Orçamento por categoria', desc: 'Defina metas mensais e acompanhe o real vs planejado em tempo real.' },
  ]

  const faqs = [
    { p: 'O acesso é realmente grátis por 30 dias?', r: 'Sim. Você acessa a plataforma completa — incluindo a aba Finanças — por 30 dias sem pagar nada e sem precisar cadastrar cartão de crédito. Só depois do período gratuito você decide se continua pelo Starter (R$19,99/mês).' },
    { p: 'Preciso saber de investimentos para usar?', r: 'Não. A aba Finanças é para quem quer organizar o dinheiro primeiro — antes de qualquer investimento. Você importa o extrato do banco e a plataforma já mostra tudo categorizado.' },
    { p: 'Funciona com qualquer banco?', r: 'Sim. Aceita arquivos OFX (gerado por Bradesco, Itaú, Santander, Caixa, BB, Sicredi e outros), CSV, TXT, PDF, XLS e XLSX. Se seu banco exporta extrato, funciona.' },
    { p: 'Posso cancelar quando quiser?', r: 'Sim, sem multa e sem fidelidade. Cancele em um clique no painel — o acesso continua até o fim do período. Nos 30 dias grátis você pode sair a qualquer momento sem custo algum.' },
    { p: 'O que acontece após os 30 dias?', r: 'Você recebe um aviso antes do fim do período gratuito. Se quiser continuar com a aba Finanças, o plano Starter custa R$19,99/mês. Se não assinar, sua conta passa para o plano gratuito com acesso limitado.' },
    { p: 'Meus dados bancários ficam seguros?', r: 'Você importa apenas o arquivo de extrato — nunca conectamos ao seu banco nem pedimos senha. Os dados ficam no seu perfil privado, protegidos por autenticação.' },
  ]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.white, fontFamily: 'var(--font-inter,Inter,sans-serif)' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1100, margin: '0 auto' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="#050d1a"/>
            <circle cx="16" cy="16" r="4" fill="#e8a020"/>
            <circle cx="16" cy="16" r="8" fill="none" stroke="#e8a020" strokeWidth="1.5" opacity=".6"/>
            <circle cx="16" cy="16" r="13" fill="none" stroke="#e8a020" strokeWidth="1" opacity=".3"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontWeight: 700, fontSize: 16, color: C.white }}>Radar Invest Pro</span>
        </a>
        <a href="/cadastro?trial=starter" style={{ background: C.gold, color: '#000', fontWeight: 700, fontSize: 13, padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>
          Acesse grátis
        </a>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          🎁 30 dias grátis — sem cartão de crédito
        </div>

        <h1 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
          Saia das Dívidas e se Torne<br />
          <span style={{ color: C.gold }}>um Investidor</span>
        </h1>

        <p style={{ fontSize: 'clamp(15px,2vw,19px)', color: C.muted, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 28px' }}>
          Importe seu extrato bancário e veja exatamente onde o dinheiro está indo — e quanto sobra para investir todo mês.
        </p>

        {/* Fluxo visual */}
        <div style={{ background: C.card, border: `1px solid rgba(232,160,32,.2)`, borderRadius: 16, padding: '24px 32px', maxWidth: 480, margin: '0 auto 36px', textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.muted, textTransform: 'uppercase', marginBottom: 16 }}>Seu fluxo pode ser assim:</div>
          {[
            { label: 'Renda Mensal',  val: 'R$ 10.847', cor: C.gold,  sinal: '' },
            { label: 'Despesas',      val: 'R$ 8.213',  cor: C.red,   sinal: '−' },
            { label: 'Investimento',  val: 'R$ 2.634',  cor: C.green, sinal: '=' },
          ].map((row, i) => (
            <div key={i}>
              {i > 0 && <div style={{ height: 1, background: C.border, margin: '10px 0' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.cor, flexShrink: 0, display: 'inline-block' }} />
                  {row.label}
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: row.cor }}>{row.sinal} {row.val}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: '.06em', textTransform: 'uppercase' }}>▲ 24,2% da renda investido</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>→ METAS REALIZADAS</span>
          </div>
        </div>

        {/* ── CTA HERO — visível sem rolar ── */}
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <a
            href="/cadastro?trial=starter"
            style={{
              display: 'block', width: '100%', maxWidth: 400,
              background: C.green, color: '#fff',
              fontWeight: 800, fontSize: 18, padding: '18px 24px',
              borderRadius: 12, textDecoration: 'none', textAlign: 'center',
              letterSpacing: '.01em', boxShadow: '0 4px 24px rgba(34,197,94,.35)',
            }}
          >
            Começar 30 dias grátis →
          </a>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Sem cartão de crédito · Cancele quando quiser
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: 0 }}>
            57 profissionais já utilizam a plataforma
          </p>
        </div>

      </section>

      {/* ── VÍDEO ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 60px' }}>
        <div style={{
          position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden',
          borderRadius: 16, border: `1px solid rgba(232,160,32,.15)`,
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}>
          <iframe
            src="https://www.youtube.com/embed/g717ENizBpY?rel=0&modestbranding=1"
            title="Saia das Dívidas e se Torne um Investidor — Radar Invest Pro"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </section>

      {/* ── CTA PÓS-VÍDEO + FERRAMENTAS GRATUITAS ────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 56px', textAlign: 'center' }}>

        {/* Botão principal pós-vídeo */}
        <a href="/cadastro?trial=starter" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.green, color: '#fff', fontWeight: 800, fontSize: 18, padding: '18px 48px', borderRadius: 12, textDecoration: 'none', letterSpacing: '.01em', boxShadow: '0 4px 24px rgba(34,197,94,.35)' }}>
          Começar 30 dias grátis →
        </a>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 10, marginBottom: 44 }}>Sem cartão de crédito · Sem fidelidade · Cancele quando quiser</p>

        {/* Ferramentas gratuitas incluídas */}
        <div style={{ background: C.card, border: `1px solid rgba(34,197,94,.2)`, borderRadius: 16, padding: '28px 32px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 6, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Incluído na conta gratuita
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>— mesmo após o trial, você já acessa:</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { icon: '📊', titulo: 'Monitoramento de ações', desc: 'Acompanhe cotações em tempo real com indicadores fundamentalistas: P/L, P/VP, ROE, DY e mais.' },
              { icon: '💼', titulo: 'Carteira com até 2 ações', desc: 'Monte sua carteira inicial, acompanhe o desempenho e receba alertas de variação.' },
              { icon: '📰', titulo: 'Notícias do mercado', desc: 'Feed de notícias da B3, macro e empresas — curado para o investidor individual.' },
              { icon: '📈', titulo: 'Teses de investimento', desc: 'Acesse análises e teses de empresas listadas na B3, atualizadas pela equipe Radar.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
              Com o plano <strong style={{ color: C.gold }}>Starter (R$&nbsp;19,99/mês)</strong> você desbloqueia a aba Finanças completa com importação ilimitada de extratos.
            </span>
            <a href="/planos" style={{ fontSize: 13, fontWeight: 600, color: C.gold, textDecoration: 'none' }}>Ver todos os planos →</a>
          </div>
        </div>
      </section>

      {/* ── PROBLEMA ──────────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(239,68,68,.04)', borderTop: `1px solid rgba(239,68,68,.1)`, borderBottom: `1px solid rgba(239,68,68,.1)`, padding: '52px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>😰</div>
          <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, marginBottom: 20 }}>
            Você sabe quanto gastou no mês passado<br />em cada categoria?
          </h2>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.8, marginBottom: 28 }}>
            Se a resposta foi não — você está no modo piloto automático. O dinheiro entra, o dinheiro sai e no fim do mês não sobrou nada para investir. Esse ciclo não acaba sozinho.
          </p>
          {['Cartão acumulando fatura todo mês', 'Salário que some antes do fim do mês', 'Nada para imprevistos — qualquer conta extra vira dívida', 'Investimento sempre "pra próxima vez"'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', maxWidth: 440, margin: '0 auto 10px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 8, padding: '10px 16px' }}>
              <span style={{ color: C.red, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>✕</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,.75)' }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── SOLUÇÃO ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 12 }}>A solução</div>
          <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 700, marginBottom: 16 }}>
            Tudo que você precisa para sair das dívidas<br />e começar a investir
          </h2>
          <p style={{ fontSize: 16, color: C.muted, maxWidth: 560, margin: '0 auto' }}>
            A aba Finanças é simples: importe o extrato do seu banco, veja onde o dinheiro foi e defina quanto vai investir no próximo mês.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{f.titulo}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PREÇO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, #0b1829 0%, #0f2040 100%)`, borderTop: `1px solid rgba(232,160,32,.15)`, borderBottom: `1px solid rgba(232,160,32,.15)`, padding: '60px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 16 }}>Plano Starter</div>
          <div style={{ background: '#050d1a', border: `2px solid rgba(232,160,32,.35)`, borderRadius: 20, padding: '36px 40px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>
              30 dias grátis
            </div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>depois apenas</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: C.white, lineHeight: 1 }}>R$&nbsp;19,99</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>/mês · sem fidelidade</div>
            {[
              '✅ Aba Finanças completa',
              '✅ Importação ilimitada de extratos',
              '✅ Carteira de ações com cotações',
              '✅ Análise DCF de empresas da B3',
              '✅ Teses de investimento',
              '✅ Notícias e alertas do mercado',
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,.80)', padding: '7px 0', borderBottom: i < 5 ? `1px solid ${C.border}` : 'none', textAlign: 'left' }}>
                {item}
              </div>
            ))}
            <a href="/cadastro?trial=starter" style={{ display: 'block', background: C.gold, color: '#000', fontWeight: 800, fontSize: 16, padding: '16px', borderRadius: 10, textDecoration: 'none', marginTop: 28, letterSpacing: '.01em' }}>
              Começar 30 dias grátis
            </a>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
              Sem cartão de crédito · Cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* ── COMPARATIVO ───────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, textAlign: 'center', marginBottom: 36 }}>
          30 dias grátis ou continuar perdendo dinheiro?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 14, padding: '24px' }}>
            <div style={{ fontWeight: 700, color: C.red, marginBottom: 16, fontSize: 15 }}>❌ Sem controle</div>
            {['Gasta sem saber onde', 'Fim do mês no vermelho', 'Dívidas acumulando', 'Zero investido', 'Ansiedade financeira todo dia'].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.60)', padding: '5px 0' }}>• {item}</div>
            ))}
          </div>
          <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 14, padding: '24px' }}>
            <div style={{ fontWeight: 700, color: C.green, marginBottom: 16, fontSize: 15 }}>✅ Com Radar Invest Pro</div>
            {['Sabe exatamente onde o dinheiro foi', 'Sempre sobra para investir', 'Dívidas zeradas em meses', 'Investe todo mês, sem falta', 'Paz financeira no fim do mês'].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.80)', padding: '5px 0' }}>• {item}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>
          Perguntas frequentes
        </h2>
        {faqs.map((faq, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
            <button
              onClick={() => setFaqAberto(faqAberto === i ? null : i)}
              style={{ width: '100%', background: 'none', border: 'none', color: C.white, textAlign: 'left', padding: '18px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600, gap: 12 }}
            >
              <span>{faq.p}</span>
              <span style={{ color: C.gold, fontSize: 20, flexShrink: 0, transition: 'transform .2s', transform: faqAberto === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
            </button>
            {faqAberto === i && (
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, paddingBottom: 18 }}>{faq.r}</div>
            )}
          </div>
        ))}
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, #0b1829 0%, #0f2040 100%)`, borderTop: `1px solid rgba(232,160,32,.15)`, padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🚀</div>
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, marginBottom: 16 }}>
          Comece hoje. Resultado no fim do mês.
        </h2>
        <p style={{ fontSize: 17, color: C.muted, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
          30 dias grátis, sem cartão. Depois de experimentar, você decide se continua.
        </p>
        <a href="/cadastro?trial=starter" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.gold, color: '#000', fontWeight: 800, fontSize: 18, padding: '18px 44px', borderRadius: 50, textDecoration: 'none', letterSpacing: '.02em' }}>
          Acessar grátis por 30 dias
        </a>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 14 }}>Sem cartão de crédito · Acesso imediato · Cancele quando quiser</p>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '24px', textAlign: 'center', fontSize: 12, color: C.muted }}>
        <a href="/" style={{ color: C.gold, textDecoration: 'none', fontWeight: 700 }}>radarinvestpro.com.br</a>
        {' · '}
        <a href="/privacidade" style={{ color: C.muted, textDecoration: 'none' }}>Privacidade</a>
        {' · '}
        <a href="/planos" style={{ color: C.muted, textDecoration: 'none' }}>Ver todos os planos</a>
        <br /><br />
        <span>Radar Invest Pro · Marca registrada INPI nº 943514495</span>
      </footer>

    </div>
  )
}
