import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import dcfRaw from '@/lib/dcf.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcf = dcfRaw as Record<string, any>

function buildPrompt(d: Record<string, unknown>): string {
  const ticker  = d.ticker as string
  const nome    = d.nome   as string
  const method  = (d.method as string || 'fcff').toUpperCase()
  const bear    = d.bear as Record<string, number>
  const base    = d.base as Record<string, number>
  const bull    = d.bull as Record<string, number>
  const wacc    = d.wacc as number
  const g       = d.g_terminal as number
  const preco   = d.preco_atual as number

  return `Você é um analista de renda variável especializado em empresas listadas na B3 brasileira.
Elabore um relatório de investimento profissional e objetivo para a ação ${ticker} (${nome}).

## Dados do Valuation (${method})

**Preço atual:** R$ ${preco?.toFixed(2) ?? '—'}
**Data da análise:** ${d.atualizado ?? new Date().toLocaleDateString('pt-BR')}

**Cenários DCF:**
| Cenário | Preço Justo | Upside |
|---------|-------------|--------|
| 🔴 Pessimista (Bear) | R$ ${bear?.preco?.toFixed(2) ?? '—'} | ${bear?.upside?.toFixed(1) ?? '—'}% |
| 🟡 Base | R$ ${base?.preco?.toFixed(2) ?? '—'} | ${base?.upside?.toFixed(1) ?? '—'}% |
| 🟢 Otimista (Bull) | R$ ${bull?.preco?.toFixed(2) ?? '—'} | ${bull?.upside?.toFixed(1) ?? '—'}% |

**Parâmetros:**
- WACC: ${wacc?.toFixed(2) ?? '—'}%
- g terminal: ${g?.toFixed(1) ?? '—'}%
- Ke: ${(d.wacc_ke as number)?.toFixed(2) ?? '—'}%
- Rf (NTN-B): ${(d.wacc_rf as number)?.toFixed(2) ?? '—'}%
- Beta: ${(d.wacc_beta as number)?.toFixed(2) ?? '—'}
- ERP Brasil: ${(d.wacc_erp as number)?.toFixed(1) ?? '—'}%

${d.g_receita && Array.isArray(d.g_receita) ? `**Projeção de crescimento de receita (${(d.g_receita as number[]).length} anos):**
${(d.g_receita as number[]).map((g, i) => `Ano ${i+1}: ${g?.toFixed(1) ?? '—'}%`).join(' | ')}` : ''}

${d.mg_ebitda && Array.isArray(d.mg_ebitda) ? `**Margens EBITDA projetadas:**
${(d.mg_ebitda as number[]).map((m, i) => `Ano ${i+1}: ${m?.toFixed(1) ?? '—'}%`).join(' | ')}` : ''}

## Instruções para o relatório

Elabore um relatório com as seguintes seções em português:

### 1. Tese de Investimento (3-4 parágrafos)
Explique o negócio, posicionamento competitivo e os principais drivers de valor.

### 2. Pontos Positivos (5-7 bullets)
Principais catalisadores e vantagens competitivas.

### 3. Riscos e Pontos de Atenção (4-6 bullets)
Riscos principais que justificam o cenário Bear.

### 4. Análise do Valuation
Interprete os 3 cenários DCF. Explique o que cada cenário assume. Compare o preço atual com os valores justos.

### 5. Conclusão e Recomendação
Síntese objetiva. Qual cenário parece mais provável e por quê. Nível de convicção (Alta/Média/Baixa).

Seja objetivo, técnico e use linguagem de analista de mercado. Não repita os números da tabela acima — interprete-os. Formato markdown.`
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const t = ticker.toUpperCase()
  const d = dcf[t]

  if (!d) {
    return NextResponse.json(
      { error: `Análise DCF de ${t} não encontrada. Calcule no fundamento.py e rode export_dcf.py.` },
      { status: 404 }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel.' },
      { status: 500 }
    )
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: buildPrompt(d) }],
    })

    const texto = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')

    return NextResponse.json({ ticker: t, relatorio: texto, ts: new Date().toISOString() })
  } catch (e) {
    console.error('[relatorio]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
