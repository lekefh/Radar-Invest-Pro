import { neon } from '@neondatabase/serverless'

/* getDb() — inicializa só quando a rota é chamada (não no build) */
export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada. Adicione em Vercel → Settings → Environment Variables.')
  return neon(url)
}
