import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

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

  const existe = await sql`SELECT id FROM teses_config WHERE ticker = 'AXIA3'`
  if (!existe[0]) {
    await sql`
      INSERT INTO teses_config (ticker, nome, metricas, stops) VALUES (
        'AXIA3',
        'Âxia Energia S.A.',
        ${JSON.stringify([
          { key: 'pld',      label: 'PLD médio',        unidade: 'R$/MWh', verde: 250,  vermelho: 180,  sentido: 'maior' },
          { key: 'gsf',      label: 'GSF',              unidade: '%',      verde: 88,   vermelho: 82,   sentido: 'maior' },
          { key: 'rap',      label: 'RAP trimestral',   unidade: 'R$ MM',  verde: 4200, vermelho: 3800, sentido: 'maior' },
          { key: 'pmso',     label: 'PMSO trimestral',  unidade: 'R$ MM',  verde: 1600, vermelho: 1800, sentido: 'menor' },
          { key: 'dl_ebitda',label: 'DL/EBITDA',        unidade: 'x',      verde: 2.0,  vermelho: 2.8,  sentido: 'menor' },
          { key: 'tir_real', label: 'TIR Real vs NTN-B',unidade: 'p.p.',   verde: 4.0,  vermelho: 1.0,  sentido: 'maior' },
        ])},
        ${JSON.stringify([
          'GSF < 82% por 2 trimestres consecutivos E PLD < R$180/MWh',
          'DL/EBITDA > 3,0x por 1 trimestre',
          'TIR Real implícita cai abaixo de NTN-B + 1 p.p.',
          'WACC regulatório ANEEL reduzido abaixo de 8% real na próxima revisão tarifária',
        ])}
      )
    `
    // 1T26 — dados reais do release + TIR real implícita estimada
    // TIR base: preço justo R$63,50 / cotação R$54,67 → upside ~16% nominal → TIR real ~10%
    // NTN-B longa ~7% real → prêmio ~+3 p.p. vs NTN-B (limítrofe — monitorar)
    await sql`
      INSERT INTO teses_entradas (ticker, trimestre, pld, gsf, rap, pmso, dl_ebitda, lucro, tir_real, observacoes)
      VALUES (
        'AXIA3', '1T26',
        308, 92, 3900, 1495, 1.85, 3707, 3.2,
        'PLD R$308/MWh (+90% YoY). GSF 92% favorável. EBITDA regulatório +72% YoY. Lucro R$3,7bi (vs -R$80mi em 1T25). TIR real estimada ao preço de R$54,67. Fonte: Release 1T26 Âxia Energia.'
      )
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
