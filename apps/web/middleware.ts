import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protege as rotas do grupo (app) — redireciona para /login quando não há
 * cookie de sessão. Não valida o JWT aqui (a API faz isso); só checa presença.
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get('mahou_token')?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/calculadora/:path*',
    '/produtos/:path*',
    '/simulador/:path*',
    '/producao/:path*',
    '/concorrentes/:path*',
    '/oportunidades/:path*',
    '/configuracoes/:path*',
  ],
};
