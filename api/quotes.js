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
          `https://query1.finance.yahoo.com/v8/finance/chart/${sym}.SA?interval=1d&range=5d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(6000),
          }
        );
        const j = await r.json();
        const result = j?.chart?.result?.[0];
        if (!result) throw new Error('sem resultado');

        const meta   = result.meta;
        const closes = result.indicators?.quote?.[0]?.close ?? [];

        // Fonte 1: últimos 2 fechamentos do array OHLCV (mais confiável)
        const validCloses = closes.filter(v => v != null);
        let changePercent = 0;
        if (validCloses.length >= 2) {
          const prev = validCloses[validCloses.length - 2];
          const curr = validCloses[validCloses.length - 1];
          if (prev) changePercent = ((curr - prev) / prev) * 100;
        } else {
          // Fonte 2: campos do meta (fallback)
          const prevClose = meta.chartPreviousClose ?? meta.previousClose;
          const currPrice = meta.regularMarketPrice;
          if (prevClose && prevClose !== 0) {
            changePercent = ((currPrice - prevClose) / prevClose) * 100;
          }
        }

        return {
          symbol: sym,
          price:  meta.regularMarketPrice,
          changePercent,
        };
      })
    );

    const quotes = settled.filter(r => r.status === 'fulfilled').map(r => r.value);

    if (quotes.length >= 5) {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
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
        symbol:        q.symbol,
        price:         q.regularMarketPrice,
        changePercent: q.regularMarketChangePercent ?? 0,
      }));
      if (quotes.length) {
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.json({ quotes, source: 'brapi', ts: new Date().toISOString() });
      }
    }
  } catch {}

  return res.status(503).json({ error: 'cotações indisponíveis' });
};
