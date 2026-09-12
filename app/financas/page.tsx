'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Transacao {
  id: number
  data: string
  historico: string
  descricao: string
  valor: number
  tipo_lancamento: 'despesa' | 'receita' | 'pagamento_cartao'
  tipo_extrato: 'conta' | 'cartao'
  categoria: string
  banco: string
  periodo: string
  ignorar: boolean
}

interface TransacaoPreview {
  data: string
  historico: string
  descricao: string
  valor: number
  tipo_lancamento: 'despesa' | 'receita' | 'pagamento_cartao'
  tipo_extrato: 'conta' | 'cartao'
  categoria: string
  banco: string
  periodo: string
}

interface Resumo {
  totais: { entradas: number; saidas_conta: number; fatura_cartao: number; pgto_cartao: number }
  mensal: { periodo: string; entradas: number; saidas_conta: number; fatura_cartao: number; pgto_cartao: number; total_lancamentos: number }[]
  por_categoria: { categoria: string; tipo_lancamento: string; total: number; qtd: number }[]
  periodos: string[]
}

interface BatchItem {
  id: string
  banco: string
  importado_em: string
  total_transacoes: number
  data_inicio: string
  data_fim: string
  revertido: boolean
}

type Aba = 'importar' | 'transacoes' | 'resumo' | 'graficos'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COR_TIPO = {
  receita:          '#66BB6A',
  despesa:          '#ef5350',
  pagamento_cartao: '#e8a020',
}

const LABEL_TIPO: Record<string, string> = {
  receita:          'Receita',
  despesa:          'Despesa',
  pagamento_cartao: 'Pgto Cartão',
}

const BANCOS = ['Bradesco','Itaú','Nubank','Santander','Caixa','BB','Inter','C6','XP','Sicredi','Outro']

// ── Componente principal ──────────────────────────────────────────────────────
export default function FinancasPage() {
  const router   = useRouter()
  const [aba, setAba] = useState<Aba>('importar')
  const [plano, setPlano] = useState<string | null>(null)

  // Importar
  const [arquivo, setArquivo]       = useState<File | null>(null)
  const [banco, setBanco]           = useState('Bradesco')
  const [tipoExtrato, setTipoExtrato] = useState<'conta' | 'cartao'>('conta')
  const [preview, setPreview]       = useState<TransacaoPreview[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [msgUpload, setMsgUpload]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Transações
  const [transacoes, setTransacoes]     = useState<Transacao[]>([])
  const [totalTrans, setTotalTrans]     = useState(0)
  const [pageTrans, setPageTrans]       = useState(1)
  const [filPeriodo, setFilPeriodo]     = useState('')
  const [filCategoria, setFilCategoria] = useState('')
  const [filTipo, setFilTipo]           = useState('')
  const [filBanco, setFilBanco]         = useState('')
  const [filBusca, setFilBusca]         = useState('')
  const [categorias, setCategorias]     = useState<string[]>([])
  const [bancosUsados, setBancosUsados] = useState<string[]>([])
  const [periodosDisp, setPeriodosDisp] = useState<string[]>([])
  const [loadingTrans, setLoadingTrans] = useState(false)
  const [editando, setEditando]         = useState<Record<number, string>>({})

  // Modal lançamento manual
  interface FormLanc { data: string; historico: string; valor: string; tipo_lancamento: 'despesa'|'receita'|'pagamento_cartao'; tipo_extrato: 'conta'|'cartao'; categoria: string; banco: string; descricao: string }
  const FORM_VAZIO: FormLanc = { data: new Date().toISOString().slice(0,10), historico: '', valor: '', tipo_lancamento: 'despesa', tipo_extrato: 'conta', categoria: 'Outros', banco: 'Nubank', descricao: '' }
  const [modalAberto, setModalAberto]   = useState(false)
  const [formLanc, setFormLanc]         = useState<FormLanc>({ ...FORM_VAZIO })
  const [salvandoLanc, setSalvandoLanc] = useState(false)
  const [erroLanc, setErroLanc]         = useState('')

  // Resumo
  const [resumo, setResumo]         = useState<Resumo | null>(null)
  const [periodoResumo, setPeriodoResumo] = useState('')
  const [saldoInicial, setSaldoInicial]   = useState(0)
  const [editSaldo, setEditSaldo]         = useState(false)
  const [novoSaldo, setNovoSaldo]         = useState('')

  // Gráficos
  const [historicoEvo, setHistoricoEvo]   = useState<{ periodo: string; entradas: number; saidas: number }[]>([])
  const [topCats, setTopCats]             = useState<{ categoria: string; total: number }[]>([])
  const [periodoGraf, setPeriodoGraf]     = useState('')
  const [filCatsGraf, setFilCatsGraf]     = useState<string[]>([])
  const [painelCats, setPainelCats]       = useState(false)

  // Batches (histórico de importações)
  const [batches, setBatches]             = useState<BatchItem[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d?.id) { router.push('/login'); return }
      const p = d.plano || 'gratuito'
      if (!['starter','essencial','pro','analista'].includes(p)) {
        router.push('/planos?upgrade=starter')
        return
      }
      setPlano(p)
    })
  }, [router])

  // ── Carrega categorias uma vez ──────────────────────────────────────────────
  useEffect(() => {
    if (!plano) return
    fetch('/api/financas/categorias').then(r => r.json()).then(d => {
      if (d.categorias) setCategorias([...new Set(d.categorias.map((c: { nome: string }) => c.nome))] as string[])
    })
    fetch('/api/financas/config').then(r => r.json()).then(d => {
      setSaldoInicial(d.saldo_inicial || 0)
      setNovoSaldo(String(d.saldo_inicial || 0))
    })
  }, [plano])

  // ── Transações ──────────────────────────────────────────────────────────────
  const carregarTransacoes = useCallback(() => {
    setLoadingTrans(true)
    const p = new URLSearchParams({
      periodo: filPeriodo, categoria: filCategoria, tipo: filTipo,
      banco: filBanco, busca: filBusca, page: String(pageTrans),
    })
    fetch(`/api/financas/transacoes?${p}`).then(r => r.json()).then(d => {
      setTransacoes(d.transacoes || [])
      setTotalTrans(d.total || 0)
      // Bancos únicos a partir das transações carregadas
      if (d.transacoes) {
        const bList = [...new Set(d.transacoes.map((t: Transacao) => t.banco).filter(Boolean))] as string[]
        setBancosUsados(bList)
      }
      setLoadingTrans(false)
    })
  }, [filPeriodo, filCategoria, filTipo, filBanco, filBusca, pageTrans])

  useEffect(() => {
    if (aba === 'transacoes' && plano) carregarTransacoes()
  }, [aba, plano, carregarTransacoes])

  // ── Resumo ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (aba !== 'resumo' || !plano) return
    const p = new URLSearchParams({ periodo: periodoResumo })
    fetch(`/api/financas/resumo?${p}`).then(r => r.json()).then(d => {
      setResumo(d)
      if (d.periodos) setPeriodosDisp(d.periodos)
    })
  }, [aba, plano, periodoResumo])

  // ── Gráficos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (aba !== 'graficos' || !plano) return
    const cats = filCatsGraf.join(',')
    Promise.all([
      fetch(`/api/financas/historico?meses=12&categorias=${encodeURIComponent(cats)}`).then(r => r.json()),
      fetch(`/api/financas/historico?meses=12&periodo=${periodoGraf}`).then(r => r.json()),
    ]).then(([evo, topData]) => {
      setHistoricoEvo(evo.evolucao || [])
      setTopCats(topData.top_categorias || [])
    })
  }, [aba, plano, periodoGraf, filCatsGraf])

  // ── Upload ───────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!arquivo) return
    setUploadando(true)
    setMsgUpload('')
    setPreview([])
    const form = new FormData()
    form.append('file', arquivo)
    form.append('banco', banco)
    form.append('tipo_extrato', tipoExtrato)
    const r = await fetch('/api/financas/upload-extrato', { method: 'POST', body: form })
    const d = await r.json()
    setUploadando(false)
    if (d.erro) { setMsgUpload('Erro: ' + d.erro); return }
    setPreview(d.transacoes || [])
    setMsgUpload(`${d.total} transações detectadas. Revise e confirme abaixo.`)
  }

  async function handleConfirmar() {
    if (!preview.length) return
    setConfirmando(true)
    const r = await fetch('/api/financas/confirmar-extrato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transacoes: preview, banco }),
    })
    const d = await r.json()
    setConfirmando(false)
    if (d.erro) { setMsgUpload('Erro: ' + d.erro); return }
    setMsgUpload(`✓ ${d.salvos} lançamentos salvos. ${d.duplicatas} duplicatas ignoradas.`)
    setPreview([])
    setArquivo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function atualizarPreview(idx: number, campo: keyof TransacaoPreview, valor: string) {
    setPreview(p => p.map((t, i) => i === idx ? { ...t, [campo]: campo === 'valor' ? Number(valor) : valor } : t))
  }

  // ── Atualizar categoria na tabela ────────────────────────────────────────────
  async function salvarCategoria(id: number, categoria: string) {
    await fetch(`/api/financas/transacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria }),
    })
    setTransacoes(ts => ts.map(t => t.id === id ? { ...t, categoria } : t))
    setEditando(e => { const n = { ...e }; delete n[id]; return n })
  }

  async function salvarLancamentoManual() {
    if (!formLanc.data || !formLanc.historico || !formLanc.valor) {
      setErroLanc('Preencha data, histórico e valor.'); return
    }
    setSalvandoLanc(true); setErroLanc('')
    const r = await fetch('/api/financas/transacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formLanc, valor: parseFloat(String(formLanc.valor).replace(',', '.')) }),
    })
    const d = await r.json()
    setSalvandoLanc(false)
    if (d.erro) { setErroLanc(d.erro); return }
    setModalAberto(false)
    setFormLanc({ ...FORM_VAZIO })
    carregarTransacoes()
  }

  async function toggleIgnorar(t: Transacao) {
    await fetch(`/api/financas/transacoes/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignorar: !t.ignorar }),
    })
    setTransacoes(ts => ts.map(x => x.id === t.id ? { ...x, ignorar: !x.ignorar } : x))
  }

  async function excluirTransacao(id: number) {
    if (!confirm('Excluir este lançamento?')) return
    await fetch(`/api/financas/transacoes/${id}`, { method: 'DELETE' })
    setTransacoes(ts => ts.filter(t => t.id !== id))
    setTotalTrans(n => n - 1)
  }

  const carregarBatches = useCallback(() => {
    setLoadingBatches(true)
    fetch('/api/financas/batches')
      .then(r => r.json())
      .then(d => { setBatches(d.batches || []); setLoadingBatches(false) })
      .catch(() => setLoadingBatches(false))
  }, [])

  useEffect(() => {
    if (aba === 'importar' && plano) carregarBatches()
  }, [aba, plano, carregarBatches])

  async function excluirBatch(id: string) {
    if (!confirm('Excluir esta importação e TODOS os seus lançamentos? Esta ação não pode ser desfeita.')) return
    const r = await fetch('/api/financas/batches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: id }),
    })
    const d = await r.json()
    if (d.erro) { alert('Erro: ' + d.erro); return }
    setBatches(bs => bs.filter(b => b.id !== id))
    setMsgUpload(`✓ Importação removida. ${d.removidas || 0} lançamentos excluídos.`)
  }

  async function salvarSaldo() {
    const v = parseFloat(novoSaldo.replace(',', '.')) || 0
    await fetch('/api/financas/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldo_inicial: v }),
    })
    setSaldoInicial(v)
    setEditSaldo(false)
  }

  // ── Estilos base ────────────────────────────────────────────────────────────
  const card = (extra = {}): React.CSSProperties => ({
    background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 10, padding: '16px 20px', ...extra,
  })

  const inputSt: React.CSSProperties = {
    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 6, padding: '7px 12px', color: '#e8edf4', fontSize: 13,
    outline: 'none', width: '100%',
  }

  const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' }

  const btnPrimary: React.CSSProperties = {
    background: '#e8a020', color: '#000', border: 'none', borderRadius: 6,
    padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
  }

  const btnSecondary: React.CSSProperties = {
    background: 'rgba(255,255,255,.07)', color: '#e8edf4', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13,
  }

  if (!plano) return (
    <div style={{ background: '#050d1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b84a8' }}>
      Carregando…
    </div>
  )

  // ── Cálculo dos 7 cards (espelho do app local) ──────────────────────────────
  const entradas      = resumo?.totais?.entradas      || 0
  const saidasConta   = resumo?.totais?.saidas_conta  || 0
  const faturaCartao  = resumo?.totais?.fatura_cartao || 0
  const pgtoCartao    = resumo?.totais?.pgto_cartao   || 0
  const totalDespesas = saidasConta + faturaCartao
  const recXDesp      = entradas - totalDespesas
  const caixaFinal    = saldoInicial + entradas - saidasConta - pgtoCartao

  return (
    <div style={{ background: '#050d1a', minHeight: '100vh', color: '#e8edf4', fontFamily: 'Inter,sans-serif' }}>
      <NavBar />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif', marginBottom: 4 }}>
            💰 Finanças Pessoais
          </h1>
          <p style={{ color: '#6b84a8', fontSize: 13 }}>
            Controle de receitas, despesas e saldo bancário
          </p>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 0 }}>
          {(['importar','transacoes','resumo','graficos'] as Aba[]).map(a => {
            const labels: Record<Aba, string> = { importar: '📥 Importar', transacoes: '📋 Transações', resumo: '📊 Resumo', graficos: '📈 Gráficos' }
            return (
              <button key={a} onClick={() => setAba(a)} style={{
                background: 'transparent', border: 'none', borderBottom: aba === a ? '2px solid #e8a020' : '2px solid transparent',
                color: aba === a ? '#e8a020' : '#6b84a8', fontWeight: aba === a ? 700 : 500,
                padding: '8px 16px', cursor: 'pointer', fontSize: 13, marginBottom: -1,
              }}>
                {labels[a]}
              </button>
            )
          })}
        </div>

        {/* ── ABA IMPORTAR ──────────────────────────────────────────────────── */}
        {aba === 'importar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card()}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#b8c4d4' }}>
                Importar Extrato Bancário
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Banco</label>
                  <select value={banco} onChange={e => setBanco(e.target.value)} style={selectSt}>
                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Tipo</label>
                  <select value={tipoExtrato} onChange={e => setTipoExtrato(e.target.value as 'conta' | 'cartao')} style={selectSt}>
                    <option value="conta">Conta Corrente / Poupança</option>
                    <option value="cartao">Fatura Cartão de Crédito</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <input
                    ref={fileRef}
                    type="file" accept=".csv,.txt,.pdf"
                    onChange={e => setArquivo(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                  <button onClick={() => fileRef.current?.click()} style={btnSecondary}>
                    {arquivo ? `📄 ${arquivo.name.substring(0, 20)}…` : '📁 Selecionar arquivo'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={handleUpload} disabled={!arquivo || uploadando} style={{ ...btnPrimary, opacity: (!arquivo || uploadando) ? 0.5 : 1 }}>
                  {uploadando ? 'Processando…' : 'Analisar arquivo'}
                </button>
                <span style={{ fontSize: 12, color: '#6b84a8' }}>Aceita CSV, TXT ou PDF</span>
              </div>

              {msgUpload && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6, fontSize: 13,
                  background: msgUpload.startsWith('Erro') ? 'rgba(239,83,80,.1)' : 'rgba(102,187,106,.1)',
                  border: `1px solid ${msgUpload.startsWith('Erro') ? 'rgba(239,83,80,.3)' : 'rgba(102,187,106,.3)'}`,
                  color: msgUpload.startsWith('Erro') ? '#ef5350' : '#66BB6A',
                }}>
                  {msgUpload}
                </div>
              )}
            </div>

            {/* Histórico de importações */}
            <div style={card()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#b8c4d4' }}>
                  Histórico de Importações
                </h3>
                <button onClick={carregarBatches} style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}>
                  {loadingBatches ? 'Carregando…' : '↺ Atualizar'}
                </button>
              </div>
              {batches.length === 0 ? (
                <p style={{ color: '#4a5d73', fontSize: 13 }}>
                  {loadingBatches ? 'Carregando…' : 'Nenhuma importação encontrada.'}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                        {['Banco','Data de importação','Período','Lançamentos',''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b84a8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map(b => (
                        <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: b.revertido ? 0.45 : 1 }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>{b.banco || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#8fa0b4', whiteSpace: 'nowrap' }}>
                            {new Date(b.importado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#8fa0b4', whiteSpace: 'nowrap' }}>
                            {b.data_inicio && b.data_fim ? `${b.data_inicio} → ${b.data_fim}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontWeight: 700, color: '#e8a020' }}>{b.total_transacoes}</span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {b.revertido ? (
                              <span style={{ fontSize: 11, color: '#4a5d73' }}>Removida</span>
                            ) : (
                              <button
                                onClick={() => excluirBatch(b.id)}
                                style={{ background: 'rgba(239,83,80,.15)', color: '#ef5350', border: '1px solid rgba(239,83,80,.3)', borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                              >
                                🗑 Excluir
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div style={card()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#b8c4d4' }}>
                    Prévia — {preview.length} lançamentos
                  </h3>
                  <button onClick={handleConfirmar} disabled={confirmando} style={{ ...btnPrimary, opacity: confirmando ? 0.6 : 1 }}>
                    {confirmando ? 'Salvando…' : '✓ Confirmar importação'}
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                        {['Data','Histórico','Categoria','Tipo','Valor'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b84a8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: '7px 10px', color: '#8fa0b4', whiteSpace: 'nowrap' }}>{t.data}</td>
                          <td style={{ padding: '7px 10px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.historico}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <select
                              value={t.categoria}
                              onChange={e => atualizarPreview(i, 'categoria', e.target.value)}
                              style={{ ...selectSt, width: 'auto', padding: '4px 8px', fontSize: 12 }}
                            >
                              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: COR_TIPO[t.tipo_lancamento], background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 4 }}>
                              {LABEL_TIPO[t.tipo_lancamento]}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: t.valor >= 0 ? '#66BB6A' : '#ef5350', whiteSpace: 'nowrap' }}>
                            {fmt(Math.abs(t.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA TRANSAÇÕES ────────────────────────────────────────────────── */}
        {aba === 'transacoes' && (
          <div>
            {/* Filtros */}
            <div style={{ ...card(), marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Período</label>
                <select value={filPeriodo} onChange={e => { setFilPeriodo(e.target.value); setPageTrans(1) }} style={selectSt}>
                  <option value="">Todos</option>
                  {periodosDisp.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Categoria</label>
                <select value={filCategoria} onChange={e => { setFilCategoria(e.target.value); setPageTrans(1) }} style={selectSt}>
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Tipo</label>
                <select value={filTipo} onChange={e => { setFilTipo(e.target.value); setPageTrans(1) }} style={selectSt}>
                  <option value="">Todos</option>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                  <option value="pagamento_cartao">Pgto Cartão</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Banco</label>
                <select value={filBanco} onChange={e => { setFilBanco(e.target.value); setPageTrans(1) }} style={selectSt}>
                  <option value="">Todos</option>
                  {bancosUsados.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Buscar</label>
                <input
                  value={filBusca}
                  onChange={e => { setFilBusca(e.target.value); setPageTrans(1) }}
                  placeholder="Palavras-chave no histórico…"
                  style={inputSt}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <button onClick={carregarTransacoes} style={btnPrimary}>Buscar</button>
                <button
                  onClick={() => { setFormLanc({ ...FORM_VAZIO }); setErroLanc(''); setModalAberto(true) }}
                  style={{ ...btnSecondary, color: '#66BB6A', borderColor: 'rgba(102,187,106,.3)', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  ＋ Novo lançamento
                </button>
              </div>
            </div>

            {/* Tabela */}
            <div style={card({ padding: 0 })}>
              {loadingTrans ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b84a8' }}>Carregando…</div>
              ) : transacoes.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b84a8' }}>
                  Nenhum lançamento encontrado.<br />
                  <button onClick={() => setAba('importar')} style={{ ...btnPrimary, marginTop: 12, fontSize: 12 }}>
                    Importar extrato
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                        {['Data','Histórico','Banco','Categoria','Tipo','Valor','Ações'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Valor' || h === 'Ações' ? 'right' : 'left', color: '#6b84a8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transacoes.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: t.ignorar ? 0.4 : 1 }}>
                          <td style={{ padding: '8px 12px', color: '#8fa0b4', whiteSpace: 'nowrap' }}>{t.data}</td>
                          <td style={{ padding: '8px 12px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.historico}>{t.historico}</td>
                          <td style={{ padding: '8px 12px', color: '#8fa0b4', whiteSpace: 'nowrap' }}>{t.banco}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {editando[t.id] !== undefined ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <select
                                  value={editando[t.id]}
                                  onChange={e => setEditando(prev => ({ ...prev, [t.id]: e.target.value }))}
                                  style={{ ...selectSt, width: 'auto', fontSize: 12, padding: '3px 6px' }}
                                >
                                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button onClick={() => salvarCategoria(t.id, editando[t.id])} style={{ ...btnPrimary, padding: '3px 8px', fontSize: 11 }}>✓</button>
                                <button onClick={() => setEditando(e => { const n = {...e}; delete n[t.id]; return n })} style={{ ...btnSecondary, padding: '3px 8px', fontSize: 11 }}>✕</button>
                              </div>
                            ) : (
                              <span
                                onClick={() => setEditando(e => ({ ...e, [t.id]: t.categoria }))}
                                style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', whiteSpace: 'nowrap' }}
                              >
                                {t.categoria || 'Outros'} ✎
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: COR_TIPO[t.tipo_lancamento], whiteSpace: 'nowrap' }}>
                              {LABEL_TIPO[t.tipo_lancamento]}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: t.valor >= 0 ? '#66BB6A' : '#ef5350', whiteSpace: 'nowrap' }}>
                            {fmt(Math.abs(t.valor))}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => toggleIgnorar(t)}
                              title={t.ignorar ? 'Incluir no saldo' : 'Ignorar no saldo'}
                              style={{
                                background: t.ignorar ? 'rgba(232,160,32,.15)' : 'rgba(255,255,255,.05)',
                                border: t.ignorar ? '1px solid rgba(232,160,32,.4)' : '1px solid rgba(255,255,255,.1)',
                                borderRadius: 5, color: t.ignorar ? '#e8a020' : '#6b84a8',
                                cursor: 'pointer', fontSize: 11, padding: '3px 8px', marginRight: 4, fontWeight: t.ignorar ? 700 : 400,
                              }}
                            >
                              {t.ignorar ? '👁 Ignorado' : '👁 Ignorar'}
                            </button>
                            <button onClick={() => excluirTransacao(t.id)} title="Excluir" style={{ background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Paginação */}
            {totalTrans > 50 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button disabled={pageTrans <= 1} onClick={() => setPageTrans(p => p - 1)} style={{ ...btnSecondary, opacity: pageTrans <= 1 ? 0.4 : 1 }}>← Anterior</button>
                <span style={{ color: '#6b84a8', fontSize: 13 }}>
                  Página {pageTrans} de {Math.ceil(totalTrans / 50)} · {totalTrans} lançamentos
                </span>
                <button disabled={pageTrans >= Math.ceil(totalTrans / 50)} onClick={() => setPageTrans(p => p + 1)} style={{ ...btnSecondary, opacity: pageTrans >= Math.ceil(totalTrans / 50) ? 0.4 : 1 }}>Próxima →</button>
              </div>
            )}
          </div>
        )}

        {/* ── ABA RESUMO ────────────────────────────────────────────────────── */}
        {aba === 'resumo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Saldo inicial + filtro período */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Período</label>
                <select value={periodoResumo} onChange={e => setPeriodoResumo(e.target.value)} style={{ ...selectSt, width: 140 }}>
                  <option value="">Todos</option>
                  {(resumo?.periodos || periodosDisp).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {editSaldo ? (
                  <>
                    <div>
                      <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Saldo Inicial (R$)</label>
                      <input
                        value={novoSaldo}
                        onChange={e => setNovoSaldo(e.target.value)}
                        style={{ ...inputSt, width: 140 }}
                        type="number" step="0.01"
                        placeholder="0,00"
                      />
                    </div>
                    <button onClick={salvarSaldo} style={btnPrimary}>Salvar</button>
                    <button onClick={() => setEditSaldo(false)} style={btnSecondary}>✕</button>
                  </>
                ) : (
                  <div>
                    <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Saldo Inicial</label>
                    <button onClick={() => setEditSaldo(true)} style={{ ...btnSecondary, fontSize: 13, fontWeight: 700, color: '#4dd0e1' }}>
                      {fmt(saldoInicial)} ✎
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Cards de resumo — 7 cards espelhando o app local */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {([
                { label: 'Entradas Conta',   valor: entradas,      cor: '#66BB6A', bg: 'rgba(102,187,106,.08)',  brd: 'rgba(102,187,106,.25)' },
                { label: 'Saídas Conta',     valor: saidasConta,   cor: '#ef5350', bg: 'rgba(239,83,80,.08)',    brd: 'rgba(239,83,80,.25)' },
                { label: 'Fatura Cartão',    valor: faturaCartao,  cor: '#ce93d8', bg: 'rgba(206,147,216,.08)',  brd: 'rgba(206,147,216,.25)' },
                { label: 'Pgto. Cartão',     valor: pgtoCartao,    cor: '#64b5f6', bg: 'rgba(100,181,246,.08)',  brd: 'rgba(100,181,246,.25)' },
                { label: 'Total Despesas',   valor: totalDespesas, cor: '#ffa726', bg: 'rgba(255,167,38,.08)',   brd: 'rgba(255,167,38,.25)' },
                { label: 'Receita × Despesa', valor: recXDesp,    cor: recXDesp  >= 0 ? '#66BB6A' : '#ef5350', bg: 'rgba(255,255,255,.04)', brd: 'rgba(255,255,255,.1)' },
                { label: 'Caixa Final',      valor: caixaFinal,   cor: caixaFinal >= 0 ? '#4dd0e1' : '#ef5350', bg: 'rgba(77,208,225,.06)', brd: 'rgba(77,208,225,.4)', destaque: true },
              ] as { label: string; valor: number; cor: string; bg: string; brd: string; destaque?: boolean }[]).map(item => (
                <div key={item.label} style={{
                  background: item.bg,
                  border: `1px solid ${item.brd}`,
                  borderRadius: 10, padding: '14px 16px',
                  boxShadow: item.destaque ? `0 0 16px ${item.brd}` : undefined,
                }}>
                  <div style={{ fontSize: 10, color: '#6b84a8', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.6 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk,sans-serif', color: item.cor }}>
                    {item.valor < 0 ? '-' : ''}{fmt(Math.abs(item.valor))}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela mensal */}
            {resumo?.mensal && resumo.mensal.length > 0 && (
              <div style={card({ padding: 0 })}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 13, fontWeight: 700, color: '#b8c4d4' }}>
                  Evolução Mensal
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                        {['Período','Entradas','Saídas Conta','Fatura Cartão','Pgto Cartão','Rec×Desp','Caixa Final','Lançtos'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Período' || h === 'Lançtos' ? 'left' : 'right', color: '#6b84a8', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.mensal.map(m => {
                        const totDesp = (m.saidas_conta || 0) + (m.fatura_cartao || 0)
                        const rxd     = m.entradas - totDesp
                        const caixa   = saldoInicial + m.entradas - (m.saidas_conta || 0) - m.pgto_cartao
                        return (
                          <tr key={m.periodo} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.periodo}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#66BB6A' }}>{fmt(m.entradas)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef5350' }}>{fmt(m.saidas_conta || 0)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ce93d8' }}>{fmt(m.fatura_cartao || 0)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64b5f6' }}>{fmt(m.pgto_cartao)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: rxd >= 0 ? '#66BB6A' : '#ef5350' }}>{rxd < 0 ? '-' : ''}{fmt(Math.abs(rxd))}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: caixa >= 0 ? '#4dd0e1' : '#ef5350' }}>{caixa < 0 ? '-' : ''}{fmt(Math.abs(caixa))}</td>
                            <td style={{ padding: '8px 12px', color: '#6b84a8' }}>{m.total_lancamentos}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Por categoria */}
            {resumo?.por_categoria && resumo.por_categoria.length > 0 && (
              <div style={card({ padding: 0 })}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: 13, fontWeight: 700, color: '#b8c4d4' }}>
                  Por Categoria
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                        {['Categoria','Tipo','Lançamentos','Total'].map(h => (
                          <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Total' ? 'right' : 'left', color: '#6b84a8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.por_categoria.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: '7px 14px' }}>{c.categoria || 'Outros'}</td>
                          <td style={{ padding: '7px 14px' }}>
                            <span style={{ color: COR_TIPO[c.tipo_lancamento as keyof typeof COR_TIPO] || '#b8c4d4', fontSize: 11, fontWeight: 700 }}>
                              {LABEL_TIPO[c.tipo_lancamento] || c.tipo_lancamento}
                            </span>
                          </td>
                          <td style={{ padding: '7px 14px', color: '#6b84a8' }}>{c.qtd}</td>
                          <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, color: c.tipo_lancamento === 'receita' ? '#66BB6A' : '#ef5350' }}>
                            {fmt(c.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA GRÁFICOS ──────────────────────────────────────────────────── */}
        {aba === 'graficos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Período</label>
                <select value={periodoGraf} onChange={e => setPeriodoGraf(e.target.value)} style={{ ...selectSt, width: 140 }}>
                  <option value="">Todos</option>
                  {periodosDisp.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Multi-select categorias */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Categorias</label>
                <button
                  onClick={() => setPainelCats(v => !v)}
                  style={{ ...btnSecondary, minWidth: 200, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>
                    {filCatsGraf.length === 0
                      ? 'Todas as categorias'
                      : `${filCatsGraf.length} selecionada${filCatsGraf.length > 1 ? 's' : ''}`}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 10 }}>{painelCats ? '▲' : '▼'}</span>
                </button>
                {painelCats && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                    background: '#0f1923', border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 8, padding: '8px 0', minWidth: 240,
                    boxShadow: '0 8px 24px rgba(0,0,0,.5)', maxHeight: 300, overflowY: 'auto',
                  }}>
                    <div
                      onClick={() => setFilCatsGraf([])}
                      style={{ padding: '7px 14px', fontSize: 12, color: filCatsGraf.length === 0 ? '#e8a020' : '#6b84a8', cursor: 'pointer', fontWeight: filCatsGraf.length === 0 ? 700 : 400 }}
                    >
                      ✓ Todas as categorias
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', margin: '4px 0' }} />
                    {topCats.map(c => {
                      const sel = filCatsGraf.includes(c.categoria)
                      return (
                        <div
                          key={c.categoria}
                          onClick={() => setFilCatsGraf(prev =>
                            sel ? prev.filter(x => x !== c.categoria) : [...prev, c.categoria]
                          )}
                          style={{ padding: '7px 14px', fontSize: 12, color: sel ? '#e8edf4' : '#6b84a8', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}
                        >
                          <span style={{
                            width: 14, height: 14, border: `1px solid ${sel ? '#e8a020' : 'rgba(255,255,255,.2)'}`,
                            borderRadius: 3, background: sel ? '#e8a020' : 'transparent',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#000',
                          }}>{sel ? '✓' : ''}</span>
                          {c.categoria}
                        </div>
                      )
                    })}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', margin: '4px 0' }} />
                    <div style={{ padding: '8px 14px' }}>
                      <button
                        onClick={() => setPainelCats(false)}
                        style={{ ...btnPrimary, width: '100%', fontSize: 12, padding: '6px' }}
                      >
                        ✓ Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {filCatsGraf.length > 0 && (
                <button onClick={() => setFilCatsGraf([])} style={{ ...btnSecondary, fontSize: 12, color: '#e8a020', alignSelf: 'flex-end' }}>
                  ✕ Limpar filtro
                </button>
              )}
            </div>

            {/* Evolução mensal */}
            <div style={card()}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#b8c4d4' }}>Evolução Mensal</h3>
              {historicoEvo.length === 0 ? (
                <div style={{ color: '#6b84a8', fontSize: 13 }}>Sem dados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  {(() => {
                    const temEntradas = historicoEvo.some(m => m.entradas > 0)
                    const maxVal = Math.max(...historicoEvo.map(x => Math.max(x.entradas, x.saidas)), 1)
                    const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', minWidth: historicoEvo.length * 72, height: 200, paddingBottom: 0, position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.1)' }} />
                          {historicoEvo.map(m => {
                            const hE = Math.round((m.entradas / maxVal) * 130)
                            const hS = Math.round((m.saidas / maxVal) * 130)
                            return (
                              <div key={m.periodo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 60 }}>
                                {/* Valores acima das barras */}
                                <div style={{ display: 'flex', gap: 2, fontSize: 8, marginBottom: 2, width: '100%', justifyContent: 'center' }}>
                                  {temEntradas && m.entradas > 0 && (
                                    <span style={{ color: '#66BB6A', fontWeight: 700 }}>{fmtK(m.entradas)}</span>
                                  )}
                                  {m.saidas > 0 && (
                                    <span style={{ color: '#ef5350', fontWeight: 700 }}>{fmtK(m.saidas)}</span>
                                  )}
                                </div>
                                {/* Barras */}
                                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 130 }}>
                                  {temEntradas && (
                                    <div
                                      title={`Entradas: ${fmt(m.entradas)}`}
                                      style={{ width: 14, height: Math.max(hE, m.entradas > 0 ? 2 : 0), background: 'rgba(102,187,106,.75)', borderRadius: '2px 2px 0 0', cursor: 'default', transition: 'height .3s' }}
                                    />
                                  )}
                                  <div
                                    title={`Saídas: ${fmt(m.saidas)}`}
                                    style={{ width: 14, height: Math.max(hS, m.saidas > 0 ? 2 : 0), background: 'rgba(239,83,80,.75)', borderRadius: '2px 2px 0 0', cursor: 'default', transition: 'height .3s' }}
                                  />
                                </div>
                                {/* Rótulo do mês */}
                                <div style={{ fontSize: 9, color: '#6b84a8', marginTop: 4, textAlign: 'center' }}>{m.periodo.substring(5)}</div>
                                {/* Total saída pequeno */}
                                <div style={{ fontSize: 8, color: '#4a5d73', textAlign: 'center', marginTop: 1 }}>
                                  {m.saidas > 0 ? fmt(m.saidas).replace('R$ ','R$') : ''}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                          {temEntradas && <span style={{ color: '#66BB6A' }}>■ Entradas</span>}
                          <span style={{ color: '#ef5350' }}>■ Saídas</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Top categorias (despesa) — com filtro */}
            <div style={card()} onClick={() => setPainelCats(false)}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#b8c4d4' }}>Top Categorias de Despesa</h3>
              {topCats.length === 0 ? (
                <div style={{ color: '#6b84a8', fontSize: 13 }}>Sem dados.</div>
              ) : (() => {
                const lista = filCatsGraf.length > 0
                  ? topCats.filter(c => filCatsGraf.includes(c.categoria))
                  : topCats
                const max = lista[0]?.total || 1
                return lista.length === 0 ? (
                  <div style={{ color: '#6b84a8', fontSize: 13 }}>Nenhuma categoria selecionada corresponde aos dados.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lista.map(c => {
                      const pct = Math.round((c.total / max) * 100)
                      return (
                        <div key={c.categoria} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ width: 160, fontSize: 12, color: '#b8c4d4', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.categoria}
                          </div>
                          <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: pct + '%', background: 'rgba(239,83,80,.6)', borderRadius: 4, transition: 'width .3s' }} />
                          </div>
                          <div style={{ width: 100, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#ef5350', flexShrink: 0 }}>
                            {fmt(c.total)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: lançamento manual ────────────────────────────────────────── */}
      {modalAberto && (
        <div
          onClick={() => setModalAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0f1923', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif' }}>＋ Novo Lançamento Manual</h3>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', color: '#6b84a8', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Data */}
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Data *</label>
                <input type="date" value={formLanc.data} onChange={e => setFormLanc(f => ({ ...f, data: e.target.value }))} style={{ ...inputSt, colorScheme: 'dark' }} />
              </div>
              {/* Valor */}
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Valor (R$) *</label>
                <input type="number" step="0.01" min="0" placeholder="0,00" value={formLanc.valor} onChange={e => setFormLanc(f => ({ ...f, valor: e.target.value }))} style={inputSt} />
              </div>
              {/* Histórico — full width */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Histórico / Descrição *</label>
                <input placeholder="Ex: Aluguel agosto, Salário, Supermercado…" value={formLanc.historico} onChange={e => setFormLanc(f => ({ ...f, historico: e.target.value }))} style={inputSt} />
              </div>
              {/* Tipo lançamento */}
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Tipo de Lançamento</label>
                <select value={formLanc.tipo_lancamento} onChange={e => setFormLanc(f => ({ ...f, tipo_lancamento: e.target.value as 'despesa'|'receita'|'pagamento_cartao' }))} style={selectSt}>
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                  <option value="pagamento_cartao">Pagamento de Fatura</option>
                </select>
              </div>
              {/* Tipo extrato */}
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Tipo de Extrato</label>
                <select value={formLanc.tipo_extrato} onChange={e => setFormLanc(f => ({ ...f, tipo_extrato: e.target.value as 'conta'|'cartao' }))} style={selectSt}>
                  <option value="conta">Conta Corrente / Poupança</option>
                  <option value="cartao">Cartão de Crédito</option>
                </select>
              </div>
              {/* Categoria */}
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Categoria</label>
                <select value={formLanc.categoria} onChange={e => setFormLanc(f => ({ ...f, categoria: e.target.value }))} style={selectSt}>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Banco */}
              <div>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Banco</label>
                <select value={formLanc.banco} onChange={e => setFormLanc(f => ({ ...f, banco: e.target.value }))} style={selectSt}>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {/* Obs (opcional) */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 4 }}>Observação (opcional)</label>
                <input placeholder="Nota adicional…" value={formLanc.descricao} onChange={e => setFormLanc(f => ({ ...f, descricao: e.target.value }))} style={inputSt} />
              </div>
            </div>

            {erroLanc && (
              <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(239,83,80,.1)', border: '1px solid rgba(239,83,80,.3)', borderRadius: 6, color: '#ef5350', fontSize: 13 }}>
                {erroLanc}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModalAberto(false)} style={btnSecondary}>Cancelar</button>
              <button onClick={salvarLancamentoManual} disabled={salvandoLanc} style={{ ...btnPrimary, opacity: salvandoLanc ? 0.6 : 1 }}>
                {salvandoLanc ? 'Salvando…' : '✓ Salvar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Garante legibilidade dos options em qualquer OS/browser */}
      <style jsx global>{`
        .financas-select option {
          background: #0f1923;
          color: #e8edf4;
        }
        select option {
          background: #0f1923;
          color: #e8edf4;
        }
      `}</style>
    </div>
  )
}
