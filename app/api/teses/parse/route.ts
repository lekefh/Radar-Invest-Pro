import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// Padrões de extração para métricas do setor elétrico — AXIA3 / elétricas
const PADROES: Record<string, RegExp[]> = {
  pld: [
    /PLD\s+M[eé]dio[^\d]*R?\$?\s*([\d.,]+)\s*\/?\s*MWh/i,
    /Pre[çc]o\s+M[eé]dio[^\d]*R?\$?\s*([\d.,]+)\s*\/?\s*MWh/i,
    /PLD[^\d]*([\d.,]+)\s*R?\$?\/MWh/i,
    /PLD\s+Subs[^\d]*([\d.,]+)/i,
  ],
  gsf: [
    /GSF\s*[:\-]?\s*([\d.,]+)\s*%/i,
    /Generation\s+Scaling\s+Factor[^\d]*([\d.,]+)/i,
    /Fator\s+de\s+Gera[çc][ãa]o[^\d]*([\d.,]+)/i,
  ],
  rap: [
    /RAP\s+(?:Trim(?:estral)?|Contratada)[^\d]*([\d.,]+)/i,
    /Receita\s+Anual\s+Permitida[^\d]*([\d.,]+)/i,
    /RAP\s*R?\$?\s*([\d.,]+)\s*(?:MM|mi|bi)/i,
  ],
  pmso: [
    /PMSO[^\d]*([\d.,]+)\s*(?:MM|mi|bi)?/i,
    /Pessoal.*Material.*Servi[çc]os[^\d]*([\d.,]+)/i,
    /Custo\s+Operacional[^\d]*([\d.,]+)/i,
  ],
  dl_ebitda: [
    /D[ií]vida\s+L[ií]quida\s*\/\s*EBITDA[^\d]*([\d.,]+)x?/i,
    /DL\s*\/\s*EBITDA[^\d]*([\d.,]+)x?/i,
    /Alavancagem[^\d]*([\d.,]+)x/i,
  ],
  lucro: [
    /Lucro\s+L[ií]quido\s+(?:Ajustado|Recorrente)[^\d]*([\d.,]+)/i,
    /Lucro\s+L[ií]quido[^\d]*R?\$?\s*([\d.,]+)\s*(?:MM|mi|bi)/i,
    /LL\s+(?:Ajustado|Recorrente)[^\d]*([\d.,]+)/i,
  ],
  tir_real: [
    /TIR\s+Real[^\d]*([\d.,]+)\s*(?:p\.p\.|pp|%)/i,
    /Taxa\s+Interna\s+de\s+Retorno\s+Real[^\d]*([\d.,]+)/i,
  ],
}

function extrairNumero(texto: string, padroes: RegExp[]): number | null {
  for (const re of padroes) {
    const m = texto.match(re)
    if (m?.[1]) {
      const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
      if (!isNaN(n) && n > 0) return n
    }
  }
  return null
}

// Detecta o trimestre no conteúdo (ex: "1T26", "2T25", "3T24")
function detectarTrimestre(texto: string): string {
  const m = texto.match(/([1-4][TtQq](?:20)?(\d{2}))/i)
  if (m) {
    const raw = m[1].toUpperCase().replace('Q', 'T')
    // Normaliza: "1T26" ou "1T2026"
    if (raw.length === 4) return raw  // 1T26
    if (raw.length === 6) return raw.slice(0, 2) + raw.slice(4) // 1T2026 → 1T26
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const { url } = await req.json()
    if (!url?.trim()) return NextResponse.json({ erro: 'URL obrigatória.' }, { status: 400 })

    // Busca o documento
    let texto = ''
    try {
      const resp = await fetch(url.trim(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarInvestPro/1.0)' },
        signal: AbortSignal.timeout(15_000),
      })

      const ct = resp.headers.get('content-type') ?? ''

      if (ct.includes('application/json')) {
        const json = await resp.json()
        texto = JSON.stringify(json)
      } else if (ct.includes('text') || ct.includes('html')) {
        texto = await resp.text()
      } else {
        // PDF ou binário — converte bytes para string e busca texto legível
        const buf = await resp.arrayBuffer()
        texto = Buffer.from(buf).toString('latin1')
      }
    } catch (fetchErr) {
      console.warn('[parse] fetch error:', fetchErr)
      return NextResponse.json({ erro: 'Não foi possível acessar o documento. Verifique a URL.' }, { status: 400 })
    }

    // Extrai métricas
    const resultado: Record<string, number | string | null> = {
      trimestre: detectarTrimestre(texto),
      pld:       extrairNumero(texto, PADROES.pld),
      gsf:       extrairNumero(texto, PADROES.gsf),
      rap:       extrairNumero(texto, PADROES.rap),
      pmso:      extrairNumero(texto, PADROES.pmso),
      dl_ebitda: extrairNumero(texto, PADROES.dl_ebitda),
      lucro:     extrairNumero(texto, PADROES.lucro),
      tir_real:  extrairNumero(texto, PADROES.tir_real),
    }

    const extraidos = Object.values(resultado).filter(v => v !== null && v !== '').length
    return NextResponse.json({ ok: true, dados: resultado, extraidos })
  } catch (e) {
    console.error('[parse]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
