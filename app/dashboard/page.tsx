'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { SETORES } from '@/lib/tickers'

interface Acao {
  ticker: string; nome: string; setor: string
  preco: number | null; variacao: number | null
  max52s: number | null; varVsMax: number | null
  dy: number | null; pl: number | null; pvp: number | null
  roe: number | null; lpa: number | null; vpa: number | null
  divEbit: number | null; merc: number | null; evEbit: number | null
  gov: number | null; nota: number | null
  atualizado: string | null
}

type SortKey = keyof Acao
type SortDir = 'asc' | 'desc'

const f2 = (v: number | null) =>
  v == null ? null : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null) =>
  v == null ? null : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Cell({ v, suffix = '', prefix = '', pct = false, colorDir = 0, decimals = 2 }: {
  v: number | null; suffix?: string; prefix?: string; pct?: boolean; colorDir?: 0 | 1 | -1; decimals?: number
}) {
  if (v == null) return <td className="muted">—</td>
  let color = 'inherit'
  if (colorDir === 1)  color = v > 0 ? '#00d4a0' : v < 0 ? '#ef4444' : 'inherit'
  if (colorDir === -1) color = v < 0 ? '#00d4a0' : v > 0 ? '#ef4444' : 'inherit'
  const display = pct ? f1(v) + '%' : decimals === 1 ? f1(v) : f2(v)
  return <td style={{ color, fontWeight: color !== 'inherit' ? 600 : undefined }}>{prefix}{display}{suffix}</td>
}

function NotaCell({ v }: { v: number | null }) {
  if (v == null) return <td className="muted">—</td>
  const color = v >= 7 ? '#66BB6A' : v >= 5 ? '#FFD54F' : '#EF9A9A'
  return <td style={{ color, fontWeight: 700 }}>{f1(v)}</td>
}

function GovCell({ v }: { v: number | null }) {
  if (v == null) return <td className="muted">—</td>
  const color = v >= 1.5 ? '#66BB6A' : v >= 0.8 ? '#FFD54F' : '#EF9A9A'
  return <td style={{ color, fontWeight: 600 }}>{f1(v)}</td>
}

const HDR_H = 52
const BAR_H = 56

export default function Dashboard() {
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [ts, setTs] = useState('')
  const [busca, setBusca] = useState('')
  const [setor, setSetor] = useState('Todos')
  const [precoMin, setPrecoMin] = useState('')
  const [precoMax, setPrecoMax] = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('ticker')
  const [sortDir, setSortDir]   = useState<SortDir>('asc')

  const carregarDados = useCallback(() => {
    setLoading(true); setErro('')
    fetch('/api/acoes')
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => { setAcoes(d.acoes ?? []); setTs(d.ts ? new Date(d.ts).toLocaleString('pt-BR') : '') })
      .catch(() => setErro('Falha ao carregar dados.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const filtradas = useMemo(() => {
    let lista = acoes
    if (busca) lista = lista.filter(a =>
      a.ticker.toLowerCase().includes(busca.toLowerCase()) ||
      a.nome.toLowerCase().includes(busca.toLowerCase())
    )
    if (setor !== 'Todos') lista = lista.filter(a => a.setor === setor)
    const min = precoMin ? parseFloat(precoMin.replace(',', '.')) : null
    const max = precoMax ? parseFloat(precoMax.replace(',', '.')) : null
    if (min != null) lista = lista.filter(a => a.preco != null && a.preco >= min)
    if (max != null) lista = lista.filter(a => a.preco != null && a.preco <= max)
    return lista.slice().sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1; if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string')
        return sortDir === 'asc' ? av.localeCompare(bv,'pt-BR') : bv.localeCompare(av,'pt-BR')
      return sortDir === 'asc' ? (av as number)-(bv as number) : (bv as number)-(av as number)
    })
  }, [acoes, busca, setor, precoMin, precoMax, sortKey, sortDir])

  const limpar = () => { setBusca(''); setSetor('Todos'); setPrecoMin(''); setPrecoMax('') }
  const Th = ({ k, label, title }: { k: SortKey; label: string; title?: string }) => (
    <th onClick={() => toggleSort(k)} title={title}>
      {label}{sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  )

  const alertas30 = acoes.filter(a => a.varVsMax != null && a.varVsMax <= -30).length
  const alertas15 = acoes.filter(a => a.varVsMax != null && a.varVsMax <= -15 && a.varVsMax > -30).length

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5;overflow:hidden}
        .page{display:flex;flex-direction:column;height:100vh}

        /* Header */
        .hdr{height:${HDR_H}px;flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;display:flex;align-items:center;justify-content:space-between}
        .hdr-logo{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#fff}
        .hdr-logo span{color:#e8a020}
        .back{font-size:12px;color:#6b84a8;text-decoration:none;display:flex;align-items:center;gap:5px;margin-right:18px}
        .back:hover{color:#e8edf5}
        .btn-reload{background:rgba(232,160,32,.1);border:1px solid rgba(232,160,32,.3);color:#e8a020;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;cursor:pointer}
        .btn-reload:hover{background:rgba(232,160,32,.2)}
        .btn-reload:disabled{opacity:.5;cursor:not-allowed}

        /* Toolbar */
        .toolbar{height:${BAR_H}px;flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;display:flex;align-items:center;gap:10px;overflow-x:auto}
        .inp{background:#0d1a2e;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:8px 13px;color:#e8edf5;font-size:13px;outline:none;transition:border-color .2s;font-family:inherit;flex-shrink:0}
        .inp:focus{border-color:rgba(232,160,32,.5)}
        .inp::placeholder{color:#6b84a8}
        .inp-search{width:220px}
        .inp-setor{width:200px}
        .inp-preco{width:100px}
        .btn-filtrar{background:#e8a020;color:#000;font-weight:700;font-size:12px;padding:8px 18px;border-radius:7px;border:none;cursor:pointer;flex-shrink:0}
        .btn-filtrar:hover{background:#f5c55a}
        .btn-limpar{background:transparent;border:1px solid rgba(255,255,255,.15);color:#6b84a8;font-size:12px;font-weight:600;padding:8px 14px;border-radius:7px;cursor:pointer;flex-shrink:0}
        .btn-limpar:hover{color:#e8edf5}
        .ts-label{font-size:11px;color:#6b84a8;white-space:nowrap;margin-left:auto;flex-shrink:0}

        /* Conteúdo */
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .resumo{flex-shrink:0;display:flex;gap:20px;padding:10px 20px;background:#081120;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap}
        .resumo-item{font-size:11px;color:#6b84a8;display:flex;align-items:baseline;gap:6px}
        .resumo-num{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#e8edf5}

        /* Tabela */
        .table-wrap{flex:1;overflow:auto;min-height:0}
        table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:1440px}
        thead th{
          background:#081120;padding:9px 10px;text-align:right;
          font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#6b84a8;
          border-bottom:2px solid rgba(255,255,255,.08);
          position:sticky;top:0;z-index:10;
          white-space:nowrap;cursor:pointer;user-select:none;
        }
        thead th:first-child,thead th:nth-child(2),thead th:nth-child(3){text-align:left}
        thead th:last-child,thead th:nth-last-child(2){color:#e8a020} /* GOV e NOTA em dourado */
        tbody tr{border-bottom:1px solid rgba(255,255,255,.035);transition:background .12s}
        tbody tr:hover{background:rgba(255,255,255,.04)}
        tbody td{padding:9px 10px;text-align:right;color:#e8edf5;white-space:nowrap}
        tbody td:first-child{text-align:left;font-weight:700;color:#e8a020;font-family:var(--font-space),'Space Grotesk',monospace;min-width:80px}
        tbody td:nth-child(2){text-align:left;color:#b8c4d4;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis}
        tbody td:nth-child(3){text-align:left;color:#6b84a8;font-size:11px}
        .muted{color:#6b84a8!important;font-weight:400!important}
        .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:700;letter-spacing:.3px;margin-left:5px;vertical-align:middle}
        .badge-15{background:rgba(245,197,90,.1);color:#f5c55a;border:1px solid rgba(245,197,90,.25)}
        .badge-30{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
        .loading-box{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px}
        .spinner{width:38px;height:38px;border:3px solid rgba(232,160,32,.15);border-top-color:#e8a020;border-radius:50%;animation:spin .75s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .erro-box{text-align:center;padding:60px;color:#ef4444}
        .empty-row td{text-align:center;padding:60px;color:#6b84a8}
        /* tooltip para atualizado */
        td[title]{cursor:default}
      `}</style>

      <div className="page">
        {/* Header */}
        <header className="hdr">
          <div style={{ display:'flex', alignItems:'center' }}>
            <Link href="/" className="back">← Voltar</Link>
            <div className="hdr-logo">Radar Invest <span>Pro</span> — Monitoramento</div>
          </div>
          <button className="btn-reload" disabled={loading} onClick={carregarDados}>
            {loading ? '⟳ Carregando…' : '↻ Atualizar'}
          </button>
        </header>

        {/* Filtros */}
        <div className="toolbar">
          <input className="inp inp-search" placeholder="Buscar ticker ou nome…" value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="inp inp-setor" value={setor} onChange={e => setSetor(e.target.value)}>
            {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="inp inp-preco" placeholder="Preço min" value={precoMin} onChange={e => setPrecoMin(e.target.value)} />
          <input className="inp inp-preco" placeholder="Preço max" value={precoMax} onChange={e => setPrecoMax(e.target.value)} />
          <button className="btn-filtrar">Filtrar</button>
          <button className="btn-limpar" onClick={limpar}>Limpar</button>
          {ts && <span className="ts-label">Atualizado: {ts}</span>}
        </div>

        <div className="main">
          {/* Resumo */}
          {!loading && !erro && (
            <div className="resumo">
              <div className="resumo-item"><span className="resumo-num">{filtradas.length}</span>ações</div>
              <div className="resumo-item"><span className="resumo-num">{filtradas.filter(a => a.preco != null).length}</span>com preço</div>
              <div className="resumo-item" style={{color:'#ef4444'}}><span className="resumo-num" style={{color:'#ef4444'}}>{alertas30}</span>alerta −30%</div>
              <div className="resumo-item" style={{color:'#f5c55a'}}><span className="resumo-num" style={{color:'#f5c55a'}}>{alertas15}</span>alerta −15%</div>
            </div>
          )}

          {loading && <div className="loading-box"><div className="spinner"/><p style={{color:'#6b84a8',fontSize:'13px'}}>Buscando dados da B3…</p></div>}
          {!loading && erro && <div className="erro-box">{erro}</div>}

          {!loading && !erro && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <Th k="ticker"   label="Ticker" />
                    <Th k="nome"     label="Nome" />
                    <Th k="setor"    label="Setor" />
                    <Th k="preco"    label="Preço" />
                    <Th k="dy"       label="DY%"      title="Dividend Yield (%)" />
                    <Th k="pl"       label="P/L"       title="Preço / Lucro" />
                    <Th k="pvp"      label="P/VP"      title="Preço / Valor Patrimonial" />
                    <Th k="roe"      label="ROE%"      title="Return on Equity (%)" />
                    <Th k="lpa"      label="LPA"       title="Lucro Por Ação" />
                    <Th k="divEbit"  label="Dív/EBIT"  title="Dívida Líquida / EBIT" />
                    <Th k="vpa"      label="VPA"       title="Valor Patrimonial por Ação" />
                    <Th k="merc"     label="Merc.(Bi)" title="Valor de Mercado em bilhões (R$)" />
                    <Th k="evEbit"   label="EV/EBIT"   title="Enterprise Value / EBIT" />
                    <Th k="max52s"   label="Máx.52s"   title="Máxima 52 semanas" />
                    <Th k="varVsMax" label="Queda%"    title="Distância vs máxima 52 semanas" />
                    <Th k="variacao" label="Var.Dia"   title="Variação diária (%)" />
                    <Th k="gov"      label="GOV 🏛"    title="Score de Governança (0–2,0)" />
                    <Th k="nota"     label="NOTA ★"    title="Nota fundamentalista (0–10)" />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length === 0
                    ? <tr className="empty-row"><td colSpan={18}>Nenhuma ação encontrada.</td></tr>
                    : filtradas.map(a => {
                      const al = a.varVsMax != null && a.varVsMax <= -30 ? 30
                                : a.varVsMax != null && a.varVsMax <= -15 ? 15 : 0
                      return (
                        <tr key={a.ticker} style={
                          al === 30 ? {background:'rgba(239,68,68,.06)'} :
                          al === 15 ? {background:'rgba(245,197,90,.04)'} : undefined
                        }>
                          <td>
                            {a.ticker}
                            {al === 30 && <span className="badge badge-30">−30%</span>}
                            {al === 15 && <span className="badge badge-15">−15%</span>}
                          </td>
                          <td title={a.nome}>{a.nome}</td>
                          <td>{a.setor}</td>
                          <td>{a.preco != null ? 'R$ '+f2(a.preco) : <span className="muted">—</span>}</td>
                          <Cell v={a.dy}       pct />
                          <Cell v={a.pl}       suffix="x" />
                          <Cell v={a.pvp}      suffix="x" />
                          <Cell v={a.roe}      pct colorDir={1} />
                          <Cell v={a.lpa}      prefix="R$ " />
                          <Cell v={a.divEbit}  suffix="x" colorDir={-1} />
                          <Cell v={a.vpa}      prefix="R$ " />
                          <Cell v={a.merc}     suffix="bi" />
                          <Cell v={a.evEbit}   suffix="x" />
                          <td title={a.atualizado ?? undefined}>{a.max52s != null ? 'R$ '+f2(a.max52s) : <span className="muted">—</span>}</td>
                          <Cell v={a.varVsMax} pct colorDir={-1} />
                          <Cell v={a.variacao} pct colorDir={1} />
                          <GovCell v={a.gov} />
                          <NotaCell v={a.nota} />
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
    </>
  )
}
