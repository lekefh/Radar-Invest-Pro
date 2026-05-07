'use client'
import { useState, useMemo } from 'react'
import NavBar from '@/components/NavBar'
import dcfRaw from '@/lib/dcf.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcfData = dcfRaw as Record<string, any>
const empresas = Object.values(dcfData).sort((a: any, b: any) => {
  const ua = a.base?.upside ?? a.upside_base_legado ?? -999
  const ub = b.base?.upside ?? b.upside_base_legado ?? -999
  return ub - ua
})

const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fPct = (v: number | null | undefined) => v == null ? '—' : `${v > 0 ? '+' : ''}${f1(v)}%`
const corUpside = (v: number | null | undefined) =>
  v == null ? '#6b84a8' : v >= 20 ? '#00d4a0' : v >= 0 ? '#FFD54F' : '#ef4444'

type Aba = 'resumo' | 'historico' | 'linhas' | 'projecoes' | 'sensibilidade' | 'outros' | 'tri'

/* ── Componentes menores ──────────────────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: '100px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const }}>
      {label}
    </span>
  )
}

function CenCard({ label, cor, preco, upside }: { label: string; cor: string; preco: number|null; upside: number|null }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.03)', border: `1px solid ${cor}33`, borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const, color: cor, marginBottom: '10px' }}>{label}</div>
      <div style={{ fontSize: '30px', fontWeight: 700, color: cor, fontFamily: 'var(--font-space),Space Grotesk,sans-serif', lineHeight: 1 }}>
        {preco != null ? `R$ ${f2(preco)}` : 'R$ —'}
      </div>
      {upside != null && (
        <div style={{ fontSize: '14px', color: cor, marginTop: '6px', fontWeight: 600 }}>{fPct(upside)}</div>
      )}
    </div>
  )
}

function ParamCard({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '8px', padding: '12px 16px' }}>
      <div style={{ fontSize: '10.5px', color: '#6b84a8', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-space),monospace' }}>{val}</div>
    </div>
  )
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#e8a020', marginBottom: '14px', marginTop: '24px' }}>{children}</div>
}

function Tabela({ cols, rows }: { cols: string[]; rows: (string|number|null)[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '500px' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const, color: '#6b84a8', borderBottom: '2px solid rgba(255,255,255,.08)', whiteSpace: 'nowrap' as const }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 12px', textAlign: j === 0 ? 'left' : 'right', color: j === 0 ? '#b8c4d4' : '#e8edf5', fontFamily: j === 0 ? 'inherit' : 'var(--font-space),monospace', fontWeight: j === 0 ? 400 : 600 }}>
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Modal relatório ───────────────────────────────────────────────────────── */
function ModalRelatorio({ ticker, nome, onClose }: { ticker: string; nome: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [rel, setRel] = useState<string|null>(null)
  const [erro, setErro] = useState('')

  const gerar = async () => {
    setLoading(true); setErro(''); setRel(null)
    try {
      const r = await fetch(`/api/relatorio/${ticker}`)
      const d = await r.json()
      if (!r.ok) { setErro(d.error ?? 'Erro'); return }
      setRel(d.relatorio)
    } catch { setErro('Erro de conexão.') }
    finally { setLoading(false) }
  }

  const html = useMemo(() => rel ? rel
    .replace(/^### (.+)$/gm, '<h3 style="color:#e8a020;margin:18px 0 6px;font-size:13px;letter-spacing:.5px;text-transform:uppercase">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#e8edf5;margin:22px 0 8px;font-size:15px;font-weight:700">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8edf5">$1</strong>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#e8a020">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/>')
    : '', [rel])

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }}
         onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#0d1a2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:'14px',width:'100%',maxWidth:'800px',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>📄 Relatório — {ticker} · {nome}</h2>
          <div style={{ display:'flex',gap:'8px' }}>
            {rel&&<button onClick={()=>navigator.clipboard.writeText(rel)} style={{ background:'rgba(232,160,32,.12)',border:'1px solid rgba(232,160,32,.3)',color:'#e8a020',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontWeight:600 }}>⎘ Copiar</button>}
            <button onClick={onClose} style={{ background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer' }}>×</button>
          </div>
        </div>
        <div style={{ overflowY:'auto',padding:'20px 24px',flex:1,fontSize:'13.5px',lineHeight:1.8,color:'#b8c4d4' }}>
          {!rel&&!loading&&!erro&&(
            <div style={{ textAlign:'center',padding:'40px' }}>
              <p style={{ fontSize:'40px',marginBottom:'16px' }}>🤖</p>
              <p style={{ color:'#b8c4d4',marginBottom:'6px' }}>Relatório gerado pelo Claude com base nos dados DCF.</p>
              <p style={{ color:'#6b84a8',fontSize:'13px',marginBottom:'28px' }}>~15-20 segundos.</p>
              <button onClick={gerar} style={{ background:'#e8a020',color:'#000',fontWeight:700,fontSize:'14px',padding:'12px 32px',borderRadius:'8px',border:'none',cursor:'pointer' }}>
                Gerar Relatório com IA
              </button>
            </div>
          )}
          {loading&&(
            <div style={{ textAlign:'center',padding:'40px' }}>
              <div style={{ width:'40px',height:'40px',border:'3px solid rgba(232,160,32,.15)',borderTopColor:'#e8a020',borderRadius:'50%',animation:'spin .75s linear infinite',margin:'0 auto 16px' }}/>
              <p style={{ color:'#6b84a8' }}>Gerando análise com Claude AI…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {erro&&<p style={{ color:'#ef4444',textAlign:'center',padding:'20px' }}>{erro}</p>}
          {rel&&<div dangerouslySetInnerHTML={{ __html: html }}/>}
        </div>
      </div>
    </div>
  )
}

/* ── Seções da empresa ────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecResumo({ e }: { e: any }) {
  const bear   = e.bear || {}
  const base   = e.base || {}
  const bull   = e.bull || {}
  const up_base = base.upside ?? e.upside_base_legado
  return (
    <>
      <SecTitle>Cenários de Valuation</SecTitle>
      <div style={{ display:'flex',gap:'12px',marginBottom:'24px' }}>
        <CenCard label="🔴 Pessimista (Bear)" cor="#ef4444" preco={bear.preco} upside={bear.upside}/>
        <CenCard label="🟡 Base"              cor="#e8a020" preco={base.preco} upside={up_base}/>
        <CenCard label="🟢 Otimista (Bull)"  cor="#00d4a0" preco={bull.preco} upside={bull.upside}/>
      </div>

      <SecTitle>Parâmetros do Modelo</SecTitle>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'24px' }}>
        <ParamCard label="WACC" val={e.wacc != null ? f1(e.wacc) + '%' : '—'}/>
        <ParamCard label="g Terminal" val={e.g_terminal != null ? f1(e.g_terminal) + '%' : '—'}/>
        <ParamCard label="Ke (Custo Capital)" val={e.wacc_ke != null ? f1(e.wacc_ke) + '%' : '—'}/>
        <ParamCard label="Rf (NTN-B)" val={e.wacc_rf != null ? f1(e.wacc_rf) + '%' : '—'}/>
        <ParamCard label="Beta" val={e.wacc_beta != null ? f2(e.wacc_beta) : '—'}/>
        <ParamCard label="ERP Brasil" val={e.wacc_erp != null ? f1(e.wacc_erp) + '%' : '—'}/>
      </div>

      {e.g_receita?.length > 0 && (
        <>
          <SecTitle>Crescimento de Receita Projetado</SecTitle>
          <div style={{ display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px' }}>
            {(e.g_receita as number[]).map((g, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 14px',textAlign:'center' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'2px' }}>Ano {i+1}</div>
                <div style={{ fontSize:'14px',fontWeight:700,color:'#00d4a0' }}>{g != null ? f1(g) + '%' : '—'}</div>
              </div>
            ))}
            <div style={{ background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 14px',textAlign:'center' }}>
              <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'2px' }}>Terminal</div>
              <div style={{ fontSize:'14px',fontWeight:700,color:'#e8a020' }}>{f1(e.g_terminal)}%</div>
            </div>
          </div>
        </>
      )}

      {e.mg_ebitda?.length > 0 && (
        <>
          <SecTitle>Margens EBITDA Projetadas</SecTitle>
          <div style={{ display:'flex',gap:'8px',flexWrap:'wrap' }}>
            {(e.mg_ebitda as number[]).map((m, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 14px',textAlign:'center' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'2px' }}>Ano {i+1}</div>
                <div style={{ fontSize:'14px',fontWeight:700,color:'#e8edf5' }}>{m != null ? f1(m) + '%' : '—'}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function SecHistorico({ e }: { e: any }) {
  const hist: any[] = e.historico || []
  if (!hist.length) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Histórico não disponível. Rode export_dcf.py após calcular no fundamento.py.</p>
  const cols = ['Ano','Receita (R$M)','EBITDA ex','Mg EBITDA','EBIT','FCL','Dív. Líq.']
  const rows = hist.map(h => [
    h.ano,
    h.receita != null ? f2(h.receita) : '—',
    h.ebitda  != null ? f2(h.ebitda)  : '—',
    h.mg_ebitda != null ? f1(h.mg_ebitda * (h.mg_ebitda < 1 ? 100 : 1)) + '%' : '—',
    h.ebit    != null ? f2(h.ebit)    : '—',
    h.fcl     != null ? f2(h.fcl)     : '—',
    h.div_liq != null ? f2(h.div_liq) : '—',
  ])
  return <Tabela cols={cols} rows={rows}/>
}

function SecProjecoes({ e }: { e: any }) {
  const proj: any[] = e.projecoes || []
  if (!proj.length) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Projeções não disponíveis. Rode export_dcf.py após calcular no fundamento.py.</p>
  const cols = ['Ano','Receita (R$M)','EBITDA ex','EBIT','NOPAT','CapEx','FCL','VP FCL']
  const rows = [
    ...proj.map(p => [
      p.ano,
      p.receita != null ? f2(p.receita) : '—',
      p.ebitda  != null ? f2(p.ebitda)  : '—',
      p.ebit    != null ? f2(p.ebit)    : '—',
      p.nopat   != null ? f2(p.nopat)   : '—',
      p.capex   != null ? f2(p.capex)   : '—',
      p.fcl     != null ? f2(p.fcl)     : '—',
      p.vp_fcl  != null ? f2(p.vp_fcl)  : '—',
    ]),
    ['Terminal','—','—','—','—','—',
      e.valor_terminal != null ? `${f2(e.valor_terminal)} (VT)` : '—',
      e.valor_terminal != null ? f2(e.valor_terminal) : '—',
    ],
  ]
  return <Tabela cols={cols} rows={rows}/>
}

function SecSensibilidade({ e }: { e: any }) {
  const sens = e.sensibilidade
  if (!sens) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Tabela de sensibilidade não disponível. Rode export_dcf.py.</p>
  const gCols: number[] = sens.g_cols || []
  const linhas: { wacc: number; valores: number[] }[] = sens.linhas || []
  const baseWacc = e.wacc
  const baseG    = e.g_terminal

  return (
    <div style={{ overflowX:'auto' }}>
      <p style={{ fontSize:'12px',color:'#6b84a8',marginBottom:'12px' }}>
        Preço justo (R$) por combinação WACC × g terminal. Célula destacada = cenário base.
      </p>
      <table style={{ borderCollapse:'collapse',fontSize:'12.5px' }}>
        <thead>
          <tr>
            <th style={{ padding:'8px 14px',color:'#6b84a8',fontSize:'10.5px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',borderBottom:'2px solid rgba(255,255,255,.08)' }}>
              WACC \ g
            </th>
            {gCols.map(g => (
              <th key={g} style={{ padding:'8px 14px',color: Math.abs(g - baseG) < 0.1 ? '#e8a020' : '#6b84a8',fontSize:'10.5px',fontWeight:700,borderBottom:'2px solid rgba(255,255,255,.08)',textAlign:'center' }}>
                g={f1(g)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => {
            const isBaseWacc = Math.abs(linha.wacc - baseWacc) < 0.1
            return (
              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding:'8px 14px',color: isBaseWacc ? '#e8a020' : '#6b84a8',fontWeight: isBaseWacc ? 700 : 400 }}>
                  {f1(linha.wacc)}%
                </td>
                {linha.valores.map((v, j) => {
                  const isBase = isBaseWacc && Math.abs(gCols[j] - baseG) < 0.1
                  const cor = v == null ? '#6b84a8' : v < (e.preco_atual || 999) ? '#ef4444' : '#00d4a0'
                  return (
                    <td key={j} style={{ padding:'8px 14px',textAlign:'center',fontWeight: isBase ? 700 : 600,color: isBase ? '#e8a020' : cor,background: isBase ? 'rgba(232,160,32,.1)' : 'transparent',borderRadius: isBase ? '4px' : '0' }}>
                      {v != null ? `R$${v}` : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SecOutros({ e }: { e: any }) {
  return (
    <>
      {/* TIR Real */}
      {e.tir && (
        <>
          <SecTitle>TIR Real Implícita</SecTitle>
          <div style={{ background:'rgba(139,92,246,.08)',border:'1px solid rgba(139,92,246,.2)',borderRadius:'10px',padding:'16px 20px',marginBottom:'20px' }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
              {[
                { label:'TIR Nominal', val: e.tir.nominal != null ? f1(e.tir.nominal) + '% a.a.' : '—' },
                { label:'TIR Real (ex-IPCA 5%)', val: e.tir.real != null ? f1(e.tir.real) + '% a.a.' : '—' },
                { label:'vs. SELIC real', val: e.tir.vs_selic != null ? fPct(e.tir.vs_selic) + 'pp' : '—' },
                { label:'vs. NTN-B 10Y real', val: e.tir.vs_ntnb != null ? fPct(e.tir.vs_ntnb) + 'pp' : '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'3px' }}>{item.label}</div>
                  <div style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>{item.val}</div>
                </div>
              ))}
            </div>
            {e.tir.veredito && (
              <div style={{ marginTop:'12px',paddingTop:'12px',borderTop:'1px solid rgba(255,255,255,.06)',fontSize:'13px',fontWeight:700,color: e.tir.vs_ntnb > 0 ? '#00d4a0' : '#FFD54F' }}>
                Veredito: {e.tir.veredito}
              </div>
            )}
          </div>
        </>
      )}

      {/* Gordon */}
      {e.gordon && (
        <>
          <SecTitle>Gordon (DDM Simplificado)</SecTitle>
          <div style={{ display:'flex',gap:'16px',marginBottom:'20px',flexWrap:'wrap' }}>
            <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1 }}>
              <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>Preço Justo (Gordon)</div>
              <div style={{ fontSize:'24px',fontWeight:700,color: e.gordon.upside > 0 ? '#00d4a0' : '#ef4444' }}>
                {e.gordon.preco != null ? `R$ ${f2(e.gordon.preco)}` : '—'}
              </div>
              {e.gordon.upside != null && (
                <div style={{ fontSize:'13px',color:corUpside(e.gordon.upside),marginTop:'4px',fontWeight:600 }}>
                  {fPct(e.gordon.upside)}
                </div>
              )}
            </div>
            <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1,fontSize:'13px',color:'#b8c4d4' }}>
              <div>D0 = R$ {f2(e.gordon.d0)} · D1 = R$ {f2(e.gordon.d1)}</div>
              {e.gordon.detalhe && <div style={{ color:'#6b84a8',fontSize:'12px',marginTop:'4px' }}>{e.gordon.detalhe}</div>}
            </div>
          </div>
        </>
      )}

      {/* Graham */}
      {e.graham && (
        <>
          <SecTitle>Graham</SecTitle>
          <div style={{ display:'flex',gap:'16px',marginBottom:'20px',flexWrap:'wrap' }}>
            {e.graham.preco_gn && (
              <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1 }}>
                <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>Graham Number</div>
                <div style={{ fontSize:'24px',fontWeight:700,color:corUpside(e.graham.upside_gn) }}>R$ {f2(e.graham.preco_gn)}</div>
                {e.graham.upside_gn != null && <div style={{ fontSize:'13px',color:corUpside(e.graham.upside_gn),fontWeight:600 }}>{fPct(e.graham.upside_gn)}</div>}
              </div>
            )}
            {e.graham.preco_formula && (
              <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1 }}>
                <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>Fórmula Graham</div>
                <div style={{ fontSize:'24px',fontWeight:700,color:'#e8edf5' }}>R$ {f2(e.graham.preco_formula)}</div>
              </div>
            )}
            {e.graham.detalhe && (
              <div style={{ width:'100%',fontSize:'12px',color:'#6b84a8',padding:'10px 16px',background:'rgba(255,255,255,.03)',borderRadius:'8px' }}>
                {e.graham.detalhe}
              </div>
            )}
          </div>
          <div style={{ display:'flex',gap:'16px',fontSize:'13px',color:'#b8c4d4' }}>
            <span>EPS = R$ {f2(e.graham.eps)}</span>
            <span>VPA = R$ {f2(e.graham.vpa)}</span>
          </div>
        </>
      )}

      {!e.tir && !e.gordon && !e.graham && (
        <p style={{ color:'#6b84a8',padding:'20px 0' }}>Dados não disponíveis. Rode export_dcf.py com as análises calculadas no fundamento.py.</p>
      )}
    </>
  )
}

function SecLinhasNegocio({ e }: { e: any }) {
  const linhas: any[] = e.linhas_negocio ?? []
  if (!linhas.length) return (
    <p style={{ color:'#6b84a8',padding:'20px 0' }}>
      Dados por linha de negócio não disponíveis. Adicione ao dcf_historico/{e.ticker}.json e rode export_dcf.py.
    </p>
  )

  // pegar todos os anos disponíveis (union de todas as séries)
  const anosSet = new Set<string>()
  linhas.forEach(l => Object.keys(l.series || {}).forEach(a => anosSet.add(a)))
  const anos = Array.from(anosSet).sort()

  // calcular total por ano (para percentual)
  const totais: Record<string, number> = {}
  anos.forEach(ano => {
    totais[ano] = linhas.reduce((s, l) => s + (l.series?.[ano] ?? 0), 0)
  })

  return (
    <>
      <SecTitle>Receita por Linha de Negócio (R$ MM)</SecTitle>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'12.5px',minWidth:'500px' }}>
          <thead>
            <tr>
              <th style={{ padding:'8px 14px',textAlign:'left',fontSize:'10.5px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',color:'#6b84a8',borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                Linha de Negócio
              </th>
              {anos.map(a => (
                <th key={a} style={{ padding:'8px 14px',textAlign:'right',fontSize:'10.5px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',color:'#6b84a8',borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding:'10px 14px',color:'#b8c4d4',fontWeight:500 }}>{l.label}</td>
                {anos.map(ano => {
                  const val = l.series?.[ano]
                  const pct = val && totais[ano] ? (val / totais[ano]) * 100 : null
                  return (
                    <td key={ano} style={{ padding:'10px 14px',textAlign:'right' }}>
                      {val != null ? (
                        <div>
                          <div style={{ fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>{f2(val)}</div>
                          {pct != null && <div style={{ fontSize:'10.5px',color:'#6b84a8',marginTop:'1px' }}>{f1(pct)}%</div>}
                        </div>
                      ) : <span style={{ color:'#3d4f6a' }}>—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Linha de total */}
            <tr style={{ borderTop:'2px solid rgba(255,255,255,.08)',background:'rgba(232,160,32,.04)' }}>
              <td style={{ padding:'10px 14px',fontWeight:700,color:'#e8a020' }}>Total</td>
              {anos.map(ano => (
                <td key={ano} style={{ padding:'10px 14px',textAlign:'right',fontWeight:700,color:'#e8a020',fontFamily:'var(--font-space),monospace' }}>
                  {totais[ano] ? f2(totais[ano]) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Barras de participação — último ano */}
      {anos.length > 0 && (
        <>
          <SecTitle>Participação no Último Ano ({anos[anos.length-1]})</SecTitle>
          <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
            {linhas
              .filter(l => l.series?.[anos[anos.length-1]])
              .sort((a, b) => (b.series?.[anos[anos.length-1]] ?? 0) - (a.series?.[anos[anos.length-1]] ?? 0))
              .map((l, i) => {
                const val = l.series?.[anos[anos.length-1]] ?? 0
                const pct = totais[anos[anos.length-1]] ? (val / totais[anos[anos.length-1]]) * 100 : 0
                const cores = ['#e8a020','#00d4a0','#3b82f6','#a855f7','#f59e0b','#ef4444','#10b981','#6366f1','#ec4899']
                const cor = cores[i % cores.length]
                return (
                  <div key={i}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'4px' }}>
                      <span style={{ fontSize:'13px',color:'#b8c4d4' }}>{l.label}</span>
                      <span style={{ fontSize:'13px',fontWeight:700,color:cor }}>
                        R$ {f2(val)} MM &nbsp; {f1(pct)}%
                      </span>
                    </div>
                    <div style={{ height:'8px',background:'rgba(255,255,255,.06)',borderRadius:'4px',overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${pct}%`,background:cor,borderRadius:'4px',transition:'width .6s ease' }}/>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </>
      )}
    </>
  )
}

function SecProximoTri({ e }: { e: any }) {
  const t = e.proximo_tri
  if (!t) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Estimativa não disponível.</p>
  return (
    <>
      <SecTitle>Estimativa {t.periodo}</SecTitle>
      {t.metodologia && (
        <p style={{ fontSize:'12px',color:'#6b84a8',marginBottom:'16px',background:'rgba(255,255,255,.03)',padding:'10px 14px',borderRadius:'8px' }}>
          Método: {t.metodologia}
        </p>
      )}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px' }}>
        {[
          { label:'Receita Est.', val: t.receita != null ? `R$ ${f2(t.receita)} MM` : '—' },
          { label:'EBITDA Est.',  val: t.ebitda  != null ? `R$ ${f2(t.ebitda)} MM`  : '—' },
          { label:'Lucro Líq.',   val: t.ll      != null ? `R$ ${f2(t.ll)} MM`      : '—' },
        ].map(item => (
          <div key={item.label} style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'14px 16px' }}>
            <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>{item.label}</div>
            <div style={{ fontSize:'18px',fontWeight:700,color:'#e8edf5' }}>{item.val}</div>
          </div>
        ))}
      </div>
      {t.mg_ebitda != null && (
        <div style={{ marginTop:'12px',fontSize:'13px',color:'#b8c4d4' }}>
          Mg EBITDA est.: {f1(t.mg_ebitda * 100)}%
        </div>
      )}
    </>
  )
}

/* ── Página principal ────────────────────────────────────────────────────── */
export default function DCFPage() {
  const [sel, setSel] = useState<string|null>(null)
  const [aba, setAba] = useState<Aba>('resumo')
  const [modalRel, setModalRel] = useState<string|null>(null)

  const emp = sel ? dcfData[sel] : null
  const upSel = emp ? (emp.base?.upside ?? emp.upside_base_legado) : null
  const metodoBadge = (m: string) =>
    ({ fcff:'#3b82f6', ddm:'#a855f7', sotp:'#f59e0b' }[m?.toLowerCase()] ?? '#6b84a8')

  const linhasNeg: any[] = emp?.linhas_negocio ?? []
  const ABAS: { id: Aba; label: string; hidden?: boolean }[] = [
    { id:'resumo',        label:'Visão Geral'    },
    { id:'historico',     label:'Histórico'      },
    { id:'linhas',        label:'Linhas de Negócio', hidden: linhasNeg.length === 0 },
    { id:'projecoes',     label:'Projeções DCF'  },
    { id:'sensibilidade', label:'Sensibilidade'  },
    { id:'outros',        label:'TIR / Gordon / Graham' },
    { id:'tri',           label:'Próx. Trimestre' },
  ]

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5}
        .page{display:flex;height:calc(100vh - 44px)}
        .sidebar{width:270px;flex-shrink:0;background:#081120;border-right:1px solid rgba(255,255,255,.07);overflow-y:auto;display:flex;flex-direction:column}
        .sidebar-hdr{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
        .sidebar-hdr h2{font-size:12px;font-weight:700;color:#6b84a8;letter-spacing:1px;text-transform:uppercase}
        .sidebar-hdr p{font-size:11px;color:#3d4f6a;margin-top:3px}
        .emp-item{padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .12s;display:flex;align-items:center;justify-content:space-between}
        .emp-item:hover{background:rgba(255,255,255,.04)}
        .emp-item.ativo{background:rgba(232,160,32,.08);border-left:3px solid #e8a020;padding-left:15px}
        .emp-ticker{font-weight:700;font-size:14px;color:#e8a020;font-family:var(--font-space),monospace}
        .emp-nome{font-size:11px;color:#6b84a8;margin-top:2px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .main{flex:1;overflow:hidden;display:flex;flex-direction:column}
        .main-hdr{padding:20px 28px 0;flex-shrink:0}
        .tab-bar{display:flex;gap:2px;padding:0 28px;margin-top:16px;border-bottom:2px solid rgba(255,255,255,.08);flex-shrink:0;overflow-x:auto;background:#050d1a}
        .tab{padding:10px 16px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#6b84a8;white-space:nowrap;transition:all .15s;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;outline:none}
        .tab:hover{color:#e8edf5;background:rgba(255,255,255,.04);border-radius:6px 6px 0 0}
        .tab.ativo{color:#e8a020;border-bottom-color:#e8a020;background:rgba(232,160,32,.06);border-radius:6px 6px 0 0}
        .content{flex:1;overflow-y:auto;padding:20px 28px 40px}
        .vazio{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#6b84a8;text-align:center}
        .btn-rel{background:#e8a020;color:#000;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;border:none;cursor:pointer}
        .btn-rel:hover{background:#f5c55a}
      `}</style>

      <NavBar />

      <div className="page">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-hdr">
            <h2>DCF / Valuation</h2>
            <p>{empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'} analisadas</p>
          </div>
          {empresas.length === 0 ? (
            <div style={{ padding:'20px',color:'#6b84a8',fontSize:'12px',textAlign:'center' }}>
              <p>Rode <code>export_dcf.py</code> para publicar as análises.</p>
            </div>
          ) : empresas.map((e: any) => {
            const up = e.base?.upside ?? e.upside_base_legado
            return (
              <div key={e.ticker}
                   className={`emp-item${sel === e.ticker ? ' ativo' : ''}`}
                   onClick={() => { setSel(e.ticker); setAba('resumo') }}>
                <div>
                  <div className="emp-ticker">{e.ticker}</div>
                  <div className="emp-nome" title={e.nome}>{e.nome}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'14px',fontWeight:700,color:corUpside(up) }}>
                    {up != null ? `${up > 0 ? '+' : ''}${f1(up)}%` : '—'}
                  </div>
                  <div style={{ fontSize:'10px',color:'#3d4f6a' }}>base</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* MAIN */}
        <div className="main">
          {!emp ? (
            <div className="vazio content">
              <div style={{ fontSize:'48px',marginBottom:'16px' }}>💹</div>
              <p style={{ fontSize:'16px',fontWeight:700,color:'#e8edf5',marginBottom:'8px' }}>Selecione uma empresa</p>
              <p style={{ fontSize:'13px' }}>Escolha na lista para ver a análise DCF completa.</p>
            </div>
          ) : (
            <>
              <div className="main-hdr">
                <div style={{ display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap' }}>
                  <h1 style={{ fontFamily:'var(--font-space),Space Grotesk,sans-serif',fontSize:'26px',fontWeight:700,color:'#e8a020' }}>{emp.ticker}</h1>
                  <Badge label={emp.method?.toUpperCase() ?? 'FCFF'} color={metodoBadge(emp.method)}/>
                  {upSel != null && (
                    <Badge label={`Base ${upSel > 0 ? '+' : ''}${f1(upSel)}%`} color={corUpside(upSel)}/>
                  )}
                  <div style={{ marginLeft:'auto' }}>
                    <button className="btn-rel" onClick={() => setModalRel(emp.ticker)}>📄 Gerar Relatório IA</button>
                  </div>
                </div>
                <p style={{ fontSize:'14px',color:'#b8c4d4',marginTop:'4px' }}>{emp.company}</p>
                <p style={{ fontSize:'11px',color:'#6b84a8',marginTop:'3px' }}>
                  {emp.atualizado ?? '—'}{emp.preco_atual ? ` · Preço no cálculo: R$ ${f2(emp.preco_atual)}` : ''}
                </p>
              </div>

              {/* ABAS */}
              <div className="tab-bar">
                {ABAS.filter(a => !a.hidden).map(a => (
                  <button key={a.id} className={`tab${aba === a.id ? ' ativo' : ''}`} onClick={() => setAba(a.id)}>
                    {a.label}
                  </button>
                ))}
              </div>

              <div className="content">
                {aba === 'resumo'        && <SecResumo e={emp}/>}
                {aba === 'historico'     && <SecHistorico e={emp}/>}
                {aba === 'linhas'        && <SecLinhasNegocio e={emp}/>}
                {aba === 'projecoes'     && <SecProjecoes e={emp}/>}
                {aba === 'sensibilidade' && <SecSensibilidade e={emp}/>}
                {aba === 'outros'        && <SecOutros e={emp}/>}
                {aba === 'tri'           && <SecProximoTri e={emp}/>}
              </div>
            </>
          )}
        </div>
      </div>

      {modalRel && (
        <ModalRelatorio
          ticker={modalRel}
          nome={dcfData[modalRel]?.nome ?? modalRel}
          onClose={() => setModalRel(null)}
        />
      )}
    </>
  )
}
