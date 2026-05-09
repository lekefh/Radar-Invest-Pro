import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/auth'

const PROMPT = `Você é um especialista em notas de corretagem da B3 brasileira.
Analise esta nota de corretagem e extraia TODAS as operações de compra e venda de ações.

## COMO IDENTIFICAR COMPRA OU VENDA (CRÍTICO)

Na seção "Negócios realizados" existe uma coluna chamada "C/V":
- **C** nessa coluna = COMPRA → tipo: "C"
- **V** nessa coluna = VENDA → tipo: "V"

ATENÇÃO: NÃO confunda com a coluna "D/C" (Débito/Crédito do ajuste financeiro):
- D/C = "D" significa que o cliente pagou (Débito) — geralmente acompanha COMPRA
- D/C = "C" significa que o cliente recebeu (Crédito) — geralmente acompanha VENDA
- Use SEMPRE a coluna "C/V" para definir o tipo, nunca a coluna "D/C"

## COMO IDENTIFICAR O TICKER

A coluna "Especificação do título" mostra o nome da ação. Converta para o código B3:
- "PETR" ou "PETROBRAS" → PETR4 (preferencial) ou PETR3 (ordinária)
- "VALE" → VALE3
- "ITUB" ou "ITAU" → ITUB4
- "BBAS" ou "BRASIL" ou "BANCO DO BRASIL" → BBAS3
- "BBDC" ou "BRADESCO" → BBDC4
- "ABEV" ou "AMBEV" → ABEV3
- "WEGE" ou "WEG" → WEGE3
- "RENT" ou "LOCALIZA" → RENT3
- "MGLU" ou "MAGAZINE LUIZA" → MGLU3
- "VBBR" ou "VIBRA" → VBBR3
- "PRIO" ou "PETRORIO" → PRIO3
- "AZZA" ou "AZZAS" → AZZA3
- "INTB" ou "INTELBRAS" → INTB3
- "VULC" ou "VULCABRAS" → VULC3
- "CYRE" ou "CYRELA" → CYRE3
- "GMAT" ou "GRUPO MATEUS" → GMAT3
- "KEPL" ou "KEPLER" → KEPL3
- "SOJA" ou "BOA SAFRA" → SOJA3
- "B3SA" ou "B3 S.A" → B3SA3
- Se não encontrar na lista acima, use as 4-5 primeiras letras do nome + número da classe (3=ON, 4=PN, 11=Unit)
- Nunca inclua sufixos como "ON", "PN", "NM", "ATZ", "F", "ED" no ticker

## FORMATO DE RETORNO

Retorne SOMENTE um JSON válido (sem texto antes ou depois):
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

## REGRAS GERAIS
- quantidade: número inteiro (coluna "Quantidade")
- preco: preço unitário com até 2 casas decimais (coluna "Preço/Ajuste")
- data: data do pregão no topo da nota (formato YYYY-MM-DD)
- Inclua TODAS as operações de ações listadas
- IGNORE taxas, emolumentos, corretagem, ISS e quaisquer outros custos
- Se houver dúvida sobre o ticker, prefira deixar o melhor palpite — o usuário poderá corrigir na tela`

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
