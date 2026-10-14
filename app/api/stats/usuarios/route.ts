import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const revalidate = 3600

export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`SELECT COUNT(*)::int AS total FROM usuarios_web WHERE ativo = true`
    return NextResponse.json({ total: rows[0]?.total ?? 61 })
  } catch {
    return NextResponse.json({ total: 61 })
  }
}
