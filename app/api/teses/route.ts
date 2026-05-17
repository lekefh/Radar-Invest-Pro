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
  'B3SA3':  { nome: 'B3 S.A.',                    setor: 'banco'      },
  'CSAN3':  { nome: 'Cosan S.A.',                  setor: 'varejo'     },
  'INTB3':  { nome: 'Intelbras S.A.',              setor: 'varejo'     },
  'KEPL3':  { nome: 'Kepler Weber S.A.',           setor: 'varejo'     },
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
