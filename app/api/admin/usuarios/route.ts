import { NextResponse } from 'next/server'
import { getToken } from '@/lib/auth'

const API =
  process.env.RAILWAY_API_URL ||
  'https://radar-invest-pro-backend-production.up.railway.app'

export async function GET() {
  const token = await getToken()
  if (!token) {
    return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
  }

  const res = await fetch(`${API}/admin/usuarios`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
