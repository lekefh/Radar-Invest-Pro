'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'

export default function EsqueciSenhaPage() {
  const [email, setEmail]         = useState('')
  const [enviado, setEnviado]     = useState(false)
  const [erro, setErro]           = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const res = await fetch('/api/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro || 'Erro ao enviar. Tente novamente.')
        return
      }

      setEnviado(true)
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6b84a8' }}>Recuperação de senha</div>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(38,166,154,.1)', border: '1px solid rgba(38,166,154,.3)',
              borderRadius: '8px', padding: '20px', marginBottom: '24px',
              fontSize: '14px', color: '#4db6ac', lineHeight: '1.6',
            }}>
              Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve.
              <br /><br />
              Verifique também sua caixa de spam.
            </div>
            <Link href="/login" style={{ color: '#e8a020', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <p style={{ color: '#a0b4c8', fontSize: '13px', marginBottom: '24px', lineHeight: '1.6' }}>
              Digite o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '12px', color: '#6b84a8',
                  marginBottom: '6px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase',
                }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="seu@email.com"
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
                {carregando ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#6b84a8' }}>
              <Link href="/login" style={{ color: '#e8a020', textDecoration: 'none', fontWeight: 600 }}>
                ← Voltar para o login
              </Link>
            </div>
          </>
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
