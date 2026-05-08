'use client'
import { useEffect, useState } from 'react'
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

const PLANOS: Plano[] = ['gratuito', 'essencial', 'pro', 'analista']

const PLANO_COLOR: Record<Plano, string> = {
  gratuito: '#546E7A',
  essencial: '#1565C0',
  pro:       '#6A1B9A',
  analista:  '#e8a020',
}

export default function AdminUsuariosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]           = useState('')
  const [acao, setAcao]           = useState<Record<number, string>>({})

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

  async function excluir(uid: number, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return
    setAcao(a => ({ ...a, [uid]: 'excluindo' }))
    await fetch(`/api/admin/usuarios/${uid}`, { method: 'DELETE' })
    await carregar()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', padding: '32px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
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
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => toggleAtivo(u.id, u.ativo)}
                          disabled={!!acao[u.id]}
                          style={{ ...btnStyle, background: u.ativo ? 'rgba(239,83,80,.15)' : 'rgba(76,175,80,.15)', color: u.ativo ? '#ef5350' : '#66BB6A' }}
                        >
                          {acao[u.id] === 'salvando' ? '...' : u.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => excluir(u.id, u.nome)}
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
    </div>
  )
}

const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: '13px', color: '#8a9bb5' }
const btnStyle: React.CSSProperties = {
  border: 'none', borderRadius: '5px', padding: '5px 10px',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
}
