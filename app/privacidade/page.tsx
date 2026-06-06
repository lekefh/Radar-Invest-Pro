export default function PoliticaPrivacidade() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-gray-500 mb-8">Última atualização: junho de 2026</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">1. Quem somos</h2>
        <p>
          Radar Invest Pro é uma plataforma de análise de investimentos para ações e FIIs listados na B3,
          desenvolvida por Alex Faria (CNPJ/CPF do responsável). Site:{" "}
          <a href="https://radarinvestpro.com.br" className="text-blue-600 underline">
            radarinvestpro.com.br
          </a>
          . Contato:{" "}
          <a href="mailto:contato@radarinvestpro.com.br" className="text-blue-600 underline">
            contato@radarinvestpro.com.br
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">2. Dados que coletamos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nome e e-mail fornecidos no cadastro</li>
          <li>Dados de uso da plataforma (páginas acessadas, funcionalidades utilizadas)</li>
          <li>Informações de pagamento processadas pelo Mercado Pago (não armazenamos dados de cartão)</li>
          <li>Dados de analytics agregados (via Vercel Analytics) sem identificação individual</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">3. Como usamos os dados</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Autenticação e controle de acesso à plataforma</li>
          <li>Envio de notificações sobre alertas de carteira e novos resultados</li>
          <li>Melhoria contínua das funcionalidades</li>
          <li>Cumprimento de obrigações legais</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">4. Compartilhamento de dados</h2>
        <p>
          Não vendemos nem compartilhamos dados pessoais com terceiros, exceto fornecedores de serviço
          essenciais (hospedagem Vercel, pagamento Mercado Pago) e quando exigido por lei.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">5. Cookies e rastreamento</h2>
        <p>
          Utilizamos cookies estritamente necessários para autenticação. Utilizamos Vercel Analytics para
          métricas agregadas de uso — sem cookies de rastreamento de terceiros.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">6. Seus direitos (LGPD)</h2>
        <p>
          Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a qualquer momento
          pelo e-mail{" "}
          <a href="mailto:contato@radarinvestpro.com.br" className="text-blue-600 underline">
            contato@radarinvestpro.com.br
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">7. Retenção de dados</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão da conta, os dados são
          apagados em até 30 dias, salvo obrigação legal de retenção.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">8. Alterações nesta política</h2>
        <p>
          Alterações relevantes serão comunicadas por e-mail ou notificação na plataforma com antecedência
          mínima de 15 dias.
        </p>
      </section>
    </main>
  );
}
