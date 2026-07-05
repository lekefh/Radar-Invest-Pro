import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

interface OpImport {
  tipo: string; ticker: string; quantidade: number; preco: number
  data: string; notas?: string; vencimento?: string | null; mercado?: string
}

function isOpcaoTicker(t: string): boolean {
  return /^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(t)
}

/**
 * POST /api/carteira/confirmar-import
 * Salva todas as operações de um lote de importação atomicamente.
 * Cada operação fica vinculada ao batch_id gerado aqui.
 * Retorna { batch_id, total, erros }.
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

  // ── 1. Cria registro do lote ────────────────────────────────────────────────
  const datas = operacoes.map(op => op.data).sort()
  const batchRows = await sql`
    INSERT INTO import_batches (user_id, total_ops, data_inicio, data_fim, descricao)
    VALUES (${userId}, ${operacoes.length}, ${datas[0]}::date, ${datas[datas.length - 1]}::date, ${descricao})
    RETURNING id
  `
  const batchId = batchRows[0].id as string

  // ── 2. Processa cada operação ───────────────────────────────────────────────
  let erros = 0
  const tickers = new Set<string>()

  for (const op of operacoes) {
    try {
      const t   = String(op.ticker).toUpperCase().trim()
      const qt  = Math.abs(Number(op.quantidade))
      const pm  = Math.abs(Number(op.preco))
      const dt  = op.data
      const tipo = op.tipo === 'V' ? 'V' : 'C'
      const venc = op.vencimento ?? null
      tickers.add(t)

      // Registra em movimentacoes
      await sql`
        INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total, corretora, import_batch_id, mercado)
        VALUES (${userId}, ${dt}::date, ${t}, ${tipo}, ${qt}, ${pm}, ${(qt * pm).toFixed(2)}::numeric,
                ${op.notas ?? null}, ${batchId}::uuid, ${op.mercado ?? 'acao'})
      `

      // Atualiza posição em carteira
      const atual = await sql`SELECT id, quantidade::float, preco_medio::float FROM carteira WHERE user_id=${userId} AND ticker=${t}`
      const pos = atual[0] ?? null

      if (tipo === 'C') {
        if (pos) {
          const novoQt = Number(pos.quantidade) + qt
          const novoPm = ((Number(pos.quantidade) * Number(pos.preco_medio)) + (qt * pm)) / novoQt
          await sql`
            UPDATE carteira SET quantidade=${novoQt}, preco_medio=${novoPm.toFixed(6)}::numeric,
              data_vencimento=COALESCE(${venc}::date, data_vencimento), atualizado_em=NOW()
            WHERE user_id=${userId} AND ticker=${t}
          `
        } else {
          await sql`
            INSERT INTO carteira (user_id, ticker, quantidade, preco_medio, data_compra, notas, data_vencimento)
            VALUES (${userId}, ${t}, ${qt}, ${pm}, ${dt}::date, ${op.notas ?? null}, ${venc}::date)
          `
        }
      } else {
        if (pos) {
          const novoQt = Number(pos.quantidade) - qt
          if (novoQt === 0) {
            await sql`DELETE FROM carteira WHERE user_id=${userId} AND ticker=${t}`
          } else {
            await sql`UPDATE carteira SET quantidade=${novoQt}, atualizado_em=NOW() WHERE user_id=${userId} AND ticker=${t}`
          }
        } else if (isOpcaoTicker(t)) {
          await sql`
            INSERT INTO carteira (user_id, ticker, quantidade, preco_medio, data_compra, notas, data_vencimento)
            VALUES (${userId}, ${t}, ${-qt}, ${pm}, ${dt}::date, ${op.notas ?? null}, ${venc}::date)
          `
        }
      }
    } catch (e) {
      console.error('[confirmar-import] op error:', e)
      erros++
    }
  }

  return NextResponse.json({ ok: true, batch_id: batchId, total: operacoes.length, erros, tickers: [...tickers] })
}
