'use client'
import { Suspense, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/dashboard'

  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha]                 = useState('')
  const [erro, setErro]                   = useState('')
  const [carregando, setCarregando]       = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, senha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro || 'Erro ao fazer login.')
        return
      }

      localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))
      router.push(redirect)
      router.refresh()
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6b84a8' }}>Acesse sua conta</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b84a8', marginBottom: '6px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              E-mail ou nome de usuário
            </label>
            <input
              type="text"
              value={identificador}
              onChange={e => setIdentificador(e.target.value)}
              required
              autoFocus
              placeholder="ex: alexanderfh4 ou email@..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b84a8', marginBottom: '6px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
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
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#6b84a8' }}>
          Não tem conta?{' '}
          <Link href="/cadastro" style={{ color: '#e8a020', textDecoration: 'none', fontWeight: 600 }}>
            Cadastre-se
          </Link>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a2632',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: '7px',
  padding: '11px 14px',
  fontSize: '14px',
  color: '#e0e0e0',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b84a8' }}>Carregando...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
