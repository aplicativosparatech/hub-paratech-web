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
      const lastErr = (globalThis as any).__lastGeminiError;
      if (lastErr) {
        if (lastErr.includes('API key not valid') || lastErr.includes('API_KEY_INVALID')) {
          mensagemRetorno = 'Chave da API do Google Gemini inválida. Verifique se copiou a chave completa no Google AI Studio (geralmente começa com AIzaSy...).';
        } else if (lastErr.includes('RESOURCE_EXHAUSTED') || lastErr.includes('quota') || lastErr.includes('capacity')) {
          mensagemRetorno = 'Cota do modelo Gemini Pro esgotada no Google AI Studio. Dica: selecione o modelo "Gemini 1.5 Flash" ou "Gemini 2.0 Flash" que tem limites muito maiores e 100% gratuitos!';
        } else {
          mensagemRetorno = `Google API: ${lastErr}`;
        }
      } else {
        mensagemRetorno = 'Não foi possível obter resposta desta IA. Verifique a chave ou endpoint.';
      }
    }

    // Se o teste foi um sucesso, já salva a configuração no Supabase automaticamente!
    if (isSucesso && provedor) {
      try {
        const supabase = createAdminClient();
        await supabase.from('integracoes').upsert({
          provedor,
          tipo: provedor.startsWith('mcp') ? 'mcp' : 'ia',
          is_ativo: true,
          credenciais: {
            ...credenciais,
            api_key: (credenciais?.api_key || '').trim(),
            model: credenciais?.model || 'gemini-1.5-flash'
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
