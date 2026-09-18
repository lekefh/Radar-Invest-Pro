import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/oferta',
        destination: '/oferta.html',
      },
    ]
  },
}

export default nextConfig
