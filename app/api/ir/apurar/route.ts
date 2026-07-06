import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureIRTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function uid(): Promise<number | null> {
  const s = await getSession(); return s ? Number(s.sub) : null
}

const ALIQ_SWING      = 0.15
const ALIQ_DAY        = 0.20
const ISENCAO_SWING   = 20000
const IRRF_SWING_PCT  = 0.00005
const IRRF_DAY_PCT    = 0.01
const MIN_DARF        = 10

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
  nota_num?: string
}
interface PosIni { qtde: number; preco_medio: number }

/**
 * Calcula custo médio de um ticker até uma data de referência.
 * posIni = base de custo inicial (ir_posicao_inicial tem prioridade, depois posicao_base_itens).
 * dataBaseFilter = quando posIni vem da posicao_base_itens, ignora movimentacoes
 *   com data <= data_base para evitar dupla contagem.
 */
function custoMedioAte(
  ticker: string, dataRef: string, anoMes: string,
  todasOps: Op[], posIni: PosIni | null, dataBaseFilter?: string
): number {
  let qtdeAcc = posIni?.qtde ?? 0
  let custoAcc = (posIni?.qtde ?? 0) * (posIni?.preco_medio ?? 0)

  for (const op of todasOps) {
    if (op.ticker !== ticker || op.tipo !== 'C') continue
    // Se posIni vem da posicao_base_itens, pula ops na data_base ou antes (já estão no posIni)
    if (dataBaseFilter && op.data <= dataBaseFilter) continue
    const mes = op.data.slice(0, 7)
    if (mes < anoMes || (mes === anoMes && op.data < dataRef)) {
      qtdeAcc  += op.quantidade
      custoAcc += op.quantidade * op.preco
    }
  }
  return qtdeAcc > 0.001 ? custoAcc / qtdeAcc : 0
}

/**
 * Calcula lucro de opções para o mês (lógica correta lançador/titular).
 * posIni e dataBaseFilter seguem a mesma lógica do custoMedioAte.
 */
function lucroOpcoesMes(
  ticker: string, anoMes: string,
  todasOps: Op[], posIni: PosIni | null, dataBaseFilter?: string
): number {
  let qtde = posIni?.qtde ?? 0
  let premioLancado = 0, qtdeLancada = 0
  let custoComprado = 0, qtdeComprado = 0

  if (qtde < 0) {
    qtdeLancada = Math.abs(qtde); premioLancado = qtdeLancada * (posIni?.preco_medio ?? 0)
  } else if (qtde > 0) {
    qtdeComprado = qtde; custoComprado = qtde * (posIni?.preco_medio ?? 0)
  }

  let lucro = 0
  const opsDoTicker = todasOps.filter(o => o.ticker === ticker)

  for (const op of opsDoTicker) {
    if (dataBaseFilter && op.data <= dataBaseFilter) continue
    const isCurrent = op.data.slice(0, 7) === anoMes

    if (op.tipo === 'C') {
      if (qtde < 0) {
        const qClose = Math.min(op.quantidade, Math.abs(qtde))
        const pmV = qtdeLancada > 0 ? premioLancado / qtdeLancada : 0
        if (isCurrent) lucro += (pmV - op.preco) * qClose
        qtde += qClose; qtdeLancada = Math.max(0, qtdeLancada - qClose); premioLancado = Math.max(0, premioLancado - pmV * qClose)
        const qRemain = op.quantidade - qClose
        if (qRemain > 0.001) { qtde += qRemain; custoComprado += qRemain * op.preco; qtdeComprado += qRemain }
      } else {
        qtde += op.quantidade; custoComprado += op.quantidade * op.preco; qtdeComprado += op.quantidade
      }
    } else {
      if (qtde > 0) {
        const qClose = Math.min(op.quantidade, qtde)
        const pmC = qtdeComprado > 0 ? custoComprado / qtdeComprado : 0
        if (isCurrent) lucro += (op.preco - pmC) * qClose
        qtde -= qClose; qtdeComprado = Math.max(0, qtdeComprado - qClose); custoComprado = Math.max(0, custoComprado - pmC * qClose)
        const qRemain = op.quantidade - qClose
        if (qRemain > 0.001) { qtde -= qRemain; premioLancado += qRemain * op.preco; qtdeLancada += qRemain }
      } else {
        qtde -= op.quantidade; premioLancado += op.quantidade * op.preco; qtdeLancada += op.quantidade
      }
    }
  }
  return lucro
}

export async function POST(req: NextRequest) {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { ano, mes } = await req.json()
  if (!ano || !mes) return NextResponse.json({ error: 'Informe ano e mes' }, { status: 400 })

  const sql = getDb()
  await ensureIRTables()

  const anoMes = `${String(ano).padStart(4,'0')}-${String(mes).padStart(2,'0')}`

  const todasOpsRaw = await sql`
    SELECT data::text, ticker, tipo, quantidade::float, preco::float, valor_total::float, nota_num
    FROM movimentacoes WHERE user_id = ${userId} ORDER BY data ASC, id ASC
  `
  const todasOps: Op[] = (todasOpsRaw as unknown as (Op & { nota_num?: string })[])
    .filter(r => !isFuturo(r.ticker))
    .map(r => ({ ...r, data: String(r.data).slice(0,10) }))

  const opsDoMes = todasOps.filter(op => op.data.slice(0, 7) === anoMes)

  // ── Fontes de custo inicial ────────────────────────────────────────────────
  // Prioridade: ir_posicao_inicial > posicao_base_itens
  const [posInisRaw, posBaseItensRaw, posBaseRow] = await Promise.all([
    sql`SELECT ticker, qtde::float, preco_medio::float FROM ir_posicao_inicial WHERE user_id=${userId}`,
    sql`SELECT ticker, quantidade::float, preco_medio::float FROM posicao_base_itens WHERE user_id=${userId}`,
    sql`SELECT data_base::text FROM posicao_base WHERE user_id=${userId} LIMIT 1`,
  ])

  const posIniMap = new Map<string, PosIni>()
  for (const r of posInisRaw) posIniMap.set(r.ticker, { qtde: Number(r.qtde), preco_medio: Number(r.preco_medio) })

  const posBaseMap = new Map<string, PosIni>()
  for (const r of posBaseItensRaw) posBaseMap.set(r.ticker, { qtde: Number(r.quantidade), preco_medio: Number(r.preco_medio) })

  // data_base: movimentacoes nesta data ou antes são parte da posição base, não contam como compra nova
  const dataBase: string = posBaseRow[0]?.data_base ? String(posBaseRow[0].data_base).slice(0,10) : ''

  // Resolve posIni e dataBaseFilter para um ticker
  function resolveBase(ticker: string): { posIni: PosIni | null; dbFilter?: string } {
    const fromIR = posIniMap.get(ticker)
    if (fromIR) return { posIni: fromIR }                       // ir_posicao_inicial tem precedência, sem filtro
    const fromBase = posBaseMap.get(ticker)
    if (fromBase) return { posIni: fromBase, dbFilter: dataBase } // posicao_base_itens com filtro de data
    return { posIni: null }
  }

  const prejRows = await sql`SELECT modalidade, valor::float FROM ir_prejuizo_acumulado WHERE user_id=${userId}`
  let prejSwing = 0, prejDay = 0
  for (const r of prejRows) {
    if (r.modalidade === 'swing') prejSwing = Number(r.valor)
    else if (r.modalidade === 'day') prejDay = Number(r.valor)
  }

  // ── Day trade ─────────────────────────────────────────────────────────────
  type DayEntry = { cQty: number; cVal: number; vQty: number; vVal: number }
  const porDia = new Map<string, DayEntry>()
  for (const op of opsDoMes) {
    if (isOpcao(op.ticker)) continue
    if (op.nota_num === 'exercicio') continue   // exercício de opção não conta como day trade
    const key = `${op.data}|${op.ticker}`
    if (!porDia.has(key)) porDia.set(key, { cQty: 0, cVal: 0, vQty: 0, vVal: 0 })
    const d = porDia.get(key)!
    if (op.tipo === 'C') { d.cQty += op.quantidade; d.cVal += op.quantidade * op.preco }
    else                  { d.vQty += op.quantidade; d.vVal += op.quantidade * op.preco }
  }
  const dayQtyMap = new Map<string, number>()
  const dayResultMap = new Map<string, number>()
  const irrfMap = new Map<string, number>()
  for (const [key, d] of porDia) {
    if (d.cQty > 0 && d.vQty > 0) {
      const qDay = Math.min(d.cQty, d.vQty)
      const pmC = d.cVal / d.cQty; const pmV = d.vVal / d.vQty
      dayQtyMap.set(key, qDay)
      dayResultMap.set(key, (pmV - pmC) * qDay)
      irrfMap.set(key, pmV * qDay * IRRF_DAY_PCT)
    }
  }
  const lucroDay = [...dayResultMap.values()].reduce((s, v) => s + v, 0)
  const irrf     = [...irrfMap.values()].reduce((s, v) => s + v, 0)

  // ── Ações swing ───────────────────────────────────────────────────────────
  let lucroAcaoSw = 0, vendasAcaoSw = 0, irrfSwing = 0
  const vUsed = new Map<string, number>()
  for (const op of opsDoMes) {
    if (op.tipo !== 'V' || isOpcao(op.ticker)) continue
    const key = `${op.data}|${op.ticker}`
    const qDayV = dayQtyMap.get(key) ?? 0
    const jaUsed = vUsed.get(key) ?? 0
    const qDayEsta = Math.max(0, Math.min(qDayV - jaUsed, op.quantidade))
    vUsed.set(key, jaUsed + qDayEsta)
    const qSw = op.quantidade - qDayEsta
    if (qSw > 0.001) {
      const { posIni, dbFilter } = resolveBase(op.ticker)
      const pm = custoMedioAte(op.ticker, op.data, anoMes, todasOps, posIni, dbFilter)
      const valorVendaSw = op.preco * qSw
      lucroAcaoSw  += (op.preco - pm) * qSw
      vendasAcaoSw += valorVendaSw
      irrfSwing    += valorVendaSw * IRRF_SWING_PCT
    }
  }

  // ── Opções swing ──────────────────────────────────────────────────────────
  const opcaoTickersMes = new Set(opsDoMes.filter(o => isOpcao(o.ticker)).map(o => o.ticker))
  let lucroOpcaoSw = 0
  for (const ticker of opcaoTickersMes) {
    const { posIni, dbFilter } = resolveBase(ticker)
    lucroOpcaoSw += lucroOpcoesMes(ticker, anoMes, todasOps, posIni, dbFilter)
  }

  // ── Isenção R$20k ─────────────────────────────────────────────────────────
  const isento = vendasAcaoSw <= ISENCAO_SWING && lucroAcaoSw > 0

  // ── IR swing ──────────────────────────────────────────────────────────────
  const lucroSwTotal = lucroAcaoSw + lucroOpcaoSw
  let irSwing = 0
  if (lucroSwTotal > 0) {
    const base = Math.max(0, lucroSwTotal - prejSwing)
    prejSwing  = Math.max(0, prejSwing - lucroSwTotal)
    irSwing    = isento ? Math.max(0, lucroOpcaoSw) * ALIQ_SWING : base * ALIQ_SWING
  } else {
    prejSwing += Math.abs(lucroSwTotal)
  }

  // ── IR day ────────────────────────────────────────────────────────────────
  let irDay = 0
  if (lucroDay > 0) {
    const base = Math.max(0, lucroDay - prejDay)
    prejDay    = Math.max(0, prejDay - lucroDay)
    irDay      = base * ALIQ_DAY
  } else {
    prejDay += Math.abs(lucroDay)
  }

  const irDevidoDay      = Math.max(0, irDay - irrf)
  const irDevidoSwBruto  = Math.max(0, irSwing - irrfSwing)
  const irDevidoSwing    = irDevidoSwBruto  >= MIN_DARF ? irDevidoSwBruto  : 0
  const irDevidoDayFinal = irDevidoDay      >= MIN_DARF ? irDevidoDay      : 0

  await sql`ALTER TABLE ir_apuracao_mensal ADD COLUMN IF NOT EXISTS irrf_swing NUMERIC DEFAULT 0`
  await sql`
    INSERT INTO ir_apuracao_mensal
      (user_id, ano_mes, vendas_acao_sw, lucro_acao_sw, lucro_opcao_sw, lucro_day,
       isento_swing, prej_swing_ac, prej_day_ac, ir_swing, ir_day, irrf_swing, irrf_day,
       ir_devido_swing, ir_devido_day, calculado_em)
    VALUES
      (${userId}, ${anoMes}, ${r(vendasAcaoSw)}, ${r(lucroAcaoSw)}, ${r(lucroOpcaoSw)},
       ${r(lucroDay)}, ${isento}, ${r(prejSwing)}, ${r(prejDay)},
       ${r(irSwing)}, ${r(irDay)}, ${r(irrfSwing)}, ${r(irrf)},
       ${r(irDevidoSwing)}, ${r(irDevidoDayFinal)}, NOW())
    ON CONFLICT (user_id, ano_mes) DO UPDATE SET
      vendas_acao_sw=${r(vendasAcaoSw)}, lucro_acao_sw=${r(lucroAcaoSw)},
      lucro_opcao_sw=${r(lucroOpcaoSw)}, lucro_day=${r(lucroDay)},
      isento_swing=${isento}, prej_swing_ac=${r(prejSwing)}, prej_day_ac=${r(prejDay)},
      ir_swing=${r(irSwing)}, ir_day=${r(irDay)},
      irrf_swing=${r(irrfSwing)}, irrf_day=${r(irrf)},
      ir_devido_swing=${r(irDevidoSwing)}, ir_devido_day=${r(irDevidoDayFinal)},
      calculado_em=NOW()
  `

  for (const [mod, val] of [['swing', prejSwing], ['day', prejDay]] as [string, number][]) {
    await sql`
      INSERT INTO ir_prejuizo_acumulado (user_id, modalidade, valor)
      VALUES (${userId}, ${mod}, ${val})
      ON CONFLICT (user_id, modalidade) DO UPDATE SET valor=${val}, atualizado_em=NOW()
    `
  }

  return NextResponse.json({
    ano_mes: anoMes, vendas_acao_sw: r(vendasAcaoSw), lucro_acao_sw: r(lucroAcaoSw),
    lucro_opcao_sw: r(lucroOpcaoSw), lucro_day: r(lucroDay),
    isento_swing: isento, prej_swing_ac: r(prejSwing), prej_day_ac: r(prejDay),
    ir_swing: r(irSwing), ir_day: r(irDay), irrf_day: r(irrf),
    ir_devido_swing: r(irDevidoSwing), ir_devido_day: r(irDevidoDayFinal),
    totalOpsDoMes: opsDoMes.length,
  })
}

function r(v: number) { return Math.round(v * 100) / 100 }
