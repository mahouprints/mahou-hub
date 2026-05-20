// Cliente da Shopee Affiliate Open Platform.
// Autenticação: header `Authorization: SHA256 Credential={AppId}, Signature={SHA256(AppId+Timestamp+Payload+Secret)}, Timestamp={Timestamp}`.
// Timestamp em segundos epoch. Payload é o corpo JSON exatamente como enviado.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function loadDotEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = '';
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...loadDotEnv(resolve(here, '../.env')), ...process.env };

const APP_ID = required('SHOPEE_AFFILIATE_APP_ID');
const SECRET = required('SHOPEE_AFFILIATE_SECRET');
const ENDPOINT = env.SHOPEE_AFFILIATE_ENDPOINT ?? 'https://open-api.affiliate.shopee.com.br/graphql';

function required(name: string): string {
  const v = env[name];
  if (!v) throw new Error(`Variável ${name} não definida em scripts/shopee-affiliate/.env`);
  return v;
}

function signRequest(payload: string, timestamp: number): string {
  const base = `${APP_ID}${timestamp}${payload}${SECRET}`;
  return createHash('sha256').update(base).digest('hex');
}

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
  const payload = JSON.stringify({ query, variables: variables ?? {} });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signRequest(payload, timestamp);
  const authorization = `SHA256 Credential=${APP_ID}, Signature=${signature}, Timestamp=${timestamp}`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: payload,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — corpo: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as GraphQLResponse<T>;
  } catch {
    throw new Error(`Resposta não-JSON: ${text.slice(0, 500)}`);
  }
}
