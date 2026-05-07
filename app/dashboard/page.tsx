'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { SETORES } from '@/lib/tickers'

/* ── Tipos ─────────────────────────────────────────────────────────────────── */
interface Acao {
  ticker: string; nome: string; setor: string
  preco: number | null; variacao: number | null
  max52s: number | null; varVsMax: number | null
  dy: number | null; pl: number | null; pvp: number | null
  roe: number | null; lpa: number | null; vpa: number | null
  divEbit: number | null; merc: number | null; evEbit: number | null
  gov: number | null; govRespostas: Record<string, string>
  nota: number | null; atualizado: string | null
}

type SortKey = keyof Acao
type SortDir = 'asc' | 'desc'

/* ── Helpers de formato ─────────────────────────────────────────────────────── */
const f2 = (v: number | null) =>
  v == null ? null : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null) =>
  v == null ? null : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/* ── Dados dos critérios de governança (espelho de fundamento.py) ───────────── */
const GOV_PERGUNTAS = [
  { id:'g01', cat:'Estrutura de Controle',      txt:'Possui 100% de ações ordinárias (1 ação = 1 voto)?',                  inversa:false },
  { id:'g02', cat:'Estrutura de Controle',      txt:'Empresa de Dono? (fundador/família com participação ativa e alinhada)',inversa:false },
  { id:'g03', cat:'Conselho de Administração',  txt:'Há maioria ou boa proporção de membros independentes?',              inversa:false },
  { id:'g04', cat:'Conselho de Administração',  txt:'CEO e Presidente do Conselho são pessoas diferentes?',               inversa:false },
  { id:'g05', cat:'Conduta e Reputação',        txt:'Realiza reuniões públicas com investidores (calls, day, RI)?',       inversa:false },
  { id:'g06', cat:'Conduta e Reputação',        txt:'Histórico limpo (sem fraudes, escândalos ou punições CVM)?',         inversa:false },
  { id:'g07', cat:'Alinhamento com Minoritários','txt':'Tag along de 100% para todas as classes de ações?',              inversa:false },
  { id:'g08', cat:'Alinhamento com Minoritários','txt':'Já houve operações que prejudicaram minoritários? (Não = positivo)',inversa:true  },
  { id:'g09', cat:'Alinhamento com Minoritários','txt':'Remuneração da diretoria alinhada ao desempenho de longo prazo?', inversa:false },
  { id:'g10', cat:'Nível de Governança na B3',  txt:'Está no Novo Mercado ou Nível 2 da B3?',                            inversa:false },
]

/* ── Células coloridas ─────────────────────────────────────────────────────── */
function Cell({ v, suffix='', prefix='', pct=false, colorDir=0 }: {
  v:number|null; suffix?:string; prefix?:string; pct?:boolean; colorDir?:0|1|-1
}) {
  if (v == null) return <td className="muted">—</td>
  let color = 'inherit'
  if (colorDir===1)  color = v>0?'#00d4a0':v<0?'#ef4444':'inherit'
  if (colorDir===-1) color = v<0?'#00d4a0':v>0?'#ef4444':'inherit'
  return <td style={{color,fontWeight:color!=='inherit'?600:undefined}}>
    {prefix}{pct?f1(v)+'%':f2(v)}{suffix}
  </td>
}

function NotaCell({v,onClick}:{v:number|null;onClick:()=>void}) {
  if (v==null) return <td className="muted">—</td>
  const color = v>=7?'#66BB6A':v>=5?'#FFD54F':'#EF9A9A'
  return <td style={{color,fontWeight:700,cursor:'pointer',textDecoration:'underline dotted'}}
              onClick={onClick} title="Ver detalhes da nota">{f1(v)}</td>
}

function GovCell({v,onClick}:{v:number|null;onClick:()=>void}) {
  if (v==null) return <td className="muted" style={{cursor:'pointer'}} onClick={onClick} title="Ver governança">—</td>
  const color = v>=1.5?'#66BB6A':v>=0.8?'#FFD54F':'#EF9A9A'
  return <td style={{color,fontWeight:600,cursor:'pointer',textDecoration:'underline dotted'}}
              onClick={onClick} title="Ver critérios de governança">{f1(v)}</td>
}

/* ── Modal base ────────────────────────────────────────────────────────────── */
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
         onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#0d1a2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:'14px',width:'100%',maxWidth:'600px',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <h2 style={{fontSize:'16px',fontWeight:700,color:'#e8edf5'}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer',lineHeight:1}}>×</button>
        </div>
        <div style={{overflowY:'auto',padding:'20px 24px'}}>{children}</div>
      </div>
    </div>
  )
}

/* ── Modal Governança ──────────────────────────────────────────────────────── */
function ModalGovernanca({acao,onClose}:{acao:Acao;onClose:()=>void}) {
  const temDados = Object.keys(acao.govRespostas).length > 0
  const categorias = [...new Set(GOV_PERGUNTAS.map(q=>q.cat))]
  const resp = (id:string) => acao.govRespostas[id] ?? '—'
  const cor = (id:string, inversa:boolean) => {
    const r = resp(id)
    if (r==='—') return '#6b84a8'
    const pos = inversa ? r==='Não' : r==='Sim'
    const par = r==='Parcial'
    return pos?'#66BB6A':par?'#FFD54F':'#EF9A9A'
  }

  return (
    <Modal title={`🏛 Governança — ${acao.ticker} · ${acao.nome}`} onClose={onClose}>
      {!temDados ? (
        <div style={{textAlign:'center',padding:'40px',color:'#6b84a8'}}>
          <p style={{fontSize:'32px',marginBottom:'12px'}}>🏛</p>
          <p>Governança ainda não avaliada para {acao.ticker}.</p>
          <p style={{marginTop:'8px',fontSize:'13px'}}>Avalie no app fundamento.py → botão Governança.</p>
        </div>
      ) : (
        <>
          <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'20px',padding:'14px 16px',background:'rgba(232,160,32,.08)',border:'1px solid rgba(232,160,32,.2)',borderRadius:'10px'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'36px',fontWeight:700,color:acao.gov!=null&&acao.gov>=1.5?'#66BB6A':acao.gov!=null&&acao.gov>=0.8?'#FFD54F':'#EF9A9A',fontFamily:'Space Grotesk,sans-serif'}}>{f1(acao.gov)}</div>
              <div style={{fontSize:'11px',color:'#6b84a8'}}>de 2,0 pts</div>
            </div>
            <div>
              <div style={{fontSize:'13px',fontWeight:600,color:'#e8edf5'}}>Score de Governança</div>
              <div style={{fontSize:'12px',color:'#6b84a8',marginTop:'4px'}}>10 critérios × 0,20 pts cada</div>
              <div style={{display:'flex',gap:'12px',marginTop:'8px'}}>
                {[['#66BB6A','Sim / Não (inv.)'],['#FFD54F','Parcial'],['#EF9A9A','Não / Sim (inv.)'],['#6b84a8','—']].map(([c,l])=>(
                  <span key={l} style={{fontSize:'11px',color:c,fontWeight:600}}>{l}</span>
                ))}
              </div>
            </div>
          </div>
          {categorias.map(cat=>(
            <div key={cat} style={{marginBottom:'16px'}}>
              <div style={{fontSize:'10.5px',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'#e8a020',marginBottom:'8px'}}>{cat}</div>
              {GOV_PERGUNTAS.filter(q=>q.cat===cat).map(q=>(
                <div key={q.id} style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                  <span style={{fontSize:'13px',fontWeight:700,color:cor(q.id,q.inversa),minWidth:'52px',textAlign:'center',background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'3px 6px'}}>{resp(q.id)}</span>
                  <span style={{fontSize:'13px',color:'#b8c4d4',lineHeight:1.5,flex:1}}>{q.txt}{q.inversa&&<span style={{fontSize:'11px',color:'#6b84a8',marginLeft:'6px'}}>(inversa)</span>}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

/* ── Modal Detalhar Nota ───────────────────────────────────────────────────── */
function ModalDetalharNota({acao,onClose}:{acao:Acao;onClose:()=>void}) {
  type Comp = {label:string;pts:number;max:number;detalhe:string}
  const componentes:Comp[] = []

  const pl=acao.pl
  if (pl!=null&&pl>0) {
    const m=2.5
    const p=pl<8?2.5:pl<12?2.1:pl<16?1.6:pl<20?1.0:pl<25?0.5:0
    componentes.push({label:'P/L',pts:p,max:m,detalhe:`P/L = ${f2(pl)}x → ${f2(p)} pts`})
  }
  const roe=acao.roe
  if (roe!=null) {
    const m=2.5
    const p=roe>25?2.5:roe>18?2.1:roe>12?1.5:roe>8?0.9:roe>4?0.4:0
    componentes.push({label:'ROE%',pts:p,max:m,detalhe:`ROE = ${f1(roe)}% → ${f2(p)} pts`})
  }
  const dy=acao.dy
  if (dy!=null&&dy>=0) {
    const m=1.5
    const p=dy>10?1.5:dy>7?1.2:dy>5?0.9:dy>3?0.5:dy>1?0.2:0
    componentes.push({label:'DY%',pts:p,max:m,detalhe:`DY = ${f1(dy)}% → ${f2(p)} pts`})
  }
  const pvp=acao.pvp
  if (pvp!=null&&pvp>0) {
    const m=1.5
    const p=pvp<0.7?1.5:pvp<1.0?1.2:pvp<1.5?0.9:pvp<2.0?0.5:pvp<2.5?0.2:0
    componentes.push({label:'P/VP',pts:p,max:m,detalhe:`P/VP = ${f2(pvp)}x → ${f2(p)} pts`})
  }
  const de=acao.divEbit
  if (de!=null) {
    const m=3.0
    const p=de<0?3.0:de<1?3.0:de<2?2.2:de<3?1.2:de<4?0.4:0
    componentes.push({label:'Dív/EBIT',pts:p,max:m,detalhe:`Dív/EBIT = ${f2(de)}x → ${f2(p)} pts`})
  }
  const ee=acao.evEbit
  if (ee!=null&&ee>0) {
    const m=3.0
    const p=ee<6?3.0:ee<9?2.1:ee<12?1.2:ee<16?0.3:0
    componentes.push({label:'EV/EBIT',pts:p,max:m,detalhe:`EV/EBIT = ${f2(ee)}x → ${f2(p)} pts`})
  }
  const gov=acao.gov
  if (gov!=null&&gov>0) {
    const m=3.0
    const p=Math.min(gov*(3.0/2.0),3.0)
    componentes.push({label:'Governança',pts:p,max:m,detalhe:`GOV = ${f1(gov)}/2,0 → ${f2(p)} pts`})
  }

  const totalPts = componentes.reduce((s,c)=>s+c.pts,0)
  const totalMax = componentes.reduce((s,c)=>s+c.max,0)
  const notaFinal = totalMax>0 ? Math.min(totalPts/totalMax*10,10) : 0
  const corNota = notaFinal>=7?'#66BB6A':notaFinal>=5?'#FFD54F':'#EF9A9A'

  return (
    <Modal title={`★ Detalhar Nota — ${acao.ticker} · ${acao.nome}`} onClose={onClose}>
      <div style={{display:'flex',alignItems:'center',gap:'20px',marginBottom:'20px',padding:'16px',background:'rgba(232,160,32,.07)',border:'1px solid rgba(232,160,32,.18)',borderRadius:'10px'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'48px',fontWeight:700,color:corNota,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{f1(notaFinal)}</div>
          <div style={{fontSize:'11px',color:'#6b84a8',marginTop:'4px'}}>Nota Final (0–10)</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'13px',color:'#b8c4d4',marginBottom:'6px'}}>Fórmula: pontos obtidos / pontos possíveis × 10</div>
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{background:'rgba(255,255,255,.07)',borderRadius:'6px',padding:'4px 10px',fontSize:'13px',fontWeight:600}}>{f2(totalPts)} pts obtidos</span>
            <span style={{color:'#6b84a8',alignSelf:'center'}}>/</span>
            <span style={{background:'rgba(255,255,255,.07)',borderRadius:'6px',padding:'4px 10px',fontSize:'13px',fontWeight:600}}>{f2(totalMax)} pts possíveis</span>
          </div>
        </div>
      </div>

      {componentes.length===0 ? (
        <p style={{color:'#6b84a8',textAlign:'center',padding:'20px'}}>Dados insuficientes para calcular nota.</p>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {componentes.map(c=>{
            const pct=c.max>0?(c.pts/c.max)*100:0
            const barColor=pct>=80?'#66BB6A':pct>=50?'#FFD54F':'#EF9A9A'
            return (
              <div key={c.label}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                  <span style={{fontSize:'13px',color:'#e8edf5',fontWeight:600}}>{c.label}</span>
                  <span style={{fontSize:'12px',color:'#6b84a8'}}>{c.detalhe}</span>
                </div>
                <div style={{height:'8px',background:'rgba(255,255,255,.07)',borderRadius:'4px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:'4px',transition:'width .6s ease'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:'3px'}}>
                  <span style={{fontSize:'11px',color:barColor,fontWeight:600}}>{f2(c.pts)} / {f2(c.max)} pts</span>
                  <span style={{fontSize:'11px',color:'#6b84a8'}}>{f1(pct)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

/* ── Exportar CSV ──────────────────────────────────────────────────────────── */
function exportarCSV(acoes: Acao[]) {
  const cab = ['Ticker','Nome','Setor','Preço','DY%','P/L','P/VP','ROE%','LPA','Dív/EBIT','VPA','Merc.(Bi)','EV/EBIT','Máx.52s','Queda%','Var.Dia%','GOV','NOTA']
  const linhas = acoes.map(a => [
    a.ticker, a.nome, a.setor,
    a.preco??'', a.dy??'', a.pl??'', a.pvp??'',
    a.roe??'', a.lpa??'', a.divEbit??'', a.vpa??'',
    a.merc??'', a.evEbit??'', a.max52s??'',
    a.varVsMax??'', a.variacao??'', a.gov??'', a.nota??''
  ].map(v=>String(v).replace(/;/g,' ')).join(';'))
  const csv = '﻿' + [cab.join(';'), ...linhas].join('\r\n')
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `radar-invest-pro-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── Página principal ──────────────────────────────────────────────────────── */
const HDR_H = 52; const BAR_H = 56

export default function Dashboard() {
  const [acoes,    setAcoes]    = useState<Acao[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState('')
  const [ts,       setTs]       = useState('')
  const [busca,    setBusca]    = useState('')
  const [setor,    setSetor]    = useState('Todos')
  const [precoMin, setPrecoMin] = useState('')
  const [precoMax, setPrecoMax] = useState('')
  const [sortKey,  setSortKey]  = useState<SortKey>('ticker')
  const [sortDir,  setSortDir]  = useState<SortDir>('asc')
  const [modalGov,  setModalGov]  = useState<Acao|null>(null)
  const [modalNota, setModalNota] = useState<Acao|null>(null)

  const carregarDados = useCallback(()=>{
    setLoading(true); setErro('')
    fetch('/api/acoes')
      .then(r=>{if(!r.ok)throw new Error();return r.json()})
      .then(d=>{setAcoes(d.acoes??[]);setTs(d.ts?new Date(d.ts).toLocaleString('pt-BR'):''  )})
      .catch(()=>setErro('Falha ao carregar dados.'))
      .finally(()=>setLoading(false))
  },[])

  useEffect(()=>{carregarDados()},[carregarDados])

  const toggleSort=(k:SortKey)=>{
    if(sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc')
    else{setSortKey(k);setSortDir('asc')}
  }

  const filtradas = useMemo(()=>{
    let l=acoes
    if(busca) l=l.filter(a=>a.ticker.toLowerCase().includes(busca.toLowerCase())||a.nome.toLowerCase().includes(busca.toLowerCase()))
    if(setor!=='Todos') l=l.filter(a=>a.setor===setor)
    const mn=precoMin?parseFloat(precoMin.replace(',','.')):null
    const mx=precoMax?parseFloat(precoMax.replace(',','.')):null
    if(mn!=null) l=l.filter(a=>a.preco!=null&&a.preco>=mn)
    if(mx!=null) l=l.filter(a=>a.preco!=null&&a.preco<=mx)
    return l.slice().sort((a,b)=>{
      const av=a[sortKey],bv=b[sortKey]
      if(av==null&&bv==null)return 0
      if(av==null)return 1;if(bv==null)return -1
      if(typeof av==='string'&&typeof bv==='string')
        return sortDir==='asc'?av.localeCompare(bv,'pt-BR'):bv.localeCompare(av,'pt-BR')
      return sortDir==='asc'?(av as number)-(bv as number):(bv as number)-(av as number)
    })
  },[acoes,busca,setor,precoMin,precoMax,sortKey,sortDir])

  const limpar=()=>{setBusca('');setSetor('Todos');setPrecoMin('');setPrecoMax('')}
  const Th=({k,label,title}:{k:SortKey;label:string;title?:string})=>(
    <th onClick={()=>toggleSort(k)} title={title}>
      {label}{sortKey===k?(sortDir==='asc'?' ▲':' ▼'):''}
    </th>
  )
  const al30=acoes.filter(a=>a.varVsMax!=null&&a.varVsMax<=-30).length
  const al15=acoes.filter(a=>a.varVsMax!=null&&a.varVsMax<=-15&&a.varVsMax>-30).length

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5;overflow:hidden}
        .page{display:flex;flex-direction:column;height:100vh}
        .hdr{height:${HDR_H}px;flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;display:flex;align-items:center;justify-content:space-between}
        .hdr-logo{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#fff}
        .hdr-logo span{color:#e8a020}
        .hdr-right{display:flex;align-items:center;gap:10px}
        .back{font-size:12px;color:#6b84a8;text-decoration:none;display:flex;align-items:center;gap:5px;margin-right:18px}
        .back:hover{color:#e8edf5}
        .btn-icon{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#b8c4d4;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px}
        .btn-icon:hover{background:rgba(255,255,255,.1);color:#fff}
        .btn-gold{background:rgba(232,160,32,.12);border:1px solid rgba(232,160,32,.3);color:#e8a020}
        .btn-gold:hover{background:rgba(232,160,32,.22)}
        .btn-gold:disabled{opacity:.5;cursor:not-allowed}
        .toolbar{height:${BAR_H}px;flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;display:flex;align-items:center;gap:10px;overflow-x:auto}
        .inp{background:#0d1a2e;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:8px 13px;color:#e8edf5;font-size:13px;outline:none;transition:border-color .2s;font-family:inherit;flex-shrink:0}
        .inp:focus{border-color:rgba(232,160,32,.5)}
        .inp::placeholder{color:#6b84a8}
        .inp-search{width:220px}.inp-setor{width:200px}.inp-preco{width:100px}
        .btn-filtrar{background:#e8a020;color:#000;font-weight:700;font-size:12px;padding:8px 18px;border-radius:7px;border:none;cursor:pointer;flex-shrink:0}
        .btn-filtrar:hover{background:#f5c55a}
        .btn-limpar{background:transparent;border:1px solid rgba(255,255,255,.15);color:#6b84a8;font-size:12px;font-weight:600;padding:8px 14px;border-radius:7px;cursor:pointer;flex-shrink:0}
        .btn-limpar:hover{color:#e8edf5}
        .ts-label{font-size:11px;color:#6b84a8;white-space:nowrap;margin-left:auto;flex-shrink:0}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .resumo{flex-shrink:0;display:flex;gap:20px;padding:10px 20px;background:#081120;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap}
        .resumo-item{font-size:11px;color:#6b84a8;display:flex;align-items:baseline;gap:6px}
        .resumo-num{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#e8edf5}
        .table-wrap{flex:1;overflow:auto;min-height:0}
        table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:1440px}
        thead th{background:#081120;padding:9px 10px;text-align:right;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#6b84a8;border-bottom:2px solid rgba(255,255,255,.08);position:sticky;top:0;z-index:10;white-space:nowrap;cursor:pointer;user-select:none}
        thead th:first-child,thead th:nth-child(2),thead th:nth-child(3){text-align:left}
        thead th:nth-last-child(-n+2){color:#e8a020}
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
      `}</style>

      <div className="page">
        {/* HEADER */}
        <header className="hdr">
          <div style={{display:'flex',alignItems:'center'}}>
            <Link href="/" className="back">← Voltar</Link>
            <div className="hdr-logo">Radar Invest <span>Pro</span> — Monitoramento</div>
          </div>
          <div className="hdr-right">
            <button className="btn-icon" onClick={()=>exportarCSV(filtradas)} title="Exportar tabela atual para CSV (abre no Excel)">
              ⬇ Exportar Excel
            </button>
            <Link href="/dashboard/admin" style={{textDecoration:'none'}}>
              <button className="btn-icon">⚙ Admin</button>
            </Link>
            <button className="btn-icon btn-gold" disabled={loading} onClick={carregarDados}>
              {loading?'⟳ Carregando…':'↻ Atualizar'}
            </button>
          </div>
        </header>

        {/* FILTROS */}
        <div className="toolbar">
          <input className="inp inp-search" placeholder="Buscar ticker ou nome…" value={busca} onChange={e=>setBusca(e.target.value)}/>
          <select className="inp inp-setor" value={setor} onChange={e=>setSetor(e.target.value)}>
            {SETORES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <input className="inp inp-preco" placeholder="Preço min" value={precoMin} onChange={e=>setPrecoMin(e.target.value)}/>
          <input className="inp inp-preco" placeholder="Preço max" value={precoMax} onChange={e=>setPrecoMax(e.target.value)}/>
          <button className="btn-filtrar">Filtrar</button>
          <button className="btn-limpar" onClick={limpar}>Limpar</button>
          {ts&&<span className="ts-label">Fund. em: {ts}</span>}
        </div>

        <div className="main">
          {/* RESUMO */}
          {!loading&&!erro&&(
            <div className="resumo">
              <div className="resumo-item"><span className="resumo-num">{filtradas.length}</span>ações</div>
              <div className="resumo-item"><span className="resumo-num">{filtradas.filter(a=>a.preco!=null).length}</span>com preço</div>
              <div className="resumo-item" style={{color:'#ef4444'}}><span className="resumo-num" style={{color:'#ef4444'}}>{al30}</span>alerta −30%</div>
              <div className="resumo-item" style={{color:'#f5c55a'}}><span className="resumo-num" style={{color:'#f5c55a'}}>{al15}</span>alerta −15%</div>
              <div className="resumo-item" style={{marginLeft:'auto',fontSize:'12px',color:'#6b84a8'}}>
                GOV avaliadas: <strong style={{color:'#e8a020'}}>{acoes.filter(a=>a.gov!=null&&a.gov>0).length}</strong> / {acoes.length}
              </div>
            </div>
          )}

          {loading&&<div className="loading-box"><div className="spinner"/><p style={{color:'#6b84a8',fontSize:'13px'}}>Buscando dados da B3…</p></div>}
          {!loading&&erro&&<div className="erro-box">{erro}</div>}

          {/* TABELA */}
          {!loading&&!erro&&(
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <Th k="ticker"   label="Ticker"/>
                    <Th k="nome"     label="Nome"/>
                    <Th k="setor"    label="Setor"/>
                    <Th k="preco"    label="Preço"/>
                    <Th k="dy"       label="DY%"      title="Dividend Yield (%)"/>
                    <Th k="pl"       label="P/L"       title="Preço / Lucro"/>
                    <Th k="pvp"      label="P/VP"      title="Preço / Valor Patrimonial"/>
                    <Th k="roe"      label="ROE%"      title="Return on Equity (%)"/>
                    <Th k="lpa"      label="LPA"       title="Lucro Por Ação"/>
                    <Th k="divEbit"  label="Dív/EBIT"  title="Dívida Líquida / EBIT"/>
                    <Th k="vpa"      label="VPA"       title="Valor Patrimonial por Ação"/>
                    <Th k="merc"     label="Merc.(Bi)" title="Valor de Mercado (R$ bi)"/>
                    <Th k="evEbit"   label="EV/EBIT"   title="Enterprise Value / EBIT"/>
                    <Th k="max52s"   label="Máx.52s"   title="Máxima 52 semanas"/>
                    <Th k="varVsMax" label="Queda%"    title="Distância vs máxima 52 semanas"/>
                    <Th k="variacao" label="Var.Dia"   title="Variação diária (%)"/>
                    <Th k="gov"      label="GOV 🏛"    title="Score de Governança (0–2,0) — clique para detalhes"/>
                    <Th k="nota"     label="NOTA ★"    title="Nota fundamentalista (0–10) — clique para detalhes"/>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.length===0
                    ?<tr className="empty-row"><td colSpan={18}>Nenhuma ação encontrada.</td></tr>
                    :filtradas.map(a=>{
                      const al=a.varVsMax!=null&&a.varVsMax<=-30?30:a.varVsMax!=null&&a.varVsMax<=-15?15:0
                      return(
                        <tr key={a.ticker} style={al===30?{background:'rgba(239,68,68,.06)'}:al===15?{background:'rgba(245,197,90,.04)'}:undefined}>
                          <td>{a.ticker}{al===30&&<span className="badge badge-30">−30%</span>}{al===15&&<span className="badge badge-15">−15%</span>}</td>
                          <td title={a.nome}>{a.nome}</td>
                          <td>{a.setor}</td>
                          <td>{a.preco!=null?'R$ '+f2(a.preco):<span className="muted">—</span>}</td>
                          <Cell v={a.dy}       pct/>
                          <Cell v={a.pl}       suffix="x"/>
                          <Cell v={a.pvp}      suffix="x"/>
                          <Cell v={a.roe}      pct colorDir={1}/>
                          <Cell v={a.lpa}      prefix="R$ "/>
                          <Cell v={a.divEbit}  suffix="x" colorDir={-1}/>
                          <Cell v={a.vpa}      prefix="R$ "/>
                          <Cell v={a.merc}     suffix="bi"/>
                          <Cell v={a.evEbit}   suffix="x"/>
                          <td title={a.atualizado??undefined}>{a.max52s!=null?'R$ '+f2(a.max52s):<span className="muted">—</span>}</td>
                          <Cell v={a.varVsMax} pct colorDir={-1}/>
                          <Cell v={a.variacao} pct colorDir={1}/>
                          <GovCell  v={a.gov}  onClick={()=>setModalGov(a)}/>
                          <NotaCell v={a.nota} onClick={()=>setModalNota(a)}/>
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
      {modalGov  && <ModalGovernanca    acao={modalGov}  onClose={()=>setModalGov(null)}/>}
      {modalNota && <ModalDetalharNota  acao={modalNota} onClose={()=>setModalNota(null)}/>}
    </>
  )
}
