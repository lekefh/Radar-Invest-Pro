import type { MetadataRoute } from 'next'

const SITE = 'https://www.radarinvestpro.com.br'

// Páginas públicas (as protegidas pelo middleware ficam de fora)
const PAGINAS: { rota: string; prioridade: number; frequencia: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { rota: '',                 prioridade: 1.0, frequencia: 'weekly' },
  { rota: '/oferta-financas', prioridade: 0.9, frequencia: 'weekly' },
  { rota: '/planos',          prioridade: 0.9, frequencia: 'monthly' },
  { rota: '/cadastro',        prioridade: 0.8, frequencia: 'monthly' },
  { rota: '/dividendos',      prioridade: 0.8, frequencia: 'daily' },
  { rota: '/teses',           prioridade: 0.8, frequencia: 'weekly' },
  { rota: '/noticias',        prioridade: 0.7, frequencia: 'daily' },
  { rota: '/financas',        prioridade: 0.7, frequencia: 'monthly' },
  { rota: '/ir',              prioridade: 0.6, frequencia: 'monthly' },
  { rota: '/oferta',          prioridade: 0.6, frequencia: 'monthly' },
  { rota: '/ajuda',           prioridade: 0.4, frequencia: 'monthly' },
  { rota: '/privacidade',     prioridade: 0.2, frequencia: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date()
  return PAGINAS.map(p => ({
    url: `${SITE}${p.rota}`,
    lastModified: agora,
    changeFrequency: p.frequencia,
    priority: p.prioridade,
  }))
}
