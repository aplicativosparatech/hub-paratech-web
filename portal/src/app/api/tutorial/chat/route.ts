import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// Base de conhecimento especialista do Hub Paratech para fallback sem API Key externa
const BASE_CONHECIMENTO = [
  {
    tags: ['danfe', 'imprimir', 'pdf', 'logo', 'logomarca', 'visualizar danfe'],
    titulo: 'Como emitir e imprimir a DANFE (NF-e e NFC-e)',
    resposta: `### 📄 Como emitir a DANFE no Hub Paratech:
1. Acesse o menu **Notas Fiscais** > **Saídas** (ou **Entradas**).
2. Na tabela de notas, localize o documento fiscal desejado.
3. No final da linha da nota ou no menu de ações, clique no botão azul **"DANFE"** (ou **"DANFE NFC-e"**).
4. O Hub gerará automaticamente o Documento Auxiliar em formato PDF para impressão ou download imediato.
5. **Logomarca personalizada:** Se o cliente possuir logotipo cadastrado no módulo **Clientes**, o sistema estampa a logomarca oficial da empresa diretamente no cabeçalho do documento!
6. **Download em lote:** Você também pode selecionar várias notas e clicar em *"Baixar Selecionadas"* para obter um arquivo compactado ZIP.`
  },
  {
    tags: ['sefaz', 'consulta', 'consultar', 'chave de acesso', 'portal nacional'],
    titulo: 'Como consultar a Nota Fiscal diretamente na SEFAZ',
    resposta: `### 🔍 Consulta de Documentos Fiscais na SEFAZ:
1. Acesse **Notas Fiscais** e encontre o registro desejado.
2. Clique no botão **"Consultar SEFAZ"** (ícone de globo/lupa ao lado do botão DANFE).
3. O Hub Paratech abrirá em uma nova aba a página oficial de consulta pública da SEFAZ (Portal Nacional da NF-e ou SEFAZ estadual como MG, SP, etc.), já copiando a chave de acesso de 44 dígitos para sua área de transferência para agilizar a verificação de autorização e cancelamentos.`
  },
  {
    tags: ['sefaz status', 'status sefaz', 'servidor', 'inoperante', 'instabilidade', 'fora do ar'],
    titulo: 'Monitoramento do Status dos Servidores da SEFAZ',
    resposta: `### 🚦 Como monitorar o Status dos Servidores da SEFAZ:
- **Painel Superior / Menu:** Logo abaixo do logo *Hub Paratech* no menu lateral e no topo da tela, você encontra o **Semáforo SEFAZ** em tempo real.
- **Estados com Atenção:** Clicando no badge de status, abre-se um modal detalhado exibindo a situação dos servidores de cada estado (MG, SP, RJ, RS, PR, etc.), tempo de resposta em milissegundos e ativação de contingência (SVC-AN / SVC-RS).
- **Notificações:** Quando um servidor estadual fica instável ou inoperante, o sistema sinaliza com alertas visuais amarelos ou vermelhos.`
  },
  {
    tags: ['sugestor', 'tributacao', 'ncm', 'cest', 'cfop', 'ocr', 'foto', 'planilha', 'ibs', 'cbs'],
    titulo: 'Como usar o Sugestor Tributário com IA e OCR',
    resposta: `### 🤖 Sugestor Tributário & OCR Fiscal de Produtos:
O **Sugestor Tributário** foi desenvolvido para acelerar o cadastro e a precificação correta de mercadorias:
1. **Digitação direta:** Digite o nome do produto (ex: *"Coca-Cola 2L Pet"*, *"Parafuso Sextavado Aço 3/8"*) e escolha o CRT do cliente (Simples Nacional ou Regime Normal).
2. **Envio de Planilha / TXT:** Arraste uma planilha Excel/CSV ou lista de produtos para tributar centenas de itens de uma só vez.
3. **Leitura por Foto (OCR com IA):** Fotografe etiquetas de prateleira, notas de compra ou cupom fiscal; a Inteligência Artificial extrai os nomes dos produtos e preenche os campos automaticamente.
4. **Campos sugeridos:** NCM (8 dígitos), CEST, CFOP (interno e interestadual), CSOSN/CST, PIS/COFINS e a nova tributação da **Reforma Tributária (IBS e CBS - IVA Dual)**.
5. **Download da Tabela:** Clique em *"Exportar Planilha Tributada"* para baixar todos os dados prontos para importação no seu ERP!`
  },
  {
    tags: ['reforma', 'ibs', 'cbs', 'iva', 'emenda 132', 'lei 214'],
    titulo: 'Adequação à Reforma Tributária (IBS e CBS)',
    resposta: `### 🏛️ Reforma Tributária (IBS & CBS) no Hub Paratech:
O Hub Paratech já está 100% atualizado para a transição da Reforma Tributária (EC 132/2023 e LC 214/2024):
- **IVA Dual:** Cálculo e projeção das alíquotas de **IBS** (estados e municípios) e **CBS** (federal).
- **Classificações especiais:** Identificação automática de itens da *Cesta Básica Nacional (Alíquota Zero)*, *Alíquota Reduzida (60% de desconto)* e regimes específicos.
- **Corretor de XMLs:** Validação dos novos campos fiscais nos arquivos XML para que sua empresa não seja surpreendida durante a virada dos leiautes da SEFAZ.`
  },
  {
    tags: ['cnpj', 'alfanumerico', 'novo formato', 'in 2229', 'receita federal'],
    titulo: 'Suporte ao Novo CNPJ Alfanumérico da Receita Federal',
    resposta: `### 🏢 CNPJ Alfanumérico (Instrução Normativa RFB nº 2.229/2024):
- O Hub Paratech foi um dos primeiros sistemas do Brasil a suportar o novo padrão de **CNPJ Alfanumérico** (que inclui letras de A a Z nas posições da raiz e da ordem, ex: \`12.ABC.345/0001-92\`).
- **Validação Matemática Oficial:** Implementamos o algoritmo oficial Módulo 11 da Receita Federal com conversão ASCII para validação instantânea dos dígitos verificadores.
- **Consulta em Cascata:** Ao digitar o CNPJ, o sistema busca os dados em milissegundos consultando ReceitaWS, BrasilAPI e MinhaReceita com fallback automático e sem risco de bloqueios.`
  },
  {
    tags: ['desktop', 'hub desktop', 'sincronizacao', 'sincronizar', 'pastas', 'windows'],
    titulo: 'Como funciona o Hub Desktop para Windows',
    resposta: `### 🖥️ Hub Desktop (.NET / C#):
- O aplicativo executável roda em segundo plano na bandeja do sistema (System Tray) nos servidores ou computadores das empresas.
- **Monitoramento de Pastas:** Monitora pastas locais de emissão de NF-e e NFC-e do software ERP/PDV.
- **Upload Automático:** Novos XMLs autorizados são compactados e enviados em tempo real para o Portal em nuvem.
- **Checagem de SEFAZ Local:** Faz ping nos WebServices da SEFAZ direto do ambiente do cliente e exibe alertas caso a internet caia ou a SEFAZ entre em contingência.`
  },
  {
    tags: ['saneador', 'limpeza', 'corrigir', 'banco de dados', 'planilha'],
    titulo: 'Como funciona o Saneador de Arquivos',
    resposta: `### 🧹 Saneador de Arquivos & Bancos de Dados:
- Permite carregar arquivos cadastrais corrompidos, planilhas desorganizadas ou listas com NCMs extintos.
- Corrige pontuações, formatações de CNPJ/CPF, preenche alíquotas zeradas indevidamente e sanitiza descrições para atender às normas da fiscalização tributária.`
  },
  {
    tags: ['filtros', 'reaproveitar', 'persistente', 'periodo', 'cliente ativo'],
    titulo: 'Reaproveitamento de Filtros entre Abas',
    resposta: `### 🔄 Filtros Compartilhados e Persistentes:
- Ao selecionar um cliente, contabilidade ou período de datas em qualquer tela de Notas Fiscais (Entradas ou Saídas, NF-e ou NFC-e), esse filtro fica memorizado no seu navegador.
- Ao navegar entre abas de entradas, saídas ou relatórios, você não precisa selecionar o mesmo cliente novamente, economizando tempo no fechamento fiscal do mês!`
  }
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], customApiKey } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem não informada.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Tentar descobrir API Key do Gemini
    let geminiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!geminiKey) {
      try {
        const { data: integracoes } = await supabase
          .from('integracoes')
          .select('*')
          .eq('is_ativo', true)
          .or('provedor.eq.gemini,provedor.eq.google');

        if (integracoes && integracoes.length > 0) {
          geminiKey = integracoes[0].credenciais?.api_key || integracoes[0].credenciais?.token || '';
        }
      } catch (err: any) {
        console.warn('Não foi possível ler integrações do banco:', err.message);
      }
    }

    // 2. Se temos uma chave do Gemini, chamar a API Oficial
    if (geminiKey) {
      try {
        const systemPrompt = `Você é o Copiloto e Assistente Virtual Especialista do Hub Paratech, desenvolvido pela Paratech Soluções & Sistemas.
Seu objetivo é orientar contadores, empresas e operadores de sistema no uso diário do Hub Paratech e em dúvidas fiscais, tributárias e operacionais.

INFORMAÇÕES OFICIAIS DO HUB PARATECH:
- Versão Atual: 2.3
- Fabricante: Paratech Soluções & Sistemas (Portal Oficial: https://hub-paratech-web.vercel.app / Site: https://paratech.net.br)
- Funcionalidades Principais:
  1. Documentos Fiscais (NF-e & NFC-e): Visualização, filtros persistentes entre telas, download de XMLs em lote ZIP, geração de DANFE com a logomarca do cliente, botão de consulta direta na SEFAZ com cópia de chave.
  2. Status da SEFAZ em Tempo Real: Semáforo na barra lateral e modal detalhado de disponibilidade por estado (MG, SP, RJ, RS, etc.).
  3. Sugestor Tributário com IA & OCR: Sugestão de NCM, CEST, CFOP (interno e interestadual), CSOSN/CST, PIS/COFINS monofásicos e novos tributos da Reforma Tributária (IBS e CBS - IVA Dual). Suporta digitação, planilhas e leitura de fotos por OCR.
  4. Corretor Tributário: Validação de regras tributárias e correção de XMLs de NF-e e NFC-e.
  5. Saneador de Arquivos: Higienização de arquivos cadastrais e bases fiscais.
  6. CNPJ Alfanumérico: Suporte completo ao novo padrão da Receita Federal (IN RFB nº 2.229/2024), com busca automática de dados cadastrais via ReceitaWS/BrasilAPI.
  7. Hub Desktop: Agente Windows em .NET/C# que monitora pastas locais de emissão e sincroniza com a nuvem em tempo real.

Diretrizes de Resposta:
- Seja prestativo, didático, ágil e profissional.
- Responda em Português do Brasil com excelente formatação em Markdown (tópicos com emojis, negrito, passos numerados).
- Sempre que a pergunta envolver onde encontrar algo no sistema, indique o caminho exato de menus no Hub Paratech.`;

        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Entendido! Sou o Copiloto Virtual do Hub Paratech e estou pronto para esclarecer qualquer dúvida com clareza, passo a passo e conhecimento aprofundado do sistema e da legislação fiscal brasileira.' }] }
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

        const resGemini = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1500
              }
            }),
            signal: AbortSignal.timeout(15000)
          }
        );

        if (resGemini.ok) {
          const data = await resGemini.json();
          const respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (respostaTexto) {
            return NextResponse.json({
              resposta: respostaTexto,
              provedor: 'Gemini 2.5 Flash (Conectado)',
              isIaLive: true
            });
          }
        }
      } catch (geminiError: any) {
        console.warn('[Copiloto IA] Erro ao chamar API Gemini, recorrendo à base interna:', geminiError.message);
      }
    }

    // 3. Fallback inteligente usando Base de Conhecimento RAG do Hub Paratech
    const msgLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Busca o tópico que melhor pontua nas tags
    let melhorTopico: any = null;
    let maiorPontuacao = 0;

    for (const item of BASE_CONHECIMENTO) {
      let pontos = 0;
      for (const tag of item.tags) {
        const tagNorm = tag.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (msgLower.includes(tagNorm)) {
          pontos += 3;
        } else {
          const palavrasTag = tagNorm.split(' ');
          for (const p of palavrasTag) {
            if (p.length > 3 && msgLower.includes(p)) pontos += 1;
          }
        }
      }
      if (pontos > maiorPontuacao) {
        maiorPontuacao = pontos;
        melhorTopico = item;
      }
    }

    if (melhorTopico && maiorPontuacao >= 2) {
      return NextResponse.json({
        resposta: melhorTopico.resposta,
        titulo: melhorTopico.titulo,
        provedor: 'Base Oficial de Conhecimento Hub Paratech',
        isIaLive: false,
        dica: !geminiKey ? '💡 Dica: Para tirar dúvidas abertas ilimitadas com Inteligência Artificial generativa em tempo real, conecte sua chave gratuita do Google Gemini no menu Integrações.' : undefined
      });
    }

    // Resposta padrão explicativa caso a pergunta seja muito genérica
    const respostaGenerica = `### Olá! Sou o Copiloto Virtual do Hub Paratech 🤖

Posso te ajudar com qualquer dúvida sobre as ferramentas do sistema:

- 📄 **Emissão de DANFE (NF-e e NFC-e)** e inclusão da logo da empresa.
- 🔍 **Consulta pública direta na SEFAZ** com cópia automática de chave de acesso.
- 🚦 **Monitoramento do status dos servidores da SEFAZ** por estado.
- 🤖 **Sugestor Tributário com IA & OCR** para produtos, planilhas e fotos.
- 🏛️ **Reforma Tributária:** Alíquotas de IBS, CBS e IVA Dual.
- 🏢 **CNPJ Alfanumérico:** Consulta cadastral e validação oficial da Receita Federal.
- 🖥️ **Hub Desktop:** Sincronização em tempo real de notas fiscais emitidas no ERP.
- 📊 **Relatórios Fiscais:** Monofásicos, faturamento e auditoria de XMLs.

*Selecione uma das perguntas rápidas acima ou digite o que precisa saber!*`;

    return NextResponse.json({
      resposta: respostaGenerica,
      provedor: 'Base Oficial de Conhecimento Hub Paratech',
      isIaLive: false,
      dica: !geminiKey ? '💡 Para respostas personalizadas em tempo real via IA, configure a chave gratuita do Google Gemini em Integrações (APIs).' : undefined
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar mensagem do copiloto.' }, { status: 500 });
  }
}
