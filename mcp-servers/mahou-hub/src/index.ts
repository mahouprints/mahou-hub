#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { tools as oportunidadesTools } from './tools-oportunidades.js';
import { tools as catalogoTools } from './tools-catalogo.js';
import { tools as concorrentesTools } from './tools-concorrentes.js';

// Tools por domínio ficam em arquivos separados — combinadas aqui pra exposição
// única ao Claude. Adicionar nova área = importar + concatenar no array.
const tools = [...oportunidadesTools, ...catalogoTools, ...concorrentesTools];

const server = new Server(
  { name: 'mahou-hub', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    // jsonSchema7 (default) é compatível com JSON Schema draft 2020-12 que a API
    // da Anthropic exige. `openApi3` gera `nullable: true` em vez de `type: [..., 'null']`
    // e quebra com 400 "JSON schema is invalid".
    inputSchema: zodToJsonSchema(t.inputSchema) as Record<string, unknown>,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Tool desconhecida: ${req.params.name}` }],
    };
  }
  try {
    const args = req.params.arguments ?? {};
    const parsed = tool.inputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        isError: true,
        content: [
          { type: 'text', text: `Input inválido: ${JSON.stringify(parsed.error.format())}` },
        ],
      };
    }
    const result = await tool.handler(parsed.data);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: 'text', text: msg }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
