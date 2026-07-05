import { neon } from '@neondatabase/serverless'

/* getDb() — inicializa só quando a rota é chamada (não no build) */
export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada. Adicione em Vercel → Settings → Environment Variables.')
  return neon(url)
}

/**
 * Garante que as tabelas carteira e movimentacoes existem com o schema correto.
 * Corrige FK errada (caso a tabela tenha sido criada apontando para outra tabela).
 * Idempotente — seguro chamar em toda requisição.
 */
export async function ensureCarteiraTables() {
  const sql = getDb()

  // 1. Garante que a tabela carteira existe
  await sql`
    CREATE TABLE IF NOT EXISTS carteira (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      ticker        TEXT    NOT NULL,
      quantidade    NUMERIC NOT NULL DEFAULT 0,
      preco_medio   NUMERIC NOT NULL DEFAULT 0,
      data_compra   DATE,
      notas         TEXT,
      excluir_calculo BOOLEAN NOT NULL DEFAULT FALSE,
      atualizado_em TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, ticker)
    )
  `

  // 2. Garante que movimentacoes existe
  await sql`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      data        DATE    NOT NULL,
      ticker      TEXT    NOT NULL,
      tipo        CHAR(1) NOT NULL CHECK (tipo IN ('C','V')),
      quantidade  NUMERIC NOT NULL,
      preco       NUMERIC NOT NULL,
      valor_total NUMERIC NOT NULL,
      corretora   TEXT,
      nota_num    TEXT,
      criado_em   TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // 3. Corrige FK errada em carteira
  const fkCarteira = await sql`
    SELECT ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'carteira' AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'carteira_user_id_fkey'
  `
  if (fkCarteira.length > 0 && fkCarteira[0].ref_table !== 'usuarios_web') {
    await sql`ALTER TABLE carteira DROP CONSTRAINT IF EXISTS carteira_user_id_fkey`
    await sql`ALTER TABLE carteira ADD CONSTRAINT carteira_user_id_fkey FOREIGN KEY (user_id) REFERENCES usuarios_web(id) ON DELETE CASCADE`
  } else if (fkCarteira.length === 0) {
    try { await sql`ALTER TABLE carteira ADD CONSTRAINT carteira_user_id_fkey FOREIGN KEY (user_id) REFERENCES usuarios_web(id) ON DELETE CASCADE` } catch { /* já existe */ }
  }

  // 3b. Garante colunas mercado e modalidade em movimentacoes (adicionadas retroativamente)
  await sql`ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS mercado TEXT NOT NULL DEFAULT 'acao'`
  await sql`ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'swing'`

  // 4. Corrige FK errada em movimentacoes
  const fkMov = await sql`
    SELECT ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'movimentacoes' AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'movimentacoes_user_id_fkey'
  `
  if (fkMov.length > 0 && fkMov[0].ref_table !== 'usuarios_web') {
    await sql`ALTER TABLE movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_user_id_fkey`
    await sql`ALTER TABLE movimentacoes ADD CONSTRAINT movimentacoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES usuarios_web(id) ON DELETE CASCADE`
  } else if (fkMov.length === 0) {
    try { await sql`ALTER TABLE movimentacoes ADD CONSTRAINT movimentacoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES usuarios_web(id) ON DELETE CASCADE` } catch { /* já existe */ }
  }
}

/** Cria/garante as tabelas do módulo de Apuração de IR (idempotente). */
export async function ensureIRTables() {
  const sql = getDb()

  await sql`
    CREATE TABLE IF NOT EXISTS ir_posicao_inicial (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL,
      ticker      TEXT    NOT NULL,
      qtde        NUMERIC NOT NULL DEFAULT 0,
      preco_medio NUMERIC NOT NULL DEFAULT 0,
      data_base   DATE    NOT NULL,
      origem      TEXT    DEFAULT 'declaracao',
      criado_em   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, ticker)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ir_prejuizo_acumulado (
      user_id       INTEGER NOT NULL,
      modalidade    TEXT    NOT NULL CHECK (modalidade IN ('swing','day')),
      valor         NUMERIC NOT NULL DEFAULT 0,
      atualizado_em TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, modalidade)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ir_apuracao_mensal (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL,
      ano_mes         TEXT    NOT NULL,
      vendas_acao_sw  NUMERIC DEFAULT 0,
      lucro_acao_sw   NUMERIC DEFAULT 0,
      lucro_opcao_sw  NUMERIC DEFAULT 0,
      lucro_day       NUMERIC DEFAULT 0,
      isento_swing    BOOLEAN DEFAULT FALSE,
      prej_swing_ac   NUMERIC DEFAULT 0,
      prej_day_ac     NUMERIC DEFAULT 0,
      ir_swing        NUMERIC DEFAULT 0,
      ir_day          NUMERIC DEFAULT 0,
      irrf_day        NUMERIC DEFAULT 0,
      ir_devido_swing NUMERIC DEFAULT 0,
      ir_devido_day   NUMERIC DEFAULT 0,
      calculado_em    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, ano_mes)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS ir_darfs (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL,
      competencia    TEXT    NOT NULL,
      codigo_receita TEXT    NOT NULL,
      valor          NUMERIC NOT NULL,
      vencimento     DATE    NOT NULL,
      status         TEXT    DEFAULT 'pendente',
      gerado_em      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_ir_pos_user   ON ir_posicao_inicial(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ir_apura_user ON ir_apuracao_mensal(user_id, ano_mes)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ir_darfs_user ON ir_darfs(user_id)`
}
