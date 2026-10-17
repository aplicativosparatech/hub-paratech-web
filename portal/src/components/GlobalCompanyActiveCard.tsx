'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { 
  Building2, ShieldCheck, AlertTriangle, CheckCircle2, 
  Search, Phone, MessageCircle, ExternalLink, RefreshCw, X, Building
} from 'lucide-react'
import { useGlobalClient, ClienteItem } from './GlobalClientContext'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

export default function GlobalCompanyActiveCard() {
  const { 
    selectedCliente, 
    userRole, 
    clientes, 
    setSelectedClienteId,
    priorizarNomeFantasia
  } = useGlobalClient()

  const [modalBuscaOpen, setModalBuscaOpen] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')

  // Formatação do Regime Tributário conforme Imagem 4
  const formatRegime = (regime?: string | null) => {
    if (!regime) return 'Simples Nacional'
    switch (regime.toLowerCase()) {
      case 'simples_nacional': return 'Simples Nacional'
      case 'simples_nacional_excesso': return 'Simples (Excesso Sublimite)'
      case 'lucro_presumido': return 'Lucro Presumido'
      case 'lucro_real': return 'Lucro Real'
      case 'mei': return 'MEI'
      default: return regime.replace(/_/g, ' ')
    }
  }

  // Análise da Validade do Certificado Digital A1
  const certStatus = useMemo(() => {
    if (!selectedCliente?.certificado_validade) {
      if (selectedCliente?.certificado_url) {
        return {
          tipo: 'ativo',
          texto: 'Certificado A1 Conectado (SEFAZ)',
          corBadge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
        }
      }
      return {
        tipo: 'sem_certificado',
        texto: 'Certificado A1: Não informado',
        corBadge: 'bg-slate-800 text-slate-400 border-slate-700'
      }
    }

    try {
      const dataVal = new Date(selectedCliente.certificado_validade)
      const agora = new Date()
      const diffDias = Math.ceil((dataVal.getTime() - agora.getTime()) / (1000 * 3600 * 24))
      const dataFormatada = dataVal.toLocaleDateString('pt-BR')

      if (diffDias < 0) {
        return {
          tipo: 'vencido',
          texto: `Certificado A1 Vencido em ${dataFormatada}`,
          corBadge: 'bg-rose-950/80 text-rose-300 border-rose-700/80'
        }
      }
      if (diffDias <= 45) {
        return {
          tipo: 'vencendo',
          texto: `Certificado A1 Vence em ${diffDias} dias (${dataFormatada})`,
          corBadge: 'bg-amber-950/80 text-amber-300 border-amber-700/80'
        }
      }
      return {
        tipo: 'ativo',
        texto: `Certificado A1 Válido até ${dataFormatada}`,
        corBadge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
      }
    } catch {
      return {
        tipo: 'ativo',
        texto: 'Certificado A1 Conectado',
        corBadge: 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
      }
    }
  }, [selectedCliente])

  // Iniciais para o Monograma caso não haja logo
  const iniciaisCliente = useMemo(() => {
    if (!selectedCliente) return 'HP'
    const nome = selectedCliente.nome_fantasia || selectedCliente.razao_social || 'Cliente'
    const partes = nome.trim().split(/\s+/)
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase()
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  }, [selectedCliente])

  // Lista de empresas filtradas para o Modal de Troca
  const clientesFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return clientes
    const t = termoBusca.toLowerCase().trim()
    const limpo = termoBusca.replace(/\D/g, '')
    return clientes.filter(c => {
      const r = (c.razao_social || '').toLowerCase()
      const f = (c.nome_fantasia || '').toLowerCase()
      const cnpj = (c.cnpj || '').toLowerCase()
      const cnpjLimpo = (c.cnpj || '').replace(/\D/g, '')
      const whats = (c.whatsapp || '').replace(/\D/g, '')
      return r.includes(t) || f.includes(t) || cnpj.includes(t) || (limpo && (cnpjLimpo.includes(limpo) || whats.includes(limpo)))
    })
  }, [clientes, termoBusca])

  // Se o usuário for Admin ou Contabilidade e não houver nenhuma empresa selecionada:
  if (!selectedCliente) {
    return (
      <div className="w-full mb-6">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Nenhuma Empresa Selecionada</span>
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
                  Aguardando Seleção
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Selecione uma empresa para carregar notas fiscais, apuração de impostos e relatórios em todas as abas.
              </p>
            </div>
          </div>

          {userRole !== 'cliente' && (
            <button
              type="button"
              onClick={() => setModalBuscaOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search size={14} />
              <span>Selecionar Empresa (Ctrl+K)</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // CARD COMPLETO CONFORME A IMAGEM 4 (DADOS CADASTRAIS DA EMPRESA SELECIONADA)
  // =========================================================================
  return (
    <section 
      aria-label="Dados Cadastrais da Empresa Selecionada"
      className="w-full mb-6 animate-in fade-in duration-200"
    >
      <div className="bg-gradient-to-r from-slate-900 via-[#0B1528] to-blue-950 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-blue-900/40">
        
        {/* TOPO DO CARD: TÍTULO + STATUS CERTIFICADO + BOTÃO TROCAR EMPRESA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/80">
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Building2 size={15} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Dados Cadastrais da Empresa Selecionada (Conferência Fiscal)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Badge de Validade do Certificado Digital A1 */}
            <div 
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-xs ${certStatus.corBadge}`}
              title={certStatus.texto}
            >
              <ShieldCheck size={14} className="shrink-0" />
              <span>{certStatus.texto}</span>
            </div>

            {/* Botão de Trocar Empresa (visível apenas para admin e contabilidade) */}
            {userRole !== 'cliente' && (
              <button
                type="button"
                onClick={() => setModalBuscaOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-semibold shadow-2xs hover:text-white transition cursor-pointer"
                title="Trocar empresa de referência (Atalho: Ctrl+K)"
              >
                <Search size={13} />
                <span>Trocar Empresa</span>
                <kbd className="hidden sm:inline text-[9px] font-mono bg-blue-950/80 px-1 py-0.2 rounded border border-blue-700/60 text-blue-300">
                  Ctrl+K
                </kbd>
              </button>
            )}
          </div>

        </div>

        {/* CORPO DO CARD CONFORME IMAGEM 4 (LOGO + 6 COLUNAS DE INFORMAÇÕES) */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6">
          
          {/* Logo do Cliente ou Monograma Visual */}
          <div className="shrink-0">
            {selectedCliente.logo_url ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/95 p-1.5 border border-white/20 shadow-md flex items-center justify-center overflow-hidden">
                <img 
                  src={selectedCliente.logo_url} 
                  alt={selectedCliente.nome_fantasia || selectedCliente.razao_social} 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 border border-blue-400/30 shadow-md flex flex-col items-center justify-center text-white font-extrabold text-lg tracking-wider"
                title={selectedCliente.nome_fantasia || selectedCliente.razao_social}
              >
                <span>{iniciaisCliente}</span>
                <span className="text-[9px] font-normal text-blue-200 uppercase -mt-0.5">Empresa</span>
              </div>
            )}
          </div>

          {/* Grid de Informações Cadastrais (Estrutura idêntica à Imagem 4) */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4 w-full">
            
            {/* Coluna 1: Razão Social */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Razão Social
              </p>
              <p 
                className="text-xs sm:text-sm font-bold text-slate-100 truncate" 
                title={selectedCliente.razao_social}
              >
                {selectedCliente.razao_social || '—'}
              </p>
            </div>

            {/* Coluna 2: Nome Fantasia */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Nome Fantasia
              </p>
              <p 
                className="text-xs sm:text-sm font-bold text-slate-100 truncate" 
                title={selectedCliente.nome_fantasia || 'Não informado'}
              >
                {selectedCliente.nome_fantasia || '—'}
              </p>
            </div>

            {/* Coluna 3: CNPJ / CPF */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                CNPJ / CPF
              </p>
              <p className="text-xs sm:text-sm font-bold font-mono text-blue-300 truncate">
                {formatarCnpjCpf(selectedCliente.cnpj)}
              </p>
            </div>

            {/* Coluna 4: Regime Tributário */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Regime Tributário
              </p>
              <p className="text-xs sm:text-sm font-bold text-amber-300 truncate">
                {formatRegime(selectedCliente.regime_tributario)}
              </p>
            </div>

            {/* Coluna 5: WhatsApp / Contato */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                WhatsApp / Contato
              </p>
              {selectedCliente.whatsapp || selectedCliente.telefone ? (
                <a
                  href={`https://wa.me/55${(selectedCliente.whatsapp || selectedCliente.telefone || '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-medium text-slate-200 hover:text-emerald-400 flex items-center gap-1.5 transition truncate"
                  title="Clique para abrir conversa no WhatsApp"
                >
                  <MessageCircle size={13} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{selectedCliente.whatsapp || selectedCliente.telefone}</span>
                </a>
              ) : (
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  Não informado
                </p>
              )}
            </div>

            {/* Coluna 6: Contabilidade */}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Contabilidade
              </p>
              <p 
                className="text-xs sm:text-sm font-bold text-emerald-400 truncate"
                title={selectedCliente.contabilidade_nome || 'Não vinculada'}
              >
                {selectedCliente.contabilidade_nome || 'MASSIMA CONTABILIDADE LTDA'}
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL DE TROCA RÁPIDA DE EMPRESA (OMNICHANNEL SEARCH) */}
      {modalBuscaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            {/* Header do Modal */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Trocar Empresa de Referência
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalBuscaOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ ou Celular..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  autoFocus
                />
              </div>
            </div>

            {/* Lista de Empresas */}
            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
              {clientesFiltrados.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhuma empresa encontrada com os termos informados.
                </div>
              ) : (
                clientesFiltrados.map((cli) => {
                  const isAtual = cli.id === selectedCliente?.id
                  return (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => {
                        setSelectedClienteId(cli.id)
                        setModalBuscaOpen(false)
                      }}
                      className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer ${
                        isAtual 
                          ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {cli.nome_fantasia || cli.razao_social}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {cli.razao_social} • CNPJ {formatarCnpjCpf(cli.cnpj)}
                        </p>
                      </div>

                      {isAtual && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full shrink-0">
                          Ativa
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

          </div>
        </div>
      )}

    </section>
  )
}
