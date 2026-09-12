import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'
import { ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS, parseCSV, categorizar, detectarTipo, TransacaoPreview } from '@/lib/financas-utils'

// ── Parser de valor para células Excel ────────────────────────────────────────
function parseValorXLS(s: string | number): number {
  if (typeof s === 'number') return s
  const clean = String(s || '').trim().replace(/[R$\s()]/g, '')
  if (!clean || clean === '-') return 0
  if (clean.includes('.') && clean.includes(','))
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
  if (clean.includes(','))
    return parseFloat(clean.replace(',', '.')) || 0
  return parseFloat(clean) || 0
}

// ── Parser XLS/XLSX Bradesco (conta corrente e fatura) ───────────────────────
function parseXLSBradesco(buffer: Buffer, banco: string): TransacaoPreview[] {
  const wb   = XLSX.read(buffer, { type: 'buffer' })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' }) as string[][]

  let headerIdx = -1
  let anoBase   = new Date().getFullYear()

  // Encontra linha de cabeçalho e tenta extrair o ano das primeiras 20 linhas
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined  = rows[i].join(' ')
    const yearM   = joined.match(/\b(20\d{2})\b/)
    if (yearM) anoBase = parseInt(yearM[1])

    const c0 = String(rows[i][0] || '').toLowerCase().trim()
    const c1 = String(rows[i][1] || '').toLowerCase().trim()
    if (c0 === 'data' && (c1.includes('hist') || c1.includes('desc'))) {
      headerIdx = i
      break
    }
  }

  if (headerIdx < 0) return []

  const header = rows[headerIdx].map(h => String(h || '').toLowerCase().trim())
  const hasCred   = header.some(h => h.includes('cr') && h.includes('r$'))
  const hasValorR = header.some(h => h.includes('valor') && h.includes('r$'))
  const isFatura  = !hasCred && hasValorR

  const iCred  = hasCred   ? header.findIndex(h => h.includes('cr') && h.includes('r$')) : -1
  const iDebi  = hasCred   ? header.findIndex(h => h.includes('r$') && !h.includes('cr') && h.includes('d')) : -1
  const iValR  = hasValorR ? header.findIndex(h => h.includes('valor') && h.includes('r$')) : -1

  const bancoFinal  = banco || 'Bradesco'
  const transacoes: TransacaoPreview[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cols    = rows[i]
    const dataRaw = String(cols[0] || '').trim()
    const hist    = String(cols[1] || '').trim()

    // Linha sem data válida → detalhe/continuação ou rodapé
    if (!dataRaw.match(/^\d{1,2}\//)) continue
    if (!hist) continue

    const hl = hist.toLowerCase()
    if (hl === 'saldo anterior' || hl.startsWith('saldo invest')) continue
    if (hl.startsWith('sac ') || hl.startsWith('alô bradesco') || hl.startsWith('ouvidoria')) break
    if (hl.includes('total da fatura') || hl.includes('cotação do dólar') || hl.includes('cotacao')) break

    // Data: DD/MM/AA, DD/MM/AAAA ou DD/MM
    const dm = dataRaw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
    if (!dm) continue
    const d  = dm[1].padStart(2, '0')
    const mo = dm[2].padStart(2, '0')
    const yr = dm[3]
      ? (dm[3].length === 2 ? '20' + dm[3] : dm[3])
      : String(anoBase)
    const data = `${yr}-${mo}-${d}`

    let valor = 0
    if (isFatura && iValR >= 0) {
      valor = -Math.abs(parseValorXLS(cols[iValR]))
    } else if (!isFatura) {
      const cred = iCred >= 0 ? parseValorXLS(cols[iCred]) : 0
      const debi = iDebi >= 0 ? parseValorXLS(cols[iDebi]) : 0
      if (cred > 0)    valor = cred
      else if (debi !== 0) valor = -Math.abs(debi)
    }

    if (valor === 0) continue

    const tipo_lancamento = detectarTipo(hist, valor)
    transacoes.push({
      data,
      historico: hist,
      descricao: '',
      valor,
      tipo_lancamento: isFatura && tipo_lancamento !== 'pagamento_cartao' ? 'despesa' : tipo_lancamento,
      tipo_extrato: isFatura ? 'cartao' : 'conta',
      categoria: categorizar(hist),
      banco: bancoFinal,
      periodo: data.substring(0, 7),
    })
  }

  return transacoes
}

// ── Prompt 1: extração inicial ────────────────────────────────────────────────
const PROMPT_EXTRATO = `Você é um especialista em extratos bancários e faturas de cartão de crédito brasileiros.
Analise CUIDADOSAMENTE todas as páginas deste documento e extraia CADA lançamento individual.

Retorne APENAS um objeto JSON com esta estrutura exata (sem texto adicional antes ou depois):

{"banco":"Nome do banco","tipo_extrato":"conta","transacoes":[{"data":"2026-01-15","historico":"DESCRIÇÃO DO LANÇAMENTO","valor":-150.00}]}

REGRAS OBRIGATÓRIAS:
- "tipo_extrato": use "conta" para extrato de conta corrente/poupança, "cartao" para fatura de cartão de crédito
- "data": SEMPRE no formato YYYY-MM-DD
- "valor": número com decimais — NEGATIVO para débitos/despesas/compras, POSITIVO para créditos/pagamentos recebidos/estornos
- Em fatura de cartão: compras = negativo, estornos/reembolsos = positivo
- Inclua TODOS os lançamentos, mesmo os pequenos
- NÃO inclua saldo, total ou linhas de resumo — apenas transações individuais
- Se não conseguir ler algum campo, use string vazia para "historico" e 0 para valor

IMPORTANTE: Responda SOMENTE com o JSON. Nenhum texto antes ou depois.`

// ── Prompt 2: fallback para quando o 1º não retornou JSON válido ──────────────
const PROMPT_FALLBACK = `O documento anterior é uma fatura/extrato bancário.
Liste CADA transação em formato JSON estrito, linha por linha.

Formato exato da resposta — apenas este JSON, nada mais:
{"transacoes":[{"data":"YYYY-MM-DD","historico":"texto da transação","valor":-0.00}]}

Se for fatura de cartão, valores são negativos (compras) ou positivos (estornos).
Se for extrato de conta, débitos são negativos e créditos positivos.
Inclua absolutamente TODAS as transações visíveis no documento.`

// ── Extrai JSON de qualquer formato que Claude retornar ────────────────────────
function extrairJSON(text: string): Record<string, unknown> | null {
  // 1. JSON direto
  try { return JSON.parse(text.trim()) } catch { /* continua */ }

  // 2. Bloco markdown ```json ... ```
  const md = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (md?.[1]) { try { return JSON.parse(md[1].trim()) } catch { /* continua */ } }

  // 3. Primeiro objeto {} encontrado
  const obj = text.match(/\{[\s\S]*\}/)
  if (obj?.[0]) { try { return JSON.parse(obj[0]) } catch { /* continua */ } }

  // 4. Primeiro array [] encontrado → embrulha em transacoes
  const arr = text.match(/\[[\s\S]*\]/)
  if (arr?.[0]) { try { return { transacoes: JSON.parse(arr[0]) } } catch { /* continua */ } }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Recurso disponível a partir do plano Starter' }, { status: 403 })
    }

    await ensureFinancasTables()

    const form   = await req.formData()
    const file   = form.get('file') as File | null
    const banco  = String(form.get('banco') || '')
    const tipoExtratoForm = String(form.get('tipo_extrato') || 'conta')

    if (!file) return NextResponse.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const nome = file.name.toLowerCase()

    // ── CSV / TXT ─────────────────────────────────────────────────────────────
    if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
      const texto = await file.text()
      const transacoes = parseCSV(texto, banco || 'Não informado')

      if (transacoes.length === 0) {
        return NextResponse.json({ erro: 'Nenhuma transação encontrada no arquivo. Verifique o formato.' }, { status: 422 })
      }

      // Detecta se o arquivo é fatura ou conta pelo que o parser identificou
      const tiposDetectados = new Set(transacoes.map(t => t.tipo_extrato))
      const arquivoEhCartao = tiposDetectados.has('cartao') && !tiposDetectados.has('conta')
      const arquivoEhConta  = tiposDetectados.has('conta')  && !tiposDetectados.has('cartao')

      if (tipoExtratoForm === 'cartao' && arquivoEhConta) {
        return NextResponse.json({
          erro: 'Arquivo detectado como extrato de conta corrente, mas você selecionou "Fatura Cartão de Crédito". Altere o tipo para "Conta Corrente / Poupança" e tente novamente.',
        }, { status: 422 })
      }
      if (tipoExtratoForm === 'conta' && arquivoEhCartao) {
        return NextResponse.json({
          erro: 'Arquivo detectado como fatura de cartão de crédito, mas você selecionou "Conta Corrente / Poupança". Altere o tipo para "Fatura Cartão de Crédito" e tente novamente.',
        }, { status: 422 })
      }

      return NextResponse.json({ transacoes, total: transacoes.length, banco: banco || 'Não informado' })
    }

    // ── XLS / XLSX ───────────────────────────────────────────────────────────
    if (nome.endsWith('.xls') || nome.endsWith('.xlsx')) {
      const bytes     = await file.arrayBuffer()
      const buffer    = Buffer.from(bytes)
      const transacoes = parseXLSBradesco(buffer, banco || 'Bradesco')

      if (transacoes.length === 0) {
        return NextResponse.json({ erro: 'Nenhuma transação encontrada no arquivo Excel. Verifique se é um extrato Bradesco Internet Banking.' }, { status: 422 })
      }

      // Mesma validação de mismatch do CSV
      const tiposDetectados = new Set(transacoes.map(t => t.tipo_extrato))
      const arquivoEhCartao = tiposDetectados.has('cartao') && !tiposDetectados.has('conta')
      const arquivoEhConta  = tiposDetectados.has('conta')  && !tiposDetectados.has('cartao')

      if (tipoExtratoForm === 'cartao' && arquivoEhConta) {
        return NextResponse.json({
          erro: 'Arquivo detectado como extrato de conta corrente, mas você selecionou "Fatura Cartão de Crédito". Altere o tipo e tente novamente.',
        }, { status: 422 })
      }
      if (tipoExtratoForm === 'conta' && arquivoEhCartao) {
        return NextResponse.json({
          erro: 'Arquivo detectado como fatura de cartão de crédito, mas você selecionou "Conta Corrente / Poupança". Altere o tipo e tente novamente.',
        }, { status: 422 })
      }

      return NextResponse.json({ transacoes, total: transacoes.length, banco: banco || 'Bradesco' })
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    if (nome.endsWith('.pdf')) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ erro: 'Chave Claude não configurada no servidor' }, { status: 500 })

      const bytes  = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')

      const client = new Anthropic({ apiKey })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docBlock: any = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgBlock: any = { type: 'image',    source: { type: 'base64', media_type: 'application/pdf', data: base64 } }

      // Tentativa 1 — PDF como document (funciona para PDFs com texto)
      let raw = ''
      let parsed: Record<string, unknown> | null = null

      try {
        const resp1 = await client.messages.create(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: [docBlock, { type: 'text', text: PROMPT_EXTRATO }] }],
          },
          { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } }
        )
        raw = (resp1.content.find(c => c.type === 'text') as { type: string; text: string } | undefined)?.text || ''
        parsed = extrairJSON(raw)
      } catch { /* tenta fallback */ }

      // Tentativa 2 — segundo prompt mais simples sobre o mesmo conteúdo
      if (!parsed || !Array.isArray((parsed as { transacoes?: unknown }).transacoes)) {
        try {
          const resp2 = await client.messages.create(
            {
              model: 'claude-sonnet-4-6',
              max_tokens: 4096,
              messages: [
                { role: 'user', content: [docBlock, { type: 'text', text: PROMPT_EXTRATO }] },
                { role: 'assistant', content: raw || 'Não consegui extrair as transações no formato solicitado.' },
                { role: 'user', content: PROMPT_FALLBACK },
              ],
            },
            { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } }
          )
          const raw2 = (resp2.content.find(c => c.type === 'text') as { type: string; text: string } | undefined)?.text || ''
          parsed = extrairJSON(raw2)
        } catch { /* última tentativa abaixo */ }
      }

      // Tentativa 3 — envia como imagem (para PDFs 100% escaneados)
      if (!parsed || !Array.isArray((parsed as { transacoes?: unknown }).transacoes)) {
        try {
          const resp3 = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            messages: [{ role: 'user', content: [imgBlock, { type: 'text', text: PROMPT_EXTRATO }] }],
          })
          const raw3 = (resp3.content.find(c => c.type === 'text') as { type: string; text: string } | undefined)?.text || ''
          parsed = extrairJSON(raw3)
        } catch { /* desiste */ }
      }

      if (!parsed || !Array.isArray((parsed as { transacoes?: unknown }).transacoes)) {
        return NextResponse.json({
          erro: 'Não foi possível ler as transações deste PDF. O arquivo pode ser 100% escaneado (imagem). Tente exportar como CSV no app do banco ou site do Itaú.',
        }, { status: 422 })
      }

      const bancoFinal    = banco || (parsed.banco as string) || 'Não informado'
      const tipoExtrato   = (tipoExtratoForm || (parsed.tipo_extrato as string) || 'conta') as 'conta' | 'cartao'
      const listaRaw      = (parsed as { transacoes: { data: string; historico: string; valor: number }[] }).transacoes

      const transacoes: TransacaoPreview[] = listaRaw
        .filter(t => t.historico && t.data)
        .map(t => {
          const tipo_lancamento = detectarTipo(t.historico, t.valor)
          return {
            data:            t.data,
            historico:       t.historico,
            descricao:       '',
            valor:           t.valor,
            tipo_lancamento: tipoExtrato === 'cartao' && tipo_lancamento !== 'pagamento_cartao' ? 'despesa' : tipo_lancamento,
            tipo_extrato:    tipoExtrato,
            categoria:       categorizar(t.historico),
            banco:           bancoFinal,
            periodo:         t.data.substring(0, 7),
          }
        })

      return NextResponse.json({ transacoes, total: transacoes.length, banco: bancoFinal })
    }

    return NextResponse.json({ erro: 'Formato não suportado. Use CSV, TXT ou PDF.' }, { status: 400 })

  } catch (e: unknown) {
    console.error('[upload-extrato]', e)
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
