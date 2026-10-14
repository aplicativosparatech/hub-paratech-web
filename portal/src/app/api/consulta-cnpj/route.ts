import { NextResponse } from 'next/server';
import { limparDocumento, formatarCnpjCpf, validarCnpj, isCnpjAlfanumerico } from '@/utils/cnpjAlfanumerico';

export interface RespostaCnpjPadrao {
  sucesso: boolean;
  cnpj: string;
  cnpj_formatado: string;
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

    // Se for CNPJ Alfanumérico (IN RFB 2.229/2024), a base pública governamental ainda está em fase de virada
    const isAlfanum = isCnpjAlfanumerico(rawDoc);

    // 1. TENTATIVA 1: ReceitaWS (Alta estabilidade e sem restrições de WAF para servidores)
    try {
      const resReceitaWs = await fetch(`https://receitaws.com.br/v1/cnpj/${rawDoc}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HubParatech/2.3 (https://hub-paratech-web.vercel.app)'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (resReceitaWs.ok) {
        const d = await resReceitaWs.json();
        if (d.status === 'OK' && d.nome) {
          // Extrair telefones e whatsapp
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

          const resultado: RespostaCnpjPadrao = {
            sucesso: true,
            cnpj: rawDoc,
            cnpj_formatado: formatarCnpjCpf(rawDoc),
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

    // 2. TENTATIVA 2: BrasilAPI
    try {
      const resBrasilApi = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawDoc}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

        const resultado: RespostaCnpjPadrao = {
          sucesso: true,
          cnpj: rawDoc,
          cnpj_formatado: formatarCnpjCpf(rawDoc),
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

    // 3. TENTATIVA 3: MinhaReceita
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

        const resultado: RespostaCnpjPadrao = {
          sucesso: true,
          cnpj: rawDoc,
          cnpj_formatado: formatarCnpjCpf(rawDoc),
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
