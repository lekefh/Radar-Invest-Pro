import { cookies } from 'next/headers'

export const RAILWAY_URL =
  process.env.RAILWAY_API_URL ||
  'https://radar-invest-pro-backend-production.up.railway.app'

export async function getToken(): Promise<string | null> {
  const store = await cookies()
  return store.get('radar_token')?.value ?? null
}

export async function getSession() {
  const token = await getToken()
  if (!token) return null
  try {
    const res = await fetch(`${RAILWAY_URL}/auth/validar`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
