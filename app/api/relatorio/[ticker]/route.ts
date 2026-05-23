import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import dcfRaw from '@/lib/dcf.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcf = dcfRaw as Record<string, any>

/* ── Contexto setorial injetado no prompt ─────────────────────────────────── */
function getContextoSetor(ticker: string, setor: string): string {
  // Holdings e conglomerados: análise NAV
  const HOLDINGS = ['CSAN3', 'ITSA4', 'BRGE11', 'SOMA3']
  if (HOLDINGS.includes(ticker) || ticker.startsWith('CSAN')) {
    return `
**Tipo: Holding / Conglomerado**
Framework de análise obrigatório:
• NAV (Net Asset Value): valorize cada subsidiária separadamente pelo valor de mercado das participações.
  Aplique desconto de holding de 20–35% — justifique qual desconto é adequado para esta empresa.
• Dívida da holding parent vs. dividendos recebidos das subsidiárias: a holding é sustentável sem
  precisar se endividar mais para cobrir despesas corporativas?
• Alavancagem proporcional consolidada: some a parcela proporcional da dívida de cada subsidiária
  ao balanço da holding — isso revela a alavancagem real do grupo.
• Qualidade dos ativos: quais subsidiárias geram caixa estruturalmente? Quais são consumidoras?
• Catalisadores para fechamento do desconto: IPO de subsidiária, venda de participação, simplificação.
• Riscos de contágio: dificuldade financeira em uma subsidiária pode forçar aporte da holding.`
  }

  const ctx: Record<string, string> = {
    agro: `
**Setor: Agronegócio**
Framework de análise obrigatório:
• Preço das commodities (soja, milho, açúcar, etanol) e câmbio BRL/USD — driver primário de receita.
• Volume de produção/safra: La Niña vs. El Niño, pragas, tecnologia de sementes.
• Custo de produção por unidade (terra, insumos, frete) — compare com referência Mato Grosso.
• Política de hedge: % da produção protegida e preço de exercício vs. custo de produção.
• Demanda China: principal comprador global de soja e proteína animal brasileira.
• Para proteína animal: ciclo biológico (expansão de plantel leva 12-18 meses) e risco de surtos sanitários.`,

    varejo: `
**Setor: Varejo**
Framework de análise obrigatório:
• SSS (Same Store Sales): separe volume de preço. SSS negativo por >2 trimestres = sinal crítico.
• Margem EBITDA ex-IFRS 16: compare com histórico e peers — varejo físico típico 8–15%.
• Giro de estoque (dias): acima de 90 dias é alerta de capital de giro travado.
• ROIC vs. WACC: se ROIC < WACC, a expansão de lojas DESTRÓI valor.
• Ciclo de crédito ao consumidor: renda real, emprego e endividamento das famílias.
• Câmbio: impacto em produtos importados (eletrônicos, vestuário premium).`,

    bancario: `
**Setor: Bancos e Financeiras**
Framework de análise obrigatório:
• ROE e NIM: acima de 18% ROE é forte; NIM indica poder de pricing.
• NPL >90d e índice de cobertura: NPL subindo + cobertura caindo = deterioração de qualidade.
• Índice de eficiência: abaixo de 45% é excelente; acima de 55% é alerta.
• PCLD: provisões consomem resultado — distinguir provisões estruturais de pontuais.
• Basileia: confortável acima de 13%.
• Ciclo de juros (SELIC): alta de juros aumenta NIM mas pressiona inadimplência PF/PME.`,

    seguro: `
**Setor: Seguradoras**
Framework de análise obrigatório:
• Combined Ratio: abaixo de 100% = lucro no seguro; excelência abaixo de 90%.
• Sinistralidade por ramo: saúde >80% é normal; auto 60–70%.
• Resultado financeiro do float: SELIC alta é muito positivo para resultado financeiro.
• ROAE: acima de 20% indica excelência operacional.
• Risco de catástrofe: eventos climáticos, surtos de saúde, concentração de portfólio.
• Canal de distribuição: bancassurance tem risco de renovação do acordo com banco controlador.`,

    energia: `
**Setor: Energia Elétrica / Utilidades**
Framework de análise obrigatório:
• RAB (Base de Ativos Regulatórios) e WACC regulatório ANEEL: revisar ciclo de revisão tarifária.
• GSF e nível dos reservatórios: seca reduz geração hídrica e força compra cara no spot (PLD).
• PLD (preço spot): volatilidade extrema — pico pode comprimir ou expandir margem drasticamente.
• CapEx e alavancagem DL/EBITDA: utilities toleram 3–4x pela previsibilidade de receita.
• IPCA como indexador: proteção natural contra inflação nas tarifas.
• Renovação de concessões e risco regulatório: mudanças de governo afetam regras do jogo.`,

    papel_celulose: `
**Setor: Papel e Celulose**
Framework de análise obrigatório:
• Preço BHKP (FOEX PIX, USD/t): driver primário — cada US$10/t move bilhões de EBITDA em escala.
• Câmbio BRL/USD: custo em reais, receita em dólar — real fraco amplifica margens.
• Custo caixa de produção (R$/t): eucalipto brasileiro tem menor custo global; detalhe histórico.
• Utilização da capacidade instalada: paradas programadas e não programadas impactam diretamente.
• Ciclo de preços BHKP (típico 3–5 anos): identifique em que ponto do ciclo a empresa está.
• Demanda China: maior importador de celulose; desaceleração chinesa pressiona preço global.`,

    construcao: `
**Setor: Construção Civil e Incorporação**
Framework de análise obrigatório:
• VSO (Velocidade de Venda sobre Oferta) >30% é saudável; abaixo de 15% é crítico.
• Landbank: volume, localização e custo de aquisição — chave para margem bruta futura.
• Margem bruta: 30–35% é referência; compare com histórico e informe se está comprimindo.
• Distratos: cancelamentos >15% das vendas indicam produto errado ou problemas de crédito.
• Segmento MCMV: dependente de subsídio FGTS e política habitacional do governo.
• SELIC e taxa de financiamento: impacto direto na capacidade de pagamento dos compradores.`,
  }

  return ctx[setor] ?? ''
}

/* ── Builder do prompt ────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPrompt(d: Record<string, any>): string {
  const ticker = d.ticker as string
  const nome   = d.nome   as string
  const setor  = (d.setor as string) ?? 'varejo'
  const method = ((d.method as string) ?? 'fcff').toUpperCase()
  const bear   = (d.bear  as Record<string, number>) ?? {}
  const base   = (d.base  as Record<string, number>) ?? {}
  const bull   = (d.bull  as Record<string, number>) ?? {}
  const wacc   = d.wacc   as number
  const g      = d.g_terminal as number
  const preco  = d.preco_atual as number

  const ctxSetor = getContextoSetor(ticker, setor)

  const projecoes = d.g_receita && Array.isArray(d.g_receita)
    ? `\n**Projeção de crescimento de receita (${(d.g_receita as number[]).length} anos):**\n` +
      (d.g_receita as number[]).map((g: number, i: number) => `Ano ${i+1}: ${g?.toFixed(1) ?? '—'}%`).join(' | ')
    : ''

  const margens = d.mg_ebitda && Array.isArray(d.mg_ebitda)
    ? `\n**Margens EBITDA projetadas:**\n` +
      (d.mg_ebitda as number[]).map((m: number, i: number) => `Ano ${i+1}: ${m?.toFixed(1) ?? '—'}%`).join(' | ')
    : ''

  return `Você é um analista sênior de renda variável com especialização em empresas brasileiras listadas na B3.
Elabore um relatório de valuation aprofundado e objetivo para ${ticker} (${nome}).

REGRAS ABSOLUTAS — NÃO QUEBRE:
1. NUNCA use as palavras "Recomendação:", "COMPRA", "VENDA", "NEUTRO" ou qualquer label de recomendação.
   A plataforma Radar Invest Pro não emite recomendações — apenas análises técnicas.
2. Use apenas "Preço-Alvo (Base):" para referenciar o valor justo no cenário base.
3. Seja específico sobre ESTA empresa — evite generalidades que poderiam se aplicar a qualquer empresa.
4. Os riscos devem ser CONCRETOS e ATUAIS — mencione eventos reais, subsidiárias, dívidas específicas,
   contratos relevantes, pressões regulatórias em andamento. Nada de riscos genéricos de livro-texto.
5. Mínimo de 6 riscos detalhados — cada um com contexto de por que importa AGORA para esta empresa.

## Dados Quantitativos do Modelo (${method})

**Preço atual:** R$ ${preco?.toFixed(2) ?? '—'}
**Data:** ${d.atualizado ?? new Date().toLocaleDateString('pt-BR')}

| Cenário | Preço-Alvo | Upside/Downside vs. Preço Atual |
|---------|-----------|--------------------------------|
| Pessimista (Bear) | R$ ${bear?.preco?.toFixed(2) ?? '—'} | ${bear?.upside?.toFixed(1) ?? '—'}% |
| Base | R$ ${base?.preco?.toFixed(2) ?? '—'} | ${base?.upside?.toFixed(1) ?? '—'}% |
| Otimista (Bull) | R$ ${bull?.preco?.toFixed(2) ?? '—'} | ${bull?.upside?.toFixed(1) ?? '—'}% |

**WACC:** ${wacc?.toFixed(2) ?? '—'}% &nbsp;|&nbsp; **g terminal:** ${g?.toFixed(1) ?? '—'}%
**Ke:** ${(d.wacc_ke as number)?.toFixed(2) ?? '—'}% &nbsp;|&nbsp; **Rf (NTN-B):** ${(d.wacc_rf as number)?.toFixed(2) ?? '—'}% &nbsp;|&nbsp; **Beta:** ${(d.wacc_beta as number)?.toFixed(2) ?? '—'} &nbsp;|&nbsp; **ERP Brasil:** ${(d.wacc_erp as number)?.toFixed(1) ?? '—'}%
${projecoes}${margens}

## Framework Setorial Aplicável
${ctxSetor}

## Estrutura do Relatório (siga exatamente)

Formate em Markdown. Cada seção deve ser substancial e específica para ${ticker}.

## 1. Perfil do Negócio e Posicionamento
Descreva o modelo de negócio, fontes de receita, posição competitiva e diferenciais. Para holdings,
detalhe cada subsidiária relevante com % de participação e contribuição estimada de valor.

## 2. Drivers de Valor e Catalisadores

Liste 6–8 pontos com análise real de cada um. Para cada catalisador, indique:
- O que precisa acontecer para ele se materializar
- Em qual horizonte temporal (curto/médio/longo prazo)
- Qual o impacto estimado no valuation

## 3. Riscos e Ameaças — Análise Detalhada

Liste MÍNIMO 6 riscos com profundidade. Para cada risco:
- Descreva o risco com precisão (não use linguagem vaga)
- Explique por que é relevante ESPECIFICAMENTE para ${ticker} neste momento
- Indique a probabilidade qualitativa (alta/média/baixa) e o impacto potencial
- Se houver evento concreto em andamento (dívida vencendo, processo judicial, mudança regulatória), mencione

Exemplo do nível de especificidade esperado: em vez de "risco de alavancagem", escreva
"A subsidiária X carrega R$YB de dívida bruta com DL/EBITDA de Xv e vencimentos concentrados
em 20XX, o que pode forçar a holding a aportar capital ou aceitar diluição em condições desfavoráveis".

## 4. Análise do Valuation DCF

- Interprete as premissas implícitas em cada cenário (o que o mercado precisa crer para cada um ser correto)
- Questione se as premissas são conservadoras, realistas ou otimistas dado o contexto atual
- Compare o EV implícito com múltiplos históricos e de peers
- Indique qual cenário parece mais aderente à realidade atual e por quê

## 5. Síntese e Perspectiva

Parágrafo de síntese: o que o investidor precisa monitorar trimestralmente para saber se a tese está
se confirmando ou deteriorando. Liste 3–4 métricas-gatilho (ex: "se a margem EBITDA cair abaixo de X%
por 2 trimestres consecutivos, a premissa de recuperação operacional está comprometida").
Não emita recomendação — apenas descreva o nível de convicção analítica e as condições que sustentam ou destroem a tese.

Formato final: Markdown limpo. Sem tabelas duplicando os números já mostrados acima. Linguagem técnica mas acessível.`
}

/* ── Handler ──────────────────────────────────────────────────────────────── */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const t = ticker.toUpperCase()
  const d = dcf[t]

  if (!d) {
    return NextResponse.json(
      { error: `Análise DCF de ${t} não encontrada. Calcule no app e rode Exportar para Web.` },
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
      model:      'claude-opus-4-7',   // Opus para análise mais profunda e específica
      max_tokens: 4096,
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
