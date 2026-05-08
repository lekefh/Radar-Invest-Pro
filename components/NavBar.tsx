'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const LINKS = [
  { href: '/dashboard', label: '📊 Monitoramento' },
  { href: '/carteira',  label: '💼 Carteira'      },
  { href: '/alertas',   label: '🔔 Alertas',  soon: true },
  { href: '/noticias',  label: '📰 Notícias', soon: true },
  { href: '/dcf',       label: '💹 DCF' },
]

interface Usuario { nome: string; username: string; plano: string }

export default function NavBar() {
  const path   = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('radar_usuario')
    if (raw) {
      try { setUsuario(JSON.parse(raw)) } catch { /* ignore */ }
    }
  }, [path])

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem('radar_usuario')
    setUsuario(null)
    router.push('/login')
  }

  const ehAnalista = usuario?.plano === 'analista'
  const inicial    = usuario?.nome?.[0]?.toUpperCase() || '?'

  return (
    <nav style={{
      background: '#050d1a', borderBottom: '1px solid rgba(255,255,255,.07)',
      padding: '0 20px', display: 'flex', alignItems: 'center',
      height: '44px', gap: '4px', position: 'sticky', top: 0, zIndex: 80,
    }}>
      <Link href="/" style={{ textDecoration: 'none', marginRight: '16px' }}>
        <span style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: '14px', fontWeight: 700, color: '#fff' }}>
          Radar <span style={{ color: '#e8a020' }}>Invest Pro</span>
        </span>
      </Link>

      {LINKS.map(l => {
        const ativo = path === l.href || path.startsWith(l.href + '/')
        return (
          <Link key={l.href} href={l.soon ? '#' : l.href} style={{ textDecoration: 'none' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '12.5px', fontWeight: ativo ? 700 : 500,
              padding: '5px 12px', borderRadius: '6px',
              color: ativo ? '#e8a020' : l.soon ? '#3d4f6a' : '#6b84a8',
              background: ativo ? 'rgba(232,160,32,.1)' : 'transparent',
              border: ativo ? '1px solid rgba(232,160,32,.25)' : '1px solid transparent',
              cursor: l.soon ? 'not-allowed' : 'pointer', transition: 'all .15s',
            }}>
              {l.label}
              {l.soon && <span style={{ fontSize: '9px', color: '#3d4f6a', fontWeight: 700 }}>EM BREVE</span>}
            </span>
          </Link>
        )
      })}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {ehAnalista && (
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '12px', color: '#6b84a8', padding: '4px 10px' }}>⚙ Admin</span>
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
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(232,160,32,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#e8a020' }}>
                {inicial}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{usuario.nome.split(' ')[0]}</span>
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
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <span style={{ background: '#1565C0', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '6px' }}>
              Entrar
            </span>
          </Link>
        )}
      </div>
    </nav>
  )
}
