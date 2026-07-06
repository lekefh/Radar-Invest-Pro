import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

function tipoTicker(ticker: string): 'acao' | 'fii_etf' | 'bdr' | 'opcao' {
  if (/^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(ticker)) return 'opcao'
  if (/11$/.test(ticker) && ticker.length >= 6) return 'fii_etf'
  if (/(34|32|39|33)$/.test(ticker) && ticker.length >= 6) return 'bdr'
  return 'acao'
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

  // Todas as operações em ordem cronológica para cálculo de custo médio ponderado
  const allOps = await sql`
    SELECT data::text, ticker, tipo, quantidade::float, preco::float, valor_total::float
    FROM movimentacoes
    WHERE user_id = ${userId}
    ORDER BY data ASC, id ASC
  `

  // Custo médio ponderado — rastreia posição e calcula PL realizado em cada venda
  const posMap = new Map<string, { qty: number; cost: number }>()
  const realByTicker = new Map<string, { pl: number; vol_vendas: number; n_ops: number; vol_compras: number; n_compras: number }>()

  let volComprasPeriodo = 0, volVendasPeriodo = 0, nCompras = 0, nVendas = 0

  for (const op of allOps as {
    data: string; ticker: string; tipo: string
    quantidade: number; preco: number; valor_total: number
  }[]) {
    const ticker = op.ticker
    const data   = String(op.data).slice(0, 10)
    const qty    = Number(op.quantidade)
    const preco  = Number(op.preco)
    const inPer  = data >= de && data <= ate

    if (!posMap.has(ticker)) posMap.set(ticker, { qty: 0, cost: 0 })
    const pos = posMap.get(ticker)!

    if (op.tipo === 'C') {
      pos.qty  += qty
      pos.cost += qty * preco
      if (inPer) {
        volComprasPeriodo += qty * preco
        nCompras++
        const cur = realByTicker.get(ticker) ?? { pl: 0, vol_vendas: 0, n_ops: 0, vol_compras: 0, n_compras: 0 }
        cur.vol_compras += qty * preco
        cur.n_compras   += 1
        realByTicker.set(ticker, cur)
      }
    } else {
      const avgP = pos.qty > 0.001 ? pos.cost / pos.qty : 0
      const pl   = (preco - avgP) * qty
      if (inPer) {
        const cur = realByTicker.get(ticker) ?? { pl: 0, vol_vendas: 0, n_ops: 0, vol_compras: 0, n_compras: 0 }
        cur.pl         += pl
        cur.vol_vendas += qty * preco
        cur.n_ops      += 1
        realByTicker.set(ticker, cur)
        volVendasPeriodo += qty * preco
        nVendas++
      }
      pos.qty  = Math.max(0, pos.qty - qty)
      pos.cost = Math.max(0, pos.cost - avgP * qty)
    }
  }

  const totalRealizado = Array.from(realByTicker.values()).reduce((s, v) => s + v.pl, 0)

  const porTicker = Array.from(realByTicker.entries())
    .map(([ticker, v]) => ({
      ticker,
      tipo: tipoTicker(ticker),
      pl: v.pl,
      vol_vendas: v.vol_vendas,
      vol_compras: v.vol_compras,
      n_ops: v.n_ops + v.n_compras,
    }))
    .sort((a, b) => b.pl - a.pl)

  return NextResponse.json({
    periodo: { de, ate },
    realizado: {
      total: totalRealizado,
      por_ticker: porTicker,
    },
    operacoes: {
      vol_compras: volComprasPeriodo,
      vol_vendas:  volVendasPeriodo,
      n_compras:   nCompras,
      n_vendas:    nVendas,
    },
  })
}
