import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'

/**
 * POST /api/carteira/importar-b3
 * Recebe planilha XLSX de negociações da B3 e retorna operações parseadas.
 *
 * Colunas esperadas:
 * 0: Data do Negócio   1: Tipo de Movimentação  2: Mercado
 * 3: Prazo/Vencimento  4: Instituição            5: Código de Negociação
 * 6: Quantidade        7: Preço                  8: Valor
 *
 * Tratamentos especiais:
 * - Exercício de Opção de Venda (Compra + E-suffix) → converte para compra da ação-objeto
 * - Exercício de Opção de Compra (Venda + E-suffix) → converte para venda da ação-objeto
 * - Opção regular com Venda → tipo V, operacao/route cria posição negativa (lançador)
 * - Mercado fracionário (ticker termina em F, não é opção) → remove o F
 */

// Opções B3: 4 letras (ativo) + letra série A-X + strike alfanumérico
function isOpcaoTicker(t: string): boolean {
  return /^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(t)
}

// Ticker de exercício: opção cujo mercado indica "Exercício" — E no final do ticker é comum mas não obrigatório
function isExercicio(mercado: string): boolean {
  const m = mercado.toLowerCase()
  return m.includes('exerc') // "Exercício de Opção de Venda/Compra"
}

// Mapa ativo-base → ticker da ação subjacente
const UNDERLYING: Record<string, string> = {
  AZZA: 'AZZA3', PETR: 'PETR4', VALE: 'VALE3', ITUB: 'ITUB4',
  BBDC: 'BBDC4', BBAS: 'BBAS3', ABEV: 'ABEV3', WEGE: 'WEGE3',
  RENT: 'RENT3', MGLU: 'MGLU3', PRIO: 'PRIO3', INTB: 'INTB3',
  VULC: 'VULC3', CYRE: 'CYRE3', GMAT: 'GMAT3', KEPL: 'KEPL3',
  SOJA: 'SOJA3', AXIA: 'AXIA3', SUZB: 'SUZB3', PSSA: 'PSSA3',
  RDOR: 'RDOR3', FLRY: 'FLRY3', EGIE: 'EGIE3', TAEE: 'TAEE11',
  BRAV: 'BRAV3', RECV: 'RECV3', KLBN: 'KLBN11', RRRP: 'RRRP3',
  SLCE: 'SLCE3', AGRO: 'AGRO3', VBBR: 'VBBR3', B3SA: 'B3SA3',
  SBFG: 'SBFG3', BRAP: 'BRAP4', BRKM: 'BRKM5', VIVT: 'VIVT3',
  TIMS: 'TIMS3', HAPV: 'HAPV3', TOTS: 'TOTS3', EQTL: 'EQTL3',
}

function underlyingDaOpcao(ticker: string): string {
  const base = ticker.slice(0, 4)
  return UNDERLYING[base] ?? base + '3'
}

function normalizarTicker(codigo: string): string {
  const t = String(codigo).trim().toUpperCase()
  // Remove F só de ações fracionárias (ex: PETR4F → PETR4), nunca de opções (AXIAF655 permanece)
  if (t.endsWith('F') && !isOpcaoTicker(t) && t.length <= 7) return t.slice(0, -1)
  return t
}

function parsearData(valor: unknown): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(valor).trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return s
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('planilha') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls'))
      return NextResponse.json({ error: 'Formato inválido. Envie a planilha .xlsx baixada do site da B3.' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const wb   = XLSX.read(bytes, { type: 'array', cellDates: false })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

    const operacoes: {
      tipo: string; ticker: string; quantidade: number; preco: number
      data: string; notas: string; mercado?: string; vencimento?: string | null
    }[] = []
    const erros: string[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      if (!row || row.length < 8) continue

      const [dataRaw, tipoRaw, mercadoRaw, vencRaw, instituicao, codigoRaw, qtdeRaw, precoRaw] = row

      if (!dataRaw && !codigoRaw) continue
      if (!tipoRaw || !codigoRaw || qtdeRaw == null || precoRaw == null) {
        erros.push(`Linha ${i + 1}: dados incompletos — ignorada`)
        continue
      }

      const tipoStr   = String(tipoRaw).trim().normalize('NFC').toLowerCase()
      const mercadoStr = String(mercadoRaw ?? '').normalize('NFC')

      let tipo: string
      if (tipoStr.includes('compra'))     tipo = 'C'
      else if (tipoStr.includes('venda')) tipo = 'V'
      else {
        erros.push(`Linha ${i + 1}: tipo "${tipoRaw}" não reconhecido — ignorada`)
        continue
      }

      const tickerRaw  = normalizarTicker(String(codigoRaw))
      const quantidade = Math.abs(Number(qtdeRaw))
      const preco      = Math.abs(Number(String(precoRaw).replace(',', '.')))
      const data       = parsearData(dataRaw)
      const vencimento = vencRaw ? parsearData(vencRaw) : null
      const corretora  = String(instituicao ?? '').trim()
      const notas      = corretora ? `B3 — ${corretora}` : 'Importado via B3'

      if (!tickerRaw || quantidade <= 0 || preco <= 0) {
        erros.push(`Linha ${i + 1}: valores inválidos — ignorada`)
        continue
      }

      if (isExercicio(mercadoStr)) {
        // "Compra - Exercício de Opção de Venda" = lançador de put assigned → comprou ação-objeto
        // "Venda - Exercício de Opção de Compra" = lançador de call assigned → vendeu ação-objeto
        const acoeTicker = underlyingDaOpcao(tickerRaw)
        operacoes.push({ tipo, ticker: acoeTicker, quantidade, preco, data, notas: `${notas} — Exercício de ${tickerRaw}`, mercado: 'exercicio' })
      } else if (isOpcaoTicker(tickerRaw)) {
        // Opção regular: preserva vencimento real da planilha B3
        operacoes.push({ tipo, ticker: tickerRaw, quantidade, preco, data, notas, mercado: 'opcao', vencimento })
      } else {
        // Ação comum
        operacoes.push({ tipo, ticker: tickerRaw, quantidade, preco, data, notas, mercado: 'acao' })
      }
    }

    if (!operacoes.length)
      return NextResponse.json({ error: 'Nenhuma operação encontrada. Verifique se é a planilha correta da B3.' }, { status: 422 })

    // Ordena por data crescente (planilha B3 vem do mais recente ao mais antigo)
    operacoes.sort((a, b) => a.data.localeCompare(b.data))

    return NextResponse.json({ operacoes, total: operacoes.length, avisos: erros })
  } catch (e) {
    console.error('[POST /api/carteira/importar-b3]', e)
    return NextResponse.json({ error: 'Erro ao processar a planilha. Verifique se é um arquivo válido da B3.' }, { status: 500 })
  }
}
