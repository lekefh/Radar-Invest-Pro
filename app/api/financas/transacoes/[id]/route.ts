import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { PLANOS_FINANCAS } from '@/lib/financas-utils'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    const { id } = await params
    const userId = Number(session.sub)
    const body   = await req.json()
    const sql    = getDb()

    const campos: string[] = []
    const updates: Record<string, unknown> = {}

    if (body.categoria !== undefined)       updates.categoria       = body.categoria
    if (body.ignorar   !== undefined)       updates.ignorar         = body.ignorar
    if (body.descricao !== undefined)       updates.descricao       = body.descricao
    if (body.tipo_lancamento !== undefined) updates.tipo_lancamento = body.tipo_lancamento

    if (!Object.keys(updates).length) return NextResponse.json({ ok: true })

    // Atualiza apenas campos fornecidos — usando updates simples
    if (updates.categoria !== undefined) {
      await sql`UPDATE transacoes_pessoais SET categoria = ${updates.categoria as string} WHERE id = ${Number(id)} AND user_id = ${userId}`
      campos.push('categoria')
    }
    if (updates.ignorar !== undefined) {
      await sql`UPDATE transacoes_pessoais SET ignorar = ${updates.ignorar as boolean} WHERE id = ${Number(id)} AND user_id = ${userId}`
      campos.push('ignorar')
    }
    if (updates.descricao !== undefined) {
      await sql`UPDATE transacoes_pessoais SET descricao = ${updates.descricao as string} WHERE id = ${Number(id)} AND user_id = ${userId}`
      campos.push('descricao')
    }
    if (updates.tipo_lancamento !== undefined) {
      await sql`UPDATE transacoes_pessoais SET tipo_lancamento = ${updates.tipo_lancamento as string} WHERE id = ${Number(id)} AND user_id = ${userId}`
      campos.push('tipo_lancamento')
    }

    return NextResponse.json({ ok: true, campos })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.sub) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    if (!PLANOS_FINANCAS.includes(String(session.plano || 'gratuito'))) {
      return NextResponse.json({ erro: 'Sem acesso' }, { status: 403 })
    }

    const { id } = await params
    const userId = Number(session.sub)
    const sql    = getDb()

    await sql`DELETE FROM transacoes_pessoais WHERE id = ${Number(id)} AND user_id = ${userId}`

    return NextResponse.json({ ok: true })

  } catch (e: unknown) {
    return NextResponse.json({ erro: String(e) }, { status: 500 })
  }
}
