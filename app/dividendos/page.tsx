'use client'
import { useState, useMemo } from 'react'
import NavBar from '@/components/NavBar'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dividendosData = require('@/lib/dividendos.json') as DividendosJSON

interface Provento {
  ticker: string
  tipo: string
  valor: number
  data_com: string | null
  data_ex: string
  data_pagamento: string | null
  yield_pct: number | null
  status: 'pago' | 'declarado'
}

interface DividendosJSON {
  atualizado: string
  total: number
  proventos: Provento[]
}

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const COR_TIPO: Record<string, { bg: string; text: string; border: string }> = {
  'DIVIDENDO/JCP': { bg: 'rgba(232,160,32,.15)', text: '#e8a020', border: 'rgba(232,160,32,.35)' },
  'RENDIMENTO':    { bg: 'rgba(102,187,106,.12)', text: '#66bb6a', border: 'rgba(102,187,106,.35)' },
  'DIVIDENDO':     { bg: 'rgba(232,160,32,.15)', text: '#e8a020', border: 'rgba(232,160,32,.35)' },
}

function cor(tipo: string) {
  return COR_TIPO[tipo] ?? COR_TIPO['DIVIDENDO/JCP']
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtValor(v: number) {
  return `R$ ${v.toFixed(4)}`
}

export default function DividendosPage() {
  const proventos: Provento[] = dividendosData.proventos ?? []
  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() // 0-based

  const [mesSelecionado, setMesSelecionado] = useState<number | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'data_ex', dir: 'desc' })

  function toggleSort(key: string) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })
  }

  // Agrupar por mês/ano da data_ex para o mapa
  const porMes = useMemo(() => {
    const mapa: Record<string, Provento[]> = {}
    for (const p of proventos) {
      if (!p.data_ex) continue
      const [y, m] = p.data_ex.split('-')
      const chave = `${y}-${m}`
      if (!mapa[chave]) mapa[chave] = []
      mapa[chave].push(p)
    }
    return mapa
  }, [proventos])

  // Meses do ano atual para o grid
  const mesesGrid = useMemo(() =>
    MESES.map((nome, idx) => {
      const chave = `${anoAtual}-${String(idx + 1).padStart(2, '0')}`
      const itens = porMes[chave] ?? []
      const tickersUnicos = [...new Set(itens.map(p => p.ticker))]
      return { nome, idx, chave, itens, tickersUnicos }
    }), [porMes, anoAtual])

  // Tabela filtrada
  const tabelaFiltrada = useMemo(() => {
    let lista = [...proventos]
    if (mesSelecionado !== null) {
      const chave = `${anoAtual}-${String(mesSelecionado + 1).padStart(2, '0')}`
      lista = lista.filter(p => p.data_ex?.startsWith(chave.replace('-', '-').slice(0, 7)))
    }
    if (filtroTipo !== 'todos') {
      lista = lista.filter(p => p.tipo === filtroTipo)
    }
    if (busca.trim()) {
      const b = busca.trim().toUpperCase()
      lista = lista.filter(p => p.ticker.includes(b))
    }
    // Ordenação por coluna
    lista.sort((a, b) => {
      const { key, dir } = sort
      let va: number | string = 0
      let vb: number | string = 0
      if (key === 'ticker')       { va = a.ticker;              vb = b.ticker }
      else if (key === 'tipo')    { va = a.tipo;                vb = b.tipo }
      else if (key === 'data_com'){ va = a.data_com ?? '';      vb = b.data_com ?? '' }
      else if (key === 'data_ex') { va = a.data_ex ?? '';       vb = b.data_ex ?? '' }
      else if (key === 'data_pag'){ va = a.data_pagamento ?? ''; vb = b.data_pagamento ?? '' }
      else if (key === 'valor')   { va = a.valor;               vb = b.valor }
      else if (key === 'yield')   { va = a.yield_pct ?? -1;     vb = b.yield_pct ?? -1 }
      else if (key === 'status')  { va = a.status;              vb = b.status }
      const cmp = typeof va === 'number' ? va - (vb as number) : (va as string).localeCompare(vb as string)
      return dir === 'asc' ? cmp : -cmp
    })
    return lista
  }, [proventos, mesSelecionado, filtroTipo, busca, anoAtual, sort])

  const totalRecebido = tabelaFiltrada
    .filter(p => p.status === 'pago')
    .reduce((s, p) => s + p.valor, 0)

  const proximos = proventos
    .filter(p => p.data_ex && p.data_ex >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.data_ex ?? '').localeCompare(b.data_ex ?? ''))
    .slice(0, 1)[0]

  return (
    <div style={{ minHeight: '100vh', background: '#050d1a', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <NavBar />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#e8a020' }}>◆ Proventos B3</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            Mapa de <span style={{ color: '#e8a020' }}>Dividendos</span>
          </h1>
          <p style={{ fontSize: '13px', color: '#4a6080', marginTop: '4px' }}>
            Atualizado automaticamente · {dividendosData.atualizado} · {proventos.length} registros
          </p>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,.07)', borderRadius: '10px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#4a6080', marginBottom: '6px' }}>Total registros</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#e8a020' }}>{proventos.length}</div>
            <div style={{ fontSize: '11px', color: '#4a6080', marginTop: '2px' }}>últimos 18 meses</div>
          </div>
          <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,.07)', borderRadius: '10px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#4a6080', marginBottom: '6px' }}>Próximo ex-date</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>{proximos ? proximos.ticker : '—'}</div>
            <div style={{ fontSize: '11px', color: '#4a6080', marginTop: '2px' }}>{proximos ? fmtData(proximos.data_ex) : 'nenhum declarado'}</div>
          </div>
          <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,.07)', borderRadius: '10px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#4a6080', marginBottom: '6px' }}>Empresas pagadoras</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e' }}>
              {new Set(proventos.map(p => p.ticker)).size}
            </div>
            <div style={{ fontSize: '11px', color: '#4a6080', marginTop: '2px' }}>do universo monitorado</div>
          </div>
        </div>

        {/* MAPA MENSAL */}
        <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e8a020', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ◆ {anoAtual}
            </span>
            {mesSelecionado !== null && (
              <button
                onClick={() => setMesSelecionado(null)}
                style={{ fontSize: '11px', color: '#e8a020', background: 'transparent', border: '1px solid rgba(232,160,32,.3)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' }}
              >
                ✕ limpar filtro
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {mesesGrid.map(({ nome, idx, tickersUnicos, itens }) => {
              const passado = idx < mesAtual
              const atual = idx === mesAtual
              const selecionado = mesSelecionado === idx
              const temDados = itens.length > 0
              const visiveis = tickersUnicos.slice(0, 8)
              const extra = tickersUnicos.length - 8

              return (
                <div
                  key={idx}
                  onClick={() => setMesSelecionado(selecionado ? null : idx)}
                  style={{
                    background: selecionado ? 'rgba(232,160,32,.08)' : atual ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.02)',
                    border: selecionado ? '1px solid rgba(232,160,32,.4)' : atual ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(255,255,255,.05)',
                    borderRadius: '8px',
                    padding: '10px 10px 8px',
                    cursor: 'pointer',
                    transition: 'all .15s',
                    minHeight: '90px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: atual ? '#fff' : passado ? '#4a6080' : '#8aa0bf' }}>
                      {MESES_CURTOS[idx]}
                    </span>
                    {temDados && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: passado ? '#4a6080' : '#e8a020', background: passado ? 'rgba(255,255,255,.04)' : 'rgba(232,160,32,.1)', borderRadius: '8px', padding: '1px 5px' }}>
                        {itens.length}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {visiveis.map(t => (
                      <span
                        key={t}
                        style={{
                          fontSize: '9px',
                          fontWeight: 800,
                          letterSpacing: '.04em',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          background: passado ? 'rgba(255,255,255,.06)' : 'rgba(232,160,32,.12)',
                          color: passado ? '#4a6080' : '#e8a020',
                          border: passado ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(232,160,32,.2)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span style={{ fontSize: '9px', color: '#4a6080', padding: '2px 4px' }}>+{extra}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Filtros da tabela */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Buscar ticker..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              background: '#0a1628', border: '1px solid rgba(255,255,255,.1)', borderRadius: '6px',
              padding: '7px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '160px'
            }}
          />
          {['todos', 'DIVIDENDO/JCP', 'RENDIMENTO'].map(t => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', border: 'none',
                background: filtroTipo === t ? '#e8a020' : 'rgba(255,255,255,.05)',
                color: filtroTipo === t ? '#050d1a' : '#6b84a8',
              }}
            >
              {t === 'todos' ? 'Todos' : t}
            </button>
          ))}
          <span style={{ fontSize: '12px', color: '#4a6080', marginLeft: 'auto' }}>
            {tabelaFiltrada.length} registros
            {mesSelecionado !== null && ` · ${MESES[mesSelecionado]}`}
          </span>
        </div>

        {/* Tabela */}
        <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  {([
                    { label: 'Ticker',      key: 'ticker'   },
                    { label: 'Tipo',        key: 'tipo'     },
                    { label: 'Data COM',    key: 'data_com' },
                    { label: 'Data EX',     key: 'data_ex'  },
                    { label: 'Data Pagto',  key: 'data_pag' },
                    { label: 'Valor/Ação',  key: 'valor'    },
                    { label: 'Yield %',     key: 'yield'    },
                    { label: 'Status',      key: 'status'   },
                  ] as { label: string; key: string }[]).map(({ label, key }) => {
                    const ativo = sort.key === key
                    return (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        style={{
                          padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700,
                          letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                          cursor: 'pointer', userSelect: 'none',
                          color: ativo ? '#e8a020' : '#4a6080',
                          transition: 'color .15s',
                        }}
                      >
                        {label}{' '}
                        <span style={{ fontSize: '9px', opacity: ativo ? 1 : 0.3 }}>
                          {ativo ? (sort.dir === 'desc' ? '▼' : '▲') : '▼'}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {tabelaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#4a6080', fontSize: '14px' }}>
                      {proventos.length === 0
                        ? '⏳ Dados ainda não carregados — aguarde a primeira execução automática (diária às 19h BRT)'
                        : 'Nenhum resultado para os filtros selecionados'}
                    </td>
                  </tr>
                ) : (
                  tabelaFiltrada.map((p, i) => {
                    const c = cor(p.tipo)
                    const pago = p.status === 'pago'
                    return (
                      <tr
                        key={`${p.ticker}-${p.data_ex}-${i}`}
                        style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}
                      >
                        <td style={{ padding: '11px 16px', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                          {p.ticker}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
                            {p.tipo}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', color: '#8aa0bf', whiteSpace: 'nowrap' }}>{fmtData(p.data_com)}</td>
                        <td style={{ padding: '11px 16px', color: pago ? '#8aa0bf' : '#fff', fontWeight: pago ? 400 : 700, whiteSpace: 'nowrap' }}>{fmtData(p.data_ex)}</td>
                        <td style={{ padding: '11px 16px', color: '#8aa0bf', whiteSpace: 'nowrap' }}>{fmtData(p.data_pagamento)}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 700, color: pago ? '#8aa0bf' : '#e8a020', whiteSpace: 'nowrap' }}>{fmtValor(p.valor)}</td>
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                          {p.yield_pct != null ? (
                            <span style={{ color: p.yield_pct >= 5 ? '#22c55e' : p.yield_pct >= 2 ? '#e8a020' : '#8aa0bf', fontWeight: 700 }}>
                              {p.yield_pct.toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                            background: pago ? 'rgba(255,255,255,.05)' : 'rgba(34,197,94,.1)',
                            color: pago ? '#4a6080' : '#22c55e',
                            border: pago ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(34,197,94,.25)',
                          }}>
                            {pago ? 'Pago' : 'Declarado'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {tabelaFiltrada.length > 0 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '11px', color: '#4a6080' }}>
                Soma (filtro atual): <strong style={{ color: '#e8a020' }}>R$ {totalRecebido.toFixed(4)}</strong> por ação
              </span>
            </div>
          )}
        </div>

        <p style={{ fontSize: '11px', color: '#2a3a50', marginTop: '16px', textAlign: 'center' }}>
          Fonte: Yahoo Finance · Atualização automática diária às 19h BRT · Data-COM = dia útil anterior à Data EX · Yield calculado sobre cotação no momento da coleta
        </p>
      </main>
    </div>
  )
}
