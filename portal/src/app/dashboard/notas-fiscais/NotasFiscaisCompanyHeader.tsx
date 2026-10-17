'use client'

import React from 'react'
import { Building2, ShieldCheck, Calendar, MapPin, Award, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react'
import { useNotasFiscaisFilters } from './NotasFiscaisFilterContext'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'
import { useGlobalClient } from '@/components/GlobalClientContext'

const MESES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
]

function formatarMesAnoCompetencia(isoDate?: string | null): string {
  if (!isoDate) return 'Não configurado'
  try {
    const [ano, mes] = isoDate.split('-')
    const mesIdx = parseInt(mes, 10) - 1
    if (mesIdx >= 0 && mesIdx < 12) {
      return `${MESES[mesIdx]} DE ${ano}`
    }
    return isoDate
  } catch {
    return isoDate
  }
}

export default function NotasFiscaisCompanyHeader() {
  const {
    userRole,
    clientes,
    clienteAtual,
    loadingClientes,
    selectedCliente,
    setSelectedCliente
  } = useNotasFiscaisFilters()

  const { interfaceMode, priorizarNomeFantasia } = useGlobalClient()

  if (loadingClientes && clientes.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 animate-pulse flex items-center justify-between">
        <div className="h-6 bg-slate-200 rounded w-64"></div>
        <div className="h-6 bg-slate-200 rounded w-48"></div>
      </div>
    )
  }

  const isClienteRole = userRole === 'cliente'

  // ===== MODO CLEAN: CABEÇALHO COMPACTO E ELEGANTE (FOCO TOTAL NOS DADOS) =====
  if (interfaceMode === 'clean') {
    if (!clienteAtual) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Nenhuma empresa selecionada no filtro global
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Utilize o campo de busca no topo da tela (ou atalho <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono">Ctrl + K</kbd>) para selecionar uma empresa e visualizar suas notas fiscais.
              </p>
            </div>
          </div>
          {clientes.length > 0 && !isClienteRole && (
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Escolher empresa rápida...</option>
                {clientes.map(cli => (
                  <option key={cli.id} value={cli.id}>
                    {cli.razao_social}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )
    }

    const nomePrincipal = priorizarNomeFantasia && clienteAtual.nome_fantasia ? clienteAtual.nome_fantasia : clienteAtual.razao_social
    const nomeSecundario = priorizarNomeFantasia && clienteAtual.nome_fantasia ? clienteAtual.razao_social : (clienteAtual.nome_fantasia || null)

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl px-4 py-2.5 mb-5 shadow-2xs flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {nomePrincipal}
              </span>
              {clienteAtual.regime_tributario && (
                <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 shrink-0">
                  {clienteAtual.regime_tributario.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>CNPJ: <strong className="text-slate-700 dark:text-slate-300">{formatarCnpjCpf(clienteAtual.cnpj)}</strong></span>
              {(clienteAtual.cidade || clienteAtual.uf) && (
                <>
                  <span>•</span>
                  <span>{clienteAtual.cidade ? `${clienteAtual.cidade}/` : ''}{clienteAtual.uf || 'MG'}</span>
                </>
              )}
              {nomeSecundario && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[200px] text-slate-400">{nomeSecundario}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Status do Certificado A1 */}
          {clienteAtual.certificado_url ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
              Certificado A1 OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
              Sem Certificado A1
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
            <ShieldCheck size={13} />
            Isolamento Ativo
          </span>
        </div>
      </div>
    )
  }

  // ===== MODO CLÁSSICO: CABEÇALHO ORIGINAL COM GRADIENTE E COMBOBOX =====

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 mb-6 shadow-md border border-slate-700/60 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Título e Seletor Principal da Empresa */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800/60">
              <Building2 size={14} className="text-cyan-400" />
              Empresa Cliente em Análise Fiscal
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              <ShieldCheck size={13} />
              Isolamento Fiscal Ativo (Zero mistura de XMLs)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {isClienteRole ? (
              // Perfil Cliente: Apenas exibe a sua empresa travada
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-4 py-2.5 rounded-xl">
                <span className="text-base font-bold text-white tracking-wide">
                  {clienteAtual?.razao_social || 'Minha Empresa'}
                </span>
                {clienteAtual?.nome_fantasia && (
                  <span className="text-xs text-slate-300 font-medium">
                    ({clienteAtual.nome_fantasia})
                  </span>
                )}
              </div>
            ) : (
              // Perfil Admin ou Contabilidade: Select Elegante e Amplo
              <div className="relative flex-1 max-w-2xl">
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold text-sm px-4 py-3 rounded-xl border border-cyan-500/50 shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer appearance-none pr-10 transition"
                  title="Clique para alternar entre as empresas clientes"
                >
                  {clientes.map((cli) => {
                    const cnpjFormat = formatarCnpjCpf(cli.cnpj)
                    const fant = cli.nome_fantasia ? ` (${cli.nome_fantasia})` : ''
                    return (
                      <option key={cli.id} value={cli.id} className="bg-slate-900 text-white py-1">
                        {cli.razao_social}{fant} — {cnpjFormat}
                      </option>
                    )
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-cyan-400">
                  <ChevronDown size={18} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Badges de Metadados e Segurança Fiscal da Empresa Selecionada */}
        {clienteAtual && (
          <div className="flex flex-wrap lg:flex-col lg:items-end justify-center gap-2 text-xs border-t lg:border-t-0 lg:border-l border-slate-700/80 pt-3 lg:pt-0 lg:pl-6">
            <div className="flex flex-wrap items-center gap-2">
              {/* CNPJ */}
              <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-200 font-mono font-bold" title="CNPJ da Empresa">
                CNPJ: <span className="text-cyan-300">{formatarCnpjCpf(clienteAtual.cnpj)}</span>
              </span>

              {/* Localização */}
              {(clienteAtual.uf || clienteAtual.cidade) && (
                <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1 font-medium">
                  <MapPin size={12} className="text-amber-400" />
                  {clienteAtual.cidade ? `${clienteAtual.cidade} / ` : ''}{clienteAtual.uf || 'MG'}
                </span>
              )}

              {/* Certificado Digital */}
              {clienteAtual.certificado_url ? (
                <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold" title="Certificado Digital A1 Conectado">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Certificado A1 OK
                </span>
              ) : (
                <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold" title="Sem Certificado Digital A1 vinculado">
                  <AlertTriangle size={13} className="text-amber-400" />
                  Sem Certificado A1
                </span>
              )}
            </div>

            {/* Início das Atividades / Ponto de Partida Fiscal */}
            {clienteAtual.data_inicio_monitoramento && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                <Calendar size={13} className="text-indigo-400" />
                <span>Ponto de Partida Fiscal:</span>
                <strong className="text-indigo-300 uppercase tracking-wide">
                  {formatarMesAnoCompetencia(clienteAtual.data_inicio_monitoramento)}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
