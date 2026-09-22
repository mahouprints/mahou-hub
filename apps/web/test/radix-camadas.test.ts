import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const carregarNoWeb = createRequire(import.meta.url);
const carregarNoDialog = createRequire(carregarNoWeb.resolve('@radix-ui/react-dialog'));
const carregarNoPopover = createRequire(carregarNoWeb.resolve('@radix-ui/react-popover'));

describe('camadas do calendário dentro do diálogo', () => {
  // Instâncias separadas perdem o contexto que libera cliques e coordena o foco dos portais.
  it.each([
    ['@radix-ui/react-dismissable-layer', 'DismissableLayer'],
    ['@radix-ui/react-focus-scope', 'FocusScope'],
  ])('Dialog e Popover compartilham %s', (pacote, componente) => {
    const moduloDialog = carregarNoDialog(pacote) as Record<string, unknown>;
    const moduloPopover = carregarNoPopover(pacote) as Record<string, unknown>;

    expect(moduloDialog[componente]).toBeDefined();
    expect(moduloPopover[componente]).toBe(moduloDialog[componente]);
  });
});
