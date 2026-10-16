import { NextResponse } from 'next/server';
import { limparDocumento, formatarCnpjCpf, validarCnpj, isCnpjAlfanumerico } from '@/utils/cnpjAlfanumerico';

export interface RespostaCnpjPadrao {
  sucesso: boolean;
  cnpj: string;
  cnpj_formatado: string;
  inscricao_estadual: string;
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ramo_atividade: string;
  regime_tributario: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real' | 'mei';
  optante_simples: boolean;
  optante_mei: boolean;
  situacao: string;
  provedor: string;
}

// Busca rápida da Inscrição Estadual nas SEFAZs / Sintegra
async function extrairInscricaoEstadual(cnpj: string, ufAlvo?: string): Promise<string> {
  // 1. Tenta via CNPJ.ws (base com SINTEGRA / SEFAZs)
  try {
    const token = process.env.CNPJ_WS_TOKEN;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'HubParatech/2.4'
    };
    if (token) headers['x-api-token'] = token;

    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers,
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const d = await res.json();
      const ies = d.estabelecimento?.inscricoes_estaduais || [];
      if (Array.isArray(ies) && ies.length > 0) {
        // Se foi passada UF alvo, prioriza a inscrição do mesmo estado
        if (ufAlvo) {
          const matchUf = ies.find((i: any) => i.estado?.sigla?.toUpperCase() === ufAlvo.toUpperCase() && i.ativo);
          if (matchUf?.inscricao_estadual) return String(matchUf.inscricao_estadual).trim();
          const matchUfQualquer = ies.find((i: any) => i.estado?.sigla?.toUpperCase() === ufAlvo.toUpperCase());
          if (matchUfQualquer?.inscricao_estadual) return String(matchUfQualquer.inscricao_estadual).trim();
        }
        // Pega a primeira ativa ou qualquer uma cadastrada
        const ativa = ies.find((i: any) => i.ativo);
        const escolhida = ativa || ies[0];
        if (escolhida?.inscricao_estadual) return String(escolhida.inscricao_estadual).trim();
      }
    }
  } catch {
    // Continua para o fallback
  }

  // 2. Tenta via Open CNPJa
  try {
    const res = await fetch(`https://open.cnpja.com/office/${cnpj}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HubParatech/2.4' },
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const d = await res.json();
      const habilitada = d.registrations?.find((r: any) => r.enabled);
      const reg = habilitada || d.registrations?.[0];
      if (reg?.number) return String(reg.number).trim();
    }
  } catch {
    // Silencioso
  }

  return '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cnpjParam = searchParams.get('cnpj') || searchParams.get('doc');

    if (!cnpjParam) {
      return NextResponse.json({ error: 'Parâmetro CNPJ não informado.' }, { status: 400 });
    }

    const rawDoc = limparDocumento(cnpjParam);

    if (rawDoc.length !== 14) {
      return NextResponse.json({ error: 'O CNPJ deve conter exatamente 14 caracteres.' }, { status: 400 });
    }

    if (!validarCnpj(rawDoc)) {
      return NextResponse.json({ error: 'Dígito verificador do CNPJ inválido de acordo com a Receita Federal.' }, { status: 422 });
    }

    const isAlfanum = isCnpjAlfanumerico(rawDoc);

    // =========================================================================
    // 1. TENTATIVA 1: CNPJ.ws (Fornece Inscrição Estadual oficial das SEFAZs,
    // endereço completo, CNAE e regime tributário)
    // =========================================================================
    try {
      const token = process.env.CNPJ_WS_TOKEN;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'HubParatech/2.4'
      };
      if (token) headers['x-api-token'] = token;

      const resCnpjWs = await fetch(`https://publica.cnpj.ws/cnpj/${rawDoc}`, {
        headers,
        signal: AbortSignal.timeout(6000)
      });

      if (resCnpjWs.ok) {
        const d = await resCnpjWs.json();
        const est = d.estabelecimento;
        if (d.razao_social || est?.nome_fantasia) {
          // Extrair Inscrição Estadual (SEFAZ / Sintegra)
          let ie = '';
          const ies = est?.inscricoes_estaduais || [];
          if (Array.isArray(ies) && ies.length > 0) {
            const ativa = ies.find((i: any) => i.ativo);
            const escolhida = ativa || ies[0];
            if (escolhida?.inscricao_estadual) {
              ie = String(escolhida.inscricao_estadual).trim();
            }
          }

          // Telefone e WhatsApp
          let telFormatado = '';
          let wppLimpo = '';
          if (est?.ddd1 && est?.telefone1) {
            telFormatado = `(${est.ddd1}) ${est.telefone1}`;
            wppLimpo = `55${est.ddd1}${est.telefone1.replace(/\D/g, '')}`;
          }

          // Regime Tributário
          let autoRegime: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real' | 'mei' = 'simples_nacional';
          const optanteMei = d.simples?.mei?.toLowerCase() === 'sim';
          const optanteSimples = d.simples?.simples?.toLowerCase() === 'sim';

          if (optanteMei) autoRegime = 'mei';
          else if (optanteSimples) autoRegime = 'simples_nacional';
          else autoRegime = 'lucro_presumido';

          const resultado: RespostaCnpjPadrao = {
            sucesso: true,
            cnpj: rawDoc,
            cnpj_formatado: formatarCnpjCpf(rawDoc),
            inscricao_estadual: ie,
            razao_social: d.razao_social || est?.nome_fantasia || '',
            nome_fantasia: est?.nome_fantasia || d.razao_social || '',
            email: est?.email || '',
            telefone: telFormatado,
            whatsapp: wppLimpo,
            cep: (est?.cep || '').replace(/\D/g, ''),
            logradouro: est?.logradouro ? `${est?.tipo_logradouro ? est.tipo_logradouro + ' ' : ''}${est.logradouro}`.trim() : '',
            numero: est?.numero || '',
            complemento: est?.complemento || '',
            bairro: est?.bairro || '',
            cidade: est?.cidade?.nome || '',
            uf: est?.estado?.sigla || '',
            ramo_atividade: est?.atividade_principal?.descricao || '',
            regime_tributario: autoRegime,
            optante_simples: optanteSimples,
            optante_mei: optanteMei,
            situacao: est?.situacao_cadastral || 'Ativa',
            provedor: 'cnpj.ws'
          };

          return NextResponse.json(resultado);
        }
      }
    } catch (e: any) {
      console.warn('[Consulta CNPJ] CNPJ.ws falhou, tentando Open CNPJa:', e.message);
    }

    // =========================================================================
    // 2. TENTATIVA 2: Open CNPJa (Estruturado com telefones e sócios)
    // =========================================================================
    try {
      const resCnpja = await fetch(`https://open.cnpja.com/office/${rawDoc}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HubParatech/2.4'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (resCnpja.ok) {
        const d = await resCnpja.json();
        if (d.company && d.company.name) {
          const primPhone = d.phones?.[0];
          const telFormatado = primPhone ? `(${primPhone.area}) ${primPhone.number}` : '';
          const wppLimpo = primPhone ? `55${primPhone.area}${primPhone.number}` : '';

          let autoRegime: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real' | 'mei' = 'simples_nacional';
          const optanteMei = Boolean(d.company?.simei?.optant);
          const optanteSimples = Boolean(d.company?.simples?.optant);

          if (optanteMei) autoRegime = 'mei';
          else if (optanteSimples) autoRegime = 'simples_nacional';
          else autoRegime = 'lucro_presumido';

          // Tenta extrair IE do próprio payload ou busca complementar
          const habilitada = d.registrations?.find((r: any) => r.enabled);
          const primReg = habilitada || d.registrations?.[0];
          let ie = primReg?.number ? String(primReg.number).trim() : '';

          if (!ie) {
            ie = await extrairInscricaoEstadual(rawDoc, d.address?.state);
          }

          const resultado: RespostaCnpjPadrao = {
            sucesso: true,
            cnpj: rawDoc,
            cnpj_formatado: formatarCnpjCpf(rawDoc),
            inscricao_estadual: ie,
            razao_social: d.company.name || '',
            nome_fantasia: d.alias || d.company.name || '',
            email: d.emails?.[0]?.address || '',
            telefone: telFormatado,
            whatsapp: wppLimpo,
            cep: (d.address?.zip || '').replace(/\D/g, ''),
            logradouro: d.address?.street || '',
            numero: d.address?.number || '',
            complemento: d.address?.details || '',
            bairro: d.address?.district || '',
            cidade: d.address?.city || '',
            uf: d.address?.state || '',
            ramo_atividade: d.mainActivity?.text || '',
            regime_tributario: autoRegime,
            optante_simples: optanteSimples,
            optante_mei: optanteMei,
            situacao: d.status?.text || 'ATIVA',
            provedor: 'cnpja'
          };

          return NextResponse.json(resultado);
        }
      }
    } catch (e: any) {
      console.warn('[Consulta CNPJ] CNPJa falhou, tentando ReceitaWS:', e.message);
    }

    // =========================================================================
    // 3. TENTATIVA 3: ReceitaWS
    // =========================================================================
    try {
      const resReceitaWs = await fetch(`https://receitaws.com.br/v1/cnpj/${rawDoc}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HubParatech/2.4 (https://hub-paratech-web.vercel.app)'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (resReceitaWs.ok) {
        const d = await resReceitaWs.json();
        if (d.status === 'OK' && d.nome) {
          let telLimpo = '';
          let dddTel = '';
          if (d.telefone) {
            const telPartes = d.telefone.split('/');
            const primTel = telPartes[0]?.trim() || '';
            const matchNums = primTel.replace(/\D/g, '');
            if (matchNums.length >= 10) {
              telLimpo = primTel;
              dddTel = `55${matchNums}`;
            }
          }

          let autoRegime: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real' | 'mei' = 'simples_nacional';
          const optanteMei = Boolean(d.simei?.optante);
          const optanteSimples = Boolean(d.simples?.optante);

          if (optanteMei) autoRegime = 'mei';
          else if (optanteSimples) autoRegime = 'simples_nacional';
          else autoRegime = 'lucro_presumido';

          const ie = await extrairInscricaoEstadual(rawDoc, d.uf);

          const resultado: RespostaCnpjPadrao = {
            sucesso: true,
            cnpj: rawDoc,
            cnpj_formatado: formatarCnpjCpf(rawDoc),
            inscricao_estadual: ie,
            razao_social: d.nome || '',
            nome_fantasia: d.fantasia || d.nome || '',
            email: d.email || '',
            telefone: telLimpo || d.telefone || '',
            whatsapp: dddTel,
            cep: (d.cep || '').replace(/\D/g, ''),
            logradouro: d.logradouro || '',
            numero: d.numero || '',
            complemento: d.complemento || '',
            bairro: d.bairro || '',
            cidade: d.municipio || '',
            uf: d.uf || '',
            ramo_atividade: d.atividade_principal?.[0]?.text || '',
            regime_tributario: autoRegime,
            optante_simples: optanteSimples,
            optante_mei: optanteMei,
            situacao: d.situacao || 'ATIVA',
            provedor: 'receitaws'
          };

          return NextResponse.json(resultado);
        }
      }
    } catch (e: any) {
      console.warn('[Consulta CNPJ] ReceitaWS falhou, tentando BrasilAPI:', e.message);
    }

    // =========================================================================
    // 4. TENTATIVA 4: BrasilAPI
    // =========================================================================
    try {
      const resBrasilApi = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawDoc}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (resBrasilApi.ok) {
        const d = await resBrasilApi.json();
        const dddTel = d.ddd_telefone_1 ? `55${d.ddd_telefone_1.replace(/\D/g, '')}` : '';
        const telFormatado = d.ddd_telefone_1 ? `(${d.ddd_telefone_1.substring(0, 2)}) ${d.ddd_telefone_1.substring(2)}` : '';

        let autoRegime: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real' | 'mei' = 'simples_nacional';
        if (d.opcao_pelo_mei) autoRegime = 'mei';
        else if (d.opcao_pelo_simples) autoRegime = 'simples_nacional';
        else if (d.opcao_pelo_simples === false) autoRegime = 'lucro_presumido';

        const ie = await extrairInscricaoEstadual(rawDoc, d.uf);

        const resultado: RespostaCnpjPadrao = {
          sucesso: true,
          cnpj: rawDoc,
          cnpj_formatado: formatarCnpjCpf(rawDoc),
          inscricao_estadual: ie,
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || d.razao_social || '',
          email: d.email || '',
          telefone: telFormatado,
          whatsapp: dddTel,
          cep: (d.cep || '').replace(/\D/g, ''),
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairro || '',
          cidade: d.municipio || '',
          uf: d.uf || '',
          ramo_atividade: d.cnae_fiscal_descricao || '',
          regime_tributario: autoRegime,
          optante_simples: Boolean(d.opcao_pelo_simples),
          optante_mei: Boolean(d.opcao_pelo_mei),
          situacao: d.descricao_situacao_cadastral || 'ATIVA',
          provedor: 'brasilapi'
        };

        return NextResponse.json(resultado);
      }
    } catch (e: any) {
      console.warn('[Consulta CNPJ] BrasilAPI falhou, tentando MinhaReceita:', e.message);
    }

    // =========================================================================
    // 5. TENTATIVA 5: MinhaReceita
    // =========================================================================
    try {
      const resMinhaReceita = await fetch(`https://minhareceita.org/${rawDoc}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (resMinhaReceita.ok) {
        const d = await resMinhaReceita.json();
        const dddTel = d.ddd_telefone_1 ? `55${d.ddd_telefone_1.replace(/\D/g, '')}` : '';

        let autoRegime: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real' | 'mei' = 'simples_nacional';
        if (d.opcao_pelo_mei) autoRegime = 'mei';
        else if (d.opcao_pelo_simples) autoRegime = 'simples_nacional';
        else autoRegime = 'lucro_presumido';

        const ie = await extrairInscricaoEstadual(rawDoc, d.uf);

        const resultado: RespostaCnpjPadrao = {
          sucesso: true,
          cnpj: rawDoc,
          cnpj_formatado: formatarCnpjCpf(rawDoc),
          inscricao_estadual: ie,
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || d.razao_social || '',
          email: d.email || '',
          telefone: d.ddd_telefone_1 || '',
          whatsapp: dddTel,
          cep: (d.cep || '').replace(/\D/g, ''),
          logradouro: d.logradouro || '',
          numero: d.numero || '',
          complemento: d.complemento || '',
          bairro: d.bairro || '',
          cidade: d.municipio || '',
          uf: d.uf || '',
          ramo_atividade: d.cnae_fiscal_descricao || '',
          regime_tributario: autoRegime,
          optante_simples: Boolean(d.opcao_pelo_simples),
          optante_mei: Boolean(d.opcao_pelo_mei),
          situacao: d.descricao_situacao_cadastral || 'ATIVA',
          provedor: 'minhareceita'
        };

        return NextResponse.json(resultado);
      }
    } catch (e: any) {
      console.warn('[Consulta CNPJ] MinhaReceita falhou:', e.message);
    }

    // Se for Alfanumérico e nenhum provedor público tiver indexado ainda
    if (isAlfanum) {
      return NextResponse.json({
        sucesso: true,
        cnpj: rawDoc,
        cnpj_formatado: formatarCnpjCpf(rawDoc),
        inscricao_estadual: '',
        razao_social: '',
        nome_fantasia: '',
        email: '',
        telefone: '',
        whatsapp: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
        ramo_atividade: '',
        regime_tributario: 'simples_nacional',
        optante_simples: true,
        optante_mei: false,
        situacao: 'ATIVA',
        is_alfanumerico: true,
        aviso: 'CNPJ Alfanumérico validado com sucesso pelas regras oficiais da Receita Federal (IN RFB nº 2.229/2024). Como se trata do novo padrão, preencha os dados cadastrais da empresa.',
        provedor: 'validador_rfb'
      });
    }

    return NextResponse.json(
      { error: 'Não foi possível obter dados cadastrais para este CNPJ nos provedores públicos. Por favor, preencha os campos manualmente.' },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno ao consultar CNPJ' },
      { status: 500 }
    );
  }
}
