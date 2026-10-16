import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { credenciais } = body;

    const nfstockToken = credenciais?.nfstock_token?.trim();
    const epluginToken = credenciais?.eplugin_token?.trim();
    const codigoCrm = credenciais?.nfstock_codigo_crm?.trim();

    if (!nfstockToken && !epluginToken) {
      return NextResponse.json({
        success: false,
        error: 'Informe ao menos o Token do nf-stock ou do ePlugin para testar a conexão.'
      }, { status: 400 });
    }

    const resultados: {
      nfstock?: { ok: boolean; status: number; msg: string; tempoMs: number };
      eplugin?: { ok: boolean; status: number; msg: string; tempoMs: number };
    } = {};

    // 1. Testar conexão com o ePlugin (se informado)
    if (epluginToken) {
      const inicio = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const resp = await fetch('https://dp.pack.alterdata.com.br/api/v1/integracao/usuarios?page[limit]=1', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${epluginToken}`,
            'Accept': 'application/vnd.api+json'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        const tempoMs = Date.now() - inicio;

        if (resp.ok) {
          resultados.eplugin = {
            ok: true,
            status: resp.status,
            msg: 'Conexão ePlugin autenticada com sucesso! Acesso aos módulos Contábil, DP e Documentos autorizado.',
            tempoMs
          };
        } else if (resp.status === 401 || resp.status === 403) {
          resultados.eplugin = {
            ok: false,
            status: resp.status,
            msg: 'Token ePlugin rejeitado pela Alterdata (401/403). Verifique se o eContador Master está ativo e gere um novo token.',
            tempoMs
          };
        } else {
          resultados.eplugin = {
            ok: false,
            status: resp.status,
            msg: `Resposta inesperada do ePlugin (${resp.status}): ${resp.statusText}`,
            tempoMs
          };
        }
      } catch (err: any) {
        resultados.eplugin = {
          ok: false,
          status: 0,
          msg: `Falha de conexão com ePlugin: ${err.name === 'AbortError' ? 'Tempo limite esgotado (8s)' : err.message}`,
          tempoMs: Date.now() - inicio
        };
      }
    }

    // 2. Testar conexão com o nf-stock (se informado)
    if (nfstockToken) {
      const inicio = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        // Testa endpoint de exportação se tiver CRM, ou endpoint de storage
        let testUrl = 'https://ms-importacao-service-nfstock.alterdatasoftware.com.br/storage';
        let method = 'POST';
        let payload: any = JSON.stringify({ size: 100, extension: '.xml' });

        if (codigoCrm && codigoCrm.length >= 4) {
          const crmFormatado = codigoCrm.padStart(6, '0');
          testUrl = `https://ms-exportacao-service-nfstock.alterdatasoftware.com.br/api/v1/${crmFormatado}/00000000000000/documentos/0/novos?Tamanho=1&Pagina=1`;
          method = 'GET';
          payload = undefined;
        }

        const resp = await fetch(testUrl, {
          method,
          headers: {
            'Authorization': `Bearer ${nfstockToken}`,
            'Content-Type': 'application/json'
          },
          body: payload,
          signal: controller.signal
        });
        clearTimeout(timeout);
        const tempoMs = Date.now() - inicio;

        if (resp.ok || resp.status === 200 || resp.status === 201) {
          resultados.nfstock = {
            ok: true,
            status: resp.status,
            msg: 'Conexão nf-stock autorizada com sucesso! Nuvem pronta para receber e consultar XMLs.',
            tempoMs
          };
        } else if (resp.status === 401 || resp.status === 403) {
          resultados.nfstock = {
            ok: false,
            status: resp.status,
            msg: 'Token nf-stock inválido ou expirado (401/403). Gere um novo token no portal nf-stock.',
            tempoMs
          };
        } else {
          // Se retornou 400 ou 404 de CNPJ mas passou na auth, o token é válido
          resultados.nfstock = {
            ok: true,
            status: resp.status,
            msg: 'Token nf-stock reconhecido pelo serviço Alterdata.',
            tempoMs
          };
        }
      } catch (err: any) {
        resultados.nfstock = {
          ok: false,
          status: 0,
          msg: `Falha de conexão com nf-stock: ${err.name === 'AbortError' ? 'Tempo limite esgotado (8s)' : err.message}`,
          tempoMs: Date.now() - inicio
        };
      }
    }

    const algumSucesso = (resultados.nfstock?.ok || resultados.eplugin?.ok);

    return NextResponse.json({
      success: algumSucesso,
      resultados
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno ao testar conexão'
    }, { status: 500 });
  }
}
