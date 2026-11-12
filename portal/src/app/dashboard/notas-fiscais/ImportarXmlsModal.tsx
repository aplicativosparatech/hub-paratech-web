'use client'

import React, { useState, useRef } from 'react'
import { Upload, X, FileText, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight, ShieldCheck, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ImportarXmlsModalProps {
  open: boolean
  onClose: () => void
  clienteId: string
  clienteNome?: string
  onImportConcluido?: () => void
}

interface ResumoImportacao {
  total: number
  saidasNfe: number
  saidasNfce: number
  entradas: number
  quarentena: number
  duplicados: number
  erros: number
}

interface DetalheItem {
  arquivo: string
  numero?: string
  modelo?: string
  chave?: string
  status: string
  motivo?: string
}

export default function ImportarXmlsModal({
  open,
  onClose,
  clienteId,
  clienteNome,
  onImportConcluido
}: ImportarXmlsModalProps) {
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null)
  const [detalhes, setDetalhes] = useState<DetalheItem[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList) return
    const novos: File[] = []
    for (let i = 0; i < filesList.length; i++) {
      const f = filesList[i]
      if (f.name.toLowerCase().endsWith('.xml')) {
        novos.push(f)
      }
    }
    if (novos.length === 0) {
      toast.error('Nenhum arquivo .xml válido foi selecionado.')
      return
    }
    setArquivos(prev => [...prev, ...novos])
    setResumo(null)
    setDetalhes([])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFilesSelected(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleEnviar = async () => {
    if (arquivos.length === 0) {
      toast.error('Adicione ao menos um arquivo XML para importar.')
      return
    }

    const targetClienteId = clienteId || (typeof window !== 'undefined' ? localStorage.getItem('hub_paratech_global_cliente') || '' : '')
    if (!targetClienteId) {
      toast.error('Selecione uma empresa antes de importar os arquivos.')
      return
    }

    setEnviando(true)
    const toastId = toast.loading(`Processando e triando ${arquivos.length} arquivo(s) XML...`)

    try {
      const formData = new FormData()
      formData.append('cliente_id', targetClienteId)
      for (const file of arquivos) {
        formData.append('files', file)
      }

      const res = await fetch('/api/notas-fiscais/importar-lote', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar arquivos no servidor.')
      }

      setResumo(data.resumo)
      setDetalhes(data.detalhes || [])
      setArquivos([])

      toast.success(
        `Importação concluída! ${data.resumo.saidasNfe + data.resumo.saidasNfce + data.resumo.entradas + data.resumo.quarentena} XMLs importados com sucesso.`,
        { id: toastId, duration: 5000 }
      )

      // Dispara evento global para recarregar contadores e tabelas
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hub_notas_atualizadas'))
      }

      if (onImportConcluido) {
        onImportConcluido()
      }

    } catch (err: any) {
      toast.error(err.message || 'Erro durante a importação.', { id: toastId })
    } finally {
      setEnviando(false)
    }
  }

  const handleReset = () => {
    setArquivos([])
    setResumo(null)
    setDetalhes([])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                Importar XMLs para o Portal
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                  Triagem Inteligente
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Empresa destino: <strong className="text-slate-800">{clienteNome || 'Cliente Selecionado'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!resumo ? (
            <>
              {/* Área de Drag & Drop */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/70'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/70'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload size={28} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Arraste arquivos XML aqui ou <span className="text-indigo-600 underline">clique para selecionar</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Suporta seleção de múltiplos arquivos de venda (NF-e, NFC-e) ou compra.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xml"
                  onChange={e => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Informações sobre a Triagem Automática */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  Triagem e Anti-Duplicidade Automática:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-500 ml-1">
                  <li><strong>Anti-Duplicidade:</strong> notas já existentes no Portal com protocolo são ignoradas sem duplicar.</li>
                  <li><strong>Encaminhamento Inteligente:</strong> notas de saída (NF-e/NFC-e) e de compras (entradas) são identificadas pelo CNPJ.</li>
                  <li><strong>Quarentena de Correção:</strong> notas incompletas (sem assinatura ou sem protocolo) vão direto para a aba de correção para você assinar com o Certificado A1.</li>
                </ul>
              </div>

              {/* Lista de arquivos selecionados */}
              {arquivos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{arquivos.length} arquivo(s) selecionado(s)</span>
                    <button
                      type="button"
                      onClick={() => setArquivos([])}
                      className="text-rose-600 hover:underline text-[11px]"
                    >
                      Limpar seleção
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50 space-y-1">
                    {arquivos.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-slate-100">
                        <span className="truncate max-w-[400px] text-slate-700 font-mono text-[11px] flex items-center gap-1.5">
                          <FileText size={13} className="text-slate-400" />
                          {f.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Relatório Final da Importação */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-1 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check size={26} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Processamento Concluído!</h3>
                <p className="text-xs text-slate-500">
                  {resumo.total} arquivo(s) analisado(s) com sucesso.
                </p>
              </div>

              {/* Cards do Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">{resumo.saidasNfce}</div>
                  <div className="text-[11px] font-semibold text-emerald-900 mt-0.5">NFC-e Saídas</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{resumo.saidasNfe}</div>
                  <div className="text-[11px] font-semibold text-blue-900 mt-0.5">NF-e Saídas</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-purple-700">{resumo.entradas}</div>
                  <div className="text-[11px] font-semibold text-purple-900 mt-0.5">Compras (Entradas)</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-amber-700">{resumo.quarentena}</div>
                  <div className="text-[11px] font-semibold text-amber-900 mt-0.5">Para Correção</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-slate-700">{resumo.duplicados}</div>
                  <div className="text-[11px] font-semibold text-slate-800 mt-0.5">Já no Portal (Ignorados)</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-rose-700">{resumo.erros}</div>
                  <div className="text-[11px] font-semibold text-rose-900 mt-0.5">Erros / Inválidos</div>
                </div>
              </div>

              {/* Detalhes dos Itens */}
              {detalhes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Registro de Importação detalhado:
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50 space-y-1">
                    {detalhes.map((item, idx) => {
                      const isOk = item.status.startsWith('adicionado')
                      const isQuar = item.status === 'quarentena'
                      const isDup = item.status === 'duplicado'

                      return (
                        <div key={idx} className="p-2 bg-white rounded-lg border border-slate-100 flex items-start justify-between gap-2 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                              {isOk && <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />}
                              {isQuar && <AlertTriangle size={13} className="text-amber-600 shrink-0" />}
                              {isDup && <span className="text-slate-400 font-bold shrink-0">🛡️</span>}
                              {item.numero ? `Nota #${item.numero} (${item.modelo === '65' ? 'NFC-e' : 'NF-e'})` : item.arquivo}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.motivo || item.status}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          {!resumo ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEnviar}
                disabled={enviando || arquivos.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition flex items-center gap-2 shadow-sm"
              >
                {enviando ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Processando Arquivos...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Confirmar e Importar ({arquivos.length})
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 transition"
              >
                Importar Outros Arquivos
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition"
              >
                Concluir e Fechar
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
