import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.VERCEL === '1') {
      return [
        {
          source: '/api/hub/:path*',
          destination: 'https://hub.paratechsolucoes.com.br/api/hub/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
