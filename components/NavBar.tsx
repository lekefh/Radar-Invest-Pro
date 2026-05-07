'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: '📊 Monitoramento' },
  { href: '/carteira',  label: '💼 Carteira'      },
  { href: '/alertas',   label: '🔔 Alertas',  soon: true },
  { href: '/noticias',  label: '📰 Notícias', soon: true },
  { href: '/dcf',       label: '💹 DCF',      soon: true },
]

export default function NavBar() {
  const path = usePathname()

  return (
    <nav style={{
      background: '#050d1a',
      borderBottom: '1px solid rgba(255,255,255,.07)',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      height: '44px',
      gap: '4px',
      position: 'sticky',
      top: 0,
      zIndex: 80,
    }}>
      {/* Logo pequena */}
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
              cursor: l.soon ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
            }}>
              {l.label}
              {l.soon && <span style={{ fontSize: '9px', color: '#3d4f6a', fontWeight: 700 }}>EM BREVE</span>}
            </span>
          </Link>
        )
      })}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/dashboard/admin" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '12px', color: '#6b84a8', padding: '4px 10px' }}>⚙ Admin</span>
        </Link>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(232,160,32,.15)', border: '1px solid rgba(232,160,32,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#e8a020' }}>
          A
        </div>
      </div>
    </nav>
  )
}
