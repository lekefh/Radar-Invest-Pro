import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureIRTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function uid(): Promise<number | null> {
  const s = await getSession(); return s ? Number(s.sub) : null
}

// ── Constantes fiscais ────────────────────────────────────────────────────────
const ALIQ_SWING      = 0.15
const ALIQ_DAY        = 0.20
const ISENCAO_SWING   = 20000
const IRRF_SWING_PCT  = 0.00005   // 0,005% sobre valor bruto das vendas (dedo-duro)
const IRRF_DAY_PCT    = 0.01      // 1% sobre resultado líquido positivo
const MIN_DARF        = 10

const PREFIXOS_FUTUROS = ['WIN','WDO','DOL','IND','BGI','DI1','DAP','FRC','ISP','CNI','EUR','GBP','JPY','OZ1']

function isFuturo(ticker: string): boolean {
  const t = ticker.toUpperCase().replace(/F$/, '')
  if (PREFIXOS_FUTUROS.some(p => t.startsWith(p))) return true
  return /^[A-Z]{2,4}[FGHJKMNQUVXZ]\d{2}$/.test(t)
}

function isOpcao(ticker: string): boolean {
  // Ex: PETRH280, BBASH260 — 4 letras + 1 letra de série + dígitos
  return /^[A-Z]{4}[A-Z]\d+$/.test(ticker)
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

/**
 * POST /api/ir/apurar
 * Body: { ano: number, mes: number }
 * Retorna o resultado calculado e salva em ir_apuracao_mensal.
 */
export async function POST(req: NextRequest) {
  const userId = await uid()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { ano, mes } = await req.json()
  if (!ano || !mes) return NextResponse.json({ error: 'Informe ano e mes' }, { status: 400 })

  const sql = getDb()
  await ensureIRTables()

  const anoMes = `${String(ano).padStart(4,'0')}-${String(mes).padStart(2,'0')}`

  // ── Busca TODAS as movimentações do usuário (para custo médio histórico) ──
  const todasOpsRaw = await sql`
    SELECT data::text, ticker, tipo, quantidade::float, preco::float, valor_total::float
    FROM movimentacoes
    WHERE user_id = ${userId}
    ORDER BY data ASC, id ASC
  `
  const todasOps: Op[] = (todasOpsRaw as unknown as Op[])
    .filter(r => !isFuturo(r.ticker))
    .map(r => ({ ...r, data: String(r.data).slice(0,10) }))

  // Ops do mês corrente
  const opsDoMes = todasOps.filter(op => op.data.slice(0, 7) === anoMes)

  // ── Posições iniciais ──────────────────────────────────────────────────────
  const posInisRaw = await sql`
    SELECT ticker, qtde::float, preco_medio::float FROM ir_posicao_inicial WHERE user_id=${userId}
  `
  const posIniMap = new Map<string, PosIni>()
  for (const r of posInisRaw) posIniMap.set(r.ticker, { qtde: Number(r.qtde), preco_medio: Number(r.preco_medio) })

  // ── Saldo de prejuízo anterior ────────────────────────────────────────────
  const prejRows = await sql`
    SELECT modalidade, valor::float FROM ir_prejuizo_acumulado WHERE user_id=${userId}
  `
  let prejSwing = 0, prejDay = 0
  for (const r of prejRows) {
    if (r.modalidade === 'swing') prejSwing = Number(r.valor)
    else if (r.modalidade === 'day') prejDay = Number(r.valor)
  }

  // ── Day trade detection: mesmo ticker, mesmo dia, C + V ───────────────────
  type DayEntry = { cQty: number; cVal: number; vQty: number; vVal: number }
  const porDia = new Map<string, DayEntry>()

  for (const op of opsDoMes) {
    if (isOpcao(op.ticker)) continue // opcoes não têm day trade para fins de IR
    const key = `${op.data}|${op.ticker}`
    if (!porDia.has(key)) porDia.set(key, { cQty: 0, cVal: 0, vQty: 0, vVal: 0 })
    const d = porDia.get(key)!
    if (op.tipo === 'C') { d.cQty += op.quantidade; d.cVal += op.quantidade * op.preco }
    else                  { d.vQty += op.quantidade; d.vVal += op.quantidade * op.preco }
  }

  const dayQtyMap    = new Map<string, number>()
  const dayResultMap = new Map<string, number>()
  const irrfMap      = new Map<string, number>()

  for (const [key, d] of porDia) {
    if (d.cQty > 0 && d.vQty > 0) {
      const qDay = Math.min(d.cQty, d.vQty)
      const pmC  = d.cVal / d.cQty
      const pmV  = d.vVal / d.vQty
      dayQtyMap.set(key, qDay)
      dayResultMap.set(key, (pmV - pmC) * qDay)
      irrfMap.set(key, pmV * qDay * IRRF_DAY_PCT)
    }
  }

  const lucroDay = [...dayResultMap.values()].reduce((s, v) => s + v, 0)
  const irrf     = [...irrfMap.values()].reduce((s, v) => s + v, 0)

  // ── Swing trade ───────────────────────────────────────────────────────────
  let lucroAcaoSw   = 0
  let lucroOpcaoSw  = 0
  let vendasAcaoSw  = 0
  let irrfSwing     = 0           // dedo-duro: 0,005% sobre valor bruto das vendas
  const vUsed = new Map<string, number>()

  for (const op of opsDoMes) {
    if (op.tipo !== 'V') continue

    if (isOpcao(op.ticker)) {
      const pm = custoMedioAte(op.ticker, op.data, anoMes, todasOps, posIniMap.get(op.ticker) ?? null)
      lucroOpcaoSw += (op.preco - pm) * op.quantidade
    } else {
      const key = `${op.data}|${op.ticker}`
      const qDayV  = dayQtyMap.get(key) ?? 0
      const jaUsed = vUsed.get(key) ?? 0
      const qDayEsta = Math.max(0, Math.min(qDayV - jaUsed, op.quantidade))
      vUsed.set(key, jaUsed + qDayEsta)

      const qSw = op.quantidade - qDayEsta
      if (qSw > 0.001) {
        const pm = custoMedioAte(op.ticker, op.data, anoMes, todasOps, posIniMap.get(op.ticker) ?? null)
        const valorVendaSw = op.preco * qSw
        lucroAcaoSw  += (op.preco - pm) * qSw
        vendasAcaoSw += valorVendaSw
        irrfSwing    += valorVendaSw * IRRF_SWING_PCT
      }
    }
  }

  // ── Isenção R$20k ─────────────────────────────────────────────────────────
  const isento = vendasAcaoSw <= ISENCAO_SWING && lucroAcaoSw > 0

  // ── IR swing ──────────────────────────────────────────────────────────────
  const lucroSwTotal = lucroAcaoSw + lucroOpcaoSw
  let irSwing = 0
  if (lucroSwTotal > 0) {
    const base = Math.max(0, lucroSwTotal - prejSwing)
    prejSwing  = Math.max(0, prejSwing - lucroSwTotal)
    if (isento) {
      irSwing = Math.max(0, lucroOpcaoSw) * ALIQ_SWING
    } else {
      irSwing = base * ALIQ_SWING
    }
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
  const irDevidoSwingBruto = Math.max(0, irSwing - irrfSwing)
  const irDevidoSwing    = irDevidoSwingBruto >= MIN_DARF ? irDevidoSwingBruto : 0
  const irDevidoDayFinal = irDevidoDay        >= MIN_DARF ? irDevidoDay        : 0

  // ── Salva resultado ───────────────────────────────────────────────────────
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

  // Atualiza saldo de prejuízo acumulado
  for (const [mod, val] of [['swing', prejSwing], ['day', prejDay]] as [string, number][]) {
    await sql`
      INSERT INTO ir_prejuizo_acumulado (user_id, modalidade, valor)
      VALUES (${userId}, ${mod}, ${val})
      ON CONFLICT (user_id, modalidade) DO UPDATE SET valor=${val}, atualizado_em=NOW()
    `
  }

  return NextResponse.json({
    anoMes, vendasAcaoSw: r(vendasAcaoSw), lucroAcaoSw: r(lucroAcaoSw),
    lucroOpcaoSw: r(lucroOpcaoSw), lucroDay: r(lucroDay),
    isento, prejSwing: r(prejSwing), prejDay: r(prejDay),
    irSwing: r(irSwing), irDay: r(irDay), irrf: r(irrf),
    irDevidoSwing: r(irDevidoSwing), irDevidoDay: r(irDevidoDayFinal),
    totalOpsDoMes: opsDoMes.length,
  })
}

function r(v: number) { return Math.round(v * 100) / 100 }
