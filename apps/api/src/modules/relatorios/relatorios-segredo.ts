import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function chave() {
  const jwt = process.env.JWT_SECRET;
  if (!jwt) throw new Error('JWT_SECRET obrigatório para proteger a integração Google');
  return createHash('sha256').update(`mahou-relatorios:${jwt}`).digest();
}

/** Protege a chave de integração em repouso usando a chave já privada do servidor. */
export function cifrarSegredo(segredo = randomBytes(32).toString('hex')) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave(), iv);
  const corpo = Buffer.concat([cipher.update(segredo, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), corpo].map((v) => v.toString('base64url')).join('.');
}

export function decifrarSegredo(valor: string) {
  const partes = valor.split('.').map((v) => Buffer.from(v, 'base64url'));
  const [iv, tag, corpo] = partes;
  if (!iv || !tag || !corpo) throw new Error('Chave da integração inválida');
  const cipher = createDecipheriv('aes-256-gcm', chave(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(corpo), cipher.final()]).toString('utf8');
}
