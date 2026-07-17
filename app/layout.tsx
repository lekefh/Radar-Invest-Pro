import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })

export const metadata: Metadata = {
  title: 'Radar Invest Pro — Análise como um Profissional de Mercado',
  description:
    'Democratizamos a análise de ações da B3 com DCF, fundamentos e peso correto de carteira — as mesmas ferramentas que grandes profissionais de mercado utilizam.',
  keywords:
    'análise de ações B3, DCF valuation, análise fundamentalista, carteira de investimentos, profissionais de mercado',
  openGraph: {
    type: 'website',
    url: 'https://radarinvestpro.com.br/',
    title: 'Radar Invest Pro — Análise como um Profissional de Mercado',
    description:
      'DCF, fundamentos e peso correto de carteira — as ferramentas dos grandes profissionais de mercado, agora para o investidor individual.',
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
        {/* Meta Pixel */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
              n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','1042027531710717');
              fbq('track','PageView');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{display:'none'}}
            src="https://www.facebook.com/tr?id=1042027531710717&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
