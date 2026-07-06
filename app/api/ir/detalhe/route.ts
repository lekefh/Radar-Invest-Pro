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
      qtdeAcc += op.quantidade; custoAcc += op.quantidade * op.preco
    }
  }
  return qtdeAcc > 0.001 ? custoAcc / qtdeAcc : 0
}

export interface DetalheOp {
  data: string
  ticker: string
  modalidade: 'acao_swing' | 'opcao_lancador_encerra' | 'opcao_titular_encerra' | 'day_trade'
  descricao: string      // ex: "Lançador encerra — prêmio R$0,92 - recompra R$0,00"
  quantidade: number
  preco_venda: number    // para titular: preço de venda; para lançador: prêmio recebido
  custo_medio: number    // para titular: PM de compra; para lançador: preço de recompra
  lucro: number
  valor_venda: number
}

/**
 * GET /api/ir/detalhe?ano=2026&mes=1
 * Retorna operações individuais que geraram resultado no mês (lógica correta lançador/titular).
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

  const posInisRaw = await sql`
    SELECT ticker, qtde::float, preco_medio::float FROM ir_posicao_inicial WHERE user_id=${userId}
  `
  const posIniMap = new Map<string, PosIni>()
  for (const r of posInisRaw) posIniMap.set(r.ticker, { qtde: Number(r.qtde), preco_medio: Number(r.preco_medio) })

  // Day trade detection
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

  // ── Ações swing ────────────────────────────────────────────────────────────
  for (const op of opsDoMes) {
    if (op.tipo !== 'V' || isOpcao(op.ticker)) continue
    const key = `${op.data}|${op.ticker}`
    const qDayV   = dayQtyMap.get(key) ?? 0
    const jaUsed  = vUsed.get(key) ?? 0
    const qDayEsta = Math.max(0, Math.min(qDayV - jaUsed, op.quantidade))
    vUsed.set(key, jaUsed + qDayEsta)

    if (qDayEsta > 0.001) {
      const d = porDia.get(key)!
      const pmC = d.cVal / d.cQty
      operacoes.push({
        data: op.data, ticker: op.ticker, modalidade: 'day_trade',
        descricao: 'Day trade',
        quantidade: qDayEsta, preco_venda: op.preco, custo_medio: pmC,
        lucro: r2((op.preco - pmC) * qDayEsta),
        valor_venda: r2(op.preco * qDayEsta),
      })
    }

    const qSw = op.quantidade - qDayEsta
    if (qSw > 0.001) {
      const pm = custoMedioAte(op.ticker, op.data, anoMes, todasOps, posIniMap.get(op.ticker) ?? null)
      operacoes.push({
        data: op.data, ticker: op.ticker, modalidade: 'acao_swing',
        descricao: pm === 0 ? 'Ação SW — ⚠ custo médio zero (sem compra anterior)' : 'Ação SW',
        quantidade: qSw, preco_venda: op.preco, custo_medio: pm,
        lucro: r2((op.preco - pm) * qSw),
        valor_venda: r2(op.preco * qSw),
      })
    }
  }

  // ── Opções — lógica correta lançador/titular ───────────────────────────────
  const opcaoTickers = new Set(opsDoMes.filter(o => isOpcao(o.ticker)).map(o => o.ticker))

  for (const ticker of opcaoTickers) {
    const ini = posIniMap.get(ticker) ?? null
    let qtde = ini?.qtde ?? 0
    let premioLancado = 0, qtdeLancada = 0
    let custoComprado = 0, qtdeComprado = 0

    if (qtde < 0) {
      qtdeLancada = Math.abs(qtde); premioLancado = qtdeLancada * (ini?.preco_medio ?? 0)
    } else if (qtde > 0) {
      qtdeComprado = qtde; custoComprado = qtde * (ini?.preco_medio ?? 0)
    }

    for (const op of todasOps.filter(o => o.ticker === ticker)) {
      const isCurrent = op.data.slice(0, 7) === anoMes

      if (op.tipo === 'C') {
        if (qtde < 0) {
          // Lançador encerrando
          const qClose = Math.min(op.quantidade, Math.abs(qtde))
          const pmV = qtdeLancada > 0 ? premioLancado / qtdeLancada : 0
          if (isCurrent) {
            const lucro = r2((pmV - op.preco) * qClose)
            const encDsc = op.preco === 0 ? 'Virou pó (expirou)' : `Recompra a ${fBRL(op.preco)}`
            operacoes.push({
              data: op.data, ticker, modalidade: 'opcao_lancador_encerra',
              descricao: `Lançador encerra — prêmio médio ${fBRL(pmV)} · ${encDsc}`,
              quantidade: qClose, preco_venda: pmV, custo_medio: op.preco,
              lucro, valor_venda: r2(pmV * qClose),
            })
          }
          qtde += qClose; qtdeLancada = Math.max(0, qtdeLancada - qClose); premioLancado = Math.max(0, premioLancado - pmV * qClose)
          const qRemain = op.quantidade - qClose
          if (qRemain > 0.001) { qtde += qRemain; custoComprado += qRemain * op.preco; qtdeComprado += qRemain }
        } else {
          qtde += op.quantidade; custoComprado += op.quantidade * op.preco; qtdeComprado += op.quantidade
        }
      } else { // V
        if (qtde > 0) {
          // Titular encerrando
          const qClose = Math.min(op.quantidade, qtde)
          const pmC = qtdeComprado > 0 ? custoComprado / qtdeComprado : 0
          if (isCurrent) {
            operacoes.push({
              data: op.data, ticker, modalidade: 'opcao_titular_encerra',
              descricao: pmC === 0 ? `Titular encerra — ⚠ custo médio zero` : `Titular encerra — PM compra ${fBRL(pmC)}`,
              quantidade: qClose, preco_venda: op.preco, custo_medio: pmC,
              lucro: r2((op.preco - pmC) * qClose),
              valor_venda: r2(op.preco * qClose),
            })
          }
          qtde -= qClose; qtdeComprado = Math.max(0, qtdeComprado - qClose); custoComprado = Math.max(0, custoComprado - pmC * qClose)
          const qRemain = op.quantidade - qClose
          if (qRemain > 0.001) { qtde -= qRemain; premioLancado += qRemain * op.preco; qtdeLancada += qRemain }
        } else {
          // Lançamento — não é evento tributável aqui, será tributado ao fechar
          qtde -= op.quantidade; premioLancado += op.quantidade * op.preco; qtdeLancada += op.quantidade
        }
      }
    }
  }

  operacoes.sort((a, b) => a.data.localeCompare(b.data) || a.ticker.localeCompare(b.ticker))

  const custoZeros = operacoes.filter(o => o.custo_medio === 0 && o.lucro > 0 && o.modalidade === 'acao_swing')
  const temLancamentos = opsDoMes.some(o => isOpcao(o.ticker) && o.tipo === 'V')

  let alerta: string | null = null
  if (custoZeros.length > 0) {
    const tickers = [...new Set(custoZeros.map(o => o.ticker))].join(', ')
    alerta = `Custo médio zero para: ${tickers}. Cadastre na aba "Posição Inicial" o preço médio de compra para corrigir o cálculo.`
  }

  return NextResponse.json({
    anoMes,
    operacoes,
    totalOpsDoMes: opsDoMes.length,
    posIniCadastrada: posIniMap.size > 0,
    temLancamentosNaoTributados: temLancamentos,
    alerta,
  })
}

function r2(v: number) { return Math.round(v * 100) / 100 }
function fBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
