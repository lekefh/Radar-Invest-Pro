import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

async function ensureIndicacoesTable() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS indicacoes_empresa (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      ticker     TEXT NOT NULL,
      nome       TEXT,
      motivo     TEXT,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.id) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const sql = getDb()

    // Verifica se é Pro
    const rows = await sql`SELECT plano FROM usuarios_web WHERE id = ${session.id}`
    if (!rows[0] || rows[0].plano !== 'pro') {
      return NextResponse.json({ erro: 'Recurso exclusivo do plano Pro' }, { status: 403 })
    }

    // Limita 1 indicação por mês
    const jaIndicou = await sql`
      SELECT id FROM indicacoes_empresa
      WHERE user_id = ${session.id}
        AND criado_em >= date_trunc('month', NOW())
    `
    if (jaIndicou.length > 0) {
      return NextResponse.json({ erro: 'Você já indicou uma empresa este mês. Nova indicação disponível em 1º do próximo mês.' }, { status: 429 })
    }

    const { ticker, nome, motivo } = await req.json()
    if (!ticker) return NextResponse.json({ erro: 'Ticker obrigatório' }, { status: 400 })

    await ensureIndicacoesTable()
    await sql`
      INSERT INTO indicacoes_empresa (user_id, ticker, nome, motivo)
      VALUES (${session.id}, ${ticker.toUpperCase()}, ${nome || null}, ${motivo || null})
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[indicar]', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.id) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

    const sql = getDb()

    // Verifica se já indicou este mês
    const rows = await sql`
      SELECT ticker, criado_em FROM indicacoes_empresa
      WHERE user_id = ${session.id}
        AND criado_em >= date_trunc('month', NOW())
    `
    return NextResponse.json({ indicouEsteMes: rows.length > 0, indicacao: rows[0] || null })
  } catch (e) {
    console.error('[indicar/get]', e)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
