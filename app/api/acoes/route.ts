import { NextResponse } from 'next/server'
import fundamentaisRaw from '@/lib/fundamentais.json'
import setoresManuaisRaw from '@/lib/setores_manuais.json'
import dcfRaw from '@/lib/dcf.json'

const setoresManuais = setoresManuaisRaw as Record<string, string>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcfData = dcfRaw as unknown as Record<string, any>

interface FundInfo {
  nome: string | null; setor: string | null; dy: number | null; pl: number | null;
  pvp: number | null; roe: number | null; lpa: number | null;
  divEbit: number | null; vpa: number | null; merc: number | null;
  evEbit: number | null; max52s: number | null; gov: number | null;
  govRespostas?: Record<string, string>; nota: number | null;
  atualizado: string | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fundamentais = fundamentaisRaw as unknown as Record<string, any>
const TICKERS = Object.keys(fundamentais).sort()

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const n  = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

function calcNota(
  pl: number|null, roe: number|null, dy: number|null, pvp: number|null,
  divEbit: number|null, evEbit: number|null, gov: number|null,
  dcfUpside: number|null, tirPremio: number|null, setor: string|null
): number | null {
  const util = setor === 'Utilidade Pública'
  const c: { pts: number; max: number }[] = []
  if (pl != null && pl > 0) {
    const m = 2.5; const p = util ? (pl<10?2.5:pl<14?2.1:pl<18?1.6:pl<22?1.0:pl<28?0.5:0) : (pl<8?2.5:pl<12?2.1:pl<16?1.6:pl<20?1.0:pl<25?0.5:0)
    c.push({ pts: p, max: m })
  }
  if (roe != null) {
    const m = 2.5; const p = util ? (roe>15?2.5:roe>11?2.1:roe>8?1.5:roe>5?0.9:roe>2?0.4:0) : (roe>25?2.5:roe>18?2.1:roe>12?1.5:roe>8?0.9:roe>4?0.4:0)
    c.push({ pts: p, max: m })
  }
  if (dy != null && dy >= 0) {
    const m = 1.5; const p = util ? (dy>8?1.5:dy>6?1.2:dy>4?0.9:dy>2?0.5:dy>0?0.2:0) : (dy>10?1.5:dy>7?1.2:dy>5?0.9:dy>3?0.5:dy>1?0.2:0)
    c.push({ pts: p, max: m })
  }
  if (pvp != null && pvp > 0) {
    const m = 1.5; const p = util ? (pvp<1.0?1.5:pvp<1.5?1.2:pvp<2.0?0.9:pvp<2.5?0.5:pvp<3.5?0.2:0) : (pvp<0.7?1.5:pvp<1.0?1.2:pvp<1.5?0.9:pvp<2.0?0.5:pvp<2.5?0.2:0)
    c.push({ pts: p, max: m })
  }
  if (divEbit != null) {
    const m = 3.0; const p = util ? (divEbit<0?3.0:divEbit<3?3.0:divEbit<5?2.2:divEbit<8?1.2:divEbit<12?0.4:divEbit<16?0.1:0) : (divEbit<0?3.0:divEbit<1?3.0:divEbit<2?2.2:divEbit<3?1.2:divEbit<4?0.4:0)
    c.push({ pts: p, max: m })
  }
  if (evEbit != null && evEbit > 0) {
    const m = 3.0; const p = util ? (evEbit<12?3.0:evEbit<18?2.1:evEbit<25?1.5:evEbit<35?0.9:evEbit<50?0.4:evEbit<65?0.1:0) : (evEbit<6?3.0:evEbit<9?2.1:evEbit<12?1.2:evEbit<16?0.3:0)
    c.push({ pts: p, max: m })
  }
  if (gov != null && gov > 0) { c.push({ pts: Math.min(gov*(3.0/2.5), 3.0), max: 3.0 }) }
  if (dcfUpside != null) {
    const p = dcfUpside>=40?3.0:dcfUpside>=30?2.4:dcfUpside>=20?1.8:dcfUpside>=10?1.2:dcfUpside>=5?0.6:dcfUpside>=0?0.2:0
    c.push({ pts: p, max: 3.0 })
  }
  if (tirPremio != null) {
    const p = tirPremio>=6?3.0:tirPremio>=5?2.5:tirPremio>=4?2.0:tirPremio>=3?1.5:tirPremio>=2?1.0:tirPremio>=1?0.5:tirPremio>=0?0.1:tirPremio>=-1?-0.3:-0.6
    c.push({ pts: p, max: 3.0 })
  }
  const tp = c.reduce((s,x)=>s+x.pts, 0)
  const tm = c.reduce((s,x)=>s+x.max, 0)
  return tm > 0 ? Math.round((tp/tm)*100)/10 : null
}

async function fetchChart(ticker: string) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=2d`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) }
    )
    if (!r.ok) return null
    const j = await r.json()
    const meta = j.chart?.result?.[0]?.meta
    if (!meta) return null
    const preco  = n(meta.regularMarketPrice)
    const prev   = n(meta.previousClose ?? meta.chartPreviousClose)
    return {
      preco,
      variacao: prev && preco ? ((preco - prev) / prev) * 100 : null,
      max52s:   n(meta.fiftyTwoWeekHigh),
    }
  } catch { return null }
}

export async function GET() {
  const settled = await Promise.allSettled(TICKERS.map((t) => fetchChart(t).then((d) => ({ t, d }))))
  const precos: Record<string, { preco: number | null; variacao: number | null; max52s: number | null }> = {}
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.d) precos[r.value.t] = r.value.d
  }

  const acoes = TICKERS.map((ticker) => {
    const f = fundamentais[ticker]
    const p = precos[ticker]

    const preco    = p?.preco    ?? null
    const max52s   = p?.max52s   ?? n(f.max52s)
    const variacao = p?.variacao ?? null
    const varVsMax = preco != null && max52s != null ? ((preco - max52s) / max52s) * 100 : null

    // DCF upside dinâmico: target base vs preço atual do Yahoo Finance
    const dcfTargetBase = n(dcfData[ticker]?.base?.preco)
    const dcfUpside = dcfTargetBase != null && preco != null && preco > 0
      ? ((dcfTargetBase - preco) / preco) * 100
      : null

    // TIR Real prêmio vs NTN-B (armazenado em dcf.json)
    const tirPremioNtnb = n(dcfData[ticker]?.tir?.vs_ntnb)

    return {
      ticker,
      nome:    f.nome,
      setor:   setoresManuais[ticker] ?? f.setor,
      preco,
      variacao,
      max52s,
      varVsMax,
      dy:      n(f.dy),
      pl:      n(f.pl),
      pvp:     n(f.pvp),
      roe:     n(f.roe),
      lpa:     n(f.lpa),
      vpa:     n(f.vpa),
      divEbit: n(f.divEbit),
      merc:    n(f.merc),
      evEbit:  n(f.evEbit),
      gov:          n(f.gov),
      govRespostas: f.govRespostas ?? {},
      nota: calcNota(n(f.pl), n(f.roe), n(f.dy), n(f.pvp), n(f.divEbit), n(f.evEbit), n(f.gov), dcfUpside, tirPremioNtnb, setoresManuais[ticker] ?? f.setor) ?? n(f.nota),
      atualizado:   f.atualizado,
      dcfUpside,
      tirPremioNtnb,
    }
  })

  return NextResponse.json(
    { acoes, ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
  )
}
