'use client'
import { useEffect, useState, useCallback } from 'react'
import NavBar from '@/components/NavBar'

/* ── Tipos ───────────────────────────────────────────────────────────────────── */
interface PosIni { id: number; ticker: string; qtde: number; preco_medio: number; data_base: string; origem: string }
interface PrejuizoMap { swing: number; day: number }
interface Apuracao {
  ano_mes: string; vendas_acao_sw: number; lucro_acao_sw: number; lucro_opcao_sw: number
  lucro_day: number; isento_swing: boolean; prej_swing_ac: number; prej_day_ac: number
  ir_swing: number; ir_day: number; irrf_day: number; ir_devido_swing: number; ir_devido_day: number
}
interface Darf { id: number; competencia: string; codigo_receita: string; valor: number; vencimento: string; status: string }
interface Mov { id: number; data: string; ticker: string; tipo: string; quantidade: number; preco: number; valor_total: number; corretora: string | null }

interface PosicaoOpcao {
  ticker: string
  qtdeLiquida: number      // + = titular, - = lançador
  premioMedio: number      // custo médio pago (titular) ou prêmio médio recebido (lançador)
  custoTotal: number       // |qtde| × premioMedio
  vencimento: Date
  diasParaVencer: number
  isCall: boolean
  virouPo: boolean         // já foi marcado
}

type Aba = 'posicao' | 'operacoes' | 'apuracao' | 'darfs' | 'opcoes'

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const anoAtual = new Date().getFullYear()
const mesAtual = new Date().getMonth() + 1

/* ── Vencimento de opções B3 ─────────────────────────────────────────────────── */
// Calls: A=Jan … L=Dez | Puts: M=Jan … X=Dez
const LETRAS_CALL = 'ABCDEFGHIJKL'
const LETRAS_PUT  = 'MNOPQRSTUVWX'

function isOpcaoTicker(ticker: string): boolean {
  return /^[A-Z]{4}[A-Z]\d+$/.test(ticker)
}

function terceiraSegunda(ano: number, mes: number): Date {
  // Encontra a terceira segunda-feira do mês (vencimento padrão B3 para ações)
  const d = new Date(ano, mes, 1)
  const dow = d.getDay() // 0=Dom … 6=Sáb
  const diasAteProxSeg = dow === 1 ? 0 : (8 - dow) % 7
  return new Date(ano, mes, 1 + diasAteProxSeg + 14)
}

function vencimentoOpcao(ticker: string): { data: Date; isCall: boolean } | null {
  if (ticker.length < 5) return null
  const letra = ticker[4].toUpperCase()
  let mes = LETRAS_CALL.indexOf(letra)
  let isCall = true
  if (mes === -1) { mes = LETRAS_PUT.indexOf(letra); isCall = false }
  if (mes === -1) return null

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  let data = terceiraSegunda(hoje.getFullYear(), mes)
  // Se já venceu neste ano, vai para o próximo
  if (data < hoje) data = terceiraSegunda(hoje.getFullYear() + 1, mes)
  return { data, isCall }
}

function calcPosicaoOpcoes(movs: Mov[]): PosicaoOpcao[] {
  const map = new Map<string, { compras: number; vendas: number; custoC: number; custoV: number; virouPo: boolean }>()

  for (const m of movs) {
    if (!isOpcaoTicker(m.ticker)) continue
    if (!map.has(m.ticker)) map.set(m.ticker, { compras: 0, vendas: 0, custoC: 0, custoV: 0, virouPo: false })
    const e = map.get(m.ticker)!
    if (m.tipo === 'C') { e.compras += m.quantidade; e.custoC += m.quantidade * m.preco }
    else                { e.vendas  += m.quantidade; e.custoV += m.quantidade * m.preco
      if (m.corretora === 'Vencimento B3' && m.preco === 0) e.virouPo = true
    }
  }

  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const resultado: PosicaoOpcao[] = []

  for (const [ticker, e] of map) {
    const qtdeLiquida = e.compras - e.vendas
    if (Math.abs(qtdeLiquida) < 0.001) continue  // posição fechada

    const venc = vencimentoOpcao(ticker)
    if (!venc) continue

    const dias = Math.round((venc.data.getTime() - hoje.getTime()) / 86400000)
    const premioMedio = qtdeLiquida > 0
      ? (e.compras > 0 ? e.custoC / e.compras : 0)
      : (e.vendas  > 0 ? e.custoV / e.vendas  : 0)

    resultado.push({
      ticker, qtdeLiquida, premioMedio,
      custoTotal: Math.abs(qtdeLiquida) * premioMedio,
      vencimento: venc.data, diasParaVencer: dias,
      isCall: venc.isCall, virouPo: e.virouPo,
    })
  }

  return resultado.sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())
}

/* ── Componente principal ────────────────────────────────────────────────────── */
export default function PaginaIR() {
  const [aba, setAba] = useState<Aba>('apuracao')

  // Posição inicial
  const [posicoes, setPosicoes] = useState<PosIni[]>([])
  const [prejuizo, setPrejuizo] = useState<PrejuizoMap>({ swing: 0, day: 0 })
  const [formPos, setFormPos] = useState({ ticker: '', qtde: '', preco_medio: '', data_base: '', origem: 'declaracao' })
  const [editPrejSwing, setEditPrejSwing] = useState('')
  const [editPrejDay, setEditPrejDay] = useState('')

  // Operações
  const [ops, setOps] = useState<Mov[]>([])
  const [filtroTicker, setFiltroTicker] = useState('')

  // Apuração
  const [anoSel, setAnoSel] = useState(mesAtual === 1 ? anoAtual - 1 : anoAtual)
  const [mesSel, setMesSel] = useState(mesAtual === 1 ? 12 : mesAtual - 1)
  const [historico, setHistorico] = useState<Apuracao[]>([])
  const [apuracaoAtual, setApuracaoAtual] = useState<Apuracao | null>(null)
  const [calculando, setCalculando] = useState(false)

  // DARFs
  const [darfs, setDarfs] = useState<Darf[]>([])
  const [gerandoDarf, setGerandoDarf] = useState('')

  // Opções
  const [posOpcoes, setPosOpcoes] = useState<PosicaoOpcao[]>([])
  const [marcandoPo, setMarcandoPo] = useState<string | null>(null)

  // Mensagens
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null)

  function aviso(texto: string, tipo: 'ok' | 'erro' = 'ok') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg(null), 4000)
  }

  /* ── Carregamentos ───────────────────────────────────────────────────────────── */
  const carregarPosicoes = useCallback(async () => {
    const r = await fetch('/api/ir/posicao-inicial')
    if (!r.ok) return
    const d = await r.json()
    setPosicoes(d.posicoes ?? [])
    setPrejuizo(d.prejuizo ?? { swing: 0, day: 0 })
    setEditPrejSwing(String(d.prejuizo?.swing ?? 0))
    setEditPrejDay(String(d.prejuizo?.day ?? 0))
  }, [])

  const carregarOps = useCallback(async () => {
    const r = await fetch('/api/carteira/movimentacoes')
    if (!r.ok) return
    const d = await r.json()
    setOps(d.movimentacoes ?? [])
  }, [])

  const carregarHistorico = useCallback(async () => {
    const r = await fetch('/api/ir/historico')
    if (!r.ok) return
    const d = await r.json()
    setHistorico(d.historico ?? [])
  }, [])

  const carregarDarfs = useCallback(async () => {
    const r = await fetch('/api/ir/darfs')
    if (!r.ok) return
    const d = await r.json()
    setDarfs(d.darfs ?? [])
  }, [])

  useEffect(() => {
    carregarPosicoes()
    carregarHistorico()
    carregarDarfs()
  }, [carregarPosicoes, carregarHistorico, carregarDarfs])

  useEffect(() => {
    if (aba === 'operacoes' || aba === 'opcoes') carregarOps()
  }, [aba, carregarOps])

  useEffect(() => {
    if (aba === 'opcoes' && ops.length > 0) {
      setPosOpcoes(calcPosicaoOpcoes(ops))
    }
  }, [aba, ops])

  /* ── Ações — Posição Inicial ─────────────────────────────────────────────────── */
  async function salvarPosicao() {
    if (!formPos.ticker || !formPos.qtde || !formPos.preco_medio || !formPos.data_base) {
      aviso('Preencha ticker, quantidade, preço médio e data base.', 'erro'); return
    }
    const r = await fetch('/api/ir/posicao-inicial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_posicao', ticker: formPos.ticker.toUpperCase(), qtde: Number(formPos.qtde), preco_medio: Number(formPos.preco_medio), data_base: formPos.data_base, origem: formPos.origem }),
    })
    if (r.ok) { aviso('Posição salva.'); setFormPos({ ticker: '', qtde: '', preco_medio: '', data_base: '', origem: 'declaracao' }); carregarPosicoes() }
    else aviso('Erro ao salvar posição.', 'erro')
  }

  async function deletarPosicao(ticker: string) {
    await fetch('/api/ir/posicao-inicial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_posicao', ticker }),
    })
    carregarPosicoes()
  }

  async function salvarPrejuizo() {
    const r = await fetch('/api/ir/posicao-inicial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_prejuizo', swing: Number(editPrejSwing) || 0, day: Number(editPrejDay) || 0 }),
    })
    if (r.ok) { aviso('Prejuízo acumulado atualizado.'); carregarPosicoes() }
  }

  /* ── Ações — Apuração ────────────────────────────────────────────────────────── */
  async function calcular() {
    setCalculando(true)
    const r = await fetch('/api/ir/apurar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ano: anoSel, mes: mesSel }),
    })
    setCalculando(false)
    if (r.ok) {
      const d = await r.json()
      setApuracaoAtual(d)
      carregarHistorico()
      aviso(`Apuração ${MESES[mesSel-1]}/${anoSel} calculada com sucesso.`)
    } else {
      const e = await r.json().catch(() => ({}))
      aviso(e.error ?? 'Erro ao calcular apuração.', 'erro')
    }
  }

  /* ── Ações — DARFs ───────────────────────────────────────────────────────────── */
  async function gerarDarfs(anoMes: string) {
    setGerandoDarf(anoMes)
    const r = await fetch('/api/ir/darfs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gerar_de_apuracao', competencia: anoMes }),
    })
    setGerandoDarf('')
    if (r.ok) { const d = await r.json(); aviso(`${d.gerados.length} DARF(s) gerado(s).`); carregarDarfs() }
    else aviso('Erro ao gerar DARFs.', 'erro')
  }

  async function marcarVirouPo(pos: PosicaoOpcao) {
    setMarcandoPo(pos.ticker)
    const dataVenc = pos.vencimento.toISOString().slice(0,10)
    const r = await fetch('/api/ir/opcoes/virou-po', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: pos.ticker, qtde_liquida: pos.qtdeLiquida, data_vencimento: dataVenc }),
    })
    setMarcandoPo(null)
    if (r.ok) {
      const txt = pos.qtdeLiquida > 0
        ? `${pos.ticker}: prejuízo de ${BRL(pos.custoTotal)} registrado (prêmio virou pó).`
        : `${pos.ticker}: posição encerrada — ganho já foi apurado na abertura.`
      aviso(txt)
      carregarOps()
    } else {
      const e = await r.json().catch(() => ({}))
      aviso(e.error ?? 'Erro ao registrar vencimento.', 'erro')
    }
  }

  async function marcarPago(id: number) {
    await fetch('/api/ir/darfs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'marcar_pago', id, status: 'pago' }),
    })
    carregarDarfs()
  }

  /* ── Resultado atual selecionado ─────────────────────────────────────────────── */
  const anoMesSel = `${anoSel}-${String(mesSel).padStart(2,'0')}`
  const apuracaoHist = historico.find(h => h.ano_mes === anoMesSel)
  const apuracaoExibe = apuracaoAtual?.ano_mes === anoMesSel ? apuracaoAtual : apuracaoHist ?? null

  const opsFiltradas = ops.filter(o => !filtroTicker || o.ticker.toUpperCase().includes(filtroTicker.toUpperCase()))

  /* ── Render ──────────────────────────────────────────────────────────────────── */
  return (
    <>
      <NavBar />
      <div style={{ minHeight: '100vh', background: '#080e1c', color: '#e0e6f0', fontFamily: 'Inter,system-ui,sans-serif', padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>📋 Apuração de IR</h1>
          <span style={{ fontSize: 12, color: '#4a5d73' }}>Ações · Opções · Swing · Day Trade</span>
        </div>

        {msg && (
          <div style={{ background: msg.tipo === 'ok' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', border: `1px solid ${msg.tipo === 'ok' ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: msg.tipo === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.texto}
          </div>
        )}

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0, flexWrap: 'wrap' }}>
          {(['apuracao','darfs','opcoes','posicao','operacoes'] as Aba[]).map(a => {
            const labels: Record<Aba,string> = { apuracao: '📊 Apuração Mensal', darfs: '📄 DARFs', opcoes: '🎯 Opções', posicao: '📌 Posição Inicial', operacoes: '📋 Operações' }
            return (
              <button key={a} onClick={() => setAba(a)} style={{ background: 'none', border: 'none', borderBottom: aba === a ? '2px solid #eab838' : '2px solid transparent', padding: '8px 16px', fontSize: 13, fontWeight: aba === a ? 700 : 500, color: aba === a ? '#eab838' : '#4a5d73', cursor: 'pointer', transition: 'all .15s' }}>
                {labels[a]}
              </button>
            )
          })}
        </div>

        {/* ── ABA APURAÇÃO ─────────────────────────────────────────────────────────── */}
        {aba === 'apuracao' && (
          <div>
            {/* Seletor Ano/Mês + botão calcular */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>MÊS</div>
                <select value={mesSel} onChange={e => { setMesSel(Number(e.target.value)); setApuracaoAtual(null) }} style={stSelect}>
                  {MESES.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>ANO</div>
                <select value={anoSel} onChange={e => { setAnoSel(Number(e.target.value)); setApuracaoAtual(null) }} style={stSelect}>
                  {[2021,2022,2023,2024,2025,2026].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button onClick={calcular} disabled={calculando} style={{ ...stBtn('#1565C0'), height: 36, padding: '0 20px', marginBottom: 0 }}>
                {calculando ? 'Calculando...' : '⚡ Calcular'}
              </button>
              {apuracaoExibe && (
                <button onClick={() => gerarDarfs(anoMesSel)} disabled={!!gerandoDarf} style={{ ...stBtn('#7B3F00'), height: 36, padding: '0 20px', marginBottom: 0 }}>
                  {gerandoDarf === anoMesSel ? 'Gerando...' : '📄 Gerar DARFs'}
                </button>
              )}
            </div>

            {apuracaoExibe ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Cards de resumo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <Card titulo="Vendas Ações Swing" valor={BRL(apuracaoExibe.vendas_acao_sw)} destaque={apuracaoExibe.isento_swing ? '🟢 Isento' : undefined} />
                  <Card titulo="Lucro Ações Swing" valor={BRL(apuracaoExibe.lucro_acao_sw)} cor={apuracaoExibe.lucro_acao_sw >= 0 ? '#22c55e' : '#ef4444'} />
                  <Card titulo="Lucro Opções Swing" valor={BRL(apuracaoExibe.lucro_opcao_sw)} cor={apuracaoExibe.lucro_opcao_sw >= 0 ? '#22c55e' : '#ef4444'} />
                  <Card titulo="Lucro Day Trade" valor={BRL(apuracaoExibe.lucro_day)} cor={apuracaoExibe.lucro_day >= 0 ? '#22c55e' : '#ef4444'} />
                </div>

                {/* Tabela de cálculo */}
                <div style={stCard}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eab838', marginBottom: 12 }}>Cálculo do Imposto — {MESES[mesSel-1]}/{anoSel}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      <LinhaTabIR label="Isenção R$20k (ações swing)" valor={apuracaoExibe.isento_swing ? 'SIM ✅' : 'Não'} destaque={apuracaoExibe.isento_swing} />
                      <LinhaTabIR label="Prejuízo acumulado swing (antes)" valor={BRL(apuracaoExibe.prej_swing_ac + (apuracaoExibe.lucro_acao_sw + apuracaoExibe.lucro_opcao_sw < 0 ? 0 : apuracaoExibe.lucro_acao_sw + apuracaoExibe.lucro_opcao_sw > 0 ? 0 : 0))} sub />
                      <LinhaTabIR label="IR Swing (15% sobre base)" valor={BRL(apuracaoExibe.ir_swing)} destaque={apuracaoExibe.ir_swing > 0} />
                      <LinhaTabIR label="IR Day Trade (20% sobre base)" valor={BRL(apuracaoExibe.ir_day)} destaque={apuracaoExibe.ir_day > 0} />
                      <LinhaTabIR label="IRRF Day Trade deduzido (1%)" valor={`- ${BRL(apuracaoExibe.irrf_day)}`} sub />
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: '#eab838' }}>IR a Recolher — Swing (DARF 6015)</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: apuracaoExibe.ir_devido_swing > 0 ? '#ef4444' : '#22c55e' }}>{BRL(apuracaoExibe.ir_devido_swing)}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 8px', fontWeight: 700, color: '#eab838' }}>IR a Recolher — Day Trade (DARF 6010)</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: apuracaoExibe.ir_devido_day > 0 ? '#ef4444' : '#22c55e' }}>{BRL(apuracaoExibe.ir_devido_day)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#4a5d73', flexWrap: 'wrap' }}>
                    <span>Prejuízo swing acumulado pós-mês: {BRL(apuracaoExibe.prej_swing_ac)}</span>
                    <span>Prejuízo day acumulado pós-mês: {BRL(apuracaoExibe.prej_day_ac)}</span>
                  </div>
                </div>

                {/* Nota fiscal */}
                {(apuracaoExibe.ir_devido_swing >= 10 || apuracaoExibe.ir_devido_day >= 10) && (
                  <div style={{ background: 'rgba(234,184,56,.08)', border: '1px solid rgba(234,184,56,.25)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#eab838' }}>
                    ⚠ Vencimento do DARF: dia 20 do mês seguinte. Clique em "Gerar DARFs" acima para registrar.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#4a5d73', padding: '40px 0', fontSize: 14 }}>
                Selecione o mês e clique em "Calcular" para apurar o IR de {MESES[mesSel-1]}/{anoSel}.
              </div>
            )}

            {/* Histórico */}
            {historico.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#6b84a8', marginBottom: 10 }}>Histórico de Apurações</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', color: '#4a5d73' }}>
                        {['Mês','Vendas SW','Lucro SW','Lucro DT','Isento','IR Swing','IR Day','Total IR'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map(h => (
                        <tr key={h.ano_mes} onClick={() => { const [a,m] = h.ano_mes.split('-').map(Number); setAnoSel(a); setMesSel(m); setApuracaoAtual(null) }}
                          style={{ borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer', transition: 'background .1s' }}
                          onMouseOver={e => (e.currentTarget.style.background='rgba(255,255,255,.03)')}
                          onMouseOut={e => (e.currentTarget.style.background='transparent')}
                        >
                          <td style={{ padding: '7px 10px', color: '#e0e6f0', fontWeight: 600 }}>{h.ano_mes}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6b84a8' }}>{BRL(h.vendas_acao_sw)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: (h.lucro_acao_sw + h.lucro_opcao_sw) >= 0 ? '#22c55e' : '#ef4444' }}>{BRL(h.lucro_acao_sw + h.lucro_opcao_sw)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: h.lucro_day >= 0 ? '#22c55e' : '#ef4444' }}>{BRL(h.lucro_day)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: h.isento_swing ? '#22c55e' : '#4a5d73' }}>{h.isento_swing ? '✅' : '—'}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: h.ir_devido_swing > 0 ? '#ef4444' : '#4a5d73' }}>{BRL(h.ir_devido_swing)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: h.ir_devido_day > 0 ? '#ef4444' : '#4a5d73' }}>{BRL(h.ir_devido_day)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: (h.ir_devido_swing + h.ir_devido_day) > 0 ? '#ef4444' : '#22c55e' }}>{BRL(h.ir_devido_swing + h.ir_devido_day)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA OPÇÕES ────────────────────────────────────────────────────────────── */}
        {aba === 'opcoes' && (
          <div>
            <div style={{ fontSize: 12, color: '#4a5d73', marginBottom: 16 }}>
              Posições abertas de opções · Vencimento: terceira segunda-feira do mês (B3) · Ao marcar "virou pó", o sistema registra automaticamente o resultado fiscal.
            </div>

            {posOpcoes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#4a5d73', padding: '40px 0', fontSize: 14 }}>
                Nenhuma posição aberta de opções. Importe suas operações pelo módulo Carteira → Importar B3.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', color: '#4a5d73' }}>
                      {['Ticker','Tipo','Posição','Prêmio Médio','Custo/Recebido','Vencimento','Dias','Status','Ação'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posOpcoes.map(p => {
                      const venceu   = p.diasParaVencer < 0
                      const urgente  = p.diasParaVencer >= 0 && p.diasParaVencer <= 5
                      const rowBg    = venceu ? 'rgba(239,68,68,.06)' : urgente ? 'rgba(234,184,56,.05)' : 'transparent'
                      const dataStr  = p.vencimento.toLocaleDateString('pt-BR')
                      const titular  = p.qtdeLiquida > 0
                      return (
                        <tr key={p.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: rowBg }}>
                          <td style={{ padding: '10px', fontWeight: 800, color: '#e0e6f0' }}>{p.ticker}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ background: p.isCall ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', color: p.isCall ? '#22c55e' : '#ef4444', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                              {p.isCall ? 'CALL' : 'PUT'}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ color: titular ? '#64b5f6' : '#ffb74d', fontWeight: 600 }}>
                              {titular ? `Titular +${p.qtdeLiquida}` : `Lançador ${p.qtdeLiquida}`}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#6b84a8' }}>{BRL(p.premioMedio)}</td>
                          <td style={{ padding: '10px', color: titular ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                            {titular ? `−${BRL(p.custoTotal)}` : `+${BRL(p.custoTotal)}`}
                          </td>
                          <td style={{ padding: '10px', color: venceu ? '#ef4444' : urgente ? '#eab838' : '#6b84a8', fontWeight: (venceu || urgente) ? 700 : 400 }}>
                            {dataStr}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {venceu ? (
                              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 12 }}>VENCIDA</span>
                            ) : urgente ? (
                              <span style={{ color: '#eab838', fontWeight: 700, fontSize: 12 }}>{p.diasParaVencer}d ⚠</span>
                            ) : (
                              <span style={{ color: '#4a5d73', fontSize: 12 }}>{p.diasParaVencer}d</span>
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {p.virouPo ? (
                              <span style={{ color: '#4a5d73', fontSize: 12 }}>✅ Registrado</span>
                            ) : (
                              <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>Em aberto</span>
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {!p.virouPo && (
                              <button
                                onClick={() => marcarVirouPo(p)}
                                disabled={marcandoPo === p.ticker}
                                title={titular ? `Registrar perda de ${BRL(p.custoTotal)} (prêmio pago)` : 'Encerrar posição de lançamento'}
                                style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', color: '#ef4444', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px', whiteSpace: 'nowrap' }}
                              >
                                {marcandoPo === p.ticker ? '...' : '💀 Virou Pó'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legenda */}
            <div style={{ marginTop: 20, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, color: '#4a5d73' }}>
              <span>🔴 Fundo vermelho = vencida</span>
              <span>🟡 Fundo amarelo = vence em ≤5 dias</span>
              <span style={{ color: '#64b5f6' }}>■ Titular: comprou a opção (paga prêmio, direito de exercer)</span>
              <span style={{ color: '#ffb74d' }}>■ Lançador: vendeu a opção (recebeu prêmio, obrigação de cumprir)</span>
            </div>
          </div>
        )}

        {/* ── ABA DARFs ─────────────────────────────────────────────────────────────── */}
        {aba === 'darfs' && (
          <div>
            {darfs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#4a5d73', padding: '40px 0', fontSize: 14 }}>
                Nenhum DARF gerado. Calcule uma apuração mensal e clique em "Gerar DARFs".
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', color: '#4a5d73' }}>
                      {['Competência','Código','Valor','Vencimento','Status','Ação'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {darfs.map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td style={{ padding: '10px 12px', color: '#e0e6f0', fontWeight: 600 }}>{d.competencia}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: d.codigo_receita === '6015' ? 'rgba(21,101,192,.25)' : 'rgba(123,63,0,.25)', color: d.codigo_receita === '6015' ? '#64b5f6' : '#ffb74d', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                            {d.codigo_receita} {d.codigo_receita === '6015' ? '(Swing)' : '(Day)'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: d.status === 'pago' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{BRL(d.valor)}</td>
                        <td style={{ padding: '10px 12px', color: '#6b84a8' }}>{d.vencimento?.slice(0,10)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ color: d.status === 'pago' ? '#22c55e' : '#f59e0b', fontSize: 12, fontWeight: 600 }}>{d.status === 'pago' ? '✅ Pago' : '⏳ Pendente'}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {d.status !== 'pago' && (
                            <button onClick={() => marcarPago(d.id)} style={{ ...stBtn('#22c55e'), fontSize: 11, padding: '3px 10px' }}>Marcar pago</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ABA POSIÇÃO INICIAL ───────────────────────────────────────────────────── */}
        {aba === 'posicao' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={stCard}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eab838', marginBottom: 14 }}>Saldo de Prejuízo Acumulado (anos anteriores)</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>Swing Trade (R$)</div>
                  <input type="number" value={editPrejSwing} onChange={e => setEditPrejSwing(e.target.value)} style={stInput} placeholder="0" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>Day Trade (R$)</div>
                  <input type="number" value={editPrejDay} onChange={e => setEditPrejDay(e.target.value)} style={stInput} placeholder="0" />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button onClick={salvarPrejuizo} style={stBtn('#1565C0')}>Salvar Saldo</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#4a5d73' }}>Informe o saldo de prejuízo acumulado conforme sua última Declaração IRPF. O sistema atualiza automaticamente mês a mês.</div>
            </div>

            <div style={stCard}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eab838', marginBottom: 14 }}>Adicionar / Editar Posição Inicial</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>Ticker</div>
                  <input value={formPos.ticker} onChange={e => setFormPos(p => ({ ...p, ticker: e.target.value }))} style={{ ...stInput, width: 90, textTransform: 'uppercase' }} placeholder="PETR4" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>Quantidade</div>
                  <input type="number" value={formPos.qtde} onChange={e => setFormPos(p => ({ ...p, qtde: e.target.value }))} style={{ ...stInput, width: 100 }} placeholder="100" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>Preço Médio (R$)</div>
                  <input type="number" step="0.01" value={formPos.preco_medio} onChange={e => setFormPos(p => ({ ...p, preco_medio: e.target.value }))} style={{ ...stInput, width: 110 }} placeholder="30.50" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 4 }}>Data Base</div>
                  <input type="date" value={formPos.data_base} onChange={e => setFormPos(p => ({ ...p, data_base: e.target.value }))} style={{ ...stInput, width: 140 }} />
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button onClick={salvarPosicao} style={stBtn('#1565C0')}>Salvar</button>
                </div>
              </div>
            </div>

            {posicoes.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', color: '#4a5d73' }}>
                      {['Ticker','Qtde','Preço Médio','Custo Total','Data Base','Origem',''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posicoes.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#e0e6f0' }}>{p.ticker}</td>
                        <td style={{ padding: '8px 10px', color: '#6b84a8' }}>{p.qtde}</td>
                        <td style={{ padding: '8px 10px', color: '#6b84a8' }}>{BRL(p.preco_medio)}</td>
                        <td style={{ padding: '8px 10px', color: '#eab838' }}>{BRL(p.qtde * p.preco_medio)}</td>
                        <td style={{ padding: '8px 10px', color: '#4a5d73', fontSize: 12 }}>{p.data_base?.slice(0,10)}</td>
                        <td style={{ padding: '8px 10px', color: '#4a5d73', fontSize: 11 }}>{p.origem}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <button onClick={() => deletarPosicao(p.ticker)} style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11, padding: '2px 8px' }}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ABA OPERAÇÕES ─────────────────────────────────────────────────────────── */}
        {aba === 'operacoes' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <input value={filtroTicker} onChange={e => setFiltroTicker(e.target.value)} style={{ ...stInput, width: 140 }} placeholder="Filtrar ticker..." />
              <span style={{ fontSize: 12, color: '#4a5d73' }}>{opsFiltradas.length} operação(ões)</span>
            </div>
            {opsFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#4a5d73', padding: '40px 0', fontSize: 14 }}>Nenhuma operação encontrada. Importe pelo módulo Carteira → Importar B3.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', color: '#4a5d73' }}>
                      {['Data','Ticker','Tipo','Qtde','Preço','Total','Corretora'].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {opsFiltradas.slice(0, 500).map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                        <td style={{ padding: '6px 10px', color: '#6b84a8' }}>{o.data?.slice(0,10)}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#e0e6f0' }}>{o.ticker}</td>
                        <td style={{ padding: '6px 10px' }}><span style={{ color: o.tipo === 'C' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{o.tipo === 'C' ? 'Compra' : 'Venda'}</span></td>
                        <td style={{ padding: '6px 10px', color: '#6b84a8' }}>{o.quantidade}</td>
                        <td style={{ padding: '6px 10px', color: '#6b84a8' }}>{BRL(o.preco)}</td>
                        <td style={{ padding: '6px 10px', color: '#e0e6f0' }}>{BRL(o.valor_total)}</td>
                        <td style={{ padding: '6px 10px', color: '#4a5d73', fontSize: 11 }}>{o.corretora ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {opsFiltradas.length > 500 && <div style={{ fontSize: 11, color: '#4a5d73', textAlign: 'center', marginTop: 8 }}>Exibindo as 500 operações mais recentes.</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/* ── Sub-componentes ─────────────────────────────────────────────────────────── */
function Card({ titulo, valor, cor, destaque }: { titulo: string; valor: string; cor?: string; destaque?: string | boolean }) {
  return (
    <div style={{ background: '#0e1d33', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#4a5d73', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: cor ?? '#e0e6f0' }}>{valor}</div>
      {typeof destaque === 'string' && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>{destaque}</div>}
    </div>
  )
}

function LinhaTabIR({ label, valor, destaque, sub }: { label: string; valor: string; destaque?: boolean; sub?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <td style={{ padding: '8px', color: sub ? '#4a5d73' : '#6b84a8', fontSize: sub ? 11 : 12, paddingLeft: sub ? 20 : 8 }}>{label}</td>
      <td style={{ padding: '8px', textAlign: 'right', color: destaque ? '#eab838' : sub ? '#4a5d73' : '#e0e6f0', fontWeight: destaque ? 700 : 400 }}>{valor}</td>
    </tr>
  )
}

/* ── Estilos utilitários ─────────────────────────────────────────────────────── */
const stCard: React.CSSProperties = { background: '#0e1d33', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '16px 18px' }
const stInput: React.CSSProperties = { background: '#0e1d33', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '6px 10px', color: '#e0e6f0', fontSize: 13, outline: 'none' }
const stSelect: React.CSSProperties = { ...stInput, cursor: 'pointer' }
function stBtn(bg: string): React.CSSProperties { return { background: bg, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '7px 16px', transition: 'opacity .15s' } }
