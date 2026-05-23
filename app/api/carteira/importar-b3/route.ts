import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

/**
 * POST /api/carteira/importar-b3
 * Recebe planilha XLSX de negociações baixada do site da B3 e retorna
 * as operações parseadas, prontas para revisão e confirmação.
 *
 * Formato esperado (planilha "Negociação" do site b3.com.br):
 * Col 0: Data do Negócio   (DD/MM/YYYY)
 * Col 1: Tipo de Movimentação  (Compra / Venda)
 * Col 2: Mercado           (Mercado à Vista / Mercado Fracionário)
 * Col 3: Prazo/Vencimento  (ignorado)
 * Col 4: Instituição       (corretora → vai para notas/observações)
 * Col 5: Código de Negociação  (ticker; fracionário termina em F → removido)
 * Col 6: Quantidade
 * Col 7: Preço
 * Col 8: Valor             (ignorado; recalculado)
 */

function normalizarTicker(codigo: string): string {
  const t = String(codigo).trim().toUpperCase()
  // Remove sufixo F do mercado fracionário: CYRE3F → CYRE3
  return t.endsWith('F') ? t.slice(0, -1) : t
}

function parsearData(valor: unknown): string {
  // Pode chegar como string "17/04/2026" ou número serial do Excel
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10)
  }
  if (typeof valor === 'number') {
    const d = XLSX.SSF.parse_date_code(valor)
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(valor).trim()
  // DD/MM/YYYY
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
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Formato inválido. Envie a planilha .xlsx baixada do site da B3.' },
        { status: 400 }
      )
    }

    const bytes  = await file.arrayBuffer()
    const wb     = XLSX.read(bytes, { type: 'array', cellDates: false })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    const rows   = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

    const operacoes: {
      tipo: string; ticker: string; quantidade: number; preco: number
      data: string; notas: string
    }[] = []

    const erros: string[] = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      if (!row || row.length < 8) continue

      const [dataRaw, tipoRaw, , , instituicao, codigoRaw, qtdeRaw, precoRaw] = row

      // Ignora linhas em branco ou sem dados essenciais
      if (!dataRaw && !codigoRaw) continue
      if (!tipoRaw || !codigoRaw || qtdeRaw == null || precoRaw == null) {
        erros.push(`Linha ${i + 1}: dados incompletos — ignorada`)
        continue
      }

      // Normaliza: remove espaços, BOM e caracteres invisíveis
      const tipoStr = String(tipoRaw).trim().normalize('NFC').toLowerCase()

      let tipo: string
      if (tipoStr.includes('compra'))     tipo = 'C'
      else if (tipoStr.includes('venda')) tipo = 'V'
      else {
        erros.push(`Linha ${i + 1}: tipo "${tipoRaw}" não reconhecido — ignorada`)
        continue
      }

      const ticker    = normalizarTicker(String(codigoRaw))
      const quantidade = Math.abs(Number(qtdeRaw))
      const preco     = Math.abs(Number(String(precoRaw).replace(',', '.')))
      const data      = parsearData(dataRaw)
      const corretora = String(instituicao ?? '').trim()
      const notas     = corretora ? `B3 — ${corretora}` : 'Importado via B3'

      if (!ticker || quantidade <= 0 || preco <= 0) {
        erros.push(`Linha ${i + 1}: valores inválidos — ignorada`)
        continue
      }

      operacoes.push({ tipo, ticker, quantidade, preco, data, notas })
    }

    if (!operacoes.length) {
      return NextResponse.json(
        { error: 'Nenhuma operação encontrada. Verifique se é a planilha correta da B3.' },
        { status: 422 }
      )
    }

    // ── CRÍTICO: ordenar por data CRESCENTE (mais antiga primeiro) ─────────────
    // A planilha B3 vem do mais recente ao mais antigo.
    // Se processarmos fora de ordem, uma VENDA executada antes de uma COMPRA
    // chegará ao banco antes dela — sem posição, a venda é ignorada silenciosamente
    // e o custo médio fica errado. A ordem correta reconstrói o histórico fielmente.
    operacoes.sort((a, b) => a.data.localeCompare(b.data))

    return NextResponse.json({ operacoes, total: operacoes.length, avisos: erros })
  } catch (e) {
    console.error('[POST /api/carteira/importar-b3]', e)
    return NextResponse.json(
      { error: 'Erro ao processar a planilha. Verifique se é um arquivo válido da B3.' },
      { status: 500 }
    )
  }
}
