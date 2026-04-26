// api/quotes.js — Cotações B3 server-side (sem CORS)
// Primário: Yahoo Finance v8 chart (paralelo por ativo)
// Fallback:  brapi.dev
// Cache Vercel: 30 min na edge

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const tickers = ['PETR4','VALE3','ITUB4','WEGE3','BBAS3','SUZB3','B3SA3','PSSA3','VULC3','EGIE3'];

  // ── Tentativa 1: Yahoo Finance v8 (paralelo) ─────────────────────────────
  try {
    const settled = await Promise.allSettled(
      tickers.map(async sym => {
        const r = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${sym}.SA?interval=1d&range=2d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(6000),
          }
        );
        const j = await r.json();
        const meta = j.chart.result[0].meta;
        return {
          symbol: sym,
          price: meta.regularMarketPrice,
          changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
        };
      })
    );

    const quotes = settled.filter(r => r.status === 'fulfilled').map(r => r.value);

    if (quotes.length >= 5) {
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
      return res.json({ quotes, source: 'yahoo', ts: new Date().toISOString() });
    }
  } catch {}

  // ── Tentativa 2: brapi.dev (fallback) ────────────────────────────────────
  try {
    const r = await fetch(`https://brapi.dev/api/quote/${tickers.join(',')}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const json = await r.json();
      const quotes = (json.results ?? []).map(q => ({
        symbol: q.symbol,
        price: q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent,
      }));
      if (quotes.length) {
        res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
        return res.json({ quotes, source: 'brapi', ts: new Date().toISOString() });
      }
    }
  } catch {}

  return res.status(503).json({ error: 'cotações indisponíveis' });
};
