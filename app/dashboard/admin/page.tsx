'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import NavBar from '@/components/NavBar'

interface Acao {
  ticker: string; nome: string; setor: string
  preco: number | null; dy: number | null; pl: number | null
  pvp: number | null; roe: number | null; lpa: number | null
  divEbit: number | null; vpa: number | null; merc: number | null
  evEbit: number | null; max52s: number | null; varVsMax: number | null
  gov: number | null; nota: number | null; atualizado: string | null
}

const f1 = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Card({ label, value, sub, color = '#e8edf5' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#081120', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', padding: '20px 24px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#6b84a8', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontSize: '36px', fontWeight: 700, color, fontFamily: 'var(--font-space),Space Grotesk,sans-serif', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#6b84a8', marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

function Progress({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,.07)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color, minWidth: '48px', textAlign: 'right' }}>{value}/{max}</span>
    </div>
  )
}

export default function AdminPage() {
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)
  const [ts, setTs] = useState('')

  useEffect(() => {
    fetch('/api/acoes')
      .then(r => r.json())
      .then(d => { setAcoes(d.acoes ?? []); setTs(d.ts ? new Date(d.ts).toLocaleString('pt-BR') : '') })
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const total    = acoes.length
    const comPreco = acoes.filter(a => a.preco != null).length
    const comFund  = acoes.filter(a => a.pl != null).length
    const comGov   = acoes.filter(a => a.gov != null && a.gov > 0).length
    const comNota  = acoes.filter(a => a.nota != null && a.nota > 0).length
    const al30     = acoes.filter(a => a.varVsMax != null && a.varVsMax <= -30).length
    const al15     = acoes.filter(a => a.varVsMax != null && a.varVsMax <= -15 && a.varVsMax > -30).length
    const semPreco = acoes.filter(a => a.preco == null)
    const semFund  = acoes.filter(a => a.pl == null && a.roe == null)
    const semGov   = acoes.filter(a => a.gov == null || a.gov === 0)

    /* cobertura por setor */
    const setores = [...new Set(acoes.map(a => a.setor))].sort()
    const porSetor = setores.map(s => {
      const lista = acoes.filter(a => a.setor === s)
      const govOk = lista.filter(a => a.gov != null && a.gov > 0).length
      const fundOk = lista.filter(a => a.pl != null).length
      return { setor: s, total: lista.length, govOk, fundOk }
    })

    /* média de nota por setor */
    const mediaNotas = setores.map(s => {
      const lista = acoes.filter(a => a.setor === s && a.nota != null)
      const avg = lista.length > 0 ? lista.reduce((acc, a) => acc + (a.nota ?? 0), 0) / lista.length : null
      return { setor: s, avg, count: lista.length }
    }).filter(x => x.avg != null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))

    /* top 10 por nota */
    const top10 = [...acoes].filter(a => a.nota != null).sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0)).slice(0, 10)

    return { total, comPreco, comFund, comGov, comNota, al30, al15, semPreco, semFund, semGov, porSetor, mediaNotas, top10 }
  }, [acoes])

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5;min-height:100vh}
        .hdr{background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
        .hdr-logo{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#fff}
        .hdr-logo span{color:#e8a020}
        .back{font-size:12px;color:#6b84a8;text-decoration:none;margin-right:18px}
        .back:hover{color:#e8edf5}
        .body{max-width:1200px;margin:0 auto;padding:28px 24px}
        .section{margin-bottom:36px}
        .sec-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#e8a020;margin-bottom:16px}
        .grid-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:28px}
        .table-admin{width:100%;border-collapse:collapse;font-size:13px}
        .table-admin th{text-align:left;padding:8px 12px;font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b84a8;border-bottom:2px solid rgba(255,255,255,.08)}
        .table-admin td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
        .table-admin tr:hover td{background:rgba(255,255,255,.03)}
        .ticker-gold{font-weight:700;color:#e8a020;font-family:var(--font-space),'Space Grotesk',monospace}
        .tag-ok{background:rgba(102,187,106,.12);color:#66BB6A;border:1px solid rgba(102,187,106,.25);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700}
        .tag-warn{background:rgba(255,213,79,.1);color:#FFD54F;border:1px solid rgba(255,213,79,.25);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700}
        .tag-bad{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700}
        .spinner{width:32px;height:32px;border:3px solid rgba(232,160,32,.15);border-top-color:#e8a020;border-radius:50%;animation:spin .75s linear infinite;margin:80px auto}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.grid-cards{grid-template-columns:1fr 1fr}}
      `}</style>

      <NavBar />
      <header className="hdr">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/dashboard" className="back">← Monitoramento</Link>
          <div className="hdr-logo">Painel Admin</div>
        </div>
        {ts && <span style={{ fontSize: '11px', color: '#6b84a8' }}>Dados: {ts}</span>}
      </header>

      <div className="body">
        {loading ? <div className="spinner" /> : (
          <>
            {/* ── VISÃO GERAL ── */}
            <div className="section">
              <div className="sec-title">Visão Geral</div>
              <div className="grid-cards">
                <Card label="Total de Ações"     value={stats.total}    sub="no banco de dados"/>
                <Card label="Com Preço ao Vivo"  value={stats.comPreco} sub={`${Math.round(stats.comPreco/stats.total*100)}% cobertura`} color="#00d4a0"/>
                <Card label="Com Fundamentais"   value={stats.comFund}  sub={`${Math.round(stats.comFund/stats.total*100)}% cobertura`}  color="#00d4a0"/>
                <Card label="GOV Avaliadas"      value={stats.comGov}   sub={`${Math.round(stats.comGov/stats.total*100)}% cobertura`}   color="#e8a020"/>
                <Card label="Alerta −30%"        value={stats.al30}     sub="queda crítica vs máx 52s" color="#ef4444"/>
                <Card label="Alerta −15%"        value={stats.al15}     sub="queda atenção vs máx 52s" color="#f5c55a"/>
              </div>
            </div>

            {/* ── COBERTURA POR SETOR ── */}
            <div className="section">
              <div className="sec-title">Cobertura por Setor</div>
              <div style={{ background: '#081120', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="table-admin">
                  <thead><tr>
                    <th>Setor</th><th style={{textAlign:'right'}}>Ações</th>
                    <th style={{minWidth:'180px'}}>Fundamentais</th>
                    <th style={{minWidth:'180px'}}>GOV Avaliadas</th>
                    <th style={{textAlign:'right'}}>Nota Média</th>
                  </tr></thead>
                  <tbody>
                    {stats.porSetor.map(s => {
                      const notaSetor = stats.mediaNotas.find(x => x.setor === s.setor)
                      const nota = notaSetor?.avg ?? null
                      const notaCor = nota == null ? '#6b84a8' : nota >= 7 ? '#66BB6A' : nota >= 5 ? '#FFD54F' : '#EF9A9A'
                      return (
                        <tr key={s.setor}>
                          <td style={{ color: '#b8c4d4' }}>{s.setor}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.total}</td>
                          <td><Progress value={s.fundOk} max={s.total} color="#00d4a0"/></td>
                          <td><Progress value={s.govOk}  max={s.total} color="#e8a020"/></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: notaCor }}>{nota != null ? f1(nota) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── TOP 10 POR NOTA ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '36px' }}>
              <div className="section" style={{ marginBottom: 0 }}>
                <div className="sec-title">Top 10 — Maior Nota</div>
                <div style={{ background: '#081120', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table className="table-admin">
                    <thead><tr><th>#</th><th>Ticker</th><th>Setor</th><th style={{textAlign:'right'}}>Nota</th></tr></thead>
                    <tbody>
                      {stats.top10.map((a, i) => {
                        const c = (a.nota??0)>=7?'#66BB6A':(a.nota??0)>=5?'#FFD54F':'#EF9A9A'
                        return (
                          <tr key={a.ticker}>
                            <td style={{ color: '#6b84a8', width: '32px' }}>{i + 1}</td>
                            <td className="ticker-gold">{a.ticker}</td>
                            <td style={{ color: '#6b84a8', fontSize: '12px' }}>{a.setor}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: c }}>{f1(a.nota)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="section" style={{ marginBottom: 0 }}>
                <div className="sec-title">Ações Sem Governança Avaliada</div>
                <div style={{ background: '#081120', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', overflow: 'hidden', maxHeight: '320px', overflowY: 'auto' }}>
                  <table className="table-admin">
                    <thead><tr><th>Ticker</th><th>Nome</th><th>Setor</th></tr></thead>
                    <tbody>
                      {stats.semGov.map(a => (
                        <tr key={a.ticker}>
                          <td className="ticker-gold">{a.ticker}</td>
                          <td style={{ color: '#b8c4d4', fontSize: '12px' }}>{a.nome}</td>
                          <td style={{ color: '#6b84a8', fontSize: '11px' }}>{a.setor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── SEM PREÇO ── */}
            {stats.semPreco.length > 0 && (
              <div className="section">
                <div className="sec-title">⚠ Sem Preço ao Vivo ({stats.semPreco.length})</div>
                <div style={{ background: '#081120', border: '1px solid rgba(239,68,68,.2)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table className="table-admin">
                    <thead><tr><th>Ticker</th><th>Nome</th><th>Setor</th><th>Última Atualização</th></tr></thead>
                    <tbody>
                      {stats.semPreco.map(a => (
                        <tr key={a.ticker}>
                          <td className="ticker-gold">{a.ticker}</td>
                          <td style={{ color: '#b8c4d4', fontSize: '12px' }}>{a.nome}</td>
                          <td style={{ color: '#6b84a8', fontSize: '11px' }}>{a.setor}</td>
                          <td style={{ color: '#6b84a8', fontSize: '11px' }}>{a.atualizado ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── INSTRUÇÕES ── */}
            <div style={{ background: '#081120', border: '1px solid rgba(232,160,32,.15)', borderRadius: '12px', padding: '20px 24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#e8a020', marginBottom: '12px' }}>ℹ Como atualizar dados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', color: '#b8c4d4', lineHeight: 1.7 }}>
                <div>
                  <strong style={{ color: '#e8edf5' }}>Fundamentalistas (P/L, ROE, DY…)</strong><br/>
                  Abra o fundamento.py → selecione a ação → Editar Indicadores ou Atualizar Todas.<br/>
                  O sync para a web é automático via git push.
                </div>
                <div>
                  <strong style={{ color: '#e8edf5' }}>Governança</strong><br/>
                  Abra o fundamento.py → selecione a ação → botão Governança → responda os 10 critérios → Salvar.<br/>
                  O sync para a web é automático.
                </div>
                <div>
                  <strong style={{ color: '#e8edf5' }}>Incluir / Remover ação</strong><br/>
                  Adicione ou remova no fundamento.py (sidebar esquerda).<br/>
                  A web atualiza automaticamente.
                </div>
                <div>
                  <strong style={{ color: '#e8edf5' }}>Preços ao vivo</strong><br/>
                  Buscados do Yahoo Finance em tempo real ao acessar o dashboard.<br/>
                  Cache de 30 minutos no Vercel.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
