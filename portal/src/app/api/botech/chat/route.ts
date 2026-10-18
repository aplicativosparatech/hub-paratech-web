import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// Conhecimento Geral e Operacional do Hub Paratech
const CONHECIMENTO_SISTEMA = `
VOCÊ É O ROBOTECH, ASSISTENTE VIRTUAL INTELIGENTE OFICIAL DA PARATECH SOLUÇÕES E SISTEMAS.
Seu avatar é um simpático robô de headset com o emblema da Paratech no peito.
Você é prestativo, ágil, simpático, bem-humorado, extremamente competente e didático.
Você conhece profundamente a aplicação "Hub Paratech" e todas as regras fiscais brasileiras (NF-e, NFC-e, SPED, IBS/CBS, Simples Nacional, PIS/COFINS Monofásicos).

INFORMAÇÕES INSTITUCIONAIS DA PARATECH:
- Empresa: Paratech Soluções e Sistemas
- Site Oficial: https://paratechsolucoes.com.br
- Analista Programador Responsável: Regis Alexandre
- WhatsApp Oficial de Suporte: (37) 92000-7857 (Link direto: https://wa.me/5537920007857?text=Ola%20preciso%20de%20suporte%20com%20o%20Hub%20Paratech)
- Horário de atendimento comercial e suporte técnico especializado.

MAPA DE FUNCIONALIDADES E TELAS DO HUB PARATECH:
1. GESTÃO:
   - Contabilidades: Cadastro de escritórios contábeis parceiros, vínculo com empresas clientes.
   - Clientes: Cadastro completo de empresas (CNPJ Alfanumérico, Inscrição Estadual, Regime Tributário CRT 1/2/3, Certificado Digital A1, logotipo personalizado, valor de mensalidade, taxas e carência individuais).
   - Faturas: Controle de mensalidades, geração automática no dia 01 de cada mês, recebimento via Pix dinâmico (Mercado Pago e InfinitePay) com baixa automática por webhook, antecipação automática da fatura seguinte ao quitar, e botão de "Liberar em Confiança" (desbloqueio emergencial de 24h do Hub Desktop).

2. SISTEMA:
   - Notas Fiscais:
     * Saídas (NF-e modelo 55 e NFC-e modelo 65): visualização de itens, totalizadores de venda, emissão de DANFE com logotipo da empresa, consulta pública direta na SEFAZ com chave copiada automaticamente, download individual e em lote (.ZIP), Carta de Correção (CC-e) e Inutilização de numeração.
     * Entradas (NF-e modelo 55): consulta de compras e notas emitidas por fornecedores.
   - Distribuição de DF-e:
     * Consulta automática de documentos fiscais emitidos contra o CNPJ da empresa direto do Ambiente Nacional da SEFAZ.
     * Manifestação do Destinatário: Ciência da Operação, Confirmação da Operação, Desconhecimento da Operação e Operação não Realizada.
     * Download instantâneo do XML completo após a manifestação.
   - Relatórios:
     * Relatório de Produtos Monofásicos (PIS/COFINS): Essencial para empresas do Simples Nacional (farmácias, autopeças, combustíveis, bebidas, cosméticos). Permite segregar as receitas dos produtos monofásicos para abater o valor do PIS e da COFINS no cálculo do DAS (PGDAS-D), gerando economia tributária legal ou recuperação de impostos! Exportação em Excel, CSV e PDF.
     * Relatórios de Faturamento por período e por modalidade de pagamento (PIX, Dinheiro, Cartão).
     * Relatório de Auditoria e Divergências de XMLs.
   - Analisador / Corretor Tributário:
     * Validação de XMLs recebidos e emitidos contra regras do Convênio ICMS 142/2018 e LC 214/2024.
     * Cálculo e auditoria dos novos tributos da Reforma Tributária: IBS estadual/municipal e CBS federal (IVA Dual).

3. EXTRAS:
   - Sugestor Tributário com IA & OCR:
     * Sugere NCM, CEST, CFOP, CSOSN/CST e alíquotas a partir do nome do produto.
     * Suporta digitação direta, importação de planilhas Excel/TXT ou leitura de fotos de etiquetas e notas por OCR inteligente.
   - Saneador de Arquivos:
     * Limpeza e padronização de arquivos cadastrais de produtos e clientes corrompidos ou desorganizados.

4. ÁREA TÉCNICA:
   - Permissões: Controle granular de módulos acessíveis por Administrador, Contabilidade e Cliente.
   - Aparência: Modo Clean (minimalista e rápido) vs Modo Clássico (cards e gradientes), tema Claro / Escuro, modo Kiosk tela cheia.
   - Configurações do Portal: Regras de processamento de XMLs, avisos de certificados A1 e Regras Globais de Cobrança (multa 2%, juros 1% a.m., carência 3 dias, limites de desbloqueio em confiança).
   - Integrações & APIs: Conexão com Google Gemini, WhatsApp (Uazapi / Evolution), Gateways de Pagamento (Mercado Pago, InfinitePay), Alterdata ERP.

5. HUB DESKTOP (AGENTE WINDOWS):
   - Aplicativo executável em C# / .NET que fica na bandeja do sistema (System Tray).
   - Inicia junto com o Windows, monitora as pastas de XMLs locais do PDV/ERP e envia em tempo real para a nuvem.
   - Em caso de inadimplência, recebe a ordem de bloqueio do portal, mas permite Desbloqueio em Confiança configurável.

COMO RESPONDER:
- Sempre responda em Português do Brasil de forma simpática, clara e objetiva.
- Use emojis amigáveis no início de tópicos.
- Quando o usuário perguntar como fazer algo ou onde encontrar uma função, explique passo a passo e SEMPRE ofereça para guiá-lo até a tela com o formato de ação:
  [ACTION:NAVIGATE|/dashboard/relatorios|👉 Ir para Relatórios Monofásicos]
  [ACTION:NAVIGATE|/dashboard/faturas|💳 Ver Minhas Faturas]
  [ACTION:NAVIGATE|/dashboard/distribuicao-dfe|📥 Ir para Distribuição DF-e]
  [ACTION:NAVIGATE|/dashboard/notas-fiscais|📄 Ir para Notas Fiscais]
  [ACTION:NAVIGATE|/dashboard/corretor-tributario|⚖️ Ir para Analisador Tributário]
  [ACTION:NAVIGATE|/dashboard/sugestor-tributario|🤖 Ir para Sugestor Tributário]
  [ACTION:NAVIGATE|/dashboard/configuracoes-portal?aba=cobranca|⚙️ Ver Regras Globais de Cobrança]
  [ACTION:WHATSAPP|https://wa.me/5537920007857?text=Ola%20RoboTech%20me%20atendeu%20no%20Hub%20e%20gostaria%20de%20falar%20com%20o%20suporte|📲 Falar com Suporte Paratech no WhatsApp]
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], context = {} } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem não informada.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const clienteId = context.clienteId || null;
    const msgLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Consulta Contextual de Dados no Banco de Dados Supabase (RAG em Tempo Real)
    let dadosContexto = '';

    // A) Se perguntou sobre FATURA / VENCIMENTO / VALOR / MENSALIDADE / PAGAMENTO
    if (msgLower.includes('fatura') || msgLower.includes('vencimento') || msgLower.includes('mensalidade') || msgLower.includes('boleto') || msgLower.includes('pagar') || msgLower.includes('quanto devo')) {
      try {
        let faturasQuery = supabase.from('faturas').select('id, competencia, valor, data_vencimento, status, valor_original, valor_multa, valor_juros, pix_copia_cola, clientes(razao_social, nome_fantasia)');
        if (clienteId) {
          faturasQuery = faturasQuery.eq('cliente_id', clienteId);
        }
        const { data: faturas } = await faturasQuery.order('data_vencimento', { ascending: false }).limit(3);
        if (faturas && faturas.length > 0) {
          dadosContexto += `\n[DADOS REAIS DO BANCO - FATURAS]:\n` + faturas.map(f => 
            `- Competência: ${f.competencia} | Valor: R$ ${Number(f.valor).toFixed(2)} (Original: R$ ${Number(f.valor_original || f.valor).toFixed(2)}, Multa: R$ ${Number(f.valor_multa || 0).toFixed(2)}, Juros: R$ ${Number(f.valor_juros || 0).toFixed(2)}) | Vencimento: ${f.data_vencimento} | Status: ${f.status.toUpperCase()} | Empresa: ${(f.clientes as any)?.nome_fantasia || (f.clientes as any)?.razao_social || 'Cliente'}`
          ).join('\n') + `\n`;
        } else {
          dadosContexto += `\n[DADOS REAIS DO BANCO - FATURAS]: Nenhuma fatura pendente encontrada para esta empresa no momento.\n`;
        }
      } catch (e: any) {
        console.warn('Erro ao buscar faturas no Rorobotech:', e.message);
      }
    }

    // B) Se perguntou sobre VENDAS / PIX / NFCE / FATURAMENTO / NOTAS EMITIDAS
    if (msgLower.includes('venda') || msgLower.includes('pix') || msgLower.includes('nfce') || msgLower.includes('nfe') || msgLower.includes('faturamento') || msgLower.includes('quanto emiti') || msgLower.includes('total')) {
      try {
        let nfceQuery = supabase.from('nfce_saidas').select('valor, formas_pagamento, data_emissao');
        let nfeQuery = supabase.from('nfe_saidas').select('valor, formas_pagamento, data_emissao');

        if (clienteId) {
          nfceQuery = nfceQuery.eq('cliente_id', clienteId);
          nfeQuery = nfeQuery.eq('cliente_id', clienteId);
        }

        const [{ data: nfces }, { data: nfes }] = await Promise.all([
          nfceQuery.limit(500),
          nfeQuery.limit(500)
        ]);

        let totalNfce = 0;
        let totalPixNfce = 0;
        let totalDinheiroNfce = 0;
        let totalCartaoNfce = 0;
        let qtdNfce = (nfces || []).length;

        (nfces || []).forEach(nf => {
          const val = Number(nf.valor || 0);
          totalNfce += val;
          const formas = Array.isArray(nf.formas_pagamento) ? nf.formas_pagamento : [];
          formas.forEach((fp: any) => {
            const vFp = Number(fp.valor || 0);
            const cod = String(fp.codigo || '');
            const nome = String(fp.nome || '').toUpperCase();
            if (cod === '17' || cod === '20' || nome.includes('PIX')) {
              totalPixNfce += vFp;
            } else if (cod === '01' || nome.includes('DINHEIRO')) {
              totalDinheiroNfce += vFp;
            } else if (['03', '04'].includes(cod) || nome.includes('CARTAO') || nome.includes('CREDITO') || nome.includes('DEBITO')) {
              totalCartaoNfce += vFp;
            }
          });
        });

        let totalNfe = 0;
        let qtdNfe = (nfes || []).length;
        (nfes || []).forEach(nf => {
          totalNfe += Number(nf.valor || 0);
        });

        dadosContexto += `\n[DADOS REAIS DO BANCO - VENDAS E EMISSÕES]:\n` +
          `- Total NFC-e (Modelo 65): ${qtdNfce} notas emitidas, somando R$ ${totalNfce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `  * Vendas via PIX na NFC-e: R$ ${totalPixNfce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `  * Vendas em Dinheiro na NFC-e: R$ ${totalDinheiroNfce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `  * Vendas em Cartão (Crédito/Débito) na NFC-e: R$ ${totalCartaoNfce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- Total NF-e (Modelo 55): ${qtdNfe} notas emitidas, somando R$ ${totalNfe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `- Faturamento Global Consolidado: R$ ${(totalNfce + totalNfe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      } catch (e: any) {
        console.warn('Erro ao calcular vendas no Rorobotech:', e.message);
      }
    }

    // C) Se perguntou sobre CERTIFICADO DIGITAL
    if (msgLower.includes('certificado') || msgLower.includes('validade') || msgLower.includes('vencimento certificado') || msgLower.includes('a1')) {
      try {
        let certQuery = supabase.from('certificados_digitais').select('*');
        if (clienteId) certQuery = certQuery.eq('cliente_id', clienteId);
        const { data: certs } = await certQuery.limit(1);
        if (certs && certs.length > 0) {
          const c = certs[0];
          dadosContexto += `\n[DADOS REAIS DO BANCO - CERTIFICADO DIGITAL A1]:\n` +
            `- Titular: ${c.titular || 'Empresa'} | CNPJ/CPF: ${c.cnpj_cpf || '—'} | Validade: ${c.data_validade || '—'}\n`;
        }
      } catch (e: any) {
        console.warn('Erro ao buscar certificado no Rorobotech:', e.message);
      }
    }

    // D) Dados da Empresa Ativa
    if (clienteId) {
      try {
        const { data: cli } = await supabase.from('clientes').select('razao_social, nome_fantasia, cnpj, regime_tributario, dia_vencimento, valor_mensalidade').eq('id', clienteId).single();
        if (cli) {
          dadosContexto += `\n[EMPRESA SELECIONADA ATUALMENTE]:\n` +
            `- Nome: ${cli.nome_fantasia || cli.razao_social} | Razão Social: ${cli.razao_social} | CNPJ: ${cli.cnpj} | Regime: ${cli.regime_tributario || 'Simples Nacional'} | Mensalidade Base: R$ ${Number(cli.valor_mensalidade || 0).toFixed(2)} (Vencimento Dia ${cli.dia_vencimento || 10})\n`;
        }
      } catch {}
    }

    // 2. Buscar API Key do Gemini no Banco ou Ambiente
    let geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!geminiKey) {
      try {
        const { data: integracoes } = await supabase
          .from('integracoes')
          .select('credenciais')
          .eq('is_ativo', true)
          .or('provedor.eq.gemini,provedor.eq.google');
        if (integracoes && integracoes.length > 0) {
          geminiKey = integracoes[0].credenciais?.api_key || integracoes[0].credenciais?.token || '';
        }
      } catch {}
    }

    // 3. Execução com Gemini AI se a chave estiver presente
    if (geminiKey) {
      try {
        const fullSystemInstruction = CONHECIMENTO_SISTEMA + (dadosContexto ? `\n\nESTES SÃO OS DADOS ATUAIS EXTRAÍDOS EM TEMPO REAL DO BANCO DE DADOS PARA ESTA CONVERSA:\n${dadosContexto}\nUtilize esses dados reais com precisão caso o usuário pergunte sobre faturas, vendas no pix, nfce, notas ou certificados.` : '');

        const contents: any[] = [
          { role: 'user', parts: [{ text: fullSystemInstruction }] },
          { role: 'model', parts: [{ text: 'Olá! Sou o RoboTech, assistente virtual inteligente da Paratech. Estou pronto para tirar qualquer dúvida, orientar o uso do sistema, consultar dados fiscais e guiar você por cada tela do Hub Paratech!' }] }
        ];

        // Anexar histórico recente
        if (Array.isArray(history)) {
          for (const msg of history.slice(-6)) {
            contents.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }]
            });
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        // Esteira moderna com modelos de alta disponibilidade e resposta ultrarrápida
        const modelNames = [
          'gemini-3.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-3.6-flash',
          'gemini-flash-lite-latest',
          'gemini-3.8-flash',
          'gemini-flash-latest'
        ];

        for (const model of modelNames) {
          try {
            const resGemini = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents,
                  generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1200
                  }
                }),
                signal: AbortSignal.timeout(4500)
              }
            );

            if (resGemini.ok) {
              const data = await resGemini.json();
              const respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (respostaTexto) {
                return NextResponse.json({
                  resposta: respostaTexto,
                  provedor: `Gemini AI (${model})`,
                  isLiveIa: true
                });
              }
            } else {
              const errBody = await resGemini.text().catch(() => '');
              console.warn(`[RoboTech AI] Modelo ${model} retornou status ${resGemini.status}:`, errBody.slice(0, 120));
            }
          } catch (modelErr: any) {
            console.warn(`[RoboTech AI] Tentativa com ${model} falhou:`, modelErr.message);
          }
        }
      } catch (errG: any) {
        console.warn('Erro na comunicação do Gemini no RoboTech:', errG.message);
      }
    }

    // 4. Fallback RAG Inteligente Especialista do RoboTech (Caso Gemini falhe ou demore)
    let respostaFallback = '';

    if (msgLower.includes('monofasico') || msgLower.includes('relatorio')) {
      respostaFallback = `### 📊 Como emitir o Relatório de Produtos Monofásicos:\n\n` +
        `O relatório de **PIS/COFINS Monofásicos** é fundamental para empresas do Simples Nacional segregarem receitas e abaterem impostos no PGDAS:\n\n` +
        `1. Acesse o menu **Sistema** > **Relatórios**.\n` +
        `2. Selecione a aba **Produtos Monofásicos**.\n` +
        `3. Escolha a empresa cliente e o período desejado (mês de apuração).\n` +
        `4. O sistema lista automaticamente todos os itens vendidos com NCM monofásico e o valor a deduzir.\n` +
        `5. Clique em **Exportar Excel/CSV** ou **Gerar PDF** para enviar à contabilidade!\n\n` +
        `Deseja que eu te leve direto para a tela de Relatórios?\n\n` +
        `[ACTION:NAVIGATE|/dashboard/relatorios|👉 Ir para Relatórios Monofásicos]`;
    } else if (msgLower.includes('pix') && (msgLower.includes('venda') || msgLower.includes('nfce') || msgLower.includes('quanto'))) {
      if (dadosContexto.includes('VENDAS E EMISSÕES')) {
        respostaFallback = `### 💰 Resumo de Vendas no PIX (NFC-e):\n\n` +
          `Consultei as notas fiscais emitidas no sistema:\n\n` +
          dadosContexto.replace(/\[.*?\]/g, '').trim() + `\n\n` +
          `Deseja consultar os documentos fiscais em detalhes?\n\n` +
          `[ACTION:NAVIGATE|/dashboard/notas-fiscais|📄 Ver Notas Fiscais no Portal]`;
      } else {
        respostaFallback = `### 💰 Vendas via PIX na NFC-e:\n\n` +
          `Para visualizar o total de vendas por PIX:\n` +
          `1. Acesse **Notas Fiscais** > **Saídas (NFC-e)**.\n` +
          `2. Na coluna **Forma de Pagamento**, filtre ou visualize as notas com etiqueta **PIX**.\n` +
          `3. Você também pode conferir o somatório no módulo **Relatórios**.\n\n` +
          `[ACTION:NAVIGATE|/dashboard/notas-fiscais/saidas/nfce|👉 Ver NFC-e de Saídas]`;
      }
    } else if (msgLower.includes('fatura') || msgLower.includes('vencimento') || msgLower.includes('valor')) {
      if (dadosContexto.includes('FATURAS')) {
        respostaFallback = `### 💳 Informações da sua Fatura:\n\n` +
          dadosContexto.replace(/\[.*?\]/g, '').trim() + `\n\n` +
          `Você pode copiar o Pix Copia e Cola instantâneo ou visualizar o recibo diretamente no menu de Faturas:\n\n` +
          `[ACTION:NAVIGATE|/dashboard/faturas|💳 Ir para Minhas Faturas]`;
      } else {
        respostaFallback = `### 💳 Faturas e Pagamentos do Hub Paratech:\n\n` +
          `O sistema gera as faturas automaticamente no **dia 01 de cada mês** com pagamento via Pix (Mercado Pago ou InfinitePay) com baixa automática imediata.\n\n` +
          `Acesse o menu **Gestão** > **Faturas** para consultar valores, vencimentos e QR Code Pix.\n\n` +
          `[ACTION:NAVIGATE|/dashboard/faturas|💳 Ver Faturas e Mensalidades]`;
      }
    } else if (msgLower.includes('contato') || msgLower.includes('paratech') || msgLower.includes('suporte') || msgLower.includes('telefone') || msgLower.includes('whatsapp')) {
      respostaFallback = `### 📞 Como entrar em contato com a Paratech:\n\n` +
        `A equipe técnica da Paratech está à sua disposição:\n\n` +
        `- 🏢 **Empresa:** Paratech Soluções e Sistemas\n` +
        `- 👨‍💻 **Analista Responsável:** Regis Alexandre\n` +
        `- 📱 **WhatsApp de Suporte:** (37) 92000-7857\n` +
        `- 🌐 **Site Oficial:** [paratechsolucoes.com.br](https://paratechsolucoes.com.br)\n\n` +
        `Clique abaixo para abrir uma conversa direta no WhatsApp:\n\n` +
        `[ACTION:WHATSAPP|https://wa.me/5537920007857?text=Ola%20RoboTech%20me%20atendeu%20no%20Hub%20e%20gostaria%20de%20falar%20com%20o%20suporte|📲 Falar com Suporte Paratech no WhatsApp]`;
    } else {
      respostaFallback = `### Olá! Eu sou o RoboTech 🤖\n\n` +
        `Sou o assistente de inteligência artificial da **Paratech** e estou aqui para te ajudar em tudo!\n\n` +
        `Aqui estão algumas das coisas que posso fazer por você:\n` +
        `- 📊 **Explicar e guiar** até relatórios fiscais (como produtos monofásicos).\n` +
        `- 💰 **Informar dados de faturamento** e quanto sua empresa vendeu no Pix por NFC-e.\n` +
        `- 💳 **Consultar valores e vencimentos** da sua fatura ou mensalidade.\n` +
        `- 🔍 **Ensinar a consultar notas** diretamente na SEFAZ ou manifestar DF-e.\n` +
        `- 📞 **Conectar você** diretamente ao suporte oficial da Paratech.\n\n` +
        `*O que você gostaria de saber agora?*`;
    }

    return NextResponse.json({
      resposta: respostaFallback,
      provedor: 'Base Oficial RoboTech RAG',
      isLiveIa: false
    });

  } catch (err: any) {
    console.error('Erro na rota do RoboTech:', err);
    return NextResponse.json({
      resposta: 'Olá! Sou o **RoboTech**, assistente virtual da **Paratech**! 🤖\n\nEstou à sua disposição para te orientar sobre o uso do Hub, emissão de relatórios monofásicos, consulta de faturas e notas fiscais. Como posso te ajudar?',
      provedor: 'RoboTech Offline Fallback',
      isLiveIa: false
    }, { status: 200 });
  }
}
