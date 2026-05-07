-- ============================================================
-- Radar Invest Pro — Schema PostgreSQL (Neon)
-- Execute uma vez após criar o banco no Neon
-- ============================================================

-- Usuários (preparado para login futuro)
CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  senha_hash TEXT,
  perfil     TEXT DEFAULT 'analista',
  ativo      BOOLEAN DEFAULT true,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- Usuário padrão (admin = Alexander)
INSERT INTO usuarios (id, nome, email, perfil)
VALUES (1, 'Alexander Faria Hurtado', 'alexanderfh4@gmail.com', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Sequência segura para o id
SELECT setval('usuarios_id_seq', 1, true);

-- Carteira (posições atuais)
CREATE TABLE IF NOT EXISTS carteira (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES usuarios(id) DEFAULT 1,
  ticker           TEXT NOT NULL,
  quantidade       NUMERIC(18, 6) DEFAULT 0,
  preco_medio      NUMERIC(18, 6) DEFAULT 0,
  data_compra      DATE,
  notas            TEXT,
  excluir_calculo  BOOLEAN DEFAULT false,
  criado_em        TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- Movimentações (histórico de compras e vendas)
CREATE TABLE IF NOT EXISTS movimentacoes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES usuarios(id) DEFAULT 1,
  data        DATE NOT NULL,
  ticker      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('C','V')),
  quantidade  NUMERIC(18, 6) NOT NULL,
  preco       NUMERIC(18, 6) NOT NULL,
  valor_total NUMERIC(18, 2),
  corretora   TEXT,
  nota_num    TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_carteira_user    ON carteira(user_id);
CREATE INDEX IF NOT EXISTS idx_carteira_ticker  ON carteira(ticker);
CREATE INDEX IF NOT EXISTS idx_mov_user         ON movimentacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_mov_ticker       ON movimentacoes(ticker);
CREATE INDEX IF NOT EXISTS idx_mov_data         ON movimentacoes(data);

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_carteira_atualizado ON carteira;
CREATE TRIGGER trg_carteira_atualizado
  BEFORE UPDATE ON carteira
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
