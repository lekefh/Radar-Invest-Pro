import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/auth'
import { ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS, parseCSV, categorizar, detectarTipo, TransacaoPreview } from '@/lib/financas-utils'

const PROMPT_EXTRATO = `Você é um especialista em extratos bancários e faturas de cartão de crédito brasileiros.
Analise este documento e extraia TODAS as transações financeiras.

Retorne JSON puro com a seguinte estrutura:
{
  "banco": "Nome do banco detectado (ex: Bradesco, Itaú, Nubank, etc.)",
  "tipo_extrato": "conta" ou "cartao",
  "transacoes": [
    {
      "data": "YYYY-MM-DD",
      "historico": "descrição exata da transação",
      "valor": -100.00,
      "tipo": "despesa"
    }
  ]
}

REGRAS IMPORTANTES:
- Débitos/despesas/pagamentos: valor NEGATIVO (ex: -150.00)
- Créditos/receitas/entradas: valor POSITIVO (ex: 2500.00)
- Para fatura de cartão: todos os lançamentos são despesas (valor negativo), exceto estornos/reembolsos (positivo)
- Datas sempre em formato YYYY-MM-DD
- Inclua TODAS as transações, mesmo as pequenas
- NÃO inclua linhas de totais, saldos ou resumos — apenas lançamentos individuais
- Se for fatura de cartão, tipo_extrato = "cartao"; se for extrato de conta corrente/poupança, tipo_extrato = "conta"

Retorne APENAS o JSON, sem texto antes ou depois.`

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

      if (tipoExtratoForm === 'cartao') {
        for (const t of transacoes) {
          t.tipo_extrato = 'cartao'
          if (t.tipo_lancamento !== 'pagamento_cartao') t.tipo_lancamento = 'despesa'
        }
      }

      return NextResponse.json({ transacoes, total: transacoes.length, banco: banco || 'Não informado' })
    }

    // ── PDF ───────────────────────────────────────────────────────────────────
    if (nome.endsWith('.pdf')) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return NextResponse.json({ erro: 'Chave Claude não configurada' }, { status: 500 })

      const bytes  = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')

      const client = new Anthropic({ apiKey })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docBlock: any = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      const resp   = await client.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [ docBlock, { type: 'text', text: PROMPT_EXTRATO } ],
          }],
        },
        { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } }
      )

      const raw = (resp.content.find(c => c.type === 'text') as { type: string; text: string } | undefined)?.text || ''
      let parsed: { banco?: string; tipo_extrato?: string; transacoes?: { data: string; historico: string; valor: number }[] }
      try {
        const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw
        parsed = JSON.parse(jsonStr)
      } catch {
        return NextResponse.json({ erro: 'Claude não retornou JSON válido para este PDF. Tente um CSV.' }, { status: 422 })
      }

      const bancoFinal = banco || parsed.banco || 'Não informado'
      const tipoExtrato = (tipoExtratoForm || parsed.tipo_extrato || 'conta') as 'conta' | 'cartao'

      const transacoes: TransacaoPreview[] = (parsed.transacoes || []).map(t => {
        const tipo_lancamento = detectarTipo(t.historico, t.valor)
        return {
          data:             t.data,
          historico:        t.historico,
          descricao:        '',
          valor:            t.valor,
          tipo_lancamento:  tipoExtrato === 'cartao' && tipo_lancamento !== 'pagamento_cartao' ? 'despesa' : tipo_lancamento,
          tipo_extrato:     tipoExtrato,
          categoria:        categorizar(t.historico),
          banco:            bancoFinal,
          periodo:          t.data.substring(0, 7),
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
