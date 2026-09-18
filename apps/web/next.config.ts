import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mahou-hub/pricing', '@mahou-hub/contracts'],
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    // Frontend chama /api/<path>, traduzimos pra /api/v1/<path>. Mantém o web
    // alheio à versão — quando subir v2, basta trocar o destination aqui.
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/v1/:path*` }];
  },
};

export default config;
