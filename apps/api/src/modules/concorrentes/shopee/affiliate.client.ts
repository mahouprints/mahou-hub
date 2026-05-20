import { Logger } from '@nestjs/common';
import { buildAuthorizationHeader, signRequest } from './signature.util';

/**
 * Cliente HTTP da Shopee Affiliate GraphQL.
 * Timeout 10s, retry exponencial em 5xx/network (1s, 2s, 4s).
 */
export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
};

type ClientConfig = {
  endpoint: string;
  appId: string;
  secret: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export class ShopeeAffiliateClient {
  private readonly log = new Logger(ShopeeAffiliateClient.name);
  private readonly endpoint: string;
  private readonly appId: string;
  private readonly secret: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(cfg: ClientConfig) {
    this.endpoint = cfg.endpoint;
    this.appId = cfg.appId;
    this.secret = cfg.secret;
    this.timeoutMs = cfg.timeoutMs ?? 10_000;
    this.maxRetries = cfg.maxRetries ?? 3;
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<GraphQLResponse<T>> {
    const payload = JSON.stringify({ query, variables });
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.attempt<T>(payload);
      } catch (err) {
        lastErr = err;
        const retryable = this.isRetryable(err);
        if (!retryable || attempt === this.maxRetries) break;
        const waitMs = 1000 * 2 ** attempt;
        this.log.warn(`Affiliate query falhou (tentativa ${attempt + 1}/${this.maxRetries + 1}), retry em ${waitMs}ms: ${err instanceof Error ? err.message : err}`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Affiliate query falhou');
  }

  private async attempt<T>(payload: string): Promise<GraphQLResponse<T>> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signRequest(this.appId, this.secret, payload, timestamp);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthorizationHeader(this.appId, signature, timestamp),
        },
        body: payload,
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Affiliate HTTP ${res.status}: ${text.slice(0, 300)}`);
      return JSON.parse(text) as GraphQLResponse<T>;
    } finally {
      clearTimeout(tid);
    }
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof Error) {
      if (err.name === 'AbortError') return true;
      if (err.message.includes('HTTP 5')) return true;
      if (err.message.includes('ECONN') || err.message.includes('fetch failed')) return true;
    }
    return false;
  }
}
