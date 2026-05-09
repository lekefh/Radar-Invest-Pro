import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/auth'

const PROMPT = `Você é um especialista em notas de corretagem brasileiras.
Analise esta nota de corretagem e extraia TODAS as operações realizadas.

Retorne SOMENTE um JSON válido com esta estrutura (sem texto antes ou depois):
{
  "corretora": "nome da corretora",
  "data": "YYYY-MM-DD",
  "operacoes": [
    {
      "tipo": "C",
      "ticker": "PETR4",
      "quantidade": 100,
      "preco": 38.50
    }
  ]
}

Regras:
- tipo: "C" para compra, "V" para venda
- ticker: apenas o código da ação (ex: PETR4, VALE3) sem sufixos
- quantidade: número inteiro
- preco: preço unitário com até 2 casas decimais
- Se houver múltiplas operações, inclua todas no array
- Se não conseguir identificar algum campo, use null
- Ignore taxas, emolumentos e outros custos — apenas as operações de compra/venda`

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('nota') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')

    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'Formato não suportado. Envie PDF ou imagem (JPG, PNG).' },
        { status: 400 }
      )
    }

    const client = new Anthropic({ apiKey })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlock: any = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
            data: base64,
          },
        }

    const msg = await client.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      },
      isPdf ? { headers: { 'anthropic-beta': 'pdfs-2024-09-25' } } : undefined
    )

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()

    // Remove markdown code blocks se houver
    const json = raw.startsWith('```')
      ? raw.split('```')[1].replace(/^json\n?/, '').trim()
      : raw

    const parsed = JSON.parse(json)

    if (!parsed.operacoes || !Array.isArray(parsed.operacoes)) {
      return NextResponse.json({ error: 'Não foi possível identificar operações na nota.' }, { status: 422 })
    }

    // Sanitiza e valida cada operação
    const operacoes = parsed.operacoes
      .filter((op: { tipo?: string; ticker?: string; quantidade?: number; preco?: number }) =>
        op.tipo && op.ticker && op.quantidade && op.preco
      )
      .map((op: { tipo: string; ticker: string; quantidade: number; preco: number }) => ({
        tipo:       String(op.tipo).toUpperCase() === 'V' ? 'V' : 'C',
        ticker:     String(op.ticker).toUpperCase().replace(/[^A-Z0-9]/g, ''),
        quantidade: Math.abs(Number(op.quantidade)),
        preco:      Math.abs(Number(op.preco)),
        data:       parsed.data ?? new Date().toISOString().slice(0, 10),
      }))

    return NextResponse.json({
      corretora:  parsed.corretora ?? null,
      data:       parsed.data ?? null,
      operacoes,
    })
  } catch (e) {
    console.error('[POST /api/carteira/importar]', e)
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'Não foi possível ler a nota. Tente com uma imagem mais nítida.' }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro ao processar a nota.' }, { status: 500 })
  }
}
