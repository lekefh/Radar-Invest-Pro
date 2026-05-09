'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
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
const fund = fundamentaisRaw as unknown as Record<string, any>
const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
const fR = (v: number | null | undefined) =>
  v == null ? '—' : 'R$ ' + f2(v)
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
  const [importModal, setImportModal] = useState(false)
  const [importando,  setImportando]  = useState(false)
  const [importErro,  setImportErro]  = useState('')
  const [importPreview, setImportPreview] = useState<{
    corretora: string | null
    data: string | null
    operacoes: { tipo: string; ticker: string; quantidade: number; preco: number; data: string }[]
  } | null>(null)
  const [salvandoImport, setSalvandoImport] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setPlano(d.plano ?? 'gratuito'))
      .catch(() => {})
  }, [])

  const LIMITE_GRATUITO = 1
  const limiteAtingido = plano === 'gratuito' && posicoes.length >= LIMITE_GRATUITO

  const abrirAddPosicao = () => {
    if (limiteAtingido) { setLimiteModal(true); return }
    setEditando(null); setModal('add')
  }

  const handleImportarNota = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setImportErro('')
    setImportPreview(null)
    setImportModal(true)
    try {
      const fd = new FormData()
      fd.append('nota', file)
      const r = await fetch('/api/carteira/importar', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { setImportErro(d.error ?? 'Erro ao processar a nota.'); return }
      setImportPreview(d)
    } catch {
      setImportErro('Erro de conexão. Tente novamente.')
    } finally {
      setImportando(false)
      e.target.value = ''
    }
  }

  const confirmarImport = async () => {
    if (!importPreview) return
    setSalvandoImport(true)
    let erros = 0
    for (const op of importPreview.operacoes) {
      try {
        await fetch('/api/carteira', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker:      op.ticker,
            quantidade:  op.quantidade,
            preco_medio: op.preco,
            data_compra: op.data,
          }),
        })
      } catch { erros++ }
    }
    setSalvandoImport(false)
    setImportModal(false)
    setImportPreview(null)
    await carregarCarteira()
    if (erros > 0) alert(`${erros} operação(ões) não foram salvas. Verifique e adicione manualmente.`)
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
        setor: fund[p.ticker]?.setor ?? '—',
        nota:  fund[p.ticker]?.nota  ?? null,
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
      return { ...p, preco_atual: c?.preco ?? null, variacao: c?.variacao ?? null }
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
          <button className="btn btn-add" onClick={abrirAddPosicao}
            title={limiteAtingido ? 'Plano gratuito: máx. 1 ação. Faça upgrade para adicionar mais.' : ''}>
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
            title="Importar nota de corretagem (PDF ou imagem)">
            📄 Importar Nota
            <input type="file" accept=".pdf,image/*" style={{ display:'none' }}
              onChange={handleImportarNota} disabled={limiteAtingido} />
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

      {/* Modal: importar nota de corretagem */}
      {importModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }}>
          <div style={{ background:'#0d1a2e',border:'1px solid rgba(232,160,32,.25)',borderRadius:'16px',width:'100%',maxWidth:'600px',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'18px 24px',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>📄 Importar Nota de Corretagem</div>
                {importPreview?.corretora && (
                  <div style={{ fontSize:'12px',color:'#6b84a8',marginTop:'2px' }}>
                    {importPreview.corretora} · {importPreview.data}
                  </div>
                )}
              </div>
              <button onClick={() => { setImportModal(false); setImportPreview(null); setImportErro('') }}
                style={{ background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer' }}>×</button>
            </div>

            <div style={{ overflowY:'auto',padding:'20px 24px',flex:1 }}>
              {/* Carregando */}
              {importando && (
                <div style={{ textAlign:'center',padding:'40px 0' }}>
                  <div style={{ fontSize:'32px',marginBottom:'12px' }}>⟳</div>
                  <div style={{ color:'#6b84a8',fontSize:'14px' }}>Lendo a nota com IA… pode levar alguns segundos.</div>
                </div>
              )}

              {/* Erro */}
              {importErro && !importando && (
                <div style={{ background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:'8px',padding:'16px',color:'#fca5a5',fontSize:'14px' }}>
                  ⚠ {importErro}
                </div>
              )}

              {/* Preview das operações — campos editáveis */}
              {importPreview && !importando && (
                <>
                  <div style={{ fontSize:'13px',color:'#6b84a8',marginBottom:'12px' }}>
                    {importPreview.operacoes.length} operação(ões) identificada(s). Revise e corrija se necessário:
                  </div>
                  <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'13px' }}>
                    <thead>
                      <tr style={{ background:'#081120' }}>
                        {['Tipo','Ticker','Qtde','Preço Unit.','Total','Data'].map(h => (
                          <th key={h} style={{ padding:'8px 10px',textAlign:'left',color:'#6b84a8',fontWeight:700,fontSize:'11px',letterSpacing:'.5px',textTransform:'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.operacoes.map((op, i) => {
                        const upd = (field: string, val: string | number) =>
                          setImportPreview(prev => prev ? {
                            ...prev,
                            operacoes: prev.operacoes.map((o, j) =>
                              j === i ? { ...o, [field]: val } : o
                            )
                          } : prev)
                        const inputStyle = {
                          background:'#081120', border:'1px solid rgba(255,255,255,.12)',
                          borderRadius:'5px', color:'#e8edf5', padding:'4px 8px',
                          fontSize:'13px', width:'100%', outline:'none',
                        }
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                            {/* Tipo */}
                            <td style={{ padding:'6px 8px' }}>
                              <select value={op.tipo}
                                onChange={e => upd('tipo', e.target.value)}
                                style={{ ...inputStyle, width:'90px' }}>
                                <option value="C">COMPRA</option>
                                <option value="V">VENDA</option>
                              </select>
                            </td>
                            {/* Ticker — editável */}
                            <td style={{ padding:'6px 8px' }}>
                              <input
                                value={op.ticker}
                                onChange={e => upd('ticker', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                                style={{ ...inputStyle, width:'80px', fontWeight:700, color:'#e8a020' }}
                                placeholder="PETR4"
                                title="Código da ação (ex: PETR4)"
                              />
                            </td>
                            {/* Quantidade */}
                            <td style={{ padding:'6px 8px' }}>
                              <input type="number" value={op.quantidade}
                                onChange={e => upd('quantidade', Number(e.target.value))}
                                style={{ ...inputStyle, width:'70px' }} min="1" />
                            </td>
                            {/* Preço */}
                            <td style={{ padding:'6px 8px' }}>
                              <input type="number" value={op.preco}
                                onChange={e => upd('preco', Number(e.target.value))}
                                style={{ ...inputStyle, width:'90px' }} step="0.01" min="0" />
                            </td>
                            {/* Total calculado */}
                            <td style={{ padding:'6px 8px', color:'#e8a020', fontWeight:600, whiteSpace:'nowrap' }}>
                              R$ {(op.preco * op.quantidade).toFixed(2)}
                            </td>
                            {/* Data */}
                            <td style={{ padding:'6px 8px' }}>
                              <input type="date" value={op.data}
                                onChange={e => upd('data', e.target.value)}
                                style={{ ...inputStyle, width:'120px', colorScheme:'dark' }} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop:'8px',fontSize:'12px',color:'#455a64' }}>
                    ✏ Todos os campos são editáveis — corrija o ticker ou qualquer dado antes de confirmar.
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {importPreview && !importando && (
              <div style={{ padding:'16px 24px',borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',gap:'10px',justifyContent:'flex-end' }}>
                <button onClick={() => { setImportModal(false); setImportPreview(null) }}
                  style={{ background:'transparent',border:'1px solid rgba(255,255,255,.15)',color:'#6b84a8',padding:'9px 20px',borderRadius:'7px',cursor:'pointer',fontSize:'13px',fontWeight:600 }}>
                  Cancelar
                </button>
                <button onClick={confirmarImport} disabled={salvandoImport}
                  style={{ background:'#e8a020',color:'#000',padding:'9px 24px',borderRadius:'7px',cursor:salvandoImport?'wait':'pointer',fontSize:'13px',fontWeight:700,border:'none',opacity:salvandoImport?.6:1 }}>
                  {salvandoImport ? 'Salvando…' : `✓ Importar ${importPreview.operacoes.length} operação(ões)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
              O plano <strong style={{ color:'#e8edf5' }}>Gratuito</strong> permite acompanhar <strong style={{ color:'#e8a020' }}>1 ação</strong> na carteira.<br />
              Faça upgrade para acompanhar portfólios ilimitados.
            </p>
            <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
              <a href="mailto:contato@radarinvestpro.com.br?subject=Upgrade de plano"
                 style={{ background:'#e8a020',color:'#000',fontWeight:700,fontSize:'14px',padding:'12px 28px',borderRadius:'8px',textDecoration:'none',display:'block' }}>
                Quero fazer upgrade
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
