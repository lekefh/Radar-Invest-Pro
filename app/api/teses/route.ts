import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

// ── Definição de métricas e stops por setor ───────────────────────────────────
const CONFIGS_SETOR: Record<string, {
  metricas: object[]
  stops: string[]
}> = {
  energia: {
    metricas: [
      { key: 'pld',       label: 'PLD médio',         unidade: 'R$/MWh', verde: 250,  vermelho: 180,  sentido: 'maior' },
      { key: 'gsf',       label: 'GSF',               unidade: '%',      verde: 88,   vermelho: 82,   sentido: 'maior' },
      { key: 'rap',       label: 'RAP trimestral',    unidade: 'R$ MM',  verde: 4200, vermelho: 3800, sentido: 'maior' },
      { key: 'pmso',      label: 'PMSO trimestral',   unidade: 'R$ MM',  verde: 1600, vermelho: 1800, sentido: 'menor' },
      { key: 'dl_ebitda', label: 'DL/EBITDA',         unidade: 'x',      verde: 2.0,  vermelho: 2.8,  sentido: 'menor' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B', unidade: 'p.p.',   verde: 4.0,  vermelho: 1.0,  sentido: 'maior' },
    ],
    stops: [
      'GSF < 82% por 2 trimestres consecutivos E PLD < R$180/MWh',
      'DL/EBITDA > 3,0x por 1 trimestre',
      'TIR Real implícita cai abaixo de NTN-B + 1 p.p.',
      'WACC regulatório ANEEL reduzido abaixo de 8% real',
    ],
  },

  banco: {
    metricas: [
      { key: 'gsf',       label: 'ROE / ROAE',        unidade: '%',      verde: 17,   vermelho: 12,   sentido: 'maior' },
      { key: 'pld',       label: 'NPL >90d',          unidade: '%',      verde: 3.5,  vermelho: 5.5,  sentido: 'menor' },
      { key: 'rap',       label: 'NIM / Marg. Fin.',  unidade: 'R$ MM',  verde: 20000,vermelho: 15000,sentido: 'maior' },
      { key: 'pmso',      label: 'PCLD trimestral',   unidade: 'R$ MM',  verde: 8000, vermelho: 12000,sentido: 'menor' },
      { key: 'dl_ebitda', label: 'Carteira (R$bi)',   unidade: 'R$bi',   verde: 1050, vermelho: 950,  sentido: 'maior' },
      { key: 'tir_real',  label: 'Eficiência',        unidade: '%',      verde: 45,   vermelho: 58,   sentido: 'menor' },
      { key: 'lucro',     label: 'Lucro líquido',     unidade: 'R$ MM',  verde: 6500, vermelho: 4000, sentido: 'maior' },
    ],
    stops: [
      'ROE cai abaixo de 12% por 2 trimestres consecutivos',
      'NPL >90d sobe acima de 5,5% por 2 trimestres consecutivos',
      'Lucro LL cai > 20% a/a por 2 trimestres consecutivos',
      'Provisão extraordinária (evento único > R$2bi)',
    ],
  },

  seguro: {
    metricas: [
      { key: 'gsf',       label: 'ROE / ROAE',          unidade: '%',     verde: 20,   vermelho: 14,   sentido: 'maior' },
      { key: 'pld',       label: 'Índice Combinado',    unidade: '%',     verde: 88,   vermelho: 96,   sentido: 'menor' },
      { key: 'rap',       label: 'Prêmios ganhos',      unidade: 'R$ MM', verde: 8000, vermelho: 6000, sentido: 'maior' },
      { key: 'pmso',      label: 'Sinistralidade',      unidade: '%',     verde: 70,   vermelho: 82,   sentido: 'menor' },
      { key: 'dl_ebitda', label: 'Beneficiários (mil)', unidade: 'mil',   verde: 850,  vermelho: 700,  sentido: 'maior' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',  unidade: 'p.p.',  verde: 4.0,  vermelho: 1.0,  sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',       unidade: 'R$ MM', verde: 900,  vermelho: 600,  sentido: 'maior' },
    ],
    stops: [
      'Índice Combinado > 96% por 2 trimestres consecutivos',
      'Sinistralidade Porto Saúde > 85% por 2 trimestres',
      'ROE cai abaixo de 14%',
      'TIR Real cai abaixo de NTN-B + 1 p.p.',
    ],
  },

  varejo: {
    metricas: [
      { key: 'gsf',       label: 'SSS (%)',            unidade: '%',     verde: 5,    vermelho: 0,    sentido: 'maior' },
      { key: 'pld',       label: 'Mg EBITDA ex',       unidade: '%',     verde: 13,   vermelho: 9,    sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',    unidade: 'R$ MM', verde: 3000, vermelho: 2500, sentido: 'maior' },
      { key: 'pmso',      label: 'Ciclo de caixa',     unidade: 'dias',  verde: 90,   vermelho: 120,  sentido: 'menor' },
      { key: 'dl_ebitda', label: 'DL/EBITDA',          unidade: 'x',     verde: 1.5,  vermelho: 3.0,  sentido: 'menor' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',  unidade: 'p.p.',  verde: 3.0,  vermelho: 0.0,  sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',      unidade: 'R$ MM', verde: 500,  vermelho: 200,  sentido: 'maior' },
    ],
    stops: [
      'SSS negativo por 2 trimestres consecutivos',
      'DL/EBITDA > 3,0x por 1 trimestre',
      'Mg EBITDA ex-IFRS16 < 9% por 2 trimestres',
      'TIR Real cai abaixo de NTN-B + 0 p.p.',
    ],
  },

  agro: {
    metricas: [
      { key: 'gsf',       label: 'Volume safra (mil t)', unidade: 'kt',   verde: 800,  vermelho: 600,  sentido: 'maior' },
      { key: 'pld',       label: 'Preço soja (R$/sc)',   unidade: 'R$/sc',verde: 140,  vermelho: 105,  sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',      unidade: 'R$ MM',verde: 700,  vermelho: 500,  sentido: 'maior' },
      { key: 'pmso',      label: 'Mg EBITDA',            unidade: '%',    verde: 10,   vermelho: 6,    sentido: 'maior' },
      { key: 'dl_ebitda', label: 'DL/EBITDA',            unidade: 'x',    verde: 1.0,  vermelho: 2.5,  sentido: 'menor' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',   unidade: 'p.p.', verde: 3.0,  vermelho: 0.0,  sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',        unidade: 'R$ MM',verde: 100,  vermelho: 30,   sentido: 'maior' },
    ],
    stops: [
      'Safra abaixo de -20% do guidance por 1 semestre',
      'Preço soja < R$100/sc por 2 trimestres (destrói tese)',
      'DL/EBITDA > 2,5x',
      'Mg EBITDA < 6% por 2 trimestres consecutivos',
    ],
  },

  construcao: {
    metricas: [
      { key: 'gsf',       label: 'VSO (%)',             unidade: '%',     verde: 30,   vermelho: 15,   sentido: 'maior' },
      { key: 'pld',       label: 'Lançamentos (R$ MM)', unidade: 'R$ MM', verde: 3000, vermelho: 1500, sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',     unidade: 'R$ MM', verde: 2000, vermelho: 1200, sentido: 'maior' },
      { key: 'pmso',      label: 'Mg Bruta',            unidade: '%',     verde: 32,   vermelho: 24,   sentido: 'maior' },
      { key: 'dl_ebitda', label: 'DL/PL',               unidade: 'x',     verde: 0.5,  vermelho: 1.2,  sentido: 'menor' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',  unidade: 'p.p.',  verde: 3.0,  vermelho: 0.0,  sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',       unidade: 'R$ MM', verde: 400,  vermelho: 150,  sentido: 'maior' },
    ],
    stops: [
      'VSO < 15% por 2 trimestres consecutivos',
      'Mg Bruta < 24% (sinalizou piora estrutural de custo)',
      'DL/PL > 1,2x por 1 trimestre',
      'Distratos > 15% das vendas por 2 trimestres',
    ],
  },

  celulose: {
    // SUZB3 — Driver #1: Preço BHKP (USD/t) × câmbio. Driver #2: Volume (kt). Driver #3: Custo caixa.
    // Campos reutilizados: pld=BHKP USD/t | gsf=Vol.Celulose kt | rap=Receita | pmso=Custo Caixa | dl_ebitda=DL/EBITDA
    metricas: [
      { key: 'pld',       label: 'BHKP (USD/t)',         unidade: 'USD/t',  verde: 620,  vermelho: 520,  sentido: 'maior' },
      { key: 'gsf',       label: 'Vol. Celulose (kt)',   unidade: 'kt',     verde: 3000, vermelho: 2500, sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',      unidade: 'R$ MM',  verde: 12000,vermelho: 9000, sentido: 'maior' },
      { key: 'pmso',      label: 'Custo Caixa (R$/t)',   unidade: 'R$/t',   verde: 830,  vermelho: 950,  sentido: 'menor' },
      { key: 'dl_ebitda', label: 'DL/EBITDA',            unidade: 'x',      verde: 3.0,  vermelho: 4.0,  sentido: 'menor' },
      { key: 'lucro',     label: 'EBITDA Ajustado',      unidade: 'R$ MM',  verde: 5500, vermelho: 3500, sentido: 'maior' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',   unidade: 'p.p.',   verde: 3.0,  vermelho: 0.0,  sentido: 'maior' },
    ],
    stops: [
      'BHKP < USD 500/t por 2 trimestres consecutivos (tese de recuperação destruída)',
      'Custo caixa > R$950/t por 2 trimestres (perde vantagem competitiva global)',
      'DL/EBITDA > 4,0x por 1 trimestre (risco de liquidez — dívida em USD)',
      'TIR Real implícita cai abaixo de NTN-B + 0 p.p.',
    ],
  },
}

// Mapa ticker → setor (baseado em COMPANIES do dcf.py)
const TICKER_SETOR: Record<string, { nome: string; setor: string }> = {
  'AXIA3':  { nome: 'Âxia Energia S.A.',          setor: 'energia'    },
  'CPFE3':  { nome: 'CPFL Energia S.A.',           setor: 'energia'    },
  'BBAS3':  { nome: 'Banco do Brasil S.A.',        setor: 'banco'      },
  'BBDC4':  { nome: 'Banco Bradesco S.A.',         setor: 'banco'      },
  'BBSE3':  { nome: 'BB Seguridade',               setor: 'seguro'     },
  'PSSA3':  { nome: 'Porto Seguro S.A.',           setor: 'seguro'     },
  'AZZA3':  { nome: 'Azzas 2154 S.A.',             setor: 'varejo'     },
  'VULC3':  { nome: 'Vulcabras S.A.',              setor: 'varejo'     },
  'GMAT3':  { nome: 'Grupo Mateus S.A.',           setor: 'varejo'     },
  'SOJA3':  { nome: 'Boa Safra Sementes S.A.',     setor: 'agro'       },
  'CYRE3':  { nome: 'Cyrela Realty S.A.',          setor: 'construcao' },
  'JHSF3':  { nome: 'JHSF Participações S.A.',    setor: 'construcao' },
  'CXSE3':  { nome: 'Caixa Seguridade Participações S.A.', setor: 'seguro' },
  'B3SA3':  { nome: 'B3 S.A.',                    setor: 'banco'      },
  'CSAN3':  { nome: 'Cosan S.A.',                  setor: 'varejo'     },
  'INTB3':  { nome: 'Intelbras S.A.',              setor: 'varejo'     },
  'KEPL3':  { nome: 'Kepler Weber S.A.',           setor: 'varejo'     },
  'SUZB3':  { nome: 'Suzano S.A.',                 setor: 'celulose'   },
  'EQTL3':  { nome: 'Equatorial Energia S.A.',     setor: 'energia'    },
  'CMIG4':  { nome: 'Cemig S.A.',                  setor: 'energia'    },
  'GUAR3':  { nome: 'Guararapes Confecções S.A. (Riachuelo)', setor: 'varejo' },
}

async function ensureTables() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS teses_config (
      id        SERIAL PRIMARY KEY,
      ticker    TEXT NOT NULL UNIQUE,
      nome      TEXT NOT NULL,
      metricas  JSONB NOT NULL DEFAULT '[]',
      stops     JSONB NOT NULL DEFAULT '[]',
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS teses_entradas (
      id          SERIAL PRIMARY KEY,
      ticker      TEXT NOT NULL,
      trimestre   TEXT NOT NULL,
      pld         NUMERIC,
      gsf         NUMERIC,
      rap         NUMERIC,
      pmso        NUMERIC,
      dl_ebitda   NUMERIC,
      lucro       NUMERIC,
      tir_real    NUMERIC,
      observacoes TEXT,
      criado_em   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (ticker, trimestre)
    )
  `
  await sql`ALTER TABLE teses_entradas ADD COLUMN IF NOT EXISTS tir_real NUMERIC`

  // Seed genérico: insere ou atualiza stops/metricas para todos os tickers
  // DO UPDATE garante que mudanças no código (ex: texto de stops) sejam aplicadas
  for (const [ticker, info] of Object.entries(TICKER_SETOR)) {
    const cfg = CONFIGS_SETOR[info.setor]
    if (!cfg) continue
    await sql`
      INSERT INTO teses_config (ticker, nome, metricas, stops)
      VALUES (${ticker}, ${info.nome}, ${JSON.stringify(cfg.metricas)}, ${JSON.stringify(cfg.stops)})
      ON CONFLICT (ticker) DO UPDATE
        SET stops   = ${JSON.stringify(cfg.stops)},
            metricas = ${JSON.stringify(cfg.metricas)}
    `
  }

  // Seed entrada inicial JHSF3 4T25
  const jhsf3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='JHSF3' AND trimestre='4T25'`
  if (!jhsf3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('JHSF3','4T25',
        null, null, 690, 48, -0.65, 420, 13.8,
        'Receita recorrente R$690MM (+11% a/a, ex-FII). Mg EBITDA 48% (meta ~50%). DL/PL negativo (-0,65x) = caixa líquido R$1,8B após venda FII R$5,2B. Lucro R$420MM recorrente (ex-VGV FII). TIR Real vs NTN-B: +13,8 p.p. Evento estrutural: desinvestimento FII transformou balanço — JHSF de alavancada (DL ~R$3B) para caixa líquido. VSO na incorporação ~28% (Fazenda Boa Vista + novos lançamentos luxury). Próx. gatilho: expansão Fasano e lançamentos 2026. Fonte: estimativa mai/2026 com base nos resultados FY2025 divulgados.')
    `
  }

  // Seed entrada inicial CXSE3 4T25
  const cxse3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='CXSE3' AND trimestre='4T25'`
  if (!cxse3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('CXSE3','4T25',
        32.6, 57.0, 9650, 22.0, -1690, 1125, 3.8,
        'ROE 4T25: 70,4% (tri anualizado). IC Combinado: 57,0% (−0,9pp vs 2024). Sinistralidade: 22,0% (+3,8pp YoY pós-normalização RS). Prêmios emitidos: R$2,44B (−3,3% YoY; queda prestamista proposital). Receita +4,3% YoY. Resultado financeiro +34% (SELIC 14,75% beneficia float). LL gerencial R$1,125B (+7% YoY). 2025 anual: LL R$4,316B (+14,9%). Caixa líquido R$1,69B. Tese: bancassurance monopoly via CEF. Driver principal: carteira habitacional Caixa + SELIC sustentada. Habitacional +10,6% YoY | Residencial +24% YoY. DCF base R$18,22 (+3,4%). TIR real 11,3% vs NTN-B +3,8pp. Risco: renovação acordo CEF e sinistralidade prestamista. Fonte: Release 4T25 Caixa Seguridade fev/2026.')
    `
  }

  // Seed entrada inicial SUZB3 1T26
  const suzb3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='SUZB3' AND trimestre='1T26'`
  if (!suzb3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('SUZB3','1T26',
        562, 2835, 10968, 802, 3.3, 4580, null,
        'BHKP USD 562/t (estável vs 4T25). Volume 2.835kt (+7% a/a, Cerrado pleno). Receita R$10.968MM (-5.1% a/a). EBITDA R$4.580MM (Mg 41.8%). Custo caixa R$802/t (mínima histórica). DL/EBITDA 3.3x. Lucro R$4.310MM (-32% a/a por variação cambial). Tese: recuperação do ciclo BHKP → USD 600+ gatilha re-rating. Fonte: Release 1T26 Suzano mai/2026.')
    `
  }

  // Seed entrada inicial EQTL3 1T26
  const eqtl3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='EQTL3' AND trimestre='1T26'`
  if (!eqtl3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('EQTL3','1T26',
        null, null, 12750, 2580, 2.7, 2880, null,
        'Receita R$12.750MM (+12% a/a). EBITDA R$2.880MM (+11.3% a/a). CapEx R$2.580MM. DL/EBITDA 2.7x (confortável). LL adj R$359MM (-23.6% por CDI alto). 14.6M consumidores. Fonte: Release 1T26 Equatorial Energia mai/2026.')
    `
  }

  // Seed entrada inicial AXIA3 1T26
  const axiaEntrada = await sql`SELECT id FROM teses_entradas WHERE ticker='AXIA3' AND trimestre='1T26'`
  if (!axiaEntrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('AXIA3','1T26',308,92,3900,1495,1.85,3707,3.2,
        'PLD R$308/MWh (+90% YoY). GSF 92% favorável. EBITDA regulatório +72% YoY. Lucro R$3,7bi. Fonte: Release 1T26 Âxia Energia.')
    `
  }

  // Seed entrada inicial BBDC4 1T26
  const bbdcEntrada = await sql`SELECT id FROM teses_entradas WHERE ticker='BBDC4' AND trimestre='1T26'`
  if (!bbdcEntrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('BBDC4','1T26',
        15.8, 4.2, 20050, 9660, 1090, 6810, null,
        'ROE 15,8% (+1,4pp vs 4T25). NPL 4,2%. Lucro R$6,81bi (+16,1% a/a). NIM R$20,05bi. Carteira R$1,09tri (+8,4% a/a). PCLD R$9,66bi (+26,5% a/a — crescimento carteira). Guidance 2026 confirmado: LL R$25-30bi, ROE 14-17%. Fonte: Release 1T26 Bradesco.')
    `
  }

  // Seed entrada inicial GUAR3 4T24
  const guar3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='GUAR3' AND trimestre='4T24'`
  if (!guar3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('GUAR3','4T24',
        10.8, 18.9, 3000, 85, 0.3, 250, null,
        'Rec R$3,0B (+10,8% a/a). EBITDA R$565MM (+45% a/a). Mg EBITDA 18,9% (expansão vs 14,4% em 4T23). Lucro R$249,9MM (+8,8% a/a). DL/EBITDA 0,3x — menor desde 2019. Midway EBITDA R$169MM (recuperação plena NPL). Mg Bruta Vestuário 54,3% (anual). 425 lojas. Produção fábrica 41M peças (+33% em 2 anos). SSS 4T24 +10,8%. Maior EBITDA anual da história: R$1,487B. LL 2024: R$235M (reversão do prejuízo de R$34M em 2023). Dívida líquida: R$499M (−52,9% vs dez/2023). Tese: recuperação Midway (NPL normalizado) + alavancagem operacional fábrica + desalavancagem financeira acelerada. Principal variável de monitoramento: NPL Midway >90d. Fonte: Release 4T24 Guararapes mar/2025.')
    `
  }

  // Seed entrada inicial CMIG4 1T26
  const cmig4Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='CMIG4' AND trimestre='1T26'`
  if (!cmig4Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('CMIG4','1T26',
        null, null, 10460, 1500, 2.50, 1790, null,
        'Receita R$10.460MM (+6,3% a/a). EBITDA R$1.790MM (-2,1% a/a). LL R$979MM (-5,8% a/a). CapEx R$1.500MM (+22% a/a — plano R$43,7B 2026-2030). DL/EBITDA 2,5x (vs 1,4x em 1T25 — ciclo CapEx). DL R$17,8B. Margem EBITDA 17,1% (comprimida vs LTM 19%). Pressão: CDI alto (despesa financeira ~R$2,5B/ano) + custo energia comprada +15%. Evento binário: 6ª Revisão Tarifária Periódica (6ª RTP) Cemig D prevista para 2028 — reconhecimento do RAB adicional (de ~R$15B para ~R$28-30B) pode expandir EBITDA regulatório em 60-80%. Fonte: Release 1T26 Cemig mai/2026.')
    `
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    await ensureTables()
    const sql = getDb()
    const ticker = req.nextUrl.searchParams.get('ticker')

    const configs = ticker
      ? await sql`SELECT * FROM teses_config WHERE ticker = ${ticker}`
      : await sql`SELECT * FROM teses_config ORDER BY ticker`

    const entradas = ticker
      ? await sql`SELECT * FROM teses_entradas WHERE ticker = ${ticker} ORDER BY trimestre DESC`
      : await sql`SELECT * FROM teses_entradas ORDER BY ticker, trimestre DESC`

    return NextResponse.json({ configs, entradas })
  } catch (e) {
    console.error('[teses GET]', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    await ensureTables()
    const sql = getDb()
    const body = await req.json()
    const { tipo } = body

    if (tipo === 'config') {
      const { ticker, nome, metricas, stops } = body
      await sql`
        INSERT INTO teses_config (ticker, nome, metricas, stops)
        VALUES (${ticker}, ${nome}, ${JSON.stringify(metricas)}, ${JSON.stringify(stops)})
        ON CONFLICT (ticker) DO UPDATE
        SET nome=${nome}, metricas=${JSON.stringify(metricas)}, stops=${JSON.stringify(stops)}
      `
      return NextResponse.json({ ok: true })
    }

    if (tipo === 'entrada') {
      const { ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes } = body
      await sql`
        INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
        VALUES (${ticker}, ${trimestre}, ${pld??null}, ${gsf??null}, ${rap??null},
                ${pmso??null}, ${dl_ebitda??null}, ${lucro??null}, ${tir_real??null}, ${observacoes??''})
        ON CONFLICT (ticker, trimestre) DO UPDATE
        SET pld=${pld??null}, gsf=${gsf??null}, rap=${rap??null}, pmso=${pmso??null},
            dl_ebitda=${dl_ebitda??null}, lucro=${lucro??null}, tir_real=${tir_real??null},
            observacoes=${observacoes??''}
      `
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ erro: 'Tipo inválido' }, { status: 400 })
  } catch (e) {
    console.error('[teses POST]', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
