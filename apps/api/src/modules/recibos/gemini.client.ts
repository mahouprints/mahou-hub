import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Interactions API — sucessora do `generateContent`, que virou legado. O corpo mudou de
 * `contents[].parts[]` pra `input[]`, e a saída sai em `steps[].content[]`.
 * Doc: https://ai.google.dev/gemini-api/docs/interactions/document-processing
 */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * Teto do Google pro corpo inteiro da requisição (prompt + bytes embutidos). Acima disso
 * o caminho é a Files API — que não implementamos porque nota fiscal fotografada não
 * chega perto: o upload aceita 50MB, mas 20MB de foto de papel já é exagero.
 */
const MAX_BYTES_INLINE = 20 * 1024 * 1024;

/** Imagem vai como `image`, PDF como `document` — o type errado faz a API rejeitar. */
const TYPE_POR_MIME = (mimeType: string) => (mimeType === 'application/pdf' ? 'document' : 'image');

export interface ArquivoParaLeitura {
  base64: string;
  mimeType: string;
}

interface RespostaInteractions {
  /**
   * A API devolve os passos do modelo, e o raciocínio vem como passo `thought` SEM
   * `content` — só o `model_output` carrega o texto. Confirmado numa chamada real em
   * 29/07/2026: `steps: [{type:'thought', signature}, {type:'model_output', content:[…]}]`.
   */
  steps?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
}

@Injectable()
export class GeminiClient {
  private readonly apiKey: string;
  private readonly modelo: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY') ?? '';
    // Flash-Lite é o mais barato da família e cabe no free tier (1.000 req/dia). Sai por
    // env porque a nomenclatura do Google muda rápido e não dá pra depender de deploy.
    this.modelo = config.get<string>('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';
  }

  get configurado() {
    return this.apiKey.length > 0;
  }

  /**
   * Manda os arquivos + prompt e devolve o JSON que o modelo produziu, já parseado mas
   * NÃO validado — quem chama valida com Zod, porque schema aceito pela API não é
   * garantia de conteúdo correto.
   *
   * @example await gemini.lerJson({ arquivos, prompt: 'extraia...', schema: SCHEMA_JSON })
   */
  async lerJson(args: {
    arquivos: ArquivoParaLeitura[];
    prompt: string;
    schema: Record<string, unknown>;
  }): Promise<unknown> {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY não configurada — a leitura automática de nota está desligada',
      );
    }
    this.validarTamanho(args.arquivos);

    const resposta = await this.chamar({
      model: this.modelo,
      input: [
        ...args.arquivos.map((a) => ({
          type: TYPE_POR_MIME(a.mimeType),
          data: a.base64,
          mime_type: a.mimeType,
        })),
        { type: 'text', text: args.prompt },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema: args.schema },
    });

    return this.extrairJson(resposta);
  }

  private async chamar(corpo: Record<string, unknown>): Promise<RespostaInteractions> {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(corpo),
    });
    if (res.status === 429) {
      throw new ServiceUnavailableException(
        'Cota do Gemini estourada (free tier: 1.000 leituras/dia, 15/min). Tente de novo em instantes.',
      );
    }
    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Gemini respondeu ${res.status} ao ler a nota: ${detalhe.slice(0, 300)}`,
      );
    }
    return (await res.json()) as RespostaInteractions;
  }

  /** Pega o último passo que realmente tem texto, ignorando os de raciocínio. */
  private extrairJson(resposta: RespostaInteractions): unknown {
    const comTexto = (resposta.steps ?? []).filter((p) => p.content?.[0]?.text);
    const texto = comTexto[comTexto.length - 1]?.content?.[0]?.text;
    if (!texto) {
      throw new ServiceUnavailableException(
        'Gemini devolveu resposta sem conteúdo — tente enviar a nota de novo',
      );
    }
    try {
      return JSON.parse(texto);
    } catch {
      throw new ServiceUnavailableException(
        `Gemini devolveu texto que não é JSON: ${texto.slice(0, 200)}`,
      );
    }
  }

  private validarTamanho(arquivos: ArquivoParaLeitura[]) {
    const bytes = arquivos.reduce((soma, a) => soma + a.base64.length, 0);
    if (bytes <= MAX_BYTES_INLINE) return;
    throw new ServiceUnavailableException(
      `Arquivos somam ${Math.round(bytes / 1024 / 1024)}MB e o limite de leitura é 20MB — ` +
        'envie a nota em um arquivo menor ou fotografe em resolução menor',
    );
  }
}
