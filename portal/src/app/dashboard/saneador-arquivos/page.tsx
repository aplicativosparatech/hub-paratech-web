'use client';

import { useState, useEffect } from 'react';
import { 
  Database, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  FileCode, 
  Layers, 
  Sparkles, 
  Cpu, 
  Download, 
  RefreshCw, 
  ArrowRight, 
  Search, 
  Filter, 
  ShieldCheck, 
  FileText,
  Info,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/utils/supabase/client';
import { ArquivoInspecionado, MapeamentoColunas, ItemSaneadoRetorno } from '@/utils/tributario/fileParsers';

interface ClienteOption {
  id: string;
  nome: string;
  cpf_cnpj: string;
  crt: number | string;
  regime_tributario: string;
  estado: string;
}

export default function SaneadorArquivosPage() {
  const supabase = createClient();

  // Estados principais
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteOption | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Inspeção e Mapeamento
  const [estaInspecionando, setEstaInspecionando] = useState(false);
  const [inspecao, setInspecao] = useState<ArquivoInspecionado | null>(null);
  const [tabelaEscolhida, setTabelaEscolhida] = useState<string>('');
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas>({});

  // Auditoria e Resultados
  const [estaAuditando, setEstaAuditando] = useState(false);
  const [resultado, setResultado] = useState<{
    estatisticas: {
      totalItensArquivo: number;
      itensAuditadosNesteLote: number;
      inconsistenciasEncontradas: number;
      itensEmConformidade: number;
      produtosMonofasicos: number;
      percentualConformidade: number;
    };
    itens: ItemSaneadoRetorno[];
    download: {
      nomeArquivo: string;
      formato: string;
      base64: string;
    };
  } | null>(null);

  // Filtros na tabela
  const [filtroTab, setFiltroTab] = useState<'todos' | 'inconsistencias' | 'monofasicos' | 'reforma'>('inconsistencias');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [itemModal, setItemModal] = useState<ItemSaneadoRetorno | null>(null);

  // Carrega clientes do banco
  useEffect(() => {
    async function carregarClientes() {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, cpf_cnpj, crt, regime_tributario, estado')
        .order('nome');

      if (!error && data) {
        setClientes(data);
        if (data.length > 0) {
          setClienteSelecionado(data[0]);
        }
      }
    }
    carregarClientes();
  }, []);

  // Upload e envio para inspeção
  const handleSelecionarArquivo = async (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const permitidos = ['xlsx', 'xls', 'csv', 'json', 'sql', 'db', 'sqlite', 'sqlite3'];
    
    if (!permitidos.includes(ext)) {
      toast.error('Formato não suportado. Envie arquivos .xlsx, .csv, .json, .sql ou .db (SQLite).');
      return;
    }

    setArquivo(file);
    setResultado(null);
    setEstaInspecionando(true);

    const formData = new FormData();
    formData.append('acao', 'inspecionar');
    formData.append('arquivo', file);

    const tId = toast.loading(`Inspecionando estrutura de ${file.name}...`);
    try {
      const res = await fetch('/api/tributario/sanear-arquivo', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao inspecionar arquivo');
      }

      const insp: ArquivoInspecionado = data.inspecao;
      setInspecao(insp);
      setTabelaEscolhida(insp.tabelaPadrao);
      setMapeamento(insp.sugestaoMapeamento);

      toast.success(`Arquivo reconhecido como ${insp.tipo.toUpperCase()}! ${insp.tabelasDisponiveis.length} tabela(s) encontrada(s).`, { id: tId });
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: tId });
      setArquivo(null);
      setInspecao(null);
    } finally {
      setEstaInspecionando(false);
    }
  };

  // Quando o usuário troca a tabela selecionada
  const handleTrocaTabela = (novaTabela: string) => {
    setTabelaEscolhida(novaTabela);
    if (inspecao?.colunasPorTabela[novaTabela]) {
      // Re-sugere mapeamento para a nova tabela
      const cols = inspecao.colunasPorTabela[novaTabela];
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const mapa: MapeamentoColunas = {};
      for (const col of cols) {
        const c = norm(col);
        if (!mapa.colCodigo && (c === 'codigo' || c === 'cod' || c === 'id' || c === 'cprod')) mapa.colCodigo = col;
        else if (!mapa.colDescricao && (c.includes('desc') || c === 'nome' || c === 'produto' || c === 'xprod')) mapa.colDescricao = col;
        else if (!mapa.colNcm && (c === 'ncm' || c.includes('ncm') || c === 'sh')) mapa.colNcm = col;
        else if (!mapa.colCest && (c === 'cest' || c.includes('cest'))) mapa.colCest = col;
        else if (!mapa.colCfop && (c === 'cfop' || c.includes('cfop'))) mapa.colCfop = col;
        else if (!mapa.colCsosnCst && (c.includes('csosn') || c.includes('cst') || c.includes('trib'))) mapa.colCsosnCst = col;
        else if (!mapa.colValor && (c.includes('valor') || c.includes('preco') || c === 'vuncom')) mapa.colValor = col;
      }
      setMapeamento(mapa);
    }
  };

  // Executa Auditoria e Saneamento
  const handleExecutarAuditoria = async (formatoDownload: string = 'xlsx') => {
    if (!clienteSelecionado) {
      toast.error('Selecione o cliente responsável antes de auditar.');
      return;
    }
    if (!arquivo) {
      toast.error('Envie um arquivo para prosseguir.');
      return;
    }
    if (!mapeamento.colDescricao && !mapeamento.colNcm) {
      toast.error('Mapeie pelo menos a coluna de Descrição ou NCM dos produtos.');
      return;
    }

    setEstaAuditando(true);
    const tId = toast.loading('Executando auditoria tributária com Multi-IA e regras fiscais...');

    const formData = new FormData();
    formData.append('acao', 'auditar');
    formData.append('arquivo', arquivo);
    formData.append('cliente_id', clienteSelecionado.id);
    formData.append('tabela_escolhida', tabelaEscolhida);
    formData.append('mapeamento', JSON.stringify(mapeamento));
    formData.append('formato_download', formatoDownload);

    try {
      const res = await fetch('/api/tributario/sanear-arquivo', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha na auditoria');
      }

      setResultado(data);
      toast.success(
        `Auditoria concluída! ${data.estatisticas.inconsistenciasEncontradas} inconsistências diagnosticadas e saneadas.`, 
        { id: tId, duration: 6000 }
      );
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: tId });
    } finally {
      setEstaAuditando(false);
    }
  };

  // Helper de download de arquivos gerados em Base64
  const handleDownloadArquivo = (base64: string, nomeArquivo: string) => {
    try {
      const linkSource = `data:application/octet-stream;base64,${base64}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = nomeArquivo;
      downloadLink.click();
      toast.success(`Download de ${nomeArquivo} iniciado com sucesso!`);
    } catch (e: any) {
      toast.error('Erro ao gerar download: ' + e.message);
    }
  };

  // Colunas disponíveis da tabela atual para seleção nos selects
  const colunasDisponiveis = inspecao?.colunasPorTabela[tabelaEscolhida] || [];

  // Filtragem dos itens exibidos
  const itensFiltrados = (resultado?.itens || []).filter(item => {
    // Filtro por tab
    if (filtroTab === 'inconsistencias' && !item.houveInconsistencia) return false;
    if (filtroTab === 'monofasicos' && !item.isMonofasico) return false;
    if (filtroTab === 'reforma' && item.ibsAliq === 0 && item.cbsAliq === 0) return false;

    // Filtro por busca de texto
    if (buscaTexto) {
      const b = buscaTexto.toLowerCase();
      const matchDesc = item.descricaoOriginal.toLowerCase().includes(b);
      const matchNcm = (item.ncmSugerido || '').includes(b) || (item.ncmOriginal || '').includes(b);
      const matchCod = item.codigoOriginal.toLowerCase().includes(b);
      return matchDesc || matchNcm || matchCod;
    }

    return true;
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Database className="text-purple-600" size={32} />
            Saneador Tributário de Arquivos e Bancos
          </h1>
          <p className="text-slate-500 mt-2 text-base max-w-4xl">
            Saneie cadastros de produtos em planilhas <strong>(.xlsx, .csv)</strong>, cadastros <strong>(.json)</strong>, scripts <strong>(.sql)</strong> e bancos <strong>(.db / SQLite)</strong>. Valide NCM, CEST, CFOP, CSOSN/CST, PIS/COFINS e enquadre seu estoque nas regras da Reforma Tributária <strong>(IBS, CBS e IVA Dual)</strong> com Multi-IA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <Sparkles size={14} /> Multi-IA & Consenso Ativo
          </span>
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <ShieldCheck size={14} /> Risco Zero ERP
          </span>
        </div>
      </header>

      {/* Grid de Configuração Inicial: Passo 1 (Cliente) e Passo 2 (Upload) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ETAPA 1: Seleção do Cliente */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">Cliente & Regime Fiscal</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              O CRT e a UF determinam se os produtos usarão CSOSN ou CST e quais alíquotas se aplicam.
            </p>

            <label className="block text-xs font-semibold text-slate-700 mb-1">Selecionar Cliente</label>
            <select
              value={clienteSelecionado?.id || ''}
              onChange={e => {
                const found = clientes.find(c => c.id === e.target.value);
                setClienteSelecionado(found || null);
              }}
              className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none mb-4"
            >
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.cpf_cnpj})
                </option>
              ))}
            </select>
          </div>

          {clienteSelecionado && (
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Regime Tributário:</span>
                <span className="font-bold text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md">
                  {clienteSelecionado.crt == 1 || clienteSelecionado.regime_tributario === 'simples' ? 'Simples Nacional (CRT 1)' : 'Regime Normal (CRT 3)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Estado / UF:</span>
                <span className="font-bold text-slate-800">{clienteSelecionado.estado || 'MG'} (Minas Gerais)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Documento:</span>
                <span className="font-mono text-slate-700">{clienteSelecionado.cpf_cnpj}</span>
              </div>
            </div>
          )}
        </div>

        {/* ETAPA 2: Upload do Arquivo */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                2
              </span>
              <h2 className="text-base font-bold text-slate-900">Arquivo de Produtos ou Banco de Dados</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Formatos aceitos com segurança total: <strong>.xlsx, .xls, .csv, .json, .sql</strong> (dumps) e <strong>.db / .sqlite</strong>.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files?.[0]) handleSelecionarArquivo(e.dataTransfer.files[0]);
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                isDragOver ? 'border-purple-500 bg-purple-50/50' : 'border-slate-300 hover:border-purple-400 bg-slate-50/50'
              }`}
              onClick={() => document.getElementById('arquivoInput')?.click()}
            >
              <input
                id="arquivoInput"
                type="file"
                accept=".xlsx,.xls,.csv,.json,.sql,.db,.sqlite,.sqlite3"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleSelecionarArquivo(e.target.files[0]);
                }}
              />

              {estaInspecionando ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <RefreshCw size={36} className="text-purple-600 animate-spin" />
                  <p className="text-sm font-semibold text-slate-700">Lendo e inspecionando tabelas do arquivo...</p>
                </div>
              ) : arquivo ? (
                <div className="flex items-center gap-4 py-2">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    {inspecao?.tipo === 'planilha' && <FileSpreadsheet size={28} />}
                    {inspecao?.tipo === 'json' && <FileCode size={28} />}
                    {inspecao?.tipo === 'sql' && <FileText size={28} />}
                    {inspecao?.tipo === 'sqlite' && <Database size={28} />}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 text-sm">{arquivo.name}</p>
                    <p className="text-xs text-slate-500">
                      {(arquivo.size / 1024).toFixed(1)} KB • {inspecao?.tipo?.toUpperCase()} • {inspecao?.totalLinhasEstimado} linhas estimadas
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setArquivo(null);
                      setInspecao(null);
                      setResultado(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all ml-4"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-1">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    Arraste o arquivo ou <span className="text-purple-600 hover:underline">clique para selecionar</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Suporta planilhas Excel, JSON, dump SQL de ERPs e bancos SQLite
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ETAPA 3: Mapeador Visual Inteligente (Aparece assim que o arquivo é inspecionado) */}
      {inspecao && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <h2 className="text-lg font-bold text-slate-900">Mapeador Semântico Inteligente</h2>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                  Colunas Auto-Detectadas
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Confirme em qual tabela estão os produtos e correlacione as colunas do seu arquivo com o Hub.
              </p>
            </div>

            {/* Seletor de Tabela / Coleção */}
            {inspecao.tabelasDisponiveis.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <Layers size={16} className="text-purple-600" />
                <span className="text-xs font-semibold text-slate-700">Tabela Alvo:</span>
                <select
                  value={tabelaEscolhida}
                  onChange={e => handleTrocaTabela(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {inspecao.tabelasDisponiveis.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Grid de Dropdowns de Mapeamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Código / ID */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código / ID <span className="text-red-500">*</span>
              </label>
              <select
                value={mapeamento.colCodigo || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colCodigo: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Descrição / Nome */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Descrição do Item <span className="text-red-500">*</span>
              </label>
              <select
                value={mapeamento.colDescricao || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colDescricao: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* NCM Atual */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NCM Atual <span className="text-purple-600 font-bold">(Alvo)</span>
              </label>
              <select
                value={mapeamento.colNcm || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colNcm: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* CEST Atual */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CEST Atual
              </label>
              <select
                value={mapeamento.colCest || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colCest: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* CFOP Atual */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CFOP Atual
              </label>
              <select
                value={mapeamento.colCfop || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colCfop: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* CSOSN / CST */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CSOSN / CST ICMS
              </label>
              <select
                value={mapeamento.colCsosnCst || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colCsosnCst: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* PIS / COFINS */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CST PIS / COFINS
              </label>
              <select
                value={mapeamento.colPisCofins || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colPisCofins: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Preço / Valor */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preço / Valor Unitário
              </label>
              <select
                value={mapeamento.colValor || ''}
                onChange={e => setMapeamento(prev => ({ ...prev, colValor: e.target.value }))}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="">(Não mapeado)</option>
                {colunasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

          </div>

          {/* Amostra das primeiras linhas encontradas */}
          {inspecao.amostraPorTabela[tabelaEscolhida]?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">Amostra do Arquivo Original (3 primeiras linhas):</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                    <tr>
                      {colunasDisponiveis.slice(0, 7).map(col => (
                        <th key={col} className="px-3 py-2">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 font-mono">
                    {inspecao.amostraPorTabela[tabelaEscolhida].map((linha, idx) => (
                      <tr key={idx} className="hover:bg-white">
                        {colunasDisponiveis.slice(0, 7).map(col => (
                          <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                            {String(linha[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botão de Disparo */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info size={16} className="text-purple-600" />
              <span>A auditoria analisa cada produto com o Convênio ICMS 142/2018, Reforma Tributária e Multi-IA.</span>
            </div>

            <button
              onClick={() => handleExecutarAuditoria('xlsx')}
              disabled={estaAuditando}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {estaAuditando ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Saneando com Multi-IA...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Executar Auditoria & Saneamento
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 4: Resultados da Auditoria */}
      {resultado && (
        <div className="space-y-6">
          
          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Itens no Lote</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {resultado.estatisticas.itensAuditadosNesteLote}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">de {resultado.estatisticas.totalItensArquivo} no arquivo</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-red-200 shadow-sm bg-red-50/20">
              <p className="text-xs font-semibold text-red-600">Inconsistências</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {resultado.estatisticas.inconsistenciasEncontradas}
              </p>
              <p className="text-[11px] text-red-500 mt-0.5">NCM / CEST / CFOP corrigidos</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm bg-emerald-50/20">
              <p className="text-xs font-semibold text-emerald-600">Conformidade</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {resultado.estatisticas.percentualConformidade}%
              </p>
              <p className="text-[11px] text-emerald-500 mt-0.5">{resultado.estatisticas.itensEmConformidade} itens já corretos</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-blue-200 shadow-sm bg-blue-50/20">
              <p className="text-xs font-semibold text-blue-600">PIS/COF Monofásico</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {resultado.estatisticas.produtosMonofasicos}
              </p>
              <p className="text-[11px] text-blue-500 mt-0.5">Direito à recuperação fiscal</p>
            </div>

            <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-gradient-to-br from-purple-700 to-indigo-800 rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-semibold text-purple-200 uppercase tracking-wider">Reforma Tributária</p>
                <p className="text-xl font-bold mt-1">IBS + CBS</p>
              </div>
              <p className="text-[11px] text-purple-200 mt-2">
                IVA Dual (~26,5%) e Cesta Básica com Alíquota Zero calculados.
              </p>
            </div>

          </div>

          {/* Barra de Ações de Download Seguro */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">Exportar Arquivo Saneado:</span>
              <span className="text-xs text-slate-500">Escolha o formato ideal para reimportar no seu ERP com segurança</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Download Planilha Excel */}
              <button
                onClick={() => handleDownloadArquivo(resultado.download.base64, resultado.download.nomeArquivo)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <FileSpreadsheet size={16} /> Baixar Planilha (.xlsx)
              </button>

              {/* Download Script SQL */}
              <button
                onClick={() => handleExecutarAuditoria('sql')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <FileCode size={16} /> Script SQL UPDATE (.sql)
              </button>

              {/* Download JSON */}
              <button
                onClick={() => handleExecutarAuditoria('json')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <FileCode size={16} /> JSON Saneado (.json)
              </button>

              {/* Se o arquivo original for SQLite, oferece download de .db */}
              {inspecao?.tipo === 'sqlite' && (
                <button
                  onClick={() => handleExecutarAuditoria('sqlite')}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Database size={16} /> Banco SQLite (.db)
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Resultados Saneados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Header da Tabela com Tabs de Filtro e Busca */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFiltroTab('inconsistencias')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTab === 'inconsistencias'
                      ? 'bg-red-50 text-red-700 border border-red-200 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Inconsistências ({resultado.estatisticas.inconsistenciasEncontradas})
                </button>

                <button
                  onClick={() => setFiltroTab('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTab === 'todos'
                      ? 'bg-slate-100 text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos os Itens ({resultado.itens.length})
                </button>

                <button
                  onClick={() => setFiltroTab('monofasicos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTab === 'monofasicos'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monofásicos PIS/COFINS ({resultado.estatisticas.produtosMonofasicos})
                </button>

                <button
                  onClick={() => setFiltroTab('reforma')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTab === 'reforma'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Reforma (IBS & CBS)
                </button>
              </div>

              {/* Busca rápida de texto */}
              <div className="relative min-w-[240px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição ou NCM..."
                  value={buscaTexto}
                  onChange={e => setBuscaTexto(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-9 pr-4 py-1.5 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

            </div>

            {/* Grid da Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Descrição do Produto</th>
                    <th className="px-4 py-3">NCM (Orig → Sugerido)</th>
                    <th className="px-4 py-3">CEST</th>
                    <th className="px-4 py-3">CFOP / CSOSN</th>
                    <th className="px-4 py-3">Reforma: IBS / CBS</th>
                    <th className="px-4 py-3">IVA Dual</th>
                    <th className="px-4 py-3">Motor / Confiança</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Nenhum produto encontrado com o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    itensFiltrados.map((item, idx) => {
                      const ncmMudou = item.ncmOriginal && item.ncmOriginal.replace(/\D/g, '') !== item.ncmSugerido.replace(/\D/g, '');
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">
                            {item.codigoOriginal}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate" title={item.descricaoOriginal}>
                            {item.descricaoOriginal}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {ncmMudou ? (
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="text-red-500 line-through">{item.ncmOriginal}</span>
                                <ArrowRight size={12} className="text-slate-400" />
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {item.ncmSugerido}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-slate-800">
                                {item.ncmSugerido || 'Sem NCM'}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-mono">
                            {item.cestSugerido ? (
                              <span className="bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded">
                                {item.cestSugerido}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-mono whitespace-nowrap">
                            <span className="text-slate-800 font-bold">{item.cfopSugerido}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-700">{item.csosnSugerido}</span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-slate-800">
                              {item.ibsAliq}% IBS + {item.cbsAliq}% CBS
                            </span>
                            <p className="text-[10px] text-slate-400 truncate max-w-[140px]" title={item.classificacaoReforma}>
                              {item.classificacaoReforma}
                            </p>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {item.ivaDual}%
                            </span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[11px] font-medium text-slate-700 block truncate max-w-[120px]" title={item.provedorIa}>
                              {item.provedorIa}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold">
                              {item.scoreConfianca}% de certeza
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setItemModal(item)}
                              className="px-2.5 py-1 text-xs text-purple-700 hover:bg-purple-100 font-semibold rounded-lg transition-all"
                            >
                              Ver Detalhes
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* Modal de Detalhes do Produto */}
      {itemModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setItemModal(null)}
              className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
            >
              <X size={20} />
            </button>

            <div>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase">
                Diagnóstico Fiscal & Reforma Tributária
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">
                {itemModal.descricaoOriginal}
              </h3>
              <p className="text-xs font-mono text-slate-500 mt-0.5">Código: {itemModal.codigoOriginal}</p>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">NCM Corrigido:</span>
                <span className="font-mono font-bold text-purple-700">{itemModal.ncmSugerido}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">CEST (Convênio 142/2018):</span>
                <span className="font-mono font-bold text-slate-800">{itemModal.cestSugerido || 'Não aplicável'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">CFOP / CSOSN Sugerido:</span>
                <span className="font-mono font-bold text-slate-800">{itemModal.cfopSugerido} / {itemModal.csosnSugerido}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">IBS Estimado:</span>
                <span className="font-bold text-slate-800">{itemModal.ibsAliq}%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">CBS Estimado:</span>
                <span className="font-bold text-slate-800">{itemModal.cbsAliq}%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">IVA Dual (IBS + CBS):</span>
                <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">{itemModal.ivaDual}%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Enquadramento LC 214/2024:</span>
                <span className="font-bold text-slate-800">{itemModal.classificacaoReforma}</span>
              </div>
            </div>

            <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 text-xs text-purple-900 leading-relaxed">
              <p className="font-bold mb-1 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" /> Justificativa Técnica ({itemModal.provedorIa}):
              </p>
              <p>{itemModal.justificativa}</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setItemModal(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
