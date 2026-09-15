import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Manual de Uso — Finanças Pessoais | Radar Invest Pro',
  description: 'Guia completo do módulo de Finanças Pessoais: como importar extratos, categorizar gastos, visualizar resumos e gráficos.',
}

const MANUAL_URL = '/ajuda'

function Section({ id, num, icon, title, children, color = 'gold' }: {
  id: string; num: string; icon: string; title: string; children: React.ReactNode; color?: 'gold'|'green'|'blue'
}) {
  const colors = {
    gold:  { bg: 'rgba(234,184,56,.12)',  border: 'rgba(234,184,56,.3)',  text: '#eab838' },
    green: { bg: 'rgba(34,197,94,.12)',   border: 'rgba(34,197,94,.3)',   text: '#22c55e' },
    blue:  { bg: 'rgba(59,130,246,.12)',  border: 'rgba(59,130,246,.3)',  text: '#3b82f6' },
  }
  const c = colors[color]
  return (
    <section id={id} style={{ marginBottom: 52, scrollMarginTop: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {num}
        </div>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: 19, fontWeight: 700, color: '#e8edf5', margin: 0 }}>{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0d1a2e', border: '2px solid #eab838', color: '#eab838', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        {num}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#e8edf5', marginBottom: 4, fontSize: 14 }}>{title}</div>
        <div style={{ color: '#6b84a8', fontSize: 13.5 }} dangerouslySetInnerHTML={{ __html: desc }} />
      </div>
    </div>
  )
}

function Box({ type, icon, children }: { type: 'tip'|'info'|'warn'|'ok'; icon: string; children: React.ReactNode }) {
  const styles = {
    tip:  { bg: 'rgba(234,184,56,.07)', border: 'rgba(234,184,56,.2)' },
    info: { bg: 'rgba(59,130,246,.07)', border: 'rgba(59,130,246,.2)' },
    warn: { bg: 'rgba(239,68,68,.07)',  border: 'rgba(239,68,68,.2)' },
    ok:   { bg: 'rgba(34,197,94,.07)',  border: 'rgba(34,197,94,.2)' },
  }
  const s = styles[type]
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '12px 16px', margin: '14px 0', display: 'flex', gap: 12, fontSize: 13.5 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ color: '#6b84a8' }}>{children}</div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'green'|'red'|'gold'|'blue' }) {
  const c = { green: ['rgba(34,197,94,.15)','#22c55e'], red: ['rgba(239,68,68,.15)','#ef4444'], gold: ['rgba(234,184,56,.15)','#eab838'], blue: ['rgba(59,130,246,.15)','#3b82f6'] }
  return <span style={{ background: c[color][0], color: c[color][1], borderRadius: 100, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{label}</span>
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#6b84a8', borderBottom: '2px solid rgba(255,255,255,.08)' }}>{children}</th>
}
function Td({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', color: gold ? '#eab838' : '#6b84a8', fontWeight: gold ? 600 : 400, verticalAlign: 'top' }}>{children}</td>
}

const NAV_ITEMS = [
  { href: '#visao-geral',         label: 'Visão Geral' },
  { href: '#requisitos',          label: 'Requisitos' },
  { href: '#importar',            label: '📥 Importar Extrato' },
  { href: '#transacoes',          label: '📋 Transações' },
  { href: '#resumo',              label: '📊 Resumo' },
  { href: '#graficos',            label: '📈 Gráficos' },
  { href: '#lancamento-manual',   label: '✏️ Lançamento Manual' },
  { href: '#categorias',          label: '🏷️ Categorias' },
  { href: '#exportar',            label: '📤 Exportar Excel' },
  { href: '#batches',             label: '🗂️ Histórico de Importações' },
  { href: '#dicas',               label: '💡 Dicas' },
  { href: '#faq',                 label: '❓ Perguntas Frequentes' },
]

export default function AjudaPage() {
  const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 14 }

  return (
    <div style={{ background: '#050d1a', minHeight: '100vh', color: '#e8edf5', fontFamily: 'Inter,sans-serif' }}>
      <NavBar />

      {/* Top bar */}
      <div style={{ background: '#080e1c', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '0 24px', height: 42, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/" style={{ textDecoration: 'none', fontSize: 12, color: '#6b84a8' }}>Início</Link>
        <span style={{ color: '#3d4f6a' }}>›</span>
        <span style={{ fontSize: 12, color: '#e8a020', fontWeight: 600 }}>Manual — Finanças Pessoais</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#3d4f6a' }}>v1.0 · Set/2026</span>
      </div>

      <div style={{ display: 'flex', maxWidth: 1100, margin: '0 auto' }}>

        {/* Sidebar */}
        <nav style={{ width: 230, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.07)', padding: '24px 0', position: 'sticky', top: 86, height: 'calc(100vh - 86px)', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#3d4f6a', padding: '0 20px 8px' }}>Conteúdo</div>
          {NAV_ITEMS.map(item => (
            <a key={item.href} href={item.href} style={{ display: 'block', padding: '7px 20px', fontSize: 12.5, color: '#6b84a8', textDecoration: 'none', borderLeft: '2px solid transparent', transition: 'all .15s' }}
               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#eab838'; (e.currentTarget as HTMLElement).style.borderLeftColor = '#eab838'; (e.currentTarget as HTMLElement).style.background = 'rgba(234,184,56,.06)' }}
               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6b84a8'; (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Content */}
        <main style={{ flex: 1, padding: '40px 48px 80px', minWidth: 0 }}>

          {/* Hero */}
          <div style={{ background: 'linear-gradient(135deg,rgba(234,184,56,.08) 0%,transparent 60%)', border: '1px solid rgba(234,184,56,.15)', borderRadius: 16, padding: '32px 36px', marginBottom: 48, display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ fontSize: 52, flexShrink: 0 }}>💰</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#eab838', marginBottom: 6 }}>Guia completo</div>
              <h1 style={{ fontFamily: 'var(--font-space),Space Grotesk,sans-serif', fontSize: 26, fontWeight: 700, color: '#e8edf5', margin: '0 0 8px', lineHeight: 1.2 }}>Módulo Finanças Pessoais</h1>
              <p style={{ color: '#6b84a8', margin: 0, fontSize: 14 }}>Importe extratos, categorize gastos e tenha controle total sobre seu dinheiro em um único painel.</p>
            </div>
          </div>

          {/* 1 — Visão Geral */}
          <Section id="visao-geral" num="1" icon="🗺️" title="Visão Geral">
            <p style={{ color: '#6b84a8', marginTop: 0 }}>O módulo de <strong style={{ color: '#e8edf5' }}>Finanças Pessoais</strong> centraliza o controle financeiro da família sem planilhas complicadas. Ele possui 4 abas:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12, marginTop: 16 }}>
              {[
                { icon: '📥', title: 'Importar', desc: 'Suba o extrato do seu banco (OFX/CSV) e o sistema categoriza os lançamentos automaticamente.' },
                { icon: '📋', title: 'Transações', desc: 'Visualize, filtre, edite categorias e datas de todos os lançamentos importados.' },
                { icon: '📊', title: 'Resumo', desc: 'Cards com entradas, despesas, fatura de cartão e saldo final — por período.' },
                { icon: '📈', title: 'Gráficos', desc: 'Evolução mensal e top categorias de gastos em gráficos visuais.' },
              ].map(f => (
                <div key={f.title} style={{ background: '#0d1a2e', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, color: '#e8edf5', fontSize: 13, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: '#6b84a8', fontSize: 12, lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* 2 — Requisitos */}
          <Section id="requisitos" num="2" icon="🔑" title="Requisitos de Acesso">
            <p style={{ color: '#6b84a8', marginTop: 0 }}>Disponível a partir do plano <strong style={{ color: '#eab838' }}>Starter</strong>. Usuários sem plano elegível veem a tela de upgrade ao acessar o módulo.</p>
            <table style={tbl}>
              <thead><tr><Th>Plano</Th><Th>Acesso</Th></tr></thead>
              <tbody>
                <tr><Td gold>Gratuito</Td><Td><Badge label="Bloqueado" color="red" /></Td></tr>
                <tr><Td gold>Starter</Td><Td><Badge label="Liberado" color="green" /></Td></tr>
                <tr><Td gold>Essencial / Pro / Analista</Td><Td><Badge label="Liberado" color="green" /></Td></tr>
              </tbody>
            </table>
            <Box type="info" icon="ℹ️">
              A aba <strong style={{ color: '#e8edf5' }}>Finanças</strong> aparece na barra de navegação para todos os usuários. Clique em <strong style={{ color: '#e8edf5' }}><a href="/planos" style={{ color: '#eab838' }}>Ver planos</a></strong> para fazer upgrade.
            </Box>
          </Section>

          {/* 3 — Importar */}
          <Section id="importar" num="3" icon="📥" title="Aba Importar — Como Importar seu Extrato" color="green">
            <p style={{ color: '#6b84a8', marginTop: 0 }}>Faça o upload do extrato bancário e revise antes de confirmar a importação.</p>
            <Step num={1} title="Configure o Saldo Inicial" desc="Antes da primeira importação, vá à aba <strong style='color:#e8edf5'>Resumo</strong> e defina o <strong style='color:#eab838'>Saldo Inicial</strong> da sua conta. Esse valor é a base para o cálculo do Caixa Final. Sem ele, o saldo exibido não vai refletir a realidade." />
            <Step num={2} title="Selecione o banco" desc="Escolha o banco do extrato na lista: Bradesco, Itaú, Nubank, Santander, Caixa, BB, Inter, C6, XP, Sicredi ou Outro." />
            <Step num={3} title="Escolha o tipo de extrato" desc="Selecione <strong style='color:#e8edf5'>Conta Corrente</strong> ou <strong style='color:#e8edf5'>Fatura de Cartão</strong>. A distinção evita dupla contagem nos totais." />
            <Step num={4} title="Faça o upload do arquivo" desc="Clique em <strong style='color:#e8edf5'>Selecionar arquivo</strong> e escolha seu extrato. Formatos aceitos: OFX e CSV." />
            <Step num={5} title="Revise o preview" desc="O sistema exibe todos os lançamentos detectados com data, histórico, tipo e valor. Confirme se estão corretos." />
            <Step num={6} title="Confirme a importação" desc="Clique em <strong style='color:#e8edf5'>Confirmar importação</strong>. Os dados ficam disponíveis imediatamente em todas as abas." />
            <Box type="warn" icon="⚠️">
              <strong style={{ color: '#e8edf5' }}>Não importe o mesmo extrato duas vezes.</strong> Isso gera duplicidade nos totais. Verifique o histórico de importações antes de subir um novo arquivo.
            </Box>
            <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#e8edf5', margin: '24px 0 10px' }}>Tipos de lançamento</h3>
            <table style={tbl}>
              <thead><tr><Th>Tipo</Th><Th>Quando aparece</Th><Th>Impacto no saldo</Th></tr></thead>
              <tbody>
                <tr><Td gold><Badge label="Receita" color="green" /></Td><Td>Entradas na conta (salário, Pix recebido)</Td><Td>Soma ao total de entradas</Td></tr>
                <tr><Td gold><Badge label="Despesa" color="red" /></Td><Td>Saídas diretas da conta corrente</Td><Td>Subtrai das saídas</Td></tr>
                <tr><Td gold><Badge label="Pgto Cartão" color="gold" /></Td><Td>Pagamento da fatura do cartão</Td><Td>Registrado separado para não duplicar</Td></tr>
              </tbody>
            </table>
          </Section>

          {/* 4 — Transações */}
          <Section id="transacoes" num="4" icon="📋" title="Aba Transações — Gerenciar Lançamentos" color="blue">
            <p style={{ color: '#6b84a8', marginTop: 0 }}>Visualize e gerencie todos os lançamentos com filtros avançados, edição de categorias e ordenação por coluna.</p>
            <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#e8edf5', margin: '0 0 10px' }}>Filtros disponíveis</h3>
            <table style={tbl}>
              <thead><tr><Th>Filtro</Th><Th>O que faz</Th></tr></thead>
              <tbody>
                {[
                  ['Período','Filtra por mês/ano (ex: 2026-08). Deixe em branco para ver todos.'],
                  ['Categoria','Filtra por categoria de gasto (Alimentação, Saúde, etc.)'],
                  ['Tipo','Receita, Despesa ou Pagamento de Cartão'],
                  ['Extrato','Conta Corrente ou Fatura Cartão'],
                  ['Banco','Filtra por banco específico importado'],
                  ['Busca','Busca livre no histórico/descrição do lançamento'],
                ].map(([f, d]) => <tr key={f}><Td gold>{f}</Td><Td>{d}</Td></tr>)}
              </tbody>
            </table>
            <Box type="tip" icon="💡">
              <strong style={{ color: '#e8edf5' }}>Ordenação:</strong> clique no cabeçalho de qualquer coluna (Data, Valor, Tipo, Categoria, Banco, Histórico) para ordenar. Clique novamente para inverter.
            </Box>
            <Box type="info" icon="ℹ️">
              <strong style={{ color: '#e8edf5' }}>Ignorar lançamento:</strong> marque <em>Ignorar</em> em estornos, transferências internas ou entradas que não representam receita real. O lançamento fica no banco mas é excluído dos totais.
            </Box>
          </Section>

          {/* 5 — Resumo */}
          <Section id="resumo" num="5" icon="📊" title="Aba Resumo — Entendendo os Totais">
            <Box type="warn" icon="⚠️">
              <strong style={{ color: '#e8edf5' }}>Configure o Saldo Inicial antes de qualquer coisa.</strong> Clique no ícone de lápis ao lado de <em>Saldo Inicial</em> na aba Resumo e informe o saldo atual da sua conta corrente. Esse valor é usado para calcular o <strong style={{ color: '#e8edf5' }}>Caixa Final</strong>.
            </Box>
            <p style={{ color: '#6b84a8' }}>Os 7 cards mostram as principais métricas do período selecionado:</p>
            <table style={tbl}>
              <thead><tr><Th>Card</Th><Th>Fórmula / Origem</Th></tr></thead>
              <tbody>
                {[
                  ['Entradas','Soma de todos os lançamentos do tipo Receita'],
                  ['Saídas Conta','Soma das Despesas diretas da conta corrente'],
                  ['Fatura Cartão','Total da fatura importada do cartão'],
                  ['Pgto Cartão','Valor pago para quitar a fatura (evita dupla contagem)'],
                  ['Total Despesas','Saídas Conta + Fatura Cartão'],
                  ['Rec. × Desp.','Entradas − Total Despesas (positivo = sobrou)'],
                  ['Caixa Final','Saldo Inicial + Entradas − Saídas Conta − Pgto Cartão'],
                ].map(([c, f]) => <tr key={c}><Td gold>{c}</Td><Td>{f}</Td></tr>)}
              </tbody>
            </table>
          </Section>

          {/* 6 — Gráficos */}
          <Section id="graficos" num="6" icon="📈" title="Aba Gráficos — Análise Visual" color="green">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              {[
                { icon: '📊', title: 'Evolução Mensal', desc: 'Barras com entradas (verde) e saídas (vermelho) mês a mês. Identifique rapidamente os meses de déficit.' },
                { icon: '🏷️', title: 'Top Categorias', desc: 'Ranking das categorias que mais consumiram no período, com valor e percentual do total.' },
              ].map(f => (
                <div key={f.title} style={{ background: '#0d1a2e', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, color: '#e8edf5', fontSize: 13, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: '#6b84a8', fontSize: 12.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <Box type="tip" icon="💡">Use o painel de categorias para selecionar apenas as que deseja analisar e compare períodos diferentes para identificar padrões.</Box>
          </Section>

          {/* 7 — Lançamento Manual */}
          <Section id="lancamento-manual" num="7" icon="✏️" title="Lançamento Manual" color="blue">
            <p style={{ color: '#6b84a8', marginTop: 0 }}>Adicione lançamentos individualmente — útil para gastos em dinheiro ou correções pontuais.</p>
            <Step num={1} title="Acesse a aba Transações" desc="Clique em <strong style='color:#e8edf5'>+ Novo lançamento</strong> no canto superior direito." />
            <Step num={2} title="Preencha os dados" desc="Um painel se abre com os campos: Data, Histórico, Valor, Tipo de lançamento, Tipo de extrato, Categoria e Banco." />
            <Step num={3} title="Salve" desc="Clique em <strong style='color:#e8edf5'>Salvar lançamento</strong>. O registro aparece na tabela e é incluído nos cálculos imediatamente." />
          </Section>

          {/* 8 — Categorias */}
          <Section id="categorias" num="8" icon="🏷️" title="Gerenciar Categorias">
            <ul style={{ color: '#6b84a8', paddingLeft: 20, lineHeight: 2, marginTop: 8 }}>
              <li>Acesse <strong style={{ color: '#e8edf5' }}>Gerenciar Categorias</strong> na aba Transações</li>
              <li>Crie categorias personalizadas: "Escola dos filhos", "Academia", "Delivery"…</li>
              <li>Renomeie categorias existentes — todos os lançamentos vinculados são atualizados</li>
            </ul>
            <Box type="ok" icon="✅">
              Sugestão: <strong style={{ color: '#e8edf5' }}>Alimentação · Saúde · Educação · Transporte · Lazer · Moradia · Vestuário · Assinaturas · Investimentos · Outros</strong>
            </Box>
          </Section>

          {/* 9 — Exportar */}
          <Section id="exportar" num="9" icon="📤" title="Exportar para Excel" color="green">
            <Step num={1} title="Aplique os filtros desejados" desc="Período, categoria, banco — o arquivo exportado reflete exatamente o que está visível." />
            <Step num={2} title='Clique em "Exportar Excel"' desc='O download do arquivo <code style="background:#0d1a2e;padding:2px 6px;border-radius:4px;font-size:12px">transacoes_AAAA-MM-DD.csv</code> inicia automaticamente.' />
            <Step num={3} title="Abra no Excel" desc="O arquivo já inclui BOM UTF-8 — sem problemas de acentuação. Colunas: Data, Histórico, Banco, Categoria, Tipo, Extrato, Valor, Ignorado." />
          </Section>

          {/* 10 — Batches */}
          <Section id="batches" num="10" icon="🗂️" title="Histórico de Importações" color="blue">
            <p style={{ color: '#6b84a8', marginTop: 0 }}>Cada importação gera um <em>batch</em> rastreável. Acompanhe o que já foi carregado e reverta se necessário.</p>
            <table style={tbl}>
              <thead><tr><Th>Coluna</Th><Th>O que informa</Th></tr></thead>
              <tbody>
                {[
                  ['Banco','Banco de origem do extrato importado'],
                  ['Importado em','Data e hora da importação'],
                  ['Lançamentos','Quantidade de registros importados naquele lote'],
                  ['Período','Data inicial e final dos lançamentos do lote'],
                  ['Status','Ativo ou Revertido'],
                ].map(([c, d]) => <tr key={c}><Td gold>{c}</Td><Td>{d}</Td></tr>)}
              </tbody>
            </table>
            <Box type="warn" icon="⚠️">
              <strong style={{ color: '#e8edf5' }}>Reverter importação</strong> remove permanentemente todos os lançamentos daquele batch. Não é possível desfazer.
            </Box>
          </Section>

          {/* 11 — Dicas */}
          <Section id="dicas" num="11" icon="💡" title="Dicas e Boas Práticas">
            <ul style={{ color: '#6b84a8', paddingLeft: 20, lineHeight: 2.1, marginTop: 8 }}>
              {[
                <><strong style={{ color: '#e8edf5' }}>Configure o Saldo Inicial</strong> antes de importar o primeiro extrato — é a base do Caixa Final.</>,
                <><strong style={{ color: '#e8edf5' }}>Importe mensalmente</strong> — crie o hábito de fazer o upload no início de cada mês.</>,
                <><strong style={{ color: '#e8edf5' }}>Importe separado</strong> — um batch para conta corrente, outro para cada cartão de crédito.</>,
                <><strong style={{ color: '#e8edf5' }}>Categorize tudo</strong> — lançamentos sem categoria ficam como "Outros" e distorcem os gráficos.</>,
                <><strong style={{ color: '#e8edf5' }}>Use "Ignorar"</strong> para estornos, devoluções e transferências entre contas próprias.</>,
                <><strong style={{ color: '#e8edf5' }}>Verifique o histórico</strong> antes de importar um novo arquivo para não duplicar períodos.</>,
                <><strong style={{ color: '#e8edf5' }}>Exporte mensalmente</strong> para Excel para manter um backup local dos seus dados.</>,
              ].map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </Section>

          {/* 12 — FAQ */}
          <Section id="faq" num="12" icon="❓" title="Perguntas Frequentes" color="green">
            {[
              { q: 'Quais formatos de arquivo são aceitos?', a: 'O módulo aceita OFX (padrão exportado pela maioria dos bancos) e CSV. Se o seu banco não oferece OFX, procure pela opção "Exportar extrato" no internet banking.' },
              { q: 'Posso importar extratos de vários bancos?', a: 'Sim. Importe um arquivo por vez, selecionando o banco correto. Todos os lançamentos ficam unificados na aba Transações e podem ser filtrados por banco.' },
              { q: 'O pagamento da fatura aparece duas vezes?', a: 'Não, se importar corretamente. O Pagamento de Cartão (saída da conta) e a Fatura (despesas do cartão) são contabilizados separadamente para evitar dupla contagem.' },
              { q: 'O que acontece se eu reverter uma importação?', a: 'Todos os lançamentos daquele batch são removidos permanentemente. Não é possível desfazer.' },
              { q: 'Posso editar a data de um lançamento importado?', a: 'Sim. Clique em Editar na linha do lançamento e altere a data diretamente na tabela.' },
              { q: 'Os dados são seguros?', a: 'Sim. Todas as informações são armazenadas nos servidores do Radar Invest Pro. Apenas você tem acesso aos seus dados — nenhuma informação é compartilhada com terceiros.' },
            ].map(({ q, a }) => (
              <details key={q} style={{ background: '#0d1a2e', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, marginBottom: 8 }}>
                <summary style={{ padding: '12px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13.5, color: '#e8edf5', listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
                  {q} <span style={{ color: '#eab838' }}>▾</span>
                </summary>
                <div style={{ padding: '12px 18px', color: '#6b84a8', fontSize: 13.5, borderTop: '1px solid rgba(255,255,255,.07)' }}>{a}</div>
              </details>
            ))}
          </Section>

          {/* Footer */}
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#3d4f6a' }}>
            <span>Manual Finanças Pessoais · v1.0 · Setembro de 2026</span>
            <span style={{ color: '#eab838' }}>radarinvestpro.com.br</span>
          </div>

        </main>
      </div>
    </div>
  )
}
