import type { MetadataRoute } from 'next'

const SITE = 'https://www.radarinvestpro.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/', '/admin', '/dashboard', '/carteira', '/dcf',
        '/completar-perfil', '/confirmar-email', '/esqueci-senha', '/redefinir-senha',
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
