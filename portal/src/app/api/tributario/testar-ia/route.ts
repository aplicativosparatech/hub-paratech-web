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
      msg: isSucesso ? `Conectado com sucesso em ${duracaoMs}ms!` : 'Não foi possível obter resposta desta IA. Verifique a chave ou endpoint.'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
