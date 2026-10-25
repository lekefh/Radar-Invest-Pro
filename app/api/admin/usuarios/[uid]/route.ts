import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateUser, deleteUser, ativarTrial } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getSession()
  if (!session || session.plano !== 'analista') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }
  const { uid } = await params
  const { plano, ativo, trial_dias } = await req.json()
  if (trial_dias) {
    await ativarTrial(Number(uid), Number(trial_dias))
    return NextResponse.json({ ok: true })
  }
  await updateUser(Number(uid), plano, ativo === 1 || ativo === true)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await getSession()
  if (!session || session.plano !== 'analista') {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 })
  }
  const { uid } = await params
  await deleteUser(Number(uid))
  return NextResponse.json({ ok: true })
}
