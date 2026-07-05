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

function infoOpcao(ticker: string): { vencimento: Date; isCall: boolean; ativo: string } | null {
  if (!isOpcaoTicker(ticker) || ticker.length < 5) return null
  const letra = ticker[4].toUpperCase()
  // Calls: A=Jan … L=Dez | Puts: M=Jan … X=Dez — vencimento: terceira SEXTA-FEIRA do mês (B3)
  let mes = 'ABCDEFGHIJKL'.indexOf(letra)
  let isCall = true
  if (mes === -1) { mes = 'MNOPQRSTUVWX'.indexOf(letra); isCall = false }
  if (mes === -1) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  function tercSex(ano: number, m: number) {
    const d = new Date(ano, m, 1); const dow = d.getDay()
    return new Date(ano, m, 1 + (5 - dow + 7) % 7 + 14)
  }
  let data = tercSex(hoje.getFullYear(), mes)
  if (data < hoje) data = tercSex(hoje.getFullYear() + 1, mes)
  return { vencimento: data, isCall, ativo: ticker.slice(0, 4) }
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
  const [qtde,      setQtde]      = useState(String(posicao?.quantidade  ?? ''))
  const [preco,     setPreco]     = useState(String(posicao?.preco_medio ?? ''))
  const [data,      setData]      = useState(posicao?.data_compra?.slice(0,10) ?? new Date().toISOString().slice(0,10))
  const [notas,     setNotas]     = useState(posicao?.notas ?? '')
  const [salvando,  setSalvando]  = useState(false)
  const [erro,      setErro]      = useState('')

  const isEdit = !!posicao?.id

  const salvar = async () => {
    setErro(''); setSalvando(true)
    const body = {
      ticker:      ticker.toUpperCase(),
      quantidade:  parseFloat(qtde.replace(',','.')),
      preco_medio: parseFloat(preco.replace(',','.')),
      data_compra: data || null,
      notas:       notas || null,
    }
    if (!body.ticker || isNaN(body.quantidade) || isNaN(body.preco_medio)) {
      setErro('Ticker, quantidade e preço são obrigatórios.'); setSalvando(false); return
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
          <input style={inp} placeholder="ex: PETR4" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} />
        </div>
      )}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px' }}>
        <div>
          <span style={lbl}>Quantidade *</span>
          <input style={inp} placeholder="100" type="number" min="0" value={qtde} onChange={e=>setQtde(e.target.value)} />
        </div>
        <div>
          <span style={lbl}>Preço Médio (R$) *</span>
          <input style={inp} placeholder="32,50" type="number" min="0" step="0.01" value={preco} onChange={e=>setPreco(e.target.value)} />
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

  /* multi-nota e B3: lista de fontes + operações achatadas */
  interface NotaInfo { corretora: string|null; data: string|null; arquivo: string }
  interface OpImport {
    tipo: string; ticker: string; quantidade: number; preco: number
    data: string; notaIdx: number; selecionada: boolean
    notas?: string; mercado?: string; vencimento?: string | null
  }
  const [importNotas,  setImportNotas]  = useState<NotaInfo[]>([])
  const [importOpsAll, setImportOpsAll] = useState<OpImport[]>([])
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [abaCarteira, setAbaCarteira] = useState<'acoes' | 'opcoes' | 'importacoes' | 'base'>('acoes')
  const [marcandoPo, setMarcandoPo] = useState<string | null>(null)
  const [msgPo, setMsgPo] = useState<string | null>(null)
  const [poVencidas, setPoVencidas] = useState<Set<string>>(new Set())
  const [togglingDirecao, setTogglingDirecao] = useState<number | null>(null)

  /* ── Importações (histórico de lotes) ──────────────────────────────────── */
  interface ImportBatch {
    id: string; importado_em: string; total_ops: number
    data_inicio: string | null; data_fim: string | null
    descricao: string | null; revertido: boolean; revertido_em: string | null
  }
  const [importacoes, setImportacoes] = useState<ImportBatch[]>([])
  const [loadingImportacoes, setLoadingImportacoes] = useState(false)
  const [revertendoBatch, setRevertendoBatch] = useState<string | null>(null)

  const carregarImportacoes = useCallback(async () => {
    setLoadingImportacoes(true)
    try {
      const r = await fetch('/api/carteira/importacoes')
      const d = await r.json()
      setImportacoes(d.importacoes ?? [])
    } catch { /* silencioso */ }
    finally { setLoadingImportacoes(false) }
  }, [])

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
  interface BaseItem { ticker: string; quantidade: number; preco_medio: number }
  const [baseData, setBaseData] = useState<string>(new Date().toISOString().slice(0, 10))
  const [baseItens, setBaseItens] = useState<BaseItem[]>([])
  const [basePrejSwing, setBasePrejSwing] = useState('0')
  const [basePrejDay, setBasePrejDay] = useState('0')
  const [salvandoBase, setSalvandoBase] = useState(false)
  const [loadingBase, setLoadingBase] = useState(false)

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
    try {
      const r = await fetch('/api/carteira/posicao-base', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_base: baseData,
          itens: baseItens.filter(i => i.ticker && i.quantidade > 0 && i.preco_medio > 0),
          prejuizo_swing: parseFloat(basePrejSwing.replace(',', '.')) || 0,
          prejuizo_day:   parseFloat(basePrejDay.replace(',', '.'))   || 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) { alert(d.error ?? 'Erro ao salvar.'); return }
      alert(`Posição base salva! ${d.total_itens} ativo(s). Carteira reconstruída a partir de ${baseData}.`)
      await carregarCarteira()
    } catch { alert('Erro de conexão.') }
    finally { setSalvandoBase(false) }
  }

  useEffect(() => {
    if (abaCarteira === 'importacoes') carregarImportacoes()
    if (abaCarteira === 'base') carregarBase()
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
      if (d.erros > 0) alert(`${d.erros} operação(ões) não foram salvas. Verifique e tente manualmente.`)
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
        (d.operacoes as any[]).map(op => ({ ...op, notaIdx: 0, selecionada: true }))
      )
    } catch { setImportErro('Erro de conexão. Tente novamente.') }
    finally { setImportProgress(''); setImportando(false); e.target.value = '' }
  }

  /* busca posições do banco */
  const carregarCarteira = useCallback(async () => {
    setLoading(true); setErro('')
    try {
      const r = await fetch('/api/carteira')
      const d = await r.json()
      const enriquecidas: Posicao[] = (d.carteira ?? []).map((p: Posicao) => ({
        ...p,
        nome:  fund[p.ticker]?.nome  ?? p.ticker,
        setor: setoresManuais[p.ticker] ?? fund[p.ticker]?.setor ?? '—',
        nota:  notaParaTicker(p.ticker, null),
        preco_atual: null,
        variacao: null,
      }))
      setPosicoes(enriquecidas)
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

    /* peso sugerido por nota (normalizado 0-10) */
    const somaNotas = ativas.reduce((s,p) => s+(p.nota ?? 5), 0)
    const pesoSug = (ticker: string, nota: number | null) => {
      const n = nota ?? 5
      return somaNotas > 0 ? (n / somaNotas) * 100 : 0
    }

    return { investido, atual: totalAtual, pl, plPct, posComPeso, pesoSug }
  }, [posicoes])

  const posicaoSel = posicoes.find(p => p.id === selecionado)

  /* Separa ações/FIIs de opções — deve vir ANTES de sortedPosicoes */
  const posicoesAcoes  = posicoes.filter(p => !isOpcaoTicker(p.ticker))
  const posicoesOpcoes = posicoes.filter(p =>  isOpcaoTicker(p.ticker) && !poVencidas.has(p.ticker))

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

  const corPL = (v: number) => v > 0 ? '#00d4a0' : v < 0 ? '#ef4444' : '#e8edf5'

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
    const info = infoOpcao(p.ticker)
    const dataVenc = info ? info.vencimento.toISOString().slice(0,10) : new Date().toISOString().slice(0,10)
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
        .btn{padding:7px 16px;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;border:none;transition:all .15s;display:flex;align-items:center;gap:5px}
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
          .btn-bar{height:auto;flex-wrap:wrap;padding:8px 12px;row-gap:6px}
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
        <div style={{ display:'flex', gap:0, background:'#081120', borderBottom:'1px solid rgba(255,255,255,.07)', paddingLeft:20 }}>
          {([
            { key:'acoes',       label:`📈 Ações / FIIs${posicoesAcoes.length ? ` (${posicoesAcoes.length})` : ''}` },
            { key:'opcoes',      label:`🎯 Opções${posicoesOpcoes.length ? ` (${posicoesOpcoes.length})` : ''}` },
            { key:'importacoes', label:'📥 Importações' },
            { key:'base',        label:'📌 Posição Base' },
          ] as { key: 'acoes'|'opcoes'|'importacoes'|'base'; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setAbaCarteira(t.key)} style={{
              background:'none', border:'none', borderBottom: abaCarteira===t.key ? '2px solid #e8a020' : '2px solid transparent',
              padding:'10px 18px', fontSize:13, fontWeight: abaCarteira===t.key ? 700 : 500,
              color: abaCarteira===t.key ? '#e8a020' : '#4a5d73', cursor:'pointer', transition:'all .15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* BOTÕES */}
        <div className="btn-bar">
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
        </div>

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
                  <div style={{ fontSize:12, color:'#4a5d73', marginBottom:14 }}>
                    Vencimento = terceira segunda-feira do mês (B3) · 🔴 vencida · 🟡 ≤5 dias
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:800 }}>
                      <thead>
                        <tr style={{ background:'#081120', borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                          {['Ticker','Ativo','Tipo','Posição','Qtde','Prêmio Médio','Custo Total','Vencimento','Dias','Ação'].map(h => (
                            <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'10.5px', fontWeight:700, letterSpacing:'.4px', textTransform:'uppercase', color:'#6b84a8', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {posicoesOpcoes.map(p => {
                          const info = infoOpcao(p.ticker)
                          if (!info) return null
                          const hoje = new Date(); hoje.setHours(0,0,0,0)
                          const dias = Math.round((info.vencimento.getTime() - hoje.getTime()) / 86400000)
                          const vencida = dias < 0
                          const urgente = dias >= 0 && dias <= 5
                          const titular = p.quantidade > 0
                          const rowBg   = vencida ? 'rgba(239,68,68,.07)' : urgente ? 'rgba(234,184,56,.05)' : 'transparent'
                          return (
                            <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', background:rowBg }}>
                              <td style={{ padding:'10px', fontWeight:800, color:'#e8a020', fontFamily:'monospace' }}>{p.ticker}</td>
                              <td style={{ padding:'10px', color:'#b8c4d4' }}>{info.ativo}</td>
                              <td style={{ padding:'10px' }}>
                                <span style={{ background: info.isCall ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', color: info.isCall ? '#22c55e' : '#ef4444', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700 }}>
                                  {info.isCall ? 'CALL' : 'PUT'}
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
                                {info.vencimento.toLocaleDateString('pt-BR')}
                              </td>
                              <td style={{ padding:'10px', textAlign:'center' }}>
                                {vencida
                                  ? <span style={{ color:'#ef4444', fontWeight:700, fontSize:12 }}>VENCIDA</span>
                                  : urgente
                                    ? <span style={{ color:'#eab838', fontWeight:700 }}>{dias}d ⚠</span>
                                    : <span style={{ color:'#4a5d73' }}>{dias}d</span>
                                }
                              </td>
                              <td style={{ padding:'10px' }}>
                                <button
                                  onClick={() => virouPo(p)}
                                  disabled={marcandoPo === p.ticker || poVencidas.has(p.ticker)}
                                  title={titular ? `Registrar perda de R$ ${f2(Math.abs(p.quantidade)*p.preco_medio)} no IR` : 'Encerrar lançamento — opção expirou sem exercício'}
                                  style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.35)', color:'#ef4444', borderRadius:5, cursor:'pointer', fontSize:11, fontWeight:700, padding:'5px 11px', whiteSpace:'nowrap', opacity: (marcandoPo===p.ticker || poVencidas.has(p.ticker)) ? .4 : 1 }}
                                >
                                  {marcandoPo===p.ticker ? '...' : poVencidas.has(p.ticker) ? '✓ Registrado' : '💀 Virou Pó'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop:16, display:'flex', gap:20, flexWrap:'wrap', fontSize:11, color:'#4a5d73' }}>
                    <span style={{ color:'#64b5f6' }}>■ Titular — comprou a opção (custo = prêmio pago)</span>
                    <span style={{ color:'#ffb74d' }}>■ Lançador — vendeu a opção (crédito = prêmio recebido)</span>
                    <span>Ao marcar "Virou Pó": titular registra prejuízo no IR; lançador encerra posição (ganho já foi registrado na abertura).</span>
                  </div>
                </>
              )}
            </div>
          )}

          {!loading && !erro && abaCarteira === 'acoes' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
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
                          <td>
                            {p.ticker}
                            {excl && <span className="excl-tag">EXCLUÍDO</span>}
                          </td>
                          <td title={p.nome}>{p.nome}</td>
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
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ color:'#e8edf5', fontSize:14, fontWeight:700, margin:0 }}>Histórico de importações</h3>
                <button onClick={carregarImportacoes} style={{ background:'#0e1d33', border:'1px solid rgba(255,255,255,.12)', color:'#6b84a8', padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
                  ↺ Atualizar
                </button>
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

                  {/* Prejuízo acumulado IR */}
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#6b84a8', display:'block', marginBottom:8 }}>Prejuízo Acumulado para IR (R$)</label>
                    <div style={{ display:'flex', gap:14 }}>
                      <div>
                        <label style={{ fontSize:11, color:'#4a5d73', display:'block', marginBottom:4 }}>Swing Trade</label>
                        <input type="number" min="0" step="0.01" value={basePrejSwing} onChange={e => setBasePrejSwing(e.target.value)}
                          style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.12)', borderRadius:7, padding:'7px 12px', color:'#e8edf5', fontSize:13, outline:'none', width:160 }} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:'#4a5d73', display:'block', marginBottom:4 }}>Day Trade</label>
                        <input type="number" min="0" step="0.01" value={basePrejDay} onChange={e => setBasePrejDay(e.target.value)}
                          style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.12)', borderRadius:7, padding:'7px 12px', color:'#e8edf5', fontSize:13, outline:'none', width:160 }} />
                      </div>
                    </div>
                  </div>

                  {/* Tabela de posições base */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#6b84a8' }}>Posições na data base</label>
                      <button onClick={() => setBaseItens(p => [...p, { ticker:'', quantidade:0, preco_medio:0 }])}
                        style={{ background:'#0e2a4a', border:'1px solid rgba(255,255,255,.12)', color:'#90CAF9', padding:'4px 12px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:600 }}>
                        + Ativo
                      </button>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ color:'#4a5d73', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                            {['Ticker', 'Quantidade', 'Preço Médio (R$)', ''].map(h => (
                              <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {baseItens.map((item, i) => (
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                              <td style={{ padding:'4px 6px' }}>
                                <input value={item.ticker} onChange={e => setBaseItens(p => p.map((x,j) => j===i ? {...x, ticker:e.target.value.toUpperCase()} : x))}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color:'#e8edf5', fontSize:12, width:90, outline:'none' }}
                                  placeholder="PETR4" />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input type="number" min="1" value={item.quantidade || ''} onChange={e => setBaseItens(p => p.map((x,j) => j===i ? {...x, quantidade:parseFloat(e.target.value)||0} : x))}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color:'#e8edf5', fontSize:12, width:90, outline:'none' }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <input type="number" min="0.01" step="0.01" value={item.preco_medio || ''} onChange={e => setBaseItens(p => p.map((x,j) => j===i ? {...x, preco_medio:parseFloat(e.target.value)||0} : x))}
                                  style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:'4px 8px', color:'#e8edf5', fontSize:12, width:100, outline:'none' }} />
                              </td>
                              <td style={{ padding:'4px 6px' }}>
                                <button onClick={() => setBaseItens(p => p.filter((_,j) => j!==i))}
                                  style={{ background:'rgba(239,68,68,.1)', border:'none', color:'#ef4444', padding:'3px 8px', borderRadius:4, fontSize:11, cursor:'pointer' }}>✕</button>
                              </td>
                            </tr>
                          ))}
                          {baseItens.length === 0 && (
                            <tr><td colSpan={4} style={{ padding:'14px 8px', color:'#4a5d73', fontSize:12 }}>Nenhum ativo — clique em &quot;+ Ativo&quot; para adicionar.</td></tr>
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
        </div>
      </div>

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
                            {['','NOTA','Tipo','Ticker','Qtde','Preço Unit.','Total','Data'].map(h => (
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
