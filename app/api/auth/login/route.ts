import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API =
  process.env.RAILWAY_API_URL ||
  'https://radar-invest-pro-backend-production.up.railway.app'

export async function POST(req: NextRequest) {
  try {
    const { identificador, senha } = await req.json()
    if (!identificador || !senha) {
      return NextResponse.json({ erro: 'Preencha todos os campos.' }, { status: 400 })
    }

    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identificador, senha, hardware_id: 'web' }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { erro: data.detail || 'Credenciais inválidas.' },
        { status: res.status }
      )
    }

    const store = await cookies()
    store.set('radar_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return NextResponse.json({
      ok: true,
      usuario: {
        id:         data.id,
        nome:       data.nome,
        username:   data.username,
        plano:      data.plano,
        permissoes: data.permissoes,
      },
    })
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
