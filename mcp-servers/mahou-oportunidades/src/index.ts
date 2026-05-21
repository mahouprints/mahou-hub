#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { tools } from './tools.js';

const server = new Server(
  { name: 'mahou-oportunidades', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema, { target: 'openApi3' }) as Record<string, unknown>,
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
