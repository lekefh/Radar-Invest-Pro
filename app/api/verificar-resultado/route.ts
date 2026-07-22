import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import dcfRaw from '@/lib/dcf.json'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function proximoTri(periodo: string): string | null {
  const m = periodo.match(/^([1-4])T(\d{2})$/)
  if (!m) return null
  const q = parseInt(m[1]), y = parseInt(m[2])
  return q < 4 ? `${q + 1}T${String(y).padStart(2, '0')}` : `1T${String(y + 1).padStart(2, '0')}`
}

function fimTrimestre(periodo: string): Date | null {
  const m = periodo.match(/^([1-4])T(\d{2})$/)
  if (!m) return null
  const q = parseInt(m[1]), y = 2000 + parseInt(m[2])
  const fins: Record<number, [number, number]> = { 1:[2,31], 2:[5,30], 3:[8,30], 4:[11,31] }
  const [mo, dia] = fins[q]
  return new Date(y, mo, dia)
}

function resultadoDisponivel(periodo: string): boolean {
  const fim = fimTrimestre(periodo)
  if (!fim) return false
  return new Date() >= new Date(fim.getTime() + 50 * 24 * 60 * 60 * 1000)
}

function tsParaTrimestre(ts: number): string | null {
  const d = new Date(ts * 1000)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${q}T${String(d.getFullYear()).slice(-2)}`
}

// Termos que indicam resultado trimestral no HTML de páginas RI
function buildTermos(periodo: string): string[] {
  const m = periodo.match(/^([1-4])T(\d{2})$/)
  if (!m) return []
  const q = parseInt(m[1]), y = 2000 + parseInt(m[2])
  const meses: Record<number, string[]> = {
    1: ['março', 'marco', 'march', '1t', '1° trimestre', '1º trimestre'],
    2: ['junho', 'june', '2t', '2° trimestre', '2º trimestre'],
    3: ['setembro', 'september', '3t', '3° trimestre', '3º trimestre'],
    4: ['dezembro', 'december', '4t', '4° trimestre', '4º trimestre'],
  }
  return [
    periodo.toLowerCase(),                  // "2t26"
    `${q}t${y}`,                            // "2t2026"
    `${q}t${String(y).slice(-2)}`,          // já está em periodo
    String(y),                              // "2026"
    ...(meses[q] ?? []),
  ]
}

async function checarRI(riUrl: string, proxPeriodo: string): Promise<{
  encontrado: boolean
  titulosReleases: string[]
  erro: string | null
}> {
  try {
    const r = await fetch(riUrl, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return { encontrado: false, titulosReleases: [], erro: `HTTP ${r.status}` }

    const html = (await r.text()).toLowerCase()
    const termos = buildTermos(proxPeriodo)

    // Procura termos do próximo período esperado no HTML
    const achou = termos.some(t => html.includes(t))

    // Extrai títulos de links que contenham os termos (heurística simples)
    const titulosReleases: string[] = []
    const linkRe = /<a[^>]*>([^<]{5,120})<\/a>/g
    let match
    while ((match = linkRe.exec(html)) !== null) {
      const txt = match[1].trim()
      if (termos.some(t => txt.includes(t)) && !titulosReleases.includes(txt)) {
        titulosReleases.push(txt)
        if (titulosReleases.length >= 5) break
      }
    }

    return { encontrado: achou, titulosReleases, erro: null }
  } catch (e) {
    return { encontrado: false, titulosReleases: [], erro: String(e) }
  }
}

async function checarYahoo(ticker: string): Promise<{
  periodo: string | null
  receita_mm: number | null
  lucro_mm: number | null
  ebit_mm: number | null
  endDate: string | null
  erro: string | null
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}.SA?modules=incomeStatementHistoryQuarterly`
    const r = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    })
    if (!r.ok) return { periodo: null, receita_mm: null, lucro_mm: null, ebit_mm: null, endDate: null, erro: `Yahoo HTTP ${r.status}` }
    const json = await r.json()
    const hist = json?.quoteSummary?.result?.[0]?.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? []
    if (!hist.length) return null

    const latest = hist[0]
    const ts = latest.endDate?.raw as number | undefined
    return {
      periodo:    ts ? tsParaTrimestre(ts) : null,
      receita_mm: latest.totalRevenue?.raw != null ? Math.round(latest.totalRevenue.raw / 1e6 * 10) / 10 : null,
      lucro_mm:   latest.netIncome?.raw    != null ? Math.round(latest.netIncome.raw    / 1e6 * 10) / 10 : null,
      ebit_mm:    latest.ebit?.raw         != null ? Math.round(latest.ebit.raw         / 1e6 * 10) / 10 : null,
      endDate:    latest.endDate?.fmt ?? null,
      erro:       null,
    }
  } catch (e) {
    return { periodo: null, receita_mm: null, lucro_mm: null, ebit_mm: null, endDate: null, erro: String(e) }
  }
}

/* GET /api/verificar-resultado?ticker=CEAB3 */
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ erro: 'ticker obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emp = (dcfRaw as Record<string, any>)[ticker]
  if (!emp) return NextResponse.json({ erro: 'empresa não encontrada no modelo' }, { status: 404 })

  const ultimoConf: string | null = emp.ultimo_periodo_confirmado ?? null
  const proximoEsp = ultimoConf ? proximoTri(ultimoConf) : null
  const riUrl: string | null = emp.ri_url ?? null
  const estimativa = emp.proximo_tri ?? null

  // Buscar em paralelo: RI da empresa + Yahoo Finance
  const [riCheck, yahooCheck] = await Promise.all([
    riUrl && proximoEsp ? checarRI(riUrl, proximoEsp) : Promise.resolve(null),
    checarYahoo(ticker),
  ])

  // Novo período detectado
  const novoDetectado = !!(
    (riCheck?.encontrado) ||
    (yahooCheck?.periodo && proximoEsp && yahooCheck.periodo === proximoEsp)
  )

  return NextResponse.json({
    ticker,
    ultimo_confirmado:   ultimoConf,
    proximo_esperado:    proximoEsp,
    disponivel_por_data: proximoEsp ? resultadoDisponivel(proximoEsp) : false,
    novo_detectado:      novoDetectado,
    ri_check:            riCheck,
    yahoo_recente:       yahooCheck,
    estimativa,
    ri_url:              riUrl,
  })
}
