'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import fundamentaisRaw from '@/lib/fundamentais.json'
import dcfRaw from '@/lib/dcf.json'
import setoresManuaisRaw from '@/lib/setores_manuais.json'

/* ── Tipos ─────────────────────────────────────────────────────────────────── */
interface Posicao {
  id: number; ticker: string; quantidade: number; preco_medio: number
  data_compra: string | null; notas: string | null; excluir_calculo: boolean
  data_vencimento?: string | null
  /* enriquecido no client */
  nome?: string; setor?: string; nota?: number | null
  preco_atual?: number | null; variacao?: number | null
}

interface Movimentacao {
  id: number; data: string; ticker: string; tipo: 'C'|'V'
  quantidade: number; preco: number; valor_total: number
  corretora: string | null; nota_num: string | null
}

type ModalTipo = 'add' | 'edit' | 'ops' | null

/* ── helpers ────────────────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fund = fundamentaisRaw as unknown as Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcfData = dcfRaw as unknown as Record<string, any>
const setoresManuais = setoresManuaisRaw as Record<string, string>

function calcNota(
  pl: number|null, roe: number|null, dy: number|null, pvp: number|null,
  divEbit: number|null, evEbit: number|null, gov: number|null,
  dcfUpside: number|null, tirPremio: number|null, setor: string|null
): number | null {
  const util = setor === 'Utilidade Pública'
  const c: { pts: number; max: number }[] = []
  if (pl != null && pl > 0) {
    const m = 2.5; const p = util ? (pl<10?2.5:pl<14?2.1:pl<18?1.6:pl<22?1.0:pl<28?0.5:0) : (pl<8?2.5:pl<12?2.1:pl<16?1.6:pl<20?1.0:pl<25?0.5:0)
    c.push({ pts: p, max: m })
  }
  if (roe != null) {
    const m = 2.5; const p = util ? (roe>15?2.5:roe>11?2.1:roe>8?1.5:roe>5?0.9:roe>2?0.4:0) : (roe>25?2.5:roe>18?2.1:roe>12?1.5:roe>8?0.9:roe>4?0.4:0)
    c.push({ pts: p, max: m })
  }
  if (dy != null && dy >= 0) {
    const m = 1.5; const p = util ? (dy>8?1.5:dy>6?1.2:dy>4?0.9:dy>2?0.5:dy>0?0.2:0) : (dy>10?1.5:dy>7?1.2:dy>5?0.9:dy>3?0.5:dy>1?0.2:0)
    c.push({ pts: p, max: m })
  }
  if (pvp != null && pvp > 0) {
    const m = 1.5; const p = util ? (pvp<1.0?1.5:pvp<1.5?1.2:pvp<2.0?0.9:pvp<2.5?0.5:pvp<3.5?0.2:0) : (pvp<0.7?1.5:pvp<1.0?1.2:pvp<1.5?0.9:pvp<2.0?0.5:pvp<2.5?0.2:0)
    c.push({ pts: p, max: m })
  }
  if (divEbit != null) {
    const m = 3.0; const p = util ? (divEbit<0?3.0:divEbit<3?3.0:divEbit<5?2.2:divEbit<8?1.2:divEbit<12?0.4:divEbit<16?0.1:0) : (divEbit<0?3.0:divEbit<1?3.0:divEbit<2?2.2:divEbit<3?1.2:divEbit<4?0.4:0)
    c.push({ pts: p, max: m })
  }
  if (evEbit != null && evEbit > 0) {
    const m = 3.0; const p = util ? (evEbit<12?3.0:evEbit<18?2.1:evEbit<25?1.5:evEbit<35?0.9:evEbit<50?0.4:evEbit<65?0.1:0) : (evEbit<6?3.0:evEbit<9?2.1:evEbit<12?1.2:evEbit<16?0.3:0)
    c.push({ pts: p, max: m })
  }
  if (gov != null && gov > 0) { c.push({ pts: Math.min(gov*(3.0/2.5), 3.0), max: 3.0 }) }
  if (dcfUpside != null) {
    const p = dcfUpside>=40?3.0:dcfUpside>=30?2.4:dcfUpside>=20?1.8:dcfUpside>=10?1.2:dcfUpside>=5?0.6:dcfUpside>=0?0.2:0
    c.push({ pts: p, max: 3.0 })
  }
  if (tirPremio != null) {
    const p = tirPremio>=6?3.0:tirPremio>=5?2.5:tirPremio>=4?2.0:tirPremio>=3?1.5:tirPremio>=2?1.0:tirPremio>=1?0.5:tirPremio>=0?0.1:tirPremio>=-1?-0.3:-0.6
    c.push({ pts: p, max: 3.0 })
  }
  const tp = c.reduce((s,x)=>s+x.pts, 0)
  const tm = c.reduce((s,x)=>s+x.max, 0)
  return tm > 0 ? Math.round((tp/tm)*100)/10 : null
}

function notaParaTicker(ticker: string, precoAtual: number|null): number|null {
  const f = fund[ticker]
  if (!f) return null
  const setor = setoresManuais[ticker] ?? f.setor ?? null
  const dcfTarget: number|null = dcfData[ticker]?.base?.preco ?? null
  const dcfUpside = dcfTarget != null && precoAtual != null && precoAtual > 0
    ? ((dcfTarget - precoAtual) / precoAtual) * 100
    : (dcfData[ticker]?.base?.upside ?? null)
  const tirPremio: number|null = dcfData[ticker]?.tir?.vs_ntnb ?? null
  return calcNota(f.pl, f.roe, f.dy, f.pvp, f.divEbit, f.evEbit, f.gov, dcfUpside, tirPremio, setor) ?? f.nota ?? null
}
const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
const fR = (v: number | null | undefined) =>
  v == null ? '—' : 'R$ ' + f2(v)

/* ── Opções B3 ───────────────────────────────────────────────────────────────── */
function isOpcaoTicker(ticker: string) {
  // 4 letras (ativo) + letra série A-X (calls A-L, puts M-X) + strike alfanumérico (ex: 295E, 254W1E)
  return /^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(ticker)
}

function infoOpcao(ticker: string, storedDate?: string | null): { vencimento: Date; isCall: boolean; ativo: string } | null {
  if (!isOpcaoTicker(ticker) || ticker.length < 5) return null
  const letra = ticker[4].toUpperCase()
  // Calls: A=Jan … L=Dez | Puts: M=Jan … X=Dez — vencimento: terceira SEXTA-FEIRA do mês (B3)
  let mes = 'ABCDEFGHIJKL'.indexOf(letra)
  let isCall = true
  if (mes === -1) { mes = 'MNOPQRSTUVWX'.indexOf(letra); isCall = false }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  function tercSex(ano: number, m: number) {
    const d = new Date(ano, m, 1); const dow = d.getDay()
    return new Date(ano, m, 1 + (5 - dow + 7) % 7 + 14)
  }

  let data: Date | null = null
  if (storedDate) {
    // Extrai apenas YYYY-MM-DD — Neon pode retornar timestamp completo (ex: "2026-12-18T00:00:00.000Z")
    const datePart = String(storedDate).slice(0, 10)
    const d = new Date(datePart + 'T12:00:00')
    if (!isNaN(d.getTime())) data = d
  }
  if (!data) {
    if (mes === -1) return null
    data = tercSex(hoje.getFullYear(), mes)
    if (data < hoje) data = tercSex(hoje.getFullYear() + 1, mes)
  }
  // Se a letra não foi reconhecida mas temos data gravada, assume Call por padrão
  return { vencimento: data, isCall: mes !== -1 ? isCall : true, ativo: ticker.slice(0, 4) }
}
/* busca via API server-side para evitar CORS do browser */
async function buscarPrecos(tickers: string[]): Promise<Record<string, { preco: number | null; variacao: number | null }>> {
  try {
    const r = await fetch(`/api/cotacoes?tickers=${tickers.join(',')}`, {
      signal: AbortSignal.timeout(30000)
    })
    if (!r.ok) return {}
    const j = await r.json()
    const map: Record<string, { preco: number | null; variacao: number | null }> = {}
    for (const c of j.cotacoes ?? []) map[c.ticker] = { preco: c.preco, variacao: c.variacao }
    return map
  } catch { return {} }
}

/* ── Card mobile (substitui a linha da tabela em telas pequenas) ─────────────── */
function PosicaoCardMobile({ p, pesoAtual, pesoSug, selecionado, onSelecionar, onEditar, onToggleCalculo }: {
  p: Posicao; pesoAtual: number; pesoSug: number
  selecionado: boolean
  onSelecionar: () => void; onEditar: () => void
  onToggleCalculo: () => void
}) {
  const excl     = p.excluir_calculo
  const pAtual   = p.preco_atual ?? p.preco_medio
  const resTotal = p.preco_atual != null ? (pAtual - p.preco_medio) * p.quantidade : null
  const resPct   = p.preco_atual != null && p.preco_medio > 0 ? ((pAtual - p.preco_medio) / p.preco_medio) * 100 : null
  const valorAtu = pAtual * p.quantidade
  const corRes   = (v: number | null) => v == null ? '#e8edf5' : v > 0 ? '#00d4a0' : v < 0 ? '#ef4444' : '#e8edf5'
  const corNota  = (n: number | null | undefined) => n == null ? '#6b84a8' : n >= 7 ? '#66BB6A' : n >= 5 ? '#FFD54F' : '#EF9A9A'

  return (
    <div className={`posicao-card${selecionado ? ' sel' : ''}`} style={excl ? { opacity: .55 } : undefined} onClick={onSelecionar}>
      <div className="posicao-card-top">
        <div>
          <div className="posicao-card-ticker">{p.ticker}{excl && <span className="excl-tag" style={{ marginLeft: 6 }}>EXCLUÍDO</span>}</div>
          <div className="posicao-card-nome">{p.nome}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: corNota(p.nota) }}>{p.nota != null ? '★ ' + f2(p.nota) : '—'}</div>
        </div>
      </div>
      <div className="posicao-card-stats">
        <div><span className="lbl">Qtde</span><span>{f2(p.quantidade)}</span></div>
        <div><span className="lbl">P.Médio</span><span>{fR(p.preco_medio)}</span></div>
        <div><span className="lbl">P.Atual</span><span>{p.preco_atual != null ? fR(p.preco_atual) : '—'}</span></div>
      </div>
      <div className="posicao-card-res" style={{ color: corRes(resTotal) }}>
        {resTotal != null ? `${resTotal >= 0 ? '+' : ''}${fR(resTotal)} (${resPct! >= 0 ? '+' : ''}${f2(resPct)}%)` : 'Sem cotação atual'}
      </div>
      <div className="posicao-card-stats">
        <div><span className="lbl">Valor Atual</span><span>{fR(valorAtu)}</span></div>
        <div><span className="lbl">Peso Atual</span><span>{f2(pesoAtual)}%</span></div>
        <div><span className="lbl">Peso Sug.</span><span style={{ color: pesoSug > pesoAtual ? '#00d4a0' : pesoSug < pesoAtual ? '#FFD54F' : '#b8c4d4' }}>{f2(pesoSug)}%</span></div>
      </div>
      <div className="posicao-card-footer">
        <button className="posicao-card-btn" onClick={e => { e.stopPropagation(); onEditar() }}>✏ Editar</button>
        <button className="posicao-card-btn" onClick={e => { e.stopPropagation(); onToggleCalculo() }}
                style={{ color: excl ? '#6b84a8' : '#00d4a0' }}>
          {excl ? 'Fora do cálculo' : 'Dentro do cálculo'}
        </button>
      </div>
    </div>
  )
}

/* ── Modal base ──────────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#0d1a2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:'14px',width:'100%',maxWidth:'520px',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer',lineHeight:1 }}>×</button>
        </div>
        <div style={{ overflowY:'auto',padding:'20px 24px',flex:1 }}>{children}</div>
      </div>
    </div>
  )
}

/* ── Formulário Add / Edit ──────────────────────────────────────────────────── */
function FormPosicao({ posicao, onSave, onClose }: {
  posicao?: Partial<Posicao>; onSave: () => void; onClose: () => void
}) {
  const [ticker,    setTicker]    = useState(posicao?.ticker    ?? '')
  const [qtde,      setQtde]      = useState(String(Math.abs(posicao?.quantidade ?? 0) || ''))
  const [preco,     setPreco]     = useState(String(posicao?.preco_medio ?? ''))
  const [data,      setData]      = useState(posicao?.data_compra?.slice(0,10) ?? new Date().toISOString().slice(0,10))
  const [notas,     setNotas]     = useState(posicao?.notas ?? '')
  const [vencimento, setVencimento] = useState(posicao?.data_vencimento?.slice(0,10) ?? '')
  const [lancador,  setLancador]  = useState((posicao?.quantidade ?? 0) < 0 ? true : false)
  const [salvando,  setSalvando]  = useState(false)
  const [erro,      setErro]      = useState('')

  const isEdit  = !!posicao?.id
  const tickerUp = ticker.trim().toUpperCase()
  const isOpcao = /^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(tickerUp)

  const salvar = async () => {
    setErro(''); setSalvando(true)
    const qtdeParsed = parseFloat(qtde.replace(',','.'))
    const qtdeFinal  = isOpcao && lancador ? -qtdeParsed : qtdeParsed
    const body: Record<string, unknown> = {
      ticker:          tickerUp,
      quantidade:      qtdeFinal,
      preco_medio:     parseFloat(preco.replace(',','.')),
      data_compra:     data || null,
      notas:           notas || null,
      data_vencimento: isOpcao && vencimento ? vencimento : null,
    }
    if (!body.ticker || isNaN(qtdeParsed) || isNaN(body.preco_medio as number)) {
      setErro('Ticker, quantidade e preço são obrigatórios.'); setSalvando(false); return
    }
    if (isOpcao && !vencimento) {
      setErro('Informe o vencimento da opção.'); setSalvando(false); return
    }
    const url    = isEdit ? `/api/carteira/${posicao!.id}` : '/api/carteira'
    const method = isEdit ? 'PUT' : 'POST'
    try {
      /* timeout de 30s — Neon pode ter cold start de ~5s na 1ª requisição */
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30000)
      const r = await fetch(url, {
        method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      clearTimeout(timer)
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setErro(d.error ?? `Erro ${r.status} ao salvar`)
        setSalvando(false); return
      }
      onSave(); onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Timeout — o banco demorou muito. Tente novamente.'
        : 'Erro de conexão. Verifique e tente novamente.'
      setErro(msg); setSalvando(false)
    }
  }

  const inp: React.CSSProperties = { width:'100%',background:'#0d1a2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:'7px',padding:'10px 14px',color:'#e8edf5',fontSize:'14px',outline:'none',fontFamily:'inherit',marginTop:'6px' }
  const lbl: React.CSSProperties = { fontSize:'12px',fontWeight:600,color:'#6b84a8',display:'block' }

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'16px' }}>
      {!isEdit && (
        <div>
          <span style={lbl}>Ticker *</span>
          <input style={inp} placeholder="ex: PETR4 ou AZZAP250" value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())} />
          {isOpcao && <span style={{ fontSize:11, color:'#e8a020', marginTop:4, display:'block' }}>Opção detectada — campos extras habilitados abaixo</span>}
        </div>
      )}

      {/* ── Campos exclusivos de opção ── */}
      {isOpcao && (
        <div style={{ background:'rgba(232,160,32,.07)', border:'1px solid rgba(232,160,32,.2)', borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <span style={lbl}>Posição *</span>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button type="button"
                  onClick={() => setLancador(true)}
                  style={{ flex:1, padding:'9px 0', borderRadius:6, border: lancador ? '2px solid #ef4444' : '1px solid rgba(255,255,255,.12)', background: lancador ? 'rgba(239,68,68,.18)' : 'transparent', color: lancador ? '#ef4444' : '#6b84a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Lançador
                </button>
                <button type="button"
                  onClick={() => setLancador(false)}
                  style={{ flex:1, padding:'9px 0', borderRadius:6, border: !lancador ? '2px solid #22c55e' : '1px solid rgba(255,255,255,.12)', background: !lancador ? 'rgba(34,197,94,.18)' : 'transparent', color: !lancador ? '#22c55e' : '#6b84a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Titular
                </button>
              </div>
              <span style={{ fontSize:10, color:'#4a5d73', marginTop:4, display:'block' }}>
                {lancador ? 'Vendeu a opção (prêmio recebido)' : 'Comprou a opção (prêmio pago)'}
              </span>
            </div>
            <div>
              <span style={lbl}>Vencimento *</span>
              <input style={inp} type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px' }}>
        <div>
          <span style={lbl}>Quantidade *</span>
          <input style={inp} placeholder="100" type="number" min="0" value={qtde} onChange={e=>setQtde(e.target.value)} />
        </div>
        <div>
          <span style={lbl}>{isOpcao ? 'Prêmio Médio (R$) *' : 'Preço Médio (R$) *'}</span>
          <input style={inp} placeholder="2,50" type="number" min="0" step="0.01" value={preco} onChange={e=>setPreco(e.target.value)} />
        </div>
      </div>
      <div>
        <span style={lbl}>Data de Compra</span>
        <input style={inp} type="date" value={data} onChange={e=>setData(e.target.value)} />
      </div>
      <div>
        <span style={lbl}>Notas (opcional)</span>
        <textarea style={{...inp,height:'70px',resize:'vertical'}} placeholder="Observações sobre esta posição…" value={notas} onChange={e=>setNotas(e.target.value)}/>
      </div>
      {erro && <p style={{ fontSize:'13px',color:'#ef4444' }}>{erro}</p>}
      <div style={{ display:'flex',gap:'10px',justifyContent:'flex-end',paddingTop:'8px',borderTop:'1px solid rgba(255,255,255,.06)' }}>
        <button onClick={onClose} style={{ background:'transparent',border:'1px solid rgba(255,255,255,.15)',color:'#6b84a8',padding:'9px 20px',borderRadius:'7px',cursor:'pointer',fontSize:'13px',fontWeight:600 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ background:'#e8a020',color:'#000',padding:'9px 24px',borderRadius:'7px',cursor:salvando?'wait':'pointer',fontSize:'13px',fontWeight:700,border:'none',opacity:salvando?.6:1 }}>
          {salvando ? 'Salvando…' : isEdit ? 'Salvar Alterações' : '+ Adicionar'}
        </button>
      </div>
    </div>
  )
}

/* ── Modal Histórico de Operações ───────────────────────────────────────────── */
function ModalOps({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [ops, setOps] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/movimentacoes?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => setOps(d.movimentacoes ?? []))
      .finally(() => setLoading(false))
  }, [ticker])

  const excluir = async (id: number) => {
    if (!confirm('Remover esta operação do histórico?')) return
    await fetch(`/api/movimentacoes?id=${id}`, { method: 'DELETE' })
    setOps(prev => prev.filter(o => o.id !== id))
  }

  return (
    <Modal title={`📋 Operações — ${ticker}`} onClose={onClose}>
      {loading ? <p style={{ color:'#6b84a8',textAlign:'center',padding:'24px' }}>Carregando…</p> : (
        ops.length === 0 ? <p style={{ color:'#6b84a8',textAlign:'center',padding:'24px' }}>Nenhuma operação registrada.</p> : (
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'12.5px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                {['Data','Tipo','Qtde','Preço','Total','Corretora',''].map(h => (
                  <th key={h} style={{ padding:'7px 8px',textAlign:'left',fontSize:'10.5px',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',color:'#6b84a8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ops.map(o => (
                <tr key={o.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding:'8px',color:'#b8c4d4' }}>{o.data}</td>
                  <td style={{ padding:'8px',fontWeight:700,color:o.tipo==='C'?'#00d4a0':'#ef4444' }}>{o.tipo==='C'?'COMPRA':'VENDA'}</td>
                  <td style={{ padding:'8px' }}>{f2(o.quantidade)}</td>
                  <td style={{ padding:'8px' }}>R$ {f2(o.preco)}</td>
                  <td style={{ padding:'8px' }}>R$ {f2(o.valor_total)}</td>
                  <td style={{ padding:'8px',color:'#6b84a8' }}>{o.corretora ?? '—'}</td>
                  <td style={{ padding:'8px' }}>
                    <button onClick={() => excluir(o.id)} style={{ background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:'13px' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </Modal>
  )
}

/* ── Página Carteira ────────────────────────────────────────────────────────── */
export default function CarteiraPage() {
  const [posicoes,  setPosicoes]  = useState<Posicao[]>([])
  const [loading,   setLoading]   = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro,      setErro]      = useState('')
  const [modal,     setModal]     = useState<ModalTipo>(null)
  const [editando,  setEditando]  = useState<Posicao | null>(null)
  const [opsTicker, setOpsTicker] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<number | null>(null)
  const [plano,     setPlano]     = useState<string>('gratuito')
  const [limiteModal, setLimiteModal] = useState(false)
  const [importModal,    setImportModal]    = useState(false)
  const [importando,     setImportando]     = useState(false)
  const [importErro,     setImportErro]     = useState('')
  const [importProgress, setImportProgress] = useState('')
  const [salvandoImport, setSalvandoImport] = useState(false)
  const [sincronizando,  setSincronizando]  = useState(false)

  /* multi-nota e B3: lista de fontes + operações achatadas */
  interface NotaInfo { corretora: string|null; data: string|null; arquivo: string }
  interface OpImport {
    tipo: string; ticker: string; quantidade: number; preco: number
    data: string; notaIdx: number; selecionada: boolean
    notas?: string; mercado?: string; vencimento?: string | null
    direcao?: 'lancador' | 'titular'  // apenas para opções
  }
  const [importNotas,  setImportNotas]  = useState<NotaInfo[]>([])
  const [importOpsAll, setImportOpsAll] = useState<OpImport[]>([])
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [sortOpcoes, setSortOpcoes] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [abaCarteira, setAbaCarteira] = useState<'acoes' | 'opcoes' | 'importacoes' | 'base' | 'performance'>('acoes')
  const [showConcentracao, setShowConcentracao] = useState(false)

  // Performance
  const [perfDe,      setPerfDe]      = useState(() => `${new Date().getFullYear()}-01-01`)
  const [perfAte,     setPerfAte]     = useState(() => new Date().toISOString().slice(0, 10))
  const [perfPeriodo, setPerfPeriodo] = useState('ytd')
  const [perfTipos,   setPerfTipos]   = useState(new Set(['acao', 'fii_etf', 'bdr', 'opcao']))
  const [perfData,    setPerfData]    = useState<{
    periodo: { de: string; ate: string }
    realizado: { total: number; por_ticker: { ticker: string; tipo: string; pl: number; vol_vendas: number; vol_compras: number; n_ops: number }[]; por_mes: { mes: string; pl: number }[] }
    operacoes: { vol_compras: number; vol_vendas: number; n_compras: number; n_vendas: number }
    benchmark: { cdi_pct: number | null; ibov_pct: number | null }
  } | null>(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [perfDetalhes, setPerfDetalhes] = useState(false)
  const [marcandoPo, setMarcandoPo] = useState<string | null>(null)
  const [desfazendoPo, setDesfazendoPo] = useState<string | null>(null)
  const [encerradasExpandidas, setEncerradasExpandidas] = useState(true)
  const [msgPo, setMsgPo] = useState<string | null>(null)
  const [poVencidas, setPoVencidas] = useState<Set<string>>(new Set())
  const [marcandoPoTodas, setMarcandoPoTodas] = useState(false)
  const [togglingDirecao, setTogglingDirecao] = useState<number | null>(null)
  const [removendoOpcao, setRemovendoOpcao] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [excluindoLote, setExcluindoLote] = useState(false)

  const removerOpcao = async (p: Posicao) => {
    if (!confirm(`Remover ${p.ticker} da carteira?`)) return
    setRemovendoOpcao(p.id)
    await fetch(`/api/carteira/${p.id}`, { method: 'DELETE' })
    setPosicoes(prev => prev.filter(x => x.id !== p.id))
    setRemovendoOpcao(null)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const excluirLote = async () => {
    if (!selectedIds.size) return
    if (!confirm(`Excluir ${selectedIds.size} ativo(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return
    setExcluindoLote(true)
    await Promise.all([...selectedIds].map(id => fetch(`/api/carteira/${id}`, { method: 'DELETE' })))
    setPosicoes(prev => prev.filter(p => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
    setExcluindoLote(false)
  }

  /* ── Importações (histórico de lotes) ──────────────────────────────────── */
  interface ImportBatch {
    id: string; importado_em: string; total_ops: number
    data_inicio: string | null; data_fim: string | null
    descricao: string | null; revertido: boolean; revertido_em: string | null
  }
  const [importacoes, setImportacoes] = useState<ImportBatch[]>([])
  const [loadingImportacoes, setLoadingImportacoes] = useState(false)
  const [revertendoBatch, setRevertendoBatch] = useState<string | null>(null)
  const [statsMovs, setStatsMovs] = useState<{ total_movs: number; lotes_ativos: number } | null>(null)
  const [limpandoMovs, setLimpandoMovs] = useState(false)

  const carregarImportacoes = useCallback(async () => {
    setLoadingImportacoes(true)
    try {
      const [ri, rs] = await Promise.all([
        fetch('/api/carteira/importacoes'),
        fetch('/api/carteira/limpar-movimentacoes'),
      ])
      const di = await ri.json()
      const ds = await rs.json()
      setImportacoes(di.importacoes ?? [])
      setStatsMovs({ total_movs: ds.total_movs ?? 0, lotes_ativos: ds.lotes_ativos ?? 0 })
    } catch { /* silencioso */ }
    finally { setLoadingImportacoes(false) }
  }, [])

  const limparTodasMovimentacoes = async () => {
    const n = statsMovs?.total_movs ?? 0
    if (!confirm(`Apagar TODAS as ${n} movimentações e reconstruir carteira a partir da posição base?\nEsta ação não pode ser desfeita.`)) return
    setLimpandoMovs(true)
    try {
      const r = await fetch('/api/carteira/limpar-movimentacoes', { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro.'); return }
      alert(`Concluído: ${d.movs_removidas} movimentação(ões) removida(s). Carteira: ${d.total_ativos} ativo(s).`)
      await Promise.all([carregarImportacoes(), carregarCarteira()])
    } catch { alert('Erro de conexão.') }
    finally { setLimpandoMovs(false) }
  }

  const desfazerImport = async (batchId: string) => {
    if (!confirm('Desfazer esta importação irá remover todas as operações do lote e recalcular a carteira. Confirmar?')) return
    setRevertendoBatch(batchId)
    try {
      const r = await fetch(`/api/carteira/importacoes/${batchId}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro ao desfazer importação.'); return }
      alert(`Lote desfeito. ${d.ops_removidas} operações removidas. Carteira recalculada.`)
      await carregarImportacoes()
      await carregarCarteira()
    } catch { alert('Erro de conexão.') }
    finally { setRevertendoBatch(null) }
  }

  /* ── Posição Base ──────────────────────────────────────────────────────── */
  interface BaseItem { ticker: string; quantidade: number; preco_medio: number; cnpj?: string; direcao?: 'lancador' | 'titular' | null }
  const [baseData, setBaseData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [baseItens, setBaseItens] = useState<BaseItem[]>([])
  const [basePrejSwing, setBasePrejSwing] = useState('0')
  const [basePrejDay, setBasePrejDay] = useState('0')
  const [salvandoBase, setSalvandoBase] = useState(false)
  const [loadingBase, setLoadingBase] = useState(false)
  const [importandoBase, setImportandoBase] = useState(false)

  const carregarBase = useCallback(async () => {
    setLoadingBase(true)
    try {
      const r = await fetch('/api/carteira/posicao-base')
      const d = await r.json()
      if (d.data_base) setBaseData(d.data_base)
      setBaseItens(d.itens ?? [])
      setBasePrejSwing(String(d.prejuizo_swing ?? 0))
      setBasePrejDay(String(d.prejuizo_day ?? 0))
    } catch { /* silencioso */ }
    finally { setLoadingBase(false) }
  }, [])

  const salvarBase = async () => {
    if (!baseData) { alert('Informe a data base.'); return }
    setSalvandoBase(true)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const r = await fetch('/api/carteira/posicao-base', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_base: baseData,
          itens: baseItens.filter(i => i.ticker && Math.abs(i.quantidade) > 0 && i.preco_medio > 0),
          prejuizo_swing: parseFloat(basePrejSwing.replace(',', '.')) || 0,
          prejuizo_day:   parseFloat(basePrejDay.replace(',', '.'))   || 0,
        }),
      })
      clearTimeout(timer)
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro ao salvar.'); return }
      alert(`Posição base salva! ${d.total_itens} ativo(s). Carteira reconstruída a partir de ${baseData}.`)
      await carregarCarteira()
    } catch (err) {
      clearTimeout(timer)
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Timeout — muitos itens. Tente novamente (Neon pode demorar no 1º request).'
        : 'Erro de conexão. Tente novamente.'
      alert(msg)
    }
    finally { setSalvandoBase(false) }
  }

  const handleImportarBase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportandoBase(true)
    try {
      const fd = new FormData()
      fd.append('planilha', file)
      const r = await fetch('/api/carteira/posicao-base/importar', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro ao ler planilha.'); return }
      if (d.avisos?.length) alert('Avisos:\n' + d.avisos.join('\n'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBaseItens(d.itens.map((i: any) => ({ ticker: i.ticker, quantidade: i.quantidade, preco_medio: i.preco_medio, cnpj: i.cnpj ?? '', direcao: i.direcao ?? null })))
      alert(`${d.total} ativo(s) importado(s) da aba "${d.aba}". Revise e clique em Salvar.`)
    } catch { alert('Erro de conexão.') }
    finally { setImportandoBase(false); e.target.value = '' }
  }

  useEffect(() => {
    if (abaCarteira === 'importacoes') carregarImportacoes()
    if (abaCarteira === 'base') carregarBase()
    if (abaCarteira === 'performance') buscarPerformance()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaCarteira, carregarImportacoes, carregarBase])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setPlano(d.plano ?? 'gratuito'))
      .catch(() => {})
  }, [])

  const LIMITE_GRATUITO = 2
  const limiteAtingido = plano === 'gratuito' && posicoes.length >= LIMITE_GRATUITO

  const abrirAddPosicao = () => {
    if (limiteAtingido) { setLimiteModal(true); return }
    setEditando(null); setModal('add')
  }

  const _fecharImport = () => {
    setImportModal(false); setImportNotas([]); setImportOpsAll([]); setImportErro(''); setImportProgress('')
  }

  const handleImportarNota = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setImportando(true); setImportErro(''); setImportModal(true)
    setImportNotas([]); setImportOpsAll([]); setImportProgress('')

    const notas: NotaInfo[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: OpImport[] = []
    const errosArq: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setImportProgress(`Lendo ${i + 1} de ${files.length}: ${file.name}…`)
      try {
        const fd = new FormData()
        fd.append('nota', file)
        const r = await fetch('/api/carteira/importar', { method: 'POST', body: fd })
        const d = await r.json()
        if (!r.ok) { errosArq.push(`${file.name}: ${d.error ?? 'Erro'}`); continue }
        const notaIdx = notas.length
        notas.push({ corretora: d.corretora ?? null, data: d.data ?? null, arquivo: file.name })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ops.push(...(d.operacoes as any[]).map(op => ({ ...op, notaIdx, selecionada: true })))
      } catch { errosArq.push(`${file.name}: erro de conexão`) }
    }

    setImportNotas(notas)
    setImportOpsAll(ops)
    if (errosArq.length) setImportErro(errosArq.join('\n'))
    setImportProgress('')
    setImportando(false)
    e.target.value = ''
  }

  const sincronizarCarteira = async () => {
    if (!confirm('Reconstruir carteira a partir da posição base + movimentações salvas?\nIsso corrige inconsistências causadas por importações anteriores.')) return
    setSincronizando(true)
    try {
      const r = await fetch('/api/carteira/reconstruir', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro ao reconstruir.'); return }
      alert(`Carteira reconstruída: ${d.total_ativos} ativo(s).`)
      await carregarCarteira()
    } catch { alert('Erro de conexão. Tente novamente.') }
    finally { setSincronizando(false) }
  }

  const confirmarImport = async () => {
    const selecionadas = importOpsAll.filter(op => op.selecionada)
    if (!selecionadas.length) return
    setSalvandoImport(true)
    try {
      const descricao = importNotas[0]?.arquivo
        ? `Planilha B3 — ${importNotas[0].arquivo}`
        : `Importação manual — ${new Date().toLocaleDateString('pt-BR')}`
      const payload = selecionadas.map(op => ({
        tipo: op.tipo, ticker: op.ticker, quantidade: op.quantidade,
        preco: op.preco, data: op.data, notas: op.notas ?? null,
        mercado: op.mercado ?? 'acao', vencimento: op.vencimento ?? null,
      }))
      const r = await fetch('/api/carteira/confirmar-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacoes: payload, descricao }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro ao salvar importação.'); return }
      if (d.aviso) alert(d.aviso)
      _fecharImport()
      await carregarCarteira()
    } catch { alert('Erro de conexão. Tente novamente.') }
    finally { setSalvandoImport(false) }
  }

  /* importação de planilha B3 (.xlsx) */
  const handleImportarB3 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setImportErro(''); setImportModal(true)
    setImportNotas([]); setImportOpsAll([]); setImportProgress('Lendo planilha B3…')
    try {
      const fd = new FormData()
      fd.append('planilha', file)
      const r = await fetch('/api/carteira/importar-b3', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { setImportErro(d.error ?? 'Erro ao processar a planilha.'); return }
      if (d.avisos?.length) setImportErro(d.avisos.join('\n'))
      setImportNotas([{ corretora: 'Planilha B3', data: null, arquivo: file.name }])
      setImportOpsAll(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d.operacoes as any[]).map(op => ({
          ...op, notaIdx: 0, selecionada: true,
          // Para opções: V = lançador (vende para abrir), C = titular (compra para abrir)
          direcao: op.mercado === 'opcao'
            ? (op.tipo === 'V' ? 'lancador' : 'titular')
            : undefined,
        }))
      )
    } catch { setImportErro('Erro de conexão. Tente novamente.') }
    finally { setImportProgress(''); setImportando(false); e.target.value = '' }
  }

  /* busca posições do banco */
  const carregarCarteira = useCallback(async () => {
    setLoading(true); setErro('')
    try {
      const [rCart, rPo] = await Promise.all([
        fetch('/api/carteira'),
        fetch('/api/ir/opcoes/virou-po'),
      ])
      const [dCart, dPo] = await Promise.all([rCart.json(), rPo.json()])
      const enriquecidas: Posicao[] = (dCart.carteira ?? []).map((p: Posicao) => ({
        ...p,
        nome:  fund[p.ticker]?.nome  ?? p.ticker,
        setor: setoresManuais[p.ticker] ?? fund[p.ticker]?.setor ?? '—',
        nota:  notaParaTicker(p.ticker, null),
        preco_atual: null,
        variacao: null,
      }))
      setPosicoes(enriquecidas)
      if (Array.isArray(dPo.tickers)) setPoVencidas(new Set(dPo.tickers as string[]))
    } catch { setErro('Erro ao carregar carteira.') }
    finally  { setLoading(false) }
  }, [])

  /* busca cotações via API server-side (sem CORS) */
  const atualizarCotacoes = useCallback(async () => {
    if (posicoes.length === 0) return
    setAtualizando(true)
    const tickers = posicoes.map(p => p.ticker)
    const precos = await buscarPrecos(tickers)
    setPosicoes(prev => prev.map(p => {
      const c = precos[p.ticker]
      const precoAtual = c?.preco ?? null
      return { ...p, preco_atual: precoAtual, variacao: c?.variacao ?? null, nota: notaParaTicker(p.ticker, precoAtual) }
    }))
    setAtualizando(false)
  }, [posicoes])

  useEffect(() => { carregarCarteira() }, [carregarCarteira])

  /* busca cotações uma vez após carregar as posições */
  const [cotacoesCarregadas, setCotacoesCarregadas] = useState(false)
  useEffect(() => {
    if (!loading && posicoes.length > 0 && !cotacoesCarregadas) {
      setCotacoesCarregadas(true)
      atualizarCotacoes()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, posicoes.length])

  const remover = async () => {
    if (!selecionado) return
    const pos = posicoes.find(p => p.id === selecionado)
    if (!pos || !confirm(`Remover ${pos.ticker} da carteira?`)) return
    await fetch(`/api/carteira/${selecionado}`, { method: 'DELETE' })
    await carregarCarteira()
    setSelecionado(null)
  }

  /* métricas globais */
  const metricas = useMemo(() => {
    const ativas = posicoes.filter(p => !p.excluir_calculo)
    const investido = ativas.reduce((s, p) => s + p.quantidade * p.preco_medio, 0)
    const atual     = ativas.reduce((s, p) => s + p.quantidade * (p.preco_atual ?? p.preco_medio), 0)
    const pl        = atual - investido
    const plPct     = investido > 0 ? (pl / investido) * 100 : 0
    const totalAtual = atual

    /* pesos atuais */
    const posComPeso = ativas.map(p => ({
      id: p.id,
      valor: p.quantidade * (p.preco_atual ?? p.preco_medio),
    }))

    /* peso sugerido por nota — com cap de setor em 40% */
    const somaNotas = ativas.reduce((s,p) => s+(p.nota ?? 5), 0)
    const pesosBrutos: Record<string, number> = {}
    for (const p of ativas) {
      const n = p.nota ?? 5
      pesosBrutos[p.ticker] = somaNotas > 0 ? (n / somaNotas) * 100 : 0
    }
    // Soma por setor e calcula fator de escala se ultrapassar 40%
    const pesoPorSetor: Record<string, number> = {}
    for (const p of ativas) {
      const s = p.setor ?? '—'
      pesoPorSetor[s] = (pesoPorSetor[s] ?? 0) + pesosBrutos[p.ticker]
    }
    const fatorSetor: Record<string, number> = {}
    for (const [s, total] of Object.entries(pesoPorSetor)) {
      fatorSetor[s] = total > 40 ? 40 / total : 1
    }
    // Aplica fator e renormaliza para 100%
    const pesosEscalados: Record<string, number> = {}
    for (const p of ativas) {
      const s = p.setor ?? '—'
      pesosEscalados[p.ticker] = pesosBrutos[p.ticker] * fatorSetor[s]
    }
    const somaEscalada = Object.values(pesosEscalados).reduce((a, b) => a + b, 0)
    const pesosFinais: Record<string, number> = {}
    for (const p of ativas) {
      pesosFinais[p.ticker] = somaEscalada > 0 ? (pesosEscalados[p.ticker] / somaEscalada) * 100 : 0
    }
    const pesoSug = (ticker: string, _nota: number | null) => pesosFinais[ticker] ?? 0

    return { investido, atual: totalAtual, pl, plPct, posComPeso, pesoSug }
  }, [posicoes])

  const posicaoSel = posicoes.find(p => p.id === selecionado)

  /* Separa ações/FIIs de opções — deve vir ANTES de sortedPosicoes */
  const posicoesAcoes  = posicoes.filter(p => !isOpcaoTicker(p.ticker))
  const posicoesOpcoes = posicoes.filter(p =>  isOpcaoTicker(p.ticker) && !poVencidas.has(p.ticker))

  const totaisOpcoes = useMemo(() => {
    let credito = 0, debito = 0, contratos = 0
    for (const p of posicoesOpcoes) {
      const val = Math.abs(p.quantidade) * p.preco_medio
      if (p.quantidade < 0) credito += val  // lançador: recebeu prêmio
      else debito += val                    // titular: pagou prêmio
      contratos += Math.abs(p.quantidade)
    }
    return { credito, debito, net: credito - debito, contratos }
  }, [posicoesOpcoes])

  const totaisAcoes = useMemo(() => {
    const investido = posicoesAcoes.reduce((s, p) => s + p.quantidade * p.preco_medio, 0)
    const atual     = posicoesAcoes.reduce((s, p) => s + p.quantidade * (p.preco_atual ?? p.preco_medio), 0)
    const pl        = atual - investido
    const plPct     = Math.abs(investido) > 0.01 ? (pl / Math.abs(investido)) * 100 : 0
    return { investido, atual, pl, plPct }
  }, [posicoesAcoes])

  const toggleSort = (key: string) =>
    setSortConfig(prev => prev?.key === key ? (prev.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' })

  const sortIcon = (key: string) =>
    sortConfig?.key === key ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  const sortedPosicoes = useMemo(() => {
    const base = posicoesAcoes
    if (!sortConfig) return base
    const { key, dir } = sortConfig
    const total = metricas.atual || 1
    return [...base].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      const pA = a.preco_atual ?? a.preco_medio, pB = b.preco_atual ?? b.preco_medio
      switch (key) {
        case 'ticker':   va = a.ticker;                                       vb = b.ticker; break
        case 'nome':     va = a.nome ?? '';                                   vb = b.nome ?? ''; break
        case 'qtde':     va = a.quantidade;                                   vb = b.quantidade; break
        case 'pMedio':   va = a.preco_medio;                                  vb = b.preco_medio; break
        case 'pAtual':   va = a.preco_atual ?? -1e9;                          vb = b.preco_atual ?? -1e9; break
        case 'resUn':    va = a.preco_atual != null ? pA - a.preco_medio : -1e9; vb = b.preco_atual != null ? pB - b.preco_medio : -1e9; break
        case 'resTotal': va = a.preco_atual != null ? (pA - a.preco_medio) * a.quantidade : -1e9; vb = b.preco_atual != null ? (pB - b.preco_medio) * b.quantidade : -1e9; break
        case 'resPct':   va = a.preco_atual != null && a.preco_medio > 0 ? ((pA - a.preco_medio) / a.preco_medio) * 100 : -1e9; vb = b.preco_atual != null && b.preco_medio > 0 ? ((pB - b.preco_medio) / b.preco_medio) * 100 : -1e9; break
        case 'valorAtu': va = pA * a.quantidade;                              vb = pB * b.quantidade; break
        case 'nota':     va = a.nota ?? -1e9;                                 vb = b.nota ?? -1e9; break
        case 'pesoAtual':va = (pA * a.quantidade) / total * 100;             vb = (pB * b.quantidade) / total * 100; break
        case 'pesoSug':  va = metricas.pesoSug(a.ticker, a.nota ?? null);    vb = metricas.pesoSug(b.ticker, b.nota ?? null); break
      }
      if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [posicoes, sortConfig, metricas])

  const toggleSortOpcoes = (key: string) =>
    setSortOpcoes(prev => prev?.key === key ? (prev.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' })

  const sortIconOpcoes = (key: string) =>
    sortOpcoes?.key === key ? (sortOpcoes.dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  const sortedOpcoes = useMemo(() => {
    if (!sortOpcoes) return posicoesOpcoes
    const { key, dir } = sortOpcoes
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    return [...posicoesOpcoes].sort((a, b) => {
      const infoA = infoOpcao(a.ticker, a.data_vencimento), infoB = infoOpcao(b.ticker, b.data_vencimento)
      let va: number | string = 0, vb: number | string = 0
      switch (key) {
        case 'ticker':    va = a.ticker;                                          vb = b.ticker; break
        case 'ativo':     va = a.ticker.slice(0,4);                              vb = b.ticker.slice(0,4); break
        case 'tipo':      va = infoA?.isCall ? 'CALL' : 'PUT';                   vb = infoB?.isCall ? 'CALL' : 'PUT'; break
        case 'posicao':   va = a.quantidade < 0 ? 0 : 1;                         vb = b.quantidade < 0 ? 0 : 1; break
        case 'qtde':      va = Math.abs(a.quantidade);                            vb = Math.abs(b.quantidade); break
        case 'premio':    va = a.preco_medio;                                     vb = b.preco_medio; break
        case 'custo':     va = Math.abs(a.quantidade) * a.preco_medio;            vb = Math.abs(b.quantidade) * b.preco_medio; break
        case 'vencimento':va = infoA ? infoA.vencimento.getTime() : 0;           vb = infoB ? infoB.vencimento.getTime() : 0; break
        case 'dias':      va = infoA ? Math.round((infoA.vencimento.getTime() - hoje.getTime()) / 86400000) : -99999;
                          vb = infoB ? Math.round((infoB.vencimento.getTime() - hoje.getTime()) / 86400000) : -99999; break
      }
      if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [posicoesOpcoes, sortOpcoes])

  const corPL = (v: number) => v > 0 ? '#00d4a0' : v < 0 ? '#ef4444' : '#e8edf5'

  // ── Performance ─────────────────────────────────────────────────────────────
  function tipoAtivo(ticker: string): 'acao' | 'fii_etf' | 'bdr' | 'opcao' {
    if (isOpcaoTicker(ticker)) return 'opcao'
    if (/11$/.test(ticker) && ticker.length >= 6) return 'fii_etf'
    if (/(34|32|39|33)$/.test(ticker) && ticker.length >= 6) return 'bdr'
    return 'acao'
  }

  function aplicarPeriodo(periodo: string) {
    const hoje = new Date()
    const ate = hoje.toISOString().slice(0, 10)
    let de: string
    switch (periodo) {
      case 'mes': de = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10); break
      case '3m': { const d = new Date(hoje); d.setMonth(d.getMonth() - 3); de = d.toISOString().slice(0, 10); break }
      case '6m': { const d = new Date(hoje); d.setMonth(d.getMonth() - 6); de = d.toISOString().slice(0, 10); break }
      case '12m': { const d = new Date(hoje); d.setFullYear(d.getFullYear() - 1); de = d.toISOString().slice(0, 10); break }
      default: de = `${hoje.getFullYear()}-01-01` // ytd
    }
    setPerfDe(de); setPerfAte(ate); setPerfPeriodo(periodo)
  }

  function toggleTipoPerfil(tipo: string) {
    setPerfTipos(prev => {
      const next = new Set(prev)
      next.has(tipo) ? next.delete(tipo) : next.add(tipo)
      return next
    })
  }

  async function buscarPerformance() {
    setPerfLoading(true)
    try {
      const r = await fetch(`/api/carteira/performance?de=${perfDe}&ate=${perfAte}`)
      if (r.ok) setPerfData(await r.json())
    } finally { setPerfLoading(false) }
  }

  const toggleDirecaoOpcao = async (p: Posicao) => {
    setTogglingDirecao(p.id)
    const r = await fetch(`/api/carteira/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantidade: -p.quantidade }),
    })
    if (r.ok) {
      const { posicao } = await r.json()
      setPosicoes(prev => prev.map(x => x.id === p.id ? { ...x, quantidade: posicao.quantidade } : x))
    }
    setTogglingDirecao(null)
  }

  const virouPo = async (p: Posicao) => {
    setMarcandoPo(p.ticker)
    const info = infoOpcao(p.ticker, p.data_vencimento)
    const dataVenc = info ? info.vencimento.toISOString().slice(0,10) : (p.data_vencimento ?? new Date().toISOString().slice(0,10))
    const r = await fetch('/api/ir/opcoes/virou-po', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: p.ticker, qtde_liquida: p.quantidade, data_vencimento: dataVenc }),
    })
    if (r.ok) {
      const txt = p.quantidade > 0
        ? `${p.ticker}: perda de R$ ${f2(p.quantidade * p.preco_medio)} registrada no IR.`
        : `${p.ticker}: posição de lançamento encerrada.`
      setMsgPo(txt)
      setTimeout(() => setMsgPo(null), 5000)
      // Remove imediatamente da lista sem recarregar tudo
      setPoVencidas(prev => new Set(prev).add(p.ticker))
    } else {
      const e = await r.json().catch(() => ({}))
      setMsgPo(e.error ?? 'Erro ao registrar vencimento.')
      setTimeout(() => setMsgPo(null), 5000)
    }
    setMarcandoPo(null)
  }

  const virouPoTodas = async () => {
    const hoje = new Date(); hoje.setHours(0,0,0,0)
    const vencidas = posicoesOpcoes.filter(p => {
      const info = infoOpcao(p.ticker, p.data_vencimento)
      if (!info) return false
      return info.vencimento < hoje
    })
    if (vencidas.length === 0) {
      setMsgPo('Nenhuma opção vencida encontrada.')
      setTimeout(() => setMsgPo(null), 4000)
      return
    }
    if (!confirm(`Marcar ${vencidas.length} opção(ões) vencida(s) como "virou pó"?\n\n${vencidas.map(p => p.ticker).join(', ')}`)) return
    setMarcandoPoTodas(true)
    let ok = 0, erros = 0
    for (const p of vencidas) {
      const info = infoOpcao(p.ticker, p.data_vencimento)!
      const dataVenc = info.vencimento.toISOString().slice(0,10)
      const r = await fetch('/api/ir/opcoes/virou-po', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: p.ticker, qtde_liquida: p.quantidade, data_vencimento: dataVenc }),
      })
      if (r.ok) {
        setPoVencidas(prev => new Set(prev).add(p.ticker))
        ok++
      } else {
        erros++
      }
    }
    setMarcandoPoTodas(false)
    setMsgPo(`${ok} opção(ões) encerrada(s)${erros > 0 ? ` · ${erros} erro(s)` : ''}.`)
    setTimeout(() => setMsgPo(null), 6000)
  }

  const desfazerVirouPo = async (ticker: string) => {
    setDesfazendoPo(ticker)
    const r = await fetch('/api/ir/opcoes/virou-po', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    })
    setDesfazendoPo(null)
    if (r.ok) {
      setPoVencidas(prev => { const s = new Set(prev); s.delete(ticker); return s })
      setMsgPo(`${ticker}: marcação de virou pó desfeita.`)
    } else {
      const e = await r.json().catch(() => ({}))
      setMsgPo(`Erro: ${e.error ?? 'não foi possível desfazer.'}`)
    }
    setTimeout(() => setMsgPo(null), 5000)
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5;overflow-x:hidden}
        .page{display:flex;flex-direction:column;height:100vh}
        .bar-pl{flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;height:48px;display:flex;align-items:center;gap:32px;font-size:13px}
        .pl-item{display:flex;align-items:center;gap:8px;color:#6b84a8}
        .pl-val{font-family:var(--font-space),'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:#e8edf5}
        .nota-legend{margin-left:auto;font-size:12px;color:#6b84a8;display:flex;align-items:center;gap:12px}
        .nota-legend span{font-weight:700}
        .btn-bar{flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;height:48px;display:flex;align-items:center;gap:8px}
        .btn{padding:7px 16px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;border:none;transition:all .15s;display:flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0}
        .btn-add  {background:#1565C0;color:#fff}.btn-add:hover{background:#1976D2}
        .btn-edit {background:#00695C;color:#fff}.btn-edit:hover{background:#00796B}.btn-edit:disabled{opacity:.4;cursor:not-allowed}
        .btn-rem  {background:#B71C1C;color:#fff}.btn-rem:hover{background:#C62828}.btn-rem:disabled{opacity:.4;cursor:not-allowed}
        .btn-ops  {background:#4A148C;color:#fff}.btn-ops:hover{background:#6A1B9A}.btn-ops:disabled{opacity:.4;cursor:not-allowed}
        .btn-cot  {background:#2E7D32;color:#fff}.btn-cot:hover{background:#388E3C}
        .btn-ghost{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#b8c4d4}.btn-ghost:hover{background:rgba(255,255,255,.1)}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .table-wrap{flex:1;overflow:auto;min-height:0}
        .cards-mobile{display:none}
        .sort-bar-mobile{display:none}
        table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:1100px}
        thead th{background:#081120;padding:9px 10px;text-align:right;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#6b84a8;border-bottom:2px solid rgba(255,255,255,.08);position:sticky;top:0;z-index:10;white-space:nowrap}
        thead th:first-child,thead th:nth-child(2){text-align:left}
        tbody tr{border-bottom:1px solid rgba(255,255,255,.035);cursor:pointer;transition:background .1s}
        tbody tr:hover{background:rgba(255,255,255,.04)}
        tbody tr.sel{background:rgba(232,160,32,.08)!important;outline:1px solid rgba(232,160,32,.25)}
        tbody td{padding:9px 10px;text-align:right;color:#e8edf5;white-space:nowrap}
        tbody td:first-child{text-align:left;font-weight:700;color:#e8a020;font-family:var(--font-space),'Space Grotesk',monospace}
        tbody td:nth-child(2){text-align:left;color:#b8c4d4;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis}
        .muted{color:#6b84a8!important;font-weight:400!important}
        .loading-box{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px}
        .spinner{width:36px;height:36px;border:3px solid rgba(232,160,32,.15);border-top-color:#e8a020;border-radius:50%;animation:spin .75s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .empty{text-align:center;padding:60px;color:#6b84a8}
        .excl-tag{font-size:9px;background:rgba(255,255,255,.08);color:#6b84a8;border-radius:4px;padding:1px 5px;margin-left:4px;font-weight:700}
        @media (max-width: 760px) {
          .table-wrap{display:none}
          .bar-pl{height:auto;flex-wrap:wrap;padding:8px 12px;gap:14px;row-gap:6px}
          .nota-legend{margin-left:0;width:100%;justify-content:center}
          .btn-bar{height:44px;flex-wrap:nowrap;overflow-x:auto;padding:0 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none}.btn-bar::-webkit-scrollbar{display:none}
          .aba-tabs{overflow-x:auto;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}.aba-tabs::-webkit-scrollbar{display:none}
          .sort-bar-mobile{display:flex;gap:6px;padding:8px 10px;overflow-x:auto;flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.05)}
          .sort-chip{flex-shrink:0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#b8c4d4;font-size:11px;font-weight:700;padding:6px 12px;border-radius:14px;cursor:pointer;white-space:nowrap;font-family:inherit}
          .sort-chip.ativo{background:rgba(232,160,32,.15);border-color:rgba(232,160,32,.4);color:#e8a020}
          .cards-mobile{display:flex;flex-direction:column;gap:8px;padding:10px;overflow-y:auto;flex:1;min-height:0}
          .posicao-card{background:#081120;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px;cursor:pointer}
          .posicao-card.sel{background:rgba(232,160,32,.08);outline:1px solid rgba(232,160,32,.25)}
          .posicao-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
          .posicao-card-ticker{font-weight:700;font-size:15px;color:#e8a020;font-family:var(--font-space),monospace}
          .posicao-card-nome{font-size:11.5px;color:#b8c4d4;margin-top:1px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .posicao-card-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 10px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
          .posicao-card-stats > div{display:flex;flex-direction:column;gap:1px}
          .posicao-card-stats .lbl{font-size:9px;color:#3d4f6a;text-transform:uppercase;letter-spacing:.3px}
          .posicao-card-stats span:not(.lbl){font-size:13px;font-weight:600;color:#e8edf5}
          .posicao-card-res{margin-top:8px;font-size:13px;font-weight:700}
          .posicao-card-footer{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
          .posicao-card-btn{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:7px 4px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#e8edf5}
        }
      `}</style>

      <NavBar />

      <div className="page" style={{ height: 'calc(100vh - 44px)' }}>

        {/* BARRA P&L */}
        <div className="bar-pl">
          <div className="pl-item">Investido: <span className="pl-val">{fR(metricas.investido)}</span></div>
          <div className="pl-item">Atual: <span className="pl-val">{fR(metricas.atual)}</span></div>
          <div className="pl-item">
            P&L:
            <span className="pl-val" style={{ color: corPL(metricas.pl) }}>
              {' '}{fR(metricas.pl)} ({metricas.pl >= 0 ? '+' : ''}{f1(metricas.plPct)})
            </span>
          </div>
          <div className="nota-legend">
            <span style={{ fontSize:'12px',fontWeight:700,color:'#6b84a8' }}>★ NOTA:</span>
            <span style={{ color:'#66BB6A' }}>≥7 Ótima</span>
            <span style={{ color:'#FFD54F' }}>5-7 Boa</span>
            <span style={{ color:'#EF9A9A' }}>&lt;5 Baixa</span>
          </div>
        </div>

        {/* ABAS */}
        <div className="aba-tabs" style={{ display:'flex', gap:0, background:'#081120', borderBottom:'1px solid rgba(255,255,255,.07)', paddingLeft:20 }}>
          {([
            { key:'acoes',       label:`📈 Ações / FIIs${posicoesAcoes.length ? ` (${posicoesAcoes.length})` : ''}` },
            { key:'opcoes',      label:`🎯 Opções${posicoesOpcoes.length ? ` (${posicoesOpcoes.length})` : ''}` },
            { key:'importacoes',  label:'📥 Importações' },
            { key:'base',         label:'📌 Posição Base' },
            { key:'performance',  label:'📊 Performance' },
          ] as { key: 'acoes'|'opcoes'|'importacoes'|'base'|'performance'; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setAbaCarteira(t.key)} style={{
              background:'none', border:'none', borderBottom: abaCarteira===t.key ? '2px solid #e8a020' : '2px solid transparent',
              padding:'10px 18px', fontSize:13, fontWeight: abaCarteira===t.key ? 700 : 500,
              color: abaCarteira===t.key ? '#e8a020' : '#4a5d73', cursor:'pointer', transition:'all .15s',
              whiteSpace:'nowrap', flexShrink:0,
            }}>{t.label}</button>
          ))}
        </div>

        {/* BOTÕES — apenas nas abas de posição */}
        {(abaCarteira === 'acoes' || abaCarteira === 'opcoes') && <div className="btn-bar">
          <button className="btn btn-add" onClick={abrirAddPosicao}
            title={limiteAtingido ? 'Plano gratuito: máx. 2 ações. Faça upgrade para adicionar mais.' : ''}>
            + Posição {limiteAtingido && <span style={{ fontSize: '10px', opacity: .7 }}>🔒</span>}
          </button>
          <button className="btn btn-edit" disabled={!selecionado}
            onClick={() => { if (posicaoSel) { setEditando(posicaoSel); setModal('edit') } }}>
            ✏ Editar
          </button>
          <button className="btn btn-rem" disabled={!selecionado} onClick={remover}>
            🗑 Remover
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={excluirLote}
              disabled={excluindoLote}
              style={{ background:'rgba(239,68,68,.2)', border:'1px solid rgba(239,68,68,.5)', color:'#ef4444', padding:'6px 14px', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', opacity: excluindoLote ? .5 : 1 }}>
              {excluindoLote ? '…' : `🗑 Excluir ${selectedIds.size} selecionado(s)`}
            </button>
          )}
          <button className="btn btn-ops" disabled={!selecionado}
            onClick={() => { if (posicaoSel) setOpsTicker(posicaoSel.ticker) }}>
            📋 Operações
          </button>
          <button className="btn btn-cot" onClick={atualizarCotacoes} disabled={atualizando || loading}>
            {atualizando ? '⟳ Atualizando…' : '⟳ Cotações'}
          </button>
          <label className="btn" style={{ background:'#1a3a5c', color:'#fff', cursor:'pointer' }}
            title="Importar nota(s) de corretagem — selecione vários PDFs de uma vez (Ctrl+clique)">
            📄 Importar Notas
            <input type="file" accept=".pdf,image/*" multiple style={{ display:'none' }}
              onChange={handleImportarNota} disabled={limiteAtingido} />
          </label>
          <label className="btn" style={{ background:'#1a3a5c', color:'#fff', cursor:'pointer' }}
            title="Importar planilha de negociações baixada do site da B3 (.xlsx)">
            📊 Planilha B3
            <input type="file" accept=".xlsx,.xls" style={{ display:'none' }}
              onChange={handleImportarB3} disabled={limiteAtingido} />
          </label>
          <button className="btn btn-ghost" onClick={() => {
            const rows = posicoes.map(p => [
              p.ticker,p.nome,p.quantidade,p.preco_medio,p.preco_atual??'',
              p.preco_atual?p.preco_atual-p.preco_medio:'',
              p.preco_atual?(p.preco_atual-p.preco_medio)*p.quantidade:'',
              p.preco_atual?((p.preco_atual-p.preco_medio)/p.preco_medio*100):'',
              p.preco_atual?p.preco_atual*p.quantidade:p.preco_medio*p.quantidade,
              p.nota??''
            ].join(';'))
            const csv='﻿'+'Ticker;Nome;Qtde;P.Médio;P.Atual;Res.Un;Res.Total;Res.%;Valor Atu.;Nota\r\n'+rows.join('\r\n')
            const b=new Blob([csv],{type:'text/csv;charset=utf-8'})
            const u=URL.createObjectURL(b)
            const a=document.createElement('a');a.href=u;a.download='carteira-radar.csv';a.click();URL.revokeObjectURL(u)
          }}>
            ⬇ Exportar Excel
          </button>
          <button className="btn btn-ghost" onClick={() => setShowConcentracao(true)}
            title="Análise de concentração por ativo e setor">
            🎯 Concentração
          </button>
        </div>}

        <div className="main">
          {loading && <div className="loading-box"><div className="spinner"/><p style={{color:'#6b84a8',fontSize:'13px'}}>Carregando carteira…</p></div>}
          {!loading && erro && <p style={{color:'#ef4444',textAlign:'center',padding:'40px'}}>{erro}</p>}

          {/* ── Painel Opções ──────────────────────────────────────────────────────── */}
          {!loading && !erro && abaCarteira === 'opcoes' && (
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              {msgPo && (
                <div style={{ background:'rgba(34,197,94,.12)', border:'1px solid #22c55e', borderRadius:7, padding:'10px 14px', fontSize:13, color:'#22c55e', marginBottom:14 }}>{msgPo}</div>
              )}
              {posicoesOpcoes.length === 0 ? (
                <div style={{ textAlign:'center', color:'#6b84a8', padding:'60px 0', fontSize:14 }}>
                  Nenhuma opção na carteira.<br/>
                  <span style={{ fontSize:12 }}>Importe suas notas de corretagem ou adicione manualmente.</span>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                    <div style={{ fontSize:12, color:'#4a5d73' }}>
                      Vencimento = terceira sexta-feira do mês (B3) · 🔴 vencida · 🟡 ≤5 dias
                    </div>
                    <button
                      onClick={virouPoTodas}
                      disabled={marcandoPoTodas}
                      style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.35)', color:'#ef4444', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:700, padding:'6px 14px', whiteSpace:'nowrap', opacity: marcandoPoTodas ? .5 : 1 }}
                    >
                      {marcandoPoTodas ? '⏳ Processando...' : 'Marcar todas vencidas como Virou Pó'}
                    </button>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:800 }}>
                      <thead>
                        <tr style={{ background:'#081120', borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                          <th style={{ padding:'8px 10px', width:32, textAlign:'center' }}>
                            <input type="checkbox"
                              title="Selecionar todos"
                              checked={sortedOpcoes.length > 0 && sortedOpcoes.every(p => selectedIds.has(p.id))}
                              onChange={e => {
                                if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...sortedOpcoes.map(p => p.id)]))
                                else setSelectedIds(prev => { const n = new Set(prev); sortedOpcoes.forEach(p => n.delete(p.id)); return n })
                              }}
                              style={{ cursor:'pointer', accentColor:'#ef4444' }}
                            />
                          </th>
                          {([
                            { label:'Ticker',       key:'ticker'    },
                            { label:'Ativo',        key:'ativo'     },
                            { label:'Tipo',         key:'tipo'      },
                            { label:'Posição',      key:'posicao'   },
                            { label:'Qtde',         key:'qtde'      },
                            { label:'Prêmio Médio', key:'premio'    },
                            { label:'Custo Total',  key:'custo'     },
                            { label:'Vencimento',   key:'vencimento'},
                            { label:'Dias',         key:'dias'      },
                            { label:'Ação',         key:''          },
                          ] as { label: string; key: string }[]).map(({ label, key }) => (
                            <th key={label}
                              onClick={key ? () => toggleSortOpcoes(key) : undefined}
                              style={{ padding:'8px 10px', textAlign:'left', fontSize:'10.5px', fontWeight:700, letterSpacing:'.4px', textTransform:'uppercase', color: key && sortOpcoes?.key === key ? '#e8a020' : '#6b84a8', whiteSpace:'nowrap', cursor: key ? 'pointer' : 'default', userSelect:'none' }}
                            >
                              {label}{key ? sortIconOpcoes(key) : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOpcoes.map(p => {
                          const info = infoOpcao(p.ticker, p.data_vencimento)
                          const hoje = new Date(); hoje.setHours(0,0,0,0)
                          const dias = info ? Math.round((info.vencimento.getTime() - hoje.getTime()) / 86400000) : null
                          const vencida = dias !== null && dias < 0
                          const urgente = dias !== null && dias >= 0 && dias <= 5
                          const titular = p.quantidade > 0
                          const rowBg   = vencida ? 'rgba(239,68,68,.07)' : urgente ? 'rgba(234,184,56,.05)' : 'transparent'
                          return (
                            <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', background:rowBg }}>
                              <td style={{ padding:'10px', textAlign:'center' }}>
                                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                                  style={{ cursor:'pointer', accentColor:'#ef4444' }} />
                              </td>
                              <td style={{ padding:'10px', fontWeight:800, color:'#e8a020', fontFamily:'monospace' }}>{p.ticker}</td>
                              <td style={{ padding:'10px', color:'#b8c4d4' }}>{info ? info.ativo : p.ticker.slice(0,4)}</td>
                              <td style={{ padding:'10px' }}>
                                <span style={{ background: info?.isCall ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', color: info?.isCall ? '#22c55e' : '#ef4444', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700 }}>
                                  {info ? (info.isCall ? 'CALL' : 'PUT') : '—'}
                                </span>
                              </td>
                              <td style={{ padding:'10px' }}>
                                <button
                                  onClick={() => toggleDirecaoOpcao(p)}
                                  disabled={togglingDirecao === p.id}
                                  title="Clique para alternar Titular ↔ Lançador"
                                  style={{ background:'none', border:'1px solid rgba(255,255,255,.1)', borderRadius:4, cursor:'pointer', padding:'3px 8px', display:'flex', alignItems:'center', gap:5, opacity: togglingDirecao===p.id ? .5 : 1 }}
                                >
                                  <span style={{ color: titular ? '#64b5f6' : '#ffb74d', fontWeight:700, fontSize:12 }}>
                                    {togglingDirecao===p.id ? '...' : titular ? 'Titular' : 'Lançador'}
                                  </span>
                                  <span style={{ color:'#4a5d73', fontSize:10 }}>⇄</span>
                                </button>
                              </td>
                              <td style={{ padding:'10px', color:'#e8edf5' }}>{f2(Math.abs(p.quantidade))}</td>
                              <td style={{ padding:'10px', color:'#6b84a8' }}>R$ {f2(p.preco_medio)}</td>
                              <td style={{ padding:'10px', color: titular ? '#ef4444' : '#22c55e', fontWeight:600 }}>
                                {titular ? '−' : '+'}R$ {f2(Math.abs(p.quantidade) * p.preco_medio)}
                              </td>
                              <td style={{ padding:'10px', fontWeight: (vencida || urgente) ? 700 : 400, color: vencida ? '#ef4444' : urgente ? '#eab838' : '#6b84a8' }}>
                                {info ? info.vencimento.toLocaleDateString('pt-BR') : '—'}
                              </td>
                              <td style={{ padding:'10px', textAlign:'center' }}>
                                {dias === null
                                  ? <span style={{ color:'#4a5d73' }}>—</span>
                                  : vencida
                                    ? <span style={{ color:'#ef4444', fontWeight:700, fontSize:12 }}>VENCIDA</span>
                                    : urgente
                                      ? <span style={{ color:'#eab838', fontWeight:700 }}>{dias}d ⚠</span>
                                      : <span style={{ color:'#4a5d73' }}>{dias}d</span>
                                }
                              </td>
                              <td style={{ padding:'10px' }}>
                                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                  {poVencidas.has(p.ticker) ? (
                                    <button
                                      onClick={() => desfazerVirouPo(p.ticker)}
                                      disabled={desfazendoPo === p.ticker}
                                      title="Desfazer marcação de virou pó"
                                      style={{ background:'rgba(234,184,56,.1)', border:'1px solid rgba(234,184,56,.3)', color:'#eab838', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:700, padding:'5px 10px', whiteSpace:'nowrap', opacity: desfazendoPo===p.ticker ? .4 : 1 }}
                                    >
                                      {desfazendoPo===p.ticker ? '...' : '↩ Desfazer'}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => virouPo(p)}
                                      disabled={marcandoPo === p.ticker}
                                      title={titular ? `Registrar perda de R$ ${f2(Math.abs(p.quantidade)*p.preco_medio)} no IR` : 'Encerrar lançamento — opção expirou sem exercício'}
                                      style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.35)', color:'#ef4444', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:700, padding:'5px 10px', whiteSpace:'nowrap', opacity: marcandoPo===p.ticker ? .4 : 1 }}
                                    >
                                      {marcandoPo===p.ticker ? '...' : 'Virou Pó'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => removerOpcao(p)}
                                    disabled={removendoOpcao === p.id}
                                    title={`Remover ${p.ticker} da carteira`}
                                    style={{ background:'rgba(100,100,120,.15)', border:'1px solid rgba(255,255,255,.12)', color:'#6b84a8', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:700, padding:'5px 10px', whiteSpace:'nowrap', opacity: removendoOpcao===p.id ? .4 : 1 }}
                                  >
                                    {removendoOpcao===p.id ? '...' : '🗑 Remover'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop:'2px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.025)' }}>
                          <td colSpan={4} style={{ padding:'9px 10px', color:'#4a5d73', fontSize:11, fontWeight:700, letterSpacing:'.05em' }}>
                            TOTAL — {posicoesOpcoes.length} opção(ões)
                          </td>
                          <td style={{ padding:'9px 10px', color:'#e8edf5', fontWeight:700, textAlign:'right' }}>
                            {totaisOpcoes.contratos.toLocaleString('pt-BR', { maximumFractionDigits:0 })}
                          </td>
                          <td></td>
                          <td style={{ padding:'9px 10px', fontWeight:700, color: totaisOpcoes.net >= 0 ? '#22c55e' : '#ef4444' }}>
                            {totaisOpcoes.net >= 0 ? '+' : '−'}R$ {f2(Math.abs(totaisOpcoes.net))}
                          </td>
                          <td colSpan={4}></td>
                        </tr>
                        <tr style={{ background:'rgba(255,255,255,.015)', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                          <td colSpan={11} style={{ padding:'5px 10px', fontSize:11, color:'#4a5d73' }}>
                            <span style={{ color:'#ffb74d' }}>Lançadores: +R$ {f2(totaisOpcoes.credito)}</span>
                            <span style={{ color:'#4a5d73', margin:'0 10px' }}>·</span>
                            <span style={{ color:'#64b5f6' }}>Titulares: −R$ {f2(totaisOpcoes.debito)}</span>
                            <span style={{ color:'#4a5d73', margin:'0 10px' }}>·</span>
                            <span style={{ color:'#8da3bc' }}>
                              Crédito líquido:{' '}
                              <strong style={{ color: totaisOpcoes.net >= 0 ? '#22c55e' : '#ef4444' }}>
                                {totaisOpcoes.net >= 0 ? '+' : '−'}R$ {f2(Math.abs(totaisOpcoes.net))}
                              </strong>
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div style={{ marginTop:16, display:'flex', gap:20, flexWrap:'wrap', fontSize:11, color:'#4a5d73' }}>
                    <span style={{ color:'#64b5f6' }}>■ Titular — comprou a opção (custo = prêmio pago)</span>
                    <span style={{ color:'#ffb74d' }}>■ Lançador — vendeu a opção (crédito = prêmio recebido)</span>
                    <span>Ao marcar "Virou Pó": titular registra prejuízo no IR; lançador encerra posição.</span>
                  </div>

                  {/* Opções que foram marcadas como virou pó mas não estão mais na carteira */}
                  {(() => {
                    const tickersNaCarteira = new Set(sortedOpcoes.map(p => p.ticker))
                    const encerradasSemLinha = [...poVencidas].filter(t => !tickersNaCarteira.has(t))
                    if (encerradasSemLinha.length === 0) return null
                    return (
                      <div style={{ marginTop:20, background:'rgba(234,184,56,.06)', border:'1px solid rgba(234,184,56,.2)', borderRadius:8, padding:'12px 16px' }}>
                        <div
                          onClick={() => setEncerradasExpandidas(v => !v)}
                          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' }}
                        >
                          <span style={{ fontSize:12, fontWeight:700, color:'#eab838' }}>
                            Virou Pó — fora da carteira ({encerradasSemLinha.length})
                          </span>
                          <span style={{ color:'#eab838', fontSize:14, transition:'transform .2s', display:'inline-block', transform: encerradasExpandidas ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                        </div>
                        {encerradasExpandidas && (
                          <>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
                              {encerradasSemLinha.map(ticker => (
                                <div key={ticker} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:6, padding:'6px 12px' }}>
                                  <span style={{ fontWeight:700, color:'#e0e6f0', fontSize:13 }}>{ticker}</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); desfazerVirouPo(ticker) }}
                                    disabled={desfazendoPo === ticker}
                                    style={{ background:'rgba(234,184,56,.15)', border:'1px solid rgba(234,184,56,.3)', color:'#eab838', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:700, padding:'3px 10px', whiteSpace:'nowrap', opacity: desfazendoPo===ticker ? .4 : 1 }}
                                  >
                                    {desfazendoPo===ticker ? '...' : '↩ Desfazer'}
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop:8, fontSize:11, color:'#4a5d73' }}>
                              Marcadas como Virou Pó mas ausentes da carteira. Clique em ↩ Desfazer para remover o registro.
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}

          {!loading && !erro && abaCarteira === 'acoes' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width:32, textAlign:'center' }}>
                      <input type="checkbox"
                        title="Selecionar todos"
                        checked={sortedPosicoes.length > 0 && sortedPosicoes.every(p => selectedIds.has(p.id))}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set(sortedPosicoes.map(p => p.id)))
                          else setSelectedIds(new Set())
                        }}
                        style={{ cursor:'pointer', accentColor:'#ef4444' }}
                      />
                    </th>
                    {([
                      { key:'ticker',   label:'Ticker',     align:'left'  },
                      { key:'nome',     label:'Nome',       align:'left'  },
                      { key:'qtde',     label:'Qtde',       align:'right' },
                      { key:'pMedio',   label:'P.Médio',    align:'right' },
                      { key:'pAtual',   label:'P.Atual',    align:'right' },
                      { key:'resUn',    label:'Res.Un',     align:'right' },
                      { key:'resTotal', label:'Res.Total',  align:'right' },
                      { key:'resPct',   label:'Res.%',      align:'right' },
                      { key:'valorAtu', label:'Valor Atu.', align:'right' },
                      { key:'nota',     label:'Nota ★',     align:'right' },
                      { key:'pesoAtual',label:'Peso Atual%',align:'right' },
                      { key:'pesoSug',  label:'Peso Sug.%', align:'right' },
                      { key:'',         label:'No Cálculo', align:'right' },
                    ] as { key: string; label: string; align: 'left'|'right' }[]).map(col => (
                      <th key={col.label}
                          style={{ textAlign: col.align, cursor: col.key ? 'pointer' : 'default', userSelect:'none' }}
                          onClick={() => col.key && toggleSort(col.key)}>
                        {col.label}{col.key ? sortIcon(col.key) : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posicoes.length === 0
                    ? <tr><td colSpan={13} className="empty">Nenhuma posição na carteira.<br/><span style={{fontSize:'13px',color:'#6b84a8'}}>Clique em "+ Posição" para adicionar.</span></td></tr>
                    : sortedPosicoes.map(p => {
                      const excl = p.excluir_calculo
                      const pAtual = p.preco_atual ?? p.preco_medio
                      const resUn    = p.preco_atual != null ? pAtual - p.preco_medio : null
                      const resTotal = p.preco_atual != null ? (pAtual - p.preco_medio) * p.quantidade : null
                      const resPct   = p.preco_atual != null && p.preco_medio > 0 ? ((pAtual - p.preco_medio) / p.preco_medio) * 100 : null
                      const valorAtu = pAtual * p.quantidade
                      const totalCart= metricas.atual || 1
                      const pesoAtual= (valorAtu / totalCart) * 100
                      const pesoSug  = metricas.pesoSug(p.ticker, p.nota ?? null)
                      const corRes   = (v: number | null) => v == null ? '#e8edf5' : v > 0 ? '#00d4a0' : v < 0 ? '#ef4444' : '#e8edf5'
                      const corNota  = (n: number | null | undefined) => n == null ? '#6b84a8' : n >= 7 ? '#66BB6A' : n >= 5 ? '#FFD54F' : '#EF9A9A'

                      return (
                        <tr key={p.id}
                            className={selecionado === p.id ? 'sel' : ''}
                            onClick={() => setSelecionado(p.id === selecionado ? null : p.id)}
                            onDoubleClick={() => { setEditando(p); setModal('edit') }}
                            style={excl ? {opacity:.5} : undefined}>
                          <td style={{ textAlign:'center' }} onClick={e => { e.stopPropagation(); toggleSelect(p.id) }}>
                            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                              style={{ cursor:'pointer', accentColor:'#ef4444' }} />
                          </td>
                          <td>
                            {p.ticker}
                            {excl && <span className="excl-tag">EXCLUÍDO</span>}
                          </td>
                          <td title={p.nome ?? ''} style={{ maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nome}</td>
                          <td>{f2(p.quantidade)}</td>
                          <td>R$ {f2(p.preco_medio)}</td>
                          <td>{p.preco_atual != null ? <span>R$ {f2(p.preco_atual)}</span> : <span className="muted">—</span>}</td>
                          <td style={{color:corRes(resUn)}}>{resUn!=null?'R$ '+f2(resUn):'—'}</td>
                          <td style={{color:corRes(resTotal),fontWeight:600}}>{resTotal!=null?'R$ '+f2(resTotal):'—'}</td>
                          <td style={{color:corRes(resPct),fontWeight:600}}>{resPct!=null?(resPct>=0?'+':'')+f2(resPct)+'%':'—'}</td>
                          <td style={{fontWeight:600}}>R$ {f2(valorAtu)}</td>
                          <td style={{color:corNota(p.nota),fontWeight:700}}>{p.nota != null ? f2(p.nota) : '—'}</td>
                          <td style={{color:'#b8c4d4'}}>{f2(pesoAtual)}%</td>
                          <td style={{color:pesoSug>pesoAtual?'#00d4a0':pesoSug<pesoAtual?'#FFD54F':'#b8c4d4'}}>{f2(pesoSug)}%</td>
                          <td>
                            <button
                              onClick={async e => {
                                e.stopPropagation()
                                await fetch(`/api/carteira/${p.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({excluir_calculo:!p.excluir_calculo})})
                                carregarCarteira()
                              }}
                              style={{background:excl?'rgba(255,255,255,.06)':'rgba(0,212,160,.1)',border:'none',borderRadius:'5px',padding:'3px 10px',fontSize:'11px',fontWeight:700,color:excl?'#6b84a8':'#00d4a0',cursor:'pointer'}}>
                              {excl ? 'Fora' : 'Dentro'}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
                {sortedPosicoes.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop:'2px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.025)' }}>
                      <td></td>
                      <td colSpan={2} style={{ padding:'9px 10px', color:'#4a5d73', fontSize:11, fontWeight:700, letterSpacing:'.05em' }}>
                        TOTAL — {sortedPosicoes.length} ativo(s)
                      </td>
                      <td style={{ padding:'9px 10px', textAlign:'right', color:'#8da3bc', fontSize:11 }}>—</td>
                      <td style={{ padding:'9px 10px', textAlign:'right', color:'#8da3bc', fontSize:11 }}>—</td>
                      <td style={{ padding:'9px 10px', textAlign:'right', color:'#8da3bc', fontSize:11 }}>—</td>
                      <td style={{ padding:'9px 10px', textAlign:'right', color:'#8da3bc', fontSize:11 }}>—</td>
                      <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color: totaisAcoes.pl >= 0 ? '#00d4a0' : '#ef4444' }}>
                        {totaisAcoes.pl >= 0 ? '+' : ''}R$ {f2(totaisAcoes.pl)}
                      </td>
                      <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color: totaisAcoes.plPct >= 0 ? '#00d4a0' : '#ef4444' }}>
                        {totaisAcoes.plPct >= 0 ? '+' : ''}{f1(totaisAcoes.plPct)}%
                      </td>
                      <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:700, color:'#e8edf5' }}>
                        R$ {f2(totaisAcoes.atual)}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                    <tr style={{ background:'rgba(255,255,255,.015)', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                      <td colSpan={14} style={{ padding:'5px 10px', fontSize:11, color:'#4a5d73' }}>
                        <span style={{ color:'#8da3bc' }}>Investido: <strong style={{ color:'#e8edf5' }}>R$ {f2(totaisAcoes.investido)}</strong></span>
                        <span style={{ color:'#4a5d73', margin:'0 10px' }}>·</span>
                        <span style={{ color:'#8da3bc' }}>Atual: <strong style={{ color:'#e8edf5' }}>R$ {f2(totaisAcoes.atual)}</strong></span>
                        <span style={{ color:'#4a5d73', margin:'0 10px' }}>·</span>
                        <span style={{ color:'#8da3bc' }}>P&L: <strong style={{ color: totaisAcoes.pl >= 0 ? '#00d4a0' : '#ef4444' }}>
                          {totaisAcoes.pl >= 0 ? '+' : ''}R$ {f2(totaisAcoes.pl)} ({totaisAcoes.plPct >= 0 ? '+' : ''}{f1(totaisAcoes.plPct)}%)
                        </strong></span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Barra de ordenação mobile — substitui o clique no header da tabela */}
          {!loading && !erro && abaCarteira === 'acoes' && (
            <div className="sort-bar-mobile">
              {[
                { key: 'ticker',    label: 'Ticker' },
                { key: 'qtde',      label: 'Qtde' },
                { key: 'pAtual',    label: 'P.Atual' },
                { key: 'resPct',    label: 'Res.%' },
                { key: 'valorAtu',  label: 'Valor Atu.' },
                { key: 'nota',      label: 'Nota' },
                { key: 'pesoAtual', label: 'Peso Atual' },
                { key: 'pesoSug',   label: 'Peso Sug.' },
              ].map(s => (
                <button key={s.key} className={`sort-chip${sortConfig?.key === s.key ? ' ativo' : ''}`} onClick={() => toggleSort(s.key)}>
                  {s.label}{sortConfig?.key === s.key ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
          )}

          {/* Versão mobile — cards empilhados, mesma fonte de dados da tabela */}
          {!loading && !erro && abaCarteira === 'acoes' && (
            <div className="cards-mobile">
              {posicoes.length === 0
                ? <div style={{ padding: '30px', textAlign: 'center', color: '#6b84a8', fontSize: '13px' }}>
                    Nenhuma posição na carteira.<br/>
                    <span style={{ fontSize: '12px' }}>Toque em &quot;+ Posição&quot; para adicionar.</span>
                  </div>
                : sortedPosicoes.map(p => {
                    const totalCart = metricas.atual || 1
                    const pAtual    = p.preco_atual ?? p.preco_medio
                    const valorAtu  = pAtual * p.quantidade
                    const pesoAtual = (valorAtu / totalCart) * 100
                    const pesoSug   = metricas.pesoSug(p.ticker, p.nota ?? null)
                    return (
                      <PosicaoCardMobile
                        key={p.id}
                        p={p}
                        pesoAtual={pesoAtual}
                        pesoSug={pesoSug}
                        selecionado={selecionado === p.id}
                        onSelecionar={() => setSelecionado(p.id === selecionado ? null : p.id)}
                        onEditar={() => { setEditando(p); setModal('edit') }}
                        onToggleCalculo={async () => {
                          await fetch(`/api/carteira/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ excluir_calculo: !p.excluir_calculo }) })
                          carregarCarteira()
                        }}
                      />
                    )
                  })
              }
            </div>
          )}

          {/* ── Aba Importações ─────────────────────────────────────────────── */}
          {abaCarteira === 'importacoes' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div>
                  <h3 style={{ color:'#e8edf5', fontSize:14, fontWeight:700, margin:0 }}>Histórico de importações</h3>
                  {statsMovs && (
                    <p style={{ color: statsMovs.total_movs > 0 ? '#e8a020' : '#22c55e', fontSize:11, margin:'4px 0 0' }}>
                      {statsMovs.total_movs} movimentação(ões) no banco · {statsMovs.lotes_ativos} lote(s) ativo(s)
                    </p>
                  )}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {(statsMovs?.total_movs ?? 0) > 0 && (
                    <button onClick={limparTodasMovimentacoes} disabled={limpandoMovs}
                      style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.35)', color:'#ef4444', padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600 }}>
                      {limpandoMovs ? '…' : '🗑 Limpar Tudo'}
                    </button>
                  )}
                  <button onClick={carregarImportacoes} style={{ background:'#0e1d33', border:'1px solid rgba(255,255,255,.12)', color:'#6b84a8', padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
                    ↺ Atualizar
                  </button>
                </div>
              </div>
              {loadingImportacoes
                ? <p style={{ color:'#6b84a8', fontSize:13 }}>Carregando…</p>
                : importacoes.length === 0
                  ? <p style={{ color:'#6b84a8', fontSize:13 }}>Nenhuma importação registrada ainda.</p>
                  : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ color:'#4a5d73', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                            {['Data', 'Descrição', 'Ops', 'Período', 'Status', ''].map(h => (
                              <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontWeight:600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importacoes.map(b => (
                            <tr key={b.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', opacity: b.revertido ? 0.45 : 1 }}>
                              <td style={{ padding:'7px 10px', color:'#8da3bc', whiteSpace:'nowrap' }}>
                                {new Date(b.importado_em).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' })}
                              </td>
                              <td style={{ padding:'7px 10px', color:'#c8d8e8', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {b.descricao ?? '—'}
                              </td>
                              <td style={{ padding:'7px 10px', color:'#e8a020', fontWeight:700 }}>{b.total_ops}</td>
                              <td style={{ padding:'7px 10px', color:'#8da3bc', whiteSpace:'nowrap' }}>
                                {b.data_inicio && b.data_fim
                                  ? `${b.data_inicio} → ${b.data_fim}`
                                  : '—'}
                              </td>
                              <td style={{ padding:'7px 10px' }}>
                                {b.revertido
                                  ? <span style={{ color:'#ef4444', fontSize:11 }}>Revertido</span>
                                  : <span style={{ color:'#22c55e', fontSize:11 }}>Ativo</span>}
                              </td>
                              <td style={{ padding:'7px 10px' }}>
                                {!b.revertido && (
                                  <button
                                    onClick={() => desfazerImport(b.id)}
                                    disabled={revertendoBatch === b.id}
                                    style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.3)', color:'#ef4444', padding:'3px 10px', borderRadius:5, fontSize:11, cursor:'pointer', fontWeight:600 }}>
                                    {revertendoBatch === b.id ? '…' : 'Desfazer'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
            </div>
          )}

          {/* ── Aba Posição Base ─────────────────────────────────────────────── */}
          {abaCarteira === 'base' && (
            <div style={{ flex:1, overflowY:'auto', padding:'20px', maxWidth:820 }}>
              <p style={{ color:'#6b84a8', fontSize:12, marginBottom:18 }}>
                Define o ponto de partida da carteira. As importações posteriores à data base serão aplicadas sobre esses saldos.
                Ideal para iniciar o controle a partir de 31/12 de um ano, carregando saldos e preços médios do período anterior.
              </p>
              {loadingBase ? <p style={{ color:'#6b84a8', fontSize:13 }}>Carregando…</p> : (
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                  {/* Data base */}
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#6b84a8', display:'block', marginBottom:6 }}>Data Base</label>
                    <input type="date" value={baseData} onChange={e => setBaseData(e.target.value)}
                      style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.12)', borderRadius:7, padding:'8px 12px', color:'#e8edf5', fontSize:13, outline:'none' }} />
                  </div>

                  {/* Tabela de posições base */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#6b84a8' }}>
                        Posições na data base
                        {baseItens.length > 0 && <span style={{ color:'#e8a020', marginLeft:6 }}>({baseItens.length} ativos)</span>}
                      </label>
                      <div style={{ display:'flex', gap:8 }}>
                        <label style={{ background:'#0e2a4a', border:'1px solid rgba(255,255,255,.12)', color:'#90CAF9', padding:'4px 14px', borderRadius:6, fontSize:11, cursor: importandoBase ? 'wait' : 'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                          {importandoBase ? '⏳ Lendo…' : '📂 Importar Planilha'}
                          <input type="file" accept=".xlsx,.xls" onChange={handleImportarBase} style={{ display:'none' }} disabled={importandoBase} />
                        </label>
                        <button onClick={() => setBaseItens(p => [...p, { ticker:'', quantidade:0, preco_medio:0, cnpj:'' }])}
                          style={{ background:'#0e2a4a', border:'1px solid rgba(255,255,255,.12)', color:'#90CAF9', padding:'4px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:600 }}>
                          + Ativo
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize:11, color:'#4a5d73', marginBottom:8 }}>
                      Colunas esperadas na planilha: <strong style={{ color:'#6b84a8' }}>Ativo · CNPJ · Qtd · Preço médio</strong> — o CNPJ é usado na declaração de IR.
                    </p>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ color:'#4a5d73', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                            {['Ticker', 'CNPJ', 'Quantidade', 'Preço Médio (R$)', 'L/T', ''].map(h => (
                              <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {baseItens.map((item, i) => {
                            const ehOpcao   = isOpcaoTicker(item.ticker)
                            const lancador  = item.quantidade < 0
                            const qtdAbs    = Math.abs(item.quantidade)
                            const toggleLT  = () => setBaseItens(p => p.map((x,j) => j===i
                              ? { ...x, quantidade: -x.quantidade, direcao: x.quantidade < 0 ? 'titular' : 'lancador' }
                              : x))
                            return (
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                              <td style={{ padding:'4px 6px' }}>
                                <input value={item.ticker} onChange={e => setBaseItens(p => p.map((x,j) => j===i ? {...x, ticker:e.target.value.toUpperCase()} : x))}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color: ehOpcao ? '#e8a020' : '#e8edf5', fontSize:12, width:90, outline:'none', fontWeight: ehOpcao ? 700 : 400 }}
                                  placeholder="PETR4" />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input value={item.cnpj ?? ''} onChange={e => setBaseItens(p => p.map((x,j) => j===i ? {...x, cnpj:e.target.value} : x))}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color: item.cnpj ? '#e8edf5' : '#4a5d73', fontSize:12, width:150, outline:'none' }}
                                  placeholder="00.000.000/0001-00" />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input type="number" min="1" value={qtdAbs || ''} onChange={e => {
                                  const v = parseFloat(e.target.value) || 0
                                  setBaseItens(p => p.map((x,j) => j===i ? {...x, quantidade: lancador ? -v : v} : x))
                                }}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color:'#e8edf5', fontSize:12, width:80, outline:'none' }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input type="number" min="0.01" step="0.01" value={item.preco_medio || ''} onChange={e => setBaseItens(p => p.map((x,j) => j===i ? {...x, preco_medio:parseFloat(e.target.value)||0} : x))}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color:'#e8edf5', fontSize:12, width:100, outline:'none' }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                {ehOpcao ? (
                                  <button onClick={toggleLT} title="Clique para alternar Lançador ↔ Titular"
                                    style={{ background: lancador ? 'rgba(255,183,77,.12)' : 'rgba(100,181,246,.12)', border: `1px solid ${lancador ? 'rgba(255,183,77,.4)' : 'rgba(100,181,246,.4)'}`, color: lancador ? '#ffb74d' : '#64b5f6', padding:'3px 10px', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                    {lancador ? 'Lançador ⇄' : 'Titular ⇄'}
                                  </button>
                                ) : (
                                  <span style={{ color:'#2a3a4a', fontSize:11 }}>—</span>
                                )}
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <button onClick={() => setBaseItens(p => p.filter((_,j) => j!==i))}
                                  style={{ background:'rgba(239,68,68,.1)', border:'none', color:'#ef4444', padding:'3px 8px', borderRadius:4, fontSize:11, cursor:'pointer' }}>✕</button>
                              </td>
                            </tr>
                            )
                          })}
                          {baseItens.length === 0 && (
                            <tr><td colSpan={6} style={{ padding:'14px 8px', color:'#4a5d73', fontSize:12 }}>Nenhum ativo — importe a planilha ou clique em &quot;+ Ativo&quot;.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <button onClick={salvarBase} disabled={salvandoBase}
                      style={{ background: salvandoBase ? '#2a2a2a' : '#e8a020', color: salvandoBase ? '#555' : '#000',
                        padding:'9px 24px', borderRadius:7, fontSize:13, fontWeight:700, border:'none', cursor: salvandoBase ? 'not-allowed' : 'pointer' }}>
                      {salvandoBase ? 'Salvando…' : '💾 Salvar Posição Base'}
                    </button>
                    <p style={{ color:'#6b84a8', fontSize:11, marginTop:8 }}>
                      Ao salvar, a carteira será reconstruída automaticamente: saldos base + todas as importações posteriores a {baseData || '…'}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Aba Performance ──────────────────────────────────────────────── */}
          {abaCarteira === 'performance' && (() => {
            const stCard2 = { background:'#0d1a2e', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'16px 18px' }
            const stBtn2 = (active: boolean) => ({
              background: active ? '#0e2a4a' : '#081120',
              border: `1px solid ${active ? '#3b5ea6' : 'rgba(255,255,255,.08)'}`,
              color: active ? '#90CAF9' : '#4a5d73',
              borderRadius:6, padding:'5px 13px', fontSize:12, cursor:'pointer', fontWeight: active ? 700 : 400,
            })
            const fBRL2 = (v: number) => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2 })
            const fPct  = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%'

            // unrealized PL das posições atuais, filtrado por tipo
            const posComTipo = posicoesAcoes.filter(p => perfTipos.has(tipoAtivo(p.ticker)))
            const naoRealizado = posComTipo.reduce((s, p) => {
              const pa = p.preco_atual ?? p.preco_medio
              return s + (pa - p.preco_medio) * p.quantidade
            }, 0)
            const custoAtual = posComTipo.reduce((s, p) => s + p.preco_medio * p.quantidade, 0)
            const naoRealizadoPct = custoAtual > 0 ? (naoRealizado / custoAtual) * 100 : 0

            // realized filtrado por tipo
            const realizadoFiltrado = perfData
              ? perfData.realizado.por_ticker.filter(t => perfTipos.has(t.tipo))
              : []
            const totalRealizado = realizadoFiltrado.reduce((s, t) => s + t.pl, 0)
            const volCompras = perfData?.operacoes.vol_compras ?? 0
            const volVendas  = perfData?.operacoes.vol_vendas  ?? 0
            const totalOps   = (perfData?.operacoes.n_compras ?? 0) + (perfData?.operacoes.n_vendas ?? 0)
            const totalGeral = totalRealizado + naoRealizado

            const TIPO_LABEL: Record<string, string> = { acao:'Ação', fii_etf:'FII/ETF', bdr:'BDR', opcao:'Opção' }

            return (
              <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>

                {/* Filtros de período */}
                <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#4a5d73', minWidth:60 }}>Período:</span>
                  {([['mes','Este mês'],['3m','3M'],['6m','6M'],['ytd','YTD'],['12m','12M']] as [string,string][]).map(([k,l]) => (
                    <button key={k} onClick={() => aplicarPeriodo(k)} style={stBtn2(perfPeriodo === k)}>{l}</button>
                  ))}
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginLeft:4 }}>
                    <input type="date" value={perfDe} onChange={e => { setPerfDe(e.target.value); setPerfPeriodo('custom') }}
                      style={{ background:'#081120', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, padding:'4px 8px', color:'#e8edf5', fontSize:12, outline:'none' }} />
                    <span style={{ color:'#4a5d73', fontSize:12 }}>→</span>
                    <input type="date" value={perfAte} onChange={e => { setPerfAte(e.target.value); setPerfPeriodo('custom') }}
                      style={{ background:'#081120', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, padding:'4px 8px', color:'#e8edf5', fontSize:12, outline:'none' }} />
                    <button onClick={buscarPerformance} disabled={perfLoading}
                      style={{ background:'#1a3a6e', border:'1px solid #3b5ea6', color:'#90CAF9', borderRadius:6, padding:'5px 14px', fontSize:12, cursor:'pointer', fontWeight:700, opacity: perfLoading ? .6 : 1 }}>
                      {perfLoading ? '⏳' : '🔍 Buscar'}
                    </button>
                  </div>
                </div>

                {/* Filtros de tipo */}
                <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'#4a5d73', minWidth:60 }}>Tipo:</span>
                  {([['acao','📈 Ações'],['fii_etf','🏢 FIIs/ETFs'],['bdr','🌎 BDRs'],['opcao','🎯 Opções']] as [string,string][]).map(([k,l]) => (
                    <button key={k} onClick={() => toggleTipoPerfil(k)} style={stBtn2(perfTipos.has(k))}>
                      {perfTipos.has(k) ? '✓ ' : ''}{l}
                    </button>
                  ))}
                </div>

                {/* ── Conteúdo principal ── */}
                {perfLoading ? (
                  <div style={{ textAlign:'center', color:'#4a5d73', padding:'40px 0', fontSize:13 }}>Carregando...</div>
                ) : perfData ? (
                  <>
                    {/* Hero — resultado realizado */}
                    <div style={{ background:'#0a1628', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, padding:'22px 24px 18px', marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'#4a5d73', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Resultado Realizado no Período</div>
                      <div style={{ display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap' }}>
                        <span className="perf-hero-value" style={{ color: totalRealizado >= 0 ? '#00d4a0' : '#ef4444' }}>
                          {fBRL2(totalRealizado)}
                        </span>
                        {volVendas > 0 && (
                          <span className="perf-hero-pct" style={{ color: totalRealizado >= 0 ? '#00d4a0' : '#ef4444' }}>
                            {fPct((totalRealizado / volVendas) * 100)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'#4a5d73', marginTop:6 }}>
                        {realizadoFiltrado.filter(t => t.n_ops > 0).length} ativos negociados · {perfData.operacoes.n_vendas} vendas
                      </div>

                      {/* Benchmarks */}
                      {(perfData.benchmark.cdi_pct != null || perfData.benchmark.ibov_pct != null) && (
                        <div className="perf-benchmarks">
                          {[
                            { key:'CDI',       val: perfData.benchmark.cdi_pct  },
                            { key:'IBOVESPA',  val: perfData.benchmark.ibov_pct },
                          ].filter(b => b.val != null).map(b => {
                            const portPct = volVendas > 0 ? (totalRealizado / volVendas) * 100 : null
                            const acima   = portPct != null ? portPct >= b.val! : null
                            return (
                              <div key={b.key} style={{ background:'rgba(255,255,255,.04)', borderRadius:8, padding:'8px 14px', minWidth:90 }}>
                                <div style={{ fontSize:9, color:'#4a5d73', textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>{b.key}</div>
                                <div style={{ fontSize:15, fontWeight:700, color: b.val! >= 0 ? '#00d4a0' : '#ef4444' }}>{fPct(b.val!)}</div>
                                {acima != null && (
                                  <div style={{ fontSize:10, color: acima ? '#00d4a0' : '#ef4444', marginTop:3 }}>
                                    {acima ? '▲ acima' : '▼ abaixo'}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Gráfico de barras mensal */}
                    {perfData.realizado.por_mes.length > 0 && (() => {
                      const meses  = perfData.realizado.por_mes
                      const maxAbs = Math.max(...meses.map(m => Math.abs(m.pl)), 1)
                      const BAR_H  = 76
                      const BAR_W  = Math.max(24, Math.min(52, Math.floor(500 / meses.length)))
                      const GAP    = 5
                      const W      = meses.length * (BAR_W + GAP)
                      const MES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
                      return (
                        <div style={{ background:'#0a1628', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, padding:'18px 20px 12px', marginBottom:12, overflowX:'auto' }}>
                          <div style={{ fontSize:10, color:'#4a5d73', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>P&L Mensal</div>
                          <svg width={Math.max(W, 280)} height={BAR_H + 30} style={{ overflow:'visible', display:'block', minWidth: Math.max(W, 280) }}>
                            <line x1={0} y1={BAR_H / 2} x2={Math.max(W, 280)} y2={BAR_H / 2} stroke="rgba(255,255,255,.06)" strokeWidth={1} />
                            {meses.map((m, i) => {
                              const x = i * (BAR_W + GAP)
                              const h = Math.max(2, (Math.abs(m.pl) / maxAbs) * (BAR_H / 2 - 4))
                              const y = m.pl >= 0 ? BAR_H / 2 - h : BAR_H / 2
                              const fill = m.pl >= 0 ? '#00d4a0' : '#ef4444'
                              const label = MES_LABELS[parseInt(m.mes.split('-')[1]) - 1]
                              return (
                                <g key={m.mes}>
                                  <rect x={x} y={y} width={BAR_W} height={h} fill={fill} opacity={.82} rx={2} />
                                  <text x={x + BAR_W / 2} y={BAR_H + 18} textAnchor="middle" fontSize={9} fill="#4a5d73">{label}</text>
                                  {m.pl !== 0 && (
                                    <text x={x + BAR_W / 2} y={m.pl >= 0 ? y - 3 : y + h + 11}
                                      textAnchor="middle" fontSize={8} fill={fill}>
                                      {(m.pl >= 0 ? '+' : '') + (m.pl / 1000).toFixed(1) + 'k'}
                                    </text>
                                  )}
                                </g>
                              )
                            })}
                          </svg>
                        </div>
                      )
                    })()}

                    {/* Stats chips */}
                    <div className="perf-stats">
                      {([
                        { label:'Vol. Comprado', val:fBRL2(volCompras), sub:`${perfData.operacoes.n_compras} compras` },
                        { label:'Vol. Vendido',  val:fBRL2(volVendas),  sub:`${perfData.operacoes.n_vendas} vendas` },
                        { label:'Operações',     val:String(totalOps),  sub:'no período' },
                      ] as {label:string;val:string;sub:string}[]).map(c => (
                        <div key={c.label} className="perf-stats-card">
                          <div style={{ fontSize:10, color:'#4a5d73', marginBottom:3 }}>{c.label}</div>
                          <div style={{ fontSize:15, fontWeight:700, color:'#e8edf5' }}>{c.val}</div>
                          <div style={{ fontSize:10, color:'#4a5d73', marginTop:2 }}>{c.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Resultado latente */}
                    <div style={{ background:'#0a1628', border:'1px solid rgba(255,255,255,.06)', borderRadius:8, padding:'13px 18px', marginBottom:14 }}>
                      <div className="perf-latente">
                        <div>
                          <div style={{ fontSize:10, color:'#4a5d73', marginBottom:4, textTransform:'uppercase', letterSpacing:.5 }}>Carteira em Aberto — Resultado Latente</div>
                          <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                            <span className="perf-latente-val" style={{ color: naoRealizado >= 0 ? '#00d4a0' : '#ef4444' }}>{fBRL2(naoRealizado)}</span>
                            <span className="perf-latente-pct" style={{ color: naoRealizadoPct >= 0 ? '#00d4a0' : '#ef4444' }}>{fPct(naoRealizadoPct)}</span>
                          </div>
                        </div>
                        <div style={{ fontSize:11, color:'#4a5d73' }}>{posComTipo.length} posições abertas</div>
                      </div>
                    </div>

                    {/* Detalhar por ativo */}
                    <button onClick={() => setPerfDetalhes(v => !v)}
                      className="perf-btn-detail"
                      style={{ marginBottom: perfDetalhes ? 10 : 0 }}>
                      <span>📋 Detalhar por ativo</span>
                      <span style={{ fontSize:10 }}>{perfDetalhes ? '▲' : '▼'}</span>
                    </button>

                    {perfDetalhes && (
                      <>
                        {realizadoFiltrado.length > 0 && (
                          <div style={{ background:'#0a1628', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#eab838', marginBottom:10 }}>Realizados no período</div>
                            <div style={{ overflowX:'auto' }}>
                              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                                <thead>
                                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)', color:'#4a5d73' }}>
                                    {['Ticker','Tipo','P&L','Ops'].map(h => <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontWeight:600 }}>{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {realizadoFiltrado.map(t => (
                                    <tr key={t.ticker} style={{ borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                                      <td style={{ padding:'7px 10px', fontWeight:700, color:'#e8edf5' }}>{t.ticker}</td>
                                      <td style={{ padding:'7px 10px' }}><span style={{ fontSize:10, background:'rgba(255,255,255,.06)', borderRadius:4, padding:'2px 6px', color:'#6b84a8' }}>{TIPO_LABEL[t.tipo] ?? t.tipo}</span></td>
                                      <td style={{ padding:'7px 10px', fontWeight:700, color: t.pl >= 0 ? '#00d4a0' : '#ef4444' }}>{fBRL2(t.pl)}</td>
                                      <td style={{ padding:'7px 10px', color:'#4a5d73' }}>{t.n_ops}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {posComTipo.length > 0 && (
                          <div style={{ background:'#0a1628', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:'14px 16px' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#eab838', marginBottom:10 }}>Posição atual por ativo</div>
                            <div style={{ overflowX:'auto' }}>
                              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                                <thead>
                                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,.06)', color:'#4a5d73' }}>
                                    {['Ticker','Tipo','Qtde','P.Médio','P.Atual','Res. Total','%'].map(h => <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontWeight:600 }}>{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {posComTipo.map(p => {
                                    const pa  = p.preco_atual ?? p.preco_medio
                                    const ru  = pa - p.preco_medio
                                    const rt  = ru * p.quantidade
                                    const pct = p.preco_medio > 0 ? (ru / p.preco_medio) * 100 : 0
                                    const tipo = tipoAtivo(p.ticker)
                                    return (
                                      <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,.03)' }}>
                                        <td style={{ padding:'7px 10px', fontWeight:700, color:'#e8edf5' }}>{p.ticker}</td>
                                        <td style={{ padding:'7px 10px' }}><span style={{ fontSize:10, background:'rgba(255,255,255,.06)', borderRadius:4, padding:'2px 6px', color:'#6b84a8' }}>{TIPO_LABEL[tipo]}</span></td>
                                        <td style={{ padding:'7px 10px', color:'#6b84a8' }}>{p.quantidade}</td>
                                        <td style={{ padding:'7px 10px', color:'#6b84a8' }}>{fBRL2(p.preco_medio)}</td>
                                        <td style={{ padding:'7px 10px', color:'#e8edf5' }}>{p.preco_atual != null ? fBRL2(p.preco_atual) : '—'}</td>
                                        <td style={{ padding:'7px 10px', fontWeight:700, color: corPL(rt) }}>{fBRL2(rt)}</td>
                                        <td style={{ padding:'7px 10px', fontWeight:600, color: corPL(pct) }}>{fPct(pct)}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign:'center', color:'#4a5d73', padding:'30px 0', fontSize:13 }}>
                    Selecione o período e clique em <b style={{ color:'#90CAF9' }}>Buscar</b> para carregar o desempenho.
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Modal: Concentração */}
      {showConcentracao && (() => {
        const ativas = posicoesAcoes.filter(p => !p.excluir_calculo)
        const total = ativas.reduce((s, p) => s + p.quantidade * (p.preco_atual ?? p.preco_medio), 0)

        // Peso por ativo
        const pesoAtivo: { ticker: string; nome: string; peso: number; critico: boolean }[] = ativas.map(p => {
          const val = p.quantidade * (p.preco_atual ?? p.preco_medio)
          const peso = total > 0 ? (val / total) * 100 : 0
          return { ticker: p.ticker, nome: p.nome ?? p.ticker, peso, critico: peso > 25 }
        }).sort((a, b) => b.peso - a.peso)

        // Peso por setor
        const setorMap: Record<string, number> = {}
        for (const p of ativas) {
          const s = p.setor ?? '—'
          const val = p.quantidade * (p.preco_atual ?? p.preco_medio)
          setorMap[s] = (setorMap[s] ?? 0) + (total > 0 ? (val / total) * 100 : 0)
        }
        const pesoSetor = Object.entries(setorMap)
          .map(([setor, peso]) => ({ setor, peso, critico: peso > 40 }))
          .sort((a, b) => b.peso - a.peso)

        const temCritico = pesoAtivo.some(x => x.critico) || pesoSetor.some(x => x.critico)

        const overlayStyle: React.CSSProperties = {
          position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }
        const boxStyle: React.CSSProperties = {
          background:'#0c1a2e', border:'1px solid rgba(255,255,255,.12)', borderRadius:12,
          width:'100%', maxWidth:620, maxHeight:'85vh', overflowY:'auto',
          padding:'24px 28px', position:'relative',
        }
        const rowStyle = (critico: boolean): React.CSSProperties => ({
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 12px', borderRadius:6, marginBottom:4,
          background: critico ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.04)',
          border: critico ? '1px solid rgba(239,68,68,.4)' : '1px solid transparent',
        })

        return (
          <div style={overlayStyle} onClick={() => setShowConcentracao(false)}>
            <div style={boxStyle} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowConcentracao(false)}
                style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'#6b84a8', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>

              <div style={{ fontSize:15, fontWeight:700, color:'#e8edf5', marginBottom:4 }}>🎯 Concentração da Carteira</div>
              <div style={{ fontSize:12, color:'#6b84a8', marginBottom:20 }}>
                {total > 0 ? `${ativas.length} ativo${ativas.length !== 1 ? 's' : ''} · total R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 })}` : 'Nenhum ativo com cotação'}
              </div>

              {/* Ativos */}
              <div style={{ fontSize:12, fontWeight:700, color:'#6b84a8', letterSpacing:1, marginBottom:8 }}>POR ATIVO</div>
              {pesoAtivo.length === 0 && <div style={{ color:'#6b84a8', fontSize:13, marginBottom:16 }}>Nenhum ativo na carteira.</div>}
              {pesoAtivo.map(x => (
                <div key={x.ticker} style={rowStyle(x.critico)}>
                  <span style={{ fontSize:13, color: x.critico ? '#ef4444' : '#e8edf5', fontWeight: x.critico ? 700 : 400 }}>
                    {x.critico && '⚠ '}{x.ticker}
                    <span style={{ color:'#6b84a8', fontWeight:400, marginLeft:6, fontSize:12 }}>{x.nome}</span>
                  </span>
                  <span style={{ fontSize:14, fontWeight:700, color: x.critico ? '#ef4444' : '#b8c4d4', minWidth:52, textAlign:'right' }}>
                    {x.peso.toFixed(1)}%
                  </span>
                </div>
              ))}

              {/* Setores */}
              <div style={{ fontSize:12, fontWeight:700, color:'#6b84a8', letterSpacing:1, marginTop:20, marginBottom:8 }}>POR SETOR</div>
              {pesoSetor.map(x => (
                <div key={x.setor} style={rowStyle(x.critico)}>
                  <span style={{ fontSize:13, color: x.critico ? '#ef4444' : '#e8edf5', fontWeight: x.critico ? 700 : 400 }}>
                    {x.critico && '⚠ '}{x.setor}
                  </span>
                  <span style={{ fontSize:14, fontWeight:700, color: x.critico ? '#ef4444' : '#b8c4d4', minWidth:52, textAlign:'right' }}>
                    {x.peso.toFixed(1)}%
                  </span>
                </div>
              ))}

              {/* Legenda */}
              <div style={{ marginTop:20, padding:'10px 14px', background:'rgba(255,255,255,.03)', borderRadius:7, border:'1px solid rgba(255,255,255,.07)' }}>
                <div style={{ fontSize:11, color:'#6b84a8', lineHeight:1.7 }}>
                  <span style={{ color:'#ef4444', fontWeight:700 }}>Crítico</span>: ativo &gt; 25% · setor &gt; 40%<br/>
                  {temCritico
                    ? <span style={{ color:'#ef4444' }}>Carteira com concentração crítica — revise a alocação</span>
                    : <span style={{ color:'#22c55e' }}>Nenhum alerta crítico no momento</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAIS */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? '+ Nova Posição' : `✏ Editar — ${editando?.ticker}`}
               onClose={() => { setModal(null); setEditando(null) }}>
          <FormPosicao
            posicao={editando ?? undefined}
            onSave={carregarCarteira}
            onClose={() => { setModal(null); setEditando(null) }}
          />
        </Modal>
      )}
      {opsTicker && <ModalOps ticker={opsTicker} onClose={() => setOpsTicker(null)} />}

      {/* Modal: importar nota(s) de corretagem — múltiplos arquivos */}
      {importModal && (() => {
        const totalOps = importOpsAll.length
        const totalSel = importOpsAll.filter(o => o.selecionada).length
        const temDados  = !importando && totalOps > 0
        const iStyle = {
          background:'#081120', border:'1px solid rgba(255,255,255,.12)',
          borderRadius:'5px', color:'#e8edf5', padding:'4px 6px',
          fontSize:'12px', outline:'none',
        }
        const updOp = (idx: number, field: string, val: string | number | boolean) =>
          setImportOpsAll(prev => prev.map((o, j) => j === idx ? { ...o, [field]: val } : o))

        return (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:300,
            display:'flex',alignItems:'center',justifyContent:'center',padding:'16px' }}>
            <div style={{ background:'#0d1a2e',border:'1px solid rgba(232,160,32,.25)',borderRadius:'16px',
              width:'100%',maxWidth:'860px',maxHeight:'92vh',display:'flex',flexDirection:'column' }}>

              {/* ── Header ── */}
              <div style={{ padding:'16px 22px',borderBottom:'1px solid rgba(255,255,255,.08)',
                display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>
                    📄 Importar Nota(s) de Corretagem
                  </div>
                  {temDados && (
                    <div style={{ fontSize:'11px',color:'#6b84a8',marginTop:'3px' }}>
                      {importNotas.length} nota(s) · {totalOps} operação(ões) detectada(s)
                      {importNotas.length > 0 && ' — ' + importNotas.map(n =>
                        `${n.corretora ?? '?'} ${n.data ? n.data.slice(5).replace('-','/') : ''}`
                      ).join(' | ')}
                    </div>
                  )}
                </div>
                <button onClick={_fecharImport}
                  style={{ background:'none',border:'none',color:'#6b84a8',fontSize:'22px',cursor:'pointer',lineHeight:1 }}>×</button>
              </div>

              {/* ── Corpo ── */}
              <div style={{ overflowY:'auto',padding:'16px 22px',flex:1 }}>

                {/* Carregando */}
                {importando && (
                  <div style={{ textAlign:'center',padding:'48px 0' }}>
                    <div style={{ fontSize:'28px',marginBottom:'10px',animation:'spin 1s linear infinite' }}>⟳</div>
                    <div style={{ color:'#6b84a8',fontSize:'14px' }}>{importProgress || 'Lendo nota com IA…'}</div>
                    <div style={{ color:'#455a64',fontSize:'12px',marginTop:'6px' }}>Pode levar alguns segundos por arquivo.</div>
                  </div>
                )}

                {/* Erros parciais */}
                {importErro && (
                  <div style={{ background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.25)',
                    borderRadius:'8px',padding:'12px 14px',color:'#fca5a5',fontSize:'13px',
                    marginBottom:'12px',whiteSpace:'pre-line' }}>
                    ⚠ {importErro}
                  </div>
                )}

                {/* Tabela de operações com checkboxes */}
                {temDados && (
                  <>
                    <div style={{ fontSize:'12px',color:'#6b84a8',marginBottom:'8px' }}>
                      Desmarque as operações que <strong>não</strong> deseja importar. Todos os campos são editáveis.
                    </div>

                    {/* Ações em lote */}
                    <div style={{ display:'flex',gap:'8px',marginBottom:'10px' }}>
                      <button onClick={() => setImportOpsAll(p => p.map(o => ({ ...o, selecionada:true })))}
                        style={{ background:'#1a3a5c',color:'#90CAF9',border:'none',borderRadius:'6px',
                          padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600 }}>
                        ✔ Marcar todos
                      </button>
                      <button onClick={() => setImportOpsAll(p => p.map(o => ({ ...o, selecionada:false })))}
                        style={{ background:'#1c1c1c',color:'#6b84a8',border:'1px solid rgba(255,255,255,.1)',
                          borderRadius:'6px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600 }}>
                        ✘ Desmarcar todos
                      </button>
                      <span style={{ marginLeft:'auto',fontSize:'12px',color:'#6b84a8',alignSelf:'center' }}>
                        {totalSel} de {totalOps} selecionada(s)
                      </span>
                    </div>

                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:'700px' }}>
                        <thead>
                          <tr style={{ background:'#081120' }}>
                            {['','NOTA','Tipo','Ticker','Qtde','Preço Unit.','Total','Data','Posição'].map(h => (
                              <th key={h} style={{ padding:'7px 8px',textAlign:'left',color:'#6b84a8',
                                fontWeight:700,fontSize:'10px',letterSpacing:'.5px',
                                textTransform:'uppercase',whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importOpsAll.map((op, i) => {
                            const nota = importNotas[op.notaIdx]
                            // B3: cada op já tem corretora em op.notas → mostra resumido
                            // Notas PDF: mostra corretora/data da nota de origem
                            const notaLabel = op.notas
                              ? op.notas.replace('B3 — ', '').slice(0, 24)
                              : nota
                                ? `${nota.corretora ?? '?'} ${nota.data ? nota.data.slice(5).replace('-','/') : ''}`
                                : `Nota ${op.notaIdx + 1}`
                            const rowBg = op.selecionada ? 'transparent' : 'rgba(0,0,0,.3)'
                            const rowOpacity = op.selecionada ? 1 : 0.4
                            return (
                              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)',
                                background:rowBg,opacity:rowOpacity,transition:'opacity .15s' }}>
                                {/* Checkbox */}
                                <td style={{ padding:'5px 8px',textAlign:'center',width:'32px' }}>
                                  <input type="checkbox" checked={op.selecionada}
                                    onChange={e => updOp(i, 'selecionada', e.target.checked)}
                                    style={{ width:'15px',height:'15px',cursor:'pointer',accentColor:'#e8a020' }} />
                                </td>
                                {/* Nota de origem */}
                                <td style={{ padding:'5px 8px',color:'#546E7A',fontSize:'11px',whiteSpace:'nowrap' }}>
                                  {notaLabel}
                                </td>
                                {/* Tipo */}
                                <td style={{ padding:'5px 6px' }}>
                                  <select value={op.tipo} onChange={e => updOp(i,'tipo',e.target.value)}
                                    style={{ ...iStyle,width:'80px',
                                      color: op.tipo==='C' ? '#A5D6A7' : '#EF9A9A' }}>
                                    <option value="C">COMPRA</option>
                                    <option value="V">VENDA</option>
                                  </select>
                                </td>
                                {/* Ticker */}
                                <td style={{ padding:'5px 6px' }}>
                                  <input value={op.ticker}
                                    onChange={e => updOp(i,'ticker',e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                                    style={{ ...iStyle,width:'72px',fontWeight:700,color:'#e8a020' }}
                                    placeholder="PETR4" />
                                </td>
                                {/* Qtde */}
                                <td style={{ padding:'5px 6px' }}>
                                  <input type="number" value={op.quantidade} min="1"
                                    onChange={e => updOp(i,'quantidade',Number(e.target.value))}
                                    style={{ ...iStyle,width:'64px' }} />
                                </td>
                                {/* Preço */}
                                <td style={{ padding:'5px 6px' }}>
                                  <input type="number" value={op.preco} step="0.01" min="0"
                                    onChange={e => updOp(i,'preco',Number(e.target.value))}
                                    style={{ ...iStyle,width:'82px' }} />
                                </td>
                                {/* Total */}
                                <td style={{ padding:'5px 8px',color:'#e8a020',fontWeight:600,whiteSpace:'nowrap' }}>
                                  R$ {(op.preco * op.quantidade).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
                                </td>
                                {/* Data */}
                                <td style={{ padding:'5px 6px' }}>
                                  <input type="date" value={op.data}
                                    onChange={e => updOp(i,'data',e.target.value)}
                                    style={{ ...iStyle,width:'116px',colorScheme:'dark' }} />
                                </td>
                                {/* Posição — só para opções */}
                                <td style={{ padding:'5px 6px' }}>
                                  {op.mercado === 'opcao' ? (
                                    <button
                                      onClick={() => {
                                        const novaDir = op.direcao === 'lancador' ? 'titular' : 'lancador'
                                        setImportOpsAll(prev => prev.map((o,j) => j===i
                                          ? { ...o, direcao: novaDir, tipo: novaDir === 'lancador' ? 'V' : 'C' }
                                          : o))
                                      }}
                                      style={{
                                        background: op.direcao === 'lancador' ? 'rgba(255,183,77,.12)' : 'rgba(100,181,246,.12)',
                                        border: `1px solid ${op.direcao === 'lancador' ? 'rgba(255,183,77,.4)' : 'rgba(100,181,246,.4)'}`,
                                        color: op.direcao === 'lancador' ? '#ffb74d' : '#64b5f6',
                                        padding:'3px 9px', borderRadius:5, fontSize:11, fontWeight:700,
                                        cursor:'pointer', whiteSpace:'nowrap',
                                      }}>
                                      {op.direcao === 'lancador' ? 'Lançador ⇄' : 'Titular ⇄'}
                                    </button>
                                  ) : (
                                    <span style={{ color:'#2a3a4a', fontSize:11 }}>—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Sem operações após processar */}
                {!importando && totalOps === 0 && !importErro && (
                  <div style={{ textAlign:'center',padding:'40px',color:'#546E7A',fontSize:'14px' }}>
                    Nenhuma operação identificada nas notas.
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              {temDados && (
                <div style={{ padding:'14px 22px',borderTop:'1px solid rgba(255,255,255,.08)',
                  display:'flex',gap:'10px',justifyContent:'flex-end',alignItems:'center' }}>
                  <span style={{ fontSize:'12px',color:'#546E7A',marginRight:'auto' }}>
                    {totalSel === 0 && '⚠ Nenhuma operação selecionada'}
                    {totalSel > 0 && `${totalSel} operação(ões) serão importadas`}
                  </span>
                  <button onClick={_fecharImport}
                    style={{ background:'transparent',border:'1px solid rgba(255,255,255,.12)',color:'#6b84a8',
                      padding:'8px 18px',borderRadius:'7px',cursor:'pointer',fontSize:'13px',fontWeight:600 }}>
                    Cancelar
                  </button>
                  <button onClick={confirmarImport} disabled={salvandoImport || totalSel === 0}
                    style={{ background: totalSel > 0 ? '#e8a020' : '#2a2a2a',
                      color: totalSel > 0 ? '#000' : '#555',
                      padding:'8px 22px',borderRadius:'7px',fontSize:'13px',fontWeight:700,border:'none',
                      cursor: totalSel > 0 && !salvandoImport ? 'pointer' : 'not-allowed',
                      opacity: salvandoImport ? .6 : 1, transition:'all .15s' }}>
                    {salvandoImport ? 'Salvando…' : `✓ Importar ${totalSel} operação(ões)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal: limite plano gratuito */}
      {limiteModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }}
             onClick={() => setLimiteModal(false)}>
          <div onClick={e => e.stopPropagation()}
               style={{ background:'#0d1a2e',border:'1px solid rgba(232,160,32,.3)',borderRadius:'16px',padding:'40px 36px',maxWidth:'440px',textAlign:'center' }}>
            <div style={{ fontSize:'40px',marginBottom:'16px' }}>🔒</div>
            <h3 style={{ fontSize:'20px',fontWeight:700,color:'#e8edf5',marginBottom:'12px' }}>
              Limite do plano gratuito
            </h3>
            <p style={{ fontSize:'14px',color:'#6b84a8',lineHeight:1.7,marginBottom:'24px' }}>
              O plano <strong style={{ color:'#e8edf5' }}>Gratuito</strong> permite acompanhar <strong style={{ color:'#e8a020' }}>2 ações</strong> na carteira.<br />
              Faça upgrade para acompanhar portfólios ilimitados.
            </p>
            <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
              <a href="/planos"
                 style={{ background:'#e8a020',color:'#000',fontWeight:700,fontSize:'14px',padding:'12px 28px',borderRadius:'8px',textDecoration:'none',display:'block' }}>
                Ver planos e fazer upgrade
              </a>
              <button onClick={() => setLimiteModal(false)}
                      style={{ background:'transparent',border:'1px solid rgba(255,255,255,.12)',color:'#6b84a8',fontSize:'13px',padding:'10px 28px',borderRadius:'8px',cursor:'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
