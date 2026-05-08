import { NextRequest, NextResponse } from 'next/server'
import { getToken } from '@/lib/auth'

const API =
  process.env.RAILWAY_API_URL ||
  'https://radar-invest-pro-backend-production.up.railway.app'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const token = await getToken()
  if (!token) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const { uid } = await params
  const body = await req.json()

  const url = new URL(`${API}/admin/usuarios/${uid}`)
  if (body.plano !== undefined) url.searchParams.set('plano', body.plano)
  if (body.ativo !== undefined) url.searchParams.set('ativo', String(body.ativo))

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const token = await getToken()
  if (!token) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })

  const { uid } = await params
  const res = await fetch(`${API}/admin/usuarios/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
