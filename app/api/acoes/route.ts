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
      nota:         n(f.nota),
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
