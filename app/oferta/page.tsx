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

const planos = [
  {
    nome: 'Starter',
    preco: 'R$ 19,99',
    periodo: '/mês',
    destaque: false,
    tag: '',
    features: [
      'Aba Finanças Pessoais',
      'Carteira com cotações em tempo real',
      'Análise DCF de empresas B3',
      'Teses de investimento',
      'Notícias e alertas de mercado',
    ],
    cta: 'Começar por R$ 19,99/mês',
    href: '/cadastro?plano=starter',
  },
  {
    nome: 'Essencial',
    preco: 'R$ 49,90',
    periodo: '/mês',
    destaque: true,
    tag: 'Mais popular',
    features: [
      'Tudo do Starter',
      'Análise fundamentalista completa',
      'Alertas de variação de carteira',
      'Valuation multi-método (DCF + Graham)',
      'Exportação de relatórios PDF e Excel',
    ],
    cta: 'Assinar Essencial',
    href: '/cadastro?plano=essencial',
  },
  {
    nome: 'Pro',
    preco: 'R$ 99,90',
    periodo: '/mês',
    destaque: false,
    tag: 'Para profissionais',
    features: [
      'Tudo do Essencial',
      'Acesso à API de dados',
      'Múltiplas carteiras',
      'Histórico ilimitado de análises',
      'Suporte prioritário',
    ],
    cta: 'Assinar Pro',
    href: '/cadastro?plano=pro',
  },
]

const modulos = [
  { icon: '💰', nome: 'Finanças Pessoais', desc: 'Importe extratos, categorize gastos e veja sobrar dinheiro para investir todo mês.' },
  { icon: '📊', nome: 'Carteira de Ações', desc: 'Acompanhe todas suas ações em um só lugar com cotações em tempo real da B3.' },
  { icon: '🔬', nome: 'Valuation DCF', desc: 'Precifique qualquer empresa com o mesmo modelo de fluxo de caixa dos profissionais.' },
  { icon: '📈', nome: 'Análise Fundamentalista', desc: 'ROE, ROIC, P/L, P/VP, DL/EBITDA — todos os múltiplos em um painel comparativo.' },
  { icon: '📰', nome: 'Teses de Investimento', desc: 'Histórico de teses com entrada, resultado e acompanhamento de stop.' },
  { icon: '🔔', nome: 'Alertas Automáticos', desc: 'Alertas de variação de 15% e 30% para nenhum movimento importante escapar.' },
]

const faqs = [
  { p: 'Preciso saber de análise de ações para usar?', r: 'Não. O Radar Invest Pro foi criado para ser simples: você começa pela aba Finanças para organizar o dinheiro, depois avança para a carteira e o DCF no seu próprio ritmo.' },
  { p: 'Funciona com qualquer banco?', r: 'Sim. A aba Finanças aceita OFX, CSV, PDF, XLS e XLSX de qualquer banco brasileiro.' },
  { p: 'Posso cancelar quando quiser?', r: 'Sim, sem multa, sem fidelidade e sem burocracia. Cancele em um clique no painel.' },
  { p: 'A plataforma é web ou precisa instalar algo?', r: 'Totalmente web — acesse de qualquer navegador, no celular ou computador. Não precisa instalar nada.' },
  { p: 'O que é o modelo DCF?', r: 'DCF (Discounted Cash Flow) é o método de valuation usado pelos maiores fundos do Brasil para estimar o preço justo de uma ação. O Radar Invest Pro faz esse cálculo por você, com premissas baseadas nos dados do BACEN.' },
]

export default function OfertaPage() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null)

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.white, fontFamily: 'var(--font-inter,Inter,sans-serif)' }}>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/login" style={{ color: C.muted, fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Entrar</a>
          <a href="/cadastro" style={{ background: C.gold, color: '#000', fontWeight: 700, fontSize: 13, padding: '8px 20px', borderRadius: 8, textDecoration: 'none' }}>
            Começar grátis
          </a>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '72px 24px 56px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(232,160,32,.1)', border: '1px solid rgba(232,160,32,.3)', borderRadius: 20, padding: '5px 16px', fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 20 }}>
          radarinvestpro.com.br — A partir de R$&nbsp;19,99/mês
        </div>

        <h1 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(32px,5vw,58px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 22 }}>
          Analise ações como um<br />
          <span style={{ color: C.gold }}>profissional de mercado</span>
        </h1>

        <p style={{ fontSize: 'clamp(16px,2vw,20px)', color: C.muted, lineHeight: 1.7, maxWidth: 620, margin: '0 auto 40px' }}>
          DCF, análise fundamentalista, carteira com cotações em tempo real e controle financeiro pessoal — tudo em um único lugar, por menos que o custo de um café por dia.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/cadastro" style={{ background: C.gold, color: '#000', fontWeight: 800, fontSize: 16, padding: '16px 36px', borderRadius: 50, textDecoration: 'none', letterSpacing: '.02em' }}>
            Começar por R$&nbsp;19,99/mês
          </a>
          <a href="/oferta-financas" style={{ background: 'rgba(255,255,255,.06)', color: C.white, fontWeight: 600, fontSize: 15, padding: '16px 28px', borderRadius: 50, textDecoration: 'none', border: `1px solid ${C.border}` }}>
            Ver módulo Finanças →
          </a>
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 14 }}>Sem fidelidade · Cancele quando quiser · Acesso imediato</p>
      </section>

      {/* ── MÓDULOS ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 10 }}>O que está incluído</div>
          <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700 }}>
            6 módulos completos numa única assinatura
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {modulos.map((m, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{m.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{m.nome}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DESTAQUE FINANÇAS ──────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, rgba(232,160,32,.06) 0%, rgba(34,197,94,.04) 100%)`, borderTop: `1px solid rgba(232,160,32,.1)`, borderBottom: `1px solid rgba(232,160,32,.1)`, padding: '60px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 12 }}>Comece por aqui</div>
            <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700, marginBottom: 16 }}>
              Saia das dívidas antes<br />de começar a investir
            </h2>
            <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, marginBottom: 24 }}>
              A aba Finanças é o ponto de partida para qualquer investidor: organize, categorize e defina o quanto vai investir todo mês — de forma automática.
            </p>
            <a href="/oferta-financas" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,160,32,.1)', border: '1px solid rgba(232,160,32,.3)', color: C.gold, fontWeight: 700, fontSize: 14, padding: '12px 22px', borderRadius: 8, textDecoration: 'none' }}>
              Ver página completa do módulo Finanças →
            </a>
          </div>
          <div style={{ background: '#050d1a', border: `1px solid rgba(232,160,32,.2)`, borderRadius: 14, padding: '22px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: C.muted, textTransform: 'uppercase', marginBottom: 14 }}>Seu fluxo pode ser assim:</div>
            {[
              { label: 'Renda Mensal',  val: 'R$ 10.847', cor: C.gold,  sinal: '' },
              { label: 'Despesas',      val: 'R$ 8.213',  cor: C.red,   sinal: '−' },
              { label: 'Investimento',  val: 'R$ 2.634',  cor: C.green, sinal: '=' },
            ].map((row, i) => (
              <div key={i}>
                {i > 0 && <div style={{ height: 1, background: C.border, margin: '9px 0' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.60)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.cor, display: 'inline-block' }} />
                    {row.label}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: row.cor }}>{row.sinal} {row.val}</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.green }}>
              ▲ 24,2% da renda investido · METAS REALIZADAS
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANOS ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 980, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: C.gold, textTransform: 'uppercase', marginBottom: 10 }}>Planos e preços</div>
          <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 700 }}>
            Comece pelo Starter e evolua no seu ritmo
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {planos.map((p, i) => (
            <div key={i} style={{
              background: p.destaque ? 'linear-gradient(135deg, #0f2040 0%, #0b1829 100%)' : C.card,
              border: p.destaque ? `2px solid rgba(232,160,32,.45)` : `1px solid ${C.border}`,
              borderRadius: 16, padding: '28px 24px',
              position: 'relative',
            }}>
              {p.tag && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: C.gold, color: '#000', fontWeight: 800, fontSize: 11, padding: '4px 16px', borderRadius: 20, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                  {p.tag}
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{p.nome}</div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: C.white }}>{p.preco}</span>
                <span style={{ fontSize: 14, color: C.muted }}>{p.periodo}</span>
              </div>
              {p.features.map((f, j) => (
                <div key={j} style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', padding: '6px 0', borderBottom: j < p.features.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 8 }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>✓</span> {f}
                </div>
              ))}
              <a href={p.href} style={{
                display: 'block', marginTop: 22, textAlign: 'center',
                background: p.destaque ? C.gold : 'rgba(255,255,255,.07)',
                color: p.destaque ? '#000' : C.white,
                fontWeight: 700, fontSize: 14, padding: '13px', borderRadius: 10,
                textDecoration: 'none', border: p.destaque ? 'none' : `1px solid ${C.border}`,
              }}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 24 }}>
          Todos os planos incluem acesso imediato · Cancele quando quiser · Sem fidelidade
        </p>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 64px' }}>
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
        <h2 style={{ fontFamily: 'var(--font-space,Space Grotesk,sans-serif)', fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, marginBottom: 16 }}>
          Comece hoje por R$&nbsp;19,99/mês
        </h2>
        <p style={{ fontSize: 17, color: C.muted, marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
          Mesmo preço de uma pizza. O retorno pode mudar sua vida financeira.
        </p>
        <a href="/cadastro" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: C.gold, color: '#000', fontWeight: 800, fontSize: 18, padding: '18px 44px', borderRadius: 50, textDecoration: 'none', letterSpacing: '.02em' }}>
          Criar conta agora
        </a>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 14 }}>Acesso imediato · Cancele quando quiser</p>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '24px', textAlign: 'center', fontSize: 12, color: C.muted }}>
        <a href="/" style={{ color: C.gold, textDecoration: 'none', fontWeight: 700 }}>radarinvestpro.com.br</a>
        {' · '}
        <a href="/privacidade" style={{ color: C.muted, textDecoration: 'none' }}>Privacidade</a>
        {' · '}
        <a href="/planos" style={{ color: C.muted, textDecoration: 'none' }}>Ver todos os planos</a>
        {' · '}
        <a href="/oferta-financas" style={{ color: C.muted, textDecoration: 'none' }}>Módulo Finanças</a>
        <br /><br />
        <span>Radar Invest Pro · Marca registrada INPI nº 943514495</span>
      </footer>

    </div>
  )
}
