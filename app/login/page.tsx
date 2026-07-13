'use client'
import { Suspense, useState, FormEvent, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/dashboard'

  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha]                 = useState('')
  const [erro, setErro]                   = useState('')
  const [carregando, setCarregando]       = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const exitShown    = useRef(false)
  const tempoMinimo  = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => { tempoMinimo.current = true }, 4000)

    const handleMouseLeave = (e: MouseEvent) => {
      if (
        e.clientY <= 10 &&
        tempoMinimo.current &&
        !exitShown.current &&
        !sessionStorage.getItem('exitPopupLoginVisto')
      ) {
        exitShown.current = true
        sessionStorage.setItem('exitPopupLoginVisto', '1')
        setShowExitPopup(true)
      }
    }

    const handleVisibility = () => {
      if (
        document.visibilityState === 'hidden' &&
        tempoMinimo.current &&
        !exitShown.current &&
        !sessionStorage.getItem('exitPopupLoginVisto')
      ) {
        exitShown.current = true
        sessionStorage.setItem('exitPopupLoginVisto', '1')
        setShowExitPopup(true)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

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
      window.location.href = redirect
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

            {/* Gancho */}
            <p style={{ textAlign:'center', fontSize:11, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#e8a020', margin:'0 0 10px' }}>
              Ainda não tem conta?
            </p>

            {/* Headline */}
            <h2 style={{ textAlign:'center', fontSize:24, fontWeight:900, color:'#fff', lineHeight:1.25, margin:'0 0 8px' }}>
              Faça o cadastro<br/>
              <span style={{ color:'#e8a020' }}>agora mesmo</span>
            </h2>
            <p style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,.5)', margin:'0 0 24px', lineHeight:1.6 }}>
              Leva menos de 1 minuto. Sem cartão de crédito.
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
            <a
              href="/cadastro"
              style={{
                display:'block', width:'100%', background:'#e8a020', color:'#050d1a',
                border:'none', borderRadius:9, padding:'15px',
                fontSize:15, fontWeight:900, cursor:'pointer', letterSpacing:'.3px',
                textAlign:'center', textDecoration:'none',
              }}>
              Criar Conta Gratis Agora →
            </a>

            <p style={{ textAlign:'center', fontSize:11, color:'#4a5d73', marginTop:12, marginBottom:0 }}>
              Já tenho conta —{' '}
              <button onClick={() => setShowExitPopup(false)} style={{ background:'none', border:'none', color:'#e8a020', cursor:'pointer', fontSize:11, padding:0 }}>continuar login</button>
            </p>
          </div>
        </div>
      )}

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
              placeholder="ex: joaosilva ou email@exemplo.com"
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

          <div style={{ textAlign: 'right', marginTop: '-4px' }}>
            <Link href="/esqueci-senha" style={{ color: '#6b84a8', textDecoration: 'none', fontSize: '12px' }}>
              Esqueci minha senha
            </Link>
          </div>
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
