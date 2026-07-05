import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'

interface ItemBase {
  ticker:     string
  quantidade: number        // negativo = lançador de opção
  preco_medio: number
  cnpj:       string | null
  direcao:    'lancador' | 'titular' | null  // null = ação comum
}

/**
 * POST /api/carteira/posicao-base/importar
 *
 * Colunas esperadas (ordem flexível, detectada pelo cabeçalho):
 *   Ativo | CNPJ | Qtd | Preço médio | L/T
 *
 * Coluna L/T (Lançador/Titular):
 *   "Lançador" → quantidade negativa (posição vendida em opção)
 *   "Titular" ou vazio → quantidade positiva
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('planilha') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls'))
      return NextResponse.json({ error: 'Formato inválido. Envie uma planilha .xlsx.' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const wb    = XLSX.read(bytes, { type: 'array', cellDates: false })

    for (const sheetName of wb.SheetNames) {
      const ws   = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      let headerIdx = -1
      let colTicker = -1, colCnpj = -1, colQtd = -1, colPreco = -1, colLT = -1

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = (rows[i] as unknown[]).map(c => String(c ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
        const ti = row.findIndex(c => c === 'ativo' || c === 'ticker' || c === 'codigo' || c === 'codigo de negociacao')
        if (ti === -1) continue

        headerIdx = i
        colTicker = ti
        colCnpj   = row.findIndex(c => c.includes('cnpj'))
        colQtd    = row.findIndex(c => c === 'qtd' || c === 'quantidade' || c.startsWith('qt'))
        colPreco  = row.findIndex(c =>
          c.includes('preco') || c.includes('medio') || c === 'price'
        )
        // L/T: Lançador/Titular — vários nomes possíveis
        colLT = row.findIndex(c =>
          c === 'l/t' || c === 'lt' || c === 'posicao' || c === 'direcao' ||
          c.includes('lancador') || c.includes('titular')
        )
        break
      }

      if (headerIdx === -1 || colTicker === -1 || colQtd === -1 || colPreco === -1) continue

      const itens: ItemBase[] = []
      const avisos: string[]  = []

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        if (!row || row.every(c => c == null || c === '')) continue

        const tickerRaw = String(row[colTicker] ?? '').trim().toUpperCase()
        if (!tickerRaw || tickerRaw === 'TOTAL' || tickerRaw === 'SUBTOTAL') continue

        const qtdRaw   = row[colQtd]
        const precoRaw = row[colPreco]
        const cnpjRaw  = colCnpj >= 0 ? String(row[colCnpj] ?? '').trim() : null
        const ltRaw    = colLT >= 0   ? String(row[colLT]   ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : ''

        const qtdAbs    = parseFloat(String(qtdRaw  ?? '').replace(',', '.'))
        const precoMed  = parseFloat(String(precoRaw ?? '').replace(',', '.'))

        if (isNaN(qtdAbs) || qtdAbs <= 0) {
          avisos.push(`Linha ${i + 1}: quantidade inválida para ${tickerRaw} — ignorada`)
          continue
        }
        if (isNaN(precoMed) || precoMed <= 0) {
          avisos.push(`Linha ${i + 1}: preço inválido para ${tickerRaw} — ignorada`)
          continue
        }

        // Lançador = posição vendida → quantidade negativa
        const ehLancador = ltRaw.includes('lancador') || ltRaw === 'l'
        const direcao: ItemBase['direcao'] = ehLancador ? 'lancador' : (ltRaw.includes('titular') || ltRaw === 't' ? 'titular' : null)
        const quantidade = ehLancador ? -qtdAbs : qtdAbs

        // Normaliza CNPJ → XX.XXX.XXX/XXXX-XX
        const cnpjDigits = (cnpjRaw ?? '').replace(/\D/g, '')
        const cnpj = cnpjDigits.length === 14
          ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
          : (cnpjRaw || null)

        itens.push({ ticker: tickerRaw, quantidade, preco_medio: precoMed, cnpj, direcao })
      }

      if (itens.length > 0) {
        return NextResponse.json({ itens, total: itens.length, avisos, aba: sheetName })
      }
    }

    return NextResponse.json({
      error: 'Nenhum dado encontrado. Verifique se a planilha tem colunas Ativo / CNPJ / Qtd / Preço médio / L/T.'
    }, { status: 422 })

  } catch (e) {
    console.error('[posicao-base/importar]', e)
    return NextResponse.json({ error: 'Erro ao processar a planilha.' }, { status: 500 })
  }
}
