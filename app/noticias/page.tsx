'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import fundamentaisRaw from '@/lib/fundamentais.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fundamentais = fundamentaisRaw as unknown as Record<string, any>
const nv = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null)

interface FatoItem {
  titulo: string; data?: string; categoria: string
  sentimento: 'Positivo' | 'Neutro' | 'Negativo'
  impacto_governanca: string; impacto_projecoes: string
  descricao: string; sugestao_governanca?: string; sugestao_projecao?: string
}
interface MrData {
  data: string; alerta: boolean
  govImpacto: string; projImpacto: string
  resumo: string; fatos: FatoItem[]; resumoGeral: string
}
interface Empresa {
  ticker: string; nome: string; setor: string; mr: MrData
  nota: number | null; dcfUpside: number | null
}

type Semaforo = 'verde' | 'amarelo' | 'vermelho'
type Ordem    = 'data' | 'nota' | 'upside'
type Ordem2   = Ordem | 'nenhum'

const COR: Record<Semaforo, string> = {
  verde:    '#66BB6A',
  amarelo:  '#FFD54F',
  vermelho: '#EF5350',
}
const COR_BG: Record<Semaforo, string> = {
  verde:    'rgba(102,187,106,.08)',
  amarelo:  'rgba(255,213,79,.08)',
  vermelho: 'rgba(239,83,80,.08)',
}
const COR_BORDER: Record<Semaforo, string> = {
  verde:    'rgba(102,187,106,.25)',
  amarelo:  'rgba(255,213,79,.25)',
  vermelho: 'rgba(239,83,80,.35)',
}
const LABEL: Record<Semaforo, string> = {
  verde:    'Notícias Favoráveis',
  amarelo:  'Cenário Misto',
  vermelho: 'Atenção Necessária',
}

function calcSemaforo(mr: MrData): Semaforo {
  const total = mr.fatos?.length ?? 0
  if (total === 0) return 'amarelo'
  const ratioNeg = mr.fatos.filter(f => f.sentimento === 'Negativo').length / total
  if (ratioNeg > 0.30) return 'vermelho'
  if (ratioNeg > 0.20) return 'amarelo'
  return 'verde'
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function corNota(nota: number | null) {
  if (nota == null) return '#4a5d73'
  if (nota >= 7)    return '#66BB6A'
  if (nota >= 5)    return '#FFD54F'
  return '#EF5350'
}

function comparar(a: Empresa, b: Empresa, campo: Ordem): number {
  if (campo === 'nota') {
    if (a.nota == null && b.nota == null) return 0
    if (a.nota == null) return 1
    if (b.nota == null) return -1
    return b.nota - a.nota
  }
  if (campo === 'upside') {
    if (a.dcfUpside == null && b.dcfUpside == null) return 0
    if (a.dcfUpside == null) return 1
    if (b.dcfUpside == null) return -1
    return b.dcfUpside - a.dcfUpside
  }
  // data: mais recente primeiro; alerta sobe em empate de timestamp
  const dt = new Date(b.mr.data).getTime() - new Date(a.mr.data).getTime()
  if (dt !== 0) return dt
  return a.mr.alerta === b.mr.alerta ? 0 : a.mr.alerta ? -1 : 1
}

function sortLista(lista: Empresa[], ordem1: Ordem, ordem2: Ordem2 = 'nenhum'): Empresa[] {
  return [...lista].sort((a, b) => {
    const r1 = comparar(a, b, ordem1)
    if (r1 !== 0) return r1
    if (ordem2 !== 'nenhum') return comparar(a, b, ordem2)
    return 0
  })
}

// ─── Modal detalhe de fatos ───────────────────────────────────────────────────
function ModalFatos({ empresa, onClose }: { empresa: Empresa; onClose: () => void }) {
  const mr  = empresa.mr
  const sem = calcSemaforo(mr)
  const pos = mr.fatos?.filter(f => f.sentimento === 'Positivo').length ?? 0
  const neg = mr.fatos?.filter(f => f.sentimento === 'Negativo').length ?? 0
  const neu = mr.fatos?.filter(f => f.sentimento === 'Neutro').length ?? 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 300,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#0d1a2e', border: `1px solid ${COR_BORDER[sem]}`,
                    borderRadius: '16px', width: '100%', maxWidth: '680px',
                    maxHeight: '88vh', overflowY: 'auto', padding: '28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(232,160,32,.15)', border: '1px solid rgba(232,160,32,.3)',
                             borderRadius: '7px', padding: '4px 11px', fontSize: '15px', fontWeight: 800, color: '#e8a020' }}>
                {empresa.ticker}
              </span>
              <span style={{ background: COR_BG[sem], border: `1px solid ${COR_BORDER[sem]}`,
                             borderRadius: '20px', padding: '3px 11px', fontSize: '11px', fontWeight: 700,
                             color: COR[sem], display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '9px' }}>●</span>{LABEL[sem]}
              </span>
              {mr.alerta && (
                <span style={{ background: 'rgba(239,83,80,.15)', border: '1px solid rgba(239,83,80,.4)',
                               borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: '#EF5350' }}>
                  ⚠ ALERTA
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#6b84a8' }}>
              {empresa.nome} · Análise de {formatDate(mr.data)}
            </div>
            {/* Nota + Upside no modal */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              {empresa.nota != null && (
                <span style={{ background: `${corNota(empresa.nota)}18`,
                               border: `1px solid ${corNota(empresa.nota)}50`,
                               borderRadius: '20px', padding: '3px 10px',
                               fontSize: '12px', fontWeight: 700, color: corNota(empresa.nota) }}>
                  ★ {empresa.nota.toFixed(1)} / 10
                </span>
              )}
              {empresa.dcfUpside != null && (
                <span style={{ background: empresa.dcfUpside >= 0 ? 'rgba(102,187,106,.12)' : 'rgba(239,83,80,.12)',
                               border: `1px solid ${empresa.dcfUpside >= 0 ? 'rgba(102,187,106,.4)' : 'rgba(239,83,80,.4)'}`,
                               borderRadius: '20px', padding: '3px 10px',
                               fontSize: '12px', fontWeight: 700,
                               color: empresa.dcfUpside >= 0 ? '#66BB6A' : '#EF5350' }}>
                  DCF {empresa.dcfUpside >= 0 ? '+' : ''}{empresa.dcfUpside.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b84a8', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Resumo geral */}
        {mr.resumoGeral && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', color: '#6b84a8', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '.8px', marginBottom: '8px' }}>Resumo Geral da Análise</div>
            <div style={{ fontSize: '13px', color: '#b8c4d4', lineHeight: 1.7 }}>{mr.resumoGeral}</div>
          </div>
        )}

        {/* Contadores */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          {[
            { label: 'Positivos', count: pos, cor: '#66BB6A' },
            { label: 'Neutros',   count: neu, cor: '#90A4AE' },
            { label: 'Negativos', count: neg, cor: '#EF5350' },
          ].map(({ label, count, cor }) => (
            <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,.03)',
                                      border: '1px solid rgba(255,255,255,.07)', borderRadius: '8px',
                                      padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: cor }}>{count}</div>
              <div style={{ fontSize: '11px', color: '#6b84a8', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Fatos */}
        <div style={{ fontSize: '11px', color: '#6b84a8', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.8px', marginBottom: '10px' }}>
          Fatos Relevantes ({mr.fatos?.length ?? 0})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(mr.fatos ?? []).map((f, i) => {
            const cor = f.sentimento === 'Positivo' ? '#66BB6A'
                      : f.sentimento === 'Negativo' ? '#EF5350' : '#90A4AE'
            const bgC = f.sentimento === 'Positivo' ? 'rgba(102,187,106,.06)'
                      : f.sentimento === 'Negativo' ? 'rgba(239,83,80,.06)' : 'rgba(255,255,255,.02)'
            const bdC = f.sentimento === 'Positivo' ? 'rgba(102,187,106,.2)'
                      : f.sentimento === 'Negativo' ? 'rgba(239,83,80,.2)' : 'rgba(255,255,255,.06)'
            return (
              <div key={i} style={{ background: bgC, border: `1px solid ${bdC}`,
                                    borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#e8edf5', flex: 1, paddingRight: '12px' }}>
                    {f.titulo}
                  </div>
                  <span style={{ background: `${cor}20`, border: `1px solid ${cor}50`,
                                 borderRadius: '20px', padding: '2px 10px', fontSize: '10px',
                                 fontWeight: 700, color: cor, whiteSpace: 'nowrap' as const }}>
                    {f.sentimento}
                  </span>
                </div>
                {f.data && (
                  <div style={{ fontSize: '10px', color: '#4a5d73', marginBottom: '6px' }}>{f.data}</div>
                )}
                <div style={{ fontSize: '12.5px', color: '#8fa4bc', lineHeight: 1.6 }}>{f.descricao}</div>
                {f.impacto_projecoes && f.impacto_projecoes !== '—' && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#6b84a8',
                                paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    📈 <span style={{ color: '#90A4AE' }}>Projeções:</span> {f.impacto_projecoes}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Impactos resumidos */}
        {(mr.govImpacto || mr.projImpacto) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '18px' }}>
            {mr.govImpacto && (
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
                            borderRadius: '9px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: '#6b84a8', fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '.5px', marginBottom: '6px' }}>🏛 Governança</div>
                <div style={{ fontSize: '12px', color: '#8fa4bc', lineHeight: 1.5 }}>{mr.govImpacto}</div>
              </div>
            )}
            {mr.projImpacto && (
              <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
                            borderRadius: '9px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: '#6b84a8', fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '.5px', marginBottom: '6px' }}>📈 Projeções</div>
                <div style={{ fontSize: '12px', color: '#8fa4bc', lineHeight: 1.5 }}>{mr.projImpacto}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card da empresa ──────────────────────────────────────────────────────────
function CardEmpresa({ empresa, onClick }: { empresa: Empresa; onClick: () => void }) {
  const mr  = empresa.mr
  const sem = calcSemaforo(mr)
  const pos = mr.fatos?.filter(f => f.sentimento === 'Positivo').length ?? 0
  const neg = mr.fatos?.filter(f => f.sentimento === 'Negativo').length ?? 0
  const neu = (mr.fatos?.length ?? 0) - pos - neg
  const upCor = empresa.dcfUpside != null
    ? (empresa.dcfUpside >= 0 ? '#66BB6A' : '#EF5350') : '#4a5d73'

  return (
    <div
      onClick={onClick}
      style={{ background: COR_BG[sem], border: `1px solid ${COR_BORDER[sem]}`,
               borderRadius: '14px', padding: '18px 20px', cursor: 'pointer',
               transition: 'all .15s', position: 'relative' }}
    >
      {/* Semáforo top-right */}
      <div style={{ position: 'absolute', top: '14px', right: '16px',
                    display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%',
                       background: COR[sem], display: 'inline-block',
                       boxShadow: `0 0 8px ${COR[sem]}` }} />
        <span style={{ fontSize: '10px', fontWeight: 700, color: COR[sem] }}>{LABEL[sem]}</span>
      </div>

      {/* Ticker + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', paddingRight: '140px' }}>
        <span style={{ background: 'rgba(232,160,32,.15)', border: '1px solid rgba(232,160,32,.3)',
                       borderRadius: '7px', padding: '4px 10px', fontSize: '14px', fontWeight: 800, color: '#e8a020' }}>
          {empresa.ticker}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8edf5',
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {empresa.nome}
        </span>
      </div>

      {/* Nota + Upside DCF */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {empresa.nota != null && (
          <span style={{ background: `${corNota(empresa.nota)}15`,
                         border: `1px solid ${corNota(empresa.nota)}45`,
                         borderRadius: '20px', padding: '2px 10px',
                         fontSize: '11px', fontWeight: 700, color: corNota(empresa.nota) }}>
            ★ {empresa.nota.toFixed(1)}
          </span>
        )}
        {empresa.dcfUpside != null && (
          <span style={{ background: `${upCor}15`, border: `1px solid ${upCor}45`,
                         borderRadius: '20px', padding: '2px 10px',
                         fontSize: '11px', fontWeight: 700, color: upCor }}>
            DCF {empresa.dcfUpside >= 0 ? '+' : ''}{empresa.dcfUpside.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Contadores de sentimento */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', color: '#66BB6A', fontWeight: 700 }}>●{pos} positivo{pos !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: '12px', color: '#90A4AE', fontWeight: 600 }}>●{neu} neutro{neu !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: '12px', color: '#EF5350', fontWeight: 700 }}>●{neg} negativo{neg !== 1 ? 's' : ''}</span>
      </div>

      {/* Resumo */}
      {mr.resumo && (
        <div style={{ fontSize: '12px', color: '#6b84a8', lineHeight: 1.6,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
          {mr.resumo}
        </div>
      )}

      {/* Data + alerta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
        <span style={{ fontSize: '10px', color: '#4a5d73' }}>Análise: {formatDate(mr.data)}</span>
        {mr.alerta && (
          <span style={{ background: 'rgba(239,83,80,.15)', border: '1px solid rgba(239,83,80,.4)',
                         borderRadius: '5px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, color: '#EF5350' }}>
            ⚠ ALERTA
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
const PLANOS_PERMITIDOS = ['essencial', 'pro', 'analista']

export default function NoticiasPage() {
  const router = useRouter()
  const [acesso, setAcesso]       = useState<'verificando' | 'liberado' | 'bloqueado'>('verificando')
  const [empresas, setEmpresas]   = useState<Empresa[]>([])
  const [modal, setModal]         = useState<Empresa | null>(null)
  const [filtro, setFiltro]       = useState<'todos' | 'verde' | 'amarelo' | 'vermelho'>('todos')
  const [busca, setBusca]         = useState('')
  const [ordem1, setOrdem1]       = useState<Ordem>('data')
  const [ordem2, setOrdem2]       = useState<Ordem2>('nenhum')

  // Verifica plano antes de carregar dados
  useEffect(() => {
    const raw = localStorage.getItem('radar_usuario')
    if (!raw) { router.push('/login'); return }
    try {
      const u = JSON.parse(raw)
      if (PLANOS_PERMITIDOS.includes(u.plano)) setAcesso('liberado')
      else setAcesso('bloqueado')
    } catch { router.push('/login') }
  }, [router])

  useEffect(() => {
    if (acesso !== 'liberado') return
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 4)

    // Constrói lista base a partir do JSON estático
    const listaBase: Omit<Empresa, 'nota' | 'dcfUpside'>[] = []
    for (const [key, val] of Object.entries(fundamentais)) {
      if (!val?.mr) continue
      const mr = val.mr as MrData
      if (!mr.fatos || !Array.isArray(mr.fatos)) continue
      if (mr.data && new Date(mr.data) < cutoff) continue
      listaBase.push({
        ticker: (val.ticker as string | undefined)?.replace('.SA', '') ?? key,
        nome:   (val.nome   as string | undefined) ?? key,
        setor:  (val.setor  as string | undefined) ?? '',
        mr,
      })
    }

    // Enriquece com nota e dcfUpside da API (preços em tempo real)
    fetch('/api/acoes')
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((json: { acoes: any[] }) => {
        const apiMap: Record<string, { nota: number | null; dcfUpside: number | null }> = {}
        for (const a of json.acoes ?? []) {
          const tick = (a.ticker as string).replace('.SA', '')
          apiMap[tick] = { nota: nv(a.nota), dcfUpside: nv(a.dcfUpside) }
        }
        const lista: Empresa[] = listaBase.map(e => ({
          ...e,
          nota:      apiMap[e.ticker]?.nota      ?? nv(fundamentais[e.ticker]?.nota),
          dcfUpside: apiMap[e.ticker]?.dcfUpside ?? null,
        }))
        setEmpresas(sortLista(lista, 'data', 'nenhum'))
      })
      .catch(() => {
        // Fallback sem preço em tempo real
        const lista: Empresa[] = listaBase.map(e => ({
          ...e,
          nota:      nv(fundamentais[e.ticker]?.nota),
          dcfUpside: null,
        }))
        setEmpresas(sortLista(lista, 'data', 'nenhum'))
      })
  }, [acesso])

  const termo = busca.trim().toLowerCase()
  const filtradas = sortLista(
    empresas.filter(e => {
      if (filtro !== 'todos' && calcSemaforo(e.mr) !== filtro) return false
      if (termo && !e.ticker.toLowerCase().includes(termo) && !e.nome.toLowerCase().includes(termo)) return false
      return true
    }),
    ordem1,
    ordem2
  )

  const totais = {
    verde:    empresas.filter(e => calcSemaforo(e.mr) === 'verde').length,
    amarelo:  empresas.filter(e => calcSemaforo(e.mr) === 'amarelo').length,
    vermelho: empresas.filter(e => calcSemaforo(e.mr) === 'vermelho').length,
  }

  // Tela de acesso bloqueado
  if (acesso === 'verificando') return null

  if (acesso === 'bloqueado') return (
    <>
      <NavBar />
      <div style={{ minHeight: '100vh', background: '#050d1a', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#0d1a2e', border: '1px solid rgba(232,160,32,.2)',
                      borderRadius: '20px', padding: '48px 40px', maxWidth: '420px',
                      textAlign: 'center', fontFamily: 'Inter,sans-serif' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8edf5', margin: '0 0 10px' }}>
            Recurso Exclusivo
          </h2>
          <p style={{ fontSize: '13px', color: '#6b84a8', lineHeight: 1.7, margin: '0 0 28px' }}>
            A aba <strong style={{ color: '#e8edf5' }}>Notícias &amp; Fatos Relevantes</strong> está
            disponível a partir do plano <strong style={{ color: '#e8a020' }}>Essencial</strong>.
            Faça upgrade para acessar análises de sentimento, semáforo de empresas e ordenação por nota e upside DCF.
          </p>
          <a href="/planos" style={{
            display: 'inline-block', background: '#e8a020', color: '#050d1a',
            fontWeight: 700, fontSize: '13px', padding: '10px 28px',
            borderRadius: '8px', textDecoration: 'none',
          }}>
            Ver planos
          </a>
        </div>
      </div>
    </>
  )

  return (
    <>
      <NavBar />
      <div style={{ minHeight: '100vh', background: '#050d1a', padding: '24px',
                    color: '#e8edf5', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#e8edf5', margin: '0 0 4px' }}>
                📰 Fatos Relevantes — B3
              </h1>
              <p style={{ fontSize: '13px', color: '#4a5d73', margin: 0 }}>
                Últimos 4 meses · {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} analisada{empresas.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Campo de busca */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
                             fontSize: '13px', color: '#4a5d73', pointerEvents: 'none' }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar ticker ou empresa..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box' as const,
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: '8px', padding: '8px 12px 8px 32px',
                  color: '#e8edf5', fontSize: '13px', outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Linha de controles: filtro semáforo + ordenação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>

            {/* Filtros de sentimento */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                { key: 'todos',    label: 'Todas',      count: empresas.length, cor: '#6b84a8' },
                { key: 'verde',    label: 'Favoráveis', count: totais.verde,    cor: '#66BB6A' },
                { key: 'amarelo',  label: 'Mistas',     count: totais.amarelo,  cor: '#FFD54F' },
                { key: 'vermelho', label: 'Atenção',    count: totais.vermelho, cor: '#EF5350' },
              ] as const).map(({ key, label, count, cor }) => (
                <button
                  key={key}
                  onClick={() => setFiltro(key)}
                  style={{
                    background: filtro === key ? `${cor}20` : 'rgba(255,255,255,.03)',
                    border: `1px solid ${filtro === key ? `${cor}60` : 'rgba(255,255,255,.08)'}`,
                    borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
                    color: filtro === key ? cor : '#6b84a8',
                    fontSize: '12.5px', fontWeight: filtro === key ? 700 : 500,
                    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all .15s',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%',
                                 background: cor, display: 'inline-block' }} />
                  {label}
                  <span style={{ background: 'rgba(255,255,255,.08)', borderRadius: '12px',
                                 padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Ordenação dupla */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* 1ª Ordem */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '10px', color: '#4a5d73', fontWeight: 700,
                               textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' as const }}>
                  1ª
                </span>
                {([
                  { key: 'data',   label: '📅 Data'   },
                  { key: 'nota',   label: '★ Nota'    },
                  { key: 'upside', label: '📈 Upside' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setOrdem1(key)
                      // Se 2ª era igual à nova 1ª, limpa a 2ª
                      if (ordem2 === key) setOrdem2('nenhum')
                    }}
                    style={{
                      background: ordem1 === key ? 'rgba(232,160,32,.15)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${ordem1 === key ? 'rgba(232,160,32,.4)' : 'rgba(255,255,255,.08)'}`,
                      borderRadius: '7px', padding: '5px 11px', cursor: 'pointer',
                      color: ordem1 === key ? '#e8a020' : '#6b84a8',
                      fontSize: '12px', fontWeight: ordem1 === key ? 700 : 500,
                      transition: 'all .15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <span style={{ color: 'rgba(255,255,255,.12)', fontSize: '16px' }}>›</span>

              {/* 2ª Ordem */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '10px', color: '#4a5d73', fontWeight: 700,
                               textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' as const }}>
                  2ª
                </span>
                {([
                  { key: 'nenhum', label: '—'         },
                  { key: 'data',   label: '📅 Data'   },
                  { key: 'nota',   label: '★ Nota'    },
                  { key: 'upside', label: '📈 Upside' },
                ] as const).filter(o => o.key === 'nenhum' || o.key !== ordem1).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setOrdem2(key as Ordem2)}
                    style={{
                      background: ordem2 === key ? 'rgba(100,149,237,.15)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${ordem2 === key ? 'rgba(100,149,237,.4)' : 'rgba(255,255,255,.08)'}`,
                      borderRadius: '7px', padding: '5px 11px', cursor: 'pointer',
                      color: ordem2 === key ? '#6495ED' : '#6b84a8',
                      fontSize: '12px', fontWeight: ordem2 === key ? 700 : 500,
                      transition: 'all .15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid de cards */}
          {empresas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px', color: '#4a5d73' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Nenhuma análise disponível</div>
              <div style={{ fontSize: '13px' }}>
                Use a aba <strong>Teses &amp; Earnings</strong> no app desktop para analisar fatos relevantes
                e depois clique em <strong>Enviar para Web</strong>.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                          gap: '14px' }}>
              {filtradas.map(e => (
                <CardEmpresa key={e.ticker} empresa={e} onClick={() => setModal(e)} />
              ))}
              {filtradas.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: '#4a5d73' }}>
                  {termo ? `Nenhuma empresa encontrada para "${busca}".` : 'Nenhuma empresa neste filtro.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modal && <ModalFatos empresa={modal} onClose={() => setModal(null)} />}
    </>
  )
}
