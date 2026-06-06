import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })

export const metadata: Metadata = {
  title: 'Radar Invest Pro — Análise como Gestores de Fundo',
  description:
    'Democratizamos a análise de ações da B3 com DCF, fundamentos e peso correto de carteira — as mesmas ferramentas que grandes gestores de fundo utilizam.',
  keywords:
    'análise de ações B3, DCF valuation, análise fundamentalista, carteira de investimentos, gestores de fundo',
  openGraph: {
    type: 'website',
    url: 'https://radarinvestpro.com.br/',
    title: 'Radar Invest Pro — Análise como Gestores de Fundo',
    description:
      'DCF, fundamentos e peso correto de carteira — as ferramentas dos grandes gestores, agora para o investidor individual.',
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${space.variable}`}>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23050d1a'/><circle cx='16' cy='16' r='4' fill='%23e8a020'/><circle cx='16' cy='16' r='8' fill='none' stroke='%23e8a020' stroke-width='1.5' opacity='.6'/><circle cx='16' cy='16' r='13' fill='none' stroke='%23e8a020' stroke-width='1' opacity='.3'/></svg>"
        />
        {/* Google Analytics 4 */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-2B5Y9F2HDJ" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-2B5Y9F2HDJ');
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
