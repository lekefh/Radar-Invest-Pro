'use client'
import { useState, FormEvent, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function CadastroPage() {
  const [form, setForm] = useState({ nome: '', username: '', email: '', senha: '', confirmar: '' })
  const [erro, setErro]           = useState('')
  const [sucesso, setSucesso]     = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [isMobile, setIsMobile]           = useState(false)
  const exitShown = useRef(false)

  useEffect(() => {
    const mobile = window.matchMedia('(pointer: coarse)').matches
    setIsMobile(mobile)
    const KEY = 'exitPopupVisto'

    const disparar = () => {
      if (!exitShown.current && !sessionStorage.getItem(KEY)) {
        exitShown.current = true
        sessionStorage.setItem(KEY, '1')
        setShowExitPopup(true)
      }
    }

    const timer = mobile ? setTimeout(disparar, 4000) : null
    const handleMouseLeave = (e: MouseEvent) => { if (e.clientY <= 10) disparar() }
    const handleVisibility = () => { if (document.visibilityState === 'hidden') disparar() }

    if (!mobile) document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

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

      {/* ── Exit-intent popup ─────────────────────────────────────────────── */}
      {showExitPopup && (
        <div
          onClick={() => setShowExitPopup(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', backdropFilter: 'blur(3px)',
            animation: 'fadeIn .25s ease',
          }}>
          <style>{`@keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a1628',
              border: '1px solid rgba(232,160,32,.35)',
              borderRadius: 16,
              maxWidth: 460, width: '100%',
              padding: '40px 36px 32px',
              position: 'relative',
              boxShadow: '0 0 60px rgba(232,160,32,.12)',
            }}>
            {/* Fechar */}
            <button
              onClick={() => setShowExitPopup(false)}
              style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'#4a5d73', fontSize:22, cursor:'pointer', lineHeight:1 }}>
              ✕
            </button>

            {/* Ícone radar */}
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <svg viewBox="0 0 240 240" width="52" height="52">
                <circle cx="120" cy="120" r="100" fill="none" stroke="#e8a020" strokeWidth="3" opacity="0.2"/>
                <circle cx="120" cy="120" r="66" fill="none" stroke="#e8a020" strokeWidth="4" opacity="0.5"/>
                <circle cx="120" cy="120" r="33" fill="none" stroke="#e8a020" strokeWidth="5" opacity="0.85"/>
                <circle cx="120" cy="120" r="10" fill="#e8a020"/>
                <line x1="120" y1="120" x2="172" y2="68" stroke="#e8a020" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>

            {/* Gancho — só no desktop (exit intent) */}
            {!isMobile && (
              <p style={{ textAlign:'center', fontSize:11, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#e8a020', margin:'0 0 10px' }}>
                Espera! Antes de ir embora…
              </p>
            )}

            {/* Headline */}
            <h2 style={{ textAlign:'center', fontSize:24, fontWeight:900, color:'#fff', lineHeight:1.25, margin:'0 0 8px' }}>
              Monte sua carteira de<br/>
              <span style={{ color:'#e8a020' }}>renda mensal</span> agora
            </h2>
            <p style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,.5)', margin:'0 0 24px', lineHeight:1.6 }}>
              Inteiramente gratuito. Sem cartão de crédito.<br/>Leva menos de 1 minuto para criar sua conta.
            </p>

            {/* Benefícios */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'10px 14px' }}>
                <span style={{ fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>📊 Mapa completo de dividendos da B3 atualizado diariamente</span>
                <span style={{ flexShrink:0, background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.4)', color:'#22c55e', fontSize:11, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'.5px' }}>GRATIS</span>
              </div>
              {[
                '🎯 Análise fundamentalista de mais de 30 empresas',
                '💰 Valuation DCF — descubra se a ação está cara ou barata',
              ].map(b => (
                <div key={b} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'10px 14px' }}>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>{b}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowExitPopup(false)}
              style={{
                width:'100%', background:'#e8a020', color:'#050d1a',
                border:'none', borderRadius:9, padding:'15px',
                fontSize:15, fontWeight:900, cursor:'pointer', letterSpacing:'.3px',
              }}>
              Criar Conta Grátis Agora →
            </button>

            <p style={{ textAlign:'center', fontSize:11, color:'#4a5d73', marginTop:12, marginBottom:0 }}>
              Já tem conta?{' '}
              <Link href="/login" style={{ color:'#e8a020', textDecoration:'none' }}>Entrar</Link>
            </p>
          </div>
        </div>
      )}

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
            <input type="text" value={form.username}
              onChange={e => set('username', e.target.value.replace(/\s/g, ''))}
              required placeholder="ex: joaosilva" style={inputStyle}
              pattern="[a-z0-9_\-]{4,30}"
              title="4 a 30 caracteres · apenas letras minúsculas, números, _ ou - · sem espaços" />
            <span style={{ fontSize: '12px', color: '#8fa3bc', marginTop: '5px', display: 'block', lineHeight: '1.5' }}>
              ⚠ Sem espaços — use apenas letras minúsculas, números, <strong>_</strong> ou <strong>-</strong>
              <br />
              <span style={{ color: '#4a5d73' }}>Exemplo: <em>joao_silva</em> ou <em>joao-silva2</em></span>
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
