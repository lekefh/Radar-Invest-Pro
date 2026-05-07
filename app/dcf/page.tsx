'use client'
import { useState } from 'react'
import NavBar from '@/components/NavBar'
import dcfRaw from '@/lib/dcf.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dcfData = dcfRaw as Record<string, any>
const empresas = Object.values(dcfData).sort((a: any, b: any) =>
  (b.base?.upside ?? -999) - (a.base?.upside ?? -999)
)

const f2 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f1 = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function UpsideBar({ upside }: { upside: number | null | undefined }) {
  if (upside == null) return <span style={{ color: '#6b84a8' }}>—</span>
  const color = upside >= 20 ? '#00d4a0' : upside >= 0 ? '#FFD54F' : '#ef4444'
  const sinal = upside >= 0 ? '+' : ''
  return (
    <span style={{ color, fontWeight: 700, fontSize: '15px' }}>
      {sinal}{f1(upside)}%
    </span>
  )
}

function CenarioCard({ label, color, preco, upside, precoAtual }: {
  label: string; color: string; preco: number | null; upside: number | null; precoAtual: number | null
}) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: `1px solid ${color}33`, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color, marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, fontFamily: 'var(--font-space),Space Grotesk,sans-serif', lineHeight: 1 }}>
        R$ {f2(preco)}
      </div>
      {precoAtual && preco && (
        <div style={{ fontSize: '13px', color, marginTop: '6px', fontWeight: 600 }}>
          {upside != null ? `${upside >= 0 ? '+' : ''}${f1(upside)}%` : '—'}
        </div>
      )}
    </div>
  )
}

function ModalRelatorio({ ticker, nome, onClose }: { ticker: string; nome: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [relatorio, setRelatorio] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const gerar = async () => {
    setLoading(true); setErro(''); setRelatorio(null)
    try {
      const r = await fetch(`/api/relatorio/${ticker}`)
      const d = await r.json()
      if (!r.ok) { setErro(d.error ?? 'Erro ao gerar relatório'); return }
      setRelatorio(d.relatorio)
    } catch { setErro('Erro de conexão.') }
    finally { setLoading(false) }
  }

  const copiar = () => {
    if (relatorio) navigator.clipboard.writeText(relatorio)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d1a2e', border: '1px solid rgba(255,255,255,.12)', borderRadius: '14px', width: '100%', maxWidth: '760px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#e8edf5' }}>📄 Relatório — {ticker} · {nome}</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {relatorio && <button onClick={copiar} style={{ background: 'rgba(232,160,32,.12)', border: '1px solid rgba(232,160,32,.3)', color: '#e8a020', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>⎘ Copiar</button>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b84a8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          {!relatorio && !loading && !erro && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: '32px', marginBottom: '16px' }}>🤖</p>
              <p style={{ color: '#b8c4d4', marginBottom: '8px' }}>O relatório é gerado pelo Claude (IA especializada em mercado B3).</p>
              <p style={{ color: '#6b84a8', fontSize: '13px', marginBottom: '28px' }}>Leva ~15-20 segundos. Baseado nos dados DCF calculados.</p>
              <button onClick={gerar} style={{ background: '#e8a020', color: '#000', fontWeight: 700, fontSize: '14px', padding: '12px 32px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                Gerar Relatório com IA
              </button>
            </div>
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid rgba(232,160,32,.15)', borderTopColor: '#e8a020', borderRadius: '50%', animation: 'spin .75s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#6b84a8' }}>Gerando relatório com Claude AI…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {erro && <p style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>{erro}</p>}
          {relatorio && (
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: '#b8c4d4' }}
                 dangerouslySetInnerHTML={{ __html: relatorio
                   .replace(/^### (.+)$/gm, '<h3 style="color:#e8a020;margin:20px 0 8px;font-size:14px;letter-spacing:.5px;text-transform:uppercase">$1</h3>')
                   .replace(/^## (.+)$/gm, '<h2 style="color:#e8edf5;margin:24px 0 10px;font-size:16px;font-weight:700">$1</h2>')
                   .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8edf5">$1</strong>')
                   .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
                   .replace(/\n\n/g, '<br/><br/>')
                 }} />
          )}
        </div>
      </div>
    </div>
  )
}

export default function DCFPage() {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [modalRelatorio, setModalRelatorio] = useState<string | null>(null)

  const emp = selecionado ? dcfData[selecionado] : null

  const metodoBadge = (m: string) => {
    const colors: Record<string, string> = { fcff: '#3b82f6', ddm: '#a855f7', sotp: '#f59e0b' }
    return colors[m?.toLowerCase()] ?? '#6b84a8'
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-inter),Inter,sans-serif;background:#050d1a;color:#e8edf5}
        .page{display:flex;height:calc(100vh - 44px)}
        /* Sidebar */
        .sidebar{width:280px;flex-shrink:0;background:#081120;border-right:1px solid rgba(255,255,255,.07);overflow-y:auto;display:flex;flex-direction:column}
        .sidebar-hdr{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.07)}
        .sidebar-hdr h2{font-size:13px;font-weight:700;color:#6b84a8;letter-spacing:1px;text-transform:uppercase}
        .sidebar-hdr p{font-size:11px;color:#3d4f6a;margin-top:4px}
        .emp-item{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .12s;display:flex;align-items:center;justify-content:space-between}
        .emp-item:hover{background:rgba(255,255,255,.04)}
        .emp-item.ativo{background:rgba(232,160,32,.08);border-left:3px solid #e8a020}
        .emp-ticker{font-weight:700;font-size:14px;color:#e8a020;font-family:var(--font-space),monospace}
        .emp-nome{font-size:11px;color:#6b84a8;margin-top:2px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .emp-upside{text-align:right}
        /* Main */
        .main{flex:1;overflow-y:auto;padding:28px 32px}
        .vazio{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#6b84a8;text-align:center}
        .vazio-icon{font-size:48px;margin-bottom:16px}
        .badge-method{display:inline-block;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-left:8px;vertical-align:middle}
        .sec-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#e8a020;margin-bottom:16px}
        .cenarios-row{display:flex;gap:12px;margin-bottom:28px}
        .params-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
        .param-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 16px}
        .param-label{font-size:10.5px;color:#6b84a8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .param-val{font-size:16px;font-weight:700;color:#e8edf5;font-family:var(--font-space),monospace}
        .projecao-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
        .projecao-item{background:rgba(255,255,255,.04);border-radius:6px;padding:8px 12px;text-align:center}
        .projecao-ano{font-size:10px;color:#6b84a8;margin-bottom:2px}
        .projecao-val{font-size:13px;font-weight:700;color:#e8edf5}
        .btn-relatorio{background:#e8a020;color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;border:none;cursor:pointer;transition:all .2s}
        .btn-relatorio:hover{background:#f5c55a;transform:translateY(-1px)}
      `}</style>

      <NavBar />

      <div className="page">
        {/* SIDEBAR — lista de empresas */}
        <div className="sidebar">
          <div className="sidebar-hdr">
            <h2>DCF / Valuation</h2>
            <p>{empresas.length} {empresas.length === 1 ? 'empresa analisada' : 'empresas analisadas'}</p>
          </div>

          {empresas.length === 0 ? (
            <div style={{ padding: '24px 20px', color: '#6b84a8', fontSize: '13px', textAlign: 'center' }}>
              <p style={{ marginBottom: '8px' }}>Nenhuma análise disponível.</p>
              <p style={{ fontSize: '11px' }}>Calcule no fundamento.py e rode <code>export_dcf.py</code></p>
            </div>
          ) : (
            empresas.map((e: any) => (
              <div key={e.ticker}
                   className={`emp-item${selecionado === e.ticker ? ' ativo' : ''}`}
                   onClick={() => setSelecionado(e.ticker)}>
                <div>
                  <div className="emp-ticker">{e.ticker}</div>
                  <div className="emp-nome" title={e.nome}>{e.nome}</div>
                </div>
                <div className="emp-upside">
                  <UpsideBar upside={e.base?.upside} />
                  <div style={{ fontSize: '10px', color: '#3d4f6a', marginTop: '2px' }}>base</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* MAIN — detalhes */}
        <div className="main">
          {!emp ? (
            <div className="vazio">
              <div className="vazio-icon">💹</div>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#e8edf5', marginBottom: '8px' }}>
                Selecione uma empresa
              </p>
              <p style={{ fontSize: '13px' }}>Escolha uma empresa na lista para ver a análise DCF completa.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <h1 style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: '28px', fontWeight: 700, color: '#e8a020' }}>
                    {emp.ticker}
                  </h1>
                  <span className="badge-method" style={{ background: `${metodoBadge(emp.method)}22`, color: metodoBadge(emp.method), border: `1px solid ${metodoBadge(emp.method)}44` }}>
                    {emp.method?.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: '16px', color: '#b8c4d4', marginBottom: '4px' }}>{emp.company}</p>
                <p style={{ fontSize: '12px', color: '#6b84a8' }}>
                  Análise: {emp.atualizado ?? '—'} · Preço no cálculo: R$ {f2(emp.preco_atual)}
                </p>
              </div>

              {/* Cenários Bear/Base/Bull */}
              <div className="sec-title">Cenários de Valuation</div>
              <div className="cenarios-row">
                <CenarioCard label="🔴 Pessimista (Bear)" color="#ef4444"
                  preco={emp.bear?.preco} upside={emp.bear?.upside} precoAtual={emp.preco_atual} />
                <CenarioCard label="🟡 Base" color="#e8a020"
                  preco={emp.base?.preco} upside={emp.base?.upside} precoAtual={emp.preco_atual} />
                <CenarioCard label="🟢 Otimista (Bull)" color="#00d4a0"
                  preco={emp.bull?.preco} upside={emp.bull?.upside} precoAtual={emp.preco_atual} />
              </div>

              {/* Parâmetros WACC */}
              <div className="sec-title">Parâmetros do Modelo</div>
              <div className="params-grid">
                {[
                  { label: 'WACC', val: emp.wacc != null ? f1(emp.wacc) + '%' : '—' },
                  { label: 'g Terminal', val: emp.g_terminal != null ? f1(emp.g_terminal) + '%' : '—' },
                  { label: 'Ke (Custo Capital)', val: emp.wacc_ke != null ? f1(emp.wacc_ke) + '%' : '—' },
                  { label: 'Rf (NTN-B)', val: emp.wacc_rf != null ? f1(emp.wacc_rf) + '%' : '—' },
                  { label: 'Beta', val: emp.wacc_beta != null ? f2(emp.wacc_beta) : '—' },
                  { label: 'ERP Brasil', val: emp.wacc_erp != null ? f1(emp.wacc_erp) + '%' : '—' },
                ].map(p => (
                  <div key={p.label} className="param-card">
                    <div className="param-label">{p.label}</div>
                    <div className="param-val">{p.val}</div>
                  </div>
                ))}
              </div>

              {/* Projeção de crescimento */}
              {emp.g_receita?.length > 0 && (
                <>
                  <div className="sec-title">Crescimento de Receita Projetado</div>
                  <div className="projecao-row" style={{ marginBottom: '28px' }}>
                    {(emp.g_receita as number[]).map((g, i) => (
                      <div key={i} className="projecao-item">
                        <div className="projecao-ano">Ano {i + 1}</div>
                        <div className="projecao-val" style={{ color: '#00d4a0' }}>{g != null ? f1(g) + '%' : '—'}</div>
                      </div>
                    ))}
                    <div className="projecao-item">
                      <div className="projecao-ano">Terminal</div>
                      <div className="projecao-val" style={{ color: '#e8a020' }}>{f1(emp.g_terminal)}%</div>
                    </div>
                  </div>
                </>
              )}

              {/* Margens EBITDA */}
              {emp.mg_ebitda?.length > 0 && (
                <>
                  <div className="sec-title">Margens EBITDA Projetadas</div>
                  <div className="projecao-row" style={{ marginBottom: '28px' }}>
                    {(emp.mg_ebitda as number[]).map((m, i) => (
                      <div key={i} className="projecao-item">
                        <div className="projecao-ano">Ano {i + 1}</div>
                        <div className="projecao-val">{m != null ? f1(m) + '%' : '—'}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Botão relatório */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '24px' }}>
                <p style={{ fontSize: '13px', color: '#6b84a8', marginBottom: '16px' }}>
                  Gere um relatório completo com análise fundamentalista, tese de investimento e riscos — elaborado pela IA Claude.
                </p>
                <button className="btn-relatorio" onClick={() => setModalRelatorio(emp.ticker)}>
                  📄 Gerar Relatório com IA
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {modalRelatorio && (
        <ModalRelatorio
          ticker={modalRelatorio}
          nome={dcfData[modalRelatorio]?.nome ?? modalRelatorio}
          onClose={() => setModalRelatorio(null)}
        />
      )}
    </>
  )
}
