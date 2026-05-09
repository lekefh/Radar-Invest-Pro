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

  // 3. Corrige FK errada — remove e recria apontando para usuarios_web
  // Verifica se existe FK na tabela carteira que NÃO aponta para usuarios_web
  const fkInfo = await sql`
    SELECT tc.constraint_name, ccu.table_name AS ref_table
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'carteira'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'carteira_user_id_fkey'
  `

  if (fkInfo.length > 0 && fkInfo[0].ref_table !== 'usuarios_web') {
    // FK aponta para tabela errada — remove e recria
    await sql`ALTER TABLE carteira DROP CONSTRAINT IF EXISTS carteira_user_id_fkey`
    await sql`
      ALTER TABLE carteira
      ADD CONSTRAINT carteira_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES usuarios_web(id) ON DELETE CASCADE
    `
  } else if (fkInfo.length === 0) {
    // Sem FK — adiciona
    try {
      await sql`
        ALTER TABLE carteira
        ADD CONSTRAINT carteira_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES usuarios_web(id) ON DELETE CASCADE
      `
    } catch { /* já existe com outro nome */ }
  }
}
