'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import NavBar from '@/components/NavBar'
import fundamentaisRaw from '@/lib/fundamentais.json'

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
const fund = fundamentaisRaw as Record<string, any>
const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
const fR = (v: number | null | undefined) =>
  v == null ? '—' : 'R$ ' + f2(v)
const UA = 'Mozilla/5.0'

async function buscarPreco(ticker: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=2d`,
      { headers: { 'User-Agent': UA } }
    )
    const j = await r.json()
    return j.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
  } catch { return null }
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
      ticker:     ticker.toUpperCase(),
      quantidade: parseFloat(qtde.replace(',','.')),
      preco_medio: parseFloat(preco.replace(',','.')),
      data_compra: data || null,
      notas: notas || null,
    }
    if (!body.ticker || isNaN(body.quantidade) || isNaN(body.preco_medio)) {
      setErro('Ticker, quantidade e preço são obrigatórios.'); setSalvando(false); return
    }
    const url = isEdit ? `/api/carteira/${posicao!.id}` : '/api/carteira'
    const method = isEdit ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    if (!r.ok) { const d = await r.json(); setErro(d.error ?? 'Erro ao salvar'); setSalvando(false); return }
    onSave(); onClose()
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

  /* busca posições do banco */
  const carregarCarteira = useCallback(async () => {
    setLoading(true); setErro('')
    try {
      const r = await fetch('/api/carteira')
      const d = await r.json()
      const enriquecidas: Posicao[] = (d.carteira ?? []).map((p: Posicao) => ({
        ...p,
        nome:  fund[p.ticker]?.nome  ?? p.ticker,
        setor: fund[p.ticker]?.setor ?? '—',
        nota:  fund[p.ticker]?.nota  ?? null,
        preco_atual: null,
        variacao: null,
      }))
      setPosicoes(enriquecidas)
    } catch { setErro('Erro ao carregar carteira.') }
    finally  { setLoading(false) }
  }, [])

  /* busca cotações ao vivo */
  const atualizarCotacoes = useCallback(async () => {
    if (posicoes.length === 0) return
    setAtualizando(true)
    const tickers = posicoes.map(p => p.ticker)
    const resultados = await Promise.allSettled(tickers.map(t => buscarPreco(t)))
    setPosicoes(prev => prev.map((p, i) => {
      const r = resultados[i]
      const preco_atual = r.status === 'fulfilled' ? r.value : null
      const variacao = preco_atual && p.preco_medio
        ? ((preco_atual - p.preco_medio) / p.preco_medio) * 100
        : null
      return { ...p, preco_atual, variacao }
    }))
    setAtualizando(false)
  }, [posicoes])

  useEffect(() => { carregarCarteira() }, [carregarCarteira])

  /* busca cotações logo após carregar as posições */
  useEffect(() => {
    if (!loading && posicoes.length > 0 && posicoes.every(p => p.preco_atual === null))
      atualizarCotacoes()
  }, [loading, posicoes, atualizarCotacoes])

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

  const corPL = (v: number) => v > 0 ? '#00d4a0' : v < 0 ? '#ef4444' : '#e8edf5'

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

        {/* BOTÕES */}
        <div className="btn-bar">
          <button className="btn btn-add" onClick={() => { setEditando(null); setModal('add') }}>
            + Posição
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

          {!loading && !erro && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{textAlign:'left'}}>Ticker</th>
                    <th style={{textAlign:'left'}}>Nome</th>
                    <th>Qtde</th>
                    <th>P.Médio</th>
                    <th>P.Atual</th>
                    <th>Res.Un</th>
                    <th>Res.Total</th>
                    <th>Res.%</th>
                    <th>Valor Atu.</th>
                    <th>Nota ★</th>
                    <th>Peso Atual%</th>
                    <th>Peso Sug.%</th>
                    <th>No Cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {posicoes.length === 0
                    ? <tr><td colSpan={13} className="empty">Nenhuma posição na carteira.<br/><span style={{fontSize:'13px',color:'#6b84a8'}}>Clique em "+ Posição" para adicionar.</span></td></tr>
                    : posicoes.map(p => {
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
    </>
  )
}
