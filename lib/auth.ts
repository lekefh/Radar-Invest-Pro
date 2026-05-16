import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// ── JWT ───────────────────────────────────────────────────────────────────────
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET_WEB || 'radar-invest-pro-web-2026-secret'
)

export async function createToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export async function getToken(): Promise<string | null> {
  const store = await cookies()
  return store.get('radar_token')?.value ?? null
}

export async function getSession() {
  const token = await getToken()
  if (!token) return null
  return verifyToken(token)
}

// ── Neon DB ───────────────────────────────────────────────────────────────────
function db() {
  return neon(process.env.DATABASE_URL!)
}

export async function initUsersTable() {
  const sql = db()
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios_web (
      id               SERIAL PRIMARY KEY,
      username         TEXT UNIQUE NOT NULL,
      nome             TEXT NOT NULL,
      email            TEXT UNIQUE NOT NULL,
      senha_hash       TEXT NOT NULL,
      plano            TEXT NOT NULL DEFAULT 'gratuito',
      ativo            BOOLEAN NOT NULL DEFAULT FALSE,
      email_confirmado BOOLEAN NOT NULL DEFAULT FALSE,
      token_conf       TEXT,
      token_expira     TIMESTAMPTZ,
      criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export async function countUsers(): Promise<number> {
  const sql = db()
  const r = await sql`SELECT COUNT(*) AS c FROM usuarios_web`
  return Number(r[0].c)
}

export async function findByEmail(email: string) {
  const sql = db()
  const r = await sql`SELECT * FROM usuarios_web WHERE LOWER(email)=LOWER(${email})`
  return r[0] || null
}

export async function findByUsername(username: string) {
  const sql = db()
  const r = await sql`SELECT * FROM usuarios_web WHERE LOWER(username)=LOWER(${username})`
  return r[0] || null
}

export async function findById(id: number) {
  const sql = db()
  const r = await sql`SELECT * FROM usuarios_web WHERE id=${id}`
  return r[0] || null
}

export async function findByToken(token: string) {
  const sql = db()
  const r = await sql`SELECT * FROM usuarios_web WHERE token_conf=${token}`
  return r[0] || null
}

export async function createUser(params: {
  nome: string; username: string; email: string; senha: string
  plano: string; ativo: boolean; emailConfirmado: boolean
  token: string | null; tokenExpira: Date | null
}) {
  const sql = db()
  const hash = await bcrypt.hash(params.senha, 12)
  const r = await sql`
    INSERT INTO usuarios_web
      (nome, username, email, senha_hash, plano, ativo, email_confirmado, token_conf, token_expira)
    VALUES
      (${params.nome}, ${params.username}, ${params.email}, ${hash},
       ${params.plano}, ${params.ativo}, ${params.emailConfirmado},
       ${params.token}, ${params.tokenExpira})
    RETURNING *
  `
  return r[0]
}

export async function verifyPassword(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

export async function confirmEmail(token: string): Promise<boolean> {
  const user = await findByToken(token)
  if (!user) return false
  if (user.token_expira && new Date(user.token_expira) < new Date()) return false
  const sql = db()
  await sql`
    UPDATE usuarios_web
    SET email_confirmado=TRUE, ativo=TRUE, token_conf=NULL, token_expira=NULL
    WHERE id=${user.id}
  `
  return true
}

export async function listUsers() {
  const sql = db()
  return sql`
    SELECT id, username, nome, email, plano, ativo, email_confirmado, criado_em
    FROM usuarios_web ORDER BY id
  `
}

export async function updateUser(id: number, plano: string, ativo: boolean) {
  const sql = db()
  await sql`UPDATE usuarios_web SET plano=${plano}, ativo=${ativo} WHERE id=${id}`
}

export async function deleteUser(id: number) {
  const sql = db()
  await sql`DELETE FROM usuarios_web WHERE id=${id}`
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function addResetTokenColumns() {
  const sql = db()
  await sql`ALTER TABLE usuarios_web ADD COLUMN IF NOT EXISTS reset_token TEXT`
  await sql`ALTER TABLE usuarios_web ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMPTZ`
}

export async function findByResetToken(token: string) {
  const sql = db()
  const r = await sql`SELECT * FROM usuarios_web WHERE reset_token=${token}`
  return r[0] || null
}

export async function saveResetToken(email: string, token: string, expira: Date) {
  const sql = db()
  await sql`
    UPDATE usuarios_web
    SET reset_token=${token}, reset_token_expira=${expira}
    WHERE LOWER(email)=LOWER(${email})
  `
}

export async function resetPassword(token: string, novaSenha: string): Promise<boolean> {
  const user = await findByResetToken(token)
  if (!user) return false
  if (!user.reset_token_expira || new Date(user.reset_token_expira) < new Date()) return false
  const sql = db()
  const hash = await bcrypt.hash(novaSenha, 12)
  await sql`
    UPDATE usuarios_web
    SET senha_hash=${hash}, reset_token=NULL, reset_token_expira=NULL
    WHERE id=${user.id}
  `
  return true
}

export const RAILWAY_URL =
  process.env.RAILWAY_API_URL ||
  'https://radar-invest-pro-backend-production.up.railway.app'
