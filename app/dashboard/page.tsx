'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import NavBar from '@/components/NavBar'
import fundamentaisRaw from '@/lib/fundamentais.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fundamentais = fundamentaisRaw as unknown as Record<string, any>

interface Acao {
  ticker: string; nome: string; setor: string
  preco: number | null; variacao: number | null
  max52s: number | null; varVsMax: number | null
  dy: number | null; pl: number | null; pvp: number | null
  roe: number | null; lpa: number | null; vpa: number | null
  divEbit: number | null; merc: number | null; evEbit: number | null
  gov: number | null; govRespostas: Record<string, string>
  nota: number | null; atualizado: string | null
  dcfUpside: number | null; tirPremioNtnb: number | null
}
type SortKey = keyof Acao
type SortDir = 'asc' | 'desc'

const f2 = (v: number | null) =>
  v == null ? null : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null) =>
  v == null ? null : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const GOV_PERGUNTAS = [
  { id:'g01', cat:'Estrutura de Controle',      txt:'Possui 100% de ações ordinárias (1 ação = 1 voto)?',                   inversa:false },
  { id:'g02', cat:'Estrutura de Controle',      txt:'Empresa de Dono? (fundador/família com participação ativa e alinhada)', inversa:false },
  { id:'g03', cat:'Conselho de Administração',  txt:'Há maioria ou boa proporção de membros independentes?',               inversa:false },
  { id:'g04', cat:'Conselho de Administração',  txt:'CEO e Presidente do Conselho são pessoas diferentes?',                inversa:false },
  { id:'g05', cat:'Conduta e Reputação',        txt:'Realiza reuniões públicas com investidores (calls, day, RI)?',        inversa:false },
  { id:'g06', cat:'Conduta e Reputação',        txt:'Histórico limpo (sem fraudes, escândalos ou punições CVM)?',          inversa:false },
  { id:'g07', cat:'Alinhamento com Minoritários',txt:'Tag along de 100% para todas as classes de ações?',                 inversa:false },
  { id:'g08', cat:'Alinhamento com Minoritários',txt:'Já houve operações que prejudicaram minoritários? (Não = positivo)', inversa:true  },
  { id:'g09', cat:'Alinhamento com Minoritários',txt:'Remuneração da diretoria alinhada ao desempenho de longo prazo?',   inversa:false },
  { id:'g10', cat:'Nível de Governança na B3',  txt:'Está no Novo Mercado ou Nível 2 da B3?',                             inversa:false },
  { id:'g11', cat:'Estabilidade de Controle', txt:'A estrutura de controle está estável (sem conflitos públicos entre controladores ou alta diretoria)?', inversa:false },
]

function Cell({ v, suffix='', prefix='', pct=false, colorDir=0 }: {
  v:number|null; suffix?:string; prefix?:string; pct?:boolean; colorDir?:0|1|-1
}) {
  if (v == null) return <td className="muted">—</td>
  let color = 'inherit'
  if (colorDir===1)  color = v>0?'#00d4a0':v<0?'#ef4444':'inherit'
  if (colorDir===-1) color = v<0?'#00d4a0':v>0?'#ef4444':'inherit'
  return <td style={{color, fontWeight:color!=='inherit'?600:undefined}}>
    {prefix}{pct?f1(v)+'%':f2(v)}{suffix}
  </td>
}

function NotaCell({v,bloqueado,onClick}:{v:number|null;bloqueado:boolean;onClick:()=>void}) {
  if (bloqueado) return (
    <td onClick={onClick} title="Disponível no plano Essencial ou superior"
        style={{cursor:'pointer',textAlign:'center',fontSize:'15px',color:'#6b84a8',userSelect:'none'}}>
      *
    </td>
  )
  if (v==null) return <td className="muted">—</td>
  const color = v>=7?'#66BB6A':v>=5?'#FFD54F':'#EF9A9A'
  return <td style={{color,fontWeight:700,cursor:'pointer',textDecoration:'underline dotted'}} onClick={onClick} title="Ver detalhes da nota">{f1(v)}</td>
}

function ModalUpgradeNota({onClose}:{onClose:()=>void}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
         onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#0d1a2e',border:'1px solid rgba(232,160,32,.25)',borderRadius:'14px',width:'100%',maxWidth:'420px',padding:'36px 32px',textAlign:'center'}}>
        <div style={{fontSize:'40px',marginBottom:'16px'}}>★</div>
        <h2 style={{fontSize:'18px',fontWeight:700,color:'#e8edf5',marginBottom:'8px'}}>Nota de Qualidade bloqueada</h2>
        <p style={{fontSize:'13px',color:'#6b84a8',lineHeight:1.7,marginBottom:'24px'}}>
          A nota fundamentalista (0–10) com breakdown completo de P/L, ROE, DY, P/VP, Dívida e Governança está disponível no plano <strong style={{color:'#e8a020'}}>Essencial</strong> ou superior.
        </p>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          <a href="/planos" style={{display:'block',background:'#e8a020',color:'#000',borderRadius:'8px',padding:'13px',fontSize:'14px',fontWeight:700,textDecoration:'none'}}>
            Ver planos e fazer upgrade
          </a>
          <button onClick={onClose} style={{background:'none',border:'1px solid rgba(255,255,255,.1)',color:'#6b84a8',borderRadius:'8px',padding:'11px',fontSize:'13px',cursor:'pointer'}}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
function GovCell({v,onClick}:{v:number|null;onClick:()=>void}) {
  if (v==null) return <td className="muted" style={{cursor:'pointer'}} onClick={onClick} title="Ver governança">—</td>
  const color = v>=1.5?'#66BB6A':v>=0.8?'#FFD54F':'#EF9A9A'
  return <td style={{color,fontWeight:600,cursor:'pointer',textDecoration:'underline dotted'}} onClick={onClick} title="Ver critérios de governança">{f1(v)}</td>
}

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

function ModalGovernanca({acao,onClose}:{acao:Acao;onClose:()=>void}) {
  const temDados = Object.keys(acao.govRespostas).length > 0
  const categorias = [...new Set(GOV_PERGUNTAS.map(q=>q.cat))]
  const resp=(id:string)=>acao.govRespostas[id]??'—'
  const cor=(id:string,inversa:boolean)=>{
    const r=resp(id); if(r==='—') return '#6b84a8'
    const pos=inversa?r==='Não':r==='Sim'; const par=r==='Parcial'
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
              <div style={{fontSize:'36px',fontWeight:700,color:acao.gov!=null&&acao.gov>=2.4?'#66BB6A':acao.gov!=null&&acao.gov>=1.5?'#FFD54F':'#EF9A9A',fontFamily:'Space Grotesk,sans-serif'}}>{f1(acao.gov)}</div>
              <div style={{fontSize:'11px',color:'#6b84a8'}}>de 3,0 pts</div>
            </div>
            <div>
              <div style={{fontSize:'13px',fontWeight:600,color:'#e8edf5'}}>Score de Governança</div>
              <div style={{fontSize:'12px',color:'#6b84a8',marginTop:'4px'}}>11 critérios · dono/estabilidade 0,50 · histórico 0,40 · demais 0,20</div>
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

// ── Cálculo de nota com thresholds setoriais ─────────────────────────────────
type Comp = {label:string;pts:number;max:number;detalhe:string}

const SETORES_UTILIDADE = ['Utilidade Pública']

function calcularNotaComponentes(acao: Acao): { componentes: Comp[]; isUtilidade: boolean; nota: number } {
  const isUtilidade = SETORES_UTILIDADE.includes(acao.setor ?? '')
  const componentes: Comp[] = []

  // P/L — elétricas têm P/L estruturalmente mais alto (ativos de longa duração)
  const pl = acao.pl
  if (pl != null && pl > 0) {
    const m = 2.5
    const p = isUtilidade
      ? (pl<10?2.5:pl<14?2.1:pl<18?1.6:pl<22?1.0:pl<28?0.5:0)
      : (pl<8 ?2.5:pl<12?2.1:pl<16?1.6:pl<20?1.0:pl<25?0.5:0)
    componentes.push({label:'P/L', pts:p, max:m, detalhe:`P/L = ${f2(pl)}x → ${f2(p)} pts`})
  }

  // ROE — WACC regulatório elétrico ~9-11%; abaixo disso destrói valor
  const roe = acao.roe
  if (roe != null) {
    const m = 2.5
    const p = isUtilidade
      ? (roe>15?2.5:roe>11?2.1:roe>8?1.5:roe>5?0.9:roe>2?0.4:0)
      : (roe>25?2.5:roe>18?2.1:roe>12?1.5:roe>8?0.9:roe>4?0.4:0)
    componentes.push({label:'ROE%', pts:p, max:m, detalhe:`ROE = ${f1(roe)}% → ${f2(p)} pts`})
  }

  // DY — elétricas são fortes pagadoras; referência >6% é bom
  const dy = acao.dy
  if (dy != null && dy >= 0) {
    const m = 1.5
    const p = isUtilidade
      ? (dy>8?1.5:dy>6?1.2:dy>4?0.9:dy>2?0.5:dy>0?0.2:0)
      : (dy>10?1.5:dy>7?1.2:dy>5?0.9:dy>3?0.5:dy>1?0.2:0)
    componentes.push({label:'DY%', pts:p, max:m, detalhe:`DY = ${f1(dy)}% → ${f2(p)} pts`})
  }

  // P/VP — RAB justifica P/VP até 2,5x em elétricas reguladas
  const pvp = acao.pvp
  if (pvp != null && pvp > 0) {
    const m = 1.5
    const p = isUtilidade
      ? (pvp<1.0?1.5:pvp<1.5?1.2:pvp<2.0?0.9:pvp<2.5?0.5:pvp<3.5?0.2:0)
      : (pvp<0.7?1.5:pvp<1.0?1.2:pvp<1.5?0.9:pvp<2.0?0.5:pvp<2.5?0.2:0)
    componentes.push({label:'P/VP', pts:p, max:m, detalhe:`P/VP = ${f2(pvp)}x → ${f2(p)} pts`})
  }

  // Dív/EBIT — elétricas têm alta depreciação → EBIT muito menor que EBITDA
  // Limites ajustados: Dív/EBIT 8-12x ≈ Dív/EBITDA 3-4x (aceitável no setor)
  const de = acao.divEbit
  if (de != null) {
    const m = 3.0
    const p = isUtilidade
      ? (de<0?3.0:de<3?3.0:de<5?2.2:de<8?1.2:de<12?0.4:de<16?0.1:0)
      : (de<0?3.0:de<1?3.0:de<2?2.2:de<3?1.2:de<4?0.4:0)
    const obs = isUtilidade ? ' (ref. Dív/EBIT setor elétrico)' : ''
    componentes.push({label:'Dív/EBIT', pts:p, max:m, detalhe:`Dív/EBIT = ${f2(de)}x → ${f2(p)} pts${obs}`})
  }

  // EV/EBIT — RAB elevado inflaciona EV; EV/EBITDA típico do setor: 8-15x
  // Limites ajustados: EV/EBIT 18-35x ≈ EV/EBITDA 8-12x (razoável para elétrica)
  const ee = acao.evEbit
  if (ee != null && ee > 0) {
    const m = 3.0
    const p = isUtilidade
      ? (ee<12?3.0:ee<18?2.1:ee<25?1.5:ee<35?0.9:ee<50?0.4:ee<65?0.1:0)
      : (ee<6?3.0:ee<9?2.1:ee<12?1.2:ee<16?0.3:0)
    const obs = isUtilidade ? ' (ref. EV/EBIT setor elétrico)' : ''
    componentes.push({label:'EV/EBIT', pts:p, max:m, detalhe:`EV/EBIT = ${f2(ee)}x → ${f2(p)} pts${obs}`})
  }

  // Governança, DCF e TIR — iguais para todos os setores
  const gov = acao.gov
  if (gov != null && gov > 0) {
    const m = 3.0; const p = Math.min(gov*(3.0/2.5), 3.0)
    componentes.push({label:'Governança', pts:p, max:m, detalhe:`GOV = ${f1(gov)}/2,5 → ${f2(p)} pts`})
  }
  const up = acao.dcfUpside
  if (up != null) {
    const m = 3.0; const p = up>=40?3.0:up>=30?2.4:up>=20?1.8:up>=10?1.2:up>=5?0.6:up>=0?0.2:0
    componentes.push({label:'DCF Upside', pts:p, max:m, detalhe:`Upside base = ${f1(up)}% → ${f2(p)} pts`})
  }
  const tir = acao.tirPremioNtnb
  if (tir != null) {
    const m = 3.0; const p = tir>=6?3.0:tir>=5?2.5:tir>=4?2.0:tir>=3?1.5:tir>=2?1.0:tir>=1?0.5:tir>=0?0.1:tir>=-1?-0.3:-0.6
    componentes.push({label:'TIR Real', pts:p, max:m, detalhe:`TIR Real +${f1(tir)}pp vs NTN-B → ${f2(p)} pts`})
  }

  const totalPts = componentes.reduce((s,c)=>s+c.pts, 0)
  const totalMax = componentes.reduce((s,c)=>s+c.max, 0)
  const nota = totalMax > 0 ? Math.round((totalPts/totalMax)*100)/10 : 0
  return { componentes, isUtilidade, nota }
}

// Retorna nota ajustada se for utilidade; null caso contrário (usa valor do JSON)
function notaAjustada(acao: Acao): number | null {
  if (!SETORES_UTILIDADE.includes(acao.setor ?? '')) return null
  return calcularNotaComponentes(acao).nota
}

function ModalDetalharNota({acao,onClose}:{acao:Acao;onClose:()=>void}) {
  const { componentes, isUtilidade, nota: notaCalc } = calcularNotaComponentes(acao)
  const totalPts = componentes.reduce((s,c)=>s+c.pts, 0)
  const totalMax = componentes.reduce((s,c)=>s+c.max, 0)
  const notaDisplay = isUtilidade ? notaCalc : (acao.nota ?? 0)
  const corNota = notaDisplay>=7?'#66BB6A':notaDisplay>=5?'#FFD54F':'#EF9A9A'
  return (
    <Modal title={`★ Detalhar Nota — ${acao.ticker} · ${acao.nome}`} onClose={onClose}>
      {isUtilidade && (
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',padding:'8px 12px',background:'rgba(100,181,246,.08)',border:'1px solid rgba(100,181,246,.2)',borderRadius:'8px'}}>
          <span style={{fontSize:'13px'}}>⚡</span>
          <span style={{fontSize:'12px',color:'#90CAF9'}}>Critérios ajustados para o <strong>setor elétrico</strong> — P/L, Dív/EBIT e EV/EBIT usam referências regulatórias da ANEEL</span>
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:'20px',marginBottom:'20px',padding:'16px',background:'rgba(232,160,32,.07)',border:'1px solid rgba(232,160,32,.18)',borderRadius:'10px'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:'48px',fontWeight:700,color:corNota,fontFamily:'Space Grotesk,sans-serif',lineHeight:1}}>{f1(notaDisplay)}</div>
          <div style={{fontSize:'11px',color:'#6b84a8',marginTop:'4px'}}>Nota Final (0–10)</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:'13px',color:'#b8c4d4',marginBottom:'6px'}}>Contribuição de cada componente</div>
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{background:'rgba(255,255,255,.07)',borderRadius:'6px',padding:'4px 10px',fontSize:'13px',fontWeight:600}}>{f2(totalPts)} pts obtidos</span>
            <span style={{color:'#6b84a8',alignSelf:'center'}}>/</span>
            <span style={{background:'rgba(255,255,255,.07)',borderRadius:'6px',padding:'4px 10px',fontSize:'13px',fontWeight:600}}>{f2(totalMax)} pts possíveis</span>
          </div>
        </div>
      </div>
      {componentes.map(c=>{
        const pct=c.max>0?(c.pts/c.max)*100:0
        const barColor=c.pts<0?'#ef4444':pct>=80?'#66BB6A':pct>=50?'#FFD54F':'#EF9A9A'
        return (
          <div key={c.label} style={{marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
              <span style={{fontSize:'13px',color:'#e8edf5',fontWeight:600}}>{c.label}</span>
              <span style={{fontSize:'12px',color:'#6b84a8'}}>{c.detalhe}</span>
            </div>
            <div style={{height:'8px',background:'rgba(255,255,255,.07)',borderRadius:'4px',overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.max(0,pct)}%`,background:barColor,borderRadius:'4px'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:'3px'}}>
              <span style={{fontSize:'11px',color:barColor,fontWeight:600}}>{f2(c.pts)} / {f2(c.max)} pts</span>
              <span style={{fontSize:'11px',color:'#6b84a8'}}>{f1(pct)}%</span>
            </div>
          </div>
        )
      })}
    </Modal>
  )
}

function exportarCSV(acoes:Acao[]) {
  const cab=['Ticker','Nome','Setor','Preço','DY%','P/L','P/VP','ROE%','LPA','Dív/EBIT','VPA','Merc.(Bi)','EV/EBIT','Máx.52s','Queda%','Var.Dia%','GOV','NOTA']
  const linhas=acoes.map(a=>[a.ticker,a.nome,a.setor,a.preco??'',a.dy??'',a.pl??'',a.pvp??'',a.roe??'',a.lpa??'',a.divEbit??'',a.vpa??'',a.merc??'',a.evEbit??'',a.max52s??'',a.varVsMax??'',a.variacao??'',a.gov??'',a.nota??''].map(v=>String(v).replace(/;/g,' ')).join(';'))
  const csv='﻿'+[cab.join(';'),...linhas].join('\r\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=url;a.download=`radar-invest-pro-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)
}

function ModalIndicarEmpresa({onClose}:{onClose:()=>void}) {
  const [ticker,  setTicker]  = useState('')
  const [nome,    setNome]    = useState('')
  const [motivo,  setMotivo]  = useState('')
  const [sending, setSending] = useState(false)
  const [msg,     setMsg]     = useState<{ok:boolean;txt:string}|null>(null)

  async function enviar() {
    if (!ticker.trim()) { setMsg({ok:false,txt:'Informe o ticker da empresa.'}); return }
    setSending(true); setMsg(null)
    try {
      const r = await fetch('/api/pagamento/indicar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ticker: ticker.trim(), nome: nome.trim(), motivo: motivo.trim() }),
      })
      const d = await r.json()
      if (r.ok) setMsg({ok:true,  txt:`✓ ${ticker.toUpperCase()} indicada com sucesso! Analisaremos e priorizaremos no roadmap.`})
      else      setMsg({ok:false, txt: d.erro || 'Erro ao enviar.'})
    } catch { setMsg({ok:false,txt:'Erro de conexão. Tente novamente.'}) }
    finally { setSending(false) }
  }

  const inp: React.CSSProperties = {
    width:'100%', background:'#0a1628', border:'1px solid rgba(255,255,255,.12)',
    borderRadius:8, padding:'10px 14px', color:'#e8edf5', fontSize:14,
    outline:'none', fontFamily:'inherit', marginBottom:12,
  }

  return (
    <Modal title="⭐ Indicar Empresa para Análise" onClose={onClose}>
      <p style={{color:'#6b84a8',fontSize:13,marginBottom:20,lineHeight:1.6}}>
        Como assinante Pro, você pode indicar <strong style={{color:'#e8a020'}}>1 empresa por mês</strong> para
        priorizarmos no nosso roadmap de análise. Sua indicação vai direto para o analista.
      </p>
      <label style={{fontSize:12,color:'#6b84a8',display:'block',marginBottom:4,fontWeight:600,letterSpacing:.5}}>TICKER *</label>
      <input style={{...inp, textTransform:'uppercase'}} placeholder="Ex: WEGE3" value={ticker}
        onChange={e=>setTicker(e.target.value.toUpperCase())} maxLength={8}/>
      <label style={{fontSize:12,color:'#6b84a8',display:'block',marginBottom:4,fontWeight:600,letterSpacing:.5}}>NOME DA EMPRESA (opcional)</label>
      <input style={inp} placeholder="Ex: WEG S.A." value={nome} onChange={e=>setNome(e.target.value)} maxLength={80}/>
      <label style={{fontSize:12,color:'#6b84a8',display:'block',marginBottom:4,fontWeight:600,letterSpacing:.5}}>POR QUE QUER ANALISAR? (opcional)</label>
      <textarea style={{...inp, height:80, resize:'vertical'}} placeholder="Ex: Empresa com sólido histórico de crescimento de dividendos e boa governança…"
        value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={400}/>
      {msg && (
        <div style={{padding:'10px 14px', borderRadius:8, marginBottom:12, fontSize:13, fontWeight:600,
          background: msg.ok ? 'rgba(102,187,106,.12)' : 'rgba(239,68,68,.1)',
          border: `1px solid ${msg.ok ? 'rgba(102,187,106,.3)' : 'rgba(239,68,68,.3)'}`,
          color: msg.ok ? '#66BB6A' : '#f87171'}}>
          {msg.txt}
        </div>
      )}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{padding:'9px 20px',borderRadius:8,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',color:'#b8c4d4',cursor:'pointer',fontSize:13}}>
          Cancelar
        </button>
        <button onClick={enviar} disabled={sending||!!msg?.ok}
          style={{padding:'9px 24px',borderRadius:8,background: msg?.ok ? '#66BB6A' : '#e8a020',border:'none',color:'#000',fontWeight:700,cursor:'pointer',fontSize:13,opacity:sending?0.7:1}}>
          {sending ? 'Enviando…' : msg?.ok ? 'Enviado!' : 'Enviar indicação'}
        </button>
      </div>
    </Modal>
  )
}

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
  const [modalGov,     setModalGov]     = useState<Acao|null>(null)
  const [modalNota,        setModalNota]        = useState<Acao|null>(null)
  const [modalUpgradeNota, setModalUpgradeNota] = useState(false)
  const [modalIndicar,     setModalIndicar]     = useState(false)
  const [planoUsuario, setPlanoUsuario] = useState<string>('gratuito')

  const carregarDados = useCallback(()=>{
    setLoading(true); setErro('')
    fetch('/api/acoes')
      .then(r=>{if(!r.ok)throw new Error();return r.json()})
      .then(d=>{setAcoes(d.acoes??[]);setTs(d.ts?new Date(d.ts).toLocaleString('pt-BR'):'' )})
      .catch(()=>setErro('Falha ao carregar dados.'))
      .finally(()=>setLoading(false))
  },[])

  useEffect(()=>{
    carregarDados()
    fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(d?.plano) setPlanoUsuario(d.plano) }).catch(()=>{})
  },[carregarDados])

  const toggleSort=(k:SortKey)=>{
    if(sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc')
    else{setSortKey(k);setSortDir('asc')}
  }

  const setoresDisponiveis = useMemo(()=>{
    const s=new Set(acoes.map(a=>a.setor??'').filter(Boolean))
    return ['Todos',...[...s].sort((a,b)=>a.localeCompare(b,'pt-BR'))]
  },[acoes])

  const filtradas=useMemo(()=>{
    let l=acoes
    if(busca) l=l.filter(a=>a.ticker.toLowerCase().includes(busca.toLowerCase())||(a.nome??'').toLowerCase().includes(busca.toLowerCase()))
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
    <th onClick={()=>toggleSort(k)} title={title}>{label}{sortKey===k?(sortDir==='asc'?' ▲':' ▼'):''}</th>
  )
  const al30=acoes.filter(a=>a.varVsMax!=null&&a.varVsMax<=-30).length
  const al15=acoes.filter(a=>a.varVsMax!=null&&a.varVsMax<=-15&&a.varVsMax>-30).length

  // usar dados do JSON local para enriquecer nome/setor se vier null da API
  const dadosEnriquecidos = useMemo(() => filtradas.map(a => ({
    ...a,
    nome: a.nome || fundamentais[a.ticker]?.nome || a.ticker,
    setor: a.setor || fundamentais[a.ticker]?.setor || '—',
  })), [filtradas])

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5;overflow:hidden}
        .page{display:flex;flex-direction:column;height:calc(100vh - 44px)}
        .toolbar{flex-shrink:0;background:#081120;border-bottom:1px solid rgba(255,255,255,.07);padding:0 20px;display:flex;align-items:center;gap:10px;height:52px;overflow-x:auto}
        .inp{background:#0d1a2e;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:8px 13px;color:#e8edf5;font-size:13px;outline:none;transition:border-color .2s;font-family:inherit;flex-shrink:0}
        .inp:focus{border-color:rgba(232,160,32,.5)}
        .inp::placeholder{color:#6b84a8}
        .inp-search{width:200px}.inp-setor{width:190px}.inp-preco{width:90px}
        .btn-filtrar{background:#e8a020;color:#000;font-weight:700;font-size:12px;padding:7px 16px;border-radius:7px;border:none;cursor:pointer;flex-shrink:0}
        .btn-filtrar:hover{background:#f5c55a}
        .btn-limpar{background:transparent;border:1px solid rgba(255,255,255,.15);color:#6b84a8;font-size:12px;font-weight:600;padding:7px 12px;border-radius:7px;cursor:pointer;flex-shrink:0}
        .btn-limpar:hover{color:#e8edf5}
        .btn-act{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#b8c4d4;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;gap:5px}
        .btn-act:hover{background:rgba(255,255,255,.1);color:#fff}
        .btn-gold{background:rgba(232,160,32,.12);border-color:rgba(232,160,32,.3);color:#e8a020}
        .btn-gold:hover{background:rgba(232,160,32,.22)}
        .btn-gold:disabled{opacity:.5;cursor:not-allowed}
        .ts-label{font-size:11px;color:#6b84a8;white-space:nowrap;margin-left:auto;flex-shrink:0}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .resumo{flex-shrink:0;display:flex;gap:20px;padding:9px 20px;background:#081120;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap;align-items:center}
        .resumo-item{font-size:11px;color:#6b84a8;display:flex;align-items:baseline;gap:6px}
        .resumo-num{font-family:var(--font-space),'Space Grotesk',sans-serif;font-size:17px;font-weight:700;color:#e8edf5}
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

      <NavBar />

      <div className="page">
        {/* FILTROS + AÇÕES */}
        <div className="toolbar">
          <input className="inp inp-search" placeholder="Buscar ticker ou nome…" value={busca} onChange={e=>setBusca(e.target.value)}/>
          <select className="inp inp-setor" value={setor} onChange={e=>setSetor(e.target.value)}>
            {setoresDisponiveis.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <input className="inp inp-preco" placeholder="Preço min" value={precoMin} onChange={e=>setPrecoMin(e.target.value)}/>
          <input className="inp inp-preco" placeholder="Preço max" value={precoMax} onChange={e=>setPrecoMax(e.target.value)}/>
          <button className="btn-filtrar">Filtrar</button>
          <button className="btn-limpar" onClick={limpar}>Limpar</button>
          <button className="btn-act" onClick={()=>exportarCSV(dadosEnriquecidos)}>⬇ Excel</button>
          <button className="btn-act btn-gold" disabled={loading} onClick={carregarDados}>
            {loading?'⟳ …':'↻ Atualizar'}
          </button>
          {planoUsuario==='pro' && (
            <button className="btn-act" onClick={()=>setModalIndicar(true)}
              style={{borderColor:'rgba(232,160,32,.35)',color:'#e8a020'}}>
              ⭐ Indicar Empresa
            </button>
          )}
          {ts&&<span className="ts-label">Fund.: {ts}</span>}
        </div>

        <div className="main">
          {!loading&&!erro&&(
            <div className="resumo">
              <div className="resumo-item"><span className="resumo-num">{dadosEnriquecidos.length}</span>ações</div>
              <div className="resumo-item"><span className="resumo-num">{dadosEnriquecidos.filter(a=>a.preco!=null).length}</span>com preço</div>
              <div className="resumo-item" style={{color:'#ef4444'}}><span className="resumo-num" style={{color:'#ef4444'}}>{al30}</span>alerta −30%</div>
              <div className="resumo-item" style={{color:'#f5c55a'}}><span className="resumo-num" style={{color:'#f5c55a'}}>{al15}</span>alerta −15%</div>
              <div className="resumo-item" style={{marginLeft:'auto',fontSize:'12px',color:'#6b84a8'}}>
                GOV: <strong style={{color:'#e8a020'}}>{acoes.filter(a=>a.gov!=null&&a.gov>0).length}</strong>/{acoes.length}
              </div>
            </div>
          )}

          {loading&&<div className="loading-box"><div className="spinner"/><p style={{color:'#6b84a8',fontSize:'13px'}}>Buscando dados da B3…</p></div>}
          {!loading&&erro&&<div className="erro-box">{erro}</div>}

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
                    <Th k="gov"      label="GOV 🏛"    title="Score de Governança (0–3,0)"/>
                    <Th k="nota"     label="NOTA ★"    title="Nota fundamentalista (0–10)"/>
                  </tr>
                </thead>
                <tbody>
                  {dadosEnriquecidos.length===0
                    ?<tr className="empty-row"><td colSpan={18}>Nenhuma ação encontrada.</td></tr>
                    :dadosEnriquecidos.map(a=>{
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
                          <NotaCell v={notaAjustada(a) ?? a.nota} bloqueado={planoUsuario==='gratuito'} onClick={planoUsuario==='gratuito'?()=>setModalUpgradeNota(true):()=>setModalNota(a)}/>
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

      {modalGov         && <ModalGovernanca   acao={modalGov}  onClose={()=>setModalGov(null)}/>}
      {modalNota        && <ModalDetalharNota acao={modalNota} onClose={()=>setModalNota(null)}/>}
      {modalUpgradeNota && <ModalUpgradeNota                   onClose={()=>setModalUpgradeNota(false)}/>}
      {modalIndicar     && <ModalIndicarEmpresa onClose={()=>setModalIndicar(false)}/>}
    </>
  )
}
