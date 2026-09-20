type ConfiguracaoCodigoGoogle = { segredo: string; emailGoogle: string; destinatarios: string[] };

/** Gera o receptor privado a instalar na conta escolhida; ex.: gerarCodigoGoogle(configuracao). */
export function gerarCodigoGoogle(configuracao: ConfiguracaoCodigoGoogle): string {
  const normalizar = (email: string) => email.trim().toLowerCase();
  const config = {
    ...configuracao,
    emailGoogle: normalizar(configuracao.emailGoogle),
    destinatarios: [...new Set(configuracao.destinatarios.map(normalizar))].sort(),
  };
  return `'use strict';\nconst MAHOU_CONFIG = ${JSON.stringify(config)};\n${CODIGO_GOOGLE}`;
}

// APIs oficiais: https://developers.google.com/apps-script/reference/ (Utilities, Lock, Properties, Spreadsheet, Drive, Mail).
const CODIGO_GOOGLE = String.raw`
function autorizarIntegracao() {
  validarConta();
  DriveApp.getRootFolder().getId();
  SpreadsheetApp.getActiveSpreadsheet();
  const quota = MailApp.getRemainingDailyQuota();
  return { ok: true, emailGoogle: MAHOU_CONFIG.emailGoogle, quotaDiaria: quota };
}

function doPost(evento) {
  let bloqueio;
  let bloqueado = false;
  try {
    validarConta();
    const pedido = validarEnvelope(evento);
    bloqueio = LockService.getScriptLock();
    bloqueado = bloqueio.tryLock(20000);
    if (!bloqueado) throw new Error('Outro relatório está em processamento. Tente novamente.');
    return respostaJson(processarRelatorio(pedido));
  } catch (erro) {
    return respostaJson({ ok: false, erro: String(erro && erro.message || erro) });
  } finally {
    if (bloqueado) bloqueio.releaseLock();
  }
}

function validarConta() {
  const email = Session.getEffectiveUser().getEmail().trim().toLowerCase();
  if (!email || email !== MAHOU_CONFIG.emailGoogle) {
    throw new Error('Execute e publique o script com a conta Google configurada no ERP.');
  }
}

function validarEnvelope(evento) {
  const envelope = JSON.parse(evento && evento.postData && evento.postData.contents || '{}');
  if (typeof envelope.conteudo !== 'string' || typeof envelope.assinatura !== 'string') {
    throw new Error('Envelope de relatório inválido.');
  }
  const esperado = hexadecimal(Utilities.computeHmacSha256Signature(
    envelope.conteudo, MAHOU_CONFIG.segredo, Utilities.Charset.UTF_8));
  if (!assinaturasIguais(esperado, envelope.assinatura)) throw new Error('Assinatura inválida.');
  const pedido = JSON.parse(envelope.conteudo);
  const instante = new Date(pedido.criadoEm).getTime();
  if (!Number.isFinite(instante) || Math.abs(Date.now() - instante) > 10 * 60 * 1000) {
    throw new Error('Solicitação expirada ou com data inválida.');
  }
  if (typeof pedido.id !== 'string' || !pedido.id || pedido.id.length > 200 || !pedido.relatorio) {
    throw new Error('Identificação do relatório inválida.');
  }
  validarDestinatarios(pedido.destinatarios);
  return pedido;
}

function hexadecimal(bytes) {
  return bytes.map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function assinaturasIguais(esperado, recebido) {
  if (!/^[0-9a-f]{64}$/i.test(recebido)) return false;
  const assinatura = recebido.toLowerCase();
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ assinatura.charCodeAt(i);
  return diferenca === 0;
}

function validarDestinatarios(destinatarios) {
  if (!Array.isArray(destinatarios) || !destinatarios.length || destinatarios.some(function(email) { return typeof email !== 'string'; })) {
    throw new Error('Destinatários inválidos.');
  }
  const recebidos = Array.from(new Set(destinatarios.map(function(email) { return email.trim().toLowerCase(); }))).sort();
  if (JSON.stringify(recebidos) !== JSON.stringify(MAHOU_CONFIG.destinatarios)) {
    throw new Error('Os destinatários diferem dos autorizados nesta integração.');
  }
}

function processarRelatorio(pedido) {
  const propriedades = PropertiesService.getScriptProperties();
  const chave = 'mahou-relatorio:' + pedido.id;
  const salvo = propriedades.getProperty(chave);
  const estado = salvo ? JSON.parse(salvo) : { status: 'PREPARANDO' };
  if (estado.status === 'ENVIADO') return { ok: true, planilhaUrl: estado.planilhaUrl, enviadoEm: estado.enviadoEm };
  if (estado.status === 'ENVIANDO') throw new Error('Envio ambíguo: confira sua caixa de enviados. O mesmo relatório não será reenviado automaticamente.');
  const planilha = estado.sheetId ? SpreadsheetApp.openById(estado.sheetId) : SpreadsheetApp.create('Mahou Prints — ' + pedido.relatorio.titulo);
  estado.sheetId = planilha.getId();
  propriedades.setProperty(chave, JSON.stringify(estado));
  prepararPlanilha(planilha, pedido.relatorio);
  compartilharSomenteDestinatarios(estado.sheetId);
  SpreadsheetApp.flush();
  estado.planilhaUrl = planilha.getUrl();
  estado.status = 'ENVIANDO';
  propriedades.setProperty(chave, JSON.stringify(estado));
  MailApp.sendEmail({
    to: MAHOU_CONFIG.destinatarios.join(','),
    subject: 'Mahou Prints — ' + pedido.relatorio.titulo,
    body: 'Seu relatório financeiro de ' + pedido.relatorio.inicio + ' a ' + pedido.relatorio.fim +
      ' está disponível:\n\n' + estado.planilhaUrl + '\n\nAcesso restrito aos destinatários configurados.',
    name: 'Mahou Prints',
  });
  estado.status = 'ENVIADO';
  estado.enviadoEm = new Date().toISOString();
  propriedades.setProperty(chave, JSON.stringify(estado));
  return { ok: true, planilhaUrl: estado.planilhaUrl, enviadoEm: estado.enviadoEm };
}

function compartilharSomenteDestinatarios(sheetId) {
  const arquivo = DriveApp.getFileById(sheetId);
  arquivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  arquivo.setShareableByEditors(false);
  const autorizados = new Set(MAHOU_CONFIG.destinatarios.concat([MAHOU_CONFIG.emailGoogle]));
  arquivo.getViewers().forEach(function(usuario) {
    if (!autorizados.has(usuario.getEmail().toLowerCase())) arquivo.removeViewer(usuario);
  });
  arquivo.getEditors().forEach(function(usuario) {
    if (usuario.getEmail().toLowerCase() !== MAHOU_CONFIG.emailGoogle) arquivo.removeEditor(usuario);
  });
  MAHOU_CONFIG.destinatarios.forEach(function(email) {
    if (email !== MAHOU_CONFIG.emailGoogle) arquivo.addViewer(email);
  });
}

function prepararPlanilha(planilha, relatorio) {
  planilha.setSpreadsheetLocale('pt_BR');
  planilha.setSpreadsheetTimeZone('America/Sao_Paulo');
  const abas = ['Resumo', 'Vendas', 'Custos'];
  const primeira = planilha.getSheets()[0];
  if (!planilha.getSheetByName('Resumo')) primeira.setName('Resumo');
  abas.forEach(function(nome) {
    const aba = planilha.getSheetByName(nome) || planilha.insertSheet(nome);
    aba.clear();
    aba.getCharts().forEach(function(grafico) { aba.removeChart(grafico); });
  });
  planilha.getSheets().forEach(function(aba) { if (abas.indexOf(aba.getName()) < 0) planilha.deleteSheet(aba); });
  escreverResumo(planilha.getSheetByName('Resumo'), relatorio);
  escreverVendas(planilha.getSheetByName('Vendas'), relatorio.vendas);
  escreverCustos(planilha.getSheetByName('Custos'), relatorio.custosGerais);
}

function literal(valor) {
  const texto = valor == null ? '' : String(valor);
  return /^[\s\uFEFF]*[=+@-]/.test(texto) ? "'" + texto : texto;
}

function dinheiro(centavos) {
  if (!Number.isFinite(centavos) || !Number.isInteger(centavos)) throw new Error('Valor monetário inválido no relatório.');
  return centavos / 100;
}

function escreverTabela(aba, linha, cabecalho, registros) {
  garantirLinhas(aba, linha + registros.length + 2);
  aba.getRange(linha, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold').setBackground('#e8ecf2').setWrap(true);
  if (registros.length) aba.getRange(linha + 1, 1, registros.length, cabecalho.length).setValues(registros).setWrap(true);
  aba.setFrozenRows(linha === 1 ? 1 : 3);
  aba.autoResizeColumns(1, cabecalho.length);
}

function garantirLinhas(aba, quantidade) {
  const atuais = aba.getMaxRows();
  if (quantidade > atuais) aba.insertRowsAfter(atuais, quantidade - atuais);
}

function escreverResumo(aba, relatorio) {
  const resumo = relatorio.resumo;
  aba.getRange('A1:D2').breakApart();
  aba.getRange('A1:D1').merge().setValue(literal(relatorio.titulo)).setFontWeight('bold').setWrap(true);
  aba.getRange('A2:D2').merge().setValue(literal(relatorio.inicio + ' a ' + relatorio.fim)).setWrap(true);
  const indicadores = [
    ['Receita', dinheiro(resumo.faturamentoCentavos)], ['Custos variáveis', dinheiro(resumo.custosVariaveisCentavos)],
    ['Insumos consumidos', dinheiro(resumo.custosInsumosCentavos)], ['Custos gerais', dinheiro(resumo.custosGeraisCentavos)],
    ['Impostos', dinheiro(resumo.impostosCentavos)], ['Taxas marketplace', dinheiro(resumo.taxasMarketplaceCentavos)],
    ['Gastos totais', dinheiro(resumo.gastosTotaisCentavos)], ['Lucro líquido', dinheiro(resumo.lucroLiquidoCentavos)],
    ['Margem', resumo.margem], ['Vendas', resumo.qtdVendas], ['Unidades vendidas', resumo.qtdItensVendidos],
  ];
  escreverTabela(aba, 3, ['Indicador', 'Valor'], indicadores);
  aba.getRange('B4:B11').setNumberFormat('"R$" #,##0.00');
  aba.getRange('B10').setFormula('=SUM(B5:B9)');
  aba.getRange('B11').setFormula('=B4-B10');
  aba.getRange('B12').setFormula('=IFERROR(B11/B4;0)').setNumberFormat('0.00%');
  const serie = relatorio.serie.map(function(ponto) {
    return [literal(ponto.rotulo), dinheiro(ponto.faturamentoCentavos), dinheiro(ponto.gastosTotaisCentavos), dinheiro(ponto.lucroLiquidoCentavos)];
  });
  escreverTabela(aba, 17, ['Período', 'Receita', 'Gastos', 'Lucro'], serie);
  if (serie.length) aba.getRange(18, 2, serie.length, 3).setNumberFormat('"R$" #,##0.00');
  const categorias = relatorio.porCategoria.map(function(item) { return [literal(item.categoria), dinheiro(item.valorCentavos)]; });
  const linhaCategoria = 20 + serie.length;
  escreverTabela(aba, linhaCategoria, ['Categoria de custo geral', 'Valor'], categorias);
  if (categorias.length) aba.getRange(linhaCategoria + 1, 2, categorias.length, 1).setNumberFormat('"R$" #,##0.00');
  if (serie.length) inserirGrafico(aba, Charts.ChartType.COLUMN, aba.getRange(17, 1, serie.length + 1, 4), 2, 'Receita, gastos e lucro');
  if (categorias.some(function(item) { return item[1] > 0; })) inserirGrafico(aba, Charts.ChartType.PIE, aba.getRange(linhaCategoria, 1, categorias.length + 1, 2), 20, 'Custos gerais por categoria');
  const linhaCanal = linhaCategoria + categorias.length + 3;
  const canais = relatorio.porCanal.map(function(item) { return [literal(item.canal), dinheiro(item.faturamentoCentavos), dinheiro(item.lucroContribuicaoCentavos)]; });
  escreverTabela(aba, linhaCanal, ['Canal', 'Receita', 'Lucro antes dos custos gerais'], canais);
  if (canais.length) aba.getRange(linhaCanal + 1, 2, canais.length, 2).setNumberFormat('"R$" #,##0.00');
  aba.setColumnWidth(1, 200);
  [2, 3, 4].forEach(function(coluna) { aba.setColumnWidth(coluna, 130); });
  aba.setColumnWidth(5, 24);
}

function inserirGrafico(aba, tipo, intervalo, linha, titulo) {
  aba.insertChart(aba.newChart().setChartType(tipo).addRange(intervalo).setNumHeaders(1)
    .setOption('title', titulo).setOption('width', 720).setOption('height', 320)
    .setPosition(linha, 6, 0, 0).build());
}

function escreverVendas(aba, vendas) {
  const registros = vendas.map(function(venda) {
    return [literal(venda.dataVenda), literal(venda.produtoNome), literal(venda.canal), venda.qtd,
      dinheiro(venda.precoUnitarioCentavos), dinheiro(venda.faturamentoCentavos), dinheiro(venda.custosVariaveisCentavos),
      dinheiro(venda.custosInsumosCentavos), dinheiro(venda.impostosCentavos), dinheiro(venda.taxasMarketplaceCentavos),
      dinheiro(venda.lucroContribuicaoCentavos), literal(venda.observacao)];
  });
  garantirLinhas(aba, registros.length + 3);
  aba.getRange(2, 1, Math.max(registros.length, 1), 1).setNumberFormat('@');
  escreverTabela(aba, 1, ['Data', 'Produto', 'Canal', 'Quantidade', 'Preço unitário', 'Receita', 'Custos variáveis', 'Insumos', 'Impostos', 'Taxas', 'Lucro antes dos custos gerais', 'Observações'], registros);
  if (registros.length) aba.getRange(2, 5, registros.length, 7).setNumberFormat('"R$" #,##0.00');
  escreverTotais(aba, registros.length, [4, 6, 7, 8, 9, 10, 11]);
  aba.setColumnWidth(12, 360);
}

function escreverCustos(aba, custos) {
  const registros = custos.map(function(custo) {
    return [literal(custo.dataCompetencia), literal(custo.descricao), literal(custo.categoria), dinheiro(custo.valorCentavos), literal(custo.observacao)];
  });
  garantirLinhas(aba, registros.length + 3);
  aba.getRange(2, 1, Math.max(registros.length, 1), 1).setNumberFormat('@');
  escreverTabela(aba, 1, ['Data de competência', 'Descrição', 'Categoria', 'Valor', 'Observações'], registros);
  if (registros.length) aba.getRange(2, 4, registros.length, 1).setNumberFormat('"R$" #,##0.00');
  escreverTotais(aba, registros.length, [4]);
  aba.setColumnWidth(5, 360);
}

function escreverTotais(aba, quantidade, colunas) {
  const linha = quantidade + 3;
  aba.getRange(linha, 1).setValue('TOTAL').setFontWeight('bold');
  colunas.forEach(function(coluna) {
    const letra = String.fromCharCode(64 + coluna);
    const celula = aba.getRange(linha, coluna);
    if (quantidade) celula.setFormula('=SUM(' + letra + '2:' + letra + (quantidade + 1) + ')');
    else celula.setValue(0);
    celula.setFontWeight('bold');
    if (aba.getName() === 'Custos' || coluna !== 4) celula.setNumberFormat('"R$" #,##0.00');
  });
}

function respostaJson(resultado) {
  return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
}
`;
