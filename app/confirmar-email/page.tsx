'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function Conteudo() {
  const params = useSearchParams()
  const token  = params.get('token')

  const [status, setStatus] = useState<'verificando' | 'ok' | 'erro'>('verificando')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('erro')
      setMensagem('Token inválido ou ausente.')
      return
    }

    fetch(`/api/auth/confirmar?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setStatus('ok')
          setMensagem(data.mensagem || 'E-mail confirmado com sucesso!')
        } else {
          setStatus('erro')
          setMensagem(data.detail || 'Erro ao confirmar e-mail.')
        }
      })
      .catch(() => {
        setStatus('erro')
        setMensagem('Erro de conexão. Tente novamente.')
      })
  }, [token])

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', background: '#0f1923', border: '1px solid rgba(255,255,255,.08)', borderRadius: '12px', padding: '40px 36px', textAlign: 'center' }}>
        {status === 'verificando' && (
          <>
            <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
            <h2 style={{ color: '#fff', fontSize: '18px', margin: '0 0 8px' }}>Verificando...</h2>
            <p style={{ color: '#6b84a8', fontSize: '14px' }}>Aguarde um momento.</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#fff', fontSize: '20px', margin: '0 0 12px' }}>E-mail confirmado!</h2>
            <p style={{ color: '#6b84a8', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.6' }}>{mensagem}</p>
            <Link href="/login" style={{ display: 'inline-block', background: '#1565C0', color: '#fff', padding: '12px 28px', borderRadius: '7px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
              Fazer Login
            </Link>
          </>
        )}

        {status === 'erro' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ color: '#ef5350', fontSize: '20px', margin: '0 0 12px' }}>Link inválido</h2>
            <p style={{ color: '#6b84a8', fontSize: '14px', margin: '0 0 28px', lineHeight: '1.6' }}>{mensagem}</p>
            <Link href="/cadastro" style={{ display: 'inline-block', background: '#1a2632', color: '#e0e0e0', padding: '12px 28px', borderRadius: '7px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
              Cadastrar novamente
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b84a8', fontSize: '14px' }}>Verificando...</div>
      </div>
    }>
      <Conteudo />
    </Suspense>
  )
}
