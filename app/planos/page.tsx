'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PLANOS = [
  {
    id: 'gratuito',
    nome: 'Gratuito',
    preco: 0,
    precoAnual: 0,
    cor: '#6b84a8',
    destaque: false,
    recursos: [
      '2 ações monitoradas',
      'Dashboard fundamentalista',
      'Score de Governança (11 critérios)',
      'Nota de qualidade 0–10',
    ],
    bloqueados: [
      'Carteira ilimitada',
      'Valuation DCF completo',
      'TIR Real implícita vs NTN-B',
      'Relatórios PDF',
      'Alertas de variação −15% e −30%',
      'Análise detalhada da carteira',
      'Indicar empresa para análise',
      'Suporte WhatsApp',
    ],
  },
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 49.90,
    precoAnual: 499,
    cor: '#e8a020',
    destaque: false,
    recursos: [
      'Carteira ilimitada',
      'Dashboard fundamentalista completo',
      'Score de Governança (11 critérios)',
      'Nota de qualidade 0–10',
      'Valuation DCF — todas as empresas',
      'TIR Real implícita vs NTN-B',
      '2 relatórios PDF por mês',
      'Alertas de variação −15% e −30%',
    ],
    bloqueados: [
      'Análise detalhada da carteira',
      'Indicar empresa para análise',
      'Suporte WhatsApp prioritário',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 99.90,
    precoAnual: 999,
    cor: '#66BB6A',
    destaque: true,
    recursos: [
      'Tudo do Essencial',
      '8 relatórios PDF por mês',
      'Análise detalhada da carteira',
      '  · Concentração por empresa e setor',
      '  · Métricas ponderadas (P/L, ROE, DY)',
      '  · Nota média ponderada da carteira',
      'Indicar 1 empresa/mês para análise',
      'Suporte prioritário via WhatsApp',
      'Acesso antecipado a novas análises',
    ],
    bloqueados: [],
  },
]

export default function PlanosPage() {
  const router = useRouter()
  const [anual, setAnual] = useState(false)
  const [planoAtual, setPlanoAtual] = useState<string>('gratuito')
  const [loading, setLoading] = useState<string | null>(null)
  const [logado, setLogado] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d?.id) { setLogado(true); setPlanoAtual(d.plano || 'gratuito') }
    }).catch(() => {})
  }, [])

  async function assinar(planoId: string) {
    if (!logado) { router.push('/cadastro'); return }
    if (planoId === 'gratuito') return
    setLoading(planoId)
    try {
      const r = await fetch('/api/pagamento/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: planoId, ciclo: anual ? 'anual' : 'mensal' }),
      })
      const data = await r.json()
      if (data.init_point) window.location.href = data.init_point
      else alert(data.erro || 'Erro ao iniciar pagamento. Tente novamente.')
    } catch {
      alert('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(null)
    }
  }

  const descontoEssencial = Math.round((1 - (499 / (49.90 * 12))) * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', color: '#e8edf4', fontFamily: 'Inter, sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: '64px', background: 'rgba(5,13,26,.95)', borderBottom: '1px solid rgba(255,255,255,.07)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #e8a020', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, background: '#e8a020', borderRadius: '50%' }} />
          </div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 17, fontWeight: 700, color: '#fff' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest</span> Pro
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          {logado
            ? <Link href="/dashboard" style={{ background: 'rgba(232,160,32,.12)', border: '1px solid rgba(232,160,32,.35)', color: '#e8a020', padding: '8px 20px', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Dashboard</Link>
            : <>
                <Link href="/login" style={{ color: '#6b84a8', padding: '8px 20px', textDecoration: 'none', fontSize: 13 }}>Entrar</Link>
                <Link href="/cadastro" style={{ background: '#e8a020', color: '#000', padding: '8px 20px', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>Criar conta</Link>
              </>
          }
        </div>
      </nav>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '72px 24px 48px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(232,160,32,.1)', border: '1px solid rgba(232,160,32,.25)', borderRadius: 100, padding: '5px 18px', fontSize: 11, fontWeight: 700, color: '#e8a020', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24 }}>
          Planos e Preços
        </div>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(34px,5vw,54px)', fontWeight: 700, letterSpacing: -1.5, marginBottom: 16, lineHeight: 1.1 }}>
          Análise como gestora de fundo.<br />
          <span style={{ color: '#e8a020' }}>Ao preço de investidor individual.</span>
        </h1>
        <p style={{ color: '#6b84a8', fontSize: 16, maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Ferramenta profissional para quem leva a sério a carteira de ações na B3.
        </p>

        {/* Toggle mensal/anual */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 100, padding: '4px 6px' }}>
          <button onClick={() => setAnual(false)} style={{ padding: '7px 22px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: !anual ? '#fff' : 'transparent', color: !anual ? '#050d1a' : '#6b84a8', transition: 'all .2s' }}>
            Mensal
          </button>
          <button onClick={() => setAnual(true)} style={{ padding: '7px 22px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: anual ? '#e8a020' : 'transparent', color: anual ? '#000' : '#6b84a8', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 8 }}>
            Anual
            <span style={{ background: '#22c55e', color: '#000', borderRadius: 100, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              -{descontoEssencial}%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', padding: '0 24px 64px', flexWrap: 'wrap', maxWidth: 1080, margin: '0 auto' }}>
        {PLANOS.map(p => {
          const ativo = planoAtual === p.id
          const preco = anual && p.precoAnual > 0 ? p.precoAnual : p.preco
          const sufixo = p.preco === 0 ? '' : anual ? '/ano' : '/mês'

          return (
            <div key={p.id} style={{
              flex: '1 1 290px', maxWidth: 330,
              background: p.destaque
                ? 'linear-gradient(160deg,rgba(102,187,106,.07) 0%,rgba(5,13,26,1) 60%)'
                : 'rgba(255,255,255,.025)',
              border: `1.5px solid ${p.destaque ? 'rgba(102,187,106,.35)' : ativo ? 'rgba(232,160,32,.4)' : 'rgba(255,255,255,.07)'}`,
              borderRadius: 16, padding: '32px 26px', position: 'relative',
            }}>
              {p.destaque && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#66BB6A', color: '#000', borderRadius: 100, padding: '3px 16px', fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Mais completo
                </div>
              )}
              {ativo && !p.destaque && (
                <div style={{ position: 'absolute', top: -12, right: 20, background: '#e8a020', color: '#000', borderRadius: 100, padding: '3px 14px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>
                  Seu plano
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: p.cor, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>{p.nome}</div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, marginBottom: anual && p.preco > 0 ? 4 : 20 }}>
                {p.preco === 0
                  ? <span style={{ fontSize: 40, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: '#e8edf4' }}>Grátis</span>
                  : <>
                      <span style={{ fontSize: 13, color: '#6b84a8', marginBottom: 10 }}>R$</span>
                      <span style={{ fontSize: 44, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1, color: '#e8edf4' }}>
                        {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: 13, color: '#6b84a8', marginBottom: 10 }}>{sufixo}</span>
                    </>
                }
              </div>

              {anual && p.preco > 0 && (
                <div style={{ fontSize: 12, color: '#6b84a8', marginBottom: 20 }}>
                  equiv. a R$ {(preco / 12).toFixed(2).replace('.', ',')}/mês · 2 meses grátis
                </div>
              )}

              <div style={{ height: 1, background: 'rgba(255,255,255,.07)', marginBottom: 20 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 28, minHeight: 200 }}>
                {p.recursos.map(r => {
                  const recuado = r.startsWith('  ·')
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: recuado ? 12.5 : 13.5, color: recuado ? '#6b84a8' : '#b8c4d4', paddingLeft: recuado ? 16 : 0 }}>
                      {!recuado && <span style={{ color: '#66BB6A', fontSize: 14, marginTop: 1, flexShrink: 0 }}>✓</span>}
                      {recuado ? r.trim() : r}
                    </div>
                  )
                })}
                {p.bloqueados.map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'rgba(255,255,255,.18)' }}>
                    <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>✕</span>
                    {r}
                  </div>
                ))}
              </div>

              {p.id === 'gratuito'
                ? (
                  <Link href={logado ? '/dashboard' : '/cadastro'} style={{
                    display: 'block', textAlign: 'center', padding: '13px', borderRadius: 8,
                    fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,.06)',
                    color: '#e8edf4', textDecoration: 'none', border: '1px solid rgba(255,255,255,.1)',
                  }}>
                    {logado ? 'Acessar Dashboard' : 'Começar Grátis'}
                  </Link>
                )
                : (
                  <button
                    onClick={() => assinar(p.id)}
                    disabled={loading === p.id || ativo}
                    style={{
                      width: '100%', padding: '13px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                      cursor: ativo ? 'default' : 'pointer',
                      background: ativo ? 'rgba(232,160,32,.12)' : p.destaque ? '#66BB6A' : '#e8a020',
                      color: ativo ? '#e8a020' : '#000', border: 'none',
                      opacity: loading === p.id ? 0.7 : 1, transition: 'all .2s',
                    }}
                  >
                    {loading === p.id ? 'Aguarde…' : ativo ? '✓ Plano ativo' : `Assinar ${p.nome}`}
                  </button>
                )
              }
            </div>
          )
        })}
      </div>

      {/* Comparativo detalhado */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 80px' }}>
        <h2 style={{ textAlign: 'center', fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, marginBottom: 32, color: '#e8edf4' }}>
          Comparativo completo
        </h2>
        <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { recurso: 'Ações monitoradas',             gratuito: '2',    essencial: 'Ilimitadas', pro: 'Ilimitadas' },
            { recurso: 'Dashboard fundamentalista',      gratuito: '✓',    essencial: '✓',          pro: '✓' },
            { recurso: 'Score de Governança',            gratuito: '✓',    essencial: '✓',          pro: '✓' },
            { recurso: 'Nota de qualidade 0–10',         gratuito: '✓',    essencial: '✓',          pro: '✓' },
            { recurso: 'Valuation DCF completo',         gratuito: '—',    essencial: '✓',          pro: '✓' },
            { recurso: 'TIR Real implícita vs NTN-B',    gratuito: '—',    essencial: '✓',          pro: '✓' },
            { recurso: 'Relatórios PDF',                 gratuito: '—',    essencial: '2/mês',      pro: '8/mês' },
            { recurso: 'Alertas de variação',            gratuito: '—',    essencial: '✓',          pro: '✓' },
            { recurso: 'Concentração da carteira',       gratuito: '—',    essencial: '—',          pro: '✓' },
            { recurso: 'Métricas ponderadas',            gratuito: '—',    essencial: '—',          pro: '✓' },
            { recurso: 'Nota média da carteira',         gratuito: '—',    essencial: '—',          pro: '✓' },
            { recurso: 'Indicar empresa para análise',   gratuito: '—',    essencial: '—',          pro: '1/mês' },
            { recurso: 'Suporte WhatsApp prioritário',   gratuito: '—',    essencial: '—',          pro: '✓' },
          ].map((row, i) => (
            <div key={row.recurso} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              borderBottom: i < 12 ? '1px solid rgba(255,255,255,.05)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)',
            }}>
              <div style={{ padding: '13px 20px', fontSize: 13.5, color: '#b8c4d4' }}>{row.recurso}</div>
              {[row.gratuito, row.essencial, row.pro].map((v, j) => (
                <div key={j} style={{ padding: '13px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600,
                  color: v === '—' ? 'rgba(255,255,255,.2)' : v === '✓' || v.includes('/') || v === 'Ilimitadas' || v === '2'
                    ? (j === 2 ? '#66BB6A' : j === 1 ? '#e8a020' : '#6b84a8')
                    : '#6b84a8'
                }}>
                  {v}
                </div>
              ))}
            </div>
          ))}
          {/* Header do comparativo */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.08)', order: -1 }}>
            <div style={{ padding: '12px 20px', fontSize: 12, color: '#6b84a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Recurso</div>
            {['Gratuito', 'Essencial', 'Pro'].map((n, i) => (
              <div key={n} style={{ padding: '12px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                color: i === 2 ? '#66BB6A' : i === 1 ? '#e8a020' : '#6b84a8'
              }}>{n}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ textAlign: 'center', padding: '0 24px 60px', color: '#6b84a8', fontSize: 13, lineHeight: 2 }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
        Pagamento seguro via Mercado Pago · Cancele quando quiser · Sem fidelidade<br />
        Dúvidas? <a href="mailto:contato@radarinvestpro.com.br" style={{ color: '#e8a020', textDecoration: 'none' }}>contato@radarinvestpro.com.br</a>
        {' · '}
        <a href="https://wa.me/5565992287632" target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none' }}>WhatsApp</a>
      </div>
    </div>
  )
}
