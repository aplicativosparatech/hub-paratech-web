'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileDown, FileUp, Upload } from 'lucide-react'
import { useNotasFiscaisFilters } from './NotasFiscaisFilterContext'
import ImportarXmlsModal from './ImportarXmlsModal'

export default function NotasFiscaisNavTabs() {
  const pathname = usePathname()
  const { selectedCliente, clienteAtual, filtroMes } = useNotasFiscaisFilters()

  const [modalImportOpen, setModalImportOpen] = useState(false)
  const [contadores, setContadores] = useState({
    totalNfeSaidas: 0,
    totalNfceSaidas: 0,
    totalSaidas: 0,
    totalEntradas: 0,
    totalCorrecao: 0,
    totalInutilizar: 0
  })
  const [loadingContadores, setLoadingContadores] = useState(false)

  const loadContadores = useCallback(async () => {
    if (!selectedCliente) return
    setLoadingContadores(true)
    try {
      const q = new URLSearchParams({
        cliente_id: selectedCliente
      })
      if (filtroMes) q.append('mes', filtroMes)

      const res = await fetch(`/api/notas-fiscais/contadores?${q.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContadores({
          totalNfeSaidas: data.totalNfeSaidas || 0,
          totalNfceSaidas: data.totalNfceSaidas || 0,
          totalSaidas: data.totalSaidas || 0,
          totalEntradas: data.totalEntradas || 0,
          totalCorrecao: data.totalCorrecao || 0,
          totalInutilizar: data.totalInutilizar || 0
        })
      }
    } catch (e) {
      console.warn('Erro ao carregar contadores de notas:', e)
    } finally {
      setLoadingContadores(false)
    }
  }, [selectedCliente, filtroMes])

  useEffect(() => {
    loadContadores()
  }, [loadContadores])

  // Ouve evento global quando notas forem importadas, excluídas ou corrigidas
  useEffect(() => {
    const handleAtualizacao = () => {
      loadContadores()
    }
    window.addEventListener('hub_notas_atualizadas', handleAtualizacao)
    return () => window.removeEventListener('hub_notas_atualizadas', handleAtualizacao)
  }, [loadContadores])

  const isActive = (path: string) => pathname.includes(path)

  const fmtNum = (n: number) => n.toLocaleString('pt-BR')

  return (
    <>
      {/* Navegação Principal: Entradas, Saídas e Botão de Importação Direta */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 mb-6 gap-3">
        <div className="flex border-b sm:border-b-0 border-slate-200">
          <Link
            href="/dashboard/notas-fiscais/entradas/nfe"
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition ${
              isActive('/entradas')
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileDown size={18} />
            <span>Entradas</span>
            {selectedCliente && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isActive('/entradas') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {fmtNum(contadores.totalEntradas)}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard/notas-fiscais/saidas/nfe"
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition ${
              isActive('/saidas')
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileUp size={18} />
            <span>Saídas</span>
            {selectedCliente && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isActive('/saidas') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {fmtNum(contadores.totalSaidas)}
              </span>
            )}
          </Link>
        </div>

        {/* Botão de Importação Direta de XMLs com Triagem Inteligente */}
        <div className="pb-2 sm:pb-0">
          <button
            type="button"
            onClick={() => setModalImportOpen(true)}
            disabled={!selectedCliente}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition flex items-center justify-center gap-2 shadow-sm"
            title="Importar arquivos XML diretamente para o portal sem precisar colar na pasta do cliente"
          >
            <Upload size={15} />
            Importar XMLs para o Portal
          </button>
        </div>
      </div>

      {/* Sub-abas de Saídas (Mostrado apenas se estiver em Saídas) */}
      {isActive('/saidas') && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link
            href="/dashboard/notas-fiscais/saidas/nfe"
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              pathname.endsWith('/saidas/nfe')
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>NF-e (Mod 55)</span>
            {selectedCliente && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                pathname.endsWith('/saidas/nfe') ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {fmtNum(contadores.totalNfeSaidas)}
              </span>
            )}
          </Link>

          <Link
            href="/dashboard/notas-fiscais/saidas/nfce"
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              pathname.endsWith('/saidas/nfce')
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>NFC-e (Mod 65)</span>
            {selectedCliente && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                pathname.endsWith('/saidas/nfce') ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {fmtNum(contadores.totalNfceSaidas)}
              </span>
            )}
          </Link>

          <Link
            href="/dashboard/notas-fiscais/saidas/correcao"
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              pathname.endsWith('/saidas/correcao')
                ? 'bg-amber-500 text-white shadow-sm'
                : contadores.totalCorrecao > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className={pathname.endsWith('/saidas/correcao') ? 'text-white' : 'text-amber-600'}>⚠️</span>
            <span>Arquivos para Correção</span>
            {selectedCliente && (
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                pathname.endsWith('/saidas/correcao')
                  ? 'bg-amber-700 text-white'
                  : contadores.totalCorrecao > 0
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {fmtNum(contadores.totalCorrecao)}
              </span>
            )}
          </Link>

          <Link
            href="/dashboard/notas-fiscais/saidas/inutilizar"
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              pathname.endsWith('/saidas/inutilizar')
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className={pathname.endsWith('/saidas/inutilizar') ? 'text-white' : 'text-rose-600'}>🚫</span>
            <span>A Inutilizar / Faltantes</span>
          </Link>
        </div>
      )}

      {/* Modal de Importação Direta */}
      <ImportarXmlsModal
        open={modalImportOpen}
        onClose={() => setModalImportOpen(false)}
        clienteId={selectedCliente}
        clienteNome={clienteAtual?.razao_social || clienteAtual?.nome_fantasia}
        onImportConcluido={() => {
          loadContadores()
        }}
      />
    </>
  )
}
