'use client'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import dcfRaw from '@/lib/dcf.json'
import { track } from '@vercel/analytics'
import { type PremissasDCF, type ResultadoDCF, calcDCFCustom, premissasDeEmp } from '@/lib/dcf-engine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcfData = dcfRaw as Record<string, any>
const empresas = Object.values(dcfData).sort((a: any, b: any) => {
  const ua = a.base?.upside ?? a.upside_base_legado ?? -999
  const ub = b.base?.upside ?? b.upside_base_legado ?? -999
  return ub - ua
})

const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fPct = (v: number | null | undefined) => v == null ? '—' : `${v > 0 ? '+' : ''}${f1(v)}%`
const corUpside = (v: number | null | undefined) =>
  v == null ? '#6b84a8' : v >= 20 ? '#00d4a0' : v >= 0 ? '#FFD54F' : '#ef4444'


type Aba = 'resumo' | 'historico' | 'linhas' | 'projecoes' | 'sensibilidade' | 'outros' | 'tri' | 'kpis' | 'saude'

/* ── Ajustes do Analista — tipo e default ────────────────────────────────── */
interface AjustesAnalista {
  nao_recorrente_liq: number   // R$ MM a remover da base de projeção
  wacc_ajuste: number          // pp a somar ao WACC (positivo = conservador)
  desconto_adicional: number   // % a descontar/premiar sobre o preço final
  observacoes: string
}
const AJUSTES_DEFAULT: AjustesAnalista = { nao_recorrente_liq: 0, wacc_ajuste: 0, desconto_adicional: 0, observacoes: '' }

/* ── Configuração de inputs por setor (Premissas Próx. Tri) ─────────────── */
interface CampoSetor { key: string; label: string; default: number; hint?: string }
interface SetorConfig { label: string; campos: CampoSetor[] }
const SETORES_CONFIG: Record<string, SetorConfig> = {
  varejo_vest: { label:'Varejo Vestuário', campos:[
    { key:'sss',        label:'SSS lojas exist. (%)',      default:5.0,  hint:'Same Store Sales YoY' },
    { key:'new_stores', label:'Novas lojas (qtde)',         default:20 },
    { key:'ramp_up',    label:'Ramp up novas lojas (%)',    default:50,   hint:'% receita vs loja madura no 1º tri' },
  ]},
  varejo_alim: { label:'Varejo Alimentar', campos:[
    { key:'sss',        label:'SSS lojas exist. (%)',       default:0.0 },
    { key:'new_stores', label:'Novas lojas (qtde)',          default:5 },
    { key:'ramp_up',    label:'Ramp up novas lojas (%)',     default:50 },
  ]},
  tecnologia: { label:'Tecnologia', campos:[
    { key:'cresc_seg',      label:'Cresc. Segurança (% a/a)',  default:4.0 },
    { key:'cresc_tic',      label:'Cresc. TIC (% a/a)',        default:-5.0 },
    { key:'cresc_ener',     label:'Cresc. Energia (% a/a)',    default:8.0 },
    { key:'mg_ebitda_next', label:'Mg. EBITDA esperada (%)',   default:12.5 },
  ]},
  agro_ind: { label:'Agro Industrial', campos:[
    { key:'cresc_mi',       label:'Cresc. Merc. Interno (% a/a)',  default:2.0 },
    { key:'cresc_me',       label:'Cresc. Merc. Externo (% a/a)',  default:18.0 },
    { key:'mg_ebitda_next', label:'Mg. EBITDA esperada (%)',       default:15.0 },
  ]},
  real_estate: { label:'Real Estate / Incorporação', campos:[
    { key:'vgv_pct',    label:'VGV lançado (% vs ref)',     default:0, hint:'Δ em relação ao mesmo tri ano anterior' },
    { key:'vendas_pct', label:'Vendas contrat. (% vs ref)', default:0 },
    { key:'mg_bruta_pp',label:'Margem bruta (pp vs ref)',   default:0 },
  ]},
  ddm_seguro: { label:'Seguro / DDM', campos:[
    { key:'ll_prev', label:'LL Prev./Saúde (R$ MM)',   default:5500 },
    { key:'ll_seg',  label:'LL Seguros (R$ MM)',        default:2254 },
    { key:'ll_ban',  label:'LL Corretora (R$ MM)',      default:864 },
    { key:'ll_cap',  label:'LL Cap./Outros (R$ MM)',    default:420 },
  ]},
  banco: { label:'Banco / Financeiro', campos:[
    { key:'npl',         label:'NPL >90d (%)',               default:3.5 },
    { key:'g_carteira',  label:'g Carteira de Crédito (% a/a)', default:10.0 },
    { key:'mg_financeira',label:'Mg. Financeira Líq. (%)',   default:8.0 },
  ]},
  bolsa: { label:'Bolsa (B3SA3)', campos:[
    { key:'adtv',          label:'ADTV spot (R$ bi/dia)',    default:23.0 },
    { key:'g_tech',        label:'g Tecnologia/Dados (% a/a)',default:12.0 },
    { key:'mg_ebitda_next',label:'Mg. EBITDA esperada (%)', default:63.5 },
  ]},
  energia: { label:'Energia Elétrica', campos:[
    { key:'ipca_reaj',     label:'Reajuste tarifário IPCA (%)', default:6.5 },
    { key:'var_vol',       label:'Var. volume elétrico (% a/a)', default:1.0 },
    { key:'mg_ebitda_next',label:'Mg. EBITDA esperada (%)',    default:30.5 },
  ]},
  celulose: { label:'Celulose / Papel', campos:[
    { key:'bhkp_usd', label:'BHKP esperado (USD/t)',   default:650 },
    { key:'vol_kt',   label:'Volume produção (kt)',      default:2800 },
    { key:'fx',       label:'Câmbio BRL/USD esperado',  default:5.15 },
  ]},
  petroleo: { label:'Petróleo / E&P', campos:[
    { key:'brent',      label:'Brent esperado (USD/bbl)', default:75 },
    { key:'prod_mboed', label:'Produção (Mboed)',          default:2800 },
    { key:'fx',         label:'Câmbio BRL/USD esperado',  default:5.15 },
  ]},
  agro: { label:'Agro / Commodities', campos:[
    { key:'area_kha_pct', label:'Área plantada (% vs ref)',  default:0 },
    { key:'yield_pct',    label:'Yield bags/ha (% vs ref)',   default:0 },
    { key:'bag_price_pct',label:'Preço bag R$ (% vs ref)',   default:0 },
  ]},
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectarSetor(emp: any): string {
  const t = (emp.ticker ?? '').toUpperCase()
  const s = (emp.setor ?? '').toLowerCase()
  if (['B3SA3'].some(x => t.includes(x))) return 'bolsa'
  if (['BBSE3','PSSA3','CXSE3','IZZB3','IRBR3'].some(x => t.includes(x))) return 'ddm_seguro'
  if (['BBAS3','BBDC4','ITUB4','SANB11','BMGB4','BPAC11'].some(x => t.includes(x))) return 'banco'
  if (['AZZA3','RIAA3','CEAB3','AMAR3','SOMA3','LREN3'].some(x => t.includes(x))) return 'varejo_vest'
  if (['GMAT3','PCAR3','ASAI3'].some(x => t.includes(x))) return 'varejo_alim'
  if (['INTB3'].some(x => t.includes(x))) return 'tecnologia'
  if (['KEPL3'].some(x => t.includes(x))) return 'agro_ind'
  if (['CYRE3','EVEN3','TRIS3','MRV3'].some(x => t.includes(x))) return 'real_estate'
  if (['EGIE3','TAEE11','CPFE3','ENGI11','AURE3','SBSP3','CSMG3'].some(x => t.includes(x))) return 'energia'
  if (['SUZB3','KLBN11','RANI3'].some(x => t.includes(x))) return 'celulose'
  if (['PETR4','PRIO3','RECV3','BRAV3','RRRP3'].some(x => t.includes(x))) return 'petroleo'
  if (['SOJA3','SLCE3','AGRO3','CAML3'].some(x => t.includes(x))) return 'agro'
  if (s.includes('varejo')) return 'varejo_vest'
  if (s.includes('energia') || s.includes('utili')) return 'energia'
  if (s.includes('banco') || s.includes('financ')) return 'banco'
  return 'generico'
}

// Estimation engine — mirrors dcf.py calc_next_quarter_estimate()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function estimarProxTriLocal(emp: any, setor: string, inputs: Record<string, number>): Record<string, number | null> {
  const r1 = (v: number) => Math.round(v * 10) / 10
  const recBase = ((emp.rec_base ?? 0) / 4) // quarterly base (LTM ÷ 4)
  const kl = emp.kpis_ltm ?? {}
  const mgEH = (kl.mg_ebitda != null ? (kl.mg_ebitda < 2 ? kl.mg_ebitda * 100 : kl.mg_ebitda) : (emp.mg_ebitda?.[0] ?? 20)) / 100
  const mgLL = kl.ll != null && kl.receita != null && kl.receita > 0 ? kl.ll / kl.receita / 4 : 0.08

  let recEst = recBase
  let ebEst: number | null = null
  let mgEst: number | null = null
  let llEst: number | null = null

  switch (setor) {
    case 'varejo_vest': case 'varejo_alim': {
      const nL = kl.n_lojas ?? 100
      const sss = (inputs.sss ?? 5) / 100
      const ns  = inputs.new_stores ?? 20
      const ru  = (inputs.ramp_up ?? 50) / 100
      const rpl = nL > 0 ? recBase / nL : 0
      recEst = recBase * (1 + sss) + ns * rpl * ru
      break
    }
    case 'tecnologia': {
      const g = (0.61*(inputs.cresc_seg??4) + 0.21*(inputs.cresc_tic??-5) + 0.18*(inputs.cresc_ener??8)) / 100
      recEst = recBase * (1 + g)
      const mg = (inputs.mg_ebitda_next ?? 12.5) / 100
      ebEst = recEst * mg; mgEst = mg * 100; break
    }
    case 'agro_ind': {
      const g = (0.84*(inputs.cresc_mi??2) + 0.16*(inputs.cresc_me??18)) / 100
      recEst = recBase * (1 + g)
      const mg = (inputs.mg_ebitda_next ?? 15) / 100
      ebEst = recEst * mg; mgEst = mg * 100; break
    }
    case 'energia': {
      recEst = recBase * (1 + (inputs.ipca_reaj??6.5)/100) * (1 + (inputs.var_vol??1)/100)
      const mg = (inputs.mg_ebitda_next ?? 30.5) / 100
      ebEst = recEst * mg; mgEst = mg * 100; break
    }
    case 'bolsa': {
      const adtvRef = kl.adtv ?? 23; const adtvEsp = inputs.adtv ?? adtvRef
      recEst = recBase * (0.65 * (adtvRef > 0 ? adtvEsp/adtvRef : 1) + 0.35 * (1 + (inputs.g_tech??12)/100))
      const mg = (inputs.mg_ebitda_next ?? 63.5) / 100
      ebEst = recEst * mg; mgEst = mg * 100; break
    }
    case 'celulose': {
      const bhkp = inputs.bhkp_usd ?? 650; const vol = inputs.vol_kt ?? 2800; const fx = inputs.fx ?? 5.15
      recEst = (bhkp * vol * fx) / 1000; break
    }
    case 'petroleo': {
      const brent = inputs.brent ?? 75; const prod = inputs.prod_mboed ?? 2800; const fx = inputs.fx ?? 5.15
      recEst = prod * 90 * brent * fx / 1e6; break
    }
    case 'ddm_seguro': {
      llEst = (inputs.ll_prev??5500) + (inputs.ll_seg??2254) + (inputs.ll_ban??864) + (inputs.ll_cap??420)
      break
    }
    default: {
      const g = (emp.g_receita?.[0] ?? 8) / 100
      recEst = recBase * (1 + g)
    }
  }

  if (ebEst == null) { ebEst = recEst * mgEH; mgEst = mgEH * 100 }
  if (llEst == null) { llEst = recEst * mgLL }

  return {
    receita:   r1(recEst),
    ebitda:    r1(ebEst),
    mg_ebitda: mgEst != null ? r1(mgEst) : r1(ebEst / recEst * 100),
    ll:        r1(llEst),
    ...(inputs.sss        != null ? { sss:     inputs.sss }                             : {}),
    ...(inputs.npl        != null ? { npl:     inputs.npl }                             : {}),
    ...(inputs.bhkp_usd   != null ? { bhkp:    inputs.bhkp_usd }                        : {}),
    ...(inputs.brent      != null ? { brent:   inputs.brent }                           : {}),
    ...(inputs.new_stores != null ? { n_lojas: (kl.n_lojas ?? 0) + inputs.new_stores } : {}),
  }
}

/* ── Componentes menores ──────────────────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: '100px', padding: '3px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const }}>
      {label}
    </span>
  )
}

function CenCard({ label, cor, preco, upside }: { label: string; cor: string; preco: number|null; upside: number|null }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${cor}33`, borderRadius: '12px', padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, color: cor, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: 'clamp(20px, 6vw, 30px)', fontWeight: 700, color: cor, fontFamily: 'var(--font-space),Space Grotesk,sans-serif', lineHeight: 1 }}>
        {preco != null ? `R$ ${f2(preco)}` : 'R$ —'}
      </div>
      {upside != null && (
        <div style={{ fontSize: '14px', color: cor, marginTop: '6px', fontWeight: 600 }}>{fPct(upside)}</div>
      )}
    </div>
  )
}

function ParamCard({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: '8px', padding: '12px 16px' }}>
      <div style={{ fontSize: '10.5px', color: '#6b84a8', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-space),monospace' }}>{val}</div>
    </div>
  )
}

function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#e8a020', marginBottom: '14px', marginTop: '24px' }}>{children}</div>
}

function Tabela({ cols, rows }: { cols: string[]; rows: (string|number|null)[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '500px' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const, color: '#6b84a8', borderBottom: '2px solid rgba(255,255,255,.08)', whiteSpace: 'nowrap' as const }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '9px 12px', textAlign: j === 0 ? 'left' : 'right', color: j === 0 ? '#b8c4d4' : '#e8edf5', fontFamily: j === 0 ? 'inherit' : 'var(--font-space),monospace', fontWeight: j === 0 ? 400 : 600 }}>
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Modal relatório ───────────────────────────────────────────────────────── */
function ModalRelatorio({ ticker, nome, onClose }: { ticker: string; nome: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [rel, setRel] = useState<string|null>(null)
  const [erro, setErro] = useState('')

  const gerar = async () => {
    setLoading(true); setErro(''); setRel(null)
    try {
      const r = await fetch(`/api/relatorio/${ticker}`)
      const d = await r.json()
      if (!r.ok) { setErro(d.error ?? 'Erro'); return }
      setRel(d.relatorio)
    } catch { setErro('Erro de conexão.') }
    finally { setLoading(false) }
  }

  const html = useMemo(() => rel ? rel
    .replace(/^### (.+)$/gm, '<h3 style="color:#e8a020;margin:18px 0 6px;font-size:13px;letter-spacing:.5px;text-transform:uppercase">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#e8edf5;margin:22px 0 8px;font-size:15px;font-weight:700">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8edf5">$1</strong>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#e8a020">•</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/>')
    : '', [rel])

  const gerarPDF = () => {
    if (!rel) return
    const d = dcfData[ticker] ?? {}
    const bear = d.bear ?? {}; const base = d.base ?? {}; const bull = d.bull ?? {}
    const dataHoje = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })

    const fR = (v: number|null|undefined) => v == null ? '—' : `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
    const fP = (v: number|null|undefined) => v == null ? '—' : `${v>0?'+':''}${v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`

    // Converte markdown para HTML de impressão (fundo branco, legível)
    const conteudo = rel
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hup]|<\/[hup])(.+)$/gm, '<p>$1</p>')
      .replace(/<p><\/p>/g, '')

    const html_pdf = `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Relatório DCF — ${ticker} — Radar Invest Pro</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Georgia',serif;background:#fff;color:#1a2744;font-size:12px;line-height:1.75}
  /* ── Barra de ação (some ao imprimir) ── */
  .toolbar{display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 40px;background:#f0f4f8;border-bottom:2px solid #1E3A5F}
  .toolbar button{padding:8px 22px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:700}
  .btn-pdf{background:#1E3A5F;color:#fff}
  .btn-close{background:transparent;border:1px solid #cbd5e0 !important;color:#4a5568}
  /* ── Cabeçalho ── */
  .header{background:#1E3A5F;color:#fff;padding:32px 40px 28px;display:flex;justify-content:space-between;align-items:flex-start}
  .header-logo{font-size:10px;font-weight:800;letter-spacing:2.5px;color:#e8a020;text-transform:uppercase;margin-bottom:10px}
  .header-logo span{display:inline-block;width:8px;height:8px;border-radius:50%;background:#e8a020;margin-right:6px;vertical-align:middle}
  .header-title{font-size:22px;font-weight:700;color:#fff;line-height:1.2}
  .header-sub{font-size:13px;color:rgba(255,255,255,.7);margin-top:5px}
  .header-meta{text-align:right;font-size:11px;color:rgba(255,255,255,.65);line-height:1.8}
  /* ── Cenários ── */
  .cenarios{display:flex;gap:14px;padding:24px 40px;background:#fafbfc;border-bottom:1px solid #e2e8f0}
  .cen{flex:1;border-radius:10px;padding:16px 18px;text-align:center;border:1.5px solid}
  .cen-bear{border-color:#fca5a5;background:#fff5f5}.cen-base{border-color:#fcd34d;background:#fffbeb}.cen-bull{border-color:#6ee7b7;background:#f0fdf4}
  .cen-label{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px}
  .cen-bear .cen-label{color:#dc2626}.cen-base .cen-label{color:#b45309}.cen-bull .cen-label{color:#059669}
  .cen-preco{font-size:26px;font-weight:700;color:#1a2744}
  .cen-upside{font-size:12px;margin-top:4px;font-weight:600}
  .cen-bear .cen-upside{color:#dc2626}.cen-base .cen-upside{color:#b45309}.cen-bull .cen-upside{color:#059669}
  /* ── Conteúdo ── */
  .content{padding:28px 40px 8px}
  h2{font-size:15px;font-weight:700;color:#1E3A5F;margin:26px 0 8px;padding-bottom:5px;border-bottom:2px solid #e8a020}
  h3{font-size:11px;font-weight:700;color:#1E3A5F;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.8px}
  p{margin:6px 0;color:#2D3748;font-size:12px}
  ul{margin:8px 0 8px 20px}
  li{margin:4px 0;color:#2D3748}
  strong{color:#1E3A5F;font-weight:700}
  /* ── Rodapé ── */
  .footer{margin-top:32px;padding:18px 40px;background:#f0f4f8;border-top:3px solid #1E3A5F}
  .footer-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .footer-brand{font-size:12px;font-weight:700;color:#1E3A5F}
  .footer-inpi{font-size:10px;color:#718096}
  .footer-disc{font-size:9px;color:#718096;line-height:1.6}
  /* ── Impressão ── */
  @media print{
    .toolbar{display:none}
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .header{background:#1E3A5F!important;-webkit-print-color-adjust:exact}
    .cenarios{background:#fafbfc!important}
    .footer{background:#f0f4f8!important}
    .cen-bear{background:#fff5f5!important;border-color:#fca5a5!important}
    .cen-base{background:#fffbeb!important;border-color:#fcd34d!important}
    .cen-bull{background:#f0fdf4!important;border-color:#6ee7b7!important}
  }
</style>
</head><body>

<div class="toolbar">
  <span style="font-size:12px;color:#4a5568;margin-right:auto">Para salvar como PDF: clique em Imprimir → selecione "Salvar como PDF"</span>
  <button class="btn-close" onclick="window.close()">Fechar</button>
  <button class="btn-pdf" onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</div>

<div class="header">
  <div>
    <div class="header-logo"><span></span>Radar Invest Pro</div>
    <div class="header-title">Relatório de Valuation — ${ticker}</div>
    <div class="header-sub">${nome} &nbsp;·&nbsp; Análise por IA com dados DCF</div>
  </div>
  <div class="header-meta">
    <div>${dataHoje}</div>
    <div style="color:rgba(255,255,255,.5);font-size:9px;margin-top:6px">radarinvestpro.com.br</div>
  </div>
</div>

<div class="cenarios">
  <div class="cen cen-bear">
    <div class="cen-label">🔴 Pessimista (Bear)</div>
    <div class="cen-preco">${fR(bear.preco)}</div>
    <div class="cen-upside">${fP(bear.upside)}</div>
  </div>
  <div class="cen cen-base">
    <div class="cen-label">🟡 Base</div>
    <div class="cen-preco">${fR(base.preco)}</div>
    <div class="cen-upside">${fP(base.upside ?? d.upside_base_legado)}</div>
  </div>
  <div class="cen cen-bull">
    <div class="cen-label">🟢 Otimista (Bull)</div>
    <div class="cen-preco">${fR(bull.preco)}</div>
    <div class="cen-upside">${fP(bull.upside)}</div>
  </div>
</div>

<div class="content">${conteudo}</div>

<div class="footer">
  <div class="footer-top">
    <div class="footer-brand">Radar Invest Pro &nbsp;·&nbsp; radarinvestpro.com.br</div>
    <div class="footer-inpi">Marca INPI nº 943514495</div>
  </div>
  <div class="footer-disc">
    Este relatório foi gerado automaticamente por inteligência artificial (Claude, Anthropic) com base em dados públicos de mercado e modelos de valuation DCF.
    Não constitui recomendação de investimento. Investimentos em renda variável envolvem riscos, incluindo perda parcial ou total do capital investido.
    O investidor deve realizar análise independente e consultar seu assessor de investimentos antes de tomar qualquer decisão.
  </div>
</div>

</body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) { alert('Permita pop-ups para gerar o PDF.'); return }
    w.document.write(html_pdf)
    w.document.close()
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }}
         onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#0d1a2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:'14px',width:'100%',maxWidth:'800px',maxHeight:'90vh',display:'flex',flexDirection:'column' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>📄 Relatório — {ticker} · {nome}</h2>
          <div style={{ display:'flex',gap:'8px' }}>
            {rel&&<button onClick={()=>navigator.clipboard.writeText(rel)} style={{ background:'rgba(232,160,32,.12)',border:'1px solid rgba(232,160,32,.3)',color:'#e8a020',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontWeight:600 }}>⎘ Copiar</button>}
            {rel&&<button onClick={gerarPDF} style={{ background:'#1E3A5F',border:'1px solid #2d5a8e',color:'#90CAF9',padding:'6px 14px',borderRadius:'6px',cursor:'pointer',fontSize:'12px',fontWeight:600 }}>↓ PDF</button>}
            <button onClick={onClose} style={{ background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer' }}>×</button>
          </div>
        </div>
        <div style={{ overflowY:'auto',padding:'20px 24px',flex:1,fontSize:'13.5px',lineHeight:1.8,color:'#b8c4d4' }}>
          {!rel&&!loading&&!erro&&(
            <div style={{ textAlign:'center',padding:'40px' }}>
              <p style={{ fontSize:'40px',marginBottom:'16px' }}>🤖</p>
              <p style={{ color:'#b8c4d4',marginBottom:'6px' }}>Relatório gerado pelo Claude com base nos dados DCF.</p>
              <p style={{ color:'#6b84a8',fontSize:'13px',marginBottom:'28px' }}>~30-40 segundos.</p>
              <button onClick={gerar} style={{ background:'#e8a020',color:'#000',fontWeight:700,fontSize:'14px',padding:'12px 32px',borderRadius:'8px',border:'none',cursor:'pointer' }}>
                Gerar Relatório com IA
              </button>
            </div>
          )}
          {loading&&(
            <div style={{ textAlign:'center',padding:'40px' }}>
              <div style={{ width:'40px',height:'40px',border:'3px solid rgba(232,160,32,.15)',borderTopColor:'#e8a020',borderRadius:'50%',animation:'spin .75s linear infinite',margin:'0 auto 16px' }}/>
              <p style={{ color:'#6b84a8' }}>Gerando análise com Claude AI…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {erro&&<p style={{ color:'#ef4444',textAlign:'center',padding:'20px' }}>{erro}</p>}
          {rel&&<div dangerouslySetInnerHTML={{ __html: html }}/>}
        </div>
      </div>
    </div>
  )
}

/* ── Seções da empresa ────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecResumo({ e, precoLive, customResult }: { e: any; precoLive: number|null; customResult?: ResultadoDCF | null }) {
  const bear = customResult?.bear ?? e.bear ?? {}
  const base = customResult?.base ?? e.base ?? {}
  const bull = customResult?.bull ?? e.bull ?? {}
  const isCustom = !!customResult

  const calcUp = (target: number|null, fallback: number|null) =>
    target != null && precoLive != null && precoLive > 0
      ? ((target - precoLive) / precoLive) * 100
      : fallback

  const up_bear = isCustom ? bear.upside : calcUp(bear.preco, bear.upside)
  const up_base = isCustom ? base.upside : calcUp(base.preco, base.upside ?? e.upside_base_legado)
  const up_bull = isCustom ? bull.upside : calcUp(bull.preco, bull.upside)

  return (
    <>
      {isCustom && (
        <div style={{ background: 'rgba(232,160,32,.08)', border: '1px solid rgba(232,160,32,.25)', borderRadius: '8px', padding: '8px 14px', marginBottom: '14px', fontSize: '12px', color: '#e8a020', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚡</span>
          <span>Premissas editadas — resultado recalculado em tempo real</span>
        </div>
      )}
      <SecTitle>Cenários de Valuation</SecTitle>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'10px',marginBottom:'24px' }}>
        <CenCard label="🔴 Pessimista (Bear)" cor="#ef4444" preco={bear.preco} upside={up_bear}/>
        <CenCard label="🟡 Base"              cor="#e8a020" preco={base.preco} upside={up_base}/>
        <CenCard label="🟢 Otimista (Bull)"  cor="#00d4a0" preco={bull.preco} upside={up_bull}/>
      </div>

      <SecTitle>Parâmetros do Modelo</SecTitle>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:'10px',marginBottom:'24px' }}>
        <ParamCard label="WACC" val={e.wacc != null ? f1(e.wacc) + '%' : '—'}/>
        <ParamCard label="g Terminal" val={e.g_terminal != null ? f1(e.g_terminal) + '%' : '—'}/>
        <ParamCard label="Ke (Custo Capital)" val={e.wacc_ke != null ? f1(e.wacc_ke) + '%' : '—'}/>
        <ParamCard label="Rf (NTN-B)" val={e.wacc_rf != null ? f1(e.wacc_rf) + '%' : '—'}/>
        <ParamCard label="Beta" val={e.wacc_beta != null ? f2(e.wacc_beta) : '—'}/>
        <ParamCard label="ERP Brasil" val={e.wacc_erp != null ? f1(e.wacc_erp) + '%' : '—'}/>
      </div>

      {e.g_receita?.length > 0 && (
        <>
          <SecTitle>Crescimento de Receita Projetado</SecTitle>
          <div style={{ display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'20px' }}>
            {(e.g_receita as number[]).map((g, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 14px',textAlign:'center' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'2px' }}>Ano {i+1}</div>
                <div style={{ fontSize:'14px',fontWeight:700,color:'#00d4a0' }}>{g != null ? f1(g) + '%' : '—'}</div>
              </div>
            ))}
            <div style={{ background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 14px',textAlign:'center' }}>
              <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'2px' }}>Terminal</div>
              <div style={{ fontSize:'14px',fontWeight:700,color:'#e8a020' }}>{f1(e.g_terminal)}%</div>
            </div>
          </div>
        </>
      )}

      {e.mg_ebitda?.length > 0 && (
        <>
          <SecTitle>Margens EBITDA Projetadas</SecTitle>
          <div style={{ display:'flex',gap:'8px',flexWrap:'wrap' }}>
            {(e.mg_ebitda as number[]).map((m, i) => (
              <div key={i} style={{ background:'rgba(255,255,255,.04)',borderRadius:'6px',padding:'8px 14px',textAlign:'center' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'2px' }}>Ano {i+1}</div>
                <div style={{ fontSize:'14px',fontWeight:700,color:'#e8edf5' }}>{m != null ? f1(m) + '%' : '—'}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function SecHistorico({ e }: { e: any }) {
  const hist: any[] = e.historico || []
  if (!hist.length) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Histórico não disponível. Rode export_dcf.py após calcular no fundamento.py.</p>

  const temCapex  = hist.some(h => h.capex  != null)
  const temLojas  = hist.some(h => h.n_lojas != null)
  const temArea   = hist.some(h => h.area_m2 != null)

  const cols = [
    'Ano', 'Receita (R$M)', 'EBITDA ex (R$M)', 'Mg EBITDA', 'EBIT (R$M)',
    ...(temCapex ? ['CapEx (R$M)'] : []),
    'FCL (R$M)', 'Dív. Líq. (R$M)',
    ...(temLojas ? ['Lojas'] : []),
    ...(temArea  ? ['Área m²'] : []),
  ]
  const rows = hist.map(h => {
    const mg = h.mg_ebitda != null ? f1(h.mg_ebitda < 2 ? h.mg_ebitda * 100 : h.mg_ebitda) + '%' : '—'
    return [
      h.ano,
      h.receita  != null ? f2(h.receita)  : '—',
      h.ebitda   != null ? f2(h.ebitda)   : '—',
      mg,
      h.ebit     != null ? f2(h.ebit)     : '—',
      ...(temCapex ? [h.capex   != null ? f2(h.capex)   : '—'] : []),
      h.fcl      != null ? f2(h.fcl)      : '—',
      h.div_liq  != null ? f2(h.div_liq)  : '—',
      ...(temLojas ? [h.n_lojas != null ? String(Math.round(h.n_lojas)) : '—'] : []),
      ...(temArea  ? [h.area_m2 != null ? f2(h.area_m2) : '—']  : []),
    ]
  })
  return <Tabela cols={cols} rows={rows}/>
}

function SecProjecoes({ e, customResult }: { e: any; customResult?: ResultadoDCF | null }) {
  const proj: any[] = customResult?.base.projecoes ?? e.projecoes ?? []
  const vt = customResult?.base.valor_terminal ?? e.valor_terminal
  const isCustom = !!customResult
  if (!proj.length) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Projeções não disponíveis. Rode export_dcf.py após calcular no fundamento.py.</p>
  const cols = ['Ano','Receita (R$M)','EBITDA ex','EBIT','NOPAT','CapEx','FCL','VP FCL']
  const rows = [
    ...proj.map((p: any) => [
      p.ano,
      p.receita != null ? f2(p.receita) : '—',
      p.ebitda  != null ? f2(p.ebitda)  : '—',
      p.ebit    != null ? f2(p.ebit)    : '—',
      p.nopat   != null ? f2(p.nopat)   : '—',
      p.capex   != null ? f2(p.capex)   : '—',
      p.fcl     != null ? f2(p.fcl)     : '—',
      p.vp_fcl  != null ? f2(p.vp_fcl)  : '—',
    ]),
    ['Terminal','—','—','—','—','—',
      vt != null ? `${f2(vt)} (VT)` : '—',
      vt != null ? f2(vt) : '—',
    ],
  ]
  return (
    <>
      {isCustom && <p style={{ fontSize:'11px',color:'#e8a020',marginBottom:'10px' }}>⚡ Projeções recalculadas com premissas editadas (cenário Base)</p>}
      <Tabela cols={cols} rows={rows}/>
    </>
  )
}

function SecSensibilidade({ e, precoLive }: { e: any; precoLive?: number|null }) {
  const sens = e.sensibilidade
  if (!sens) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Tabela de sensibilidade não disponível. Rode export_dcf.py.</p>
  const gCols: number[] = sens.g_cols || []
  const linhas: { wacc: number; valores: number[] }[] = sens.linhas || []
  const baseWacc = e.wacc
  const baseG    = e.g_terminal

  return (
    <div style={{ overflowX:'auto' }}>
      <p style={{ fontSize:'12px',color:'#6b84a8',marginBottom:'12px' }}>
        Preço justo (R$) por combinação WACC × g terminal. Célula destacada = cenário base.
      </p>
      <table style={{ borderCollapse:'collapse',fontSize:'12.5px' }}>
        <thead>
          <tr>
            <th style={{ padding:'8px 14px',color:'#6b84a8',fontSize:'10.5px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',borderBottom:'2px solid rgba(255,255,255,.08)' }}>
              WACC \ g
            </th>
            {gCols.map(g => (
              <th key={g} style={{ padding:'8px 14px',color: Math.abs(g - baseG) < 0.1 ? '#e8a020' : '#6b84a8',fontSize:'10.5px',fontWeight:700,borderBottom:'2px solid rgba(255,255,255,.08)',textAlign:'center' }}>
                g={f1(g)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => {
            const isBaseWacc = Math.abs(linha.wacc - baseWacc) < 0.1
            return (
              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding:'8px 14px',color: isBaseWacc ? '#e8a020' : '#6b84a8',fontWeight: isBaseWacc ? 700 : 400 }}>
                  {f1(linha.wacc)}%
                </td>
                {linha.valores.map((v, j) => {
                  const isBase = isBaseWacc && Math.abs(gCols[j] - baseG) < 0.1
                  const precoRef = precoLive ?? e.preco_atual
                  const cor = v == null ? '#6b84a8' : v < (precoRef || 999) ? '#ef4444' : '#00d4a0'
                  return (
                    <td key={j} style={{ padding:'8px 14px',textAlign:'center',fontWeight: isBase ? 700 : 600,color: isBase ? '#e8a020' : cor,background: isBase ? 'rgba(232,160,32,.1)' : 'transparent',borderRadius: isBase ? '4px' : '0' }}>
                      {v != null ? `R$${v}` : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SecOutros({ e, precoLive }: { e: any; precoLive: number|null }) {
  const precoBase = e.preco_atual ?? null
  const difPct = precoLive != null && precoBase != null && precoBase > 0
    ? ((precoLive - precoBase) / precoBase) * 100 : null
  const precoMudou = difPct != null && Math.abs(difPct) >= 0.5

  return (
    <>
      {/* Aviso quando preço atual difere do preço usado no cálculo da TIR */}
      {precoMudou && (
        <div style={{ background:'rgba(232,160,32,.07)',border:'1px solid rgba(232,160,32,.25)',borderRadius:'8px',padding:'10px 16px',marginBottom:'16px',fontSize:'12px',color:'#b8c4d4',display:'flex',gap:'8px',alignItems:'center' }}>
          <span style={{ color:'#e8a020',fontWeight:700 }}>⚠</span>
          <span>
            TIR calculada ao preço de <strong style={{color:'#e8edf5'}}>R$ {f2(precoBase)}</strong> (base do DCF).
            Cotação atual: <strong style={{color: difPct! > 0 ? '#00d4a0' : '#ef4444'}}>R$ {f2(precoLive!)} ({difPct! > 0 ? '+' : ''}{f1(difPct!)}%)</strong>
            {' '} — a TIR real implícita ao preço atual é {difPct! > 0 ? 'menor' : 'maior'} que a exibida.
          </span>
        </div>
      )}
      {/* TIR Real */}
      {e.tir && (
        <>
          <SecTitle>TIR Real Implícita</SecTitle>
          <div style={{ background:'rgba(139,92,246,.08)',border:'1px solid rgba(139,92,246,.2)',borderRadius:'10px',padding:'16px 20px',marginBottom:'20px' }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
              {[
                { label:'TIR Nominal', val: e.tir.nominal != null ? f1(e.tir.nominal) + '% a.a.' : '—' },
                { label:'TIR Real (ex-IPCA 5%)', val: e.tir.real != null ? f1(e.tir.real) + '% a.a.' : '—' },
                { label:'vs. SELIC real', val: e.tir.vs_selic != null ? fPct(e.tir.vs_selic) + 'pp' : '—' },
                { label:'vs. NTN-B 10Y real', val: e.tir.vs_ntnb != null ? fPct(e.tir.vs_ntnb) + 'pp' : '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'3px' }}>{item.label}</div>
                  <div style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>{item.val}</div>
                </div>
              ))}
            </div>
            {e.tir.veredito && (
              <div style={{ marginTop:'12px',paddingTop:'12px',borderTop:'1px solid rgba(255,255,255,.06)',fontSize:'13px',fontWeight:700,color: e.tir.vs_ntnb > 0 ? '#00d4a0' : '#FFD54F' }}>
                Veredito: {e.tir.veredito}
              </div>
            )}
          </div>
        </>
      )}

      {/* TIR do Acionista */}
      {e.tir_acionista && (
        <>
          <SecTitle>TIR do Acionista  (Div + JCP + Recompras)</SecTitle>
          <div style={{ background:'rgba(0,212,160,.06)',border:'1px solid rgba(0,212,160,.2)',borderRadius:'10px',padding:'16px 20px',marginBottom:'20px' }}>
            <div style={{ fontSize:'12px',color:'#80cbc4',marginBottom:'12px' }}>
              Retorno implícito considerando apenas o que é efetivamente devolvido ao acionista.
              Yield bruto = Div+JCP LTM / Preço atual · TIR = Yield + g_terminal
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>
              {[
                { label:'Yield Bruto (Div+JCP/P)', val: e.tir_acionista.yield_bruto != null ? f1(e.tir_acionista.yield_bruto) + '% a.a.' : '—' },
                { label:'TIR Nominal', val: e.tir_acionista.nominal != null ? f1(e.tir_acionista.nominal) + '% a.a.' : '—' },
                { label:'TIR Real (ex-IPCA 5%)', val: e.tir_acionista.real != null ? f1(e.tir_acionista.real) + '% a.a.' : '—' },
                { label:'vs. NTN-B 10Y real', val: e.tir_acionista.vs_ntnb != null ? fPct(e.tir_acionista.vs_ntnb) + 'pp' : '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'3px' }}>{item.label}</div>
                  <div style={{ fontSize:'15px',fontWeight:700,color:'#e8edf5' }}>{item.val}</div>
                </div>
              ))}
            </div>
            {e.tir_acionista.veredito && (
              <div style={{ marginTop:'12px',paddingTop:'12px',borderTop:'1px solid rgba(0,212,160,.15)',fontSize:'13px',fontWeight:700,color: e.tir_acionista.vs_ntnb > 0 ? '#00d4a0' : '#FFD54F' }}>
                Veredito: {e.tir_acionista.veredito}
              </div>
            )}
          </div>
        </>
      )}

      {/* Gordon */}
      {e.gordon && (
        <>
          <SecTitle>Gordon (DDM Simplificado)</SecTitle>
          <div style={{ display:'flex',gap:'16px',marginBottom:'20px',flexWrap:'wrap' }}>
            <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1 }}>
              <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>Preço Justo (Gordon)</div>
              <div style={{ fontSize:'24px',fontWeight:700,color: e.gordon.upside > 0 ? '#00d4a0' : '#ef4444' }}>
                {e.gordon.preco != null ? `R$ ${f2(e.gordon.preco)}` : '—'}
              </div>
              {e.gordon.upside != null && (
                <div style={{ fontSize:'13px',color:corUpside(e.gordon.upside),marginTop:'4px',fontWeight:600 }}>
                  {fPct(e.gordon.upside)}
                </div>
              )}
            </div>
            <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1,fontSize:'13px',color:'#b8c4d4' }}>
              <div>D0 = R$ {f2(e.gordon.d0)} · D1 = R$ {f2(e.gordon.d1)}</div>
              {e.gordon.detalhe && <div style={{ color:'#6b84a8',fontSize:'12px',marginTop:'4px' }}>{e.gordon.detalhe}</div>}
            </div>
          </div>
        </>
      )}

      {/* Graham */}
      {e.graham && (
        <>
          <SecTitle>Graham</SecTitle>
          <div style={{ display:'flex',gap:'16px',marginBottom:'20px',flexWrap:'wrap' }}>
            {e.graham.preco_gn && (
              <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1 }}>
                <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>Graham Number</div>
                <div style={{ fontSize:'24px',fontWeight:700,color:corUpside(e.graham.upside_gn) }}>R$ {f2(e.graham.preco_gn)}</div>
                {e.graham.upside_gn != null && <div style={{ fontSize:'13px',color:corUpside(e.graham.upside_gn),fontWeight:600 }}>{fPct(e.graham.upside_gn)}</div>}
              </div>
            )}
            {e.graham.preco_formula && (
              <div style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'16px 20px',flex:1 }}>
                <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>Fórmula Graham</div>
                <div style={{ fontSize:'24px',fontWeight:700,color:'#e8edf5' }}>R$ {f2(e.graham.preco_formula)}</div>
              </div>
            )}
            {e.graham.detalhe && (
              <div style={{ width:'100%',fontSize:'12px',color:'#6b84a8',padding:'10px 16px',background:'rgba(255,255,255,.03)',borderRadius:'8px' }}>
                {e.graham.detalhe}
              </div>
            )}
          </div>
          <div style={{ display:'flex',gap:'16px',fontSize:'13px',color:'#b8c4d4' }}>
            <span>EPS = R$ {f2(e.graham.eps)}</span>
            <span>VPA = R$ {f2(e.graham.vpa)}</span>
          </div>
        </>
      )}

      {!e.tir && !e.gordon && !e.graham && (
        <p style={{ color:'#6b84a8',padding:'20px 0' }}>Dados não disponíveis. Rode export_dcf.py com as análises calculadas no fundamento.py.</p>
      )}
    </>
  )
}

function SecLinhasNegocio({ e }: { e: any }) {
  const linhas: any[] = e.linhas_negocio ?? []
  if (!linhas.length) return (
    <p style={{ color:'#6b84a8',padding:'20px 0' }}>
      Dados por linha de negócio não disponíveis. Adicione ao dcf_historico/{e.ticker}.json e rode export_dcf.py.
    </p>
  )

  // pegar todos os anos disponíveis (union de todas as séries)
  const anosSet = new Set<string>()
  linhas.forEach(l => Object.keys(l.series || {}).forEach(a => anosSet.add(a)))
  const anos = Array.from(anosSet).sort()

  // calcular total por ano (para percentual)
  const totais: Record<string, number> = {}
  anos.forEach(ano => {
    totais[ano] = linhas.reduce((s, l) => s + (l.series?.[ano] ?? 0), 0)
  })

  return (
    <>
      <SecTitle>Receita por Linha de Negócio (R$ MM)</SecTitle>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'12.5px',minWidth:'500px' }}>
          <thead>
            <tr>
              <th style={{ padding:'8px 14px',textAlign:'left',fontSize:'10.5px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',color:'#6b84a8',borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                Linha de Negócio
              </th>
              {anos.map(a => (
                <th key={a} style={{ padding:'8px 14px',textAlign:'right',fontSize:'10.5px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',color:'#6b84a8',borderBottom:'2px solid rgba(255,255,255,.08)' }}>
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding:'10px 14px',color:'#b8c4d4',fontWeight:500 }}>{l.label}</td>
                {anos.map(ano => {
                  const val = l.series?.[ano]
                  const pct = val && totais[ano] ? (val / totais[ano]) * 100 : null
                  return (
                    <td key={ano} style={{ padding:'10px 14px',textAlign:'right' }}>
                      {val != null ? (
                        <div>
                          <div style={{ fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>{f2(val)}</div>
                          {pct != null && <div style={{ fontSize:'10.5px',color:'#6b84a8',marginTop:'1px' }}>{f1(pct)}%</div>}
                        </div>
                      ) : <span style={{ color:'#3d4f6a' }}>—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            {/* Linha de total */}
            <tr style={{ borderTop:'2px solid rgba(255,255,255,.08)',background:'rgba(232,160,32,.04)' }}>
              <td style={{ padding:'10px 14px',fontWeight:700,color:'#e8a020' }}>Total</td>
              {anos.map(ano => (
                <td key={ano} style={{ padding:'10px 14px',textAlign:'right',fontWeight:700,color:'#e8a020',fontFamily:'var(--font-space),monospace' }}>
                  {totais[ano] ? f2(totais[ano]) : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Barras de participação — último ano */}
      {anos.length > 0 && (
        <>
          <SecTitle>Participação no Último Ano ({anos[anos.length-1]})</SecTitle>
          <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
            {linhas
              .filter(l => l.series?.[anos[anos.length-1]])
              .sort((a, b) => (b.series?.[anos[anos.length-1]] ?? 0) - (a.series?.[anos[anos.length-1]] ?? 0))
              .map((l, i) => {
                const val = l.series?.[anos[anos.length-1]] ?? 0
                const pct = totais[anos[anos.length-1]] ? (val / totais[anos[anos.length-1]]) * 100 : 0
                const cores = ['#e8a020','#00d4a0','#3b82f6','#a855f7','#f59e0b','#ef4444','#10b981','#6366f1','#ec4899']
                const cor = cores[i % cores.length]
                return (
                  <div key={i}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'4px' }}>
                      <span style={{ fontSize:'13px',color:'#b8c4d4' }}>{l.label}</span>
                      <span style={{ fontSize:'13px',fontWeight:700,color:cor }}>
                        R$ {f2(val)} MM &nbsp; {f1(pct)}%
                      </span>
                    </div>
                    <div style={{ height:'8px',background:'rgba(255,255,255,.06)',borderRadius:'4px',overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${pct}%`,background:cor,borderRadius:'4px',transition:'width .6s ease' }}/>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </>
      )}
    </>
  )
}

/* ── KPIs Operacionais ────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecKPIs({ e, precoLive }: { e: any; precoLive: number|null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hist: any[] = e.historico || []
  const ult = hist.length > 0 ? hist[hist.length - 1] : null
  const kl = e.kpis_ltm ?? {}
  const prox = e.proximo_tri

  const kpis: { label: string; val: string }[] = []

  if (precoLive != null) kpis.push({ label: 'Cotação atual', val: `R$ ${f2(precoLive)}` })
  else if (e.preco_atual) kpis.push({ label: 'Cotação (base DCF)', val: `R$ ${f2(e.preco_atual)}` })

  // LTM: preferir kpis_ltm exportado, fallback para historico[-1]
  const recLtm = kl.receita ?? ult?.receita
  const ebitdaLtm = kl.ebitda ?? ult?.ebitda
  const mgLtm = kl.mg_ebitda ?? (ult?.mg_ebitda != null ? ult.mg_ebitda * (ult.mg_ebitda < 1 ? 100 : 1) : null)
  const fclLtm = kl.fcl ?? ult?.fcl
  const divLiq = kl.div_liq ?? ult?.div_liq

  const sufixoLtm = kl.periodo ? ` (${kl.periodo})` : ult?.ano ? ` (${ult.ano})` : ''

  if (recLtm != null)   kpis.push({ label: `Receita LTM${sufixoLtm}`, val: `R$ ${f2(recLtm)} MM` })
  if (ebitdaLtm != null) kpis.push({ label: `EBITDA ex LTM${sufixoLtm}`, val: `R$ ${f2(ebitdaLtm)} MM` })
  if (mgLtm != null)    kpis.push({ label: `Mg EBITDA LTM${sufixoLtm}`, val: `${f1(mgLtm)}%` })
  if (fclLtm != null)   kpis.push({ label: `FCL LTM${sufixoLtm}`, val: `R$ ${f2(fclLtm)} MM` })
  if (divLiq != null)   kpis.push({ label: 'Dívida Líquida', val: `R$ ${f2(divLiq)} MM` })

  // Alavancagem
  if (divLiq != null && ebitdaLtm != null && ebitdaLtm > 0) {
    kpis.push({ label: 'DL/EBITDA', val: `${f1(divLiq / ebitdaLtm)}x` })
  }

  // KPIs setoriais específicos exportados
  if (kl.sss != null)    kpis.push({ label: 'SSS',              val: `${f1(kl.sss)}%` })
  if (kl.npl != null)    kpis.push({ label: 'NPL >90d',         val: `${f1(kl.npl)}%` })
  if (kl.ic  != null)    kpis.push({ label: 'Índice Combinado', val: `${f1(kl.ic)}%` })
  if (kl.roe != null)    kpis.push({ label: 'ROE',              val: `${f1(kl.roe)}%` })
  if (kl.bhkp != null)   kpis.push({ label: 'BHKP (USD/t)',     val: `USD ${f2(kl.bhkp)}` })
  if (kl.brent != null)  kpis.push({ label: 'Brent (USD/bbl)',  val: `USD ${f1(kl.brent)}` })
  if (kl.n_lojas != null) kpis.push({ label: 'Lojas',           val: String(kl.n_lojas) })
  if (kl.area_m2 != null) kpis.push({ label: 'Área total (m²)', val: f2(kl.area_m2) })

  // Próximo tri estimado
  if (prox?.receita) kpis.push({ label: `Receita est. ${prox.periodo ?? 'próx. tri'}`, val: `R$ ${f2(prox.receita)} MM` })
  if (prox?.ebitda)  kpis.push({ label: `EBITDA est. ${prox.periodo ?? 'próx. tri'}`, val: `R$ ${f2(prox.ebitda)} MM` })

  if (!kpis.length) return (
    <p style={{ color:'#6b84a8',padding:'20px 0' }}>KPIs não disponíveis. Rode export_dcf.py.</p>
  )

  return (
    <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'10px' }}>
      {kpis.map(k => (
        <div key={k.label} style={{ background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'8px',padding:'12px 14px' }}>
          <div style={{ fontSize:'10.5px',color:'#6b84a8',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',marginBottom:'4px' }}>{k.label}</div>
          <div style={{ fontSize:'16px',fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>{k.val}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Saúde Financeira ─────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecSaude({ e }: { e: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hist: any[] = e.historico || []
  if (hist.length < 2) return (
    <p style={{ color:'#6b84a8',padding:'20px 0' }}>Histórico insuficiente para calcular saúde financeira. Rode export_dcf.py.</p>
  )

  const ult = hist[hist.length - 1]
  const ant = hist[hist.length - 2]
  const mg = (v: any) => v?.mg_ebitda != null ? v.mg_ebitda * (v.mg_ebitda < 1 ? 100 : 1) : null

  const mgAtual = mg(ult)
  const mgAnt   = mg(ant)
  const mgDelta  = mgAtual != null && mgAnt != null ? mgAtual - mgAnt : null

  const fclAtual = ult?.fcl
  const fclAnt   = ant?.fcl

  const divLiq  = ult?.div_liq
  const ebitdaU = ult?.ebitda
  const dlEbitda = divLiq != null && ebitdaU != null && ebitdaU > 0 ? divLiq / ebitdaU : null

  // CAGR receita 3 anos (se possível)
  const i3 = hist.length >= 4 ? hist[hist.length - 4] : hist[0]
  const r0 = i3?.receita; const rn = ult?.receita
  const anos3 = hist.length >= 4 ? 3 : hist.length - 1
  const cagr = r0 && rn && r0 > 0 && anos3 > 0 ? (Math.pow(rn / r0, 1 / anos3) - 1) * 100 : null

  // Upside base
  const upBase = e.base?.upside ?? e.upside_base_legado

  const cartoes = [
    {
      titulo: 'Lucratividade',
      cor: mgAtual != null && mgAtual >= 20 ? '#00d4a0' : mgAtual != null && mgAtual >= 10 ? '#FFD54F' : '#ef4444',
      valor: mgAtual != null ? `${f1(mgAtual)}%` : '—',
      sub: mgDelta != null ? `${mgDelta >= 0 ? '▲' : '▼'} ${f1(Math.abs(mgDelta))}pp (YoY)` : 'Mg EBITDA',
      desc: mgAtual != null && mgAtual >= 20 ? 'Margem sólida e estável' : mgAtual != null && mgAtual >= 10 ? 'Margem razoável' : 'Margem pressionada',
    },
    {
      titulo: 'Geração Cx',
      cor: fclAtual != null && fclAtual > 0 && fclAnt != null && fclAnt > 0 ? '#00d4a0' : fclAtual != null && fclAtual > 0 ? '#FFD54F' : '#ef4444',
      valor: fclAtual != null ? `${fclAtual > 0 ? '+' : ''}R$ ${f2(fclAtual)} MM` : '—',
      sub: fclAnt != null ? `Ant: R$ ${f2(fclAnt)} MM` : 'FCL',
      desc: fclAtual != null && fclAtual > 0 && fclAnt != null && fclAnt > 0 ? 'FCL positivo nos últimos anos' : fclAtual != null && fclAtual > 0 ? 'FCL positivo mas variável' : 'FCL negativo — consumindo caixa',
    },
    {
      titulo: 'Alavancagem',
      cor: dlEbitda == null ? '#6b84a8' : dlEbitda < 1.5 ? '#00d4a0' : dlEbitda < 3.0 ? '#FFD54F' : '#ef4444',
      valor: dlEbitda != null ? `${f1(dlEbitda)}x` : '—',
      sub: 'DL/EBITDA',
      desc: dlEbitda == null ? '—' : dlEbitda < 1.5 ? 'Alavancagem baixa' : dlEbitda < 3.0 ? 'Alavancagem moderada' : 'Alavancagem elevada',
    },
    {
      titulo: 'Crescimento',
      cor: cagr == null ? '#6b84a8' : cagr >= 8 ? '#00d4a0' : cagr >= 3 ? '#FFD54F' : '#ef4444',
      valor: cagr != null ? `+${f1(cagr)}%/ano` : '—',
      sub: `CAGR ${anos3} anos`,
      desc: cagr == null ? '—' : cagr >= 8 ? 'Crescimento forte' : cagr >= 3 ? 'Crescimento moderado' : 'Crescimento fraco',
    },
    {
      titulo: 'Valuation',
      cor: upBase == null ? '#6b84a8' : upBase >= 20 ? '#00d4a0' : upBase >= 0 ? '#FFD54F' : '#ef4444',
      valor: upBase != null ? fPct(upBase) : '—',
      sub: 'Upside base',
      desc: upBase == null ? 'Execute o DCF para ativar' : upBase >= 20 ? 'Desconto significativo' : upBase >= 0 ? 'Próximo do preço justo' : 'Acima do preço justo',
    },
  ]

  // Score simples: soma de pontos por cartão
  const pontos = cartoes.reduce((s, c) => s + (c.cor === '#00d4a0' ? 2 : c.cor === '#FFD54F' ? 1 : 0), 0)
  const scoreMax = 10
  const score = Math.min(pontos, scoreMax)
  const scoreLbl = score >= 8 ? 'FORTE' : score >= 5 ? 'MODERADA' : 'FRACA'
  const scoreCor = score >= 8 ? '#00d4a0' : score >= 5 ? '#FFD54F' : '#ef4444'

  return (
    <>
      <div style={{ display:'flex',alignItems:'center',gap:'16px',marginBottom:'16px' }}>
        <div style={{ fontSize:'15px',color:'#b8c4d4' }}>Score: <strong style={{ color:'#e8edf5' }}>{score}/{scoreMax}</strong></div>
        <span style={{ background:scoreCor,color:'#000',fontWeight:700,fontSize:'11px',padding:'4px 12px',borderRadius:'6px',letterSpacing:'.5px' }}>{scoreLbl}</span>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'10px' }}>
        {cartoes.map(c => (
          <div key={c.titulo} style={{ background:'rgba(255,255,255,.03)',border:`1px solid ${c.cor}33`,borderRadius:'10px',padding:'14px 14px' }}>
            <div style={{ display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px' }}>
              <div style={{ width:'8px',height:'8px',borderRadius:'50%',background:c.cor,flexShrink:0 }}/>
              <div style={{ fontSize:'10.5px',fontWeight:700,color:'#b8c4d4',letterSpacing:'.5px',textTransform:'uppercase' as const }}>{c.titulo}</div>
            </div>
            <div style={{ fontSize:'18px',fontWeight:700,color:c.cor,fontFamily:'var(--font-space),monospace',lineHeight:1.2 }}>{c.valor}</div>
            <div style={{ fontSize:'10px',color:'#6b84a8',marginTop:'3px' }}>{c.sub}</div>
            <div style={{ fontSize:'11px',color:'#6b84a8',marginTop:'6px',lineHeight:1.4 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecProximoTri({ e, plano, localEst, setLocalEst }: { e: any; plano: string | null; localEst: Record<string, any> | null; setLocalEst: (v: Record<string, any> | null) => void }) {
  const t = e.proximo_tri
  const kl = e.kpis_ltm ?? {}
  const isAnalista = plano === 'analista'

  // Usa localEst se existir (editado pelo analista), senão fallback p/ e.proximo_tri
  const est = localEst ?? t ?? {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compRows: { label: string; est: any; real: any }[] = []
  if (est.receita   != null) compRows.push({ label:'Receita (R$ MM)',       est: est.receita,   real: kl.receita   })
  if (est.ebitda    != null) compRows.push({ label:'EBITDA ex (R$ MM)',      est: est.ebitda,    real: kl.ebitda    })
  if (est.mg_ebitda != null) compRows.push({ label:'Mg EBITDA (%)',          est: est.mg_ebitda, real: kl.mg_ebitda != null ? (kl.mg_ebitda < 2 ? +(kl.mg_ebitda * 100).toFixed(1) : kl.mg_ebitda) : null })
  if (est.ll        != null) compRows.push({ label:'Lucro Líq. (R$ MM)',     est: est.ll,        real: kl.ll        })
  if (est.sss       != null) compRows.push({ label:'SSS (%)',                est: est.sss,       real: kl.sss       })
  if (est.npl       != null) compRows.push({ label:'NPL >90d (%)',           est: est.npl,       real: kl.npl       })
  if (est.bhkp      != null) compRows.push({ label:'BHKP (USD/t)',           est: est.bhkp,      real: kl.bhkp      })
  if (est.brent     != null) compRows.push({ label:'Brent (USD/bbl)',        est: est.brent,     real: kl.brent     })
  if (est.roe       != null) compRows.push({ label:'ROE (%)',                est: est.roe,       real: kl.roe       })
  if (est.div_liq   != null) compRows.push({ label:'Dív. Líquida (R$ MM)',   est: est.div_liq,   real: kl.div_liq   })

  const delta = (e2: number | null, r: number | null) => {
    if (e2 == null || r == null || e2 === 0) return null
    return ((r - e2) / Math.abs(e2)) * 100
  }

  const updEst = (campo: string, val: string) => {
    const n = parseFloat(val.replace(',', '.'))
    setLocalEst({ ...(localEst ?? {}), [campo]: isNaN(n) ? null : n })
  }

  const inputSty: React.CSSProperties = { background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'6px',color:'#e8edf5',fontFamily:'var(--font-space),monospace',fontSize:'13px',fontWeight:600,padding:'6px 10px',width:'100%',outline:'none' }

  if (!t && !isAnalista) return <p style={{ color:'#6b84a8',padding:'20px 0' }}>Estimativa não disponível. Execute /buscar-resultado-ri para gerar.</p>

  return (
    <>
      {/* ── Estimativas do modelo ─────────────────────────────────────── */}
      <SecTitle>
        {est.periodo ?? t?.periodo ?? 'Próximo Trimestre'}
        {localEst && <span style={{ marginLeft:'10px',fontSize:'11px',background:'rgba(232,160,32,.15)',color:'#e8a020',borderRadius:'4px',padding:'2px 7px',fontWeight:700 }}>✎ Editado</span>}
      </SecTitle>

      {t?.metodologia && (
        <p style={{ fontSize:'12px',color:'#6b84a8',marginBottom:'16px',background:'rgba(255,255,255,.03)',padding:'10px 14px',borderRadius:'8px',lineHeight:1.6 }}>
          <span style={{ color:'#e8a020',fontWeight:700 }}>Método: </span>{t.metodologia}
        </p>
      )}

      {/* Cards resumo */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'12px',marginBottom:'24px' }}>
        {[
          { label:'Receita Est.',   val: est.receita   != null ? `R$ ${f2(est.receita)} MM`  : '—', cor:'#e8edf5' },
          { label:'EBITDA Est.',    val: est.ebitda    != null ? `R$ ${f2(est.ebitda)} MM`   : '—', cor:'#e8edf5' },
          { label:'Mg EBITDA Est.', val: est.mg_ebitda != null ? `${f1(est.mg_ebitda)}%`     : '—', cor:'#00d4a0' },
          { label:'Lucro Líq.',     val: est.ll        != null ? `R$ ${f2(est.ll)} MM`       : '—', cor:'#e8edf5' },
        ].map(item => (
          <div key={item.label} style={{ background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'10px',padding:'14px 16px' }}>
            <div style={{ fontSize:'11px',color:'#6b84a8',marginBottom:'4px' }}>{item.label}</div>
            <div style={{ fontSize:'17px',fontWeight:700,color:item.cor,fontFamily:'var(--font-space),monospace' }}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Tabela Estimado vs Realizado */}
      {compRows.length > 0 && kl.periodo && (
        <>
          <SecTitle>Estimado vs Realizado — {kl.periodo}</SecTitle>
          <div style={{ overflowX:'auto',marginBottom:'20px' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'12.5px',minWidth:'400px' }}>
              <thead>
                <tr>
                  {['Indicador','Estimado','Realizado','Δ vs Est.','Status'].map(c => (
                    <th key={c} style={{ padding:'8px 12px',textAlign: c === 'Indicador' ? 'left' : 'right',fontSize:'10px',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,color:'#6b84a8',borderBottom:'2px solid rgba(255,255,255,.08)',whiteSpace:'nowrap' as const }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compRows.map((row, i) => {
                  const d = typeof row.est === 'number' && typeof row.real === 'number' ? delta(row.est, row.real) : null
                  const status = d == null ? '' : d >= 3 ? '✅ Acima' : d >= -3 ? '≈ Em linha' : '⚠ Abaixo'
                  const dCor   = d == null ? '#6b84a8' : d >= 3 ? '#00d4a0' : d >= -3 ? '#FFD54F' : '#ef4444'
                  return (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding:'9px 12px',color:'#b8c4d4' }}>{row.label}</td>
                      <td style={{ padding:'9px 12px',textAlign:'right',color:'#6b84a8',fontFamily:'var(--font-space),monospace',fontWeight:600 }}>
                        {row.est != null ? f2(Number(row.est)) : '—'}
                      </td>
                      <td style={{ padding:'9px 12px',textAlign:'right',color:'#e8edf5',fontFamily:'var(--font-space),monospace',fontWeight:700 }}>
                        {row.real != null ? f2(Number(row.real)) : '—'}
                      </td>
                      <td style={{ padding:'9px 12px',textAlign:'right',color:dCor,fontWeight:700 }}>
                        {d != null ? `${d >= 0 ? '+' : ''}${f1(d)}%` : '—'}
                      </td>
                      <td style={{ padding:'9px 12px',textAlign:'right',color:dCor,fontSize:'11px',fontWeight:700 }}>
                        {status || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* KPIs setoriais (modelo) */}
      {(t?.n_lojas != null || t?.area_m2 != null || t?.adtv != null || t?.prod_mboed != null) && (
        <>
          <SecTitle>KPIs Setoriais Estimados</SecTitle>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'8px',marginBottom:'16px' }}>
            {[
              t.n_lojas    != null && { label:'Lojas (est.)',          val: String(t.n_lojas) },
              t.area_m2    != null && { label:'Área m² (est.)',        val: f2(t.area_m2) },
              t.adtv       != null && { label:'ADTV est. (R$bi/dia)',  val: f1(t.adtv) },
              t.prod_mboed != null && { label:'Produção (Mboed)',       val: f2(t.prod_mboed) },
            ].filter(Boolean).map((k: any) => (
              <div key={k.label} style={{ background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',borderRadius:'8px',padding:'10px 12px' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',marginBottom:'3px',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px' }}>{k.label}</div>
                <div style={{ fontSize:'14px',fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>{k.val}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Formulário de estimativa (apenas Analista) ─────────────────── */}
      {isAnalista && (
        <>
          <div style={{ borderTop:'1px solid rgba(255,255,255,.08)',marginTop:'24px',paddingTop:'20px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px' }}>
              <div>
                <div style={{ fontSize:'12px',fontWeight:700,color:'#e8a020',letterSpacing:'1px',textTransform:'uppercase' as const }}>Estimar Próximo Trimestre</div>
                <div style={{ fontSize:'11px',color:'#3d4f6a',marginTop:'2px' }}>Local · somente no browser · não altera o modelo</div>
              </div>
              {localEst && (
                <button onClick={() => setLocalEst(null)} style={{ background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.10)',borderRadius:'6px',color:'#6b84a8',fontSize:'11px',fontWeight:700,padding:'5px 10px',cursor:'pointer' }}>
                  Resetar
                </button>
              )}
            </div>

            {/* Campos DRE */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px' }}>
              {[
                { campo:'receita',   label:'Receita (R$ MM)'   },
                { campo:'ebitda',    label:'EBITDA (R$ MM)'    },
                { campo:'mg_ebitda', label:'Mg EBITDA (%)'     },
                { campo:'ll',        label:'Lucro Líq. (R$ MM)'},
                { campo:'div_liq',   label:'Dív. Líq. (R$ MM)' },
                { campo:'roe',       label:'ROE (%)'           },
              ].map(({ campo, label }) => (
                <div key={campo}>
                  <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'4px' }}>{label}</div>
                  <input
                    type="number" step="0.1"
                    value={est[campo] ?? ''}
                    onChange={ev => updEst(campo, ev.target.value)}
                    placeholder="—"
                    style={inputSty}
                  />
                </div>
              ))}
            </div>

            {/* KPIs setoriais */}
            {(t?.sss != null || t?.npl != null || t?.bhkp != null || t?.brent != null || t?.n_lojas != null) && (
              <>
                <div style={{ fontSize:'10px',fontWeight:700,color:'#6b84a8',letterSpacing:'1px',textTransform:'uppercase' as const,marginBottom:'10px' }}>KPIs Setoriais</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px' }}>
                  {[
                    t?.sss     != null && { campo:'sss',     label:'SSS (%)'         },
                    t?.npl     != null && { campo:'npl',     label:'NPL >90d (%)'    },
                    t?.bhkp    != null && { campo:'bhkp',    label:'BHKP (USD/t)'    },
                    t?.brent   != null && { campo:'brent',   label:'Brent (USD/bbl)' },
                    t?.n_lojas != null && { campo:'n_lojas', label:'Lojas'           },
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.campo}>
                      <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'4px' }}>{item.label}</div>
                      <input
                        type="number" step="0.1"
                        value={est[item.campo] ?? ''}
                        onChange={ev => updEst(item.campo, ev.target.value)}
                        placeholder="—"
                        style={inputSty}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <p style={{ fontSize:'11px',color:'#3d4f6a',lineHeight:1.5,marginTop:'4px' }}>
              Os campos acima atualizam a tabela "Estimado vs Realizado" em tempo real.
              Para tornar permanente, insira os dados em <code>dcf.py</code> e rode <code>export_dcf.py</code>.
            </p>
          </div>
        </>
      )}
    </>
  )
}

/* ── Modal WACC — Ke / Kd / Pesos ───────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ModalWACC({ emp, taxRate, onAplicar, onClose }: {
  emp: any; taxRate: number; onAplicar: (wacc: number) => void; onClose: () => void
}) {
  const [rf,      setRf]      = useState<number>(emp.wacc_rf       ?? 13.6)
  const [beta,    setBeta]    = useState<number>(emp.wacc_beta      ?? 1.0)
  const [erp,     setErp]     = useState<number>(emp.wacc_erp       ?? 5.0)
  const [kdBruto, setKdBruto] = useState<number>(emp.wacc_kd_bruto  ?? emp.wacc_ke ?? 14.0)
  const [pesoE,   setPesoE]   = useState<number>((emp.wacc_peso_e ?? 1.0) * 100)

  const ke     = rf + beta * erp
  const kdAt   = kdBruto * (1 - taxRate / 100)
  const waccCalc = ke * (pesoE / 100) + kdAt * (1 - pesoE / 100)

  const numStyle: React.CSSProperties = {
    background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.15)',
    borderRadius:'6px', color:'#e8edf5', fontFamily:'var(--font-space),monospace',
    fontSize:'13px', fontWeight:600, padding:'6px 8px', width:'90px', outline:'none',
    textAlign:'right',
  }
  const labelStyle: React.CSSProperties = {
    fontSize:'11px', color:'#6b84a8', display:'flex', alignItems:'center',
    justifyContent:'space-between', gap:'8px', padding:'6px 0',
    borderBottom:'1px solid rgba(255,255,255,.04)',
  }
  const calcStyle: React.CSSProperties = {
    fontSize:'13px', fontWeight:700, color:'#e8a020', fontFamily:'var(--font-space),monospace',
    background:'rgba(232,160,32,.08)', border:'1px solid rgba(232,160,32,.2)',
    borderRadius:'6px', padding:'6px 10px', minWidth:'70px', textAlign:'right',
  }
  const sectionStyle: React.CSSProperties = {
    fontSize:'10px', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase',
    color:'#e8a020', padding:'10px 0 6px', marginTop:'4px',
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#0a1628',border:'1px solid rgba(255,255,255,.12)',borderRadius:'14px',width:'100%',maxWidth:'480px',maxHeight:'90vh',overflow:'auto' }}>
        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize:'14px',fontWeight:700,color:'#e8edf5' }}>WACC — Ke / Kd / Pesos</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'#6b84a8',fontSize:'20px',cursor:'pointer' }}>×</button>
        </div>

        <div style={{ padding:'16px 24px' }}>
          {/* SEÇÃO Ke */}
          <div style={sectionStyle}>Custo do Capital Próprio &nbsp;·&nbsp; Ke = Rf + Beta × ERP</div>
          <div style={labelStyle}>
            <span>Rf — taxa livre de risco (%) <span style={{ color:'#3d4f6a',fontSize:'10px' }}>NTN-B longa</span></span>
            <input type="number" step={0.1} value={rf} onChange={e => setRf(parseFloat(e.target.value)||0)} style={numStyle}/>
          </div>
          <div style={labelStyle}>
            <span>Beta <span style={{ color:'#3d4f6a',fontSize:'10px' }}>[36M vs IBOV]</span></span>
            <input type="number" step={0.01} value={beta} onChange={e => setBeta(parseFloat(e.target.value)||0)} style={numStyle}/>
          </div>
          <div style={labelStyle}>
            <span>ERP Brasil (%)</span>
            <input type="number" step={0.1} value={erp} onChange={e => setErp(parseFloat(e.target.value)||0)} style={numStyle}/>
          </div>
          <div style={{ ...labelStyle, borderBottom:'none', marginTop:'4px' }}>
            <span style={{ color:'#e8edf5',fontWeight:600 }}>Ke (%) [calculado]</span>
            <span style={calcStyle}>{f2(ke)}%</span>
          </div>

          {/* SEÇÃO Kd */}
          <div style={{ ...sectionStyle, borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:'12px', marginTop:'8px' }}>
            Custo da Dívida &nbsp;·&nbsp; Kd = Kd × (1 − tax shield)
          </div>
          <div style={labelStyle}>
            <span>Kd bruto (%)</span>
            <input type="number" step={0.1} value={kdBruto} onChange={e => setKdBruto(parseFloat(e.target.value)||0)} style={numStyle}/>
          </div>
          <div style={labelStyle}>
            <span>Tax shield IR/CSLL (%) <span style={{ color:'#3d4f6a',fontSize:'10px' }}>← {f1(taxRate)}% efetiva</span></span>
            <span style={{ ...numStyle, display:'inline-block', color:'#6b84a8' }}>{f1(taxRate)}</span>
          </div>
          <div style={{ ...labelStyle, borderBottom:'none', marginTop:'4px' }}>
            <span style={{ color:'#e8edf5',fontWeight:600 }}>Kd líquido (%) [calculado]</span>
            <span style={calcStyle}>{f2(kdAt)}%</span>
          </div>

          {/* SEÇÃO Pesos */}
          <div style={{ ...sectionStyle, borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:'12px', marginTop:'8px' }}>
            Pesos Estrutura de Capital
          </div>
          <div style={labelStyle}>
            <span>E% (equity / capital total) [auto]</span>
            <input type="number" step={1} min={0} max={100} value={pesoE} onChange={e => setPesoE(parseFloat(e.target.value)||0)} style={numStyle}/>
          </div>

          {/* RESULTADO */}
          <div style={{ marginTop:'16px',padding:'14px 16px',background:'rgba(232,160,32,.07)',border:'1px solid rgba(232,160,32,.25)',borderRadius:'10px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'10px',color:'#6b84a8',letterSpacing:'.5px',textTransform:'uppercase' }}>WACC calculado</div>
              <div style={{ fontSize:'11px',color:'#6b84a8',marginTop:'2px' }}>
                {f1(ke)}% × {f1(pesoE)}% E + {f2(kdAt)}% × {f1(100-pesoE)}% D
              </div>
            </div>
            <div style={{ fontSize:'26px',fontWeight:700,color:'#e8a020',fontFamily:'var(--font-space),monospace' }}>
              {f2(waccCalc)}%
            </div>
          </div>
        </div>

        <div style={{ display:'flex',gap:'10px',padding:'14px 24px',borderTop:'1px solid rgba(255,255,255,.07)' }}>
          <button onClick={onClose} style={{ flex:1,background:'transparent',border:'1px solid rgba(255,255,255,.12)',color:'#6b84a8',fontWeight:600,fontSize:'13px',padding:'10px',borderRadius:'7px',cursor:'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => { onAplicar(Math.round(waccCalc * 100) / 100); onClose() }}
            style={{ flex:2,background:'#e8a020',color:'#000',fontWeight:700,fontSize:'13px',padding:'10px',borderRadius:'7px',border:'none',cursor:'pointer' }}>
            Aplicar WACC ao modelo ({f2(waccCalc)}%)
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Editor de Premissas (plano analista) ────────────────────────────────── */
function InputPrem({ label, value, onChange, step = 0.1 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '10px', color: '#6b84a8', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="number" step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: '6px', color: '#e8edf5', fontFamily: 'var(--font-space),monospace', fontSize: '13px', fontWeight: 600, padding: '6px 8px', width: '100%', outline: 'none' }}
        />
        <span style={{ fontSize: '12px', color: '#6b84a8', flexShrink: 0 }}>%</span>
      </div>
    </div>
  )
}

function AnosGrid({ label, values, onChange }: {
  label: string; values: number[]; onChange: (i: number, v: number) => void
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '10px', color: '#6b84a8', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const, marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
        {values.map((v, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#3d4f6a', marginBottom: '2px' }}>A{i + 1}</div>
            <input
              type="number" step={0.1} value={v}
              onChange={e => onChange(i, parseFloat(e.target.value) || 0)}
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)', borderRadius: '5px', color: '#e8edf5', fontFamily: 'var(--font-space),monospace', fontSize: '11px', fontWeight: 600, padding: '4px 3px', width: '100%', textAlign: 'center', outline: 'none' }}
            />
          </div>
        ))}
        {/* coluna 8 = terminal */}
        <div style={{ textAlign: 'center', gridColumn: '4 / span 1' }} />
      </div>
    </div>
  )
}

function PremissasEditor({ emp, premissas, setPremissas, resultado, onReset, onCalcularAgora, ajustes, setAjustes, nextTriInputs, setNextTriInputs, onEstimarProxTri }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emp: any
  premissas: PremissasDCF
  setPremissas: (fn: (p: PremissasDCF) => PremissasDCF) => void
  resultado: ResultadoDCF | null
  onReset: () => void
  onCalcularAgora: () => void
  ajustes: AjustesAnalista
  setAjustes: (aj: AjustesAnalista) => void
  nextTriInputs: Record<string, number>
  setNextTriInputs: (v: Record<string, number>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEstimarProxTri: (resultado: Record<string, any>) => void
}) {
  const upd = <K extends keyof PremissasDCF>(key: K, val: PremissasDCF[K]) =>
    setPremissas(p => ({ ...p, [key]: val }))

  const updArr = (key: 'g_receita' | 'mg_ebitda' | 'capex_pct' | 'dcg_pct', i: number, val: number) =>
    setPremissas(p => {
      const arr = [...p[key]]; arr[i] = val; return { ...p, [key]: arr }
    })

  const f1r = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const f2r = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fPr = (v: number | null | undefined) => v == null ? '—' : `${v > 0 ? '+' : ''}${f1r(v)}%`
  const corU = (v: number | null | undefined) => v == null ? '#6b84a8' : v >= 20 ? '#00d4a0' : v >= 0 ? '#FFD54F' : '#ef4444'

  const [avancado, setAvancado] = useState(false)
  const [waccModal, setWaccModal] = useState(false)
  const [calculandoLocal, setCalculandoLocal] = useState(false)
  const [ajAberto, setAjAberto] = useState(false)
  const [proxTriAberto, setProxTriAberto] = useState(false)
  const hasRecBase = emp?.rec_base != null
  const setor = detectarSetor(emp)
  const setorCfg = SETORES_CONFIG[setor]

  /* ── Motores de Receita — Commodities ─────────────────── */
  const COMMODITY_SETORES = ['celulose', 'petroleo', 'agro'] as const
  const isCommodity = (COMMODITY_SETORES as readonly string[]).includes(setor)

  const defaultCommodity = setor === 'celulose' ? 650 : setor === 'petroleo' ? 75 : 110
  const commodityLabel   = setor === 'celulose' ? 'BHKP (USD/t)' : setor === 'petroleo' ? 'Brent (USD/bbl)' : 'Preço Soja (R$/sc)'

  const [commodityAberto, setCommodityAberto] = useState(false)
  const [fxLoading, setFxLoading]             = useState(false)
  const [fxFetched, setFxFetched]             = useState(false)
  const [fxAnos, setFxAnos]                   = useState<number[]>(() => Array(7).fill(5.30))
  const [commodityAnos, setCommodityAnos]     = useState<number[]>(() => Array(7).fill(defaultCommodity))

  // Reseta preços da commodity quando troca de empresa/setor
  const empKey = emp?.ticker ?? emp?.nome ?? ''
  useEffect(() => {
    const defCom = setor === 'celulose' ? 650 : setor === 'petroleo' ? 75 : 110
    setCommodityAnos(Array(7).fill(defCom))
    setCommodityAberto(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empKey])

  // Busca FOCUS (BRL/USD) uma vez por sessão para setores de commodities
  useEffect(() => {
    if (!isCommodity || fxFetched) return
    setFxFetched(true)
    setFxLoading(true)
    fetch('/api/focus')
      .then(r => r.json())
      .then(d => {
        if (d.anos && Object.keys(d.anos).length > 0) {
          const base = new Date().getFullYear()
          const vals = Object.keys(d.anos).map(Number)
          const lastVal = d.anos[Math.max(...vals)]
          const fx7 = Array(7).fill(null).map((_, i) => {
            const yr = base + i + 1
            return (d.anos[yr] ?? lastVal ?? 5.30) as number
          })
          setFxAnos(fx7)
        }
      })
      .catch(() => {})
      .finally(() => setFxLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommodity])

  // Calcula g_receita implícito a partir dos preços de commodity × FX e atualiza premissas
  const usarCommodityNoDCF = () => {
    if (!emp?.rec_base || emp.rec_base <= 0) return
    const kl = emp.kpis_ltm ?? {}
    const newG = Array(7).fill(0)

    if (setor === 'celulose') {
      const bhkpRef = kl.bhkp ?? commodityAnos[0] ?? 700
      const fxRef   = kl.fx   ?? fxAnos[0]    ?? 5.15
      // Volume implícito constante calibrado pelo LTM
      const volImp  = bhkpRef > 0 && fxRef > 0 ? (emp.rec_base * 1000) / (bhkpRef * fxRef) : 3000
      let recPrev = emp.rec_base
      for (let i = 0; i < 7; i++) {
        const rec_i = (commodityAnos[i] * volImp * fxAnos[i]) / 1000
        newG[i] = Math.round(((rec_i / recPrev) - 1) * 1000) / 10
        recPrev = rec_i
      }
    } else if (setor === 'petroleo') {
      const brentRef = kl.brent ?? commodityAnos[0] ?? 75
      const fxRef    = kl.fx    ?? fxAnos[0]        ?? 5.15
      // Crescimento = variação de Brent × FX (produção constante implícita)
      let bPrev = brentRef, fPrev = fxRef
      for (let i = 0; i < 7; i++) {
        const ratio = bPrev > 0 && fPrev > 0 ? (commodityAnos[i] * fxAnos[i]) / (bPrev * fPrev) : 1
        newG[i] = Math.round((ratio - 1) * 1000) / 10
        bPrev = commodityAnos[i]; fPrev = fxAnos[i]
      }
    } else if (setor === 'agro') {
      // Preço soja em R$/sc — FX incluso se exportadora
      const bagRef = kl.bag_price ?? commodityAnos[0] ?? 110
      const fxRef  = kl.fx        ?? fxAnos[0]        ?? 5.15
      let bagPrev = bagRef, fPrev = fxRef
      for (let i = 0; i < 7; i++) {
        const ratio = bagPrev > 0 && fPrev > 0 ? (commodityAnos[i] * fxAnos[i]) / (bagPrev * fPrev) : 1
        newG[i] = Math.round((ratio - 1) * 1000) / 10
        bagPrev = commodityAnos[i]; fPrev = fxAnos[i]
      }
    }

    setPremissas(p => ({ ...p, g_receita: newG }))
  }

  const calcularAgora = () => {
    if (calculandoLocal) return
    setCalculandoLocal(true)
    onCalcularAgora()
    setTimeout(() => setCalculandoLocal(false), 700)
  }

  const updAj = (key: keyof AjustesAnalista, val: string | number) =>
    setAjustes({ ...ajustes, [key]: typeof val === 'string' && key !== 'observacoes' ? (parseFloat(val) || 0) : val })

  const updNTI = (key: string, val: string) => {
    const n = parseFloat(val.replace(',', '.'))
    setNextTriInputs({ ...nextTriInputs, [key]: isNaN(n) ? 0 : n })
  }

  const temAjuste = ajustes.nao_recorrente_liq !== 0 || ajustes.wacc_ajuste !== 0 || ajustes.desconto_adicional !== 0 || ajustes.observacoes !== ''

  // Preço ajustado pelo desconto adicional
  const precoAjust = (v: number) => ajustes.desconto_adicional ? v * (1 - ajustes.desconto_adicional / 100) : v
  const sInp: React.CSSProperties = { background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',borderRadius:'6px',color:'#e8edf5',fontFamily:'var(--font-space),monospace',fontSize:'13px',fontWeight:600,padding:'6px 8px',width:'100%',outline:'none' }

  return (
    <div style={{ width: '256px', flexShrink: 0, background: '#081120', borderLeft: '1px solid rgba(255,255,255,.07)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Cabeçalho */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const, color: '#e8a020' }}>Premissas</div>
          <div style={{ fontSize: '10px', color: '#3d4f6a', marginTop: '2px' }}>Analista — edite e recalcule</div>
        </div>
        <button onClick={onReset} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)', borderRadius: '5px', color: '#6b84a8', fontSize: '10px', fontWeight: 700, padding: '4px 8px', cursor: 'pointer' }}>Resetar</button>
      </div>

      <div style={{ padding: '14px 16px', flex: 1 }}>
        {/* Resultado calculado */}
        {hasRecBase && resultado ? (
          <div style={{ marginBottom: '12px', background: 'rgba(232,160,32,.05)', border: '1px solid rgba(232,160,32,.18)', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#e8a020', letterSpacing: '.5px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Resultado calculado</div>
            {[
              { label: '🔴 Bear', val: resultado.bear.preco, up: resultado.bear.upside },
              { label: '🟡 Base', val: resultado.base.preco, up: resultado.base.upside },
              { label: '🟢 Bull', val: resultado.bull.preco, up: resultado.bull.upside },
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span style={{ fontSize: '10.5px', color: '#6b84a8' }}>{c.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-space),monospace' }}>
                    {c.val > 0 ? `R$ ${f2r(c.val)}` : '—'}
                  </span>
                  {c.up != null && (
                    <span style={{ fontSize: '10px', marginLeft: '6px', color: corU(c.up), fontWeight: 600 }}>{fPr(c.up)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : !hasRecBase ? (
          <div style={{ marginBottom: '12px', fontSize: '11px', color: '#3d4f6a', background: 'rgba(255,255,255,.03)', borderRadius: '6px', padding: '8px 10px', lineHeight: 1.5 }}>
            rec_base não disponível. Rode export_dcf.py para habilitar o recálculo.
          </div>
        ) : (
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b84a8' }}>
            <div style={{ width: '12px', height: '12px', border: '2px solid rgba(232,160,32,.3)', borderTopColor: '#e8a020', borderRadius: '50%', animation: 'spin .75s linear infinite', flexShrink: 0 }} />
            Calculando...
          </div>
        )}

        {/* Botão Calcular DCF */}
        {hasRecBase && (
          <button
            onClick={calcularAgora}
            disabled={calculandoLocal}
            style={{ width:'100%', background: calculandoLocal ? 'linear-gradient(135deg,#0a5c2a,#0e8040)' : 'linear-gradient(135deg,#1a4a8a,#1e6aa0)', border:`1px solid ${calculandoLocal ? 'rgba(14,128,64,.5)' : 'rgba(30,106,160,.5)'}`, borderRadius:'7px', color: calculandoLocal ? '#4ade80' : '#90CAF9', fontWeight:700, fontSize:'12px', padding:'9px', cursor: calculandoLocal ? 'default' : 'pointer', marginBottom:'12px', letterSpacing:'.5px', transition:'all .2s' }}
          >
            {calculandoLocal ? '✔ Calculado!' : '▶ Calcular DCF'}
          </button>
        )}

        {/* Parâmetros gerais */}
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#e8a020', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Parâmetros Gerais</div>

        {/* WACC com botão de abertura do modal */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', color: '#6b84a8', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' as const, marginBottom: '4px' }}>WACC</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <input
                type="number" step={0.1} value={premissas.wacc}
                onChange={e => upd('wacc', parseFloat(e.target.value) || 0)}
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: '6px', color: '#e8edf5', fontFamily: 'var(--font-space),monospace', fontSize: '13px', fontWeight: 600, padding: '6px 8px', width: '100%', outline: 'none' }}
              />
              <span style={{ fontSize: '12px', color: '#6b84a8', flexShrink: 0 }}>%</span>
            </div>
            <button
              onClick={() => setWaccModal(true)}
              title="WACC — Ke/Kd/Pesos (editar componentes)"
              style={{ background: 'rgba(30,106,160,.15)', border: '1px solid rgba(30,106,160,.3)', borderRadius: '6px', color: '#90CAF9', fontSize: '10px', fontWeight: 700, padding: '0 7px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const }}
            >
              Ke/Kd
            </button>
          </div>
          {(emp.wacc_ke != null || emp.wacc_rf != null) && (
            <div style={{ fontSize: '9.5px', color: '#3d4f6a', marginTop: '3px', lineHeight: 1.4 }}>
              {emp.wacc_rf != null && `Rf=${f1(emp.wacc_rf)}% · `}
              {emp.wacc_beta != null && `β=${f2(emp.wacc_beta)} · `}
              {emp.wacc_ke != null && `Ke=${f1(emp.wacc_ke)}%`}
              {emp.wacc_peso_e != null && ` · E=${f1((emp.wacc_peso_e) * 100)}%`}
            </div>
          )}
        </div>

        <InputPrem label="g Terminal"          value={premissas.g_terminal}         onChange={v => upd('g_terminal', v)} />
        <InputPrem label="IR/CSLL efetivo"     value={premissas.tax_rate}           onChange={v => upd('tax_rate', v)} />
        <InputPrem label="IR/CSLL perpetuidade" value={premissas.tax_rate_terminal} onChange={v => upd('tax_rate_terminal', v)} />
        <InputPrem label="D&A / Receita"       value={premissas.da_pct}             onChange={v => upd('da_pct', v)} />

        {/* Crescimento de Receita */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: '12px', marginTop: '4px' }}>
          <AnosGrid label="Crescimento de Receita (%)" values={premissas.g_receita} onChange={(i, v) => updArr('g_receita', i, v)} />
        </div>

        {/* Margem EBITDA */}
        <AnosGrid label="Margem EBITDA (%)" values={premissas.mg_ebitda} onChange={(i, v) => updArr('mg_ebitda', i, v)} />

        {/* Avançado: CapEx e NCG */}
        <button
          onClick={() => setAvancado(a => !a)}
          style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: '5px', color: '#6b84a8', fontSize: '10.5px', fontWeight: 600, padding: '5px', cursor: 'pointer', marginBottom: '8px' }}
        >
          {avancado ? '▲ Ocultar' : '▼ CapEx / NCG'}
        </button>
        {avancado && (
          <>
            <AnosGrid label="CapEx / Receita (%)" values={premissas.capex_pct} onChange={(i, v) => updArr('capex_pct', i, v)} />
            <AnosGrid label="ΔNCG / ΔReceita (%)" values={premissas.dcg_pct}   onChange={(i, v) => updArr('dcg_pct', i, v)} />
          </>
        )}
      </div>

      {/* ── Ajustes do Analista ────────────────────────────── */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,.06)',marginTop:'4px' }}>
        <button
          onClick={() => setAjAberto(a => !a)}
          style={{ width:'100%',background:'transparent',border:'none',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',color: temAjuste ? '#e8a020' : '#6b84a8',fontSize:'10.5px',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const }}
        >
          <span>{ajAberto ? '▲' : '▼'} Ajustes do Analista</span>
          {temAjuste && <span style={{ fontSize:'9px',background:'rgba(232,160,32,.2)',color:'#e8a020',borderRadius:'4px',padding:'1px 5px' }}>ATIVO</span>}
        </button>
        {ajAberto && (
          <div style={{ padding:'0 16px 14px' }}>
            <p style={{ fontSize:'10px',color:'#3d4f6a',marginBottom:'10px',lineHeight:1.5 }}>
              Normalização pós-análise de fatos
            </p>
            {[
              { key:'nao_recorrente_liq', label:'Não Recorrente Líq. (R$ MM)', hint:'+ = receita extra  /  − = custo extra' },
              { key:'wacc_ajuste',        label:'Ajuste WACC (pp)',             hint:'+ = mais conservador  /  − = prêmio' },
              { key:'desconto_adicional', label:'Desconto / Prêmio (%)',        hint:'+ = desconto no preço  /  − = prêmio' },
            ].map(({ key, label, hint }) => (
              <div key={key} style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'9.5px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'3px' }}>{label}</div>
                <input
                  type="number" step="0.1"
                  value={(ajustes as any)[key] ?? 0}
                  onChange={e => updAj(key as keyof AjustesAnalista, e.target.value)}
                  style={sInp}
                />
                <div style={{ fontSize:'9px',color:'#3d4f6a',marginTop:'2px' }}>{hint}</div>
              </div>
            ))}
            <div style={{ marginBottom:'8px' }}>
              <div style={{ fontSize:'9.5px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'3px' }}>Observações</div>
              <textarea
                value={ajustes.observacoes}
                onChange={e => updAj('observacoes', e.target.value)}
                rows={3}
                style={{ ...sInp, fontFamily:'inherit',fontSize:'11px',resize:'vertical' as const,lineHeight:1.5 }}
              />
            </div>
            {/* Preços com desconto — mostrar quando há ajuste */}
            {(ajustes.desconto_adicional !== 0 || ajustes.wacc_ajuste !== 0 || ajustes.nao_recorrente_liq !== 0) && resultado && (
              <div style={{ background:'rgba(232,160,32,.05)',border:'1px solid rgba(232,160,32,.15)',borderRadius:'7px',padding:'8px 10px',marginBottom:'8px' }}>
                <div style={{ fontSize:'9px',color:'#e8a020',fontWeight:700,marginBottom:'6px',textTransform:'uppercase' as const,letterSpacing:'.5px' }}>Preço ajustado (com desconto/prêmio)</div>
                {(['bear','base','bull'] as const).map(c => {
                  const preco = resultado[c].preco
                  const adj = precoAjust(preco)
                  return (
                    <div key={c} style={{ display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:'11px' }}>
                      <span style={{ color:'#6b84a8',textTransform:'capitalize' as const }}>{c}</span>
                      <span style={{ color:'#e8edf5',fontFamily:'var(--font-space),monospace',fontWeight:700 }}>
                        R$ {adj.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
                        {ajustes.desconto_adicional !== 0 && <span style={{ fontSize:'9px',color:'#6b84a8',marginLeft:'4px' }}>({preco.toLocaleString('pt-BR',{minimumFractionDigits:2})} s/adj.)</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Premissas Próximo Trimestre ─────────────────────── */}
      {setorCfg && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,.06)' }}>
          <button
            onClick={() => setProxTriAberto(a => !a)}
            style={{ width:'100%',background:'transparent',border:'none',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',color:'#6b84a8',fontSize:'10.5px',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const }}
          >
            <span>{proxTriAberto ? '▲' : '▼'} Premissas Próx. Tri</span>
          </button>
          {proxTriAberto && (
            <div style={{ padding:'0 16px 14px' }}>
              <div style={{ fontSize:'10px',color:'#e8a020',fontWeight:700,marginBottom:'10px' }}>▼ {setorCfg.label}</div>
              {setorCfg.campos.map(campo => (
                <div key={campo.key} style={{ marginBottom:'8px' }}>
                  <div style={{ fontSize:'9.5px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'3px' }}>{campo.label}</div>
                  <input
                    type="number" step="0.1"
                    value={nextTriInputs[campo.key] ?? campo.default}
                    onChange={e => updNTI(campo.key, e.target.value)}
                    style={sInp}
                  />
                  {campo.hint && <div style={{ fontSize:'9px',color:'#3d4f6a',marginTop:'2px' }}>{campo.hint}</div>}
                </div>
              ))}
              <button
                onClick={() => {
                  const res = estimarProxTriLocal(emp, setor, nextTriInputs)
                  onEstimarProxTri(res)
                }}
                style={{ width:'100%',background:'linear-gradient(135deg,#3a1a8a,#6a20c0)',border:'1px solid rgba(106,32,192,.5)',borderRadius:'7px',color:'#d4aaff',fontWeight:700,fontSize:'12px',padding:'9px',cursor:'pointer',marginTop:'4px',letterSpacing:'.5px' }}
              >
                ▶ Estimar Próximo Trimestre
              </button>
              <p style={{ fontSize:'9px',color:'#3d4f6a',marginTop:'6px',lineHeight:1.5,textAlign:'center' as const }}>
                SSS = crescimento YoY com lojas já abertas antes | Ramp up = % receita contribuída no 1º tri de operação
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Motores de Receita — Commodities ─────────────────── */}
      {isCommodity && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,.06)' }}>
          <button
            onClick={() => setCommodityAberto(a => !a)}
            style={{ width:'100%',background:'transparent',border:'none',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',color:'#90CAF9',fontSize:'10.5px',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const }}
          >
            <span>{commodityAberto ? '▲' : '▼'} Motores de Receita</span>
            <span style={{ fontSize:'9px',background:'rgba(144,202,249,.15)',color:'#90CAF9',borderRadius:'4px',padding:'1px 5px' }}>COMMODITY</span>
          </button>

          {commodityAberto && (
            <div style={{ padding:'0 16px 14px' }}>
              <p style={{ fontSize:'10px',color:'#3d4f6a',marginBottom:'12px',lineHeight:1.5 }}>
                Informe os preços por ano — o botão abaixo calcula o g_receita implícito e atualiza as premissas.
              </p>

              {/* Grid: commodity price */}
              <div style={{ marginBottom:'14px' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'6px' }}>
                  {commodityLabel} — previsão por ano
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px' }}>
                  {commodityAnos.map((v, i) => (
                    <div key={i} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'9px',color:'#3d4f6a',marginBottom:'2px' }}>A{i+1}</div>
                      <input
                        type="number" step={setor === 'celulose' ? 5 : setor === 'petroleo' ? 1 : 2} value={v}
                        onChange={e => {
                          const arr = [...commodityAnos]; arr[i] = parseFloat(e.target.value) || 0
                          setCommodityAnos(arr)
                        }}
                        style={{ background:'rgba(144,202,249,.06)',border:'1px solid rgba(144,202,249,.18)',borderRadius:'5px',color:'#90CAF9',fontFamily:'var(--font-space),monospace',fontSize:'11px',fontWeight:600,padding:'4px 3px',width:'100%',textAlign:'center',outline:'none' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid: BRL/USD — pré-preenchido pelo FOCUS */}
              <div style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px' }}>
                  <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const }}>
                    Câmbio BRL/USD — previsão por ano
                  </div>
                  {fxLoading && (
                    <div style={{ width:'10px',height:'10px',border:'2px solid rgba(232,160,32,.3)',borderTopColor:'#e8a020',borderRadius:'50%',animation:'spin .75s linear infinite',flexShrink:0 }} />
                  )}
                  {!fxLoading && (
                    <span style={{ fontSize:'8px',color:'#3d4f6a' }}>FOCUS/BACEN</span>
                  )}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px' }}>
                  {fxAnos.map((v, i) => (
                    <div key={i} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'9px',color:'#3d4f6a',marginBottom:'2px' }}>A{i+1}</div>
                      <input
                        type="number" step={0.01} value={v}
                        onChange={e => {
                          const arr = [...fxAnos]; arr[i] = parseFloat(e.target.value) || 0
                          setFxAnos(arr)
                        }}
                        style={{ background:'rgba(232,160,32,.05)',border:'1px solid rgba(232,160,32,.18)',borderRadius:'5px',color:'#e8a020',fontFamily:'var(--font-space),monospace',fontSize:'11px',fontWeight:600,padding:'4px 3px',width:'100%',textAlign:'center',outline:'none' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:'9px',color:'#3d4f6a',marginTop:'4px' }}>
                  Pré-preenchido com mediana do relatório Focus (BACEN). Editável.
                </div>
              </div>

              {/* Botão Usar no DCF */}
              <button
                onClick={usarCommodityNoDCF}
                style={{ width:'100%',background:'linear-gradient(135deg,#0d3a6e,#1a5fa0)',border:'1px solid rgba(30,106,160,.5)',borderRadius:'7px',color:'#90CAF9',fontWeight:700,fontSize:'12px',padding:'9px',cursor:'pointer',letterSpacing:'.5px' }}
              >
                ▶ Usar no DCF (atualiza g_receita)
              </button>
              <p style={{ fontSize:'9px',color:'#3d4f6a',marginTop:'6px',lineHeight:1.5,textAlign:'center' as const }}>
                Derivado via {setor === 'celulose' ? 'BHKP × vol implícito × BRL/USD' : setor === 'petroleo' ? 'Δ(Brent × BRL/USD) com produção constante' : 'Δ(preço soja × BRL/USD)'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal WACC */}
      {waccModal && (
        <ModalWACC
          emp={emp}
          taxRate={premissas.tax_rate}
          onAplicar={wacc => upd('wacc', wacc)}
          onClose={() => setWaccModal(false)}
        />
      )}
    </div>
  )
}

/* ── Modal Atualizar Dados — busca novo resultado no RI ─────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ModalAtualizarDados({ ticker, emp, onClose, onIrParaTri }: {
  ticker: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emp: any
  onClose: () => void
  onIrParaTri: () => void
}) {
  const [estado, setEstado] = useState<'buscando' | 'ok' | 'erro'>('buscando')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dados, setDados] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/verificar-resultado?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { setDados(d); setEstado('ok') })
      .catch(() => setEstado('erro'))
  }, [ticker])

  const ultimoConf    = dados?.ultimo_confirmado ?? emp?.ultimo_periodo_confirmado ?? '—'
  const proximoEsp    = dados?.proximo_esperado ?? '—'
  const novoDetectado = dados?.novo_detectado ?? false
  const disporData    = dados?.disponivel_por_data ?? false
  const riUrl         = dados?.ri_url ?? emp?.ri_url ?? null
  const riCheck       = dados?.ri_check
  const yahoo         = dados?.yahoo_recente
  const estimativa    = dados?.estimativa ?? emp?.proximo_tri

  // Badge de status
  const [statusLabel, statusCor] =
    estado === 'buscando' ? ['Buscando…', '#6b84a8']
    : novoDetectado       ? ['Novo resultado detectado', '#00d4a0']
    : disporData          ? ['Possivelmente disponível', '#FFD54F']
    :                       ['Aguardando divulgação',    '#6b84a8']

  const bdSty: React.CSSProperties = {
    position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'
  }
  const modalSty: React.CSSProperties = {
    background:'#0b1729',border:'1px solid rgba(255,255,255,.10)',borderRadius:'16px',padding:'28px 28px 24px',width:'560px',maxWidth:'95vw',maxHeight:'85vh',overflowY:'auto',position:'relative'
  }

  return (
    <div style={bdSty} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalSty}>
        {/* Cabeçalho */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px' }}>
          <div>
            <div style={{ fontSize:'11px',fontWeight:700,letterSpacing:'1px',textTransform:'uppercase' as const,color:'#e8a020' }}>Atualizar Dados — {ticker}</div>
            <div style={{ fontSize:'13px',color:'#b8c4d4',marginTop:'3px' }}>{emp?.nome ?? emp?.company}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)',border:'none',borderRadius:'8px',color:'#6b84a8',fontSize:'18px',width:'32px',height:'32px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>✕</button>
        </div>

        {/* Status badge */}
        <div style={{ display:'flex',alignItems:'center',gap:'10px',padding:'12px 14px',background:'rgba(255,255,255,.04)',border:`1px solid ${statusCor}33`,borderRadius:'10px',marginBottom:'20px' }}>
          {estado === 'buscando' && (
            <div style={{ width:'14px',height:'14px',border:'2px solid rgba(232,160,32,.3)',borderTopColor:'#e8a020',borderRadius:'50%',animation:'spin .75s linear infinite',flexShrink:0 }} />
          )}
          <span style={{ fontSize:'13px',fontWeight:700,color:statusCor }}>{statusLabel}</span>
        </div>

        {/* Períodos */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'20px' }}>
          <div style={{ background:'rgba(255,255,255,.04)',borderRadius:'9px',padding:'12px 14px' }}>
            <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'4px' }}>Último confirmado</div>
            <div style={{ fontSize:'18px',fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>{ultimoConf}</div>
          </div>
          <div style={{ background: novoDetectado ? 'rgba(0,212,160,.08)' : 'rgba(255,255,255,.04)', border: novoDetectado ? '1px solid rgba(0,212,160,.3)' : '1px solid transparent', borderRadius:'9px',padding:'12px 14px' }}>
            <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'4px' }}>Próximo esperado</div>
            <div style={{ fontSize:'18px',fontWeight:700,color: novoDetectado ? '#00d4a0' : '#FFD54F',fontFamily:'var(--font-space),monospace' }}>{proximoEsp}</div>
          </div>
        </div>

        {/* Resultado da busca no RI */}
        {estado === 'ok' && (
          <>
            {riCheck && (
              <div style={{ marginBottom:'16px',padding:'12px 14px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'9px' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'8px' }}>
                  Busca no RI da empresa
                </div>
                {riCheck.erro ? (
                  <div style={{ fontSize:'12px',color:'#ef4444' }}>Erro: {riCheck.erro}</div>
                ) : riCheck.encontrado ? (
                  <>
                    <div style={{ fontSize:'13px',color:'#00d4a0',fontWeight:700,marginBottom:'6px' }}>✓ Referências ao {proximoEsp} encontradas na página do RI</div>
                    {riCheck.titulosReleases.length > 0 && (
                      <ul style={{ listStyle:'none',padding:0,margin:0 }}>
                        {riCheck.titulosReleases.map((t: string, i: number) => (
                          <li key={i} style={{ fontSize:'12px',color:'#b8c4d4',padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                            › {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize:'12px',color:'#6b84a8' }}>Resultado {proximoEsp} ainda não encontrado na página do RI.</div>
                )}
              </div>
            )}

            {/* Yahoo Finance suplementar */}
            {yahoo && (yahoo.receita_mm != null || yahoo.lucro_mm != null) && (
              <div style={{ marginBottom:'16px',padding:'12px 14px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:'9px' }}>
                <div style={{ fontSize:'10px',color:'#6b84a8',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'8px' }}>
                  Yahoo Finance — último resultado
                  {yahoo.periodo && <span style={{ marginLeft:'8px',color:'#e8a020' }}>{yahoo.periodo}</span>}
                  {yahoo.endDate && <span style={{ marginLeft:'6px',fontSize:'9px',color:'#3d4f6a' }}>({yahoo.endDate})</span>}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px' }}>
                  {[
                    { label:'Receita', val: yahoo.receita_mm, suffix:'R$ MM' },
                    { label:'EBIT',    val: yahoo.ebit_mm,    suffix:'R$ MM' },
                    { label:'LL',      val: yahoo.lucro_mm,   suffix:'R$ MM' },
                  ].map(item => (
                    <div key={item.label} style={{ background:'rgba(255,255,255,.03)',borderRadius:'7px',padding:'8px 10px' }}>
                      <div style={{ fontSize:'9px',color:'#6b84a8',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.5px',marginBottom:'3px' }}>{item.label}</div>
                      <div style={{ fontSize:'13px',fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>
                        {item.val != null ? `${item.val.toLocaleString('pt-BR')}` : '—'}
                      </div>
                      {item.val != null && <div style={{ fontSize:'9px',color:'#3d4f6a',marginTop:'1px' }}>{item.suffix}</div>}
                    </div>
                  ))}
                </div>
                {yahoo.erro && <div style={{ fontSize:'10px',color:'#6b84a8',marginTop:'6px' }}>⚠ {yahoo.erro}</div>}
              </div>
            )}

            {/* Estimativa do modelo */}
            {estimativa && (
              <div style={{ marginBottom:'20px',padding:'12px 14px',background:'rgba(232,160,32,.05)',border:'1px solid rgba(232,160,32,.15)',borderRadius:'9px' }}>
                <div style={{ fontSize:'10px',color:'#e8a020',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase' as const,marginBottom:'8px' }}>
                  Estimativa do modelo — {estimativa.periodo ?? proximoEsp}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px' }}>
                  {[
                    { label:'Receita', val: estimativa.receita, fmt: (v: number) => `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:1})} MM` },
                    { label:'EBITDA',  val: estimativa.ebitda,  fmt: (v: number) => `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:1})} MM` },
                    { label:'Mg EBITDA', val: estimativa.mg_ebitda, fmt: (v: number) => `${v < 2 ? (v*100).toFixed(1) : v.toFixed(1)}%` },
                    { label:'Lucro Líq.', val: estimativa.ll, fmt: (v: number) => `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:1})} MM` },
                  ].map(item => (
                    <div key={item.label} style={{ display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                      <span style={{ fontSize:'12px',color:'#6b84a8' }}>{item.label}</span>
                      <span style={{ fontSize:'12px',fontWeight:700,color:'#e8edf5',fontFamily:'var(--font-space),monospace' }}>
                        {item.val != null ? item.fmt(item.val) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Ações */}
        <div style={{ display:'flex',flexDirection:'column' as const,gap:'10px' }}>
          {riUrl && (
            <a href={riUrl} target="_blank" rel="noreferrer"
               style={{ display:'block',textAlign:'center',background:'#e8a020',color:'#000',fontWeight:700,fontSize:'13px',padding:'11px',borderRadius:'8px',textDecoration:'none' }}>
              Abrir RI da empresa →
            </a>
          )}
          <button
            onClick={onIrParaTri}
            style={{ background:'rgba(30,106,160,.15)',border:'1px solid rgba(30,106,160,.3)',borderRadius:'8px',color:'#90CAF9',fontWeight:700,fontSize:'13px',padding:'10px',cursor:'pointer' }}
          >
            Preencher resultado manualmente (Próx. Trimestre)
          </button>
          <button
            onClick={onClose}
            style={{ background:'transparent',border:'1px solid rgba(255,255,255,.08)',borderRadius:'8px',color:'#6b84a8',fontSize:'13px',padding:'9px',cursor:'pointer' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Paywall plano gratuito ──────────────────────────────────────────────── */
function PaywallDCF() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ background: '#0d1a2e', border: '1px solid rgba(232,160,32,.25)', borderRadius: '20px', padding: '52px 48px', maxWidth: '520px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: '#e8a020', marginBottom: '12px' }}>Recurso Exclusivo</div>
        <h2 style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: '26px', fontWeight: 700, color: '#e8edf5', marginBottom: '16px', lineHeight: 1.3 }}>
          Valuation DCF disponível<br />no plano <span style={{ color: '#e8a020' }}>Essencial ou superior</span>
        </h2>
        <p style={{ fontSize: '15px', color: '#6b84a8', lineHeight: 1.7, marginBottom: '32px' }}>
          O módulo DCF com cenários Bear/Base/Bull, sensibilidade WACC×g, TIR implícita e estimativa de resultados está disponível a partir do plano <strong style={{ color: '#e8edf5' }}>Essencial</strong>.
        </p>
        <div style={{ background: 'rgba(232,160,32,.06)', border: '1px solid rgba(232,160,32,.15)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
          <div style={{ fontSize: '12px', color: '#6b84a8', marginBottom: '12px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' as const }}>O que você terá acesso</div>
          {[
            '📊 14 empresas B3 com valuation DCF completo',
            '🎯 Cenários Bear / Base / Bull com upside',
            '📈 Sensibilidade WACC × g (tabela completa)',
            '🔮 Estimativa de resultados por trimestre',
            '📄 Relatório PDF gerado por IA',
          ].map(item => (
            <div key={item} style={{ fontSize: '13.5px', color: '#a0b4cc', padding: '6px 0', textAlign: 'left' }}>{item}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
          <a href="/planos"
             style={{ background: '#e8a020', color: '#000', fontWeight: 700, fontSize: '15px', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', display: 'block' }}>
            Ver planos e fazer upgrade
          </a>
          <Link href="/dashboard"
             style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: '#a0b4cc', fontSize: '14px', padding: '12px 32px', borderRadius: '8px', textDecoration: 'none', display: 'block' }}>
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ────────────────────────────────────────────────────── */
export default function DCFPage() {
  const [sel, setSel] = useState<string|null>(null)
  const [aba, setAba] = useState<Aba>('resumo')
  const [modalRel, setModalRel] = useState<string|null>(null)
  const [modalAtualizar, setModalAtualizar] = useState(false)
  const [busca, setBusca] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localEst, setLocalEst] = useState<Record<string, any> | null>(null)
  const [ajustes, setAjustes] = useState<AjustesAnalista>(AJUSTES_DEFAULT)
  const [nextTriInputs, setNextTriInputs] = useState<Record<string, number>>({})
  const [plano, setPlano] = useState<string | null>(null)
  const [precos, setPrecos] = useState<Record<string, number|null>>({})

  // Estado do analista — premissas editáveis e resultado recalculado
  const [premissas, setPremissas] = useState<PremissasDCF | null>(null)
  const [resultadoCustom, setResultadoCustom] = useState<ResultadoDCF | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setPlano(d.plano ?? 'gratuito'))
      .catch(() => setPlano('gratuito'))
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const source = p.get('utm_source')
    const campaign = p.get('utm_campaign')
    const content = p.get('utm_content')
    if (source) {
      track('dcf_utm_visit', {
        utm_source: source,
        utm_medium: p.get('utm_medium') ?? '',
        utm_campaign: campaign ?? '',
        utm_content: content ?? '',
      })
    }
  }, [])

  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date|null>(null)

  // Quando troca de empresa: inicializa premissas com os valores do modelo
  useEffect(() => {
    if (!sel || plano !== 'analista') { setPremissas(null); setResultadoCustom(null); return }
    const e = dcfData[sel]
    if (!e) return
    setPremissas(premissasDeEmp(e))
    setResultadoCustom(null)
  }, [sel, plano])

  // Aplica ajustes do analista às premissas/base antes de calcular
  const aplicarAjustes = useCallback((e: any, prem: PremissasDCF): [any, PremissasDCF] => {
    let eAdj = e
    let pAdj = prem
    if (ajustes.nao_recorrente_liq !== 0 && e.rec_base != null) {
      eAdj = { ...e, rec_base: Math.max(100, e.rec_base - ajustes.nao_recorrente_liq) }
    }
    if (ajustes.wacc_ajuste !== 0) {
      pAdj = { ...prem, wacc: Math.max(0.5, prem.wacc + ajustes.wacc_ajuste) }
    }
    return [eAdj, pAdj]
  }, [ajustes])

  // Recalcula DCF com debounce de 400ms ao editar premissas
  useEffect(() => {
    if (!premissas || !sel || plano !== 'analista') return
    const e = dcfData[sel]
    if (!e) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const pa = precos[sel] ?? e.preco_atual ?? null
      const [eAdj, pAdj] = aplicarAjustes(e, premissas)
      const res = calcDCFCustom(eAdj, pAdj, pa)
      setResultadoCustom(res)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [premissas, sel, plano, precos, aplicarAjustes])

  const calcularDCFAgora = useCallback(() => {
    if (!premissas || !sel || plano !== 'analista') return
    const e = dcfData[sel]
    if (!e) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const pa = precos[sel] ?? e.preco_atual ?? null
    const [eAdj, pAdj] = aplicarAjustes(e, premissas)
    const res = calcDCFCustom(eAdj, pAdj, pa)
    setResultadoCustom(res)
  }, [premissas, sel, plano, precos, aplicarAjustes])

  const fetchCotacoes = useCallback(() => {
    const tickers = Object.keys(dcfData)
    if (tickers.length === 0) return
    fetch(`/api/cotacoes?tickers=${tickers.join(',')}`)
      .then(r => r.json())
      .then(d => {
        const m: Record<string, number|null> = {}
        for (const c of d.cotacoes ?? []) m[c.ticker] = c.preco
        setPrecos(m)
        setUltimaAtualizacao(new Date())
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCotacoes()
    // atualiza a cada 5 minutos enquanto a aba está visível
    const timer = setInterval(() => {
      if (!document.hidden) fetchCotacoes()
    }, 5 * 60 * 1000)
    // atualiza ao retornar para a aba
    const onVisible = () => { if (!document.hidden) fetchCotacoes() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [fetchCotacoes])

  // Inicializa localEst ao trocar de empresa (pré-popula com proximo_tri)
  useEffect(() => {
    if (!sel) { setLocalEst(null); return }
    const e = dcfData[sel]
    const t = e?.proximo_tri
    if (!t) { setLocalEst(null); return }
    setLocalEst({
      receita:   t.receita   ?? null,
      ebitda:    t.ebitda    ?? null,
      mg_ebitda: t.mg_ebitda != null ? (t.mg_ebitda < 2 ? +(t.mg_ebitda * 100).toFixed(1) : t.mg_ebitda) : null,
      ll:        t.ll        ?? null,
      sss:       t.sss       ?? null,
      npl:       t.npl       ?? null,
      bhkp:      t.bhkp      ?? null,
      brent:     t.brent     ?? null,
      roe:       t.roe       ?? null,
      div_liq:   t.div_liq   ?? null,
      n_lojas:   t.n_lojas   ?? null,
    })
  }, [sel])

  // Inicializa ajustes (localStorage) e nextTriInputs (sector defaults) ao trocar empresa
  useEffect(() => {
    if (!sel) { setAjustes(AJUSTES_DEFAULT); setNextTriInputs({}); return }
    // Carregar ajustes do localStorage
    try {
      const saved = localStorage.getItem(`dcf_aj_${sel}`)
      setAjustes(saved ? { ...AJUSTES_DEFAULT, ...JSON.parse(saved) } : AJUSTES_DEFAULT)
    } catch { setAjustes(AJUSTES_DEFAULT) }
    // Defaults do setor para os inputs do próximo trimestre
    const e = dcfData[sel]
    const setor = detectarSetor(e)
    const cfg = SETORES_CONFIG[setor]
    if (cfg) {
      const defs: Record<string, number> = {}
      cfg.campos.forEach(c => { defs[c.key] = c.default })
      setNextTriInputs(defs)
    } else {
      setNextTriInputs({})
    }
  }, [sel])

  // Empresas filtradas pela busca (todos os planos com acesso)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const empresasFiltradas = useMemo<any[]>(() => {
    const q = busca.toLowerCase().trim()
    if (!q) return empresas
    return empresas.filter((e: any) =>
      e.ticker?.toLowerCase().includes(q) || e.nome?.toLowerCase().includes(q) || e.company?.toLowerCase().includes(q)
    )
  }, [busca])

  const emp = sel ? dcfData[sel] : null
  const precoLive = sel ? (precos[sel] ?? null) : null
  const upsideLive = (target: number|null, fallback: number|null) =>
    target != null && precoLive != null && precoLive > 0
      ? ((target - precoLive) / precoLive) * 100
      : fallback
  const upSel = emp ? upsideLive(emp.base?.preco, emp.base?.upside ?? emp.upside_base_legado) : null
  const metodoBadge = (m: string) =>
    ({ fcff:'#3b82f6', ddm:'#a855f7', sotp:'#f59e0b' }[m?.toLowerCase()] ?? '#6b84a8')

  const linhasNeg: any[] = emp?.linhas_negocio ?? []
  const isAnalista = plano === 'analista'
  const ABAS: { id: Aba; label: string; hidden?: boolean }[] = [
    { id:'resumo',        label:'Visão Geral'    },
    { id:'historico',     label:'Histórico'      },
    { id:'linhas',        label:'Linhas de Negócio', hidden: linhasNeg.length === 0 },
    { id:'projecoes',     label:'Projeções DCF'  },
    { id:'sensibilidade', label:'Sensibilidade'  },
    { id:'outros',        label:'TIR / Gordon / Graham' },
    { id:'tri',           label:'Próx. Trimestre' },
    { id:'kpis',          label:'KPIs Operac.',   hidden: !isAnalista },
    { id:'saude',         label:'Saúde Financ.',  hidden: !isAnalista },
  ]

  // Plano carregado e é gratuito → paywall
  if (plano === 'gratuito') {
    return (
      <>
        <NavBar />
        <PaywallDCF />
      </>
    )
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5}
        .page{display:flex;height:calc(100vh - 44px)}
        .sidebar{width:270px;flex-shrink:0;background:#081120;border-right:1px solid rgba(255,255,255,.07);overflow-y:auto;display:flex;flex-direction:column}
        .sidebar-hdr{padding:14px 18px 10px;border-bottom:1px solid rgba(255,255,255,.07)}
        .sidebar-hdr h2{font-size:12px;font-weight:700;color:#6b84a8;letter-spacing:1px;text-transform:uppercase}
        .sidebar-hdr p{font-size:11px;color:#3d4f6a;margin-top:3px}
        .busca-input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:7px;color:#e8edf5;font-size:12px;padding:7px 10px;outline:none;margin-top:8px;font-family:inherit}
        .busca-input::placeholder{color:#3d4f6a}
        .busca-input:focus{border-color:rgba(232,160,32,.4);background:rgba(232,160,32,.04)}
        .emp-item{padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .12s;display:flex;align-items:center;justify-content:space-between}
        .emp-item:hover{background:rgba(255,255,255,.04)}
        .emp-item.ativo{background:rgba(232,160,32,.08);border-left:3px solid #e8a020;padding-left:15px}
        .emp-ticker{font-weight:700;font-size:14px;color:#e8a020;font-family:var(--font-space),monospace}
        .emp-nome{font-size:11px;color:#6b84a8;margin-top:2px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .main{flex:1;overflow:hidden;display:flex;flex-direction:column}
        .main-hdr{padding:20px 28px 0;flex-shrink:0}
        .tab-bar{display:flex;gap:2px;padding:0 28px;margin-top:16px;border-bottom:2px solid rgba(255,255,255,.08);flex-shrink:0;overflow-x:auto;background:#050d1a}
        .tab{padding:10px 16px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#6b84a8;white-space:nowrap;transition:all .15s;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;outline:none}
        .tab:hover{color:#e8edf5;background:rgba(255,255,255,.04);border-radius:6px 6px 0 0}
        .tab.ativo{color:#e8a020;border-bottom-color:#e8a020;background:rgba(232,160,32,.06);border-radius:6px 6px 0 0}
        .content{flex:1;overflow-y:auto;padding:20px 28px 40px}
        .vazio{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#6b84a8;text-align:center}
        .btn-rel{background:#e8a020;color:#000;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;border:none;cursor:pointer}
        .btn-rel:hover{background:#f5c55a}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]:focus{border-color:rgba(232,160,32,.5)!important;background:rgba(232,160,32,.06)!important}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media (max-width: 640px) {
          .sidebar{width:104px}
          .sidebar-hdr{padding:8px 8px 6px}
          .sidebar-hdr h2{font-size:9px}
          .sidebar-hdr p{font-size:9px}
          .busca-input{font-size:10px;padding:5px 7px}
          .emp-item{padding:8px 8px;flex-direction:column;align-items:flex-start;gap:3px}
          .emp-item.ativo{padding-left:6px}
          .emp-nome{max-width:88px;font-size:9px}
          .emp-ticker{font-size:11px}
          .main-hdr{padding:12px 12px 0}
          .tab-bar{padding:0 12px}
          .content{padding:12px 12px 30px}
        }
      `}</style>

      <NavBar />

      <div className="page">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-hdr">
            <h2>DCF / Valuation</h2>
            <p>{empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'} analisadas</p>
            <input
              className="busca-input"
              placeholder="🔍  Filtrar empresa..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          {empresas.length === 0 ? (
            <div style={{ padding:'20px',color:'#6b84a8',fontSize:'12px',textAlign:'center' }}>
              <p>Rode <code>export_dcf.py</code> para publicar as análises.</p>
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div style={{ padding:'16px 18px',color:'#3d4f6a',fontSize:'12px' }}>
              Nenhuma empresa encontrada para "{busca}".
            </div>
          ) : empresasFiltradas.map((e: any) => {
            const pLive = precos[e.ticker] ?? null
            const up = pLive != null && e.base?.preco != null && pLive > 0
              ? ((e.base.preco - pLive) / pLive) * 100
              : (e.base?.upside ?? e.upside_base_legado)
            return (
              <div key={e.ticker}
                   className={`emp-item${sel === e.ticker ? ' ativo' : ''}`}
                   onClick={() => { setSel(e.ticker); setAba('resumo') }}>
                <div>
                  <div className="emp-ticker">{e.ticker}</div>
                  <div className="emp-nome" title={e.nome}>{e.nome}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'14px',fontWeight:700,color:corUpside(up) }}>
                    {up != null ? `${up > 0 ? '+' : ''}${f1(up)}%` : '—'}
                  </div>
                  <div style={{ fontSize:'10px',color:'#3d4f6a' }}>base</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* MAIN */}
        <div className="main">
          {!emp ? (
            <div className="vazio content">
              <div style={{ fontSize:'48px',marginBottom:'16px' }}>💹</div>
              <p style={{ fontSize:'16px',fontWeight:700,color:'#e8edf5',marginBottom:'8px' }}>Selecione uma empresa</p>
              <p style={{ fontSize:'13px' }}>Escolha na lista para ver a análise DCF completa.</p>
            </div>
          ) : (
            <>
              <div className="main-hdr">
                <div style={{ display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap' }}>
                  <h1 style={{ fontFamily:'var(--font-space),Space Grotesk,sans-serif',fontSize:'26px',fontWeight:700,color:'#e8a020' }}>{emp.ticker}</h1>
                  <Badge label={emp.method?.toUpperCase() ?? 'FCFF'} color={metodoBadge(emp.method)}/>
                  {upSel != null && (
                    <Badge label={`Base ${upSel > 0 ? '+' : ''}${f1(upSel)}%`} color={corUpside(upSel)}/>
                  )}
                  {resultadoCustom && <Badge label="⚡ EDITADO" color="#e8a020"/>}
                  <div style={{ marginLeft:'auto', display:'flex', gap:'8px', alignItems:'center' }}>
                    {isAnalista && (
                      <button
                        onClick={() => {
                          setAtualizando(true)
                          fetchCotacoes()
                          setTimeout(() => setAtualizando(false), 1500)
                          setModalAtualizar(true)
                        }}
                        style={{ background:'rgba(0,212,160,.1)',border:'1px solid rgba(0,212,160,.3)',color:'#00d4a0',fontWeight:700,fontSize:'12px',padding:'8px 16px',borderRadius:'7px',cursor:'pointer' }}
                      >
                        {atualizando ? '⟳ Atualizando…' : '⟳ Atualizar dados'}
                      </button>
                    )}
                    <button className="btn-rel" onClick={() => setModalRel(emp.ticker)}>📄 Gerar Relatório IA</button>
                  </div>
                </div>
                <p style={{ fontSize:'14px',color:'#b8c4d4',marginTop:'4px' }}>{emp.company}</p>
                <p style={{ fontSize:'11px',color:'#6b84a8',marginTop:'3px' }}>
                  {precoLive != null && ultimaAtualizacao != null
                    ? ultimaAtualizacao.toLocaleDateString('pt-BR') + ' ' +
                      ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) +
                      ' · cotação ao vivo'
                    : (emp.atualizado ?? '—')}
                  {precoLive != null
                    ? ` · R$ ${f2(precoLive)}`
                    : emp.preco_atual
                      ? ` · Preço base: R$ ${f2(emp.preco_atual)}`
                      : ''}
                  {emp.atualizado && ` · Modelo: ${emp.atualizado}`}
                </p>
              </div>

              {/* ABAS */}
              <div className="tab-bar">
                {ABAS.filter(a => !a.hidden).map(a => (
                  <button key={a.id} className={`tab${aba === a.id ? ' ativo' : ''}`} onClick={() => setAba(a.id)}>
                    {a.label}
                  </button>
                ))}
              </div>

              <div className="content">
                {aba === 'resumo'        && <SecResumo e={emp} precoLive={precoLive} customResult={resultadoCustom}/>}
                {aba === 'historico'     && <SecHistorico e={emp}/>}
                {aba === 'linhas'        && <SecLinhasNegocio e={emp}/>}
                {aba === 'projecoes'     && <SecProjecoes e={emp} customResult={resultadoCustom}/>}
                {aba === 'sensibilidade' && <SecSensibilidade e={emp} precoLive={precoLive}/>}
                {aba === 'outros'        && <SecOutros e={emp} precoLive={precoLive}/>}
                {aba === 'tri'           && <SecProximoTri e={emp} plano={plano} localEst={localEst} setLocalEst={setLocalEst}/>}
                {aba === 'kpis'  && isAnalista && <>
                  <SecTitle>KPIs Operacionais — Último Período</SecTitle>
                  <SecKPIs e={emp} precoLive={precoLive}/>
                </>}
                {aba === 'saude' && isAnalista && <>
                  <SecTitle>Saúde Financeira</SecTitle>
                  <SecSaude e={emp}/>
                </>}
              </div>
            </>
          )}
        </div>

        {/* PAINEL PREMISSAS — só para analista com empresa selecionada */}
        {isAnalista && emp && premissas && (
          <PremissasEditor
            emp={emp}
            premissas={premissas}
            setPremissas={fn => setPremissas(p => p ? fn(p) : p)}
            resultado={resultadoCustom}
            onReset={() => { setPremissas(premissasDeEmp(emp)); setResultadoCustom(null) }}
            onCalcularAgora={calcularDCFAgora}
            ajustes={ajustes}
            setAjustes={aj => {
              setAjustes(aj)
              if (sel) { try { localStorage.setItem(`dcf_aj_${sel}`, JSON.stringify(aj)) } catch {} }
            }}
            nextTriInputs={nextTriInputs}
            setNextTriInputs={setNextTriInputs}
            onEstimarProxTri={resultado => { setLocalEst(resultado); setAba('tri') }}
          />
        )}
      </div>

      {modalAtualizar && emp && (
        <ModalAtualizarDados
          ticker={sel!}
          emp={emp}
          onClose={() => setModalAtualizar(false)}
          onIrParaTri={() => { setAba('tri'); setModalAtualizar(false) }}
        />
      )}

      {modalRel && (
        <ModalRelatorio
          ticker={modalRel}
          nome={dcfData[modalRel]?.nome ?? modalRel}
          onClose={() => setModalRel(null)}
        />
      )}
    </>
  )
}
