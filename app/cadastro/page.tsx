'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'

export default function CadastroPage() {
  const [form, setForm] = useState({ nome: '', username: '', email: '', senha: '', confirmar: '' })
  const [erro, setErro]           = useState('')
  const [sucesso, setSucesso]     = useState(false)
  const [carregando, setCarregando] = useState(false)

  function set(campo: string, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErro('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (form.senha !== form.confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:     form.nome.trim(),
          username: form.username.trim().toLowerCase(),
          email:    form.email.trim().toLowerCase(),
          senha:    form.senha,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro || 'Erro ao cadastrar.')
        return
      }

      setSucesso(true)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  if (sucesso) {
    return (
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: '#0f1923', border: '1px solid rgba(255,255,255,.08)', borderRadius: '12px', padding: '40px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📧</div>
          <h2 style={{ color: '#fff', margin: '0 0 12px', fontSize: '20px' }}>Verifique seu e-mail</h2>
          <p style={{ color: '#6b84a8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
            Enviamos um link de confirmação para <strong style={{ color: '#e0e0e0' }}>{form.email}</strong>.
            <br />Clique no link para ativar sua conta.
          </p>
          <p style={{ color: '#4a5d73', fontSize: '12px', margin: '0 0 24px' }}>
            Não recebeu? Verifique a caixa de spam.
          </p>
          <Link href="/login" style={{ display: 'inline-block', background: '#1565C0', color: '#fff', padding: '11px 28px', borderRadius: '7px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>
            Ir para o Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#0f1923', border: '1px solid rgba(255,255,255,.08)', borderRadius: '12px', padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6b84a8' }}>Crie sua conta gratuita</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Nome completo</label>
            <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
              required placeholder="Seu nome" style={inputStyle} autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Nome de usuário</label>
            <input type="text" value={form.username} onChange={e => set('username', e.target.value)}
              required placeholder="ex: alexanderfh4" style={inputStyle}
              pattern="[a-z0-9_\-]{4,30}" title="4-30 chars: letras, números, _ ou -" />
            <span style={{ fontSize: '11px', color: '#4a5d73', marginTop: '3px', display: 'block' }}>
              4-30 caracteres · letras minúsculas, números, _ ou -
            </span>
          </div>

          <div>
            <label style={labelStyle}>E-mail</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              required placeholder="seu@email.com" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Senha</label>
            <input type="password" value={form.senha} onChange={e => set('senha', e.target.value)}
              required placeholder="Mínimo 6 caracteres" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Confirmar senha</label>
            <input type="password" value={form.confirmar} onChange={e => set('confirmar', e.target.value)}
              required placeholder="Repita a senha" style={inputStyle} />
          </div>

          {erro && (
            <div style={{ background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#ef5350' }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={carregando} style={{
            marginTop: '4px', background: carregando ? '#1a2632' : '#1565C0',
            color: '#fff', border: 'none', borderRadius: '8px', padding: '13px',
            fontSize: '14px', fontWeight: 700, cursor: carregando ? 'not-allowed' : 'pointer',
          }}>
            {carregando ? 'Cadastrando...' : 'Criar Conta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#6b84a8' }}>
          Já tem conta?{' '}
          <Link href="/login" style={{ color: '#e8a020', textDecoration: 'none', fontWeight: 600 }}>Entrar</Link>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: '#6b84a8',
  marginBottom: '6px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#1a2632',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: '7px',
  padding: '11px 14px', fontSize: '14px', color: '#e0e0e0',
  outline: 'none', boxSizing: 'border-box',
}
