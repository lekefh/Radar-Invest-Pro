import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'

interface ItemBase {
  ticker: string
  quantidade: number
  preco_medio: number
  cnpj: string | null
}

/**
 * POST /api/carteira/posicao-base/importar
 * Recebe planilha XLSX com posições base e retorna os itens parseados.
 *
 * Formatos aceitos:
 *   • Colunas: Ativo | CNPJ | Qtd | Preço médio   (padrão CEI/B3)
 *   • Colunas: Ticker | CNPJ | Quantidade | Preço  (variação)
 *
 * A linha de cabeçalho é detectada automaticamente (procura "Ativo" ou "Ticker").
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

    // Tenta cada aba até encontrar dados
    for (const sheetName of wb.SheetNames) {
      const ws   = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

      // Detecta a linha do cabeçalho
      let headerIdx = -1
      let colTicker = -1, colCnpj = -1, colQtd = -1, colPreco = -1

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = (rows[i] as unknown[]).map(c => String(c ?? '').trim().toLowerCase())
        // Procura coluna que identifique ticker
        const ti = row.findIndex(c => c === 'ativo' || c === 'ticker' || c === 'código' || c === 'codigo')
        if (ti === -1) continue

        headerIdx = i
        colTicker = ti
        colCnpj   = row.findIndex(c => c.includes('cnpj'))
        colQtd    = row.findIndex(c => c === 'qtd' || c === 'quantidade' || c.startsWith('qt'))
        colPreco  = row.findIndex(c =>
          c.includes('preço') || c.includes('preco') || c.includes('médio') || c.includes('medio') || c === 'price'
        )
        break
      }

      if (headerIdx === -1 || colTicker === -1 || colQtd === -1 || colPreco === -1) continue

      const itens: ItemBase[] = []
      const avisos: string[] = []

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[]
        if (!row || row.every(c => c == null || c === '')) continue

        const tickerRaw = String(row[colTicker] ?? '').trim().toUpperCase()
        if (!tickerRaw || tickerRaw === 'TOTAL' || tickerRaw === 'SUBTOTAL') continue

        const qtdRaw   = row[colQtd]
        const precoRaw = row[colPreco]
        const cnpjRaw  = colCnpj >= 0 ? String(row[colCnpj] ?? '').trim() : null

        const quantidade  = parseFloat(String(qtdRaw  ?? '').replace(',', '.'))
        const preco_medio = parseFloat(String(precoRaw ?? '').replace(',', '.'))

        if (isNaN(quantidade) || quantidade <= 0) {
          avisos.push(`Linha ${i + 1}: quantidade inválida para ${tickerRaw} — ignorada`)
          continue
        }
        if (isNaN(preco_medio) || preco_medio <= 0) {
          avisos.push(`Linha ${i + 1}: preço inválido para ${tickerRaw} — ignorada`)
          continue
        }

        // Normaliza CNPJ: mantém apenas dígitos e formatação XX.XXX.XXX/XXXX-XX
        const cnpj = cnpjRaw && cnpjRaw.replace(/\D/g, '').length >= 14
          ? cnpjRaw.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
          : (cnpjRaw || null)

        itens.push({ ticker: tickerRaw, quantidade, preco_medio, cnpj })
      }

      if (itens.length > 0) {
        return NextResponse.json({ itens, total: itens.length, avisos, aba: sheetName })
      }
    }

    return NextResponse.json({ error: 'Nenhum dado encontrado. Verifique se a planilha tem colunas Ativo/CNPJ/Qtd/Preço.' }, { status: 422 })

  } catch (e) {
    console.error('[posicao-base/importar]', e)
    return NextResponse.json({ error: 'Erro ao processar a planilha.' }, { status: 500 })
  }
}
