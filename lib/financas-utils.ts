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
  { palavras: ['POSTO','SHELL','PETROBRAS AUTO','IPIRANGA','BR DISTRIBUI','COMBUSTIVEL','COMBUSTÍVEL','GASOLINA','ETANOL','DIESEL'], categoria: 'Combustível' },
  { palavras: ['UBER','99 TAXI','CABIFY','METRO ','METRÔ','ONIBUS','ÔNIBUS','PASSAGEM','TAXI ','TÁXI','BRT','BILHETE UNICO'], categoria: 'Transporte' },
  { palavras: ['FARMACIA','FARMÁCIA','DROGARIA','DROGASIL','ULTRAFARMA','RAIA','PANVEL','MEDICO','MÉDICO','HOSPITAL','CLINICA','CLÍNICA','PLANO SAUDE','UNIMED','HAPVIDA','AMIL','BRADESCO SAUDE','SULAMERICA'], categoria: 'Saúde / Farmácia' },
  { palavras: ['ESCOLA','FACULDADE','UNIVERSIDADE','CURSO','MENSALIDADE','COLEGIO','COLÉGIO','UDEMY','ALURA','COURSERA','WIZARD','CCAA','IDIOMAS'], categoria: 'Educação' },
  { palavras: ['CINEMA','TEATRO','SHOW','INGRESSOS','TICKETMASTER','BILHETERIA','INGRESSO','BOATE','CLUBE','LAZER'], categoria: 'Lazer / Entretenimento' },
  { palavras: ['ALUGUEL','CONDOMINIO','CONDOMÍNIO','AGUA ','ÁGUA ','SABESP','COPASA','COSERN','LUZ ','ENERGIA','CELESC','CEMIG','ENEL','LIGHT ','CPFL','GAS ','GÁS ','COMGAS','INTERNET','CLARO ','VIVO ','TIM ','OI ','NET ','IPTU'], categoria: 'Moradia' },
  { palavras: ['RENNER','C&A','RIACHUELO','MARISA','AMERICANAS','MAGAZINE LUIZA','MAGALU','SHOPEE','MERCADOLIVRE','MERCADO LIVRE','ZARA','SHEIN','LOJAS'], categoria: 'Vestuário / Compras' },
  { palavras: ['SEGURO','SUSEP','PORTO SEGURO','TOKIO MARINE','MAPFRE','LIBERTY'], categoria: 'Seguros' },
  { palavras: ['XPINVEST','XP INVEST','CLEAR','BTG','NUINVEST','CORRETORA','TESOURO DIRETO','CDB','LCI','LCA','FUNDO','RESGATE RDB','RESGATE','APLICACAO','APLICAÇÃO','RENDA FIXA','PREVIDENCIA','PREVIDÊNCIA'], categoria: 'Investimentos / Resgate' },
  { palavras: ['PIX ENVIADO','TRANSF PIX','TED ','DOC ','TRANSFERENCIA','TRANSFERÊNCIA','TRANSFERÊNCIA ENVIADA','TRANSFERÊNCIA RECEBIDA'], categoria: 'Transferências / PIX' },
  { palavras: ['FATURA','PGTO FAT','PAGAMENTO FATURA','PAGTO FATURA','PAGAMENTO CARTAO','PAGAMENTO CARTÃO','CARTAO CREDITO'], categoria: 'Pagamento Cartão' },
  { palavras: ['IMPOSTO','DARF','INSS','FGTS','IOF ','IRPF','IRRF','TAXA ','TRIBUTO','DAS ','MEI '], categoria: 'Impostos / Taxas' },
  { palavras: ['SALARIO','SALÁRIO','ORDENADO','REMUNERACAO','REMUNERAÇÃO','VENCIMENTO','FOLHA','PROLABORE','PRO LABORE','CREDITO SALARIO','CRÉDITO SALÁRIO'], categoria: 'Receita / Entrada' },
  { palavras: ['PADARIA','CAFE ','CAFETERIA','AÇAI','ACAI','SORVETERIA','PANIFICADORA','PASTELARIA'], categoria: 'Alimentação' },
  { palavras: ['PANORAMA','IMPORTS','CABELEI','PRESENTES','AVIAMENTOS'], categoria: 'Vestuário / Compras' },
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
    upper.includes('FATURA') || upper.includes('PGTO FAT') ||
    upper.includes('PAGAMENTO FATURA') || upper.includes('PAGTO FATURA') ||
    upper.includes('PAGAMENTO CARTAO') || upper.includes('PAGAMENTO CARTÃO') ||
    upper.includes('PAG CART') || upper.includes('PGTO CART')
  ) return 'pagamento_cartao'
  if (valor >= 0) return 'receita'
  return 'despesa'
}

// ── Parser de linha CSV com suporte a campos entre aspas ──────────────────────
function parseLinha(linha: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ── Parser de valor inteligente ───────────────────────────────────────────────
// Detecta formato: 1.265,30 (BR) | 1265.06 (US) | 152,30 (BR sem mil)
function parseValorSmart(s: string | number | null | undefined): number {
  if (typeof s === 'number') return s
  const clean = String(s || '').trim().replace(/[R$\s]/g, '').replace(/^['"]+|['"]+$/g, '')
  if (!clean) return 0
  // Ambos . e , presentes → European/BR (. = milhar, , = decimal)
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
  }
  // Só vírgula → decimal BR (152,30)
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.')) || 0
  }
  // Só ponto (US) ou sem separador decimal
  return parseFloat(clean) || 0
}

// ── Converter data para YYYY-MM-DD ────────────────────────────────────────────
function toISO(s: string): string | null {
  if (!s) return null
  // Já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  // DD/MM/YYYY ou DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (br) {
    const [, d, m, y] = br
    const ano = y.length === 2 ? '20' + y : y
    return `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

// ── Parser CSV principal ──────────────────────────────────────────────────────
export function parseCSV(conteudo: string, banco: string): TransacaoPreview[] {
  const linhas = conteudo.split('\n').map(l => l.replace(/\r$/, '').trim()).filter(Boolean)
  if (linhas.length < 2) return []

  // Detecta separador (prioriza ; , depois ,)
  const sep = linhas.slice(0, 5).join('\n').includes(';') ? ';' : ','

  // Encontra linha de cabeçalho (primeiras 15 linhas)
  let headerIdx = 0
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const lower = linhas[i].toLowerCase()
    if (
      lower.includes('data') || lower.includes('date') ||
      lower.includes('hist') || lower.includes('valor') || lower.includes('amount')
    ) {
      headerIdx = i
      break
    }
  }

  const header = parseLinha(linhas[headerIdx], sep).map(h => h.toLowerCase().replace(/['"]/g, '').trim())
  const transacoes: TransacaoPreview[] = []

  // ── NUBANK FATURA: date,title,amount ────────────────────────────────────────
  if (header[0] === 'date' && header[1] === 'title' && header[2] === 'amount') {
    const bancoFinal = banco || 'Nubank'
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const cols = parseLinha(linhas[i], sep)
      if (cols.length < 3) continue
      const data = toISO(cols[0])
      if (!data) continue
      const hist  = cols[1].trim()
      const valor = -Math.abs(parseValorSmart(cols[2])) // fatura = sempre despesa
      transacoes.push({
        data, historico: hist, descricao: '', valor,
        tipo_lancamento: 'despesa', tipo_extrato: 'cartao',
        categoria: categorizar(hist), banco: bancoFinal,
        periodo: data.substring(0, 7),
      })
    }
    return transacoes
  }

  // ── NUBANK CONTA: Data,Valor,Identificador,Descrição ────────────────────────
  const idxDesc = header.findIndex(h => h.includes('descriç') || h.includes('descri') || h === 'memo')
  const idxId   = header.findIndex(h => h.includes('identif') || h.includes('id'))
  if (idxDesc >= 0 && idxId >= 0) {
    const idxData  = header.findIndex(h => h === 'data' || h.startsWith('data '))
    const idxValor = header.findIndex(h => h === 'valor')
    const bancoFinal = banco || 'Nubank'
    for (let i = headerIdx + 1; i < linhas.length; i++) {
      const cols = parseLinha(linhas[i], sep)
      if (cols.length < 3) continue
      const dataRaw = cols[idxData >= 0 ? idxData : 0]
      const valorStr = cols[idxValor >= 0 ? idxValor : 1]
      const hist = cols[idxDesc].trim()
      if (!dataRaw || !hist) continue
      const data = toISO(dataRaw)
      if (!data) continue
      const valor = parseValorSmart(valorStr) // já tem sinal
      transacoes.push({
        data, historico: hist, descricao: '', valor,
        tipo_lancamento: detectarTipo(hist, valor),
        tipo_extrato: 'conta',
        categoria: categorizar(hist), banco: bancoFinal,
        periodo: data.substring(0, 7),
      })
    }
    return transacoes
  }

  // ── FORMATO BRADESCO / GENÉRICO ──────────────────────────────────────────────
  const idxData  = header.findIndex(h => h === 'data' || h.startsWith('data'))
  const idxHist  = header.findIndex(h =>
    h.includes('hist') || h.includes('desc') || h.includes('lançamento') || h.includes('lancamento') || h === 'memo'
  )
  const idxValor = header.findIndex(h => h.includes('valor') || h.includes('montante') || h.includes('quantia'))
  const idxTipo  = header.findIndex(h => h.includes('lança') || h.includes('lanca') || h.includes('tipo'))

  if (idxData < 0 || idxHist < 0 || idxValor < 0) {
    // Fallback: tenta colunas fixas (Data;Lançamento;Histórico;Valor)
    return parseBradescoFixo(linhas.slice(headerIdx + 1), sep, banco)
  }

  const bancoFinal = banco || 'Não informado'
  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const cols = parseLinha(linhas[i], sep)
    if (cols.length < 3) continue
    const dataRaw = cols[idxData]?.trim()
    const hist    = cols[idxHist]?.trim()
    if (!dataRaw || !hist) continue
    const data = toISO(dataRaw)
    if (!data) continue
    let valor = parseValorSmart(cols[idxValor])
    if (idxTipo >= 0 && cols[idxTipo]?.toLowerCase().includes('debit') && valor > 0) valor = -valor
    transacoes.push({
      data, historico: hist, descricao: '', valor,
      tipo_lancamento: detectarTipo(hist, valor), tipo_extrato: 'conta',
      categoria: categorizar(hist), banco: bancoFinal,
      periodo: data.substring(0, 7),
    })
  }
  return transacoes
}

function parseBradescoFixo(linhas: string[], sep: string, banco: string): TransacaoPreview[] {
  const transacoes: TransacaoPreview[] = []
  const bancoFinal = banco || 'Bradesco'
  for (const linha of linhas) {
    const cols = parseLinha(linha, sep)
    if (cols.length < 3) continue
    const dataRaw = cols[0]?.trim()
    if (!dataRaw || !dataRaw.includes('/')) continue
    let hist = '', valor = 0
    if (cols.length >= 4) {
      hist  = cols[2] || cols[1]
      valor = parseValorSmart(cols[3])
      if ((cols[1] || '').toLowerCase().includes('debit') && valor > 0) valor = -valor
    } else {
      hist  = cols[1]
      valor = parseValorSmart(cols[2])
    }
    if (!hist) continue
    const data = toISO(dataRaw)
    if (!data) continue
    transacoes.push({
      data, historico: hist, descricao: '', valor,
      tipo_lancamento: detectarTipo(hist, valor), tipo_extrato: 'conta',
      categoria: categorizar(hist), banco: bancoFinal,
      periodo: data.substring(0, 7),
    })
  }
  return transacoes
}
