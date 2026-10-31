'use client'

import { useEffect, useState, use } from 'react'
import QRCode from 'qrcode'
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  Laptop,
  Calendar,
  DollarSign,
  QrCode,
  Building2
} from 'lucide-react'
import { formatarCnpjCpf } from '@/utils/cnpjAlfanumerico'

interface FaturaData {
  id: string
  competencia: string
  mesAnteriorReferencia: string
  data_vencimento: string
  valor: number
  valor_original: number
  valor_multa: number
  valor_juros: number
  status: string
  qr_code_payload: string | null
  pago_em: string | null
  created_at: string
}

interface ClienteData {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  nome_sistema_utilizado: string
}

export default function FaturaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const faturaId = resolvedParams.id

  const [loading, setLoading] = useState(true)
  const [fatura, setFatura] = useState<FaturaData | null>(null)
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const carregarFatura = async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const res = await fetch(`/api/fatura-publica/${faturaId}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Fatura não encontrada')
      }
      setFatura(data.fatura)
      setCliente(data.cliente)

      // Se tiver payload Pix, gera imagem QR Code
      if (data.fatura.qr_code_payload) {
        try {
          const url = await QRCode.toDataURL(data.fatura.qr_code_payload, {
            width: 280,
            margin: 2,
            color: { dark: '#020617', light: '#ffffff' }
          })
          setQrCodeDataUrl(url)
        } catch (e) {
          console.error('Erro ao gerar imagem QR Code:', e)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar fatura')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }

  useEffect(() => {
    carregarFatura()

    // Polling a cada 6s para atualizar se a fatura foi paga
    const interval = setInterval(() => {
      carregarFatura(true)
    }, 6000)

    return () => clearInterval(interval)
  }, [faturaId])

  const handleCopiarPix = () => {
    if (!fatura?.qr_code_payload) return
    navigator.clipboard.writeText(fatura.qr_code_payload)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800">Carregando Fatura...</h2>
          <p className="text-sm text-slate-500 mt-1">Buscando informações seguras no Hub Paratech</p>
        </div>
      </div>
    )
  }

  if (errorMsg || !fatura) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Fatura Não Encontrada</h2>
          <p className="text-sm text-slate-500 mt-2">{errorMsg || 'A fatura solicitada não existe ou foi removida.'}</p>
        </div>
      </div>
    )
  }

  const isPago = fatura.status === 'pago' || fatura.status === 'paga'
  const isVencida = !isPago && new Date(fatura.data_vencimento) < new Date()
  const [anoV, mesV, diaV] = fatura.data_vencimento.split('-')
  const vencimentoFormatado = `${diaV}/${mesV}/${anoV}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 py-10 px-4 flex flex-col items-center">
      <div className="max-w-2xl w-full">
        {/* Top Header / Branding Paratech */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">PARATECH</h1>
              <p className="text-xs text-slate-500 font-medium">Soluções em Software & Gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Ambiente Seguro</span>
          </div>
        </div>

        {/* Card Principal da Fatura */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Faixa Superior de Status */}
          <div className={`p-6 border-b ${
            isPago 
              ? 'bg-emerald-500 text-white' 
              : isVencida 
                ? 'bg-amber-500 text-white' 
                : 'bg-blue-600 text-white'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-90 block">
                  {isPago ? 'Pagamento Confirmado' : isVencida ? 'Fatura Vencida' : 'Fatura em Aberto'}
                </span>
                <p className="text-2xl font-extrabold mt-0.5">
                  R$ {fatura.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                {isPago ? <CheckCircle2 size={28} /> : isVencida ? <Clock size={28} /> : <QrCode size={28} />}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            {/* Informações do Sistema e Cliente */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                <Laptop size={14} />
                <span>Sistema de Gerenciamento Comercial e Fiscal [{cliente?.nome_sistema_utilizado || 'MEI Simples'}]</span>
              </div>
              <p className="text-xs text-slate-500">
                Cobrança de mensalidade referente ao mês anterior ({fatura.mesAnteriorReferencia}).
              </p>

              <div className="mt-4 pt-3 border-t border-slate-200/70 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Contratante / Razão Social:</span>
                  <span className="font-bold text-slate-800 text-sm">{cliente?.nome_fantasia || cliente?.razao_social}</span>
                  {cliente?.nome_fantasia && cliente?.razao_social && (
                    <span className="text-[11px] text-slate-500 block truncate">{cliente.razao_social}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">CNPJ:</span>
                  <span className="font-mono font-semibold text-slate-700">{formatarCnpjCpf(cliente?.cnpj || '')}</span>
                </div>
              </div>
            </div>

            {/* Metadados da Fatura */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Calendar size={13} />
                  <span>Competência</span>
                </div>
                <span className="font-bold text-slate-800">{fatura.competencia}</span>
              </div>
              <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                  <Clock size={13} />
                  <span>Vencimento</span>
                </div>
                <span className={`font-bold ${isVencida ? 'text-red-600' : 'text-slate-800'}`}>
                  {vencimentoFormatado} {isVencida && '(Vencida)'}
                </span>
              </div>
            </div>

            {/* Bloco de Pagamento PIX (se ainda pendente) */}
            {!isPago && (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-4">
                  <span>⚡ Liberação Automática Imediata via Pix</span>
                </div>

                {qrCodeDataUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 mb-4 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeDataUrl}
                        alt="QR Code Pix"
                        width={240}
                        height={240}
                        className="rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mb-4 max-w-sm">
                      Aponte a câmera do aplicativo do seu banco para o QR Code acima para pagar.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    Carregando QR Code Pix...
                  </div>
                )}

                {/* Pix Copia e Cola */}
                {fatura.qr_code_payload && (
                  <div className="mt-2 text-left">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Código Pix Copia e Cola:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={fatura.qr_code_payload}
                        className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700 truncate select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleCopiarPix}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer ${
                          copied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                        }`}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copied ? 'Copiado!' : 'Copiar Pix'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-200 text-left text-xs text-slate-500 space-y-1.5">
                  <p className="font-semibold text-slate-700">Como pagar:</p>
                  <p>1. Abra o app do seu banco e escolha a opção <strong>Pix</strong>.</p>
                  <p>2. Selecione <strong>Pix Copia e Cola</strong> ou aponte a câmera para o QR Code.</p>
                  <p>3. Conclua o pagamento. O seu sistema será desbloqueado e sincronizado automaticamente em poucos segundos!</p>
                </div>
              </div>
            )}

            {/* Banner de Quitação (se já estiver paga) */}
            {isPago && (
              <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl font-extrabold text-emerald-900">Fatura Quitada com Sucesso!</h3>
                <p className="text-sm text-emerald-700 mt-1 max-w-md mx-auto">
                  O pagamento desta fatura foi confirmado. O seu sistema está com a licença ativa e regularizada.
                </p>
                {fatura.pago_em && (
                  <p className="text-xs text-emerald-600 font-mono mt-3">
                    Confirmado em: {new Date(fatura.pago_em).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Rodapé Seguro */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <span>Fatura ID: #{fatura.id.split('-')[0]}</span>
            <span>Paratech Soluções em Software • CNPJ 58.448.898/0001-45</span>
          </div>
        </div>

        {/* Rodapé adicional */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Em caso de dúvidas financeiras ou suporte técnico, entre em contato diretamente pelo WhatsApp de suporte.
        </p>
      </div>
    </div>
  )
}
