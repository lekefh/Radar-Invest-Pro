'use client'
import { useState, FormEvent } from 'react'

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d.length ? `(${d}` : ''
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

export default function CompletarPerfilPage() {
  const [telefone, setTelefone] = useState('')
  const [erro, setErro]         = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const res = await fetch('/api/perfil/telefone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro || 'Erro ao salvar.')
        return
      }

      const stored = localStorage.getItem('radar_usuario')
      if (stored) {
        try {
          const u = JSON.parse(stored)
          u.telefone = telefone
          localStorage.setItem('radar_usuario', JSON.stringify(u))
        } catch {}
      }

      window.location.href = '/dashboard'
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#050d1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: '#0f1923', border: '1px solid rgba(255,255,255,.08)',
        borderRadius: '12px', padding: '40px 36px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '16px' }}>
            Complete seu cadastro
          </div>
          <div style={{ fontSize: '13px', color: '#6b84a8', marginTop: '6px', lineHeight: 1.5 }}>
            Precisamos do seu celular para<br />manter sua conta segura.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block', fontSize: '12px', color: '#6b84a8',
              marginBottom: '6px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase',
            }}>
              Celular com DDD
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={e => setTelefone(mascaraTelefone(e.target.value))}
              required
              autoFocus
              placeholder="(65) 99999-9999"
              inputMode="numeric"
              style={{
                width: '100%',
                background: '#1a2632',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: '7px',
                padding: '11px 14px',
                fontSize: '14px',
                color: '#e0e0e0',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {erro && (
            <div style={{
              background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)',
              borderRadius: '6px', padding: '10px 14px',
              fontSize: '13px', color: '#ef5350',
            }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            style={{
              marginTop: '4px',
              background: carregando ? '#1a2632' : '#1565C0',
              color: '#fff', border: 'none', borderRadius: '8px',
              padding: '13px', fontSize: '14px', fontWeight: 700,
              cursor: carregando ? 'not-allowed' : 'pointer',
              transition: 'background .2s',
            }}
          >
            {carregando ? 'Salvando...' : 'Salvar e continuar →'}
          </button>
        </form>
      </div>
    </div>
  )
}
