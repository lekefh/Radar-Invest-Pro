// Utilitários compartilhados do módulo de Finanças Pessoais

export const PLANOS_FINANCAS = ['starter', 'essencial', 'pro', 'analista']

export interface TransacaoPreview {
  data: string          // YYYY-MM-DD
  historico: string
  descricao: string
  valor: number         // positivo = receita, negativo = despesa
  tipo_lancamento: 'despesa' | 'receita' | 'pagamento_cartao'
  tipo_extrato: 'conta' | 'cartao'
  categoria: string
  banco: string
  periodo: string
}

// ── Regras de categorização por palavras-chave ────────────────────────────────
const REGRAS: { palavras: string[]; categoria: string }[] = [
  { palavras: ['MERCADO','SUPER ','ASSAI','ATACADAO','ATACADÃO','CARREFOUR','EXTRA','WALMART','SUPERMERCADO','HIPER'], categoria: 'Mercado' },
  { palavras: ['RESTAURANTE','PIZZARIA','LANCHONETE','IFOOD','RAPPI','99FOOD','BURGER','MCDONALDS','SUBWAY','BURGUER','FOODIE','DELIVERY'], categoria: 'Restaurante' },
  { palavras: ['NETFLIX','SPOTIFY','AMAZON PRIME','YOUTUBE','DISNEY','GLOBOPLAY','PARAMOUNT','HBOMAX','APPLE TV','PRIME VIDEO','DEEZER','MICROSOFT','GOOGLE ONE'], categoria: 'Plataformas Digitais' },
  { palavras: ['POSTO','SHELL','PETROBRAS AUTO','IPIRANGA','BR DISTRIBUI','COMBUSTIVEL','COMBUSTÍVEL','GASOLINA','ETANOL','DIESEL','ARLA'], categoria: 'Combustível' },
  { palavras: ['UBER','99 TAXI','CABIFY','METRO ','METRÔ','ONIBUS','ÔNIBUS','PASSAGEM','TAXI ','TÁXI','BRT','BILHETE UNICO','PASSAGEM AREA'], categoria: 'Transporte' },
  { palavras: ['FARMACIA','FARMÁCIA','DROGARIA','DROGASIL','ULTRAFARMA','RAIA','PANVEL','MEDICO','MÉDICO','HOSPITAL','CLINICA','CLÍNICA','PLANO SAUDE','UNIMED','HAPVIDA','AMIL','BRADESCO SAUDE','SULAMERICA'], categoria: 'Saúde / Farmácia' },
  { palavras: ['ESCOLA','FACULDADE','UNIVERSIDADE','CURSO','MENSALIDADE','COLEGIO','COLÉGIO','UDEMY','ALURA','COURSERA','WIZARD','CCAA','INGLES','INGLÊS'], categoria: 'Educação' },
  { palavras: ['CINEMA','TEATRO','SHOW','INGRESSOS','TICKETMASTER','BILHETERIA','INGRESSO','BOATE','CLUBE','LAZER'], categoria: 'Lazer / Entretenimento' },
  { palavras: ['ALUGUEL','CONDOMINIO','CONDOMÍNIO','AGUA ','ÁGUA ','SABESP','COPASA','COSERN','LUZ ','ENERGIA','CELESC','CEMIG','ENEL','LIGHT ','CPFL','GAS ','GÁS ','COMGAS','CÔMGAS','INTERNET','CLARO ','VIVO ','TIM ','OI ','NET ','IPTU','IMÓVEL','IMOVEL'], categoria: 'Moradia' },
  { palavras: ['RENNER','C&A','RIACHUELO','MARISA','AMERICANAS','MAGAZINE LUIZA','MAGALU','SHOPEE','MERCADOLIVRE','MERCADO LIVRE','ZARA','H&M','VIVARA','RESERVA','COMPRAS','SHEIN','LOJAS'], categoria: 'Vestuário / Compras' },
  { palavras: ['SEGURO','SUSEP','PORTO SEGURO','TOKIO MARINE','MAPFRE','LIBERTY','ZURICH'], categoria: 'Seguros' },
  { palavras: ['XPINVEST','XP INVEST','CLEAR','BTG PACTUAL','NUINVEST','CORRETORA','TESOURO DIRETO','CDB','LCI','LCA','FUNDO','RESGATE','APLICACAO','APLICAÇÃO','RENDA FIXA','PREVIDENCIA','PREVIDÊNCIA','MODAL MAIS','RICO INVEST'], categoria: 'Investimentos / Resgate' },
  { palavras: ['PIX ENVIADO','PIX RECEBIDO','TRANSF PIX','TED ','DOC ','TRANSFERENCIA','TRANSFERÊNCIA'], categoria: 'Transferências / PIX' },
  { palavras: ['FATURA','PGTO FAT','PAGAMENTO FATURA','PAGTO FATURA','PAGAMENTO CARTAO','PAGAMENTO CARTÃO','CARTAO CREDITO','CARTÃO CRÉDITO'], categoria: 'Pagamento Cartão' },
  { palavras: ['IMPOSTO','DARF','INSS','FGTS','IOF ','IRPF','IRRF','TAXA ','TRIBUTO','DAS ','MEI ','SIMPLES NACIONAL'], categoria: 'Impostos / Taxas' },
  { palavras: ['SALARIO','SALÁRIO','ORDENADO','REMUNERACAO','REMUNERAÇÃO','VENCIMENTO','FOLHA','PROLABORE','PRO LABORE','CREDITO SALARIO','CRÉDITO SALÁRIO'], categoria: 'Receita / Entrada' },
  { palavras: ['PADARIA','CAFE ','CAFETERIA','AÇAI','ACAI','SORVETERIA','PANIFICADORA','CONFEITARIA','PASTELARIA','SALGADERIA'], categoria: 'Alimentação' },
]

export function categorizar(texto: string): string {
  const upper = texto.toUpperCase()
  for (const { palavras, categoria } of REGRAS) {
    if (palavras.some(p => upper.includes(p))) return categoria
  }
  return 'Outros'
}

export function detectarTipo(historico: string, valor: number): 'despesa' | 'receita' | 'pagamento_cartao' {
  const upper = historico.toUpperCase()
  if (
    upper.includes('FATURA') ||
    upper.includes('PGTO FAT') ||
    upper.includes('PAGAMENTO FATURA') ||
    upper.includes('PAGTO FATURA') ||
    upper.includes('PAGAMENTO CARTAO') ||
    upper.includes('PAGAMENTO CARTÃO') ||
    upper.includes('PAG CART') ||
    upper.includes('PGTO CART')
  ) return 'pagamento_cartao'
  if (valor >= 0) return 'receita'
  return 'despesa'
}

// ── Parser CSV Bradesco ───────────────────────────────────────────────────────
// Formato: Data;Lançamento;Histórico;Valor ou Data;Histórico;Valor
function parseDateBR(s: string): string {
  const [d, m, y] = s.trim().split('/')
  if (!d || !m || !y) return s
  return `${y.length === 2 ? '20' + y : y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}

function parseValor(s: string): number {
  const limpo = s.trim().replace(/\./g,'').replace(',','.')
  return parseFloat(limpo) || 0
}

export function parseCSV(conteudo: string, banco: string): TransacaoPreview[] {
  const linhas = conteudo.split('\n').map(l => l.trim()).filter(Boolean)
  const transacoes: TransacaoPreview[] = []

  // Detecta separador
  const sep = conteudo.includes(';') ? ';' : ','

  // Encontra linha de cabeçalho
  let headerIdx = 0
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    const lower = linhas[i].toLowerCase()
    if (lower.includes('data') && (lower.includes('hist') || lower.includes('valor') || lower.includes('lança'))) {
      headerIdx = i
      break
    }
  }

  const header = linhas[headerIdx].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g,''))

  const idxData     = header.findIndex(h => h === 'data' || h.startsWith('data'))
  const idxHistorico = header.findIndex(h =>
    h.includes('hist') || h.includes('desc') || h.includes('lançamento') || h.includes('lancamento') || h.includes('memo')
  )
  const idxValor     = header.findIndex(h => h.includes('valor') || h.includes('montante') || h.includes('quantia'))
  const idxTipo      = header.findIndex(h => h.includes('lança') || h.includes('lanca') || h.includes('tipo') || h.includes('credito') || h.includes('débito'))

  if (idxData < 0 || idxHistorico < 0 || idxValor < 0) {
    // Fallback: tenta formato Bradesco com colunas fixas Data;Lançamento;Histórico;Valor
    return parseBradescoFixo(linhas.slice(headerIdx + 1), sep, banco)
  }

  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g,''))
    if (cols.length < 3) continue

    const dataRaw = cols[idxData] || ''
    const hist    = cols[idxHistorico] || ''
    const valRaw  = cols[idxValor] || '0'
    const tipoRaw = idxTipo >= 0 ? (cols[idxTipo] || '') : ''

    if (!dataRaw || !hist) continue

    const data  = dataRaw.includes('/') ? parseDateBR(dataRaw) : dataRaw
    let valor   = parseValor(valRaw)

    // Bradesco: "Debitado" indica débito → negativo
    if (tipoRaw && tipoRaw.toLowerCase().includes('debit') && valor > 0) valor = -valor

    const periodo = data.substring(0, 7)
    const tipo_lancamento = detectarTipo(hist, valor)
    const categoria = categorizar(hist)

    transacoes.push({
      data, historico: hist, descricao: '',
      valor, tipo_lancamento, tipo_extrato: 'conta',
      categoria, banco, periodo,
    })
  }
  return transacoes
}

function parseBradescoFixo(linhas: string[], sep: string, banco: string): TransacaoPreview[] {
  const transacoes: TransacaoPreview[] = []
  for (const linha of linhas) {
    const cols = linha.split(sep).map(c => c.trim().replace(/^["']|["']$/g,''))
    if (cols.length < 3) continue

    const dataRaw = cols[0]
    if (!dataRaw || !dataRaw.includes('/')) continue

    let hist  = ''
    let valor = 0

    if (cols.length >= 4) {
      // Data;Lançamento;Histórico;Valor
      hist  = cols[2] || cols[1]
      valor = parseValor(cols[3])
      if ((cols[1] || '').toLowerCase().includes('debit') && valor > 0) valor = -valor
    } else {
      // Data;Histórico;Valor
      hist  = cols[1]
      valor = parseValor(cols[2])
    }

    if (!hist) continue
    const data    = parseDateBR(dataRaw)
    const periodo = data.substring(0, 7)
    const tipo_lancamento = detectarTipo(hist, valor)
    const categoria = categorizar(hist)

    transacoes.push({
      data, historico: hist, descricao: '',
      valor, tipo_lancamento, tipo_extrato: 'conta',
      categoria, banco, periodo,
    })
  }
  return transacoes
}
