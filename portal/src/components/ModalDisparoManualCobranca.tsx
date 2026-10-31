'use client'

import { useState, useEffect } from 'react'
import {
  Send,
  X,
  Users,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Clock,
  ShieldAlert,
  Building2,
  Phone,
  FileText
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ModalDisparoManualCobrancaProps {
  isOpen: boolean
  onClose: () => void
  situacao: 'pre_vencimento' | 'no_vencimento' | 'atrasado_tolerancia' | 'bloqueado'
  tituloSituacao: string
  descricaoSituacao: string
  onSucesso?: () => void
}

export default function ModalDisparoManualCobranca({
  isOpen,
  onClose,
  situacao,
  tituloSituacao,
  descricaoSituacao,
  onSucesso
}: ModalDisparoManualCobrancaProps) {
  const [loading, setLoading] = useState(true)
  const [disparando, setDisparando] = useState(false)
  const [dados, setDados] = useState<any>(null)
  const [resultado, setResultado] = useState<any>(null)

  const carregarClientesElegiveis = async () => {
    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch(`/api/cron/billing-alerts/disparar-manual?situacao=${situacao}`)
      const json = await res.json()
      if (res.ok && json.success) {
        setDados(json)
      } else {
        toast.error(json.error || 'Erro ao consultar clientes da condição')
      }
    } catch (err: any) {
      toast.error('Falha de conexão: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      carregarClientesElegiveis()
    }
  }, [isOpen, situacao])

  if (!isOpen) return null

  const handleConfirmarDisparo = async () => {
    if (!dados || dados.total === 0) return

    setDisparando(true)
    const tId = toast.loading(`Disparando WhatsApp para ${dados.total} cliente(s)...`)

    try {
      const res = await fetch('/api/cron/billing-alerts/disparar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situacao })
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Falha ao processar disparos')
      }

      setResultado(json)
      toast.success(
        `Disparo concluído! ${json.enviados} enviado(s)${json.falhas > 0 ? `, ${json.falhas} falha(s)` : ''}.`,
        { id: tId, duration: 6000 }
      )

      if (onSucesso) onSucesso()
    } catch (err: any) {
      toast.error(`Erro no disparo: ${err.message}`, { id: tId, duration: 5000 })
    } finally {
      setDisparando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Disparo Manual em Massa: {tituloSituacao}
              </h3>
              <p className="text-xs text-slate-500">
                {descricaoSituacao}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={disparando}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw size={32} className="animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Buscando faturas e clientes na régua de cobrança...</p>
            </div>
          ) : resultado ? (
            /* Tela de Resultado do Disparo */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Disparos Finalizados com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    {resultado.enviados} mensagem(ns) enviada(s) via WhatsApp oficial.
                    {resultado.falhas > 0 && ` ${resultado.falhas} falharam.`}
                  </p>
                </div>
              </div>

              {/* Lista com o relatório detalhado */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">Relatório dos Disparos:</span>
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                  {resultado.disparos?.map((d: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{d.empresa}</span>
                        <span className="text-slate-400 block text-[11px]">
                          {d.contato ? `${d.contato} • ` : ''}{d.telefone} • {d.faturaCodigo}
                        </span>
                      </div>
                      <div>
                        {d.status === 'sucesso' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 size={12} /> Enviado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200" title={d.erro}>
                            Falha: {d.erro || 'Erro'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Tela Prévia dos Clientes Encontrados */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">
                    Clientes Elegíveis Hoje:
                  </span>
                </div>
                <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  {dados?.total || 0} cliente(s)
                </span>
              </div>

              {dados?.total === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-700">
                    Nenhum cliente se enquadra nesta situação no momento!
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Todas as faturas estão em dia ou pertencem a outros estágios da régua de cobrança.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                    <span>Lista de clientes a receber este disparo:</span>
                    <span>Total a cobrar: {dados?.clientes?.reduce((acc: number, c: any) => acc + (c.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {dados?.clientes?.map((c: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">
                            {c.nome_fantasia || c.razao_social}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{c.nome_contato ? `Contato: ${c.nome_contato}` : 'Sem contato cadastrado'}</span>
                            <span>•</span>
                            <span className="font-mono">{c.whatsapp}</span>
                          </span>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="font-bold text-emerald-700 block">
                            {c.valorFormatado}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {c.faturaCodigo} • Venc: {c.dataVencimento}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 italic">
                    * Cada cliente receberá a mensagem oficial com todas as variáveis interpoladas ([Cliente], [Empresa], [Fatura], link da fatura web e QR Code Pix Bacen oficial).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={disparando}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            {resultado ? 'Fechar' : 'Cancelar'}
          </button>

          {!resultado && (
            <button
              type="button"
              onClick={handleConfirmarDisparo}
              disabled={loading || disparando || !dados || dados.total === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow transition disabled:opacity-50 cursor-pointer"
            >
              {disparando ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Disparando mensagens...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Confirmar Disparo em Massa ({dados?.total || 0})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
