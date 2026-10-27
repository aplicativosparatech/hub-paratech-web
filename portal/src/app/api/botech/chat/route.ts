import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { processarRobotechRAG } from '@/utils/rag/robotechEngine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history = [], context = {} } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensagem não informada.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Obter Chave do Gemini em Ambiente ou Banco de Dados (Integrações)
    let geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!geminiKey) {
      try {
        const { data: integracoes } = await supabase
          .from('integracoes')
          .select('credenciais, provedor, is_ativo')
          .eq('is_ativo', true)
          .or('provedor.eq.gemini,provedor.eq.google');
        if (integracoes && integracoes.length > 0) {
          const creds = integracoes[0].credenciais || {};
          geminiKey = (creds.api_key || creds.apiKey || creds.token || '').trim();
        }
      } catch (err) {
        console.warn('Erro ao carregar chave do Gemini no banco:', err);
      }
    }

    // 2. Executar Motor RAG Completo (Semântico + Auditoria Dinâmica de Dados + Gemini IA)
    const resultado = await processarRobotechRAG(supabase, {
      mensagem: message,
      historico: Array.isArray(history) ? history.map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        content: h.content || h.text || ''
      })) : [],
      contextoUsuario: {
        userRole: (context.userRole as 'admin' | 'contabilidade' | 'cliente') || 'admin',
        clienteId: context.clienteId || null,
        clientesPermitidos: Array.isArray(context.clientesPermitidos) ? context.clientesPermitidos : []
      },
      geminiKey
    });

    return NextResponse.json({
      resposta: resultado.resposta,
      provedor: resultado.provedor,
      isLiveIa: resultado.isLiveIa,
      fontesRAG: resultado.fontesRAG,
      dadosAuditados: resultado.dadosAuditados
    });

  } catch (err: any) {
    console.error('Erro crítico no Robotech RAG:', err);
    return NextResponse.json({
      resposta: 'Olá! Sou o **Robotech**, assistente e auditor fiscal oficial da **Paratech**! 🤖\n\nEstou à sua disposição para auditar notas fiscais, apurar faturamento no PIX, calcular créditos de produtos monofásicos e tirar dúvidas sobre a Reforma Tributária (LC 214/2025). Como posso te ajudar?',
      provedor: 'Robotech Offline Fallback',
      isLiveIa: false
    }, { status: 200 });
  }
}
