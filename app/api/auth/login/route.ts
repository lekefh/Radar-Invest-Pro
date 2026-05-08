import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  initUsersTable, findByEmail, findByUsername,
  verifyPassword, createToken
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { identificador, senha } = await req.json()
    if (!identificador || !senha) {
      return NextResponse.json({ erro: 'Preencha todos os campos.' }, { status: 400 })
    }

    await initUsersTable()

    const usuario = await findByUsername(identificador)
      ?? await findByEmail(identificador)

    if (!usuario) {
      return NextResponse.json({ erro: 'Credenciais inválidas.' }, { status: 401 })
    }

    const senhaOk = await verifyPassword(senha, usuario.senha_hash)
    if (!senhaOk) {
      return NextResponse.json({ erro: 'Credenciais inválidas.' }, { status: 401 })
    }

    if (!usuario.ativo) {
      const msg = usuario.email_confirmado
        ? 'Conta aguardando aprovação.'
        : 'Confirme seu e-mail antes de fazer login.'
      return NextResponse.json({ erro: msg }, { status: 403 })
    }

    const token = await createToken({
      sub:      String(usuario.id),
      username: usuario.username,
      nome:     usuario.nome,
      email:    usuario.email,
      plano:    usuario.plano,
    })

    const store = await cookies()
    store.set('radar_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })

    return NextResponse.json({
      ok: true,
      usuario: {
        id:       usuario.id,
        nome:     usuario.nome,
        username: usuario.username,
        plano:    usuario.plano,
      },
    })
  } catch (e) {
    console.error('[login]', e)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
