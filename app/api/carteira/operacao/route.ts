import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureCarteiraTables } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Opções B3: 4 letras (ativo) + letra série A-X + strike alfanumérico (ex: 295E, 254W1E)
function isOpcaoTicker(t: string): boolean {
  return /^[A-Z]{4}[A-X][A-Z0-9]{2,}$/.test(t)
}

/**
 * POST /api/carteira/operacao
 * Processa uma operação de compra ou venda:
 *   COMPRA → insere posição (titular) ou recalcula preço médio ponderado
 *   VENDA  → subtrai quantidade; se zerar, remove a posição
 *            Para opções sem posição prévia → cria posição negativa (lançador)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const userId = Number(session.sub)

    await ensureCarteiraTables()
    const sql = getDb()

    const body = await req.json()
    const { ticker, tipo, quantidade, preco, data_compra, notas } = body

    if (!ticker || !tipo || quantidade == null || preco == null) {
      return NextResponse.json({ error: 'ticker, tipo, quantidade e preco são obrigatórios' }, { status: 400 })
    }

    const t   = String(ticker).toUpperCase().trim()
    const qt  = Math.abs(Number(quantidade))
    const pm  = Math.abs(Number(preco))
    const dt  = data_compra ? String(data_compra) : new Date().toISOString().slice(0, 10)
    const op  = String(tipo).toUpperCase() === 'V' ? 'V' : 'C'

    // Busca posição atual
    const atual = await sql`
      SELECT id, quantidade::float, preco_medio::float
      FROM carteira
      WHERE user_id = ${userId} AND ticker = ${t}
    `
    const posicaoAtual = atual[0] ?? null

    if (op === 'C') {
      // ── COMPRA: preço médio ponderado ──────────────────────────────────────
      if (posicaoAtual) {
        const qtAtual = Number(posicaoAtual.quantidade)
        const pmAtual = Number(posicaoAtual.preco_medio)
        const novoQt  = qtAtual + qt
        const novoPm  = ((qtAtual * pmAtual) + (qt * pm)) / novoQt

        await sql`
          UPDATE carteira
          SET quantidade  = ${novoQt},
              preco_medio = ${novoPm.toFixed(6)}::numeric,
              atualizado_em = NOW()
          WHERE user_id = ${userId} AND ticker = ${t}
        `
      } else {
        await sql`
          INSERT INTO carteira (user_id, ticker, quantidade, preco_medio, data_compra, notas)
          VALUES (${userId}, ${t}, ${qt}, ${pm}, ${dt}::date, ${notas ?? null})
        `
      }
    } else {
      // ── VENDA: subtrai quantidade ───────────────────────────────────────────
      if (posicaoAtual) {
        const qtAtual = Number(posicaoAtual.quantidade)
        const novoQt  = qtAtual - qt

        if (novoQt === 0) {
          await sql`DELETE FROM carteira WHERE user_id = ${userId} AND ticker = ${t}`
        } else {
          // Pode ficar negativo para opções (lançador que vendeu mais do que tinha comprado)
          await sql`
            UPDATE carteira
            SET quantidade    = ${novoQt},
                atualizado_em = NOW()
            WHERE user_id = ${userId} AND ticker = ${t}
          `
        }
      } else if (isOpcaoTicker(t)) {
        // Opção vendida sem posição prévia → lançador: cria posição com quantidade negativa
        await sql`
          INSERT INTO carteira (user_id, ticker, quantidade, preco_medio, data_compra, notas)
          VALUES (${userId}, ${t}, ${-qt}, ${pm}, ${dt}::date, ${notas ?? null})
        `
      }
      // Ação sem posição prévia → ignora silenciosamente (não é possível vender a descoberto)
    }

    // Registra movimentação
    try {
      await sql`
        INSERT INTO movimentacoes (user_id, data, ticker, tipo, quantidade, preco, valor_total)
        VALUES (${userId}, ${dt}::date, ${t}, ${op}, ${qt}, ${pm}, ${(qt * pm).toFixed(2)}::numeric)
      `
    } catch (e) {
      console.warn('[operacao] movimentacoes insert warn:', e)
    }

    return NextResponse.json({ ok: true, ticker: t, tipo: op, quantidade: qt, preco: pm })
  } catch (e) {
    console.error('[POST /api/carteira/operacao]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
