'use client'
import { useEffect, useState } from 'react'
import NavBar from '@/components/NavBar'

interface Metrica {
  key: string; label: string; unidade: string
  verde: number; vermelho: number; sentido: 'maior' | 'menor'
}
interface Config {
  id: number; ticker: string; nome: string
  metricas: Metrica[]; stops: string[]
}
interface Entrada {
  id: number; ticker: string; trimestre: string
  pld: number|null; gsf: number|null; rap: number|null
  pmso: number|null; dl_ebitda: number|null; lucro: number|null
  tir_real: number|null; observacoes: string|null
}

function semaforo(valor: number|null, m: Metrica): 'verde'|'amarelo'|'vermelho'|'cinza' {
  if (valor == null) return 'cinza'
  if (m.sentido === 'maior') {
    if (valor >= m.verde)   return 'verde'
    if (valor >= m.vermelho) return 'amarelo'
    return 'vermelho'
  } else {
    if (valor <= m.verde)   return 'verde'
    if (valor <= m.vermelho) return 'amarelo'
    return 'vermelho'
  }
}

const COR: Record<string, string> = {
  verde:    '#66BB6A',
  amarelo:  '#FFD54F',
  vermelho: '#EF5350',
  cinza:    '#4a5d73',
}

const ICON: Record<string, string> = {
  verde: '●', amarelo: '●', vermelho: '●', cinza: '○'
}

function fmt(v: number|null, u: string): string {
  if (v == null) return '—'
  if (u === '%' || u === 'p.p.') return v.toLocaleString('pt-BR', {maximumFractionDigits:1}) + u
  if (u === 'x') return v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + 'x'
  if (u === 'R$ MM') return 'R$ ' + v.toLocaleString('pt-BR', {maximumFractionDigits:0}) + ' MM'
  if (u === 'R$/MWh') return 'R$ ' + v.toLocaleString('pt-BR', {maximumFractionDigits:0}) + '/MWh'
  return String(v) + ' ' + u
}

function getValor(e: Entrada, key: string): number|null {
  const map: Record<string, keyof Entrada> = {
    pld:'pld', gsf:'gsf', rap:'rap', pmso:'pmso', dl_ebitda:'dl_ebitda', tir_real:'tir_real'
  }
  return e[map[key]] as number|null
}

// ─── Modal de nova entrada ────────────────────────────────────────────────────
function ModalEntrada({ ticker, onClose, onSave }: { ticker: string; onClose: ()=>void; onSave: ()=>void }) {
  const [form, setForm] = useState({ trimestre:'', pld:'', gsf:'', rap:'', pmso:'', dl_ebitda:'', lucro:'', tir_real:'', observacoes:'' })
  const [saving, setSaving]     = useState(false)
  const [urlRelease, setUrl]    = useState('')
  const [parseando, setParseando] = useState(false)
  const [parseMsg, setParseMsg] = useState('')
  const set = (k: string, v: string) => setForm(f=>({...f,[k]:v}))
  const num = (v: string) => v === '' ? null : parseFloat(v.replace(',','.'))

  async function importarRelease() {
    if (!urlRelease.trim()) return
    setParseando(true)
    setParseMsg('')
    try {
      const r = await fetch('/api/teses/parse', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ url: urlRelease.trim() }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) { setParseMsg(d.erro || 'Erro ao processar o documento.'); return }

      const novo = { ...form }
      const dados = d.dados as Record<string, number|string|null>
      if (dados.trimestre) novo.trimestre = String(dados.trimestre)
      if (dados.pld       != null) novo.pld       = String(dados.pld)
      if (dados.gsf       != null) novo.gsf       = String(dados.gsf)
      if (dados.rap       != null) novo.rap       = String(dados.rap)
      if (dados.pmso      != null) novo.pmso      = String(dados.pmso)
      if (dados.dl_ebitda != null) novo.dl_ebitda = String(dados.dl_ebitda)
      if (dados.lucro     != null) novo.lucro     = String(dados.lucro)
      if (dados.tir_real  != null) novo.tir_real  = String(dados.tir_real)
      setForm(novo)
      setParseMsg(`✓ ${d.extraidos} campo(s) preenchido(s) automaticamente. Revise e ajuste se necessário.`)
    } catch {
      setParseMsg('Erro de conexão ao tentar ler o release.')
    } finally {
      setParseando(false)
    }
  }

  async function salvar() {
    if (!form.trimestre.trim()) return alert('Informe o trimestre (ex: 2T26)')
    setSaving(true)
    await fetch('/api/teses', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tipo:'entrada', ticker, trimestre: form.trimestre.trim().toUpperCase(),
        pld: num(form.pld), gsf: num(form.gsf), rap: num(form.rap),
        pmso: num(form.pmso), dl_ebitda: num(form.dl_ebitda),
        lucro: num(form.lucro), tir_real: num(form.tir_real),
        observacoes: form.observacoes }),
    })
    setSaving(false)
    onSave()
    onClose()
  }

  const campos = [
    { key:'trimestre', label:'Trimestre',              placeholder:'ex: 2T26',  tipo:'text'   },
    { key:'pld',       label:'PLD médio (R$/MWh)',      placeholder:'ex: 260',   tipo:'number' },
    { key:'gsf',       label:'GSF (%)',                 placeholder:'ex: 91',    tipo:'number' },
    { key:'rap',       label:'RAP trimestral (R$ MM)',  placeholder:'ex: 4200',  tipo:'number' },
    { key:'pmso',      label:'PMSO trimestral (R$ MM)', placeholder:'ex: 1500',  tipo:'number' },
    { key:'dl_ebitda', label:'DL/EBITDA (x)',           placeholder:'ex: 1.9',   tipo:'number' },
    { key:'lucro',     label:'Lucro líquido (R$ MM)',   placeholder:'ex: 3707',  tipo:'number' },
    { key:'tir_real',  label:'TIR Real vs NTN-B (p.p.)',placeholder:'ex: 3.2',   tipo:'number' },
  ]

  const inputStyle: React.CSSProperties = {
    width:'100%', background:'#1a2632', border:'1px solid rgba(255,255,255,.1)',
    borderRadius:'6px', padding:'9px 12px', fontSize:'13px', color:'#e0e0e0',
    outline:'none', boxSizing:'border-box',
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
         onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#0d1a2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:'14px',width:'100%',maxWidth:'520px',padding:'28px',overflowY:'auto',maxHeight:'90vh'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <h2 style={{fontSize:'15px',fontWeight:700,color:'#e8edf5'}}>Nova entrada — {ticker}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer'}}>×</button>
        </div>

        {/* ── Auto-preenchimento via URL ── */}
        <div style={{background:'rgba(21,101,192,.08)',border:'1px solid rgba(21,101,192,.25)',borderRadius:'10px',padding:'14px 16px',marginBottom:'18px'}}>
          <div style={{fontSize:'11px',color:'#90CAF9',fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'8px'}}>
            ⚡ Importar dados do release
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <input
              type="url"
              placeholder="Cole aqui a URL do release (PDF ou Excel do RI)..."
              value={urlRelease}
              onChange={e=>setUrl(e.target.value)}
              style={{...inputStyle, flex:1, fontSize:'12px'}}
            />
            <button onClick={importarRelease} disabled={parseando || !urlRelease.trim()}
              style={{background:parseando?'#1a2632':'rgba(21,101,192,.7)',color:'#fff',border:'none',borderRadius:'6px',padding:'9px 14px',fontSize:'12px',fontWeight:700,cursor:parseando||!urlRelease.trim()?'not-allowed':'pointer',whiteSpace:'nowrap'}}>
              {parseando ? '...' : 'Importar'}
            </button>
          </div>
          {parseMsg && (
            <div style={{marginTop:'8px',fontSize:'12px',color: parseMsg.startsWith('✓') ? '#66BB6A' : '#EF5350'}}>
              {parseMsg}
            </div>
          )}
          <div style={{marginTop:'6px',fontSize:'11px',color:'#4a5d73'}}>
            Funciona com releases em PDF ou Excel do site de RI da empresa.
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {campos.map(c=>(
            <div key={c.key}>
              <label style={{display:'block',fontSize:'11px',color:'#6b84a8',fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.5px'}}>{c.label}</label>
              <input type={c.tipo} placeholder={c.placeholder}
                value={(form as Record<string,string>)[c.key]}
                onChange={e=>set(c.key,e.target.value)}
                style={inputStyle}/>
            </div>
          ))}
          <div>
            <label style={{display:'block',fontSize:'11px',color:'#6b84a8',fontWeight:600,marginBottom:'4px',textTransform:'uppercase',letterSpacing:'.5px'}}>Observações</label>
            <textarea rows={3} value={form.observacoes} onChange={e=>set('observacoes',e.target.value)}
              placeholder="Contexto do trimestre, principais eventos..."
              style={{...inputStyle, resize:'vertical'}}/>
          </div>
          <button onClick={salvar} disabled={saving}
            style={{background:saving?'#1a2632':'#1565C0',color:'#fff',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:700,cursor:saving?'not-allowed':'pointer',marginTop:'4px'}}>
            {saving?'Salvando...':'Salvar entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de tese ──────────────────────────────────────────────────────────────
function CardTese({ config, entradas, onNovaEntrada, forceExpandido }: {
  config: Config; entradas: Entrada[]; onNovaEntrada: ()=>void; forceExpandido?: boolean
}) {
  const ultima = entradas[0]
  const [expandido, setExpandido] = useState(true)

  // Sincroniza com o toggle global quando ele muda
  useEffect(() => {
    if (forceExpandido !== undefined) setExpandido(forceExpandido)
  }, [forceExpandido])

  // Detecta stops ativados
  const stopsAtivados: string[] = []
  if (ultima) {
    // GSF < 82 por 2 tri consecutivos
    const gsfsRecentes = entradas.slice(0,2).map(e=>e.gsf)
    if (gsfsRecentes.length===2 && gsfsRecentes.every(g=>g!=null&&g<82)) {
      const pldRecente = entradas.slice(0,2).every(e=>e.pld!=null&&e.pld<180)
      if (pldRecente) stopsAtivados.push(config.stops[0])
    }
    if (ultima.dl_ebitda != null && ultima.dl_ebitda > 3.0) stopsAtivados.push(config.stops[1])
    if (ultima.tir_real != null && ultima.tir_real < 1.0) stopsAtivados.push(config.stops[2])
  }

  return (
    <div style={{background:'#0d1a2e',border:'1px solid rgba(255,255,255,.08)',borderRadius:'14px',marginBottom:'20px',overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,.06)',cursor:'pointer'}}
           onClick={()=>setExpandido(x=>!x)}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{background:'rgba(232,160,32,.12)',border:'1px solid rgba(232,160,32,.3)',borderRadius:'8px',padding:'6px 12px'}}>
            <span style={{fontSize:'14px',fontWeight:800,color:'#e8a020'}}>{config.ticker}</span>
          </div>
          <div>
            <div style={{fontSize:'14px',fontWeight:600,color:'#e8edf5'}}>{config.nome}</div>
            <div style={{fontSize:'11px',color:'#4a5d73',marginTop:'2px'}}>
              {entradas.length} {entradas.length===1?'entrada':'entradas'} · último: {ultima?.trimestre ?? '—'}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {stopsAtivados.length > 0 && (
            <span style={{background:'rgba(239,83,80,.15)',border:'1px solid rgba(239,83,80,.4)',borderRadius:'6px',padding:'3px 10px',fontSize:'11px',fontWeight:700,color:'#EF5350'}}>
              ⚠ STOP ATIVADO
            </span>
          )}
          <button onClick={e=>{e.stopPropagation();onNovaEntrada()}}
            style={{background:'rgba(21,101,192,.2)',border:'1px solid rgba(21,101,192,.4)',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',fontWeight:600,color:'#90CAF9',cursor:'pointer'}}>
            + Entrada
          </button>
          <span style={{color:'#4a5d73',fontSize:'14px'}}>{expandido?'▲':'▼'}</span>
        </div>
      </div>

      {expandido && (
        <div style={{padding:'20px'}}>

          {/* Stops de tese */}
          <div style={{marginBottom:'20px'}}>
            <div style={{fontSize:'11px',fontWeight:700,color:'#6b84a8',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Stop de tese</div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {config.stops.map((s,i)=>{
                const ativo = stopsAtivados.includes(s)
                return (
                  <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'8px 12px',background:ativo?'rgba(239,83,80,.08)':'rgba(255,255,255,.02)',border:`1px solid ${ativo?'rgba(239,83,80,.3)':'rgba(255,255,255,.05)'}`,borderRadius:'8px'}}>
                    <span style={{fontSize:'13px',color:ativo?'#EF5350':'#4a5d73',marginTop:'1px',flexShrink:0}}>{ativo?'🔴':'○'}</span>
                    <span style={{fontSize:'12.5px',color:ativo?'#EF9A9A':'#6b84a8',lineHeight:1.5}}>{s}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Semáforo último trimestre */}
          {ultima && (
            <div style={{marginBottom:'20px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:'#6b84a8',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>
                Semáforo — {ultima.trimestre}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'8px'}}>
                {config.metricas.map(m=>{
                  const val = getValor(ultima, m.key)
                  const cor = semaforo(val, m)
                  return (
                    <div key={m.key} style={{background:'rgba(255,255,255,.03)',border:`1px solid ${COR[cor]}33`,borderRadius:'10px',padding:'10px 12px'}}>
                      <div style={{fontSize:'10px',color:'#6b84a8',fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'4px'}}>{m.label}</div>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <span style={{color:COR[cor],fontSize:'14px'}}>{ICON[cor]}</span>
                        <span style={{fontSize:'15px',fontWeight:700,color:COR[cor]}}>{fmt(val, m.unidade)}</span>
                      </div>
                      <div style={{fontSize:'10px',color:'#4a5d73',marginTop:'3px'}}>
                        verde {m.sentido==='maior'?'≥':'≤'} {fmt(m.verde, m.unidade)} · vermelho {m.sentido==='maior'?'<':'>'} {fmt(m.vermelho, m.unidade)}
                      </div>
                    </div>
                  )
                })}
              </div>
              {ultima.observacoes && (
                <div style={{marginTop:'10px',padding:'10px 14px',background:'rgba(255,255,255,.02)',borderRadius:'8px',fontSize:'12.5px',color:'#6b84a8',lineHeight:1.6,borderLeft:'2px solid rgba(255,255,255,.08)'}}>
                  {ultima.observacoes}
                </div>
              )}
            </div>
          )}

          {/* Histórico trimestral */}
          {entradas.length > 0 && (
            <div>
              <div style={{fontSize:'11px',fontWeight:700,color:'#6b84a8',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Histórico trimestral</div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12.5px'}}>
                  <thead>
                    <tr style={{borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                      <th style={{textAlign:'left',padding:'6px 10px',color:'#4a5d73',fontWeight:600}}>Tri</th>
                      {config.metricas.map(m=>(
                        <th key={m.key} style={{textAlign:'center',padding:'6px 8px',color:'#4a5d73',fontWeight:600,whiteSpace:'nowrap'}}>{m.label}</th>
                      ))}
                      <th style={{textAlign:'right',padding:'6px 10px',color:'#4a5d73',fontWeight:600}}>Lucro LL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entradas.map(e=>(
                      <tr key={e.id} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                        <td style={{padding:'8px 10px',color:'#e8edf5',fontWeight:700}}>{e.trimestre}</td>
                        {config.metricas.map(m=>{
                          const val = getValor(e, m.key)
                          const cor = semaforo(val, m)
                          return (
                            <td key={m.key} style={{textAlign:'center',padding:'8px 8px',color:COR[cor],fontWeight:600}}>
                              {fmt(val, m.unidade)}
                            </td>
                          )
                        })}
                        <td style={{textAlign:'right',padding:'8px 10px',color:'#b8c4d4'}}>
                          {e.lucro!=null ? `R$ ${Number(e.lucro).toLocaleString('pt-BR',{maximumFractionDigits:0})} MM` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {entradas.length === 0 && (
            <div style={{textAlign:'center',padding:'32px',color:'#4a5d73',fontSize:'13px'}}>
              Nenhuma entrada ainda. Clique em "+ Entrada" para registrar o primeiro trimestre.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function TesesPage() {
  const [configs,  setConfigs]  = useState<Config[]>([])
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modalTicker, setModalTicker] = useState<string|null>(null)
  const [todasExpandidas, setTodasExpandidas] = useState<boolean | undefined>(undefined)
  const [versaoToggle, setVersaoToggle] = useState(0) // força re-render do useEffect nos cards

  async function carregar() {
    setLoading(true)
    const r = await fetch('/api/teses')
    if (r.ok) {
      const d = await r.json()
      setConfigs(d.configs ?? [])
      setEntradas(d.entradas ?? [])
    }
    setLoading(false)
  }

  function toggleTodas() {
    setTodasExpandidas(v => {
      const novo = v === false ? true : false  // alterna entre retrair e expandir
      return novo
    })
    setVersaoToggle(v => v + 1)
  }

  useEffect(() => { carregar() }, [])

  const temAlgumStop = configs.some(cfg => {
    const ultima = entradas.filter(e=>e.ticker===cfg.ticker)[0]
    if (!ultima) return false
    // Verifica ROE (gsf field) < vermelho para bancos
    const m = cfg.metricas.find((m: {key:string}) => m.key === 'gsf')
    return m && ultima.gsf != null && (m as {sentido:string;vermelho:number}).sentido === 'maior' && ultima.gsf < (m as {vermelho:number}).vermelho
  })

  return (
    <>
      <NavBar />
      <div style={{minHeight:'100vh',background:'#050d1a',padding:'24px',color:'#e8edf5',fontFamily:'Inter,sans-serif'}}>
        <div style={{maxWidth:'1000px',margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
            <div>
              <h1 style={{fontSize:'20px',fontWeight:700,color:'#e8edf5',margin:0}}>Monitoramento de Teses</h1>
              <p style={{fontSize:'13px',color:'#4a5d73',margin:'4px 0 0'}}>
                Acompanhamento trimestral · {configs.length} empresas
                {temAlgumStop && <span style={{color:'#EF5350',marginLeft:'8px',fontWeight:600}}>⚠ Stop ativo</span>}
              </p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              {/* Legenda */}
              <div style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'12px',color:'#6b84a8'}}>
                <span><span style={{color:'#66BB6A'}}>●</span> Tese intacta</span>
                <span><span style={{color:'#FFD54F'}}>●</span> Atenção</span>
                <span><span style={{color:'#EF5350'}}>●</span> Stop</span>
              </div>
              {/* Botão Retrair/Expandir Todas */}
              <button
                onClick={toggleTodas}
                style={{
                  background:'rgba(255,255,255,.05)',
                  border:'1px solid rgba(255,255,255,.12)',
                  borderRadius:'7px',
                  padding:'7px 14px',
                  fontSize:'12px',
                  fontWeight:600,
                  color:'#a0b4c8',
                  cursor:'pointer',
                  display:'flex',
                  alignItems:'center',
                  gap:'6px',
                  transition:'background .15s',
                }}
              >
                {todasExpandidas === false ? '▼ Expandir Todas' : '▲ Retrair Todas'}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:'60px',color:'#4a5d73'}}>Carregando...</div>
          ) : (
            configs.map(cfg=>(
              <CardTese
                key={`${cfg.ticker}-${versaoToggle}`}
                config={cfg}
                entradas={entradas.filter(e=>e.ticker===cfg.ticker)}
                onNovaEntrada={()=>setModalTicker(cfg.ticker)}
                forceExpandido={todasExpandidas}
              />
            ))
          )}

          {configs.length === 0 && !loading && (
            <div style={{textAlign:'center',padding:'60px',color:'#4a5d73',fontSize:'14px'}}>
              Nenhuma tese configurada.
            </div>
          )}
        </div>
      </div>

      {modalTicker && (
        <ModalEntrada
          ticker={modalTicker}
          onClose={()=>setModalTicker(null)}
          onSave={carregar}
        />
      )}
    </>
  )
}
