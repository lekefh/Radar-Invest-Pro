import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureIRTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function uid(): Promise<number | null> {
  const s = await getSession(); return s ? Number(s.sub) : null
}

const PREFIXOS_FUTUROS = ['WIN','WDO','DOL','IND','BGI','DI1','DAP','FRC','ISP','CNI','EUR','GBP','JPY','OZ1']
function isFuturo(ticker: string): boolean {
  const t = ticker.toUpperCase().replace(/F$/, '')
  if (PREFIXOS_FUTUROS.some(p => t.startsWith(p))) return true
  return /^[A-Z]{2,4}[FGHJKMNQUVXZ]\d{2}$/.test(t)
}
function isOpcao(ticker: string): boolean {
  return /^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(ticker)
}

interface Op {
  data: string; ticker: string; tipo: string
  quantidade: number; preco: number; valor_total: number
}
interface PosIni { qtde: number; preco_medio: number }

function custoMedioAte(
  ticker: string, dataRef: string, anoMes: string,
  todasOps: Op[], posIni: PosIni | null
): number {
  let qtdeAcc = posIni?.qtde ?? 0
  let custoAcc = (posIni?.qtde ?? 0) * (posIni?.preco_medio ?? 0)
  for (const op of todasOps) {
    if (op.ticker !== ticker || op.tipo !== 'C') continue
    const mes = op.data.slice(0, 7)
    if (mes < anoMes || (mes === anoMes && op.data < dataRef)) {
      qtdeAcc  += op.quantidade
      custoAcc += op.quantidade * op.preco
    }
  }
  return qtdeAcc > 0.001 ? custoAcc / qtdeAcc : 0
}

export interface DetalheOp {
  data: string
  ticker: string
  modalidade: 'acao_swing' | 'opcao_swing' | 'day_trade'
  quantidade: number
  preco_venda: number
  custo_medio: number
  lucro: number
  valor_venda: number
}

/**
 * GET /api/ir/detalhe?ano=2026&mes=1
 * Retorna as operações individuais de venda que compõem a apuração do mês.
 */
export async function GET(req: NextRequest) {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ano = Number(searchParams.get('ano'))
  const mes = Number(searchParams.get('mes'))
  if (!ano || !mes) return NextResponse.json({ error: 'Informe ano e mes' }, { status: 400 })

  const sql = getDb()
  await ensureIRTables()

  const anoMes = `${String(ano).padStart(4,'0')}-${String(mes).padStart(2,'0')}`

  // Todas as movimentações (necessário para custo médio histórico)
  const todasOpsRaw = await sql`
    SELECT data::text, ticker, tipo, quantidade::float, preco::float, valor_total::float
    FROM movimentacoes
    WHERE user_id = ${userId}
    ORDER BY data ASC, id ASC
  `
  const todasOps: Op[] = (todasOpsRaw as unknown as Op[])
    .filter(r => !isFuturo(r.ticker))
    .map(r => ({ ...r, data: String(r.data).slice(0,10) }))

  const opsDoMes = todasOps.filter(op => op.data.slice(0, 7) === anoMes)

  // Posições iniciais
  const posInisRaw = await sql`
    SELECT ticker, qtde::float, preco_medio::float FROM ir_posicao_inicial WHERE user_id=${userId}
  `
  const posIniMap = new Map<string, PosIni>()
  for (const r of posInisRaw) posIniMap.set(r.ticker, { qtde: Number(r.qtde), preco_medio: Number(r.preco_medio) })

  // Day trade detection: mesmo ticker, mesmo dia, C + V
  type DayEntry = { cQty: number; cVal: number; vQty: number; vVal: number }
  const porDia = new Map<string, DayEntry>()
  for (const op of opsDoMes) {
    if (isOpcao(op.ticker)) continue
    const key = `${op.data}|${op.ticker}`
    if (!porDia.has(key)) porDia.set(key, { cQty: 0, cVal: 0, vQty: 0, vVal: 0 })
    const d = porDia.get(key)!
    if (op.tipo === 'C') { d.cQty += op.quantidade; d.cVal += op.quantidade * op.preco }
    else                  { d.vQty += op.quantidade; d.vVal += op.quantidade * op.preco }
  }

  const dayQtyMap = new Map<string, number>()
  for (const [key, d] of porDia) {
    if (d.cQty > 0 && d.vQty > 0) dayQtyMap.set(key, Math.min(d.cQty, d.vQty))
  }

  const operacoes: DetalheOp[] = []
  const vUsed = new Map<string, number>()

  for (const op of opsDoMes) {
    if (op.tipo !== 'V') continue

    if (isOpcao(op.ticker)) {
      const pm = custoMedioAte(op.ticker, op.data, anoMes, todasOps, posIniMap.get(op.ticker) ?? null)
      operacoes.push({
        data: op.data, ticker: op.ticker, modalidade: 'opcao_swing',
        quantidade: op.quantidade, preco_venda: op.preco, custo_medio: pm,
        lucro: Math.round((op.preco - pm) * op.quantidade * 100) / 100,
        valor_venda: Math.round(op.preco * op.quantidade * 100) / 100,
      })
    } else {
      const key = `${op.data}|${op.ticker}`
      const qDayV  = dayQtyMap.get(key) ?? 0
      const jaUsed = vUsed.get(key) ?? 0
      const qDayEsta = Math.max(0, Math.min(qDayV - jaUsed, op.quantidade))
      vUsed.set(key, jaUsed + qDayEsta)

      // Parte day trade
      if (qDayEsta > 0.001) {
        const porDiaEntry = porDia.get(key)!
        const pmC = porDiaEntry.cVal / porDiaEntry.cQty
        operacoes.push({
          data: op.data, ticker: op.ticker, modalidade: 'day_trade',
          quantidade: qDayEsta, preco_venda: op.preco, custo_medio: pmC,
          lucro: Math.round((op.preco - pmC) * qDayEsta * 100) / 100,
          valor_venda: Math.round(op.preco * qDayEsta * 100) / 100,
        })
      }

      // Parte swing
      const qSw = op.quantidade - qDayEsta
      if (qSw > 0.001) {
        const pm = custoMedioAte(op.ticker, op.data, anoMes, todasOps, posIniMap.get(op.ticker) ?? null)
        operacoes.push({
          data: op.data, ticker: op.ticker, modalidade: 'acao_swing',
          quantidade: qSw, preco_venda: op.preco, custo_medio: pm,
          lucro: Math.round((op.preco - pm) * qSw * 100) / 100,
          valor_venda: Math.round(op.preco * qSw * 100) / 100,
        })
      }
    }
  }

  // Ordenar por data + ticker
  operacoes.sort((a, b) => a.data.localeCompare(b.data) || a.ticker.localeCompare(b.ticker))

  const temPosIni = posIniMap.size > 0

  return NextResponse.json({
    anoMes,
    operacoes,
    totalOps: opsDoMes.length,
    posIniCadastrada: temPosIni,
    alerta: !temPosIni && operacoes.some(o => o.custo_medio === 0 && o.lucro > 0)
      ? 'Atenção: custo médio zero em algumas operações — a posição inicial (ir_posicao_inicial) está vazia. Cadastre o preço médio de compra para cada ativo na aba "Posição Inicial".'
      : null,
  })
}
