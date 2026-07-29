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
  async redirects() {
    // A lista de produtos virou a Vitrine. Sem isso, favorito e aba aberta em
    // /produtos caem num 404 do Next — que renderiza fora do layout, sem sidebar
    // e sem caminho de volta. Permanente porque a página não vai voltar.
    // Só a listagem: /produtos/novo e /produtos/:id seguem vivos como destino da
    // Calculadora e das Oportunidades.
    return [{ source: '/produtos', destination: '/vitrine', permanent: true }];
  },
};

export default config;
