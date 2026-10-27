/**
 * Orquestrador RAG (Retrieval-Augmented Generation) do Robotech IA
 * Unifica a recuperação de artigos fiscais/manuais, auditoria de banco de dados e IA Generativa.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { buscarConhecimentoRAG } from './knowledgeBase';
import { DatabaseAuditor, ContextoAuditoriaSegura } from './databaseAuditor';

export interface MensagemChat {
  role: 'user' | 'model';
  content: string;
}

export interface RequisicaoRobotech {
  mensagem: string;
  historico?: MensagemChat[];
  contextoUsuario: {
    userRole: 'admin' | 'contabilidade' | 'cliente';
    clienteId?: string | null;
    clientesPermitidos?: any[];
  };
  geminiKey?: string;
}

export interface RespostaRobotech {
  resposta: string;
  provedor: string;
  isLiveIa: boolean;
  fontesRAG?: string[];
  dadosAuditados?: any;
}

export async function processarRobotechRAG(
  supabase: SupabaseClient,
  req: RequisicaoRobotech
): Promise<RespostaRobotech> {
  const { mensagem, historico = [], contextoUsuario, geminiKey } = req;
  const msgNorm = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // 1. Preparar Contexto de Segurança Multi-Tenancy
  const { data: todosClientes } = await supabase
    .from('clientes')
    .select('id, razao_social, nome_fantasia, cnpj, regime_tributario, dia_vencimento, valor_mensalidade, nome_sistema_utilizado, is_ativo, cidade, uf');
  const listaGeral = todosClientes || [];

  const idsAutorizados = new Set<string>();
  if (contextoUsuario.userRole === 'admin') {
    listaGeral.forEach(c => idsAutorizados.add(c.id));
  } else if (Array.isArray(contextoUsuario.clientesPermitidos) && contextoUsuario.clientesPermitidos.length > 0) {
    contextoUsuario.clientesPermitidos.forEach(c => idsAutorizados.add(c.id));
  } else if (contextoUsuario.clienteId) {
    idsAutorizados.add(contextoUsuario.clienteId);
  }

  // Identifica se citou alguma empresa
  let empresaFoco: any = null;
  const cnpjNumeros = mensagem.replace(/\D/g, '');
  if (cnpjNumeros.length >= 8) {
    empresaFoco = listaGeral.find(c => (c.cnpj || '').replace(/\D/g, '').includes(cnpjNumeros));
  }

  if (!empresaFoco) {
    for (const c of listaGeral) {
      const fant = (c.nome_fantasia || '').toLowerCase().trim();
      const raz = (c.razao_social || '').toLowerCase().trim();
      if ((fant && fant.length >= 4 && msgNorm.includes(fant)) || (raz && raz.length >= 4 && msgNorm.includes(raz))) {
        empresaFoco = c;
        break;
      }
    }
  }

  if (empresaFoco && !idsAutorizados.has(empresaFoco.id)) {
    return {
      resposta: `⚠️ **Acesso Restrito:** Por motivos de sigilo fiscal e conformidade com a LGPD, você possui permissão para consultar exclusivamente as informações vinculadas à sua conta.`,
      provedor: 'Robotech Security Guard',
      isLiveIa: false
    };
  }

  const contextoSeguro: ContextoAuditoriaSegura = {
    userRole: contextoUsuario.userRole,
    clienteIdFoco: empresaFoco?.id || contextoUsuario.clienteId || null,
    idsAutorizados
  };

  const auditor = new DatabaseAuditor(supabase);

  // 2. RECUPERAÇÃO RAG 1: BASE DE CONHECIMENTO SEMÂNTICA (Artigos, Legislação, LC 214, SEFAZ)
  const artigosRAG = buscarConhecimentoRAG(mensagem, 3);
  let contextoArtigosFiscal = '';
  const fontesRAG: string[] = [];

  if (artigosRAG.length > 0) {
    contextoArtigosFiscal = `\n[EVIDÊNCIAS DA BASE DE CONHECIMENTO FISCAL & SISTEMAS PARATECH]:\n` +
      artigosRAG.map((art, idx) => {
        fontesRAG.push(art.titulo);
        return `Fonte ${idx + 1}: ${art.titulo}\n${art.conteudo}`;
      }).join('\n\n') + '\n';
  }

  // 3. RECUPERAÇÃO RAG 2: CONSULTAS E AUDITORIAS DINÂMICAS NO BANCO DE DADOS
  let contextoDadosBanco = '';
  let dadosAuditados: any = null;

  // A) Auditoria de Monofásicos & PGDAS-D
  if (msgNorm.includes('monofasico') || msgNorm.includes('recuperar') || msgNorm.includes('pis') || msgNorm.includes('cofins') || msgNorm.includes('das') || msgNorm.includes('auditar')) {
    const resMonofasicos = await auditor.auditarMonofasicosSimples(contextoSeguro, 30);
    if (resMonofasicos) {
      dadosAuditados = resMonofasicos;
      contextoDadosBanco += `\n[AUDITORIA FISCAL EM TEMPO REAL - PRODUTOS MONOFÁSICOS]:\n` +
        `- Empresa Auditada: ${resMonofasicos.empresaNome} (CNPJ: ${resMonofasicos.cnpj})\n` +
        `- Total de Notas Emitidas Analisadas: ${resMonofasicos.totalNotasEmitidas}\n` +
        `- Faturamento Bruto do Período: R$ ${resMonofasicos.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `- Total de Vendas com NCM Monofásico Segregável: R$ ${resMonofasicos.totalMonofasicoSegregavel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `- Base Tributável Restante no Simples: R$ ${resMonofasicos.baseTributavelRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
        `- Economia Estimada Imediata no DAS: R$ ${resMonofasicos.economiaEstimadaDas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    }
  }

  // B) Vendas, Emissões e Formas de Pagamento (PIX, Dinheiro, Cartão)
  if (msgNorm.includes('venda') || msgNorm.includes('faturamento') || msgNorm.includes('quanto vendi') || msgNorm.includes('pix') || msgNorm.includes('nfce') || msgNorm.includes('nfe')) {
    const periodo = msgNorm.includes('hoje') ? 'hoje' : msgNorm.includes('semana') ? '7dias' : msgNorm.includes('mes') ? 'mes_atual' : 'tudo';
    const metricasVendas = await auditor.consultarMetricasVendas(contextoSeguro, periodo);
    contextoDadosBanco += `\n[DADOS DE VENDAS & PAGAMENTOS - PERÍODO: ${periodo.toUpperCase()}]:\n` +
      `- Quantidade NFC-e (Cupom PDV): ${metricasVendas.qtdNfce} emitidas | Total: R$ ${metricasVendas.totalNfce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `- Vendas em PIX na NFC-e: R$ ${metricasVendas.totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${metricasVendas.qtdPix} vendas)\n` +
      `- Vendas em Dinheiro na NFC-e: R$ ${metricasVendas.totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${metricasVendas.qtdDinheiro} vendas)\n` +
      `- Vendas em Cartão na NFC-e: R$ ${metricasVendas.totalCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${metricasVendas.qtdCartao} vendas)\n` +
      `- Quantidade NF-e (Modelo 55): ${metricasVendas.qtdNfe} emitidas | Total: R$ ${metricasVendas.totalNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `- Faturamento Total Geral Consolidado: R$ ${metricasVendas.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  }

  // C) Faturas, Vencimentos e Inadimplência
  if (msgNorm.includes('fatura') || msgNorm.includes('vencimento') || msgNorm.includes('mensalidade') || msgNorm.includes('inadimplente') || msgNorm.includes('devendo') || msgNorm.includes('quanto custa')) {
    const apenasPendentes = msgNorm.includes('pendente') || msgNorm.includes('aberto') || msgNorm.includes('atraso');
    const resFaturas = await auditor.auditarFaturas(contextoSeguro, apenasPendentes);
    contextoDadosBanco += `\n[SITUAÇÃO FINANCEIRA & FATURAS NO BANCO]:\n` +
      `- Total Pendente/A Vencer: R$ ${resFaturas.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `- Total em Atraso (Vencido): R$ ${resFaturas.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `- Faturas Recentes:\n` +
      resFaturas.faturas.slice(0, 5).map(f => 
        `  * Empresa: ${f.empresa} | Competência: ${f.competencia} | Valor: R$ ${f.valor.toFixed(2)} | Vencimento: ${f.vencimento} | Status: ${f.status.toUpperCase()} | Tem PIX: ${f.temPix ? 'Sim' : 'Não'}`
      ).join('\n') + '\n';
  }

  // D) Identificação e Auditoria de Sistemas Monitorados (BARTECH, GDOOR SLIM, GDOOR PRO, ZWEB, PDV+, etc.)
  const sistemasConhecidos = [
    { termo: 'bartech', nome: 'BARTECH' },
    { termo: 'siedfood', nome: 'SIEDFOOD' },
    { termo: 'gdoor slim', nome: 'GDOOR SLIM' },
    { termo: 'gdoorslim', nome: 'GDOOR SLIM' },
    { termo: 'slim', nome: 'GDOOR SLIM' },
    { termo: 'gdoor pro', nome: 'GDOOR PRO' },
    { termo: 'gdoorpro', nome: 'GDOOR PRO' },
    { termo: 'pro', nome: 'GDOOR PRO' },
    { termo: 'gdoor', nome: 'GDOOR' },
    { termo: 'pdv+', nome: 'PDV+' },
    { termo: 'pdv', nome: 'PDV+' },
    { termo: 'zweb', nome: 'ZWEB' },
    { termo: 'barzin', nome: 'BARZIN' },
    { termo: 'gastro', nome: 'GASTRO' },
    { termo: 'mei simples', nome: 'MEI SIMPLES' },
    { termo: 'mei_simples', nome: 'MEI SIMPLES' },
    { termo: 'mei', nome: 'MEI SIMPLES' },
    { termo: 'navi', nome: 'NAVI VENDAS' },
    { termo: 'pes.ai', nome: 'PES.AI' },
    { termo: 'pes ai', nome: 'PES.AI' },
    { termo: 'paratech', nome: 'PARATECH ERP' }
  ];

  let sistemaFiltroDetectado: string | null = null;
  for (const s of sistemasConhecidos) {
    if (msgNorm.includes(s.termo)) {
      sistemaFiltroDetectado = s.nome;
      break;
    }
  }

  let clientesDoSistemaDetectado: any[] = [];
  if (sistemaFiltroDetectado) {
    clientesDoSistemaDetectado = listaGeral.filter(c => {
      if (!idsAutorizados.has(c.id)) return false;
      const sisPadrao = DatabaseAuditor.normalizarNomeSistema(c.nome_sistema_utilizado);
      const sisRaw = (c.nome_sistema_utilizado || '').toLowerCase();
      return sisPadrao === sistemaFiltroDetectado || sisRaw.includes(sistemaFiltroDetectado.toLowerCase());
    });

    contextoDadosBanco += `\n[CLIENTES REAIS MONITORADOS NO SISTEMA "${sistemaFiltroDetectado}" (Total: ${clientesDoSistemaDetectado.length} empresas encontradas no banco)]:\n` +
      (clientesDoSistemaDetectado.length > 0
        ? clientesDoSistemaDetectado.map((c, i) =>
            `${i + 1}. Nome: ${c.nome_fantasia || c.razao_social} | CNPJ: ${c.cnpj} | Sistema Monitorado: ${c.nome_sistema_utilizado} | Status: ${c.is_ativo ? 'Ativo' : 'Inativo/Bloqueado'} | Cidade/UF: ${c.cidade || '—'}/${c.uf || '—'} | Mensalidade: R$ ${Number(c.valor_mensalidade || 0).toFixed(2)}`
          ).join('\n')
        : `Nenhuma empresa cadastrada com o sistema "${sistemaFiltroDetectado}".`
      ) + '\n';
  }

  // Visão geral de Sistemas Paratech e ERPs Monitorados
  if (msgNorm.includes('sistema') || msgNorm.includes('erp') || msgNorm.includes('monitorado') || msgNorm.includes('carteira') || msgNorm.includes('quantos clientes')) {
    if (contextoUsuario.userRole === 'admin') {
      const resSistemas = await auditor.consultarSistemasParatech(contextoSeguro);
      if (resSistemas && 'distribuicao' in resSistemas && resSistemas.distribuicao) {
        contextoDadosBanco += `\n[DISTRIBUIÇÃO REAL DE CLIENTES POR SISTEMA MONITORADO]:\n` +
          Object.entries(resSistemas.distribuicao).map(([k, v]) => 
            `- ${k}: ${v.total} clientes (${v.ativos} ativos) | MRR: R$ ${v.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          ).join('\n') + '\n';
      }
    }
  }

  // E) Se pediu listagem de empresas / clientes
  if (msgNorm.includes('listar') || msgNorm.includes('liste') || msgNorm.includes('quais empresas') || msgNorm.includes('quais clientes') || msgNorm.includes('todos os clientes') || msgNorm.includes('todas as empresas')) {
    const permitidas = listaGeral.filter(c => idsAutorizados.has(c.id));
    contextoDadosBanco += `\n[LISTAGEM REAL DE TODAS AS EMPRESAS CLIENTES (${permitidas.length} empresas no banco)]:\n` +
      permitidas.slice(0, 50).map((c, i) => 
        `${i + 1}. Nome: ${c.nome_fantasia || c.razao_social} | CNPJ: ${c.cnpj} | Sistema Monitorado: ${c.nome_sistema_utilizado || '—'} | Regime: ${c.regime_tributario || 'Simples'} | Status: ${c.is_ativo ? 'Ativo' : 'Bloqueado'}`
      ).join('\n') + '\n';
  }

  // 4. SÍNTESE COM IA GENERATIVA (GEMINI)
  if (geminiKey) {
    const systemPrompt = `VOCÊ É O ROBOTECH, AUDITOR FISCAL E ASSISTENTE DE IA OFICIAL DA PARATECH SOLUÇÕES E SISTEMAS.
Você é extremamente inteligente, analítico, prestativo e didático.
Você possui acesso a dados em tempo real extraídos do banco de dados e a uma base de conhecimento jurídica/tributária e operacional.

${contextoArtigosFiscal}
${contextoDadosBanco}

DIRETRIZES DE RESPOSTA OBRIGATÓRIAS:
1. PRECISÃO MATEMÁTICA E AUDITORIA ABSOLUTA: Baseie suas conclusões rigorosamente nos dados reais fornecidos acima. Nunca invente ou arredonde números. Se o usuário perguntou sobre clientes de um sistema específico (ex: BARTECH), liste nominalmente cada um com seu CNPJ e status ativo/bloqueado.
2. ESTRUTURAÇÃO VISUAL PREMIUM: Use negritos, listas com marcadores limpos, tabelas em markdown quando houver comparativos e badges de status (ex: 🟢 Ativo, 🔴 Inativo).
3. CONSELHOS TRIBUTÁRIOS PRÁTICOS: Quando falar sobre produtos monofásicos ou Reforma Tributária, explique a economia gerada ou a ação preventiva recomendada.
4. BOTÕES DE AÇÃO: Sempre que oportuno, forneça um botão de atalho no formato exato:
   - [ACTION:NAVIGATE|/dashboard/clientes|👥 Ver Clientes no Hub]
   - [ACTION:NAVIGATE|/dashboard/relatorios|👉 Ir para Relatórios Fiscais]
   - [ACTION:NAVIGATE|/dashboard/corretor-tributario|⚖️ Ir para Analisador Tributário]
   - [ACTION:NAVIGATE|/dashboard/faturas|💳 Ver Faturas e PIX]
   - [ACTION:NAVIGATE|/dashboard/notas-fiscais|📄 Ver Notas Fiscais]
   - [ACTION:NAVIGATE|/dashboard/tech-slim|🖥️ Abrir Tech Slim]
   - [ACTION:WHATSAPP|https://wa.me/5537920007857?text=Ola%20Robotech%20preciso%20de%20ajuda|📲 Falar com Suporte Paratech no WhatsApp]`;

    const contents: any[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Entendido. Como Robotech, analisarei os dados auditados e as bases fiscais da Paratech para fornecer respostas com máxima precisão, sem alucinações e com orientações claras.' }] }
    ];

    if (Array.isArray(historico)) {
      for (const h of historico.slice(-5)) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        });
      }
    }

    contents.push({ role: 'user', parts: [{ text: mensagem }] });

    const modelos = [
      'gemini-flash-lite-latest',
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite'
    ];

    for (const mod of modelos) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 1600
              }
            }),
            signal: AbortSignal.timeout(6500)
          }
        );

        if (res.ok) {
          const data = await res.json();
          const respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (respostaTexto) {
            return {
              resposta: respostaTexto,
              provedor: `Robotech RAG Multi-IA (${mod})`,
              isLiveIa: true,
              fontesRAG,
              dadosAuditados
            };
          }
        }
      } catch (err) {
        console.warn(`Tentativa de modelo ${mod} no Robotech RAG falhou:`, err);
      }
    }
  }

  // 5. FALLBACK INTELIGENTE E DETERMINÍSTICO CASO A IA DEMORE OU ESTEJA SEM CHAVE
  let respostaFallback = '';
  if (sistemaFiltroDetectado && clientesDoSistemaDetectado.length > 0) {
    respostaFallback = `### 🤖 Relatório de Auditoria Robotech:\n\n` +
      `Consultei a base de clientes do **Hub Paratech** em tempo real e identifiquei **${clientesDoSistemaDetectado.length} clientes** cadastrados com o sistema monitorado **${sistemaFiltroDetectado}** (todos ativos):\n\n` +
      clientesDoSistemaDetectado.map((c, i) =>
        `${i + 1}. **${c.nome_fantasia || c.razao_social}** (CNPJ: \`${c.cnpj}\`) — Status: ${c.is_ativo ? '🟢 Ativo' : '🔴 Inativo'} | Cidade: ${c.cidade || '—'}/${c.uf || '—'}`
      ).join('\n') + `\n\n` +
      `[ACTION:NAVIGATE|/dashboard/clientes|👥 Ver Todos os Clientes no Hub]`;
  } else if (contextoDadosBanco) {
    respostaFallback = `### 🤖 Relatório de Auditoria Robotech:\n\n` +
      `Consultei as bases do sistema em tempo real:\n\n${contextoDadosBanco}\n\n` +
      `[ACTION:NAVIGATE|/dashboard/clientes|👥 Abrir Gestão de Clientes]`;
  } else if (contextoArtigosFiscal) {
    respostaFallback = `### 🤖 Robotech - Base Jurídica e Normativa:\n\n${contextoArtigosFiscal}\n\n` +
      `[ACTION:NAVIGATE|/dashboard/relatorios|👉 Ir para Relatórios Fiscais]`;
  } else {
    respostaFallback = `Olá! Sou o **Robotech**, assistente fiscal e analista inteligente da Paratech. Posso auditar suas notas fiscais, calcular vendas por PIX/Cartão/Dinheiro, apurar monofásicos para desconto no Simples Nacional e esclarecer regras da Reforma Tributária (LC 214/2025). O que você gostaria de auditar agora?`;
  }

  return {
    resposta: respostaFallback,
    provedor: 'Robotech Engine RAG Local',
    isLiveIa: false,
    fontesRAG,
    dadosAuditados
  };
}
