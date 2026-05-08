import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const store = await cookies()
  store.delete('radar_token')
  return NextResponse.json({ ok: true })
}
