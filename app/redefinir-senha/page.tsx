'use client'
import { Suspense, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RedefinirSenhaForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token  = params.get('token') || ''

  const [novaSenha, setNovaSenha]       = useState('')
  const [confirmar, setConfirmar]       = useState('')
  const [erro, setErro]                 = useState('')
  const [sucesso, setSucesso]           = useState(false)
  const [carregando, setCarregando]     = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro || 'Erro ao redefinir senha.')
        return
      }

      setSucesso(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  if (!token) {
    return (
      <div style={{ textAlign: 'center', color: '#ef5350', fontSize: '14px' }}>
        Link inválido.{' '}
        <Link href="/esqueci-senha" style={{ color: '#e8a020', textDecoration: 'none' }}>
          Solicite um novo.
        </Link>
      </div>
    )
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6b84a8' }}>Criar nova senha</div>
        </div>

        {sucesso ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(38,166,154,.1)', border: '1px solid rgba(38,166,154,.3)',
              borderRadius: '8px', padding: '20px', marginBottom: '24px',
              fontSize: '14px', color: '#4db6ac', lineHeight: '1.6',
            }}>
              Senha redefinida com sucesso! Redirecionando para o login...
            </div>
            <Link href="/login" style={{ color: '#e8a020', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                required
                autoFocus
                placeholder="Mínimo 6 caracteres"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Confirmar nova senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
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
              {carregando ? 'Salvando...' : 'Salvar nova senha'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '13px', color: '#6b84a8' }}>
              <Link href="/login" style={{ color: '#e8a020', textDecoration: 'none', fontWeight: 600 }}>
                ← Voltar para o login
              </Link>
            </div>
          </form>
        )}
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

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#6b84a8',
  marginBottom: '6px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase',
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b84a8' }}>Carregando...</div>
      </div>
    }>
      <RedefinirSenhaForm />
    </Suspense>
  )
}
