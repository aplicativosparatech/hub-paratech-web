import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { auditarItemComMultiIa, IaProviderConfig } from '@/utils/tributario/multiIaEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provedor, credenciais } = body;

    if (!provedor) {
      return NextResponse.json({ error: 'Provedor não informado' }, { status: 400 });
    }

    // Cria configuração temporária para testar
    const configTeste: IaProviderConfig = {
      provedor,
      tipo: provedor.startsWith('mcp') ? 'mcp' : 'ia',
      is_ativo: true,
      credenciais: credenciais || {}
    };

    const inicio = Date.now();
    const resultado = await auditarItemComMultiIa(
      {
        codigo: 'TESTE-01',
        descricao: 'REFRIGERANTE COCA COLA LATA 350ML',
        ncmAtual: '22021000',
        cestAtual: '0301000',
        cfopAtual: '5405',
        csosnAtual: '500',
        valor: 5.50,
        crt: 1,
        uf: 'MG'
      },
      [configTeste],
      false
    );
    const duracaoMs = Date.now() - inicio;

    const resp = resultado.vencedor;
    const isSucesso = resp.provedor !== 'nativo' || provedor === 'nativo';

    let mensagemRetorno = isSucesso ? `Conectado com sucesso em ${duracaoMs}ms via ${resp.nomeProvedor}!` : '';

    if (!isSucesso) {
      let lastErr = '';
      if (provedor === 'gemini') {
        lastErr = (globalThis as any).__lastGeminiError || '';
        if (lastErr.includes('API key not valid') || lastErr.includes('API_KEY_INVALID') || lastErr.includes('401')) {
          mensagemRetorno = 'Chave da API do Google Gemini inválida. Verifique se copiou a chave completa no Google AI Studio (geralmente começa com AIzaSy...).';
        } else if (lastErr.includes('RESOURCE_EXHAUSTED') || lastErr.includes('quota') || lastErr.includes('capacity') || lastErr.includes('429')) {
          mensagemRetorno = 'Cota esgotada no Google AI Studio. Dica: selecione o modelo "Gemini 2.5 Flash" ou "Gemini 1.5 Flash" que tem limites gratuitos muito maiores!';
        } else if (lastErr.includes('no longer available') || lastErr.includes('not found') || lastErr.includes('404')) {
          mensagemRetorno = 'O modelo anterior do Gemini foi descontinuado pelo Google. O sistema já o atualizou para o novo modelo oficial "Gemini 2.5 Flash".';
        } else if (lastErr) {
          mensagemRetorno = `Google API: ${lastErr}`;
        }
      } else if (provedor === 'groq') {
        lastErr = (globalThis as any).__lastGroqError || '';
        if (lastErr.includes('Invalid API Key') || lastErr.includes('invalid_api_key') || lastErr.includes('401')) {
          mensagemRetorno = 'Chave de API do Groq inválida. Obtenha sua chave gratuita em console.groq.com/keys (começa com gsk_...).';
        } else if (lastErr.includes('rate_limit') || lastErr.includes('429') || lastErr.includes('Tokens per minute') || lastErr.includes('TPM')) {
          mensagemRetorno = 'Limite de requisições por minuto atingido no Groq Cloud. Aguarde alguns segundos e clique em Testar Conexão novamente.';
        } else if (lastErr.includes('does not exist') || lastErr.includes('access to it')) {
          mensagemRetorno = 'O modelo solicitado não está habilitado na sua conta Groq. O sistema já selecionou o modelo oficial "Llama 3.3 70B Versatile".';
        } else if (lastErr) {
          mensagemRetorno = `Groq API: ${lastErr}`;
        }
      } else if (provedor === 'openai') {
        lastErr = (globalThis as any).__lastOpenAiError || '';
        if (lastErr.includes('Incorrect API key') || lastErr.includes('401')) {
          mensagemRetorno = 'Chave da API da OpenAI inválida (sk-...).';
        } else if (lastErr.includes('insufficient_quota') || lastErr.includes('quota')) {
          mensagemRetorno = 'Sua conta da OpenAI está sem créditos de API.';
        } else if (lastErr) {
          mensagemRetorno = `OpenAI API: ${lastErr}`;
        }
      } else if (provedor === 'claude') {
        lastErr = (globalThis as any).__lastClaudeError || '';
        if (lastErr.includes('401') || lastErr.includes('invalid x-api-key')) {
          mensagemRetorno = 'Chave da API da Anthropic Claude inválida.';
        } else if (lastErr) {
          mensagemRetorno = `Anthropic Claude: ${lastErr}`;
        }
      }

      if (!mensagemRetorno) {
        mensagemRetorno = lastErr ? `Erro: ${lastErr}` : 'Não foi possível obter resposta desta IA. Verifique a chave ou endpoint.';
      }
    }

    // Se o teste foi um sucesso, já salva a configuração no Supabase automaticamente com o modelo adequado!
    if (isSucesso && provedor) {
      try {
        const modeloPadraoPorProvedor: Record<string, string> = {
          gemini: 'gemini-2.5-flash',
          groq: 'llama-3.3-70b-versatile',
          openai: 'gpt-4o-mini',
          claude: 'claude-3-5-haiku-20241022',
          ollama: 'llama3'
        };

        let modeloEscolhido = credenciais?.model;
        if (!modeloEscolhido || (provedor === 'gemini' && modeloEscolhido.includes('2.0'))) {
          modeloEscolhido = modeloPadraoPorProvedor[provedor] || 'gemini-2.5-flash';
        }

        const supabase = createAdminClient();
        await supabase.from('integracoes').upsert({
          provedor,
          tipo: provedor.startsWith('mcp') ? 'mcp' : 'ia',
          is_ativo: true,
          credenciais: {
            ...credenciais,
            api_key: (credenciais?.api_key || '').trim(),
            model: modeloEscolhido
          }
        }, { onConflict: 'provedor' });
      } catch (saveErr) {
        console.warn('Aviso: Falha ao auto-salvar integração no teste:', saveErr);
      }
    }

    return NextResponse.json({
      success: isSucesso,
      duracaoMs,
      provedor: resp.nomeProvedor,
      ncmSugerido: resp.ncmSugerido,
      cestSugerido: resp.cestSugerido,
      cfopSugerido: resp.cfopSugerido,
      ibsAliq: resp.ibsAliqEstimada,
      cbsAliq: resp.cbsAliqEstimada,
      ivaDual: resp.ivaDualTotal,
      justificativa: resp.justificativa,
      msg: mensagemRetorno
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
