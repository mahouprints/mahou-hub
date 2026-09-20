import { createHmac } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { gerarCodigoGoogle } from '../src/modules/relatorios/google-script';

const config = {
  segredo: 'segredo-apenas-para-teste-do-receptor',
  emailGoogle: 'proprietario@example.invalid',
  destinatarios: ['proprietario@example.invalid', 'relatorios@example.invalid'],
};
const totais = {
  faturamentoCentavos: 10001,
  custosVariaveisCentavos: 1234,
  custosInsumosCentavos: 567,
  custosGeraisCentavos: 200,
  impostosCentavos: 600,
  taxasMarketplaceCentavos: 0,
  gastosTotaisCentavos: 2601,
  lucroLiquidoCentavos: 7400,
  lucroContribuicaoCentavos: 7600,
  margem: 7400 / 10001,
  qtdVendas: 1,
  qtdItensVendidos: 1,
};

function relatorio() {
  return {
    titulo: 'Mensal — fevereiro de 2028',
    inicio: '2028-02-01',
    fim: '2028-02-29',
    resumo: totais,
    serie: [{ ...totais, rotulo: '29/02' }],
    porCategoria: [{ categoria: 'SOFTWARE', valorCentavos: 200 }],
    porCanal: [{ ...totais, canal: 'SITE' }],
    vendas: [
      {
        ...totais,
        dataVenda: '2028-02-29',
        produtoNome: '=IMPORTXML("https://example.invalid")',
        canal: 'SITE',
        qtd: 1,
        precoUnitarioCentavos: 10001,
        observacao: '  @observação\nlinha 2',
      },
    ],
    custosGerais: [
      {
        dataCompetencia: '2028-02-29',
        descricao: '+Fornecedor',
        categoria: 'SOFTWARE',
        valorCentavos: 200,
        observacao: '-Anotação',
      },
    ],
  };
}

type Escrita = { intervalo: unknown[]; valores?: unknown[][]; formula?: string; formato?: string };
class AbaFake {
  escritos: Escrita[] = [];
  graficos: unknown[] = [];
  linhas = 1000;
  constructor(public nome: string) {}
  getName() {
    return this.nome;
  }
  setName(nome: string) {
    this.nome = nome;
    return this;
  }
  clear() {
    this.escritos = [];
    return this;
  }
  getCharts() {
    return this.graficos;
  }
  removeChart(grafico: unknown) {
    this.graficos = this.graficos.filter((g) => g !== grafico);
  }
  getMaxRows() {
    return this.linhas;
  }
  insertRowsAfter(_apos: number, qtd: number) {
    this.linhas += qtd;
    return this;
  }
  setFrozenRows() {
    return this;
  }
  autoResizeColumns() {
    return this;
  }
  setColumnWidth() {
    return this;
  }
  getRange(...intervalo: unknown[]) {
    if (typeof intervalo[0] === 'number') {
      const fim = intervalo[0] + Number(intervalo[2] ?? 1) - 1;
      if (fim > this.linhas) throw new Error('Intervalo excede quantidade de linhas');
    }
    const registro: Escrita = { intervalo };
    this.escritos.push(registro);
    const range = {
      setValues: (valores: unknown[][]) => {
        registro.valores = valores;
        return range;
      },
      setValue: (valor: unknown) => {
        registro.valores = [[valor]];
        return range;
      },
      setFormula: (formula: string) => {
        registro.formula = formula;
        return range;
      },
      setNumberFormat: (formato: string) => {
        registro.formato = formato;
        return range;
      },
      setFontWeight: () => range,
      setBackground: () => range,
      setWrap: () => range,
    };
    return range;
  }
  newChart() {
    const dados: Record<string, unknown> = {};
    const chart = {
      setChartType: (tipo: string) => {
        dados.tipo = tipo;
        return chart;
      },
      addRange: () => chart,
      setNumHeaders: () => chart,
      setOption: (chave: string, valor: unknown) => {
        dados[chave] = valor;
        return chart;
      },
      setPosition: () => chart,
      build: () => dados,
    };
    return chart;
  }
  insertChart(grafico: unknown) {
    this.graficos.push(grafico);
  }
}

function ambiente() {
  const abas = [new AbaFake('Sheet1')];
  const propriedades = new Map<string, string>();
  const planilha = {
    getId: () => 'planilha-teste',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/planilha-teste/edit',
    getSheets: () => abas,
    getSheetByName: (nome: string) => abas.find((aba) => aba.nome === nome),
    insertSheet: (nome: string) => {
      const aba = new AbaFake(nome);
      abas.push(aba);
      return aba;
    },
    deleteSheet: (aba: AbaFake) => abas.splice(abas.indexOf(aba), 1),
    setSpreadsheetLocale: vi.fn(),
    setSpreadsheetTimeZone: vi.fn(),
  };
  const desconhecido = { getEmail: () => 'antigo@example.invalid' };
  const owner = { getEmail: () => config.emailGoogle };
  const arquivo = {
    setSharing: vi.fn(),
    setShareableByEditors: vi.fn(),
    getViewers: () => [desconhecido],
    getEditors: () => [desconhecido, owner],
    removeViewer: vi.fn(),
    removeEditor: vi.fn(),
    addViewer: vi.fn(),
  };
  const bloqueio = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
  const servicos = {
    Session: { getEffectiveUser: vi.fn(() => owner) },
    Utilities: {
      Charset: { UTF_8: 'UTF-8' },
      computeHmacSha256Signature: (valor: string, segredo: string) =>
        [...createHmac('sha256', segredo).update(valor, 'utf8').digest()].map((b) =>
          b > 127 ? b - 256 : b,
        ),
    },
    LockService: { getScriptLock: () => bloqueio },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (chave: string) => propriedades.get(chave) ?? null,
        setProperty: (chave: string, valor: string) => propriedades.set(chave, valor),
      }),
    },
    SpreadsheetApp: {
      create: vi.fn(() => planilha),
      openById: vi.fn(() => planilha),
      flush: vi.fn(),
      getActiveSpreadsheet: vi.fn(() => null),
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      Permission: { VIEW: 'VIEW' },
      getFileById: vi.fn(() => arquivo),
      getRootFolder: () => ({ getId: () => 'raiz' }),
    },
    MailApp: { sendEmail: vi.fn(), getRemainingDailyQuota: vi.fn(() => 100) },
    Charts: { ChartType: { COLUMN: 'COLUMN', PIE: 'PIE' } },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({ setMimeType: () => ({ text }) }),
    },
  };
  const contexto = runInNewContext(
    `${gerarCodigoGoogle(config)}\n({ doPost, autorizarIntegracao, literal })`,
    servicos,
  ) as {
    doPost(evento: { postData: { contents: string } }): { text: string };
    autorizarIntegracao(): unknown;
    literal(texto: string): string;
  };
  const enviar = (alteracoes: Record<string, unknown> = {}, assinatura?: string) => {
    const conteudo = JSON.stringify({
      id: 'envio-teste',
      criadoEm: new Date().toISOString(),
      relatorio: relatorio(),
      destinatarios: config.destinatarios,
      ...alteracoes,
    });
    const resultado = contexto.doPost({
      postData: {
        contents: JSON.stringify({
          conteudo,
          assinatura:
            assinatura ?? createHmac('sha256', config.segredo).update(conteudo).digest('hex'),
        }),
      },
    });
    return JSON.parse(resultado.text) as {
      ok: boolean;
      erro?: string;
      planilhaUrl?: string;
      enviadoEm?: string;
    };
  };
  return { ...servicos, contexto, enviar, abas, arquivo, planilha, propriedades, bloqueio };
}

describe('receptor Google Apps Script gerado', () => {
  it('autoriza a conta sem criar planilha ou enviar mensagem', () => {
    const a = ambiente();
    expect(a.contexto.autorizarIntegracao()).toEqual({
      ok: true,
      emailGoogle: config.emailGoogle,
      quotaDiaria: 100,
    });
    expect(a.SpreadsheetApp.create).not.toHaveBeenCalled();
    expect(a.MailApp.sendEmail).not.toHaveBeenCalled();
  });

  it('valida HMAC UTF-8, gera relatório privado e não repete envio confirmado', () => {
    const a = ambiente();
    const resultado = a.enviar();
    expect(resultado).toMatchObject({ ok: true, planilhaUrl: a.planilha.getUrl() });
    expect(resultado.enviadoEm).toBeTruthy();
    expect(a.enviar()).toEqual(resultado);
    expect(a.SpreadsheetApp.create).toHaveBeenCalledTimes(1);
    expect(a.MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(a.MailApp.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: config.destinatarios.join(','),
        body: expect.stringContaining(a.planilha.getUrl()),
      }),
    );
    expect(a.arquivo.setSharing).toHaveBeenCalledWith('PRIVATE', 'VIEW');
    expect(a.arquivo.setShareableByEditors).toHaveBeenCalledWith(false);
    expect(a.arquivo.removeViewer).toHaveBeenCalledTimes(1);
    expect(a.arquivo.removeEditor).toHaveBeenCalledTimes(1);
    expect(a.arquivo.addViewer).toHaveBeenCalledTimes(1);
    expect(a.arquivo.addViewer).toHaveBeenCalledWith('relatorios@example.invalid');
    expect(a.bloqueio.releaseLock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{}, 'a'.repeat(64), 'Assinatura inválida'],
    [{ criadoEm: new Date(Date.now() - 601000).toISOString() }, undefined, 'expirada'],
    [{ criadoEm: new Date(Date.now() + 601000).toISOString() }, undefined, 'expirada'],
    [{ criadoEm: 'data inválida' }, undefined, 'expirada'],
    [{ destinatarios: ['invasor@example.invalid'] }, undefined, 'destinatários diferem'],
    [{ destinatarios: [] }, undefined, 'Destinatários inválidos'],
    [{ id: '' }, undefined, 'Identificação'],
  ])(
    'rejeita envelope inválido antes de qualquer criação ou envio (%j)',
    (dados, assinatura, erro) => {
      const a = ambiente();
      expect(a.enviar(dados, assinatura)).toMatchObject({
        ok: false,
        erro: expect.stringContaining(erro),
      });
      expect(a.SpreadsheetApp.create).not.toHaveBeenCalled();
      expect(a.MailApp.sendEmail).not.toHaveBeenCalled();
    },
  );

  it('recusa execução com outra conta Google e bloqueio ocupado', () => {
    const a = ambiente();
    a.Session.getEffectiveUser.mockReturnValueOnce({ getEmail: () => 'outra@example.invalid' });
    expect(a.enviar()).toMatchObject({ ok: false, erro: expect.stringContaining('conta Google') });
    a.bloqueio.tryLock.mockReturnValueOnce(false);
    expect(a.enviar()).toMatchObject({ ok: false, erro: expect.stringContaining('processamento') });
    expect(a.bloqueio.releaseLock).not.toHaveBeenCalled();
    expect(a.SpreadsheetApp.create).not.toHaveBeenCalled();
  });

  it('reutiliza sheetId salvo antes de falha na preparação', () => {
    const a = ambiente();
    a.planilha.setSpreadsheetLocale.mockImplementationOnce(() => {
      throw new Error('falha temporária');
    });
    expect(a.enviar()).toMatchObject({ ok: false });
    expect(JSON.parse(a.propriedades.get('mahou-relatorio:envio-teste')!)).toEqual({
      status: 'PREPARANDO',
      sheetId: 'planilha-teste',
    });
    expect(a.enviar()).toMatchObject({ ok: true });
    expect(a.SpreadsheetApp.create).toHaveBeenCalledTimes(1);
    expect(a.SpreadsheetApp.openById).toHaveBeenCalledTimes(1);
    expect(a.SpreadsheetApp.openById).toHaveBeenCalledWith('planilha-teste');
    expect(a.MailApp.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('não reenvia após falha ambígua do MailApp', () => {
    const a = ambiente();
    a.MailApp.sendEmail.mockImplementationOnce(() => {
      throw new Error('conexão interrompida');
    });
    expect(a.enviar()).toMatchObject({ ok: false });
    expect(JSON.parse(a.propriedades.get('mahou-relatorio:envio-teste')!).status).toBe('ENVIANDO');
    expect(a.enviar()).toMatchObject({ ok: false, erro: expect.stringContaining('ambíguo') });
    expect(a.MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(a.SpreadsheetApp.create).toHaveBeenCalledTimes(1);
  });

  it('preserva centavos e datas civis, neutraliza fórmulas externas e cria gráficos e totais', () => {
    const a = ambiente();
    expect(a.enviar().ok).toBe(true);
    const resumo = a.abas.find((aba) => aba.nome === 'Resumo')!;
    const vendas = a.abas.find((aba) => aba.nome === 'Vendas')!;
    const custos = a.abas.find((aba) => aba.nome === 'Custos')!;
    const linhaVenda = vendas.escritos.find((item) => item.intervalo.join(',') === '2,1,1,12')!
      .valores![0]!;
    expect(linhaVenda).toEqual([
      '2028-02-29',
      '\'=IMPORTXML("https://example.invalid")',
      'SITE',
      1,
      100.01,
      100.01,
      12.34,
      5.67,
      6,
      0,
      76,
      "'  @observação\nlinha 2",
    ]);
    const linhaCusto = custos.escritos.find((item) => item.intervalo.join(',') === '2,1,1,5')!
      .valores![0]!;
    expect(linhaCusto).toEqual(['2028-02-29', "'+Fornecedor", 'SOFTWARE', 2, "'-Anotação"]);
    expect(resumo.escritos).toContainEqual({ intervalo: ['B10'], formula: '=SUM(B5:B9)' });
    expect(vendas.escritos.some((item) => item.formula === '=SUM(F2:F2)')).toBe(true);
    expect(resumo.graficos).toEqual([
      { tipo: 'COLUMN', title: 'Receita, gastos e lucro', width: 720, height: 320 },
      { tipo: 'PIE', title: 'Custos gerais por categoria', width: 720, height: 320 },
    ]);
    expect(a.planilha.setSpreadsheetLocale).toHaveBeenCalledWith('pt_BR');
  });

  it('aumenta capacidade e gera totais para mais de mil vendas', () => {
    const a = ambiente();
    const dados = relatorio();
    dados.vendas = Array.from({ length: 1500 }, () => dados.vendas[0]!);
    expect(a.enviar({ relatorio: dados }).ok).toBe(true);
    const vendas = a.abas.find((aba) => aba.nome === 'Vendas')!;
    expect(vendas.linhas).toBe(1503);
    expect(vendas.escritos.some((item) => item.formula === '=SUM(F2:F1501)')).toBe(true);
  });

  it.each(['=1+1', '+1', '-1', '@SUM(A1)', ' \t\n=1', '\uFEFF=1'])(
    'trata conteúdo externo como literal: %s',
    (texto) => {
      expect(ambiente().contexto.literal(texto)).toBe(`'${texto}`);
    },
  );
});
