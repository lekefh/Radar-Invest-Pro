import { NextResponse } from 'next/server'

// GET /api/focus
// Retorna projeções anuais do BACEN Focus para Câmbio (BRL/USD)
// Fonte: Expectativas de Mercado – Indicadores Anuais
// Docs: https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/swagger-ui3

const BACEN_BASE = 'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata'

interface FocusRow {
  Data: string   // "2025-07-18"
  Ano: number    // 2026
  Mediana: number
}

async function buscarIndicador(indicador: string): Promise<FocusRow[]> {
  // Encode indicador para URL (ex: "Câmbio" → "C%C3%A2mbio")
  const enc = encodeURIComponent(indicador)
  const url =
    `${BACEN_BASE}/ExpectativaMercadoAnuais` +
    `?$top=100` +
    `&$filter=Indicador%20eq%20'${enc}'%20and%20Suavizada%20eq%20'S'` +
    `&$orderby=Data%20desc,Ano%20asc` +
    `&$select=Data,Ano,Mediana` +
    `&$format=json`

  const r = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 14_400 }, // cache 4h — Focus atualiza semanalmente
  })
  if (!r.ok) throw new Error(`BACEN HTTP ${r.status}`)
  const json = await r.json()
  return (json?.value as FocusRow[]) ?? []
}

function extrairUltimoFoco(rows: FocusRow[]): Record<number, number> {
  if (!rows.length) return {}
  // Encontra a data mais recente
  const maxData = rows.reduce((acc, r) => (r.Data > acc ? r.Data : acc), rows[0].Data)
  // Filtra pela data mais recente e monta mapa Ano → Mediana
  const resultado: Record<number, number> = {}
  for (const row of rows) {
    if (row.Data === maxData) {
      resultado[row.Ano] = Math.round(row.Mediana * 100) / 100
    }
  }
  return resultado
}

export async function GET() {
  try {
    const rows = await buscarIndicador('Câmbio')
    const anos = extrairUltimoFoco(rows)
    const dataRef = rows.length > 0 ? rows[0].Data : null

    // Extrapola: se Focus só vai até certo ano, repete o último valor
    if (Object.keys(anos).length > 0) {
      const anoAtual = new Date().getFullYear()
      const anosDisponiveis = Object.keys(anos).map(Number).sort()
      const ultimoAno = anosDisponiveis[anosDisponiveis.length - 1]
      const ultimoValor = anos[ultimoAno]
      // Garante até 7 anos à frente
      for (let a = anoAtual + 1; a <= anoAtual + 7; a++) {
        if (!(a in anos)) anos[a] = ultimoValor
      }
    }

    return NextResponse.json(
      { anos, data_referencia: dataRef },
      { headers: { 'Cache-Control': 'public, s-maxage=14400, stale-while-revalidate=3600' } }
    )
  } catch (e) {
    return NextResponse.json(
      { erro: String(e), anos: {}, data_referencia: null },
      { status: 502 }
    )
  }
}
