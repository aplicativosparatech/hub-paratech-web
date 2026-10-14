import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';

export interface MapeamentoColunas {
  colCodigo?: string;
  colDescricao?: string;
  colNcm?: string;
  colCest?: string;
  colCfop?: string;
  colCsosnCst?: string;
  colPisCofins?: string;
  colValor?: string;
}

export interface ArquivoInspecionado {
  tipo: 'planilha' | 'json' | 'sql' | 'sqlite';
  nomeArquivo: string;
  tabelasDisponiveis: string[];
  tabelaPadrao: string;
  colunasPorTabela: Record<string, string[]>;
  amostraPorTabela: Record<string, Record<string, any>[]>;
  sugestaoMapeamento: MapeamentoColunas;
  totalLinhasEstimado: number;
}

export interface ItemExtraido {
  indice: number;
  codigoOriginal: string;
  descricaoOriginal: string;
  ncmOriginal: string;
  cestOriginal: string;
  cfopOriginal: string;
  csosnCstOriginal: string;
  pisCofinsOriginal: string;
  valorOriginal: number;
  dadosCompletosLinha: Record<string, any>;
}

export interface ItemSaneadoRetorno extends ItemExtraido {
  ncmSugerido: string;
  cestSugerido: string;
  cfopSugerido: string;
  csosnSugerido: string;
  cstPisSugerido: string;
  cstCofinsSugerido: string;
  ibsAliq: number;
  cbsAliq: number;
  ivaDual: number;
  classificacaoReforma: string;
  isMonofasico: boolean;
  scoreConfianca: number;
  provedorIa: string;
  justificativa: string;
  houveInconsistencia: boolean;
}

// Detecção Semântica Inteligente de Colunas
export function sugerirMapeamentoColunas(colunas: string[]): MapeamentoColunas {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  
  const mapa: MapeamentoColunas = {};

  for (const col of colunas) {
    const c = norm(col);
    if (!mapa.colCodigo && (c === 'codigo' || c === 'cod' || c === 'id' || c === 'cprod' || c === 'sku' || c === 'ref' || c === 'referencia' || c === 'codprod' || c === 'coditem')) {
      mapa.colCodigo = col;
    } else if (!mapa.colDescricao && (c.includes('desc') || c === 'nome' || c === 'produto' || c === 'xprod' || c === 'item' || c === 'nomeproduto')) {
      mapa.colDescricao = col;
    } else if (!mapa.colNcm && (c === 'ncm' || c.includes('ncm') || c === 'sh' || c === 'codncm')) {
      mapa.colNcm = col;
    } else if (!mapa.colCest && (c === 'cest' || c.includes('cest') || c === 'codcest')) {
      mapa.colCest = col;
    } else if (!mapa.colCfop && (c === 'cfop' || c.includes('cfop') || c === 'natop')) {
      mapa.colCfop = col;
    } else if (!mapa.colCsosnCst && (c.includes('csosn') || c.includes('cst') || c.includes('trib') || c === 'sittrib')) {
      mapa.colCsosnCst = col;
    } else if (!mapa.colPisCofins && (c.includes('pis') || c.includes('cofins') || c === 'cstpis')) {
      mapa.colPisCofins = col;
    } else if (!mapa.colValor && (c.includes('valor') || c.includes('preco') || c === 'vuncom' || c === 'vprod' || c === 'vlunitario' || c === 'precovenda')) {
      mapa.colValor = col;
    }
  }

  return mapa;
}

// 1. INSPEÇÃO INTELIGENTE DE ARQUIVOS
export async function inspecionarArquivo(buffer: Buffer, nomeArquivo: string): Promise<ArquivoInspecionado> {
  const ext = (nomeArquivo.split('.').pop() || '').toLowerCase();

  // Caso A: Planilhas Excel (.xlsx, .xls) ou CSV
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const tabelasDisponiveis = workbook.SheetNames;
    const tabelaPadrao = tabelasDisponiveis[0] || 'Planilha1';

    const colunasPorTabela: Record<string, string[]> = {};
    const amostraPorTabela: Record<string, Record<string, any>[]> = {};
    let totalLinhas = 0;

    for (const sheetName of tabelasDisponiveis) {
      const sheet = workbook.Sheets[sheetName];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const cols = json.length > 0 ? Object.keys(json[0]) : [];
      colunasPorTabela[sheetName] = cols;
      amostraPorTabela[sheetName] = json.slice(0, 3);
      if (sheetName === tabelaPadrao) totalLinhas = json.length;
    }

    const sugestaoMapeamento = sugerirMapeamentoColunas(colunasPorTabela[tabelaPadrao] || []);

    return {
      tipo: 'planilha',
      nomeArquivo,
      tabelasDisponiveis,
      tabelaPadrao,
      colunasPorTabela,
      amostraPorTabela,
      sugestaoMapeamento,
      totalLinhasEstimado: totalLinhas
    };
  }

  // Caso B: JSON (.json)
  if (ext === 'json') {
    const text = buffer.toString('utf-8');
    const parsed = JSON.parse(text);

    let tabelasDisponiveis: string[] = [];
    let tabelaPadrao = 'raiz';
    const colunasPorTabela: Record<string, string[]> = {};
    const amostraPorTabela: Record<string, Record<string, any>[]> = {};
    let totalLinhas = 0;

    if (Array.isArray(parsed)) {
      tabelasDisponiveis = ['itens'];
      tabelaPadrao = 'itens';
      colunasPorTabela['itens'] = parsed.length > 0 && typeof parsed[0] === 'object' ? Object.keys(parsed[0]) : [];
      amostraPorTabela['itens'] = parsed.slice(0, 3);
      totalLinhas = parsed.length;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Objeto com coleções (ex: { produtos: [...], categorias: [...] })
      tabelasDisponiveis = Object.keys(parsed).filter(k => Array.isArray(parsed[k]));
      if (tabelasDisponiveis.length === 0) {
        tabelasDisponiveis = ['dados'];
        tabelaPadrao = 'dados';
        colunasPorTabela['dados'] = Object.keys(parsed);
        amostraPorTabela['dados'] = [parsed];
        totalLinhas = 1;
      } else {
        tabelaPadrao = tabelasDisponiveis.find(t => t.toLowerCase().includes('prod') || t.toLowerCase().includes('item') || t.toLowerCase().includes('estoq')) || tabelasDisponiveis[0];
        for (const t of tabelasDisponiveis) {
          const arr = parsed[t];
          colunasPorTabela[t] = arr.length > 0 && typeof arr[0] === 'object' ? Object.keys(arr[0]) : [];
          amostraPorTabela[t] = arr.slice(0, 3);
        }
        totalLinhas = parsed[tabelaPadrao]?.length || 0;
      }
    }

    const sugestaoMapeamento = sugerirMapeamentoColunas(colunasPorTabela[tabelaPadrao] || []);

    return {
      tipo: 'json',
      nomeArquivo,
      tabelasDisponiveis,
      tabelaPadrao,
      colunasPorTabela,
      amostraPorTabela,
      sugestaoMapeamento,
      totalLinhasEstimado: totalLinhas
    };
  }

  // Caso C: Dump SQL (.sql)
  if (ext === 'sql') {
    const text = buffer.toString('utf-8');
    const tabelasSet = new Set<string>();
    const colunasPorTabela: Record<string, string[]> = {};
    const amostraPorTabela: Record<string, Record<string, any>[]> = {};

    // Procura CREATE TABLE
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|\[)?([a-zA-Z0-9_]+)(?:`|"|\])?\s*\(([\s\S]*?)\);/gi;
    let match;
    while ((match = createTableRegex.exec(text)) !== null) {
      const nomeTabela = match[1];
      tabelasSet.add(nomeTabela);
      
      const corpoColunas = match[2];
      const linhasColunas = corpoColunas.split(',').map(l => l.trim()).filter(l => l && !l.toUpperCase().startsWith('PRIMARY') && !l.toUpperCase().startsWith('KEY') && !l.toUpperCase().startsWith('CONSTRAINT'));
      const cols = linhasColunas.map(l => {
        const parte = l.split(/\s+/)[0].replace(/[`"\[\]]/g, '');
        return parte;
      }).filter(c => c);
      colunasPorTabela[nomeTabela] = cols;
      amostraPorTabela[nomeTabela] = [];
    }

    // Procura INSERT INTO para coletar colunas e amostras
    const insertRegex = /INSERT\s+INTO\s+(?:`|"|\[)?([a-zA-Z0-9_]+)(?:`|"|\])?\s*(?:\(([\s\S]*?)\))?\s*VALUES\s*\(([\s\S]*?)\);/gi;
    let insertMatch;
    let count = 0;
    while ((insertMatch = insertRegex.exec(text)) !== null && count < 100) {
      count++;
      const nomeTabela = insertMatch[1];
      tabelasSet.add(nomeTabela);
      const colsStr = insertMatch[2];
      const valsStr = insertMatch[3];

      if (colsStr && !colunasPorTabela[nomeTabela]) {
        colunasPorTabela[nomeTabela] = colsStr.split(',').map(c => c.trim().replace(/[`"\[\]]/g, ''));
      }

      if (!amostraPorTabela[nomeTabela]) amostraPorTabela[nomeTabela] = [];
      if (amostraPorTabela[nomeTabela].length < 3 && colunasPorTabela[nomeTabela]) {
        const valores = valsStr.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        const obj: Record<string, any> = {};
        colunasPorTabela[nomeTabela].forEach((col, idx) => {
          obj[col] = valores[idx] || '';
        });
        amostraPorTabela[nomeTabela].push(obj);
      }
    }

    const tabelasDisponiveis = Array.from(tabelasSet);
    const tabelaPadrao = tabelasDisponiveis.find(t => {
      const normT = t.toLowerCase();
      return normT.includes('prod') || normT.includes('estoq') || normT.includes('item') || normT.includes('mercadoria');
    }) || tabelasDisponiveis[0] || 'PRODUTOS';

    const colsPadrao = colunasPorTabela[tabelaPadrao] || [];
    const sugestaoMapeamento = sugerirMapeamentoColunas(colsPadrao);

    return {
      tipo: 'sql',
      nomeArquivo,
      tabelasDisponiveis,
      tabelaPadrao,
      colunasPorTabela,
      amostraPorTabela,
      sugestaoMapeamento,
      totalLinhasEstimado: 50
    };
  }

  // Caso D: Banco de Dados SQLite (.db, .sqlite)
  if (['db', 'sqlite', 'sqlite3'].includes(ext)) {
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));

    // Busca tabelas de usuário
    const resTabelas = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tabelasDisponiveis: string[] = [];
    if (resTabelas.length > 0 && resTabelas[0].values) {
      for (const row of resTabelas[0].values) {
        if (row[0]) tabelasDisponiveis.push(String(row[0]));
      }
    }

    const tabelaPadrao = tabelasDisponiveis.find(t => {
      const normT = t.toLowerCase();
      return normT.includes('prod') || normT.includes('estoq') || normT.includes('item') || normT.includes('mercadoria');
    }) || tabelasDisponiveis[0] || 'PRODUTOS';

    const colunasPorTabela: Record<string, string[]> = {};
    const amostraPorTabela: Record<string, Record<string, any>[]> = {};
    let totalLinhas = 0;

    for (const t of tabelasDisponiveis) {
      try {
        const info = db.exec(`PRAGMA table_info("${t}");`);
        const cols: string[] = [];
        if (info.length > 0 && info[0].values) {
          for (const row of info[0].values) {
            cols.push(String(row[1])); // row[1] é o nome da coluna
          }
        }
        colunasPorTabela[t] = cols;

        // Amostra de até 3 linhas
        const amostra = db.exec(`SELECT * FROM "${t}" LIMIT 3;`);
        const rowsObj: Record<string, any>[] = [];
        if (amostra.length > 0 && amostra[0].values) {
          for (const vals of amostra[0].values) {
            const obj: Record<string, any> = {};
            cols.forEach((col, idx) => {
              obj[col] = vals[idx] !== null ? vals[idx] : '';
            });
            rowsObj.push(obj);
          }
        }
        amostraPorTabela[t] = rowsObj;

        if (t === tabelaPadrao) {
          const countRes = db.exec(`SELECT COUNT(*) FROM "${t}";`);
          totalLinhas = Number(countRes[0]?.values[0]?.[0] || 0);
        }
      } catch {
        colunasPorTabela[t] = [];
        amostraPorTabela[t] = [];
      }
    }

    db.close();

    const sugestaoMapeamento = sugerirMapeamentoColunas(colunasPorTabela[tabelaPadrao] || []);

    return {
      tipo: 'sqlite',
      nomeArquivo,
      tabelasDisponiveis,
      tabelaPadrao,
      colunasPorTabela,
      amostraPorTabela,
      sugestaoMapeamento,
      totalLinhasEstimado: totalLinhas
    };
  }

  throw new Error(`Formato de arquivo .${ext} não suportado. Formatos aceitos: .xlsx, .csv, .json, .sql, .db, .sqlite`);
}

// 2. EXTRAÇÃO DOS ITENS BASEADO NO MAPEAMENTO DO USUÁRIO
export async function extrairItensParaAuditoria(
  buffer: Buffer,
  nomeArquivo: string,
  tabelaEscolhida: string,
  mapeamento: MapeamentoColunas
): Promise<ItemExtraido[]> {
  const ext = (nomeArquivo.split('.').pop() || '').toLowerCase();
  const linhasCruas: Record<string, any>[] = [];

  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = tabelaEscolhida && wb.SheetNames.includes(tabelaEscolhida) ? tabelaEscolhida : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const dados: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    linhasCruas.push(...dados);
  } else if (ext === 'json') {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    if (Array.isArray(parsed)) {
      linhasCruas.push(...parsed);
    } else if (parsed && typeof parsed === 'object') {
      const arr = parsed[tabelaEscolhida] || parsed.itens || parsed.produtos || Object.values(parsed).find(v => Array.isArray(v));
      if (Array.isArray(arr)) linhasCruas.push(...arr);
    }
  } else if (['db', 'sqlite', 'sqlite3'].includes(ext)) {
    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(buffer));
    const res = db.exec(`SELECT * FROM "${tabelaEscolhida}";`);
    if (res.length > 0 && res[0].values) {
      const cols = res[0].columns;
      for (const row of res[0].values) {
        const obj: Record<string, any> = {};
        cols.forEach((col, idx) => {
          obj[col] = row[idx] !== null ? row[idx] : '';
        });
        linhasCruas.push(obj);
      }
    }
    db.close();
  } else if (ext === 'sql') {
    // Para dumps SQL: extrai as linhas de INSERT correspondentes à tabela escolhida
    const text = buffer.toString('utf-8');
    const regex = new RegExp(`INSERT\\s+INTO\\s+(?:\`|"|\\[)?${tabelaEscolhida}(?:\`|"|\\])?\\s*(?:\\(([\\s\\S]*?)\\))?\\s*VALUES\\s*([\\s\\S]*?);`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const colsStr = match[1];
      const valuesBlock = match[2];
      const cols = colsStr ? colsStr.split(',').map(c => c.trim().replace(/[`"\[\]]/g, '')) : [];

      const rowsMatches = valuesBlock.match(/\(([^)]+)\)/g) || [];
      for (const r of rowsMatches) {
        const cleanVals = r.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        const obj: Record<string, any> = {};
        if (cols.length > 0) {
          cols.forEach((c, i) => obj[c] = cleanVals[i] || '');
        } else {
          cleanVals.forEach((v, i) => obj[`col_${i + 1}`] = v);
        }
        linhasCruas.push(obj);
      }
    }
  }

  return linhasCruas.map((linha, idx) => {
    const getVal = (col?: string) => (col && linha[col] !== undefined ? String(linha[col]).trim() : '');
    const numVal = (col?: string) => {
      const v = getVal(col).replace(/[^\d.,-]/g, '').replace(',', '.');
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };

    return {
      indice: idx,
      codigoOriginal: getVal(mapeamento.colCodigo) || String(idx + 1),
      descricaoOriginal: getVal(mapeamento.colDescricao) || `Item Sem Descrição #${idx + 1}`,
      ncmOriginal: getVal(mapeamento.colNcm),
      cestOriginal: getVal(mapeamento.colCest),
      cfopOriginal: getVal(mapeamento.colCfop),
      csosnCstOriginal: getVal(mapeamento.colCsosnCst),
      pisCofinsOriginal: getVal(mapeamento.colPisCofins),
      valorOriginal: numVal(mapeamento.colValor),
      dadosCompletosLinha: linha
    };
  });
}

// 3. GERADORES DE ARQUIVOS DE RETORNO SEGUROS (RISCO ZERO DE CORROMPER O ERP)

// A. Gera Nova Planilha Excel Saneada (.xlsx)
export function gerarPlanilhaSaneada(itens: ItemSaneadoRetorno[]): Buffer {
  const dadosExport: Record<string, any>[] = itens.map(item => {
    const base = { ...item.dadosCompletosLinha };
    return {
      ...base,
      'STATUS_SANEAMENTO': item.houveInconsistencia ? 'CORRIGIDO' : 'CONFORME',
      'NCM_CORRIGIDO': item.ncmSugerido,
      'CEST_CORRIGIDO': item.cestSugerido,
      'CFOP_CORRIGIDO': item.cfopSugerido,
      'CSOSN_CST_CORRIGIDO': item.csosnSugerido,
      'CST_PIS_CORRIGIDO': item.cstPisSugerido,
      'CST_COFINS_CORRIGIDO': item.cstCofinsSugerido,
      'IBS_ALIQ_%': item.ibsAliq,
      'CBS_ALIQ_%': item.cbsAliq,
      'IVA_DUAL_TOTAL_%': item.ivaDual,
      'REFORMA_ENQUADRAMENTO': item.classificacaoReforma,
      'PRODUTO_MONOFASICO': item.isMonofasico ? 'SIM' : 'NÃO',
      'MOTOR_IA': item.provedorIa,
      'CONFIANCA_%': item.scoreConfianca,
      'DIAGNOSTICO_FISCAL': item.justificativa
    };
  });

  const ws = XLSX.utils.json_to_sheet(dadosExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos Saneados');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// B. Gera Script SQL de Atualização Segura (UPDATE ... WHERE ...)
export function gerarScriptSqlUpdate(
  tabela: string,
  itens: ItemSaneadoRetorno[],
  mapeamento: MapeamentoColunas
): string {
  const colCod = mapeamento.colCodigo || 'codigo';
  const colNcm = mapeamento.colNcm || 'ncm';
  const colCest = mapeamento.colCest || 'cest';
  const colCfop = mapeamento.colCfop || 'cfop';
  const colCsosn = mapeamento.colCsosnCst || 'csosn';

  let sql = `-- =========================================================================\n`;
  sql += `-- SCRIPT SEGURO DE ATUALIZAÇÃO TRIBUTÁRIA - HUB FISCAL PARATECH\n`;
  sql += `-- Data: ${new Date().toLocaleString('pt-BR')}\n`;
  sql += `-- Tabela Alvo: ${tabela}\n`;
  sql += `-- Itens Auditados: ${itens.length} | Inconsistências Corrigidas: ${itens.filter(i => i.houveInconsistencia).length}\n`;
  sql += `-- REFORMA TRIBUTÁRIA: Inclui enquadramento IBS & CBS (LC 214/2024)\n`;
  sql += `-- =========================================================================\n\n`;
  sql += `BEGIN TRANSACTION;\n\n`;

  for (const item of itens) {
    if (!item.houveInconsistencia) continue;

    const sets: string[] = [];
    if (mapeamento.colNcm) sets.push(`"${colNcm}" = '${item.ncmSugerido}'`);
    if (mapeamento.colCest) sets.push(`"${colCest}" = '${item.cestSugerido}'`);
    if (mapeamento.colCfop) sets.push(`"${colCfop}" = '${item.cfopSugerido}'`);
    if (mapeamento.colCsosnCst) sets.push(`"${colCsosn}" = '${item.csosnSugerido}'`);

    if (sets.length > 0) {
      sql += `-- Item: ${item.descricaoOriginal.replace(/'/g, "''")} | IA: ${item.provedorIa}\n`;
      sql += `UPDATE "${tabela}" SET ${sets.join(', ')} WHERE "${colCod}" = '${item.codigoOriginal.replace(/'/g, "''")}';\n\n`;
    }
  }

  sql += `COMMIT;\n`;
  sql += `-- Atualização concluída com segurança e integridade referencial preservada.\n`;

  return sql;
}

// C. Gera JSON Saneado
export function gerarJsonSaneado(itens: ItemSaneadoRetorno[]): string {
  const dados = itens.map(item => ({
    ...item.dadosCompletosLinha,
    ncm_corrigido: item.ncmSugerido,
    cest_corrigido: item.cestSugerido,
    cfop_corrigido: item.cfopSugerido,
    csosn_cst_corrigido: item.csosnSugerido,
    cst_pis_corrigido: item.cstPisSugerido,
    cst_cofins_corrigido: item.cstCofinsSugerido,
    reforma_ibs_aliq: item.ibsAliq,
    reforma_cbs_aliq: item.cbsAliq,
    reforma_iva_dual_total: item.ivaDual,
    reforma_enquadramento: item.classificacaoReforma,
    is_monofasico: item.isMonofasico,
    motor_ia: item.provedorIa,
    confianca: item.scoreConfianca,
    justificativa: item.justificativa
  }));

  return JSON.stringify(dados, null, 2);
}

// D. Gera Banco SQLite Saneado (.db)
export async function gerarSqliteSaneado(
  bufferOriginal: Buffer,
  tabela: string,
  itens: ItemSaneadoRetorno[],
  mapeamento: MapeamentoColunas
): Promise<Buffer> {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(bufferOriginal));

  const colCod = mapeamento.colCodigo || 'codigo';
  const colNcm = mapeamento.colNcm || 'ncm';
  const colCest = mapeamento.colCest || 'cest';
  const colCfop = mapeamento.colCfop || 'cfop';
  const colCsosn = mapeamento.colCsosnCst || 'csosn';

  // Tenta adicionar colunas de IBS e CBS caso não existam
  try { db.run(`ALTER TABLE "${tabela}" ADD COLUMN "aliq_ibs" REAL;`); } catch {}
  try { db.run(`ALTER TABLE "${tabela}" ADD COLUMN "aliq_cbs" REAL;`); } catch {}
  try { db.run(`ALTER TABLE "${tabela}" ADD COLUMN "iva_dual" REAL;`); } catch {}

  for (const item of itens) {
    if (!item.houveInconsistencia) continue;

    const updates: string[] = [];
    if (mapeamento.colNcm) updates.push(`"${colNcm}" = '${item.ncmSugerido}'`);
    if (mapeamento.colCest) updates.push(`"${colCest}" = '${item.cestSugerido}'`);
    if (mapeamento.colCfop) updates.push(`"${colCfop}" = '${item.cfopSugerido}'`);
    if (mapeamento.colCsosnCst) updates.push(`"${colCsosn}" = '${item.csosnSugerido}'`);

    updates.push(`"aliq_ibs" = ${item.ibsAliq}`);
    updates.push(`"aliq_cbs" = ${item.cbsAliq}`);
    updates.push(`"iva_dual" = ${item.ivaDual}`);

    try {
      db.run(`UPDATE "${tabela}" SET ${updates.join(', ')} WHERE "${colCod}" = '${item.codigoOriginal.replace(/'/g, "''")}';`);
    } catch (e) {
      console.warn('Erro ao atualizar linha sqlite:', e);
    }
  }

  const binary = db.export();
  db.close();

  return Buffer.from(binary);
}
