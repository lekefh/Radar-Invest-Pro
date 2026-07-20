'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const LINKS: { href: string; label: string; soon?: boolean }[] = [
  { href: '/dashboard',  label: '📊 Monitoramento' },
  { href: '/carteira',   label: '💼 Carteira'      },
  { href: '/dividendos', label: '💰 Dividendos'    },
  { href: '/alertas',    label: '🔔 Alertas',  soon: true },
  { href: '/noticias',   label: '📰 Notícias' },
  { href: '/dcf',        label: '💹 DCF' },
  { href: '/ir',         label: '📋 Apuração IR' },
]

const LINKS_PRO: { href: string; label: string; soon?: boolean }[] = [
  { href: '/teses', label: '🎯 Teses' },
]

interface Usuario { nome: string; username: string; plano: string }

export default function NavBar() {
  const path   = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [mobileAberto, setMobileAberto] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('radar_usuario')
    if (raw) {
      try { setUsuario(JSON.parse(raw)) } catch { /* ignore */ }
    }
  }, [path])

  // Fecha o menu mobile sempre que a rota muda
  useEffect(() => { setMobileAberto(false) }, [path])

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('radar_usuario')
    setUsuario(null)
    router.push('/login')
  }

  const ehAnalista = usuario?.plano === 'analista'
  const ehPro      = usuario?.plano === 'pro' || ehAnalista
  const inicial    = usuario?.nome?.[0]?.toUpperCase() || '?'
  const todosLinks = [...LINKS, ...(ehPro ? LINKS_PRO : [])]

  function renderLink(l: { href: string; label: string; soon?: boolean }, mobile = false) {
    const ativo = path === l.href || path.startsWith(l.href + '/')
    return (
      <Link key={l.href} href={l.soon ? '#' : l.href} style={{ textDecoration: 'none' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: mobile ? '14px' : '12.5px', fontWeight: ativo ? 700 : 500,
          padding: mobile ? '12px 16px' : '5px 12px', borderRadius: '6px',
          color: ativo ? '#e8a020' : l.soon ? '#3d4f6a' : '#6b84a8',
          background: ativo ? 'rgba(232,160,32,.1)' : 'transparent',
          border: ativo ? '1px solid rgba(232,160,32,.25)' : '1px solid transparent',
          cursor: l.soon ? 'not-allowed' : 'pointer', transition: 'all .15s',
        }}>
          {l.label}
          {l.soon && <span style={{ fontSize: '9px', color: '#3d4f6a', fontWeight: 700, marginLeft: 'auto' }}>EM BREVE</span>}
        </span>
      </Link>
    )
  }

  return (
    <nav className="rip-navbar" style={{
      background: '#050d1a', borderBottom: '1px solid rgba(255,255,255,.07)',
      padding: '0 20px', display: 'flex', alignItems: 'center',
      height: '44px', gap: '4px', position: 'sticky', top: 0, zIndex: 80,
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginRight: '16px' }}>
        <span style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
        </span>
      </Link>

      {/* Links — visíveis em telas largas, escondidos em mobile (ver .rip-desktop-links) */}
      <div className="rip-desktop-links" style={{ display: 'flex', gap: '4px' }}>
        {todosLinks.map(l => renderLink(l))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {ehAnalista && (
          <Link href="/admin" className="rip-admin-link" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '12px', color: '#6b84a8', padding: '4px 10px', whiteSpace: 'nowrap' }}>⚙ Admin</span>
          </Link>
        )}

        {usuario ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuAberto(m => !m)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'rgba(232,160,32,.1)', border: '1px solid rgba(232,160,32,.25)',
                borderRadius: '20px', padding: '4px 12px 4px 6px',
                cursor: 'pointer', color: '#e8a020',
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(232,160,32,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#e8a020', flexShrink: 0 }}>
                {inicial}
              </div>
              <span className="rip-user-name" style={{ fontSize: '12px', fontWeight: 600 }}>{usuario.nome.split(' ')[0]}</span>
              <span style={{ fontSize: '10px', opacity: .7 }}>▾</span>
            </button>

            {menuAberto && (
              <div style={{
                position: 'absolute', right: 0, top: '36px',
                background: '#0f1923', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: '8px', minWidth: '180px', zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,.5)', overflow: 'hidden',
              }}
                onBlur={() => setMenuAberto(false)}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={{ fontSize: '13px', color: '#e0e0e0', fontWeight: 600 }}>{usuario.nome}</div>
                  <div style={{ fontSize: '11px', color: '#4a5d73', marginTop: '2px' }}>@{usuario.username} · {usuario.plano}</div>
                </div>
                {ehAnalista && (
                  <Link href="/admin" onClick={() => setMenuAberto(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '10px 16px', fontSize: '13px', color: '#6b84a8', cursor: 'pointer' }}>⚙ Gestão de Usuários</div>
                  </Link>
                )}
                <button
                  onClick={sair}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: '13px', color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,.05)' }}
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className="rip-entrar" style={{ textDecoration: 'none' }}>
              <span style={{ background: '#1565C0', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                Entrar
              </span>
            </Link>
            <Link href="/cadastro" className="rip-cta-mobile" style={{ textDecoration: 'none' }}>
              <span style={{ background: '#e8a020', color: '#050d1a', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                Cadastre-se grátis
              </span>
            </Link>
          </>
        )}

        {/* Botão hambúrguer — só aparece em mobile (ver .rip-hamburger) */}
        <button
          className="rip-hamburger"
          onClick={() => setMobileAberto(o => !o)}
          aria-label="Abrir menu"
          style={{
            display: 'none', background: 'transparent', border: 'none',
            color: '#e8a020', fontSize: '20px', cursor: 'pointer',
            padding: '4px 6px', lineHeight: 1,
          }}
        >
          {mobileAberto ? '✕' : '☰'}
        </button>
      </div>

      {/* Painel de navegação mobile — abre abaixo da navbar */}
      {mobileAberto && (
        <div className="rip-mobile-panel" style={{
          position: 'absolute', top: '44px', left: 0, right: 0,
          background: '#050d1a', borderBottom: '1px solid rgba(255,255,255,.1)',
          boxShadow: '0 12px 24px rgba(0,0,0,.5)', zIndex: 90,
          display: 'flex', flexDirection: 'column', padding: '8px',
        }}>
          {todosLinks.map(l => renderLink(l, true))}
        </div>
      )}

      <style jsx>{`
        .rip-cta-mobile { display: none; }
        @media (max-width: 760px) {
          .rip-desktop-links { display: none !important; }
          .rip-hamburger { display: flex !important; align-items: center; }
          .rip-admin-link span { font-size: 11px; padding: 4px 6px; }
          .rip-user-name { display: none; }
          .rip-entrar { display: none; }
          .rip-cta-mobile { display: block; }
        }
      `}</style>
    </nav>
  )
}
