'use client'
import { useState, useEffect, useCallback } from 'react'

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

const SLIDES = [
  { src: '/financas/resumo.png',    label: 'Resumo',    desc: 'Entradas, saidas, fatura e saldo num so lugar' },
  { src: '/financas/graficos.png',  label: 'Graficos',  desc: 'Evolucao mensal e top categorias de despesa' },
  { src: '/financas/grupos.png',    label: 'Grupos',    desc: 'Metas 40/35/20/5 real vs meta em tempo real' },
  { src: '/financas/orcamento.png', label: 'Orcamento', desc: 'Meta por categoria vs realizado no mes' },
]

function CarrosselApp() {
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)

  const proximo = useCallback(() => setAtual(i => (i + 1) % SLIDES.length), [])
  const anterior = useCallback(() => setAtual(i => (i - 1 + SLIDES.length) % SLIDES.length), [])

  useEffect(() => {
    if (pausado) return
    const t = setInterval(proximo, 3500)
    return () => clearInterval(t)
  }, [pausado, proximo])

  const btnSeta: React.CSSProperties = {
    position: 'absolute', top: '45%', transform: 'translateY(-50%)',
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(11,24,41,.9)', border: '1px solid rgba(232,160,32,.3)',
    color: '#e8a020', fontSize: 20, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  }

  return (
    <div onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)} style={{ position: 'relative', userSelect: 'none' }}>
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(232,160,32,.18)', boxShadow: '0 20px 60px rgba(0,0,0,.6)', background: '#0b1829' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={atual} src={SLIDES[atual].src} alt={SLIDES[atual].label} style={{ width: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(0deg,rgba(5,13,26,.95) 0%,transparent 100%)', padding: '28px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: '#e8a020', textTransform: 'uppercase' }}>Aba {SLIDES[atual].label}</span>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.70)', marginTop: 2 }}>{SLIDES[atual].desc}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setAtual(i)} style={{ width: i === atual ? 22 : 8, height: 8, borderRadius: 4, background: i === atual ? '#e8a020' : 'rgba(255,255,255,.25)', border: 'none', cursor: 'pointer', padding: 0, transition: 'width .3s,background .3s' }} />
            ))}
          </div>
        </div>
      </div>
      <button onClick={anterior} style={{ ...btnSeta, left: -18 }}>&#8249;</button>
      <button onClick={proximo}  style={{ ...btnSeta, right: -18 }}>&#8250;</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        {SLIDES.map((s, i) => (
          <button key={i} onClick={() => setAtual(i)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: i === atual ? 'rgba(232,160,32,.15)' : 'transparent', color: i === atual ? '#e8a020' : '#6b84a8', outline: i === atual ? '1px solid rgba(232,160,32,.3)' : '1px solid transparent', transition: 'all .2s' }}>{s.label}</button>
        ))}
      </div>
    </div>
  )
}

export default function OfertaFinancas() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null)

  const features = [
    { icon: 'X', titulo: 'Importacao de extratos', desc: 'OFX, CSV, PDF e XLS de qualquer banco.' },
    { icon: 'X', titulo: 'Categorizacao inteligente', desc: 'Classifique despesas por categoria.' },
    { icon: 'X', titulo: 'Resumo mensal visual', desc: 'Cards de entradas, despesas, fatura do cartao, saldo final.' },
    { icon: 'X', titulo: 'Sistema de grupos', desc: 'Configure suas metas por necessidades, conforto, investimentos e imprevistos.' },
    { icon: 'X', titulo: 'Graficos de evolucao', desc: 'Veja como seu saldo e despesas evoluiram nos ultimos 12 meses.' },
    { icon: 'X', titulo: 'Orcamento por categoria', desc: 'Defina metas mensais e acompanhe o real vs planejado.' },
  ]

  const faqs = [
    { p: 'O acesso e realmente gratis por 30 dias?', r: 'Sim. Voce acessa a plataforma completa por 30 dias sem pagar nada e sem precisar cadastrar cartao de credito.' },
    { p: 'Preciso saber de investimentos para usar?', r: 'Nao. A aba Financas e para quem quer organizar o dinheiro primeiro, antes de qualquer investimento.' },
    { p: 'Funciona com qualquer banco?', r: 'Sim. Aceita arquivos OFX, CSV, TXT, PDF, XLS e XLSX.' },
    { p: 'Posso cancelar quando quiser?', r: 'Sim, sem multa e sem fidelidade.' },
    { p: 'O que acontece apos os 30 dias?', r: 'Se quiser continuar com a aba Financas, o plano Starter custa R$19,99/mes.' },
    { p: 'Meus dados bancarios ficam seguros?', r: 'Voce importa apenas o arquivo de extrato, nunca conectamos ao seu banco nem pedimos senha.' },
  ]

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.white, fontFamily: 'var(--font-inter,Inter,sans-serif)' }}>

      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1100, margin: '0 auto' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="28" height="28" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#050d1a"/><circle cx="16" cy="16" r="4" fill="#e8a020"/><circle cx="16" cy="16" r="8" fill="none" stroke="#e8a020" strokeWidth="1.5" opacity=".6"/><circle cx="16" cy="16" r="13" fill="none" stroke="#e8a020" strokeWidth="1" opacity=".3"/></svg>
          <span style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontWeight: 700, fontSize: 16, color: C.white }}>Radar Invest Pro</span>
        </a>
        <a href="/cadastro?trial=starter" style={{ background: C.gold, color: '#000', fontWeight: 700, fontSize: 13, padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>Acesse gratis</a>
      </nav>

      <section style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
          30 dias gratis sem cartao de credito
        </div>
        <h1 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
          Saia das Dividas e se Torne<br /><span style={{ color: C.gold }}>um Investidor</span>
        </h1>
        <p style={{ fontSize: 'clamp(15px,2vw,19px)', color: C.muted, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 28px' }}>
          Importe seu extrato bancario e veja exatamente onde o dinheiro esta indo e quanto sobra para investir todo mes.
        </p>

        <div style={{ background: C.card, border: '1px solid rgba(232,160,32,.2)', borderRadius: 16, padding: '24px 32px', maxWidth: 480, margin: '0 auto 36px', textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.muted, textTransform: 'uppercase', marginBottom: 16 }}>Seu fluxo pode ser assim:</div>
          {[
            { label: 'Renda Mensal', val: 'R$ 10.847', cor: C.gold,  sinal: '' },
            { label: 'Despesas',     val: 'R$ 8.213',  cor: C.red,   sinal: '-' },
            { label: 'Investimento', val: 'R$ 2.634',  cor: C.green, sinal: '=' },
          ].map((row, i) => (
            <div key={i}>
              {i > 0 && <div style={{ height: 1, background: C.border, margin: '10px 0' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.cor, flexShrink: 0, display: 'inline-block' }} />{row.label}
                </span>
                <span style={{ fontSize: 18, fontWeight: 900, color: row.cor }}>{row.sinal} {row.val}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green, textTransform: 'uppercase' }}>24,2% da renda investido</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>METAS REALIZADAS</span>
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <a href="/cadastro?trial=starter" style={{ display: 'block', width: '100%', maxWidth: 400, background: C.green, color: '#fff', fontWeight: 800, fontSize: 18, padding: '18px 24px', borderRadius: 12, textDecoration: 'none', textAlign: 'center', letterSpacing: '.01em', boxShadow: '0 4px 24px rgba(34,197,94,.35)' }}>
            Comecar 30 dias gratis
          </a>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Sem cartao de credito - Cancele quando quiser</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: 0 }}>57 profissionais ja utilizam a plataforma</p>
        </div>
      </section>

      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 60px' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 16, border: '1px solid rgba(232,160,32,.15)', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
          <iframe src="https://www.youtube.com/embed/g717ENizBpY?rel=0&modestbranding=1" title="Radar Invest Pro" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      </section>

      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 32px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 10 }}>Veja a plataforma</div>
          <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700 }}>4 abas que mudam sua relacao com o dinheiro</h2>
        </div>
        <CarrosselApp />
      </section>

      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 56px' }}>
        <div style={{ background: C.card, border: '1px solid rgba(34,197,94,.2)', borderRadius: 16, padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 6, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '.08em', textTransform: 'uppercase' }}>Incluido na conta gratuita</span>
            <span style={{ fontSize: 13, color: C.muted }}>mesmo apos o trial:</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { icon: 'X', titulo: 'Monitoramento de acoes', desc: 'Cotacoes em tempo real com P/L, P/VP, ROE, DY e mais.' },
              { icon: 'X', titulo: 'Carteira com ate 2 acoes', desc: 'Monte sua carteira e receba alertas de variacao.' },
              { icon: 'X', titulo: 'Noticias do mercado', desc: 'Feed de noticias da B3, macro e empresas.' },
              { icon: 'X', titulo: 'Teses de investimento', desc: 'Analises de empresas listadas na B3.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.titulo}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>Com o plano <strong style={{ color: C.gold }}>Starter (R$ 19,99/mes)</strong> voce desbloqueia a aba Financas completa.</span>
            <a href="/planos" style={{ fontSize: 13, fontWeight: 600, color: C.gold, textDecoration: 'none' }}>Ver todos os planos</a>
          </div>
        </div>
      </section>

      <section style={{ background: 'linear-gradient(135deg, #0b1829 0%, #0f2040 100%)', borderTop: '1px solid rgba(232,160,32,.15)', borderBottom: '1px solid rgba(232,160,32,.15)', padding: '60px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 16 }}>Plano Starter</div>
          <div style={{ background: '#050d1a', border: '2px solid rgba(232,160,32,.35)', borderRadius: 20, padding: '36px 40px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 16 }}>30 dias gratis</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>depois apenas</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: C.white, lineHeight: 1 }}>R$ 19,99</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>/mes sem fidelidade</div>
            {['Aba Financas completa', 'Importacao ilimitada de extratos', 'Carteira de acoes com cotacoes', 'Analise DCF de empresas da B3', 'Teses de investimento', 'Noticias e alertas do mercado'].map((item, i) => (
              <div key={i} style={{ fontSize: 14, color: 'rgba(255,255,255,.80)', padding: '7px 0', borderBottom: i < 5 ? `1px solid ${C.border}` : 'none', textAlign: 'left' }}>{item}</div>
            ))}
            <a href="/cadastro?trial=starter" style={{ display: 'block', background: C.gold, color: '#000', fontWeight: 800, fontSize: 16, padding: '16px', borderRadius: 10, textDecoration: 'none', marginTop: 28 }}>Comecar 30 dias gratis</a>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Sem cartao de credito - Cancele quando quiser</p>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, textAlign: 'center', marginBottom: 36 }}>30 dias gratis ou continuar perdendo dinheiro?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 14, padding: '24px' }}>
            <div style={{ fontWeight: 700, color: C.red, marginBottom: 16, fontSize: 15 }}>Sem controle</div>
            {['Gasta sem saber onde', 'Fim do mes no vermelho', 'Dividas acumulando', 'Zero investido', 'Ansiedade financeira todo dia'].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.60)', padding: '5px 0' }}>- {item}</div>
            ))}
          </div>
          <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 14, padding: '24px' }}>
            <div style={{ fontWeight: 700, color: C.green, marginBottom: 16, fontSize: 15 }}>Com Radar Invest Pro</div>
            {['Sabe onde o dinheiro foi', 'Sempre sobra para investir', 'Dividas zeradas em meses', 'Investe todo mes', 'Paz financeira no fim do mes'].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,.80)', padding: '5px 0' }}>+ {item}</div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>Perguntas frequentes</h2>
        {faqs.map((faq, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
            <button onClick={() => setFaqAberto(faqAberto === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', color: C.white, textAlign: 'left', padding: '18px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600, gap: 12 }}>
              <span>{faq.p}</span>
              <span style={{ color: C.gold, fontSize: 20, flexShrink: 0, transition: 'transform .2s', transform: faqAberto === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
            </button>
            {faqAberto === i && <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.8, paddingBottom: 18 }}>{faq.r}</div>}
          </div>
        ))}
      </section>

      <section style={{ background: 'linear-gradient(135deg, #0b1829 0%, #0f2040 100%)', borderTop: '1px solid rgba(232,160,32,.15)', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>X</div>
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, marginBottom: 16 }}>Comece hoje. Resultado no fim do mes.</h2>
        <p style={{ fontSize: 17, color: C.muted, maxWidth: 520, margin: '0 auto 36px' }}>30 dias gratis, sem cartao.</p>
        <a href="/cadastro?trial=starter" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.gold, color: '#000', fontWeight: 800, fontSize: 18, padding: '18px 44px', borderRadius: 50, textDecoration: 'none', letterSpacing: '.02em' }}>Acessar gratis por 30 dias</a>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 14 }}>Sem cartao de credito - Acesso imediato - Cancele quando quiser</p>
      </section>

      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '24px', textAlign: 'center', fontSize: 12, color: C.muted }}>
        <a href="/" style={{ color: C.gold, textDecoration: 'none', fontWeight: 700 }}>radarinvestpro.com.br</a>
        {' - '}
        <a href="/privacidade" style={{ color: C.muted, textDecoration: 'none' }}>Privacidade</a>
        {' - '}
        <a href="/planos" style={{ color: C.muted, textDecoration: 'none' }}>Ver todos os planos</a>
        <br /><br />
        <span>Radar Invest Pro - Marca registrada INPI n 943514495</span>
      </footer>

    </div>
  )
}
