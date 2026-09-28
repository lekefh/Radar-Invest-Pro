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
  ignorar?: boolean
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

type Aba = 'importar' | 'transacoes' | 'resumo' | 'graficos' | 'grupos' | 'orcamento'

interface LinhaOrcamento {
  categoria: string
  grupo: string
  meta: number
  real: number
  diff: number
  pct: number | null
}

const GRUPOS_LABELS: Record<string, string> = {
  necessidades: 'Necessidades',
  conforto: 'Conforto',
  investimentos: 'Investimentos',
  imprevistos: 'Imprevistos',
  outros: 'Sem grupo',
}

const GRUPOS_CORES: Record<string, string> = {
  necessidades: '#e8a020',
  conforto:     '#1565C0',
  investimentos:'#22c55e',
  imprevistos:  '#9c27b0',
  outros:       '#546E7A',
}

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

// ── Paywall ────────────────────────────────────────────────────────────────────
function PaywallFinancas() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ background: '#0d1a2e', border: '1px solid rgba(232,160,32,.25)', borderRadius: '20px', padding: '52px 48px', maxWidth: '520px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#e8a020', marginBottom: '12px' }}>Recurso Exclusivo</div>
        <h2 style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: '26px', fontWeight: 700, color: '#e8edf5', marginBottom: '16px', lineHeight: 1.3 }}>
          Finanças Pessoais disponível<br />no plano <span style={{ color: '#e8a020' }}>Starter ou superior</span>
        </h2>
        <p style={{ fontSize: '15px', color: '#6b84a8', lineHeight: 1.7, marginBottom: '32px' }}>
          Importe extratos bancários, categorize seus gastos e veja resumos mensais com o controle financeiro completo disponível a partir do plano <strong style={{ color: '#e8edf5' }}>Starter</strong>.
        </p>
        <div style={{ background: 'rgba(232,160,32,.06)', border: '1px solid rgba(232,160,32,.15)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
          <div style={{ fontSize: '12px', color: '#6b84a8', marginBottom: '12px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>O que você terá acesso</div>
          {[
            '📥 Importação de extratos bancários (OFX/CSV)',
            '🏷️ Categorização inteligente de gastos',
            '📊 Resumo mensal e gráficos de evolução',
            '🔍 Filtros por banco, categoria e período',
            '📤 Exportação de lançamentos para Excel',
          ].map(item => (
            <div key={item} style={{ fontSize: '13.5px', color: '#a0b4cc', padding: '6px 0', textAlign: 'left' }}>{item}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a href="/planos"
             style={{ background: '#e8a020', color: '#000', fontWeight: 700, fontSize: '15px', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', display: 'block' }}>
            Ver planos e fazer upgrade
          </a>
          <a href="/dashboard"
             style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: '#a0b4cc', fontSize: '14px', padding: '12px 32px', borderRadius: '8px', textDecoration: 'none', display: 'block' }}>
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

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
  const [exportando, setExportando]    = useState(false)
  const [filPeriodo, setFilPeriodo]     = useState('')
  const [filCategoria, setFilCategoria] = useState('')
  const [filTipo, setFilTipo]           = useState('')
  const [filExtrato, setFilExtrato]     = useState('')
  const [filBanco, setFilBanco]         = useState('')
  const [filBusca, setFilBusca]         = useState('')
  const [filValor, setFilValor]         = useState('')
  const [categorias, setCategorias]     = useState<string[]>([])
  const [categoriasObj, setCategoriasObj] = useState<{nome: string; grupo: string}[]>([])
  const [gruposConfig, setGruposConfig] = useState({ necessidades: 50, conforto: 25, investimentos: 20, imprevistos: 5 })
  const [gruposEdit, setGruposEdit]     = useState({ necessidades: 50, conforto: 25, investimentos: 20, imprevistos: 5 })
  const [gruposDados, setGruposDados]   = useState<{grupo: string; total: number; pct_real: number}[]>([])
  const [periodoGrupos, setPeriodoGrupos] = useState('')
  const [salvandoGrupos, setSalvandoGrupos] = useState(false)

  // Orçamento
  const [orcamento, setOrcamento]           = useState<LinhaOrcamento[]>([])
  const [orcTotalMeta, setOrcTotalMeta]     = useState(0)
  const [orcTotalReal, setOrcTotalReal]     = useState(0)
  const [periodoOrc, setPeriodoOrc]         = useState(() => new Date().toISOString().slice(0, 7))
  const [showOrcPicker, setShowOrcPicker]   = useState(false)
  const [pickerAno, setPickerAno]           = useState(() => new Date().getFullYear())
  const [editMeta, setEditMeta]             = useState<Record<string, string>>({})
  const [salvandoMeta, setSalvandoMeta]     = useState<Record<string, boolean>>({})
  const [showConfirmReplica, setShowConfirmReplica] = useState(false)
  const [replicando, setReplicando]         = useState(false)
  const [erroReplica, setErroReplica]       = useState('')
  const [bancosUsados, setBancosUsados] = useState<string[]>([])
  const [periodosDisp, setPeriodosDisp] = useState<string[]>([])
  const [loadingTrans, setLoadingTrans] = useState(false)
  const [editando, setEditando]         = useState<Record<number, { cat: string; tipo: string; novaCat: boolean }>>({})
  const [editData, setEditData]         = useState<Record<number, string>>({})
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [sortCol, setSortCol]           = useState<'data'|'valor'|'tipo'|'categoria'|'banco'|'historico'|''>('')
  const [sortDir, setSortDir]           = useState<'asc'|'desc'>('desc')
  const [modalLote, setModalLote]       = useState(false)
  const [catLote, setCatLote]           = useState('')
  const [aplicandoLote, setAplicandoLote] = useState(false)

  // Modal lançamento manual
  interface FormLanc { data: string; historico: string; valor: string; tipo_lancamento: 'despesa'|'receita'|'pagamento_cartao'; tipo_extrato: 'conta'|'cartao'; categoria: string; banco: string; descricao: string }
  const FORM_VAZIO: FormLanc = { data: new Date().toISOString().slice(0,10), historico: '', valor: '', tipo_lancamento: 'despesa', tipo_extrato: 'conta', categoria: 'Outros', banco: 'Nubank', descricao: '' }
  const [modalAberto, setModalAberto]   = useState(false)
  const [modalCat, setModalCat]         = useState(false)
  const [novaCategoriaNome, setNovaCategoriaNome] = useState('')
  const [renomeando, setRenomeando]     = useState<Record<string, string>>({}) // old → new
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
  const [historicoExpandido, setHistoricoExpandido] = useState(false)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d?.id) { router.push('/login'); return }
      setPlano(d.plano || 'gratuito')
    })
  }, [router])

  // ── Carrega categorias (na montagem e toda vez que entra em grupos/orcamento) ─
  const carregarCategorias = useCallback(() => {
    if (!plano) return
    fetch('/api/financas/categorias').then(r => r.json()).then(d => {
      if (d.categorias) {
        setCategorias([...new Set(d.categorias.map((c: { nome: string }) => c.nome))] as string[])
        setCategoriasObj(d.categorias.map((c: {nome: string; grupo: string}) => ({ nome: c.nome, grupo: c.grupo || 'outros' })))
      }
    })
  }, [plano])

  useEffect(() => {
    carregarCategorias()
    fetch('/api/financas/config').then(r => r.json()).then(d => {
      setSaldoInicial(d.saldo_inicial || 0)
      setNovoSaldo(String(d.saldo_inicial || 0))
      if (d.grupos_config) {
        setGruposConfig(d.grupos_config)
        setGruposEdit(d.grupos_config)
      }
    })
    // Períodos disponíveis — carrega uma vez para todos os filtros/abas
    fetch('/api/financas/resumo').then(r => r.json()).then(d => {
      if (d.periodos) setPeriodosDisp(d.periodos)
    })
  }, [plano]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recarrega categorias ao entrar nas abas que dependem delas
  useEffect(() => {
    if (aba === 'grupos' || aba === 'orcamento') carregarCategorias()
  }, [aba, carregarCategorias])

  // ── Transações ──────────────────────────────────────────────────────────────
  const carregarTransacoes = useCallback(() => {
    setLoadingTrans(true)
    const p = new URLSearchParams({
      periodo: filPeriodo, categoria: filCategoria, tipo: filTipo,
      extrato: filExtrato, banco: filBanco, busca: filBusca, valor: filValor,
      page: String(pageTrans),
      sort_col: sortCol || 'data',
      sort_dir: sortDir,
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
  }, [filPeriodo, filCategoria, filTipo, filExtrato, filBanco, filBusca, filValor, pageTrans, sortCol, sortDir])

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

  // ── Orçamento ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (aba !== 'orcamento' || !plano) return
    fetch(`/api/financas/orcamento?periodo=${periodoOrc}`).then(r => r.json()).then(d => {
      if (d.linhas) setOrcamento(d.linhas)
      setOrcTotalMeta(d.totalMeta || 0)
      setOrcTotalReal(d.totalReal || 0)
    })
  }, [aba, plano, periodoOrc])

  async function salvarMeta(cat: string) {
    const val = parseFloat(String(editMeta[cat] || '0').replace(',', '.')) || 0
    setSalvandoMeta(p => ({ ...p, [cat]: true }))
    await fetch('/api/financas/orcamento', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: cat, valor_meta: val }),
    })
    setOrcamento(prev => prev.map(l => l.categoria === cat
      ? { ...l, meta: val, diff: val - l.real, pct: val > 0 ? Math.round((l.real / val) * 1000) / 10 : null }
      : l
    ))
    setOrcTotalMeta(prev => {
      const old = orcamento.find(l => l.categoria === cat)?.meta ?? 0
      return prev - old + val
    })
    setEditMeta(p => { const n = { ...p }; delete n[cat]; return n })
    setSalvandoMeta(p => ({ ...p, [cat]: false }))
  }

  async function replicarMesAnterior() {
    const [ano, mes] = periodoOrc.split('-').map(Number)
    const periodoRef = mes === 1
      ? `${ano - 1}-12`
      : `${ano}-${String(mes - 1).padStart(2, '0')}`
    setReplicando(true)
    setErroReplica('')
    try {
      const r = await fetch('/api/financas/orcamento', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo_ref: periodoRef }),
      })
      const d = await r.json()
      if (d.erro) { setErroReplica(d.erro); return }
      // Recarrega o orçamento do mês atual com as novas metas
      const r2 = await fetch(`/api/financas/orcamento?periodo=${periodoOrc}`)
      const d2 = await r2.json()
      if (d2.linhas) setOrcamento(d2.linhas)
      setOrcTotalMeta(d2.totalMeta || 0)
      setOrcTotalReal(d2.totalReal || 0)
      setShowConfirmReplica(false)
      setErroReplica('')
    } finally {
      setReplicando(false)
    }
  }

  // ── Grupos ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (aba !== 'grupos' || !plano) return
    const p = new URLSearchParams({ periodo: periodoGrupos })
    fetch(`/api/financas/grupos?${p}`).then(r => r.json()).then(d => {
      if (d.grupos) setGruposDados(d.grupos)
    })
    // Carrega períodos disponíveis se ainda não tiver
    if (periodosDisp.length === 0) {
      fetch('/api/financas/resumo').then(r => r.json()).then(d => {
        if (d.periodos) setPeriodosDisp(d.periodos)
      })
    }
  }, [aba, plano, periodoGrupos])

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

  // ── Atualizar categoria / tipo ────────────────────────────────────────────────
  async function salvarEdicao(id: number) {
    const ed = editando[id]
    if (!ed) return
    const cat = ed.cat.trim() || 'Outros'
    await fetch(`/api/financas/transacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: cat, tipo_lancamento: ed.tipo }),
    })
    setTransacoes(ts => ts.map(t =>
      t.id === id ? { ...t, categoria: cat, tipo_lancamento: ed.tipo as Transacao['tipo_lancamento'] } : t
    ))
    if (cat && !categorias.includes(cat)) setCategorias(cs => [...cs, cat].sort())
    setEditando(e => { const n = { ...e }; delete n[id]; return n })
  }

  // ── Edição em lote de categoria ───────────────────────────────────────────────
  async function aplicarLote() {
    const cat = catLote.trim()
    if (!cat || selecionados.size === 0) return
    setAplicandoLote(true)
    const ids = [...selecionados]
    await Promise.all(ids.map(id =>
      fetch(`/api/financas/transacoes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: cat }),
      })
    ))
    setTransacoes(ts => ts.map(t => selecionados.has(t.id) ? { ...t, categoria: cat } : t))
    if (!categorias.includes(cat)) setCategorias(cs => [...cs, cat].sort())
    setSelecionados(new Set())
    setModalLote(false)
    setCatLote('')
    setAplicandoLote(false)
  }

  // ── Atualizar data ────────────────────────────────────────────────────────────
  async function salvarData(id: number, novaData: string) {
    if (!novaData) { setEditData(e => { const n = { ...e }; delete n[id]; return n }); return }
    await fetch(`/api/financas/transacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: novaData }),
    })
    setTransacoes(ts => ts.map(t =>
      t.id === id ? { ...t, data: novaData, periodo: novaData.substring(0, 7) } : t
    ))
    setEditData(e => { const n = { ...e }; delete n[id]; return n })
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
    try {
      const r = await fetch('/api/financas/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saldo_inicial: v }),
      })
      const d = await r.json()
      if (!r.ok || d.erro) {
        alert('Erro ao salvar saldo inicial: ' + (d.erro || r.status))
        return
      }
      setSaldoInicial(v)
      setEditSaldo(false)
    } catch (e) {
      alert('Falha de conexão ao salvar saldo inicial. Verifique sua internet e tente novamente.')
      console.error('[salvarSaldo]', e)
    }
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

  if (!['starter','essencial','pro','analista'].includes(plano)) return (
    <div style={{ background: '#050d1a', minHeight: '100vh' }}>
      <NavBar />
      <PaywallFinancas />
    </div>
  )

  // ── Exportação CSV (abre no Excel) — busca TODOS os filtrados ───────────────
  async function exportarExcel() {
    setExportando(true)
    try {
      const p = new URLSearchParams({
        periodo: filPeriodo, categoria: filCategoria, tipo: filTipo,
        extrato: filExtrato, banco: filBanco, busca: filBusca, valor: filValor, exportar: '1',
      })
      const res  = await fetch(`/api/financas/transacoes?${p}`)
      const data = await res.json()
      const lista: Transacao[] = data.transacoes || []
      if (!lista.length) { alert('Nenhum lançamento para exportar com os filtros atuais.'); return }

      const header = ['Data', 'Histórico', 'Banco', 'Categoria', 'Tipo', 'Extrato', 'Valor (R$)', 'Ignorado']
      const rows = lista.map(t => [
        t.data,
        `"${(t.historico || '').replace(/"/g, '""')}"`,
        t.banco,
        t.categoria || 'Outros',
        LABEL_TIPO[t.tipo_lancamento] || t.tipo_lancamento,
        t.tipo_extrato === 'cartao' ? 'Fatura Cartão' : 'Conta Corrente',
        Math.abs(t.valor).toFixed(2).replace('.', ','),
        t.ignorar ? 'Sim' : 'Não',
      ])
      const csv  = [header.join(';'), ...rows.map(r => r.join(';'))].join('\r\n')
      const bom  = '﻿' // BOM UTF-8 para Excel
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `transacoes_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportando(false)
    }
  }

  function toggleSelecionado(id: number) {
    setSelecionados(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleTodos() {
    if (selecionados.size === sortedTransacoes.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(sortedTransacoes.map(t => t.id)))
    }
  }

  // ── Ordenação server-side — envia sort_col/sort_dir para a API ─────────────
  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'data' ? 'desc' : 'asc')
    }
    setPageTrans(1)  // volta à página 1 ao trocar ordenação
  }

  // Transações já chegam ordenadas do servidor; alias mantido para compatibilidade
  const sortedTransacoes = transacoes

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
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif', marginBottom: 4 }}>
              💰 Finanças Pessoais
            </h1>
            <p style={{ color: '#6b84a8', fontSize: 13 }}>
              Controle de receitas, despesas e saldo bancário
            </p>
          </div>
          <a
            href="/ajuda"
            title="Manual do módulo Finanças"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(107,132,168,.1)', border: '1px solid rgba(107,132,168,.25)',
              borderRadius: 8, padding: '6px 12px', textDecoration: 'none',
              color: '#6b84a8', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              flexShrink: 0, marginTop: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>❓</span> Manual de uso
          </a>
        </div>

        {/* Abas — overflow-x scroll no mobile */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.07)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as never }}>
          {(['importar','transacoes','resumo','graficos','grupos','orcamento'] as Aba[]).map(a => {
            const labels: Record<Aba, string> = { importar: '📥 Importar', transacoes: '📋 Transações', resumo: '📊 Resumo', graficos: '📈 Gráficos', grupos: '🎯 Grupos', orcamento: '💰 Orçamento' }
            return (
              <button key={a} onClick={() => setAba(a)} style={{
                background: 'transparent', border: 'none', borderBottom: aba === a ? '2px solid #e8a020' : '2px solid transparent',
                color: aba === a ? '#e8a020' : '#6b84a8', fontWeight: aba === a ? 700 : 500,
                padding: '8px 14px', cursor: 'pointer', fontSize: 13, marginBottom: -1,
                flexShrink: 0, whiteSpace: 'nowrap',
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
                    type="file" accept=".ofx,.qfx,.csv,.txt,.pdf,.xls,.xlsx"
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
                <span style={{ fontSize: 12, color: '#6b84a8' }}>Aceita CSV, TXT, PDF, XLS ou XLSX</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: historicoExpandido ? 12 : 0 }}>
                <button
                  onClick={() => { setHistoricoExpandido(v => !v); if (!historicoExpandido && batches.length === 0) carregarBatches() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
                >
                  <span style={{ fontSize: 12, color: '#6b84a8', transition: 'transform .2s', display: 'inline-block', transform: historicoExpandido ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#b8c4d4', margin: 0 }}>
                    Histórico de Importações
                  </h3>
                </button>
                {historicoExpandido && (
                  <button onClick={carregarBatches} style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12 }}>
                    {loadingBatches ? 'Carregando…' : '↺ Atualizar'}
                  </button>
                )}
              </div>
              {historicoExpandido && (batches.length === 0 ? (
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
              ))}
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
                        {['Data','Histórico','Categoria','Tipo','Valor',''].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6b84a8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: t.ignorar ? 0.55 : 1 }}>
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
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                            {t.ignorar && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#e8a020', background: 'rgba(232,160,32,.12)', border: '1px solid rgba(232,160,32,.3)', padding: '2px 7px', borderRadius: 4 }}>
                                👁 Auto-ignorado
                              </span>
                            )}
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
            <div style={{ ...card(), marginBottom: 12 }}>
              {/* Linha 1 — selects: auto-wrap em telas menores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Período</label>
                  <select value={filPeriodo} onChange={e => { setFilPeriodo(e.target.value); setPageTrans(1) }} style={{ ...selectSt, width: '100%' }}>
                    <option value="">Todos</option>
                    {periodosDisp.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Categoria</label>
                  <select value={filCategoria} onChange={e => { setFilCategoria(e.target.value); setPageTrans(1) }} style={{ ...selectSt, width: '100%' }}>
                    <option value="">Todas</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Tipo</label>
                  <select value={filTipo} onChange={e => { setFilTipo(e.target.value); setPageTrans(1) }} style={{ ...selectSt, width: '100%' }}>
                    <option value="">Todos</option>
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                    <option value="pagamento_cartao">Pgto Cartão</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Extrato</label>
                  <select value={filExtrato} onChange={e => { setFilExtrato(e.target.value); setPageTrans(1) }} style={{ ...selectSt, width: '100%' }}>
                    <option value="">Todos</option>
                    <option value="conta">Conta Corrente</option>
                    <option value="cartao">Fatura Cartão</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Banco</label>
                  <select value={filBanco} onChange={e => { setFilBanco(e.target.value); setPageTrans(1) }} style={{ ...selectSt, width: '100%' }}>
                    <option value="">Todos</option>
                    {bancosUsados.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              {/* Linha 2 — busca + ações: wrap no mobile */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Buscar no histórico</label>
                  <input
                    value={filBusca}
                    onChange={e => { setFilBusca(e.target.value); setPageTrans(1) }}
                    placeholder="Palavras-chave…"
                    style={{ ...inputSt, width: '100%' }}
                  />
                </div>
                <div style={{ flex: '0 0 140px' }}>
                  <label style={{ fontSize: 11, color: '#6b84a8', display: 'block', marginBottom: 3 }}>Valor (R$)</label>
                  <input
                    value={filValor}
                    onChange={e => { setFilValor(e.target.value); setPageTrans(1) }}
                    placeholder="Ex: 140,00"
                    type="text"
                    style={{ ...inputSt, width: '100%' }}
                  />
                </div>
                <button onClick={carregarTransacoes} style={btnPrimary}>Buscar</button>
                <button
                  onClick={() => { setFormLanc({ ...FORM_VAZIO }); setErroLanc(''); setModalAberto(true) }}
                  style={{ ...btnSecondary, color: '#66BB6A', borderColor: 'rgba(102,187,106,.3)', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  ＋ Novo lançamento
                </button>
                <button
                  onClick={() => { setRenomeando({}); setNovaCategoriaNome(''); setModalCat(true) }}
                  style={{ ...btnSecondary, whiteSpace: 'nowrap' }}
                  title="Adicionar ou renomear categorias"
                >
                  🏷 Categorias
                </button>
                <button
                  onClick={exportarExcel}
                  disabled={exportando}
                  title={`Exportar todos os ${totalTrans} lançamento(s) com os filtros atuais`}
                  style={{
                    ...btnSecondary,
                    color: '#22c55e',
                    borderColor: 'rgba(34,197,94,.4)',
                    whiteSpace: 'nowrap',
                    opacity: exportando ? 0.6 : 1,
                    cursor: exportando ? 'wait' : 'pointer',
                  }}
                >
                  {exportando ? '⏳ Exportando…' : `⬇ Excel (${totalTrans})`}
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
                        <th style={{ padding: '9px 12px', width: 36 }}>
                          <input
                            type="checkbox"
                            checked={sortedTransacoes.length > 0 && selecionados.size === sortedTransacoes.length}
                            onChange={toggleTodos}
                            style={{ cursor: 'pointer', accentColor: '#e8a020' }}
                          />
                        </th>
                        {([
                          { label: 'Data',      col: 'data'      },
                          { label: 'Histórico', col: 'historico' },
                          { label: 'Banco',     col: 'banco'     },
                          { label: 'Categoria', col: 'categoria' },
                          { label: 'Tipo',      col: 'tipo'      },
                          { label: 'Valor',     col: 'valor'     },
                          { label: 'Ações',     col: ''          },
                        ] as { label: string; col: typeof sortCol }[]).map(({ label, col }) => {
                          const ativo = sortCol === col && col !== ''
                          const alinhaDireita = label === 'Valor' || label === 'Ações'
                          return (
                            <th
                              key={label}
                              onClick={col ? () => toggleSort(col) : undefined}
                              style={{
                                padding: '9px 12px',
                                textAlign: alinhaDireita ? 'right' : 'left',
                                color: ativo ? '#e8a020' : '#6b84a8',
                                fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                                whiteSpace: 'nowrap', userSelect: 'none',
                                cursor: col ? 'pointer' : 'default',
                              }}
                            >
                              {label}{col ? (ativo ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅') : ''}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTransacoes.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', opacity: t.ignorar ? 0.4 : 1, background: selecionados.has(t.id) ? 'rgba(232,160,32,.06)' : undefined }}>
                          <td style={{ padding: '8px 12px', width: 36 }}>
                            <input
                              type="checkbox"
                              checked={selecionados.has(t.id)}
                              onChange={() => toggleSelecionado(t.id)}
                              style={{ cursor: 'pointer', accentColor: '#e8a020' }}
                            />
                          </td>
                          {/* Data — clique para editar */}
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            {editData[t.id] !== undefined ? (
                              <input
                                type="date"
                                value={editData[t.id]}
                                autoFocus
                                onChange={e => setEditData(prev => ({ ...prev, [t.id]: e.target.value }))}
                                onBlur={e => salvarData(t.id, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') salvarData(t.id, editData[t.id]); if (e.key === 'Escape') setEditData(ed => { const n = { ...ed }; delete n[t.id]; return n }) }}
                                style={{ ...inputSt, width: 130, fontSize: 12, padding: '2px 6px' }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditData(prev => ({ ...prev, [t.id]: t.data }))}
                                title="Clique para editar a data"
                                style={{ cursor: 'pointer', color: '#8fa0b4', borderBottom: '1px dashed rgba(255,255,255,.15)', paddingBottom: 1 }}
                              >
                                {t.data}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.historico}>{t.historico}</td>
                          <td style={{ padding: '8px 12px', color: '#8fa0b4', whiteSpace: 'nowrap' }}>{t.banco}</td>
                          {/* Categoria — select + opção de nova categoria */}
                          <td style={{ padding: '8px 12px' }}>
                            {editando[t.id] !== undefined ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {editando[t.id].novaCat ? (
                                  <input
                                    autoFocus
                                    value={editando[t.id].cat}
                                    onChange={e => setEditando(prev => ({ ...prev, [t.id]: { ...prev[t.id], cat: e.target.value } }))}
                                    onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(t.id) }}
                                    placeholder="Nome da categoria…"
                                    style={{ ...inputSt, fontSize: 12, padding: '3px 6px', width: 160 }}
                                  />
                                ) : (
                                  <select
                                    value={editando[t.id].cat}
                                    onChange={e => {
                                      if (e.target.value === '__nova__') {
                                        setEditando(prev => ({ ...prev, [t.id]: { ...prev[t.id], cat: '', novaCat: true } }))
                                      } else {
                                        setEditando(prev => ({ ...prev, [t.id]: { ...prev[t.id], cat: e.target.value } }))
                                      }
                                    }}
                                    style={{ ...selectSt, width: 'auto', fontSize: 12, padding: '3px 6px' }}
                                  >
                                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="__nova__">➕ Nova categoria…</option>
                                  </select>
                                )}
                                <button onClick={() => salvarEdicao(t.id)} style={{ ...btnPrimary, padding: '3px 8px', fontSize: 11 }}>✓</button>
                                <button onClick={() => setEditando(e => { const n = {...e}; delete n[t.id]; return n })} style={{ ...btnSecondary, padding: '3px 8px', fontSize: 11 }}>✕</button>
                              </div>
                            ) : (
                              <span
                                onClick={() => setEditando(e => ({ ...e, [t.id]: { cat: t.categoria, tipo: t.tipo_lancamento, novaCat: false } }))}
                                style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', whiteSpace: 'nowrap' }}
                              >
                                {t.categoria || 'Outros'} ✎
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {editando[t.id] !== undefined ? (
                              <select
                                value={editando[t.id].tipo}
                                onChange={e => setEditando(prev => ({ ...prev, [t.id]: { ...prev[t.id], tipo: e.target.value } }))}
                                style={{ ...selectSt, width: 'auto', fontSize: 12, padding: '3px 6px' }}
                              >
                                <option value="despesa">Despesa</option>
                                <option value="receita">Receita</option>
                                <option value="pagamento_cartao">Pgto Cartão</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, color: COR_TIPO[t.tipo_lancamento], whiteSpace: 'nowrap' }}>
                                {LABEL_TIPO[t.tipo_lancamento]}
                              </span>
                            )}
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

            {/* Barra de ações em lote — aparece quando há selecionados */}
            {selecionados.size > 0 && (
              <div style={{
                position: 'sticky', bottom: 16, zIndex: 50,
                background: '#1a2d4a', border: '1px solid rgba(232,160,32,.4)',
                borderRadius: 10, padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                boxShadow: '0 4px 20px rgba(0,0,0,.5)',
              }}>
                <span style={{ color: '#e8a020', fontWeight: 700, fontSize: 13 }}>
                  {selecionados.size} selecionado(s)
                </span>
                <button
                  onClick={() => { setCatLote(categorias[0] || ''); setModalLote(true) }}
                  style={{ ...btnPrimary, fontSize: 12, padding: '5px 14px' }}
                >
                  🏷 Alterar categoria
                </button>
                <button
                  onClick={() => setSelecionados(new Set())}
                  style={{ ...btnSecondary, fontSize: 12, padding: '5px 12px' }}
                >
                  Limpar seleção
                </button>
              </div>
            )}

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

            {/* Top categorias (despesa) — ordenado por grupo com cores */}
            <div style={card()} onClick={() => setPainelCats(false)}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#b8c4d4' }}>Top Categorias de Despesa</h3>
              {topCats.length === 0 ? (
                <div style={{ color: '#6b84a8', fontSize: 13 }}>Sem dados.</div>
              ) : (() => {
                const GRUPO_ORDER = ['necessidades','conforto','investimentos','imprevistos','outros']
                const grupoMap = Object.fromEntries(categoriasObj.map(c => [c.nome, c.grupo]))
                const lista = (filCatsGraf.length > 0
                  ? topCats.filter(c => filCatsGraf.includes(c.categoria))
                  : topCats
                ).map(c => ({ ...c, grupo: grupoMap[c.categoria] || 'outros' }))
                  .sort((a, b) => {
                    const ga = GRUPO_ORDER.indexOf(a.grupo)
                    const gb = GRUPO_ORDER.indexOf(b.grupo)
                    return ga !== gb ? ga - gb : b.total - a.total
                  })
                if (lista.length === 0) return <div style={{ color: '#6b84a8', fontSize: 13 }}>Nenhuma categoria selecionada corresponde aos dados.</div>
                const max = Math.max(...lista.map(c => c.total), 1)
                const elementos: React.ReactNode[] = []
                let ultimoGrupo = ''
                for (const c of lista) {
                  if (c.grupo !== ultimoGrupo) {
                    ultimoGrupo = c.grupo
                    elementos.push(
                      <div key={`sep-${c.grupo}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: elementos.length > 0 ? 12 : 0, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRUPOS_CORES[c.grupo], flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: GRUPOS_CORES[c.grupo], textTransform: 'uppercase', letterSpacing: '.6px' }}>
                          {GRUPOS_LABELS[c.grupo]}
                        </span>
                      </div>
                    )
                  }
                  const pct = Math.round((c.total / max) * 100)
                  const cor = GRUPOS_CORES[c.grupo]
                  elementos.push(
                    <div key={c.categoria} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 160, fontSize: 12, color: '#b8c4d4', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.categoria}
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: cor + 'aa', borderRadius: 4, transition: 'width .3s' }} />
                      </div>
                      <div style={{ width: 100, textAlign: 'right', fontSize: 12, fontWeight: 700, color: cor, flexShrink: 0 }}>
                        {fmt(c.total)}
                      </div>
                    </div>
                  )
                }
                return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{elementos}</div>
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: lançamento manual ────────────────────────────────────────── */}
      {/* ── Modal edição em lote ──────────────────────────────────────────── */}
      {modalLote && (
        <div
          onClick={() => setModalLote(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0f1923', border: '1px solid rgba(232,160,32,.3)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,.7)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#e8a020', fontSize: 16 }}>🏷 Alterar categoria em lote</h3>
              <button onClick={() => setModalLote(false)} style={{ background: 'none', border: 'none', color: '#6b84a8', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: '#a0b4cc', fontSize: 13, marginBottom: 16 }}>
              Aplicar nova categoria para <strong style={{ color: '#fff' }}>{selecionados.size} lançamento(s)</strong> selecionado(s).
            </p>
            <label style={{ fontSize: 12, color: '#6b84a8', display: 'block', marginBottom: 6 }}>Nova categoria</label>
            <select
              value={catLote}
              onChange={e => setCatLote(e.target.value)}
              style={{ ...selectSt, width: '100%', marginBottom: 8 }}
            >
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p style={{ fontSize: 11, color: '#6b84a8', marginBottom: 20 }}>
              Ou digite uma nova categoria:
            </p>
            <input
              value={catLote}
              onChange={e => setCatLote(e.target.value)}
              placeholder="Nome da categoria…"
              style={{ ...inputSt, width: '100%', marginBottom: 20, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalLote(false)} style={btnSecondary}>Cancelar</button>
              <button
                onClick={aplicarLote}
                disabled={aplicandoLote || !catLote.trim()}
                style={{ ...btnPrimary, opacity: (aplicandoLote || !catLote.trim()) ? 0.6 : 1 }}
              >
                {aplicandoLote ? '⏳ Salvando…' : `✓ Aplicar para ${selecionados.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* ── ABA ORÇAMENTO ───────────────────────────────────────────────── */}
        {aba === 'orcamento' && (() => {
          const GRUPO_ORDER = ['necessidades','conforto','investimentos','imprevistos','outros']
          const saldo = orcTotalMeta - orcTotalReal
          const pctGeral = orcTotalMeta > 0 ? (orcTotalReal / orcTotalMeta) * 100 : 0

          // Agrupamento para exibição
          const comMeta  = orcamento.filter(l => l.meta > 0)
          const semMeta  = orcamento.filter(l => l.meta === 0)

          function renderLinha(l: LinhaOrcamento) {
            const pct      = l.pct ?? (l.meta === 0 && l.real > 0 ? 100 : 0)
            const estourou = pct > 100
            const quaseNo  = pct >= 80 && pct <= 100
            const cor      = estourou ? '#ef5350' : quaseNo ? '#e8a020' : '#22c55e'
            const corGrupo = GRUPOS_CORES[l.grupo] || GRUPOS_CORES.outros
            const emEdit   = l.categoria in editMeta

            return (
              <div key={l.categoria} style={{
                display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) 120px 95px 85px 120px',
                gap: 10, alignItems: 'center', padding: '10px 14px',
                borderRadius: 7, background: 'rgba(255,255,255,.025)',
                border: `1px solid ${estourou ? 'rgba(239,83,80,.2)' : 'rgba(255,255,255,.05)'}`,
              }}>
                {/* Dot grupo */}
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: corGrupo, flexShrink: 0, display: 'inline-block', justifySelf: 'center' }} />

                {/* Nome */}
                <span style={{ fontSize: 13, color: '#e8edf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.categoria}>
                  {l.categoria}
                </span>

                {/* Meta (editável) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {emEdit ? (
                    <>
                      <input
                        autoFocus
                        type="number" min={0} step={10}
                        value={editMeta[l.categoria]}
                        onChange={e => setEditMeta(p => ({ ...p, [l.categoria]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') salvarMeta(l.categoria); if (e.key === 'Escape') setEditMeta(p => { const n = {...p}; delete n[l.categoria]; return n }) }}
                        style={{ ...inputSt, width: 80, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
                      />
                      <button onClick={() => salvarMeta(l.categoria)} disabled={salvandoMeta[l.categoria]}
                        style={{ background: '#22c55e22', border: 'none', borderRadius: 4, color: '#22c55e', padding: '4px 6px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        ✓
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditMeta(p => ({ ...p, [l.categoria]: String(l.meta || '') }))}
                      title="Clique para editar a meta"
                      style={{ background: 'none', border: '1px dashed rgba(255,255,255,.15)', borderRadius: 5, color: l.meta > 0 ? '#e8edf4' : '#4a5d73', padding: '3px 10px', cursor: 'pointer', fontSize: 12, textAlign: 'right', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
                      {l.meta > 0 ? fmt(l.meta) : '+ meta'}
                    </button>
                  )}
                </div>

                {/* Real */}
                <span style={{ fontSize: 12, fontWeight: 700, color: l.real > 0 ? '#e8edf4' : '#3d4f6a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {l.real > 0 ? fmt(l.real) : '—'}
                </span>

                {/* Diferença */}
                <span style={{ fontSize: 12, fontWeight: 700, color: l.meta === 0 ? '#4a5d73' : cor, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {l.meta === 0 ? '—' : (l.diff >= 0 ? '+' : '') + fmt(Math.abs(l.diff)).replace('R$\xa0', 'R$ ')}
                </span>

                {/* Barra */}
                <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.min(pct, 100)}%`,
                    background: cor,
                    borderRadius: 4, transition: 'width .3s',
                  }} />
                  {estourou && (
                    <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                      {Math.round(pct)}%
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960, width: '100%', margin: '0 auto' }}>

              {/* Modal confirmação — replicar mês anterior */}
              {showConfirmReplica && (() => {
                const [ano, mes] = periodoOrc.split('-').map(Number)
                const pRef = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`
                const labelRef = new Date(Number(pRef.split('-')[0]), Number(pRef.split('-')[1]) - 1, 1)
                  .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                return (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => { if (!replicando) { setShowConfirmReplica(false); setErroReplica('') } }}>
                    <div style={{ background: '#0e1d33', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 16px 48px rgba(0,0,0,.6)' }}
                      onClick={e => e.stopPropagation()}>
                      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#e8edf4' }}>Replicar orçamento</h3>
                      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8fa0b4', lineHeight: 1.6 }}>
                        As metas de todas as categorias serão <strong style={{ color: '#e8edf4' }}>substituídas</strong> pelos gastos reais de{' '}
                        <strong style={{ color: '#e8a020', textTransform: 'capitalize' }}>{labelRef}</strong>.
                        Categorias sem despesa naquele mês não serão alteradas.
                      </p>
                      {erroReplica && (
                        <div style={{ background: 'rgba(239,83,80,.12)', border: '1px solid rgba(239,83,80,.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#ef5350' }}>
                          ⚠ {erroReplica}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowConfirmReplica(false); setErroReplica('') }} disabled={replicando}
                          style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#8fa0b4', cursor: 'pointer', padding: '8px 18px', fontSize: 13 }}>
                          Cancelar
                        </button>
                        <button onClick={replicarMesAnterior} disabled={replicando}
                          style={{ background: replicando ? '#3d4f6a' : '#e8a020', border: 'none', borderRadius: 8, color: replicando ? '#6b84a8' : '#080e1c', cursor: replicando ? 'not-allowed' : 'pointer', padding: '8px 20px', fontSize: 13, fontWeight: 700 }}>
                          {replicando ? 'Replicando...' : 'Replicar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8edf4', margin: 0 }}>Orçamento Mensal</h2>
                  <p style={{ fontSize: 12, color: '#6b84a8', margin: '2px 0 0' }}>Meta vs realizado por categoria. Clique em qualquer meta para editar.</p>
                </div>
                {/* Controles: botão replicar + seletor de mês */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
                <button onClick={() => setShowConfirmReplica(true)}
                  title="Definir metas com base nos gastos do mês anterior"
                  style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#8fa0b4', cursor: 'pointer', padding: '7px 14px', fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.color='#e8edf4'; e.currentTarget.style.borderColor='rgba(232,160,32,.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.color='#8fa0b4'; e.currentTarget.style.borderColor='rgba(255,255,255,.1)' }}>
                  ↩ Replicar mês anterior
                </button>
                {/* Seletor de mês com setas + grade ao clicar */}
                {(() => {
                  const [ano, mes] = periodoOrc.split('-').map(Number)
                  const label = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                  const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
                  function moverMes(delta: number) {
                    const d = new Date(ano, mes - 1 + delta, 1)
                    setPeriodoOrc(d.toISOString().slice(0, 7))
                  }
                  function selecionarMes(m: number) {
                    setPeriodoOrc(`${pickerAno}-${String(m).padStart(2,'0')}`)
                    setShowOrcPicker(false)
                  }
                  return (
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,.06)', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', overflow: 'hidden' }}>
                        <button onClick={() => moverMes(-1)} style={{ background: 'none', border: 'none', color: '#8fa0b4', cursor: 'pointer', padding: '7px 14px', fontSize: 16, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color='#e8a020')} onMouseLeave={e => (e.currentTarget.style.color='#8fa0b4')}>‹</button>
                        <button onClick={() => { setPickerAno(ano); setShowOrcPicker(v => !v) }}
                          style={{ background: 'none', border: 'none', color: '#e8edf4', cursor: 'pointer', padding: '7px 4px', minWidth: 150, textAlign: 'center', textTransform: 'capitalize', fontSize: 13, fontWeight: 600 }}>
                          {label} ▾
                        </button>
                        <button onClick={() => moverMes(1)} style={{ background: 'none', border: 'none', color: '#8fa0b4', cursor: 'pointer', padding: '7px 14px', fontSize: 16, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color='#e8a020')} onMouseLeave={e => (e.currentTarget.style.color='#8fa0b4')}>›</button>
                      </div>
                      {showOrcPicker && (
                        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 100, background: '#0e1d33', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: 12, minWidth: 220, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                          {/* Seletor de ano */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <button onClick={() => setPickerAno(y => y - 1)} style={{ background: 'none', border: 'none', color: '#8fa0b4', cursor: 'pointer', fontSize: 16, padding: '0 8px' }}>‹</button>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#e8edf4' }}>{pickerAno}</span>
                            <button onClick={() => setPickerAno(y => y + 1)} style={{ background: 'none', border: 'none', color: '#8fa0b4', cursor: 'pointer', fontSize: 16, padding: '0 8px' }}>›</button>
                          </div>
                          {/* Grade de meses 4×3 */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                            {MESES_CURTOS.map((m, i) => {
                              const mNum = i + 1
                              const ativo = pickerAno === ano && mNum === mes
                              return (
                                <button key={m} onClick={() => selecionarMes(mNum)}
                                  style={{ background: ativo ? '#e8a020' : 'rgba(255,255,255,.05)', border: 'none', borderRadius: 6, color: ativo ? '#080e1c' : '#b8c4d4', cursor: 'pointer', padding: '6px 4px', fontSize: 12, fontWeight: ativo ? 700 : 400, transition: 'background .15s' }}
                                  onMouseEnter={e => { if (!ativo) e.currentTarget.style.background='rgba(232,160,32,.2)' }}
                                  onMouseLeave={e => { if (!ativo) e.currentTarget.style.background='rgba(255,255,255,.05)' }}>
                                  {m}
                                </button>
                              )
                            })}
                          </div>
                          <button onClick={() => setShowOrcPicker(false)} style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', color: '#6b84a8', cursor: 'pointer', fontSize: 11, padding: '4px 0' }}>Fechar</button>
                        </div>
                      )}
                    </div>
                  )
                })()}
                </div>{/* fim controles direita */}
              </div>

              {/* Cards totais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Meta Total', valor: orcTotalMeta, cor: '#e8a020' },
                  { label: 'Realizado', valor: orcTotalReal, cor: orcTotalReal > orcTotalMeta && orcTotalMeta > 0 ? '#ef5350' : '#e8edf4' },
                  { label: 'Saldo', valor: Math.abs(saldo), cor: saldo >= 0 ? '#22c55e' : '#ef5350', prefix: saldo < 0 ? '−' : '+' },
                ].map(({ label, valor, cor, prefix }) => (
                  <div key={label} style={{ ...card(), textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b84a8', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: cor, fontVariantNumeric: 'tabular-nums' }}>
                      {prefix}{fmt(valor)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra geral */}
              {orcTotalMeta > 0 && (
                <div style={card()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: '#6b84a8' }}>Progresso geral</span>
                    <span style={{ fontWeight: 700, color: pctGeral > 100 ? '#ef5350' : pctGeral >= 80 ? '#e8a020' : '#22c55e' }}>
                      {Math.round(pctGeral)}%
                    </span>
                  </div>
                  <div style={{ height: 12, background: 'rgba(255,255,255,.07)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(pctGeral, 100)}%`,
                      background: pctGeral > 100 ? '#ef5350' : pctGeral >= 80 ? '#e8a020' : '#22c55e',
                      borderRadius: 6, transition: 'width .4s',
                    }} />
                  </div>
                </div>
              )}

              {/* Tabela — scroll horizontal no mobile */}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as never, width: '100%', minWidth: 0 }}>
                <div style={{ minWidth: 560 }}>

                  {/* Header tabela */}
                  <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) 120px 95px 85px 120px', gap: 10, padding: '6px 14px' }}>
                    {['', 'Categoria', 'Meta mensal', 'Realizado', 'Saldo', 'Progresso'].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#4a5d73', textTransform: 'uppercase', letterSpacing: '.5px', textAlign: h === '' ? 'center' : h === 'Progresso' ? 'left' : 'right', ...( h === 'Categoria' ? { textAlign: 'left' } : {}) }}>
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Com meta */}
                  {comMeta.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {comMeta.map(renderLinha)}
                    </div>
                  )}

                  {/* Sem meta mas com gastos */}
                  {semMeta.length > 0 && (
                    <div style={{ border: '1px dashed rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5d73', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                        Categorias sem meta definida — {semMeta.length}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {semMeta.map(renderLinha)}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {orcamento.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: '#4a5d73', fontSize: 14 }}>
                  Nenhum dado para este período. Importe extratos ou defina metas clicando em <strong style={{ color: '#e8a020' }}>+ meta</strong>.
                </div>
              )}
            </div>
          )
        })()}

        {/* ── ABA GRUPOS ──────────────────────────────────────────────────── */}
        {aba === 'grupos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Config de metas */}
            <div style={card()}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#b8c4d4' }}>🎯 Metas de Orçamento</h3>
              <p style={{ fontSize: 12, color: '#6b84a8', marginBottom: 16 }}>
                Defina o percentual-alvo de cada grupo sobre o total de despesas. A soma deve ser 100%.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                {(['necessidades','conforto','investimentos','imprevistos'] as const).map(g => (
                  <div key={g}>
                    <label style={{ fontSize: 11, color: GRUPOS_CORES[g], display: 'block', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      {GRUPOS_LABELS[g]}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min={0} max={100}
                        value={gruposEdit[g]}
                        onChange={e => setGruposEdit(prev => ({ ...prev, [g]: Number(e.target.value) }))}
                        style={{ ...inputSt, width: 70, textAlign: 'center' }}
                      />
                      <span style={{ color: '#6b84a8', fontSize: 13 }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
              {(() => {
                const soma = gruposEdit.necessidades + gruposEdit.conforto + gruposEdit.investimentos + gruposEdit.imprevistos
                const ok = soma === 100
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: ok ? '#22c55e' : '#ef5350' }}>
                      {ok ? '✓ Soma: 100%' : `⚠ Soma: ${soma}% (deve ser 100%)`}
                    </span>
                    <button
                      disabled={!ok || salvandoGrupos}
                      onClick={async () => {
                        setSalvandoGrupos(true)
                        await fetch('/api/financas/config', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ grupos_config: gruposEdit }),
                        })
                        setGruposConfig({ ...gruposEdit })
                        setSalvandoGrupos(false)
                      }}
                      style={{ ...btnPrimary, opacity: (!ok || salvandoGrupos) ? 0.5 : 1 }}
                    >
                      {salvandoGrupos ? 'Salvando…' : 'Salvar metas'}
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* Resumo real vs meta */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#b8c4d4', margin: 0 }}>📊 Real vs Meta</h3>
                <select
                  value={periodoGrupos}
                  onChange={e => setPeriodoGrupos(e.target.value)}
                  style={{ ...selectSt, width: 'auto' }}
                >
                  <option value="">Todos os períodos</option>
                  {periodosDisp.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {gruposDados.length === 0 ? (
                <div style={{ color: '#6b84a8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                  Sem despesas categorizadas no período.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {(['necessidades','conforto','investimentos','imprevistos'] as const).map(g => {
                    const dado = gruposDados.find(d => d.grupo === g)
                    const pctReal  = dado?.pct_real ?? 0
                    const pctMeta  = gruposConfig[g]
                    const total    = dado?.total ?? 0
                    const cor      = GRUPOS_CORES[g]
                    const ok       = pctReal <= pctMeta
                    return (
                      <div key={g}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#e8edf4' }}>{GRUPOS_LABELS[g]}</span>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#6b84a8' }}>Meta: {pctMeta}%</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: ok ? '#22c55e' : '#ef5350' }}>
                              Real: {pctReal.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: 12, color: '#6b84a8' }}>{fmt(total)}</span>
                          </div>
                        </div>
                        {/* Barra */}
                        <div style={{ position: 'relative', height: 10, background: 'rgba(255,255,255,.07)', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pctReal, 100)}%`, background: ok ? cor : '#ef5350', borderRadius: 5, transition: 'width .4s' }} />
                          {/* Linha da meta */}
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(pctMeta, 100)}%`, width: 2, background: 'rgba(255,255,255,.5)', borderRadius: 1 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Atribuição de grupos às categorias */}
            <div style={card()}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#b8c4d4' }}>🏷 Categorias por Grupo</h3>
              <p style={{ fontSize: 12, color: '#6b84a8', marginBottom: 16 }}>
                Atribua cada categoria a um grupo de orçamento.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {categoriasObj.map(cat => (
                  <div key={cat.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 6, gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#e8edf4', flex: 1 }}>{cat.nome}</span>
                    <select
                      value={cat.grupo}
                      onChange={async e => {
                        const novoGrupo = e.target.value
                        setCategoriasObj(prev => prev.map(c => c.nome === cat.nome ? { ...c, grupo: novoGrupo } : c))
                        await fetch('/api/financas/categorias', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ nome: cat.nome, grupo: novoGrupo }),
                        })
                        // Recarrega dados do gráfico
                        const p = new URLSearchParams({ periodo: periodoGrupos })
                        fetch(`/api/financas/grupos?${p}`).then(r => r.json()).then(d => {
                          if (d.grupos) setGruposDados(d.grupos)
                        })
                      }}
                      style={{ ...selectSt, width: 'auto', fontSize: 12 }}
                    >
                      <option value="necessidades">Necessidades</option>
                      <option value="conforto">Conforto</option>
                      <option value="investimentos">Investimentos</option>
                      <option value="imprevistos">Imprevistos</option>
                      <option value="outros">Sem grupo</option>
                    </select>
                    <span style={{ fontSize: 10, width: 8, height: 8, borderRadius: '50%', background: GRUPOS_CORES[cat.grupo] || GRUPOS_CORES.outros, flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      {/* ── MODAL: gerenciar categorias ─────────────────────────────────────── */}
      {modalCat && (
        <div
          onClick={() => setModalCat(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0f1923', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,.7)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk,sans-serif' }}>🏷 Gerenciar Categorias</h3>
              <button onClick={() => setModalCat(false)} style={{ background: 'none', border: 'none', color: '#6b84a8', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Adicionar nova */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                value={novaCategoriaNome}
                onChange={e => setNovaCategoriaNome(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && novaCategoriaNome.trim()) {
                    const nome = novaCategoriaNome.trim()
                    if (!categorias.includes(nome)) setCategorias(cs => [...cs, nome].sort())
                    setNovaCategoriaNome('')
                  }
                }}
                placeholder="Nome da nova categoria…"
                style={{ ...inputSt, flex: 1 }}
              />
              <button
                onClick={() => {
                  const nome = novaCategoriaNome.trim()
                  if (!nome) return
                  if (!categorias.includes(nome)) setCategorias(cs => [...cs, nome].sort())
                  setNovaCategoriaNome('')
                }}
                style={btnPrimary}
              >
                ＋ Adicionar
              </button>
            </div>

            <p style={{ fontSize: 11, color: '#6b84a8', marginBottom: 10 }}>
              Clique em ✎ para renomear — renomear atualiza todos os lançamentos com essa categoria.
            </p>

            {/* Lista de categorias */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categorias.map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 6 }}>
                  {renomeando[cat] !== undefined ? (
                    <>
                      <input
                        autoFocus
                        value={renomeando[cat]}
                        onChange={e => setRenomeando(r => ({ ...r, [cat]: e.target.value }))}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            const para = renomeando[cat].trim()
                            if (!para || para === cat) { setRenomeando(r => { const n = { ...r }; delete n[cat]; return n }); return }
                            await fetch('/api/financas/categorias', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ de: cat, para }),
                            })
                            setCategorias(cs => [...cs.filter(c => c !== cat), para].sort())
                            setTransacoes(ts => ts.map(t => t.categoria === cat ? { ...t, categoria: para } : t))
                            setRenomeando(r => { const n = { ...r }; delete n[cat]; return n })
                          }
                          if (e.key === 'Escape') setRenomeando(r => { const n = { ...r }; delete n[cat]; return n })
                        }}
                        style={{ ...inputSt, flex: 1, fontSize: 13, padding: '3px 8px' }}
                      />
                      <button
                        onClick={async () => {
                          const para = renomeando[cat].trim()
                          if (!para || para === cat) { setRenomeando(r => { const n = { ...r }; delete n[cat]; return n }); return }
                          await fetch('/api/financas/categorias', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ de: cat, para }),
                          })
                          setCategorias(cs => [...cs.filter(c => c !== cat), para].sort())
                          setTransacoes(ts => ts.map(t => t.categoria === cat ? { ...t, categoria: para } : t))
                          setRenomeando(r => { const n = { ...r }; delete n[cat]; return n })
                        }}
                        style={{ ...btnPrimary, padding: '3px 10px', fontSize: 12 }}
                      >✓</button>
                      <button
                        onClick={() => setRenomeando(r => { const n = { ...r }; delete n[cat]; return n })}
                        style={{ ...btnSecondary, padding: '3px 8px', fontSize: 12 }}
                      >✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13 }}>{cat}</span>
                      <button
                        onClick={() => setRenomeando(r => ({ ...r, [cat]: cat }))}
                        style={{ background: 'none', border: 'none', color: '#6b84a8', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}
                        title="Renomear"
                      >✎</button>
                    </>
                  )}
                </div>
              ))}
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
