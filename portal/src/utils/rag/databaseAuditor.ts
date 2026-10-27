/**
 * Motor de Auditoria e Consultas Dinâmicas de Banco de Dados para o RAG do Robotech IA.
 * Executa análises fiscais, cálculos de vendas, verificação de inadimplência e auditoria de XMLs
 * respeitando com rigor o perfil de acesso (Multi-Tenant Seguro).
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface ContextoAuditoriaSegura {
  userRole: 'admin' | 'contabilidade' | 'cliente';
  clienteIdFoco?: string | null;
  idsAutorizados: Set<string>;
}

export interface ResultadoAuditoriaMonofasicos {
  empresaNome: string;
  cnpj: string;
  totalNotasEmitidas: number;
  faturamentoTotal: number;
  totalMonofasicoSegregavel: number;
  baseTributavelRestante: number;
  economiaEstimadaDas: number; // ~2.5% a 3.5% sobre o monofásico dependendo do anexo
  principaisNcmMonofasicos: { ncm: string; descricao: string; totalVendido: number }[];
}

export class DatabaseAuditor {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 1. Auditoria de Monofásicos e Economia no PGDAS-D
   */
  async auditarMonofasicosSimples(
    contexto: ContextoAuditoriaSegura,
    diasAtras: number = 30
  ): Promise<ResultadoAuditoriaMonofasicos | null> {
    const clienteId = contexto.clienteIdFoco || (contexto.idsAutorizados.size === 1 ? Array.from(contexto.idsAutorizados)[0] : null);
    if (!clienteId || !contexto.idsAutorizados.has(clienteId)) return null;

    // Busca dados da empresa
    const { data: cliente } = await this.supabase
      .from('clientes')
      .select('razao_social, nome_fantasia, cnpj, regime_tributario')
      .eq('id', clienteId)
      .single();

    if (!cliente) return null;

    // Data de corte
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - diasAtras);
    const dataIso = dataCorte.toISOString();

    // Busca NFC-e e NF-e do período
    const [resNfce, resNfe] = await Promise.all([
      this.supabase
        .from('nfce_saidas')
        .select('valor, valor_monofasico, data_emissao')
        .eq('cliente_id', clienteId)
        .gte('data_emissao', dataIso),
      this.supabase
        .from('nfe_saidas')
        .select('valor, valor_monofasico, data_emissao')
        .eq('cliente_id', clienteId)
        .gte('data_emissao', dataIso)
    ]);

    const nfces = resNfce.data || [];
    const nfes = resNfe.data || [];
    const totalNotas = nfces.length + nfes.length;

    let faturamentoTotal = 0;
    let totalMonofasico = 0;

    nfces.forEach(n => {
      faturamentoTotal += Number(n.valor || 0);
      totalMonofasico += Number(n.valor_monofasico || 0);
    });

    nfes.forEach(n => {
      faturamentoTotal += Number(n.valor || 0);
      totalMonofasico += Number(n.valor_monofasico || 0);
    });

    const baseTributavelRestante = Math.max(0, faturamentoTotal - totalMonofasico);
    // Estimativa conservadora de economia média de PIS/COFINS no Simples Nacional: ~3.05%
    const economiaEstimada = totalMonofasico * 0.0305;

    return {
      empresaNome: cliente.nome_fantasia || cliente.razao_social,
      cnpj: cliente.cnpj,
      totalNotasEmitidas: totalNotas,
      faturamentoTotal,
      totalMonofasicoSegregavel: totalMonofasico,
      baseTributavelRestante,
      economiaEstimadaDas: economiaEstimada,
      principaisNcmMonofasicos: []
    };
  }

  /**
   * 2. Consulta Avançada de Vendas & Meios de Pagamento (PIX, Dinheiro, Cartão)
   */
  async consultarMetricasVendas(
    contexto: ContextoAuditoriaSegura,
    filtroPeriodo?: 'hoje' | '7dias' | 'mes_atual' | 'tudo'
  ) {
    let queryNfce = this.supabase.from('nfce_saidas').select('valor, valor_monofasico, formas_pagamento, data_emissao, cliente_id');
    let queryNfe = this.supabase.from('nfe_saidas').select('valor, valor_monofasico, data_emissao, cliente_id');

    if (contexto.clienteIdFoco) {
      queryNfce = queryNfce.eq('cliente_id', contexto.clienteIdFoco);
      queryNfe = queryNfe.eq('cliente_id', contexto.clienteIdFoco);
    } else if (contexto.userRole !== 'admin' && contexto.idsAutorizados.size > 0) {
      const ids = Array.from(contexto.idsAutorizados);
      queryNfce = queryNfce.in('cliente_id', ids);
      queryNfe = queryNfe.in('cliente_id', ids);
    }

    if (filtroPeriodo === 'hoje') {
      const hoje = new Date().toISOString().split('T')[0];
      queryNfce = queryNfce.gte('data_emissao', hoje);
      queryNfe = queryNfe.gte('data_emissao', hoje);
    } else if (filtroPeriodo === '7dias') {
      const seteDias = new Date();
      seteDias.setDate(seteDias.getDate() - 7);
      queryNfce = queryNfce.gte('data_emissao', seteDias.toISOString());
      queryNfe = queryNfe.gte('data_emissao', seteDias.toISOString());
    } else if (filtroPeriodo === 'mes_atual') {
      const primeiroDiaMes = new Date();
      primeiroDiaMes.setDate(1);
      const strMes = primeiroDiaMes.toISOString().split('T')[0];
      queryNfce = queryNfce.gte('data_emissao', strMes);
      queryNfe = queryNfe.gte('data_emissao', strMes);
    }

    const [resNfce, resNfe] = await Promise.all([queryNfce.limit(1000), queryNfe.limit(1000)]);
    const nfces = resNfce.data || [];
    const nfes = resNfe.data || [];

    let totalGeral = 0;
    let totalNfce = 0;
    let totalNfe = 0;
    let totalPix = 0;
    let qtdPix = 0;
    let totalDinheiro = 0;
    let qtdDinheiro = 0;
    let totalCartao = 0;
    let qtdCartao = 0;

    nfces.forEach(nf => {
      const v = Number(nf.valor || 0);
      totalNfce += v;
      totalGeral += v;

      const fps = Array.isArray(nf.formas_pagamento) ? nf.formas_pagamento : [];
      fps.forEach((fp: any) => {
        const val = Number(fp.valor || 0);
        const cod = String(fp.codigo || '');
        const nome = String(fp.nome || '').toUpperCase();
        if (cod === '17' || cod === '20' || nome.includes('PIX')) {
          totalPix += val;
          qtdPix++;
        } else if (cod === '01' || nome.includes('DINHEIRO')) {
          totalDinheiro += val;
          qtdDinheiro++;
        } else if (['03', '04'].includes(cod) || nome.includes('CARTAO') || nome.includes('CREDITO') || nome.includes('DEBITO')) {
          totalCartao += val;
          qtdCartao++;
        }
      });
    });

    nfes.forEach(nf => {
      const v = Number(nf.valor || 0);
      totalNfe += v;
      totalGeral += v;
    });

    return {
      qtdNfce: nfces.length,
      qtdNfe: nfes.length,
      totalGeral,
      totalNfce,
      totalNfe,
      totalPix,
      qtdPix,
      totalDinheiro,
      qtdDinheiro,
      totalCartao,
      qtdCartao
    };
  }

  /**
   * 3. Auditoria Financeira de Faturas e Mensalidades
   */
  async auditarFaturas(contexto: ContextoAuditoriaSegura, apenasPendentes: boolean = false) {
    let query = this.supabase
      .from('faturas')
      .select('id, cliente_id, competencia, valor, data_vencimento, status, valor_original, valor_multa, valor_juros, pix_copia_cola, desbloqueio_confianca_em, clientes(razao_social, nome_fantasia, cnpj)')
      .order('data_vencimento', { ascending: false });

    if (contexto.clienteIdFoco) {
      query = query.eq('cliente_id', contexto.clienteIdFoco);
    } else if (contexto.userRole !== 'admin' && contexto.idsAutorizados.size > 0) {
      query = query.in('cliente_id', Array.from(contexto.idsAutorizados));
    }

    if (apenasPendentes) {
      query = query.eq('status', 'pendente');
    }

    const { data: faturas } = await query.limit(20);
    const lista = faturas || [];
    const hoje = new Date().toISOString().split('T')[0];

    let totalPendente = 0;
    let totalVencido = 0;
    let totalPago = 0;

    const itensFormatados = lista.map(f => {
      const val = Number(f.valor || 0);
      const isVencida = f.status === 'pendente' && f.data_vencimento < hoje;

      if (f.status === 'pago') totalPago += val;
      else if (isVencida) {
        totalVencido += val;
        totalPendente += val;
      } else if (f.status === 'pendente') {
        totalPendente += val;
      }

      const clienteNome = (f.clientes as any)?.nome_fantasia || (f.clientes as any)?.razao_social || 'Empresa';
      return {
        id: f.id,
        empresa: clienteNome,
        cnpj: (f.clientes as any)?.cnpj || '—',
        competencia: f.competencia,
        valor: val,
        vencimento: f.data_vencimento,
        status: isVencida ? 'vencida' : f.status,
        temPix: Boolean(f.pix_copia_cola)
      };
    });

    return {
      totalItens: lista.length,
      totalPendente,
      totalVencido,
      totalPago,
      faturas: itensFormatados
    };
  }

  /**
   * 4. Consulta de Clientes agrupados por Sistema Paratech (MEI, Tech Slim, Tech Pro, Gastro, Pes.Ai)
   */
  async consultarSistemasParatech(contexto: ContextoAuditoriaSegura, sistemaFiltro?: string) {
    if (contexto.userRole !== 'admin') {
      return { error: 'Consulta de visão de sistemas restrita ao Administrador.' };
    }

    let query = this.supabase
      .from('clientes')
      .select('id, razao_social, nome_fantasia, cnpj, nome_sistema_utilizado, valor_mensalidade, is_ativo, configuracoes_hub(ultima_sincronizacao)')
      .order('razao_social', { ascending: true });

    if (sistemaFiltro) {
      query = query.ilike('nome_sistema_utilizado', `%${sistemaFiltro}%`);
    }

    const { data: clientes } = await query;
    const lista = clientes || [];

    const contagem: Record<string, { total: number; ativos: number; mrr: number }> = {
      'MEI_SIMPLES': { total: 0, ativos: 0, mrr: 0 },
      'TECH_SLIM': { total: 0, ativos: 0, mrr: 0 },
      'TECH_PRO': { total: 0, ativos: 0, mrr: 0 },
      'GASTRO': { total: 0, ativos: 0, mrr: 0 },
      'PES_AI': { total: 0, ativos: 0, mrr: 0 },
      'OUTROS': { total: 0, ativos: 0, mrr: 0 }
    };

    lista.forEach(c => {
      const sis = (c.nome_sistema_utilizado || '').toUpperCase();
      let key = 'OUTROS';
      if (sis.includes('MEI')) key = 'MEI_SIMPLES';
      else if (sis.includes('SLIM')) key = 'TECH_SLIM';
      else if (sis.includes('PRO')) key = 'TECH_PRO';
      else if (sis.includes('GASTRO') || sis.includes('FOOD') || sis.includes('BAR')) key = 'GASTRO';
      else if (sis.includes('PES')) key = 'PES_AI';

      contagem[key].total++;
      if (c.is_ativo) {
        contagem[key].ativos++;
        contagem[key].mrr += Number(c.valor_mensalidade || 0);
      }
    });

    return {
      totalClientes: lista.length,
      distribuicao: contagem,
      clientes: lista.map(c => ({
        id: c.id,
        nome: c.nome_fantasia || c.razao_social,
        cnpj: c.cnpj,
        sistema: c.nome_sistema_utilizado || 'Não Definido',
        isAtivo: c.is_ativo,
        mensalidade: Number(c.valor_mensalidade || 0)
      }))
    };
  }
}
