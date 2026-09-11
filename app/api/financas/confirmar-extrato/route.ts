import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, ensureFinancasTables } from '@/lib/db'
import { PLANOS_FINANCAS, TransacaoPreview } from '@/lib/financas-utils'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Recurso disponível a partir do plano Starter' }, { status: 403 })
    }

    await ensureFinancasTables()
    const sql    = getDb()
    const userId = Number(session.sub)

    const body: { transacoes: TransacaoPreview[]; banco: string; descricao?: string } = await req.json()
    const { transacoes, banco, descricao } = body

    if (!transacoes?.length) return NextResponse.json({ erro: 'Nenhuma transação para salvar' }, { status: 400 })

    // Filtra duplicatas: mesma (data, historico, valor) já existente para o usuário
    const existentes = await sql`
      SELECT data::text, historico, valor::float FROM transacoes_pessoais
      WHERE user_id = ${userId}
    `
    const chaves = new Set(existentes.map(r =>
      `${r.data}|${r.historico}|${Number(r.valor).toFixed(2)}`
    ))

    const novas = transacoes.filter(t =>
      !chaves.has(`${t.data}|${t.historico}|${Number(t.valor).toFixed(2)}`)
    )

    if (novas.length === 0) {
      return NextResponse.json({ salvos: 0, duplicatas: transacoes.length, batch_id: null })
    }

    // Calcula datas min/max
    const datas  = novas.map(t => t.data).sort()
    const dtIni  = datas[0]
    const dtFim  = datas[datas.length - 1]

    // Cria batch
    const [batch] = await sql`
      INSERT INTO extrato_batches (user_id, banco, total_transacoes, data_inicio, data_fim, descricao)
      VALUES (${userId}, ${banco}, ${novas.length}, ${dtIni}, ${dtFim}, ${descricao || banco})
      RETURNING id
    `

    // Insere transações
    for (const t of novas) {
      await sql`
        INSERT INTO transacoes_pessoais
          (user_id, data, historico, descricao, valor, tipo_lancamento, tipo_extrato, categoria, banco, periodo, batch_id)
        VALUES
          (${userId}, ${t.data}, ${t.historico}, ${t.descricao || ''},
           ${t.valor}, ${t.tipo_lancamento}, ${t.tipo_extrato},
           ${t.categoria || ''}, ${banco}, ${t.periodo || t.data.substring(0,7)},
           ${batch.id})
      `
    }

    return NextResponse.json({
      salvos: novas.length,
      duplicatas: transacoes.length - novas.length,
      batch_id: batch.id,
    })

  } catch (e: unknown) {
    console.error('[confirmar-extrato]', e)
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
