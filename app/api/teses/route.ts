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

  transmissao: {
    // TAEE3 — transmissão de energia (RAP regulatória, sem risco de volume/GSF/PLD)
    // Campos reutilizados: gsf=Equivalência Patrimonial (JVs) | pld=Mg EBITDA Regulatória | rap=RAP Ciclo anual
    metricas: [
      { key: 'pld',       label: 'Mg EBITDA Regulatória', unidade: '%',     verde: 85,   vermelho: 80,   sentido: 'maior' },
      { key: 'gsf',       label: 'Equivalência Patrimonial', unidade: 'R$ MM', verde: 100,  vermelho: 85,   sentido: 'maior' },
      { key: 'rap',       label: 'RAP Ciclo',         unidade: 'R$ MM',  verde: 4500, vermelho: 4300, sentido: 'maior' },
      { key: 'pmso',      label: 'PMSO trimestral',   unidade: 'R$ MM',  verde: 95,   vermelho: 105,  sentido: 'menor' },
      { key: 'dl_ebitda', label: 'DL/EBITDA Regulatório', unidade: 'x',  verde: 4.0,  vermelho: 5.0,  sentido: 'menor' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B', unidade: 'p.p.',   verde: 4.0,  vermelho: 1.0,  sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido trimestral', unidade: 'R$ MM', verde: 200, vermelho: 170, sentido: 'maior' },
    ],
    stops: [
      'Equivalência Patrimonial cai >10% a/a por 2 trimestres consecutivos (deterioração das JVs TBE/AIE/ATE)',
      'DL/EBITDA regulatório > 5,0x por 1 trimestre',
      'Margem EBITDA regulatória < 80% por 2 trimestres consecutivos',
      'TIR Real implícita cai abaixo de NTN-B + 0 p.p.',
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

  bebidas: {
    // ABEV3 — Ambev. Drivers: (1) Mg EBITDA % | (2) Vol. Cerveja BR | (3) NR/hl vs COGS/hl
    // gsf=Mg EBITDA% | pld=Vol Cerveja BR mil hl | rap=Receita | pmso=NR/hl | dl_ebitda=Caixa Líq | lucro=LL
    metricas: [
      { key: 'gsf',       label: 'Mg EBITDA (%)',            unidade: '%',      verde: 33,    vermelho: 29,    sentido: 'maior' },
      { key: 'pld',       label: 'Vol. Cerveja BR (mil hl)', unidade: 'mil hl', verde: 30000, vermelho: 25000, sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',          unidade: 'R$ MM',  verde: 22000, vermelho: 18000, sentido: 'maior' },
      { key: 'pmso',      label: 'NR/hl Cerveja BR (R$)',    unidade: 'R$/hl',  verde: 600,   vermelho: 530,   sentido: 'maior' },
      { key: 'dl_ebitda', label: 'Caixa Líquido (R$ MM)',    unidade: 'R$ MM',  verde: 15000, vermelho: 5000,  sentido: 'maior' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',        unidade: 'p.p.',   verde: 3.0,   vermelho: 0.0,   sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',             unidade: 'R$ MM',  verde: 3500,  vermelho: 2500,  sentido: 'maior' },
    ],
    stops: [
      'Volume Cerveja BR negativo por 2 trimestres consecutivos (perda estrutural de share)',
      'Mg EBITDA < 29% por 2 trimestres (reversão da recuperação de margem)',
      'Caixa Líquido < R$5B (redução acelerada por M&A ou dividendos excessivos)',
      'TIR Real implícita cai abaixo de NTN-B + 0 p.p.',
    ],
  },

  autopecas: {
    // LEVE3 — Mahle Metal Leve. Drivers: (1) Mg EBITDA % | (2) OE Doméstico | (3) DL/EBITDA
    // gsf=Mg EBITDA% | pld=Rec OE Dom R$MM | rap=Receita | pmso=CapEx tri | dl_ebitda=DL/EBITDA | lucro=LL
    metricas: [
      { key: 'gsf',       label: 'Mg EBITDA (%)',              unidade: '%',     verde: 21,   vermelho: 17,   sentido: 'maior' },
      { key: 'pld',       label: 'Rec OE Doméstico (R$ MM)',   unidade: 'R$ MM', verde: 550,  vermelho: 430,  sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',            unidade: 'R$ MM', verde: 1350, vermelho: 1080, sentido: 'maior' },
      { key: 'pmso',      label: 'CapEx trimestral (R$ MM)',   unidade: 'R$ MM', verde: 30,   vermelho: 80,   sentido: 'menor' },
      { key: 'dl_ebitda', label: 'DL/EBITDA',                  unidade: 'x',     verde: 0.8,  vermelho: 1.8,  sentido: 'menor' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',          unidade: 'p.p.',  verde: 2.0,  vermelho: 0.0,  sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',               unidade: 'R$ MM', verde: 180,  vermelho: 100,  sentido: 'maior' },
    ],
    stops: [
      'Mg EBITDA < 17% por 2 trimestres consecutivos (deterioração operacional estrutural)',
      'DL/EBITDA > 2,0x (extração excessiva de dividendos pelo controlador Mahle GmbH)',
      'OE Doméstico cai >15% a/a por 2 trimestres (queda da produção veicular ICE no Brasil)',
      'TIR Real implícita cai abaixo de NTN-B + 0 p.p.',
    ],
  },

  tecnologia: {
    // VLID3 — Valid. Drivers: (1) Rec ID & Gov Digital | (2) Mg EBITDA | (3) Declínio Pay/Mobile
    // gsf=Mg EBITDA% | pld=Rec ID/Gov R$MM | rap=Receita | pmso=Rec Pay R$MM | dl_ebitda=Caixa Líq | lucro=LL
    metricas: [
      { key: 'gsf',       label: 'Mg EBITDA (%)',               unidade: '%',     verde: 24,    vermelho: 18,    sentido: 'maior' },
      { key: 'pld',       label: 'Rec ID & Gov Digital (R$ MM)', unidade: 'R$ MM', verde: 260,   vermelho: 200,   sentido: 'maior' },
      { key: 'rap',       label: 'Receita líquida',              unidade: 'R$ MM', verde: 520,   vermelho: 440,   sentido: 'maior' },
      { key: 'pmso',      label: 'Rec Pay (R$ MM)',               unidade: 'R$ MM', verde: 130,   vermelho: 70,    sentido: 'maior' },
      { key: 'dl_ebitda', label: 'Caixa Líquido (R$ MM)',        unidade: 'R$ MM', verde: 50,    vermelho: -100,  sentido: 'maior' },
      { key: 'tir_real',  label: 'TIR Real vs NTN-B',            unidade: 'p.p.',  verde: 3.0,   vermelho: 0.0,   sentido: 'maior' },
      { key: 'lucro',     label: 'Lucro líquido',                 unidade: 'R$ MM', verde: 70,    vermelho: 35,    sentido: 'maior' },
    ],
    stops: [
      'Receita ID & Gov Digital cai por 2 trimestres consecutivos (perda de contratos gov.)',
      'Mg EBITDA < 18% por 2 trimestres (deterioração estrutural de mix)',
      'Receita Pay abaixo de R$70MM/tri por 2 trimestres (aceleração do declínio)',
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
  'RIAA3':  { nome: 'Riachuelo S.A. (ex-Guararapes)', setor: 'varejo' },
  'CEAB3':  { nome: 'C&A Modas S.A.',                setor: 'varejo' },
  'LREN3':  { nome: 'Lojas Renner S.A.',             setor: 'varejo' },
  'MGLU3':  { nome: 'Magazine Luiza S.A.',           setor: 'varejo' },
  'PRIO3':  { nome: 'PRIO S.A.',                    setor: 'petroleo' },
  'PETR4':  { nome: 'Petróleo Brasileiro S.A. — Petrobras', setor: 'petroleo' },
  'PETR3':  { nome: 'Petróleo Brasileiro S.A. — Petrobras', setor: 'petroleo' },
  'LAVV3':  { nome: 'Lavvi Empreendimentos Imobiliários S.A.', setor: 'construcao' },
  'TAEE3': { nome: 'Transmissora Aliança de Energia Elétrica S.A.', setor: 'transmissao' },
  'ABEV3': { nome: 'Ambev S.A.',                                    setor: 'bebidas'      },
  'VLID3': { nome: 'Valid Soluções S.A.',                           setor: 'tecnologia'   },
  'LEVE3': { nome: 'Mahle Metal Leve S.A.',                        setor: 'autopecas'    },
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
      ri_url    TEXT NOT NULL DEFAULT '',
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE teses_config ADD COLUMN IF NOT EXISTS ri_url TEXT NOT NULL DEFAULT ''`
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
  const riaa3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='RIAA3' AND trimestre='4T24'`
  if (!riaa3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('RIAA3','4T24',
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

  // Seed entrada inicial PRIO3 1T26
  const prio3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='PRIO3' AND trimestre='1T26'`
  if (!prio3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('PRIO3','1T26',
        155.4, 76.1, 6552, 1053, 2.37, 2691, 1.6,
        'Produção 155,4k boed (+42% a/a — recorde). Lifting cost US$9,4/boe ✓ (mínima desde 2024). EBITDA R$4.984MM (+91% a/a). LL R$2.691MM (+33% a/a). Wahoo: 3 poços conectados (início mar/2026) — 4º poço esperado 2T26 → produção alvo 40k boed. Peregrino(40%): pleno operacional pós-shutdown 3T25. Brent 1T26 US$80,6/bbl. Barris vendidos 14,8MM (recorde). DL/EBITDA LTM 2,37x → meta 1,6x fim-2026 e 1,0x fim-2027. FCL estrutural R$8-10B/ano pós-Wahoo. Guidance: dividendos a partir de 2026 (DY estimado 5-8% ao ano). TIR Real implícita ~9,1% vs NTN-B 7,5% real (+1,6pp). DCF base: R$65/ação (WACC 16,5%; g=3%). Graham 2026e: R$83. Forward P/E 2026: ~5x (excepcional). Tese: colheita do ciclo Wahoo + Peregrino. Principal risco: queda Brent abaixo de $60/bbl por 2+ tri. Fonte: Release 1T26 PRIO mai/2026.')
    `
  }

  // Seed entrada inicial LREN3 1T26
  const mglu3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='MGLU3' AND trimestre='1T26'`
  if (!mglu3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('MGLU3','1T26',
        -14.3, 65.7, 9205, 7.8, 0.63, -34, -2.1,
        'Receita R$9.205MM (-2,0% a/a). EBITDA R$718MM (mg 7,8% -0,3pp). LL ajustado R$-34MM (reversão por juros). GMV Total R$15,2B (-5,6% a/a). GMV 3P R$3,9B (-14,3% a/a — pressão Shopee/MELI). Penetração digital 65,7% (-4,0pp). SSS físico +6,9% (motor de sustentação). Luizacred: carteira R$20,4B, PDD +47,5% (⚠️). TPV MagaluPay R$10,5B (+4,3%). Despesa financeira R$568,7MM (+16,5%) = 79% do EBITDA. DL/EBITDA LTM ≈0,63x (gerencial). EV/EBITDA 2,9x (desconto severo vs histórico). Graham Number R$8,06 (leve upside vs R$5,34). TIR Real implícita negativa (~-2,1% vs NTN-B 7,5% real). Tese: opcionalidade na queda da SELIC + leverage operacional. Bull DCF: R$37/ação se SELIC cair a 10% e mg EBITDA atingir 11%. Riscos: SELIC persistente, GMV digital continuando em queda, NPL Luizacred acelerando. Fonte: Release 1T26 MGLU3 mai/2026.')
    `
  }

  const lren3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='LREN3' AND trimestre='1T26'`
  if (!lren3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('LREN3','1T26',
        3.2, 17.0, 2875, 56.7, -0.47, 257, 4.6,
        'SSS +3,2% (vestuário +3,7%). Mg Bruta Varejo 56,7% — recorde histórico. Mg EBITDA Varejo 17,0% (+2,7pp a/a). EBITDA Total R$611MM (+4,3% a/a). LL R$257MM (+16,4% a/a — recorde 1T). Caixa líquido R$1,5B (DL/EBITDA LTM -0,47x). CapEx R$106MM (+72% a/a; aceleração abertura lojas). FCL R$258MM (+264% a/a). Digital 16,6% receita (+GMV +7,4%). EBITDA Midway R$123MM (contribuição positiva — NPL normalizado). TIR Real implícita ~12,1% vs NTN-B 7,5% real (+4,6pp). DCF base: R$20,00/ação (Upside ~34% vs cotação R$14,90). Graham Number R$18,53 (acima do mercado). Tese: expansão de lojas acelerada + Midway recuperado + DL negativa + margem bruta recorde = rerating estrutural. Principais riscos: desaceleração consumo doméstico, NPL Midway reestressado, base difícil 2T26 (SSS +19% em 2T25). Fonte: Release 1T26 LREN3 mai/2026.')
    `
  }

  // Seed entrada inicial LAVV3 1T26
  const lavv3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='LAVV3' AND trimestre='1T26'`
  if (!lavv3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('LAVV3','1T26',
        0.0, 53.67, 372.96, 31.92, 0.288, 69.87, 8.66,
        'Receita R$372,96MM (+11,4% a/a — reconhecimento PoC do backlog). Mg Bruta 31,92% (-5,6pp a/a). EBITDA ex-SFH R$71,77MM (Mg 19,24%, -8,8pp a/a — release cita "EBITDA ajustado" de R$83MM, divergência ~R$11MM não reconciliada com a planilha MZ). LL R$69,87MM (-19,6% a/a). VGV lançado %Lavvi: R$0,0MM no tri (sazonalidade — Jardim da Hípica aguardado para o 2T26, principal catalisador dos próximos 2 trimestres). Vendas contratadas R$249,8MM (-3,4% a/a, sustentadas por vendas de estoque). VSO 12m 53,7% (-5,9pp a/a). Backlog R$2.757,2MM (+15,3% a/a) com margem recorde 38,0% — 1,6x a receita LTM, ainda não convertida em EBITDA reportado (defasagem PoC). Dívida líquida virou positiva em R$467,7MM (DL/PL +0,29x — 1º trimestre líquido devedor da série, refletindo ramp-up de obras: estoque +39% t/t). Valuation: DCF base R$22,03 (+98,5% upside vs R$11,10; bear R$16,82/bull R$28,65). TIR Real implícita 15,66% vs NTN-B real ~7,0% (+8,66pp, semáforo verde). Gordon (DDM) R$20,21 (payout 132% — distribuição acima do LPA, monitorar sustentabilidade). Graham Number R$17,89. Tese: backlog recorde com margem de 38% ainda não reconhecido + lançamento de Jardim da Hípica (2T26e) = potencial rerating, mas exige confirmação de que o aumento de endividamento é temporário (financiamento de obras) e não estrutural. Principais riscos a monitorar: trajetória de DL/PL, velocidade de conversão do backlog em margem reportada, e VSO do novo lançamento. Fonte: Planilha MZ Group ITR 1T26 + Release 1T26 Lavvi mai/2026.')
    `
  }

  // Seed entrada inicial TAEE3 1T26
  const taee3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='TAEE3' AND trimestre='1T26'`
  if (!taee3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('TAEE3','1T26',
        85.75, 90.423, 4410.721, 93.404, 4.73, 192.574, -1.25,
        'Receita Regulatória R$655,53MM (+9,6% a/a vs R$597,93MM). EBITDA Regulatório R$562,13MM (+10,3% a/a) — Mg EBITDA 85,75% (+0,52pp a/a, recorde da série desde 1T21). LL Regulatório R$192,57MM (+2,3% a/a vs R$188,28MM). PMSO R$93,40MM (+5,77% a/a vs R$88,31MM — pressão de custos abaixo da inflação de receita). Equivalência Patrimonial (JVs TBE/AIE/ATE) R$90,42MM (-8,2% a/a vs R$98,50MM — variável-chave a monitorar: 3 trimestres seguidos de queda a/a indicariam deterioração estrutural das participações). RAP ciclo 2025/26 = R$4.410,72MM (+7,78% vs 2024/25, reajuste IGP-M +7,03%/IPCA +5,32%). DL R$10.204,19MM — DL/EBITDA proporcional (release, inclui EBITDA das investidas) 4,2x vs regulatório consolidado (calculado) 4,73x. CapEx R$312,14MM (+16,6% a/a). Pipeline: Ananaí 93,3%, Pitiguari pleno desde jun/2025, Tangará operação parcial fev-mar/2026 (catalisador 2T26), Saíra Conversora Garabi I prevista abr/2026 (95,8% — catalisador 2T26), Juruá 14,2% (maior runway de capex). Valuation (base TAEE3, ON+PN equivalente = 1.033.496.721 ações, preço atual R$13,12): DCF base R$20,18 (+53,8% upside; bear R$17,50/+33,3%, bull R$23,05/+75,7% — calibrado com capex_pct terminal ≈ D&A/receita, steady-state de reposição do RAB). TIR Real implícita ~5,75% vs NTN-B real ~7,0% (-1,25pp, semáforo vermelho — renda fixa hoje compete com a tese; métrica de yield, ~invariante à classe de ação). Gordon (DDM, D0≈R$1,09/ação) R$16,07. Graham Number R$13,75 / Graham Fórmula R$17,37. Tese: COMPRA moderada — preço-alvo 12m ~R$16-17 (ponderando Gordon/Graham, mais conservadores que o DCF), upside de pipeline (Tangará/Saíra/Juruá) como gatilho adicional, mas TIR-real vermelho é o principal contraponto vs renda fixa no ciclo de SELIC alta. Riscos: queda persistente da Equivalência Patrimonial, execução/atraso de Juruá, alavancagem 4,2-4,73x. Fonte: Release 1T26 TAESA + Planilha Auxiliar-Release_TAESA_Site_1T26.xlsx mai/2026.')
    `
  }

  // Seed entrada inicial ABEV3 1T26
  const abev3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='ABEV3' AND trimestre='1T26'`
  if (!abev3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('ABEV3','1T26',
        30180, 33.6, 22460, null, 16500, 3886, -1.5,
        'Receita R$22.460MM (+11,5% a/a). EBITDA R$7.555MM (+1,5% a/a). Mg EBITDA 33,6% (+0,1pp a/a). LL R$3.886MM (+2,2% a/a). Caixa Líquido R$16,5B. JCP declarado R$0,449/ação bruto (1T26). Resultado superou consenso — ação subiu +15% no dia, 2ª maior alta histórica. Destaques: Cerveja BR vol +1,2% (recuperação após queda 1T25); NAB Brasil +3,5% vol; mix premium favorável (+NR/hl). Headwinds: CAC/LAS/Canadá pressionados por FX adverso; concorrência Heineken avançou em share premium BR. Distribuiu R$17,4B em proventos em 2025 (payout 109% do LL — sustentado por JCP). TIR Real implícita ~6,1% vs NTN-B real 8,0% (-1,5pp — caro vs renda fixa; semáforo VERMELHO). DCF base R$22,00/ação (+38% vs cotação); Bear R$16,50 (+4%); Bull R$30,00 (+88%). P/L 16,1x vs Heineken 22x e ABI 19x. EV/EBITDA 7,3x vs peers globais 10-11x — desconto estrutural. Graham Number R$11,29 | Graham Fórmula R$17,33. Gordon R$9,63 (Ke=16,6%) ou R$15,55 (Ke=12% implícito mkt). Tese: qualidade premium + dividendo robusto + caixa líquido R$16,5B, mas upside DCF materializa-se apenas com SELIC cadente para re-rating do múltiplo. Principal stop: Mg EBITDA < 29% por 2 trimestres. Fonte: Release 1T26 Ambev mai/2026.')
    `
  }

  // Seed entrada inicial LEVE3 1T26
  const leve3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='LEVE3' AND trimestre='1T26'`
  if (!leve3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('LEVE3','1T26',
        518, 19.9, 1256, 12, 0.93, 214, 1.6,
        'Receita R$1.256MM (-0,8% a/a). EBITDA R$249MM (Mg 19,9% +1,2pp a/a). LL R$214MM (+35% a/a — incl. ganho FX R$78MM: res. financeiro R$75,8MM vs R$12,1MM em 1T25). OE Doméstico R$518MM (+1,3% a/a); OE Export R$278MM (-1,4%); AM Dom R$388MM (-2,7%); AM Exp R$72MM (-3,4%). CapEx R$11,9MM (Q1 sazonalmente baixo). DL R$965MM | DL/EBITDA 0,93x. Shares 135,5M | Cotação R$33,35 | MktCap R$4,52B | EV/EBITDA LTM 5,22x. DCF base R$43/ação (+29% vs R$33,35; WACC 15%, g 4%). Bear R$32 (-3%); Bull R$56 (+68%). TIR Real implícita ~9,6% vs NTN-B real 8,0% (+1,6pp — VERDE moderado). Gordon (Ke=18,8%): R$14 (mkt implicit Ke ~10%). Graham Number R$29 (-13% vs cotação). Tese: Compra moderada — empresa de qualidade excepcional (ROE 62%, ROIC 28%) com DY 8,6%, mas risco EV de longo prazo e DL crescente por dividendos ao controlador Mahle GmbH (~74%). Aftermarket (frota envelhecida BR) sustenta demanda. Principal risco: aceleração adoção EV + BRL apreciação. Stop: DL/EBITDA > 2,0x. Fonte: Release 1T26 Mahle Metal Leve mai/2026.')
    `
  }

  // Seed entrada inicial VLID3 1T26
  const vlid3Entrada = await sql`SELECT id FROM teses_entradas WHERE ticker='VLID3' AND trimestre='1T26'`
  if (!vlid3Entrada[0]) {
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES ('VLID3','1T26',
        248.6, 25.5, 447, 90.0, -37, 56, 4.3,
        'Receita R$447MM (-10,7% a/a). EBITDA R$114MM (Mg 25,5%). LL R$56MM recorrente (reportado R$73,6MM com benefício fiscal não-recorrente). Caixa Líquido R$37MM. Segmentos: ID & Gov Digital R$248,6MM (+1,7% a/a — CIN em expansão); Pay R$90MM (-31,5% a/a — pressão Argentina + digital); Mobile R$108,4MM (-13,3% a/a). EV/EBITDA LTM 3,2x (deep value — peers globais 8-12x). P/L 5,7x. DCF base R$32/ação (+83% upside vs R$17,70); Bear R$23 (+29%); Bull R$43 (+146%). TIR Real implícita ~12,3% vs NTN-B real 8,0% (+4,3pp — VERDE). Gordon DDM R$12 (Ke=18,2% — severo) / R$21 (Ke=12% mkt implícito). Graham Number R$38 (+116%). Tese: COMPRA — Valid é uma empresa de identidade digital em transição: legacy (Pay/Mobile) caindo mas Gov Digital crescendo, net cash, payout ~50%, valuation em mínimas históricas. Novos Negócios (VSoft biometria + serviços gov.) +53% a/a em 2025 já respondem por 16% da receita e 27% do EBITDA. Catalisadores: expansão CIN para todos os estados, contratos gov. digitais (SPs, RJs), estabilização Pay. Stop: Rec ID&Gov cai por 2 tri consecutivos. Fonte: Release 1T26 Valid — mai/2026.')
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
      const { ticker, nome, metricas, stops, ri_url } = body
      await sql`
        INSERT INTO teses_config (ticker, nome, metricas, stops, ri_url)
        VALUES (${ticker}, ${nome}, ${JSON.stringify(metricas)}, ${JSON.stringify(stops)}, ${ri_url ?? ''})
        ON CONFLICT (ticker) DO UPDATE
        SET nome=${nome}, metricas=${JSON.stringify(metricas)}, stops=${JSON.stringify(stops)},
            ri_url=COALESCE(NULLIF(${ri_url ?? ''},''), teses_config.ri_url)
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
