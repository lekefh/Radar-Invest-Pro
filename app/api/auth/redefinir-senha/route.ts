import { NextRequest, NextResponse } from 'next/server'
import { initUsersTable, addResetTokenColumns, resetPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { token, novaSenha } = await req.json()

    if (!token?.trim()) {
      return NextResponse.json({ erro: 'Token ausente.' }, { status: 400 })
    }
    if (!novaSenha || novaSenha.length < 6) {
      return NextResponse.json({ erro: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    await initUsersTable()
    await addResetTokenColumns()

    const ok = await resetPassword(token.trim(), novaSenha)
    if (!ok) {
      return NextResponse.json({ erro: 'Link inválido ou expirado. Solicite um novo.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, mensagem: 'Senha redefinida com sucesso!' })
  } catch (e) {
    console.error('[redefinir-senha]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
