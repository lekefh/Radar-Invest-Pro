import { NextRequest, NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function fetchPreco(ticker: string) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=2d`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) }
    )
    if (!r.ok) return { ticker, preco: null, variacao: null }
    const j = await r.json()
    const meta = j.chart?.result?.[0]?.meta
    if (!meta) return { ticker, preco: null, variacao: null }
    const preco = meta.regularMarketPrice ?? null
    const prev  = meta.previousClose ?? meta.chartPreviousClose ?? null
    const variacao = preco && prev ? ((preco - prev) / prev) * 100 : null
    return { ticker, preco, variacao }
  } catch {
    return { ticker, preco: null, variacao: null }
  }
}

/* GET /api/cotacoes?tickers=AXIA3,AZZA3,PETR4 */
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get('tickers') ?? ''
  const tickers = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)

  if (tickers.length === 0)
    return NextResponse.json({ cotacoes: [] })

  const settled = await Promise.allSettled(tickers.map(fetchPreco))
  const cotacoes = settled.map(r =>
    r.status === 'fulfilled' ? r.value : { ticker: '?', preco: null, variacao: null }
  )

  return NextResponse.json(
    { cotacoes },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  )
}
