'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Plano = 'gratuito' | 'essencial' | 'pro' | 'analista'

interface Usuario {
  id:         number
  username:   string
  nome:       string
  email:      string
  plano:      Plano
  ativo:      number
  criado_em:  string
}

interface Posicao {
  id:               number
  ticker:           string
  quantidade:       number
  preco_medio:      number
  data_compra:      string | null
  notas:            string | null
  excluir_calculo:  boolean
  preco_atual?:     number | null
  variacao?:        number | null
}

const PLANOS: Plano[] = ['gratuito', 'essencial', 'pro', 'analista']

const PLANO_COLOR: Record<Plano, string> = {
  gratuito: '#546E7A',
  essencial: '#1565C0',
  pro:       '#6A1B9A',
  analista:  '#e8a020',
}

const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fR = (v: number | null | undefined) => v == null ? '—' : `R$ ${f2(v)}`

const corRes = (v: number | null | undefined) =>
  v == null ? '#8a9bb5' : v > 0 ? '#66BB6A' : v < 0 ? '#ef5350' : '#8a9bb5'

/* ── Modal Carteira do Usuário ──────────────────────────────────────────────── */
function ModalCarteira({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [posicoes, setPosicoes]     = useState<Posicao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro]             = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    try {
      const r = await fetch(`/api/admin/carteira/${usuario.id}`)
      const d = await r.json()
      if (!r.ok) { setErro(d.erro || 'Erro ao carregar.'); return }
      setPosicoes(d.carteira ?? [])
    } catch { setErro('Erro de conexão.') }
    finally   { setCarregando(false) }
  }, [usuario.id])

  useEffect(() => { carregar() }, [carregar])

  async function buscarCotacoes() {
    if (posicoes.length === 0) return
    setAtualizando(true)
    try {
      const tickers = posicoes.map(p => p.ticker).join(',')
      const r = await fetch(`/api/cotacoes?tickers=${tickers}`)
      const d = await r.json()
      const map: Record<string, { preco: number | null; variacao: number | null }> = {}
      for (const c of d.cotacoes ?? []) map[c.ticker] = c
      setPosicoes(prev => prev.map(p => ({
        ...p,
        preco_atual: map[p.ticker]?.preco ?? null,
        variacao:    map[p.ticker]?.variacao ?? null,
      })))
    } catch { /* silencioso */ }
    finally { setAtualizando(false) }
  }

  useEffect(() => {
    if (!carregando && posicoes.length > 0) buscarCotacoes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando])

  const ativas   = posicoes.filter(p => !p.excluir_calculo)
  const investido = ativas.reduce((s, p) => s + p.quantidade * p.preco_medio, 0)
  const atual     = ativas.reduce((s, p) => s + p.quantidade * (p.preco_atual ?? p.preco_medio), 0)
  const pl        = atual - investido
  const plPct     = investido > 0 ? (pl / investido) * 100 : 0

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
    >
      <div style={{ background:'#0d1a2e', border:'1px solid rgba(255,255,255,.12)', borderRadius:'14px', width:'100%', maxWidth:'900px', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'16px', fontWeight:700, color:'#e8edf5' }}>📊 Carteira — {usuario.nome}</span>
              <span style={{ fontSize:'12px', color:'#6b84a8' }}>@{usuario.username}</span>
            </div>
            <div style={{ fontSize:'12px', color:'#3d4f6a', marginTop:'3px' }}>{usuario.email}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b84a8', fontSize:'22px', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Resumo P&L */}
        {!carregando && posicoes.length > 0 && (
          <div style={{ display:'flex', gap:'24px', padding:'14px 24px', borderBottom:'1px solid rgba(255,255,255,.06)', background:'rgba(255,255,255,.02)', flexWrap:'wrap' }}>
            <div style={{ fontSize:'13px', color:'#6b84a8' }}>Investido: <strong style={{ color:'#e8edf5' }}>{fR(investido)}</strong></div>
            <div style={{ fontSize:'13px', color:'#6b84a8' }}>Atual: <strong style={{ color:'#e8edf5' }}>{fR(atual)}</strong></div>
            <div style={{ fontSize:'13px', color:'#6b84a8' }}>P&L:
              <strong style={{ color: corRes(pl), marginLeft:'6px' }}>
                {fR(pl)} ({pl >= 0 ? '+' : ''}{f2(plPct)}%)
              </strong>
            </div>
            <button
              onClick={buscarCotacoes}
              disabled={atualizando}
              style={{ marginLeft:'auto', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'#b8c4d4', padding:'5px 14px', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:600 }}
            >
              {atualizando ? '⟳ Atualizando…' : '⟳ Atualizar cotações'}
            </button>
          </div>
        )}

        {/* Corpo */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {carregando && (
            <div style={{ textAlign:'center', padding:'48px', color:'#6b84a8', fontSize:'13px' }}>Carregando carteira…</div>
          )}
          {!carregando && erro && (
            <div style={{ padding:'24px', color:'#ef5350', textAlign:'center', fontSize:'13px' }}>{erro}</div>
          )}
          {!carregando && !erro && posicoes.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'#4a5d73', fontSize:'14px' }}>
              Nenhuma posição na carteira deste usuário.
            </div>
          )}
          {!carregando && !erro && posicoes.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12.5px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                  {['Ticker','Qtde','P.Médio','P.Atual','Res.Un','Res.Total','Res.%','Valor Atu.','Excluído'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign: h === 'Ticker' ? 'left' : 'right', fontSize:'10.5px', fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:'#4a5d73', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posicoes.map((p, i) => {
                  const pA      = p.preco_atual ?? null
                  const resUn   = pA != null ? pA - p.preco_medio : null
                  const resTotal= pA != null ? (pA - p.preco_medio) * p.quantidade : null
                  const resPct  = pA != null && p.preco_medio > 0 ? ((pA - p.preco_medio) / p.preco_medio) * 100 : null
                  const valorAtu= pA != null ? pA * p.quantidade : p.preco_medio * p.quantidade
                  return (
                    <tr key={p.id} style={{ borderBottom: i < posicoes.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', opacity: p.excluir_calculo ? .5 : 1 }}>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#e8a020', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                        {p.ticker}
                        {p.excluir_calculo && <span style={{ fontSize:'9px', background:'rgba(255,255,255,.08)', color:'#6b84a8', borderRadius:'3px', padding:'1px 5px', marginLeft:'5px', fontFamily:'sans-serif' }}>excluído</span>}
                      </td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:'#e8edf5' }}>{f2(p.quantidade)}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:'#e8edf5' }}>{fR(p.preco_medio)}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color: pA ? '#e8edf5' : '#4a5d73' }}>{pA ? fR(pA) : atualizando ? '…' : '—'}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color: corRes(resUn) }}>{resUn != null ? fR(resUn) : '—'}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color: corRes(resTotal) }}>{resTotal != null ? fR(resTotal) : '—'}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color: corRes(resPct) }}>{resPct != null ? `${resPct >= 0 ? '+' : ''}${f2(resPct)}%` : '—'}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:'#e8edf5', fontWeight:600 }}>{fR(valorAtu)}</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color: p.excluir_calculo ? '#ef5350' : '#4a5d73' }}>{p.excluir_calculo ? 'Sim' : 'Não'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding:'12px 24px', borderTop:'1px solid rgba(255,255,255,.06)', fontSize:'12px', color:'#3d4f6a' }}>
          {posicoes.length} posição(ões) · {posicoes.filter(p => p.excluir_calculo).length} excluída(s) do cálculo
        </div>
      </div>
    </div>
  )
}

/* ── Modal Confirmação de Exclusão ─────────────────────────────────────────── */
function ModalConfirmExclusao({ usuario, excluindo, onCancel, onConfirm }: {
  usuario: Usuario; excluindo: boolean; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && !excluindo && onCancel()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
    >
      <div style={{ background:'#0d1a2e', border:'1px solid rgba(239,83,80,.3)', borderRadius:'14px', width:'100%', maxWidth:'420px', padding:'24px' }}>
        <h2 style={{ color:'#fff', fontSize:'17px', fontWeight:700, margin:'0 0 12px' }}>
          ⚠️ Excluir usuário
        </h2>
        <p style={{ color:'#8a9bb5', fontSize:'14px', lineHeight:1.6, margin:'0 0 24px' }}>
          Tem certeza que deseja excluir <strong style={{ color:'#e0e0e0' }}>{usuario.nome}</strong> (@{usuario.username})?
          Essa ação não pode ser desfeita.
        </p>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px' }}>
          <button
            onClick={onCancel}
            disabled={excluindo}
            style={{ ...btnStyle, padding:'9px 18px', fontSize:'13px', background:'#1a2632', color:'#8a9bb5', border:'1px solid rgba(255,255,255,.1)' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={excluindo}
            style={{ ...btnStyle, padding:'9px 18px', fontSize:'13px', background:'rgba(239,83,80,.15)', color:'#ef5350', border:'1px solid rgba(239,83,80,.3)' }}
          >
            {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Página Admin ───────────────────────────────────────────────────────────── */
export default function AdminUsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]             = useState('')
  const [acao, setAcao]             = useState<Record<number, string>>({})
  const [carteiraUser, setCarteiraUser] = useState<Usuario | null>(null)
  const [excluirUser, setExcluirUser] = useState<Usuario | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const res = await fetch('/api/admin/usuarios')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      if (!res.ok) { setErro(data.erro || 'Sem permissão.'); return }
      setUsuarios(data.usuarios || [])
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setCarregando(false)
    }
  }

  async function alterarPlano(uid: number, plano: Plano) {
    setAcao(a => ({ ...a, [uid]: 'salvando' }))
    await fetch(`/api/admin/usuarios/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano, ativo: 1 }),
    })
    await carregar()
    setAcao(a => ({ ...a, [uid]: '' }))
  }

  async function toggleAtivo(uid: number, ativo: number) {
    setAcao(a => ({ ...a, [uid]: 'salvando' }))
    await fetch(`/api/admin/usuarios/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: ativo ? 0 : 1 }),
    })
    await carregar()
    setAcao(a => ({ ...a, [uid]: '' }))
  }

  async function excluir(uid: number) {
    setAcao(a => ({ ...a, [uid]: 'excluindo' }))
    await fetch(`/api/admin/usuarios/${uid}`, { method: 'DELETE' })
    await carregar()
    setAcao(a => ({ ...a, [uid]: '' }))
    setExcluirUser(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', padding: '32px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: 0 }}>
            👥 Gestão de Usuários
          </h1>
          <span style={{ background: 'rgba(232,160,32,.1)', border: '1px solid rgba(232,160,32,.3)', color: '#e8a020', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
            ADMIN
          </span>
          <button onClick={carregar} style={{ marginLeft: 'auto', background: '#1a2632', border: '1px solid rgba(255,255,255,.1)', color: '#6b84a8', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            ↻ Atualizar
          </button>
        </div>

        {erro && (
          <div style={{ background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)', color: '#ef5350', padding: '14px 18px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
            {erro}
          </div>
        )}

        {carregando ? (
          <div style={{ color: '#6b84a8', textAlign: 'center', padding: '60px', fontSize: '14px' }}>Carregando...</div>
        ) : (
          <div style={{ background: '#0f1923', border: '1px solid rgba(255,255,255,.07)', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  {['ID', 'Nome', 'Usuário', 'E-mail', 'Plano', 'Status', 'Cadastro', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#4a5d73', letterSpacing: '.8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < usuarios.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                    <td style={tdStyle}>{u.id}</td>
                    <td style={{ ...tdStyle, color: '#e0e0e0', fontWeight: 600 }}>{u.nome}</td>
                    <td style={{ ...tdStyle, color: '#6b84a8' }}>@{u.username}</td>
                    <td style={{ ...tdStyle, color: '#6b84a8', fontSize: '12px' }}>{u.email}</td>
                    <td style={tdStyle}>
                      <select
                        value={u.plano}
                        disabled={!!acao[u.id]}
                        onChange={e => alterarPlano(u.id, e.target.value as Plano)}
                        style={{
                          background: '#1a2632', border: `1px solid ${PLANO_COLOR[u.plano]}40`,
                          color: PLANO_COLOR[u.plano], borderRadius: '5px',
                          padding: '4px 8px', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', outline: 'none',
                        }}
                      >
                        {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: u.ativo ? 'rgba(76,175,80,.15)' : 'rgba(239,83,80,.1)',
                        color:      u.ativo ? '#66BB6A'             : '#ef5350',
                        border:     `1px solid ${u.ativo ? 'rgba(76,175,80,.3)' : 'rgba(239,83,80,.3)'}`,
                      }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: '#4a5d73', whiteSpace: 'nowrap' }}>
                      {u.criado_em?.slice(0, 10) || '—'}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => setCarteiraUser(u)}
                          style={{ ...btnStyle, background: 'rgba(232,160,32,.12)', color: '#e8a020', border: '1px solid rgba(232,160,32,.25)' }}
                          title={`Ver carteira de ${u.nome}`}
                        >
                          📊 Carteira
                        </button>
                        <button
                          onClick={() => toggleAtivo(u.id, u.ativo)}
                          disabled={!!acao[u.id]}
                          style={{ ...btnStyle, background: u.ativo ? 'rgba(239,83,80,.15)' : 'rgba(76,175,80,.15)', color: u.ativo ? '#ef5350' : '#66BB6A' }}
                        >
                          {acao[u.id] === 'salvando' ? '...' : u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => setExcluirUser(u)}
                          disabled={!!acao[u.id]}
                          style={{ ...btnStyle, background: 'rgba(239,83,80,.1)', color: '#ef9090' }}
                        >
                          {acao[u.id] === 'excluindo' ? '...' : '🗑'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {usuarios.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: '#4a5d73', fontSize: '14px' }}>
                Nenhum usuário cadastrado.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '16px', fontSize: '12px', color: '#3d4f6a' }}>
          {usuarios.length} usuário(s) · Plano altera imediatamente · Para ativar e-mails não confirmados, use &quot;Ativar&quot;
        </div>
      </div>

      {carteiraUser && (
        <ModalCarteira usuario={carteiraUser} onClose={() => setCarteiraUser(null)} />
      )}

      {excluirUser && (
        <ModalConfirmExclusao
          usuario={excluirUser}
          excluindo={acao[excluirUser.id] === 'excluindo'}
          onCancel={() => setExcluirUser(null)}
          onConfirm={() => excluir(excluirUser.id)}
        />
      )}
    </div>
  )
}

const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: '13px', color: '#8a9bb5' }
const btnStyle: React.CSSProperties = {
  border: 'none', borderRadius: '5px', padding: '5px 10px',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
}
