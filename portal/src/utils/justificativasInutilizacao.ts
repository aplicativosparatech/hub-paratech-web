/**
 * 30 Justificativas mais utilizadas e aceitas pelo Fisco (SEFAZ) para Inutilização de Numeração
 * Todas cumprem a regra de validação mínima de 15 caracteres e máxima de 255 caracteres.
 */
export const JUSTIFICATIVAS_INUTILIZACAO: string[] = [
  'Erro de comunicacao com os servidores da SEFAZ durante a emissao',
  'Quebra de sequencia numerica operacional do sistema emissor',
  'Falha de conexao com a internet no momento da transmissao fiscal',
  'Travamento no terminal de ponto de venda durante a autorizacao',
  'Salto involuntario na numeracao gerado pelo software emissor de notas',
  'Queda de energia no estabelecimento comercial durante o processamento',
  'Rejeicao tecnica da nota anterior com salto automatico de numeracao',
  'Oscilacao e instabilidade temporaria nos servidores da SEFAZ estadual',
  'Interrupcao no servico de autorizacao de notas fiscais pelo sistema',
  'Cancelamento de venda no caixa antes do envio para a SEFAZ',
  'Falha no leitor de codigo de barras e reinicializacao do cupom fiscal',
  'Atualizacao automatica do software de faturamento no meio da venda',
  'Erro no certificado digital no momento da assinatura do documento',
  'Substituicao emergencial do terminal de caixa no estabelecimento',
  'Descontinuidade na sequencia de emissao por erro de sincronizacao',
  'Falha de impressao do documento auxiliar apos envio da numeracao',
  'Reconfiguracao da serie de notas fiscais no sistema de gestao ERP',
  'Pulo de numeracao gerado por emissao simultanea em multiplos caixas',
  'Interrupcao no banco de dados local do ponto de venda PDV',
  'Falha no driver do sistema operacional durante a gravacao da venda',
  'Rejeicao cadastral de cliente e abandono de cupom no terminal',
  'Numeracao reservada pelo sistema mas nao transmitida a SEFAZ',
  'Tentativa de emissao em contingencia nao concluida pelo operador',
  'Erro de validacao de schema XML impedindo o envio do documento',
  'Reindexacao do banco de dados do sistema de faturamento fiscal',
  'Tempo limite de conexao esgotado (timeout) com os servidores fiscais',
  'Troca de operadora de internet durante o expediente de vendas',
  'Recuperacao de backup do sistema gerando quebra na sequencia fiscal',
  'Descarte de pre-venda cancelada pelo cliente antes da emissao',
  'Ajuste e saneamento periodico de lacunas numericas na escrita fiscal'
]
