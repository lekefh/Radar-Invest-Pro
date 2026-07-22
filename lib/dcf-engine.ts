/**
 * dcf-engine.ts — Motor de cálculo DCF em TypeScript (espelho do run_dcf do Python)
 * Usado no painel de analista para recalcular em tempo real ao editar premissas.
 */

export interface PremissasDCF {
  wacc: number              // % ex: 12.5
  g_terminal: number        // % ex: 4.5
  tax_rate: number          // % efetivo ex: 20.0
  tax_rate_terminal: number // % perpetuidade ex: 34.0
  da_pct: number            // D&A/Receita % ex: 3.0
  g_receita: number[]       // crescimento anual % [7 anos]
  mg_ebitda: number[]       // margem EBITDA % [7 anos]
  capex_pct: number[]       // CapEx/Receita % [7 anos]
  dcg_pct: number[]         // ΔNCG/ΔReceita % [7 anos]
}

export interface ProjecaoDCF {
  ano: number
  receita: number
  ebitda: number
  ebit: number
  nopat: number
  capex: number
  fcl: number
  vp_fcl: number
}

export interface CenarioDCF {
  preco: number
  upside: number | null
  projecoes: ProjecaoDCF[]
  valor_terminal: number
}

export interface ResultadoDCF {
  bear: CenarioDCF
  base: CenarioDCF
  bull: CenarioDCF
}

function r1(v: number) { return Math.round(v * 10) / 10 }
function r2(v: number) { return Math.round(v * 100) / 100 }

function calcCenario(
  rec_base: number,
  divida_liquida: number,
  shares: number,
  prem: PremissasDCF,
  g_factor: number,
  mg_factor: number,
  dcg_factor: number,
  ano_base: number,
  preco_atual: number | null,
): CenarioDCF {
  const wacc    = prem.wacc / 100
  const g_term  = prem.g_terminal / 100
  const tax     = prem.tax_rate / 100
  const tax_t   = prem.tax_rate_terminal / 100
  const da_frac = prem.da_pct / 100

  let receita  = rec_base
  let vp_sum   = 0
  let last_ebit = 0
  const projecoes: ProjecaoDCF[] = []

  for (let i = 0; i < 7; i++) {
    const g    = ((prem.g_receita[i]  ?? 0) / 100) * g_factor
    const mg   = ((prem.mg_ebitda[i]  ?? 0) / 100) * mg_factor
    const cx   = (prem.capex_pct[i]   ?? 0) / 100
    const dcg  = ((prem.dcg_pct[i]    ?? 0) / 100) * dcg_factor
    const prev = receita

    receita   *= (1 + g)
    const ebitda    = receita * mg
    const da        = receita * da_frac
    const ebit      = ebitda - da
    const nopat     = ebit * (1 - tax)
    const capex     = receita * cx
    const delta_ncg = dcg * (receita - prev)
    const fcl       = nopat + da - capex - delta_ncg
    const vp_fcl    = fcl / Math.pow(1 + wacc, i + 1)

    vp_sum    += vp_fcl
    last_ebit  = ebit

    projecoes.push({
      ano:     ano_base + i + 1,
      receita: r1(receita),
      ebitda:  r1(ebitda),
      ebit:    r1(ebit),
      nopat:   r1(nopat),
      capex:   r1(capex),
      fcl:     r1(fcl),
      vp_fcl:  r1(vp_fcl),
    })
  }

  // Valor Terminal: ajusta alíquota da perpetuidade (geralmente 34% estatutário)
  const fcl_last     = projecoes[6].fcl
  const fcl_adj      = fcl_last + last_ebit * (tax - tax_t)
  const vt_raw       = wacc > g_term ? (fcl_adj * (1 + g_term)) / (wacc - g_term) : 0
  const vt_vp        = vt_raw / Math.pow(1 + wacc, 7)
  const ev           = vp_sum + vt_vp
  const equity_mm    = ev - divida_liquida
  const preco        = shares > 0 ? (equity_mm * 1_000_000) / shares : 0
  const upside       = preco_atual && preco_atual > 0
    ? ((preco - preco_atual) / preco_atual) * 100
    : null

  return {
    preco:          r2(preco),
    upside:         upside != null ? r1(upside) : null,
    projecoes,
    valor_terminal: r1(vt_vp),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcDCFCustom(emp: any, prem: PremissasDCF, precoLive: number | null): ResultadoDCF | null {
  const rec_base = emp.rec_base as number | null
  if (!rec_base || !emp.shares || rec_base <= 0) return null

  const dl       = (emp.divida_liquida as number) ?? 0
  const shares   = emp.shares as number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hist     = (emp.historico as any[]) ?? []
  const ultimo   = hist.length > 0
    ? parseInt(String(hist[hist.length - 1].ano).replace('*', ''), 10)
    : new Date().getFullYear()
  const pa       = precoLive ?? (emp.preco_atual as number | null)

  const bf  = (emp.bear_factor        as number) ?? 0.70
  const uf  = (emp.bull_factor        as number) ?? 1.30
  const bmf = (emp.bear_margin_factor as number) ?? 0.90
  const umf = (emp.bull_margin_factor as number) ?? 1.10

  return {
    base: calcCenario(rec_base, dl, shares, prem, 1.0, 1.0, 1.0,   ultimo, pa),
    bear: calcCenario(rec_base, dl, shares, prem, bf,  bmf, 1.10,  ultimo, pa),
    bull: calcCenario(rec_base, dl, shares, prem, uf,  umf, 0.90,  ultimo, pa),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function premissasDeEmp(emp: any): PremissasDCF {
  const n7 = (arr: number[] | null | undefined, def: number): number[] =>
    Array.isArray(arr) && arr.length >= 7 ? arr.slice(0, 7) : Array(7).fill(def)

  return {
    wacc:              emp.wacc              ?? 12.0,
    g_terminal:        emp.g_terminal         ?? 4.5,
    tax_rate:          emp.tax_rate           ?? 34.0,
    tax_rate_terminal: emp.tax_rate_terminal  ?? 34.0,
    da_pct:            emp.da_pct             ?? 3.0,
    g_receita:         n7(emp.g_receita,   8.0),
    mg_ebitda:         n7(emp.mg_ebitda,  25.0),
    capex_pct:         n7(emp.capex_pct,   4.0),
    dcg_pct:           n7(emp.dcg_pct,    12.0),
  }
}
