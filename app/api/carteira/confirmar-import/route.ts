import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables, reconstruirCarteira } from '@/lib/db'
import { getSession } from '@/lib/auth'

interface OpImport {
  tipo: string; ticker: string; quantidade: number; preco: number
  data: string; notas?: string; vencimento?: string | null; mercado?: string
  opcao_original?: string | null
}

/**
 * POST /api/carteira/confirmar-import
 * Salva todas as operações em movimentacoes em paralelo e reconstrói a carteira via
 * reconstruirCarteira — que aplica automaticamente o filtro de data_base.
 * Operações anteriores ou iguais à data_base são ignoradas na reconstrução.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = Number(session.sub)

  await ensureCarteiraTables()
  const sql = getDb()

  const body = await req.json()
  const operacoes: OpImport[] = body.operacoes ?? []
  const descricao: string = body.descricao ?? 'Planilha B3'

  if (!operacoes.length)
    return NextResponse.json({ error: 'Nenhuma operação recebida.' }, { status: 400 })

  // ── 1. Cria registro do lote ─────────────────────────────────────────────
  const datas   = operacoes.map(op => op.data).sort()
  const batchRows = await sql`
    INSERT INTO import_batches (user_id, total_ops, data_inicio, data_fim, descricao)
    VALUES (${userId}, ${operacoes.length}, ${datas[0]}::date, ${datas[datas.length - 1]}::date, ${descricao})
    RETURNING id
  `
  const batchId = batchRows[0].id as string

  // ── 2a. Ajuste de custo base para exercícios de opção ────────────────────
  // RIR/2018 Art. 58 §2º III: custo base = strike - prêmio (PUT writer) | strike + prêmio (CALL writer)
  // Previne que a opção original fique na carteira gerando operações de fechamento
  const opsParaRemover: OpImport[] = []
  const exercicioOps = operacoes.filter(op => op.mercado === 'exercicio')

  for (const ex of exercicioOps) {
    // Deriva ticker da opção original (prefer campo explícito, fallback via notas)
    const opcaoTicker = ex.opcao_original ?? (() => {
      const m = ex.notas?.match(/Exercício de ([A-Z0-9]+)/)
      const t = m?.[1] ?? ''
      return t.endsWith('E') && t.length > 5 ? t.slice(0, -1) : null
    })()
    if (!opcaoTicker) continue

    // Busca prêmio: (1) lote atual, (2) histórico no banco
    let premio: number | null = null
    const opLote = operacoes.find(o => o.ticker === opcaoTicker && o.tipo === 'V' && o.mercado === 'opcao')
    if (opLote) {
      premio = Number(opLote.preco)
    } else {
      const hist = await sql`
        SELECT preco::float AS preco FROM movimentacoes
        WHERE user_id = ${userId} AND ticker = ${opcaoTicker} AND tipo = 'V'
        ORDER BY data DESC, id DESC LIMIT 1
      `
      if (hist[0]?.preco != null) premio = Number(hist[0].preco)
    }

    if (premio != null && premio > 0) {
      // Ajusta custo base da ação subjacente
      const strikeOriginal = Number(ex.preco)
      if (ex.tipo === 'C') {
        // PUT writer exercida: custo base = strike - prêmio
        ex.preco = Math.max(0.01, strikeOriginal - premio)
      } else {
        // CALL writer exercida: receita líquida = strike + prêmio
        ex.preco = strikeOriginal + premio
      }
      ex.notas = (ex.notas ?? '') + ` [custo base: strike R$${strikeOriginal.toFixed(2)} ± prêmio R$${premio.toFixed(2)}]`

      // Define prêmio na operação de fechamento da opção → IR calcula lucro líquido = 0
      const opFechamento = operacoes.find(o => o.ticker === opcaoTicker && o.mercado === 'opcao_exercida')
      if (opFechamento) opFechamento.preco = premio
    }

    // Guarda: remove fechamento se não há posição de opção para fechar
    const opFechamento = operacoes.find(o => o.ticker === opcaoTicker && o.mercado === 'opcao_exercida')
    if (opFechamento) {
      const noLote = operacoes.some(o => o.ticker === opcaoTicker && o.mercado === 'opcao' && o.tipo === 'V')
      if (!noLote) {
        const noDb = await sql`SELECT 1 FROM carteira WHERE user_id = ${userId} AND ticker = ${opcaoTicker} LIMIT 1`
        if (!noDb.length) opsParaRemover.push(opFechamento)
      }
    }
  }
  for (const op of opsParaRemover) {
    const idx = operacoes.indexOf(op)
    if (idx >= 0) operacoes.splice(idx, 1)
  }

  // ── 2. Salva todas as operações em movimentacoes em paralelo ─────────────
  await Promise.all(operacoes.map(op => {
    const t    = String(op.ticker).toUpperCase().trim()
    const qt   = Math.abs(Number(op.quantidade))
    const pm   = Math.abs(Number(op.preco))
    const tipo = op.tipo === 'V' ? 'V' : 'C'
    const venc = op.vencimento ?? null
    return sql`
      INSERT INTO movimentacoes
        (user_id, data, ticker, tipo, quantidade, preco, valor_total,
         corretora, import_batch_id, mercado, data_vencimento)
      VALUES
        (${userId}, ${op.data}::date, ${t}, ${tipo}, ${qt}, ${pm},
         ${(qt * pm).toFixed(2)}::numeric, ${op.notas ?? null},
         ${batchId}::uuid, ${op.mercado ?? 'acao'}, ${venc}::date)
    `
  }))

  // ── 3. Verifica quantas ops serão filtradas pela data_base ─────────────────
  const baseRow  = await sql`SELECT data_base::text FROM posicao_base WHERE user_id = ${userId}`
  const dataBase = (baseRow[0]?.data_base as string) ?? null
  const filtradas = dataBase ? operacoes.filter(op => op.data <= dataBase).length : 0

  // ── 4. Reconstrói carteira — filtro de data_base aplicado automaticamente ─
  await reconstruirCarteira(userId)

  const tickers = [...new Set(operacoes.map(op => String(op.ticker).toUpperCase().trim()))]
  return NextResponse.json({
    ok: true, batch_id: batchId,
    total: operacoes.length, erros: 0, filtradas_por_base: filtradas,
    aviso: filtradas > 0
      ? `${filtradas} operação(ões) ignorada(s) por serem anteriores à posição base (${dataBase}).`
      : null,
    tickers,
  })
}
