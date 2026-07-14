'use client'
import { useState, FormEvent, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Depoimentos — substitua pelo texto real quando receber dos investidores ──
const DEPOIMENTOS = [
  {
    texto: '[ Depoimento investidor 1 ]',
    autor: 'Investidor 1',
    cidade: 'SP',
  },
  {
    texto: '[ Depoimento investidor 2 ]',
    autor: 'Investidor 2',
    cidade: 'RJ',
  },
  {
    texto: '[ Depoimento investidor 3 ]',
    autor: 'Investidor 3',
    cidade: 'MG',
  },
]

export default function CadastroPage() {
  const [form, setForm]             = useState({ nome: '', email: '', senha: '' })
  const [erro, setErro]             = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const [isMobile, setIsMobile]     = useState(false)
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
    setCarregando(true)
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nome:  form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          senha: form.senha,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.erro || 'Erro ao cadastrar.')
        return
      }

      // Login automático — salva sessão e redireciona direto ao dashboard
      localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))
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
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px 48px',
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
              background: '#0a1628', border: '1px solid rgba(232,160,32,.35)',
              borderRadius: 16, maxWidth: 460, width: '100%',
              padding: '40px 36px 32px', position: 'relative',
              boxShadow: '0 0 60px rgba(232,160,32,.12)',
            }}>
            <button
              onClick={() => setShowExitPopup(false)}
              style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:'#4a5d73', fontSize:22, cursor:'pointer', lineHeight:1 }}>
              ✕
            </button>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <svg viewBox="0 0 240 240" width="52" height="52">
                <circle cx="120" cy="120" r="100" fill="none" stroke="#e8a020" strokeWidth="3" opacity="0.2"/>
                <circle cx="120" cy="120" r="66" fill="none" stroke="#e8a020" strokeWidth="4" opacity="0.5"/>
                <circle cx="120" cy="120" r="33" fill="none" stroke="#e8a020" strokeWidth="5" opacity="0.85"/>
                <circle cx="120" cy="120" r="10" fill="#e8a020"/>
                <line x1="120" y1="120" x2="172" y2="68" stroke="#e8a020" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            {!isMobile && (
              <p style={{ textAlign:'center', fontSize:11, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#e8a020', margin:'0 0 10px' }}>
                Espera! Antes de ir embora…
              </p>
            )}
            <h2 style={{ textAlign:'center', fontSize:24, fontWeight:900, color:'#fff', lineHeight:1.25, margin:'0 0 8px' }}>
              Monte sua carteira de<br/><span style={{ color:'#e8a020' }}>renda mensal</span> agora
            </h2>
            <p style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,.5)', margin:'0 0 24px', lineHeight:1.6 }}>
              Inteiramente gratuito. Sem cartão de crédito.<br/>Leva menos de 1 minuto para criar sua conta.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'10px 14px' }}>
                <span style={{ fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>📊 Mapa completo de dividendos da B3 atualizado diariamente</span>
                <span style={{ flexShrink:0, background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.4)', color:'#22c55e', fontSize:11, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'.5px' }}>GRATIS</span>
              </div>
              {['🎯 Análise fundamentalista de mais de 100 empresas','💰 Valuation DCF de mais de 30 empresas'].map(b => (
                <div key={b} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'10px 14px' }}>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>{b}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowExitPopup(false)}
              style={{ width:'100%', background:'#e8a020', color:'#050d1a', border:'none', borderRadius:9, padding:'15px', fontSize:15, fontWeight:900, cursor:'pointer', letterSpacing:'.3px' }}>
              Criar Conta Grátis Agora →
            </button>
            <p style={{ textAlign:'center', fontSize:11, color:'#4a5d73', marginTop:12, marginBottom:0 }}>
              Já tem conta?{' '}
              <Link href="/login" style={{ color:'#e8a020', textDecoration:'none' }}>Entrar</Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Formulário de cadastro ─────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: '420px', background: '#0f1923', border: '1px solid rgba(255,255,255,.08)', borderRadius: '12px', padding: '40px 36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6b84a8' }}>Crie sua conta gratuita</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome completo</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              required
              placeholder="Seu nome"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* E-mail */}
          <div>
            <label style={labelStyle}>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
              placeholder="seu@email.com"
              style={inputStyle}
            />
          </div>

          {/* Senha com mostrar/ocultar */}
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={form.senha}
                onChange={e => set('senha', e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                style={{ ...inputStyle, paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b84a8', fontSize: '16px', lineHeight: 1, padding: '4px',
                }}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {erro && (
            <div style={{ background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#ef5350' }}>
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
              padding: '14px', fontSize: '15px', fontWeight: 700,
              cursor: carregando ? 'not-allowed' : 'pointer',
            }}>
            {carregando ? 'Criando conta...' : 'Criar Conta Grátis →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6b84a8' }}>
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
  padding: '12px 14px', fontSize: '14px', color: '#e0e0e0',
  outline: 'none', boxSizing: 'border-box',
}
