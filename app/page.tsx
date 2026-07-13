'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--navy);color:var(--text);overflow-x:hidden}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s ease,transform .7s ease}
.reveal.visible{opacity:1;transform:none}
.reveal-left{opacity:0;transform:translateX(-32px);transition:opacity .7s ease,transform .7s ease}
.reveal-left.visible{opacity:1;transform:none}
.reveal-scale{opacity:0;transform:scale(.92);transition:opacity .6s ease,transform .6s ease}
.reveal-scale.visible{opacity:1;transform:scale(1)}
.ticker-wrap{background:var(--navy2);border-bottom:1px solid var(--border);padding:9px 0;overflow:hidden;white-space:nowrap}
.ticker-inner{display:inline-block;animation:ticker 45s linear infinite}
.ticker-item{display:inline-block;padding:0 32px;font-size:11.5px;font-weight:500;letter-spacing:.4px;color:var(--muted)}
.ticker-item .sym{color:var(--text);font-weight:700;margin-right:6px}
.ticker-item .up{color:var(--green)}
.ticker-item .dn{color:var(--red)}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 60px;height:64px;background:rgba(5,13,26,.93);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.logo-icon{width:34px;height:34px;border-radius:50%;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;position:relative}
.logo-icon::before{content:'';position:absolute;width:18px;height:18px;border-radius:50%;border:1.5px solid var(--gold);opacity:.4}
.logo-icon::after{content:'';width:8px;height:8px;background:var(--gold);border-radius:50%}
.logo-name{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#fff;letter-spacing:-.3px}
.logo-name span{color:var(--gold)}
.nav-links{display:flex;gap:32px;list-style:none}
.nav-links a{color:var(--muted);font-size:14px;font-weight:500;text-decoration:none;transition:color .2s}
.nav-links a:hover{color:#fff}
.nav-cta{background:var(--gold);color:#000;font-weight:700;font-size:13px;padding:9px 22px;border-radius:6px;text-decoration:none;transition:all .2s;letter-spacing:.2px}
.nav-cta:hover{background:var(--gold2);transform:translateY(-1px)}
.nav-dash{background:transparent;border:1px solid rgba(232,160,32,.4);color:var(--gold);font-weight:600;font-size:13px;padding:9px 22px;border-radius:6px;text-decoration:none;transition:all .2s;margin-right:10px}
.nav-dash:hover{background:rgba(232,160,32,.08);border-color:var(--gold)}
.nav-cta-group{display:flex;align-items:center}
.nav-hamburger{display:none;background:transparent;border:none;color:var(--gold);font-size:22px;cursor:pointer;padding:4px 8px;line-height:1}
.nav-mobile-panel{display:none;flex-direction:column;background:rgba(5,13,26,.97);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);position:absolute;top:64px;left:0;right:0;padding:8px;gap:2px;z-index:99}
.nav-mobile-panel a{color:var(--muted);font-size:15px;font-weight:500;text-decoration:none;padding:13px 16px;border-radius:8px}
.nav-mobile-panel a:hover{background:rgba(255,255,255,.05);color:#fff}
.nav-mobile-panel .nav-mobile-cta{display:flex;flex-direction:column;gap:8px;padding:10px 16px 4px}
.nav-mobile-panel .nav-mobile-cta a{text-align:center;padding:11px}
.hero{min-height:90vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:80px 60px 60px;position:relative;overflow:hidden}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);background-size:56px 56px}
.hero-glow{position:absolute;inset:0;background:radial-gradient(ellipse 70% 55% at 50% 40%,rgba(232,160,32,.07) 0%,transparent 70%)}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(232,160,32,.1);border:1px solid rgba(232,160,32,.25);border-radius:100px;padding:6px 18px;margin-bottom:32px;font-size:12px;font-weight:600;color:var(--gold);letter-spacing:1px;text-transform:uppercase;position:relative}
.hero-badge::before{content:'';width:6px;height:6px;background:var(--gold);border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.4)}}
.hero-brand{font-family:'Space Grotesk',sans-serif;font-size:clamp(52px,8vw,110px);font-weight:700;line-height:1;letter-spacing:-3px;margin-bottom:12px;position:relative}
.hero-brand .radar{color:var(--text)}
.hero-brand .invest{color:var(--gold);display:block}
.hero-brand .pro{color:var(--text);opacity:.5;font-size:.45em;letter-spacing:4px;text-transform:uppercase;font-weight:400;display:block;margin-top:8px}
.hero-line{width:80px;height:3px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:20px auto 28px}
.hero-mission{font-size:clamp(17px,2.2vw,22px);line-height:1.65;color:var(--muted);max-width:680px;margin:0 auto 44px;font-weight:300}
.hero-mission strong{color:var(--text);font-weight:600}
.hero-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;position:relative}
.btn-primary{background:var(--gold);color:#000;font-weight:700;font-size:15px;padding:15px 36px;border-radius:8px;text-decoration:none;transition:all .2s;border:none;cursor:pointer;letter-spacing:.2px}
.btn-primary:hover{background:var(--gold2);transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,160,32,.3)}
.btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.15);color:var(--text);font-size:15px;font-weight:500;padding:15px 32px;border-radius:8px;text-decoration:none;transition:all .2s;cursor:pointer}
.btn-ghost:hover{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.04)}
.btn-dash{background:rgba(232,160,32,.12);border:1px solid rgba(232,160,32,.35);color:var(--gold);font-size:15px;font-weight:700;padding:15px 32px;border-radius:8px;text-decoration:none;transition:all .2s;cursor:pointer}
.btn-dash:hover{background:rgba(232,160,32,.22);transform:translateY(-2px)}
.hero-cards{display:flex;gap:14px;justify-content:center;margin-top:56px;flex-wrap:wrap;position:relative}
.mini-card{background:var(--navy3);border:1px solid var(--border);border-radius:12px;padding:16px 22px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:10px}
.mini-card .icon{font-size:20px}
.mini-card strong{color:var(--text);display:block;font-size:14px;font-weight:600}
.stats{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--navy2)}
.stat{padding:44px 40px;border-right:1px solid var(--border);text-align:center}
.stat:last-child{border-right:none}
.stat-num{font-family:'Space Grotesk',sans-serif;font-size:clamp(36px,4vw,52px);font-weight:700;color:var(--gold);line-height:1;margin-bottom:8px}
.stat-label{font-size:14px;color:var(--muted);line-height:1.5}
.mission{padding:100px 60px;background:var(--navy2);position:relative;overflow:hidden}
.mission::before{content:'';position:absolute;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(232,160,32,.04),transparent 70%);pointer-events:none}
.mission-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:100px;align-items:center}
.mission-left .tag{font-size:11px;font-weight:700;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px}
.mission-left h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(32px,3.5vw,48px);font-weight:700;line-height:1.15;letter-spacing:-.5px;margin-bottom:24px}
.mission-left h2 em{color:var(--gold);font-style:normal}
.mission-statement{font-size:18px;line-height:1.8;color:var(--muted);border-left:3px solid var(--gold);padding-left:24px;margin-bottom:32px;font-weight:300}
.mission-statement strong{color:var(--text);font-weight:600}
.mission-pillars{display:flex;flex-direction:column;gap:18px}
.pillar{display:flex;align-items:flex-start;gap:16px}
.pillar-num{width:36px;height:36px;border-radius:8px;background:rgba(232,160,32,.1);border:1px solid rgba(232,160,32,.2);display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;color:var(--gold);flex-shrink:0}
.pillar h4{font-size:15px;font-weight:700;margin-bottom:4px}
.pillar p{font-size:13px;color:var(--muted);line-height:1.6}
.compare-box{background:var(--navy3);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.compare-hdr{display:grid;grid-template-columns:1fr 1fr 1fr;background:rgba(0,0,0,.3);padding:14px 20px;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
.compare-hdr span:not(:first-child){text-align:center}
.compare-row{display:grid;grid-template-columns:1fr 1fr 1fr;padding:14px 20px;border-top:1px solid var(--border);font-size:13px}
.compare-row:nth-child(even){background:rgba(255,255,255,.02)}
.compare-row .item{color:var(--muted)}
.compare-row .gestor{text-align:center;color:var(--green);font-weight:600}
.compare-row .radar-col{text-align:center;color:var(--gold);font-weight:600}
.compare-hdr .radar-h{text-align:center;color:var(--gold)}
.features{padding:100px 60px;max-width:1400px;margin:0 auto}
.sec-header{text-align:center;margin-bottom:64px}
.sec-tag{font-size:11px;font-weight:700;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px}
.sec-title{font-family:'Space Grotesk',sans-serif;font-size:clamp(28px,3.5vw,44px);font-weight:700;line-height:1.15;letter-spacing:-.4px;margin-bottom:16px}
.sec-lead{font-size:17px;color:var(--muted);max-width:560px;margin:0 auto;line-height:1.7}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.feat-card{background:var(--navy2);border:1px solid var(--border);border-radius:14px;padding:32px;transition:all .3s;position:relative;overflow:hidden}
.feat-card::after{content:'';position:absolute;inset:0;border-radius:14px;border:1px solid rgba(232,160,32,0);transition:border-color .3s}
.feat-card:hover{transform:translateY(-5px);background:var(--navy3)}
.feat-card:hover::after{border-color:rgba(232,160,32,.25)}
.feat-icon{font-size:28px;margin-bottom:18px;display:block}
.feat-card h3{font-size:17px;font-weight:700;margin-bottom:10px}
.feat-card p{font-size:13.5px;color:var(--muted);line-height:1.7}
.feat-tag{display:inline-block;margin-top:16px;font-size:11px;font-weight:700;letter-spacing:.6px;color:var(--gold);text-transform:uppercase}
.feat-card.destaque{grid-column:span 3;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;background:linear-gradient(135deg,var(--navy3) 0%,rgba(17,31,56,.8) 100%);border-color:rgba(232,160,32,.15)}
.feat-card.destaque .feat-visual{background:var(--navy2);border:1px solid var(--border);border-radius:12px;padding:20px}
.dcf-scenario{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.dcf-scenario:last-child{margin-bottom:0}
.dcf-label{font-size:12px;color:var(--muted);width:70px;flex-shrink:0}
.dcf-bar{flex:1;height:10px;background:rgba(255,255,255,.05);border-radius:5px;overflow:hidden}
.dcf-fill{height:100%;border-radius:5px;transition:width 1.5s ease}
.dcf-val{font-size:13px;font-weight:700;width:60px;text-align:right}
.metodo{padding:100px 60px;background:var(--navy2)}
.metodo-inner{max-width:1200px;margin:0 auto}
.metodo-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:64px;position:relative}
.metodo-steps::before{content:'';position:absolute;top:28px;left:12.5%;width:75%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
.step-item{text-align:center;padding:0 16px;position:relative}
.step-num{width:56px;height:56px;border-radius:50%;background:var(--navy);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:var(--gold);position:relative;z-index:2}
.step-item h4{font-size:15px;font-weight:700;margin-bottom:8px}
.step-item p{font-size:13px;color:var(--muted);line-height:1.6}
.setores{padding:80px 60px;max-width:1200px;margin:0 auto}
.setores-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:48px}
.setor-pill{background:var(--navy2);border:1px solid var(--border);border-radius:100px;padding:10px 18px;text-align:center;font-size:12.5px;font-weight:500;color:var(--muted);transition:all .2s;cursor:default}
.setor-pill:hover{border-color:rgba(232,160,32,.3);color:var(--gold);background:rgba(232,160,32,.05)}
.cta{padding:100px 60px;text-align:center;background:var(--navy2);border-top:1px solid var(--border);position:relative;overflow:hidden}
.cta::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 50% 100%,rgba(232,160,32,.05),transparent)}
.cta h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(30px,4vw,52px);font-weight:700;letter-spacing:-.5px;margin-bottom:16px;max-width:700px;margin-left:auto;margin-right:auto;position:relative}
.cta h2 span{color:var(--gold)}
.cta .lead{font-size:17px;color:var(--muted);max-width:500px;margin:0 auto 44px;line-height:1.7;position:relative}
.cta-form{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;max-width:520px;margin:0 auto 14px;position:relative}
.cta-input{flex:1;min-width:260px;background:var(--navy3);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:14px 20px;color:#fff;font-size:15px;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s}
.cta-input:focus{border-color:rgba(232,160,32,.5)}
.cta-input::placeholder{color:var(--muted)}
.cta-note{font-size:13px;color:var(--muted);position:relative}
#form-status{margin-top:12px;font-size:14px;color:var(--green)}
.sobre{padding:100px 60px;background:var(--navy2);border-top:1px solid var(--border)}
.sobre-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:auto 1fr;gap:64px;align-items:start}
.avatar-wrap{width:150px;height:150px;border-radius:50%;border:2px solid rgba(232,160,32,.4);overflow:hidden;flex-shrink:0;box-shadow:0 0 0 6px rgba(232,160,32,.07)}
.avatar-foto{width:100%;height:100%;object-fit:cover;object-position:center top}
.sobre-content .tag{font-size:11px;font-weight:700;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px}
.sobre-content h2{font-family:'Space Grotesk',sans-serif;font-size:clamp(26px,3vw,38px);font-weight:700;letter-spacing:-.4px;margin-bottom:6px}
.sobre-cargo{font-size:14px;color:var(--muted);margin-bottom:24px;font-style:italic}
.sobre-historia{font-size:15px;line-height:1.85;color:var(--muted);margin-bottom:32px;max-width:660px}
.sobre-historia strong{color:var(--text);font-weight:600}
.sobre-creds{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:32px;max-width:660px}
.cred{display:flex;align-items:flex-start;gap:12px;background:var(--navy);border:1px solid var(--border);border-radius:10px;padding:14px 18px;transition:border-color .2s}
.cred:hover{border-color:rgba(232,160,32,.2)}
.cred-icon{font-size:20px;flex-shrink:0;margin-top:1px}
.cred strong{display:block;font-size:13px;font-weight:600;margin-bottom:3px}
.cred span{font-size:12px;color:var(--muted)}
.social-links{display:flex;gap:12px;flex-wrap:wrap}
.btn-social{display:inline-flex;align-items:center;gap:9px;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;text-decoration:none;transition:all .2s}
.btn-linkedin{background:rgba(10,102,194,.12);border:1px solid rgba(10,102,194,.3);color:#6aaad8}
.btn-linkedin:hover{background:rgba(10,102,194,.22);border-color:rgba(10,102,194,.55);color:#8dbfe8}
.btn-instagram{background:rgba(225,48,108,.10);border:1px solid rgba(225,48,108,.28);color:#e1706a}
.btn-instagram:hover{background:rgba(225,48,108,.20);border-color:rgba(225,48,108,.55);color:#f08080}
.btn-youtube{background:rgba(255,0,0,.10);border:1px solid rgba(255,0,0,.25);color:#ff6b6b}
.btn-youtube:hover{background:rgba(255,0,0,.20);border-color:rgba(255,0,0,.50);color:#ff9090}
footer{background:var(--navy2);border-top:1px solid var(--border);padding:48px 60px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px}
.foot-logo{font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:700;color:#fff}
.foot-logo span{color:var(--gold)}
.foot-info{font-size:12.5px;color:var(--muted);line-height:1.6}
.foot-links a{font-size:13px;color:var(--muted);text-decoration:none;margin-left:20px;transition:color .2s}
.foot-links a:hover{color:var(--text)}
@media(max-width:1100px){
  .mission-inner{grid-template-columns:1fr;gap:48px}
  .features-grid{grid-template-columns:1fr 1fr}
  .feat-card.destaque{grid-column:span 2}
  .metodo-steps{grid-template-columns:1fr 1fr;gap:32px}
  .metodo-steps::before{display:none}
  .setores-grid{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:768px){
  nav{padding:0 20px}
  .nav-links{display:none}
  .nav-cta-group{display:none}
  .nav-hamburger{display:flex;align-items:center}
  .nav-mobile-panel.open{display:flex}
  .hero,.mission,.features,.metodo,.setores,.cta,.sobre{padding:60px 24px}
  .stats{grid-template-columns:1fr 1fr}
  .stat{padding:28px 20px}
  .features-grid{grid-template-columns:1fr}
  .feat-card.destaque{grid-column:span 1;grid-template-columns:1fr}
  .metodo-steps{grid-template-columns:1fr}
  footer{flex-direction:column;text-align:center;padding:40px 24px}
  .foot-links a{margin:0 10px}
  .setores-grid{grid-template-columns:repeat(2,1fr)}
  .sobre-inner{grid-template-columns:1fr;gap:32px}
  .sobre-creds{grid-template-columns:1fr}
}
`

export default function LandingPage() {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [showExitPopup, setShowExitPopup] = useState(false)
  const exitShown = useRef(false)

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 10 && !exitShown.current && !sessionStorage.getItem('exitPopupHomeVisto')) {
        exitShown.current = true
        sessionStorage.setItem('exitPopupHomeVisto', '1')
        setShowExitPopup(true)
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !exitShown.current && !sessionStorage.getItem('exitPopupHomeVisto')) {
        exitShown.current = true
        sessionStorage.setItem('exitPopupHomeVisto', '1')
        setShowExitPopup(true)
      }
    }
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e, i) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add('visible'), i * 80)
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach((el) =>
      observer.observe(el)
    )

    const counterObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target as HTMLElement
          const target = parseInt(el.dataset.target || '0')
          const dur = 1800
          const start = performance.now()
          const tick = (now: number) => {
            const pct = Math.min((now - start) / dur, 1)
            el.textContent = String(Math.floor(pct * pct * target))
            if (pct < 1) requestAnimationFrame(tick)
            else el.textContent = String(target)
          }
          requestAnimationFrame(tick)
          counterObs.unobserve(el)
        })
      },
      { threshold: 0.5 }
    )
    document.querySelectorAll('.counter').forEach((el) => counterObs.observe(el))

    const barObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.querySelectorAll('.dcf-fill[data-w]').forEach((bar) => {
            const b = bar as HTMLElement
            setTimeout(() => (b.style.width = b.dataset.w + '%'), 300)
          })
          barObs.unobserve(e.target)
        })
      },
      { threshold: 0.3 }
    )
    document.querySelectorAll('.feat-card.destaque').forEach((el) => barObs.observe(el))

    ;(async () => {
      try {
        const res = await fetch('/api/quotes')
        if (!res.ok) return
        const data = await res.json()
        if (!data.quotes?.length) return
        const fmt = (n: number) =>
          n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const fmtPct = (n: number) =>
          Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        const itens = data.quotes.map(
          (q: { symbol: string; price: number; changePercent: number }) => {
            const pct = q.changePercent ?? 0
            const sinal = pct >= 0 ? '▲+' : '▼-'
            const cls = pct >= 0 ? 'up' : 'dn'
            return `<span class="ticker-item"><span class="sym">${q.symbol}</span>R$${fmt(q.price)} <span class="${cls}">${sinal}${fmtPct(pct)}%</span></span>`
          }
        )
        const el = document.querySelector('.ticker-inner')
        if (el) el.innerHTML = [...itens, ...itens].join('')
      } catch {
        /* mantém valores estáticos */
      }
    })()

    return () => {
      observer.disconnect()
      counterObs.disconnect()
      barObs.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const btn = form.querySelector('button[type=submit]') as HTMLButtonElement
    const emailInput = form.querySelector('input[name=email]') as HTMLInputElement
    const status = document.getElementById('form-status')!
    btn.textContent = 'Enviando...'
    btn.disabled = true
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.value }),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        ;(form.parentElement as HTMLElement).style.display = 'none'
        status.innerHTML = '✅ Cadastro confirmado! Você receberá um e-mail em instantes.'
        status.style.cssText = 'color:#00d4a0;font-size:16px;font-weight:600'
      } else throw new Error()
    } catch {
      status.innerHTML =
        '⚠️ Algo deu errado. Envie para <a href="mailto:contato@radarinvestpro.com.br" style="color:var(--gold)">contato@radarinvestpro.com.br</a>'
      status.style.color = '#f5a623'
      btn.textContent = 'Quero acesso'
      btn.disabled = false
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── Exit-intent popup ─────────────────────────────────────────────── */}
      {showExitPopup && (
        <div
          onClick={() => setShowExitPopup(false)}
          style={{
            position:'fixed', inset:0, zIndex:9999,
            background:'rgba(0,0,0,.75)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'20px', backdropFilter:'blur(3px)',
            animation:'fadeIn .25s ease',
          }}>
          <style dangerouslySetInnerHTML={{ __html: '@keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}' }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'#0a1628',
              border:'1px solid rgba(232,160,32,.35)',
              borderRadius:16,
              maxWidth:460, width:'100%',
              padding:'40px 36px 32px',
              position:'relative',
              boxShadow:'0 0 60px rgba(232,160,32,.12)',
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
            <p style={{ textAlign:'center', fontSize:11, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'#e8a020', margin:'0 0 10px' }}>
              Espera! Antes de ir embora…
            </p>
            <h2 style={{ textAlign:'center', fontSize:24, fontWeight:900, color:'#fff', lineHeight:1.25, margin:'0 0 8px' }}>
              Monte sua carteira de<br/>
              <span style={{ color:'#e8a020' }}>renda mensal</span> agora
            </h2>
            <p style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,.5)', margin:'0 0 24px', lineHeight:1.6 }}>
              Inteiramente gratuito. Sem cartão de crédito.<br/>Leva menos de 1 minuto para criar sua conta.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'10px 14px' }}>
                <span style={{ fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>📊 Mapa completo de dividendos da B3 atualizado diariamente</span>
                <span style={{ flexShrink:0, background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.4)', color:'#22c55e', fontSize:11, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'.5px' }}>GRATIS</span>
              </div>
              {['🎯 Análise fundamentalista de mais de 30 empresas','💰 Valuation DCF — descubra se a ação está cara ou barata'].map(b => (
                <div key={b} style={{ display:'flex', alignItems:'flex-start', gap:10, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'10px 14px' }}>
                  <span style={{ fontSize:14, color:'rgba(255,255,255,.8)', lineHeight:1.5 }}>{b}</span>
                </div>
              ))}
            </div>
            <a
              href="/cadastro"
              style={{
                display:'block', textAlign:'center', background:'#e8a020', color:'#050d1a',
                border:'none', borderRadius:9, padding:'15px',
                fontSize:15, fontWeight:900, cursor:'pointer', letterSpacing:'.3px',
                textDecoration:'none',
              }}>
              Criar Conta Gratis Agora →
            </a>
            <p style={{ textAlign:'center', fontSize:11, color:'#4a5d73', marginTop:12, marginBottom:0 }}>
              Já tem conta?{' '}
              <a href="/login" style={{ color:'#e8a020', textDecoration:'none' }}>Entrar</a>
            </p>
          </div>
        </div>
      )}

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-inner">
          {['PETR4 R$38,42 ▲+1,8%','VALE3 R$62,10 ▼-0,9%','ITUB4 R$34,87 ▲+0,5%','WEGE3 R$48,20 ▲+2,1%','BBAS3 R$27,33 ▼-0,3%','SUZB3 R$54,15 ▲+1,2%','B3SA3 R$19,05 ▲+0,7%','PSSA3 R$52,10 ▲+0,4%','VULC3 R$17,22 ▲+1,1%','EGIE3 R$41,80 ▼-0,6%'].map((t, i) => {
            const [sym, price, chg] = t.split(' ')
            const up = chg.startsWith('▲')
            return (
              <span key={i} className="ticker-item">
                <span className="sym">{sym}</span>{price} <span className={up ? 'up' : 'dn'}>{chg}</span>
              </span>
            )
          })}
          {['PETR4 R$38,42 ▲+1,8%','VALE3 R$62,10 ▼-0,9%','ITUB4 R$34,87 ▲+0,5%','WEGE3 R$48,20 ▲+2,1%','BBAS3 R$27,33 ▼-0,3%','SUZB3 R$54,15 ▲+1,2%','B3SA3 R$19,05 ▲+0,7%','PSSA3 R$52,10 ▲+0,4%','VULC3 R$17,22 ▲+1,1%','EGIE3 R$41,80 ▼-0,6%'].map((t, i) => {
            const [sym, price, chg] = t.split(' ')
            const up = chg.startsWith('▲')
            return (
              <span key={i + 10} className="ticker-item">
                <span className="sym">{sym}</span>{price} <span className={up ? 'up' : 'dn'}>{chg}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* NAV */}
      <nav>
        <a href="#" className="logo">
          <div className="logo-icon" />
          <span className="logo-name">Radar Invest <span>Pro</span></span>
        </a>
        <ul className="nav-links">
          <li><a href="#missao">Missão</a></li>
          <li><a href="#funcionalidades">Funcionalidades</a></li>
          <li><a href="#metodologia">Metodologia</a></li>
          <li><a href="#setores">Setores</a></li>
          <li><a href="#sobre">Sobre</a></li>
        </ul>
        <div className="nav-cta-group">
          <Link href="/dashboard" className="nav-dash">Acessar — Grátis</Link>
          <Link href="/cadastro" className="nav-cta">Fazer cadastro</Link>
        </div>
        <button
          className="nav-hamburger"
          aria-label="Abrir menu"
          onClick={() => setMenuMobileAberto(o => !o)}
        >
          {menuMobileAberto ? '✕' : '☰'}
        </button>
        <div className={`nav-mobile-panel${menuMobileAberto ? ' open' : ''}`}>
          <a href="#missao" onClick={() => setMenuMobileAberto(false)}>Missão</a>
          <a href="#funcionalidades" onClick={() => setMenuMobileAberto(false)}>Funcionalidades</a>
          <a href="#metodologia" onClick={() => setMenuMobileAberto(false)}>Metodologia</a>
          <a href="#setores" onClick={() => setMenuMobileAberto(false)}>Setores</a>
          <a href="#sobre" onClick={() => setMenuMobileAberto(false)}>Sobre</a>
          <div className="nav-mobile-cta">
            <Link href="/dashboard" className="nav-dash" onClick={() => setMenuMobileAberto(false)}>Acessar — Grátis</Link>
            <Link href="/cadastro" className="nav-cta" onClick={() => setMenuMobileAberto(false)}>Fazer cadastro</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-glow" />
        <div className="hero-badge">📡 Plataforma de Análise Fundamentalista B3</div>
        <h1 className="hero-brand">
          <span className="radar">Radar</span>
          <span className="invest">Invest Pro</span>
        </h1>
        <div className="hero-line" />
        <p className="hero-mission">
          Democratizamos a análise de ações da B3 da forma correta —<br />
          com <strong>DCF, fundamentos e peso de carteira</strong><br />
          exatamente como os <strong>grandes profissionais de mercado fazem</strong>.
        </p>
        <div className="hero-actions">
          <Link href="/dashboard" className="btn-dash">Acessar plataforma — Grátis</Link>
          <Link href="/cadastro" className="btn-primary">Fazer cadastro agora</Link>
          <a href="#missao" className="btn-ghost">Entender a missão</a>
        </div>
        <div className="hero-cards reveal">
          <div className="mini-card"><span className="icon">📊</span><div><strong>DCF</strong>Valuation por fluxo de caixa</div></div>
          <div className="mini-card"><span className="icon">🔍</span><div><strong>13 setores</strong>Framework específico por setor</div></div>
          <div className="mini-card"><span className="icon">⚖️</span><div><strong>Peso de carteira</strong>Alocação racional por risco</div></div>
          <div className="mini-card"><span className="icon">🏛️</span><div><strong>Governança</strong>Score ESG por empresa</div></div>
        </div>
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="stat reveal"><div className="stat-num"><span className="counter" data-target="100">0</span>+</div><div className="stat-label">Ações monitoradas na B3</div></div>
        <div className="stat reveal"><div className="stat-num"><span className="counter" data-target="13">0</span></div><div className="stat-label">Setores com frameworks próprios</div></div>
        <div className="stat reveal"><div className="stat-num"><span className="counter" data-target="10">0</span></div><div className="stat-label">Critérios de governança por empresa</div></div>
        <div className="stat reveal"><div className="stat-num">DCF</div><div className="stat-label">Valuation por fluxo de caixa descontado</div></div>
      </div>

      {/* MISSÃO */}
      <section className="mission" id="missao">
        <div className="mission-inner">
          <div className="mission-left reveal-left">
            <div className="tag">Nossa Missão</div>
            <h2>O investidor individual merece <em>as mesmas ferramentas</em> que os profissionais de mercado.</h2>
            <p className="mission-statement">
              Hoje, grandes profissionais de mercado tomam decisões com <strong>DCF rigoroso, análise fundamentalista setorial e alocação racional de carteira</strong>. O investidor comum toma decisões com achismo, notícia e dica de influencer.<br /><br />
              <strong>Isso precisa mudar.</strong>
            </p>
            <div className="mission-pillars">
              <div className="pillar"><div className="pillar-num">01</div><div><h4>DCF com premissas reais</h4><p>Premissas macroeconômicas atualizadas automaticamente — SELIC, IPCA e câmbio. Nada de premissas inventadas.</p></div></div>
              <div className="pillar"><div className="pillar-num">02</div><div><h4>Fundamentos por setor</h4><p>Cada setor tem seu próprio KPI crítico: NIM para bancos, SSS para varejo, RAB para utilities, C1 para mineração.</p></div></div>
              <div className="pillar"><div className="pillar-num">03</div><div><h4>Peso correto na carteira</h4><p>Alocação baseada em upside, risco e correlação — não em "gut feeling" ou diversificação aleatória.</p></div></div>
            </div>
          </div>
          <div className="reveal">
            <div className="compare-box">
              <div className="compare-hdr"><span>O que você analisa</span><span>Profissional de Mercado</span><span className="radar-h">📡 Radar Invest Pro</span></div>
              {[['Valuation','DCF multicenários','DCF multicenários'],['Fundamentos','KPIs por setor','KPIs por setor'],['Governança','Score ESG','Score ESG'],['Carteira','Peso por risco','Peso por risco'],['Próx. resultado','Estimativa de resultados','Estimativa de resultados'],['Custo','R$ milhões','Acessível']].map(([item, gestor, radar], i) => (
                <div key={i} className="compare-row">
                  <span className="item">{item}</span>
                  <span className="gestor">{gestor}</span>
                  <span className="radar-col" style={item === 'Custo' ? { color: 'var(--green)' } : {}}>{radar}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades">
        <div className="features">
          <div className="sec-header reveal">
            <div className="sec-tag">Funcionalidades</div>
            <h2 className="sec-title">Tudo que um analista profissional usa.<br />Numa plataforma para você.</h2>
            <p className="sec-lead">Cada ferramenta foi desenhada com a mesma lógica que casas de research e gestoras aplicam no dia a dia.</p>
          </div>
          <div className="features-grid">
            <div className="feat-card destaque reveal">
              <div>
                <span className="feat-icon">💹</span>
                <h3 style={{ fontSize: '22px', marginBottom: '12px' }}>Valuation DCF — Fluxo de Caixa Descontado</h3>
                <p style={{ fontSize: '15px', marginBottom: '20px' }}>O mesmo modelo que profissionais de mercado usam para precificar empresas — com premissas macroeconômicas atualizadas, WACC calculado via CAPM e três cenários (Bear / Base / Bull) com tabela de sensibilidade completa.</p>
                <span className="feat-tag">Bear · Base · Bull · Sensibilidade WACC × g</span>
              </div>
              <div className="feat-visual">
                <p style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: '16px', fontWeight: 700 }}>Cenários DCF — WEGE3</p>
                <div className="dcf-scenario"><span className="dcf-label" style={{ color: 'var(--muted)' }}>Pessimista</span><div className="dcf-bar"><div className="dcf-fill" style={{ width: '0%', background: '#6b84a8' }} data-w="55" /></div><span className="dcf-val" style={{ color: '#6b84a8' }}>R$ 38</span></div>
                <div className="dcf-scenario"><span className="dcf-label" style={{ color: 'var(--gold)' }}>Base</span><div className="dcf-bar"><div className="dcf-fill" style={{ width: '0%', background: 'var(--gold)' }} data-w="74" /></div><span className="dcf-val" style={{ color: 'var(--gold)' }}>R$ 52</span></div>
                <div className="dcf-scenario"><span className="dcf-label" style={{ color: 'var(--green)' }}>Otimista</span><div className="dcf-bar"><div className="dcf-fill" style={{ width: '0%', background: 'var(--green)' }} data-w="95" /></div><span className="dcf-val" style={{ color: 'var(--green)' }}>R$ 67</span></div>
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Cotação atual</div><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>R$ 48,20</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Upside (base)</div><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--green)' }}>+7,9%</div></div>
                </div>
              </div>
            </div>
            <div className="feat-card reveal"><span className="feat-icon">🔍</span><h3>Análise Fundamentalista</h3><p>Indicadores históricos com benchmarks setoriais automáticos. ROE para bancos, SSS para varejo, lifting cost para petróleo — cada empresa analisada pelo métrico certo do setor.</p><span className="feat-tag">Score 0–10 · Semáforo de qualidade</span></div>
            <div className="feat-card reveal"><span className="feat-icon">⚖️</span><h3>Peso de Carteira</h3><p>Alocação racional baseada em upside DCF, risco e correlação entre ativos. Visualize sua exposição setorial e rebalanceie com critério — não com emoção.</p><span className="feat-tag">Risco · Correlação · Upside</span></div>
            <div className="feat-card reveal"><span className="feat-icon">🏛️</span><h3>Score de Governança</h3><p>11 critérios: empresa de dono (0,50), independência do conselho, histórico limpo (0,40), tag along, alinhamento com minoritários e nível de listagem na B3. Conflito público penaliza −0,5 pts. Máx 2,5 pts.</p><span className="feat-tag">11 critérios · máx 2,5 pts · Novo Mercado</span></div>
            <div className="feat-card reveal"><span className="feat-icon">📋</span><h3>Estimativa de Resultados</h3><p>Projeção do próximo trimestre antes da divulgação. Metodologia específica por setor: ADTV para bolsas, IPCA para utilities, SSS para varejo, volume para mineração.</p><span className="feat-tag">Antes do earnings · Por setor</span></div>
            <div className="feat-card reveal"><span className="feat-icon">🔔</span><h3>Alertas Inteligentes</h3><p>Notificações automáticas quando ações da sua carteira atingirem pontos críticos — 15% de queda (atenção) e 30% (crítico) em relação às máximas de 52 semanas.</p><span className="feat-tag">Alertas 15% e 30%</span></div>
          </div>
        </div>
      </section>

      {/* METODOLOGIA */}
      <section className="metodo" id="metodologia">
        <div className="metodo-inner">
          <div className="sec-header reveal"><div className="sec-tag">Como funciona</div><h2 className="sec-title">Da análise à decisão em 4 passos.</h2><p className="sec-lead">O mesmo processo que um analista de fundo segue — agora acessível para qualquer investidor.</p></div>
          <div className="metodo-steps">
            <div className="step-item reveal"><div className="step-num">1</div><h4>Selecione a empresa</h4><p>Mais de 100 ações B3 em 13 setores. Dados atualizados automaticamente via Yahoo Finance.</p></div>
            <div className="step-item reveal"><div className="step-num">2</div><h4>Analise os fundamentos</h4><p>Veja o histórico de 5 anos com benchmarks setoriais, score de saúde financeira e score de governança.</p></div>
            <div className="step-item reveal"><div className="step-num">3</div><h4>Calcule o valuation</h4><p>DCF completo. Ajuste WACC e crescimento. Veja os 3 cenários e a tabela de sensibilidade completa.</p></div>
            <div className="step-item reveal"><div className="step-num">4</div><h4>Decida com convicção</h4><p>Compare preço vs. valor intrínseco. Defina o peso correto na carteira baseado em risco e upside real.</p></div>
          </div>
        </div>
      </section>

      {/* SETORES */}
      <section className="setores" id="setores">
        <div className="sec-header reveal"><div className="sec-tag">Cobertura Setorial</div><h2 className="sec-title">Framework específico para cada setor.</h2><p className="sec-lead">Cada setor tem suas próprias variáveis críticas. Não analisamos banco como varejo.</p></div>
        <div className="setores-grid">
          {['🏦 Bancos e Financeiras','🛒 Varejo','⚡ Energia e Saneamento','🌾 Agronegócio','⛏️ Mineração e Siderurgia','🏥 Saúde','💻 Tecnologia','🏗️ Construção Civil','📡 Telecomunicações','🌲 Papel e Celulose','🛢️ Petróleo e Gás','🛡️ Seguradoras','📊 Bolsa / Exchange','🏭 Industriais'].map((s) => (
            <div key={s} className="setor-pill reveal">{s}</div>
          ))}
        </div>
      </section>

      {/* SOBRE */}
      <section className="sobre" id="sobre">
        <div className="sobre-inner">
          <div className="avatar-wrap reveal-scale">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/foto-alexander.jpg" alt="Alexander Faria Hurtado" className="avatar-foto" />
          </div>
          <div className="sobre-content reveal">
            <div className="tag">Quem está por trás</div>
            <h2>Alexander Faria Hurtado</h2>
            <p className="sobre-cargo">Gestor de Contabilidade · Cuiabá, MT</p>
            <p className="sobre-historia">
              Invisto em ações na B3 <strong>desde 2016</strong>. O maior obstáculo que sempre enfrentei foi o tempo: trabalho durante o dia e, quando chegava o momento de analisar uma empresa a fundo, não existia uma ferramenta que fizesse esse trabalho de forma <strong>completa e profissional</strong> — sem planilhas manuais, sem depender de dica de influencer, com a metodologia real que grandes profissionais de mercado utilizam.<br /><br />
              O Radar Invest Pro nasceu dessa necessidade real. <strong>Construí a plataforma que eu mesmo precisava e não encontrei no mercado.</strong>
            </p>
            <div className="sobre-creds">
              <div className="cred"><span className="cred-icon">🎓</span><div><strong>Ciências Contábeis</strong><span>UNEMAT · 2011</span></div></div>
              <div className="cred"><span className="cred-icon">📊</span><div><strong>Pós em Finanças, Auditoria e Controladoria</strong><span>UNIC · 2016</span></div></div>
              <div className="cred"><span className="cred-icon">🏆</span><div><strong>MBA em Finanças e Análise de Ações</strong><span>EXAME · 2025</span></div></div>
              <div className="cred"><span className="cred-icon">📈</span><div><strong>Investidor em ações B3</strong><span>desde 2016 · +9 anos de mercado</span></div></div>
            </div>
            <div className="social-links">
              <a href="https://www.linkedin.com/in/alexander-faria-hurtado-54b0b363/" target="_blank" rel="noopener" className="btn-social btn-linkedin">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                LinkedIn
              </a>
              <a href="https://www.instagram.com/radar_invest_pro" target="_blank" rel="noopener" className="btn-social btn-instagram">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                Instagram
              </a>
              <a href="https://youtube.com/@radarinvestpro" target="_blank" rel="noopener" className="btn-social btn-youtube">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                YouTube
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="acesso">
        <h2 className="reveal">Pronto para analisar<br />como um <span>profissional de mercado</span>?</h2>
        <p className="lead reveal">A plataforma já está disponível. Crie sua conta gratuitamente e comece a analisar agora.</p>
        <div className="reveal" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          <Link href="/cadastro" className="btn-primary" style={{ fontSize: '16px', padding: '16px 40px' }}>Fazer cadastro agora</Link>
          <Link href="/dashboard" className="btn-dash" style={{ fontSize: '16px', padding: '16px 32px' }}>Acessar plataforma</Link>
        </div>
        <p className="cta-note reveal">Gratuito para começar. Sem cartão de crédito.</p>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="foot-logo">Radar Invest <span>Pro</span></div>
        <div className="foot-info">© 2026 Radar Invest Pro · Marca registrada INPI nº 943514495<br />Cuiabá, MT · Brasil</div>
        <div className="foot-links">
          <a href="mailto:contato@radarinvestpro.com.br">contato@radarinvestpro.com.br</a>
          <a href="https://wa.me/5565992287632" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href="#">Privacidade</a>
        </div>
      </footer>
    </>
  )
}
