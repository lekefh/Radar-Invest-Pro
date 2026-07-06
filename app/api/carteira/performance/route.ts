import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

function tipoTicker(ticker: string): 'acao' | 'fii_etf' | 'bdr' | 'opcao' {
  if (/^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(ticker)) return 'opcao'
  if (/11$/.test(ticker) && ticker.length >= 6) return 'fii_etf'
  if (/(34|32|39|33)$/.test(ticker) && ticker.length >= 6) return 'bdr'
  return 'acao'
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

async function fetchCDI(de: string, ate: string): Promise<number | null> {
  try {
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4391/dados?formato=json&dataInicial=${fmtDate(de)}&dataFinal=${fmtDate(ate)}`
    const r = await fetch(url, { next: { revalidate: 3600 } })
    if (!r.ok) return null
    const data = await r.json() as { valor: string }[]
    if (!data.length) return null
    const acum = data.reduce((acc, d) => acc * (1 + parseFloat(d.valor) / 100), 1)
    return (acum - 1) * 100
  } catch {
    return null
  }
}

async function fetchIbov(de: string, ate: string): Promise<number | null> {
  try {
    const deTs  = Math.floor(new Date(de + 'T12:00:00Z').getTime() / 1000)
    const ateTs = Math.floor(new Date(ate + 'T23:59:59Z').getTime() / 1000)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${deTs}&period2=${ateTs}&interval=1d`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } })
    if (!r.ok) return null
    const data = await r.json()
    const closes: number[] = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(Boolean)
    if (closes.length < 2) return null
    return ((closes[closes.length - 1] / closes[0]) - 1) * 100
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(s.sub)
  await ensureCarteiraTables()
  const sql = getDb()

  const { searchParams } = new URL(req.url)
  const hoje = new Date().toISOString().slice(0, 10)
  const de  = searchParams.get('de')  || `${new Date().getFullYear()}-01-01`
  const ate = searchParams.get('ate') || hoje

  const allOps = await sql`
    SELECT data::text, ticker, tipo, quantidade::float, preco::float
    FROM movimentacoes
    WHERE user_id = ${userId}
    ORDER BY data ASC, id ASC
  `

  const posMap       = new Map<string, { qty: number; cost: number }>()
  const realByTicker = new Map<string, { pl: number; vol_vendas: number; vol_compras: number; n_ops: number }>()
  const porMes       = new Map<string, number>()

  let volCompras = 0, volVendas = 0, nCompras = 0, nVendas = 0

  for (const op of allOps as { data: string; ticker: string; tipo: string; quantidade: number; preco: number }[]) {
    const ticker = op.ticker
    const data   = String(op.data).slice(0, 10)
    const qty    = Number(op.quantidade)
    const preco  = Number(op.preco)
    const inPer  = data >= de && data <= ate
    const mes    = data.slice(0, 7)

    if (!posMap.has(ticker)) posMap.set(ticker, { qty: 0, cost: 0 })
    const pos = posMap.get(ticker)!

    if (op.tipo === 'C') {
      pos.qty  += qty
      pos.cost += qty * preco
      if (inPer) {
        volCompras += qty * preco
        nCompras++
        const cur = realByTicker.get(ticker) ?? { pl: 0, vol_vendas: 0, vol_compras: 0, n_ops: 0 }
        cur.vol_compras += qty * preco
        realByTicker.set(ticker, cur)
      }
    } else {
      const avgP = pos.qty > 0.001 ? pos.cost / pos.qty : 0
      const pl   = (preco - avgP) * qty
      if (inPer) {
        const cur = realByTicker.get(ticker) ?? { pl: 0, vol_vendas: 0, vol_compras: 0, n_ops: 0 }
        cur.pl         += pl
        cur.vol_vendas += qty * preco
        cur.n_ops      += 1
        realByTicker.set(ticker, cur)
        porMes.set(mes, (porMes.get(mes) ?? 0) + pl)
        volVendas += qty * preco
        nVendas++
      }
      pos.qty  = Math.max(0, pos.qty - qty)
      pos.cost = Math.max(0, pos.cost - avgP * qty)
    }
  }

  const totalRealizado = Array.from(realByTicker.values()).reduce((s, v) => s + v.pl, 0)

  const porTicker = Array.from(realByTicker.entries())
    .map(([ticker, v]) => ({ ticker, tipo: tipoTicker(ticker), pl: v.pl, vol_vendas: v.vol_vendas, vol_compras: v.vol_compras, n_ops: v.n_ops }))
    .sort((a, b) => b.pl - a.pl)

  // Todos os meses do intervalo (zeros incluídos)
  const mesesRange: { mes: string; pl: number }[] = []
  const cur = new Date(de + 'T12:00:00')
  const fim = new Date(ate + 'T12:00:00')
  cur.setDate(1); fim.setDate(1)
  while (cur <= fim) {
    const k = cur.toISOString().slice(0, 7)
    mesesRange.push({ mes: k, pl: porMes.get(k) ?? 0 })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Benchmark em paralelo
  const [cdi_pct, ibov_pct] = await Promise.all([fetchCDI(de, ate), fetchIbov(de, ate)])

  return NextResponse.json({
    periodo:   { de, ate },
    realizado: { total: totalRealizado, por_ticker: porTicker, por_mes: mesesRange },
    operacoes: { vol_compras: volCompras, vol_vendas: volVendas, n_compras: nCompras, n_vendas: nVendas },
    benchmark: { cdi_pct, ibov_pct },
  })
}
