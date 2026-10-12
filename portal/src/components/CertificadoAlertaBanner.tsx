'use client'

import { AlertTriangle, ShieldAlert } from 'lucide-react'

interface CertificadoAlertaBannerProps {
  validade?: string | null
  titular?: string | null
  documento?: string | null
  razaoSocial?: string | null
  userRole?: 'admin' | 'contabilidade' | 'cliente'
  config?: {
    exibir_faixa_topo_certificado?: boolean
    exibir_certificados_contabilidade?: boolean
    exibir_certificados_cliente?: boolean
  }
}

export default function CertificadoAlertaBanner({
  validade,
  titular,
  documento,
  razaoSocial,
  userRole = 'admin',
  config
}: CertificadoAlertaBannerProps) {
  if (!validade) return null

  // Se a faixa vermelha foi desativada nas configurações gerais
  if (config?.exibir_faixa_topo_certificado === false) {
    return null
  }

  // Se for contabilidade e a permissão estiver desativada pelo Admin
  if (userRole === 'contabilidade' && config?.exibir_certificados_contabilidade === false) {
    return null
  }

  // Se for cliente e a permissão estiver desativada pelo Admin
  if (userRole === 'cliente' && config?.exibir_certificados_cliente === false) {
    return null
  }

  // Parse da data de validade
  const [ano, mes, dia] = validade.split('T')[0].split('-').map(Number)
  const valDate = new Date(ano, mes - 1, dia, 23, 59, 59)
  const hoje = new Date()
  const diffDays = Math.ceil((valDate.getTime() - hoje.getTime()) / (1000 * 3600 * 24))

  // Exibir apenas se estiver vencido (< 0) ou a 45 dias ou menos do vencimento
  if (diffDays > 45) {
    return null
  }

  const isVencido = diffDays < 0
  const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
  const titularInfo = titular || razaoSocial || 'Empresa'
  const docInfo = documento ? ` (${documento})` : ''

  return (
    <div 
      className={`w-full mb-6 p-4 rounded-xl border flex items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300 ${
        isVencido 
          ? 'bg-red-500 text-white border-red-600' 
          : 'bg-red-600 text-white border-red-700'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className="p-2 bg-white/20 rounded-lg shrink-0">
          {isVencido ? <ShieldAlert size={24} className="text-white" /> : <AlertTriangle size={24} className="text-white" />}
        </div>
        <div>
          <div className="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
            <span>{isVencido ? '🚨 CERTIFICADO DIGITAL VENCIDO' : '⚠️ ATENÇÃO: CERTIFICADO DIGITAL EXPIRANDO'}</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider">
              {isVencido ? `Venceu há ${Math.abs(diffDays)} dias` : `Vence em ${diffDays} dias`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-white/90 mt-0.5">
            <strong>Titular:</strong> {titularInfo}{docInfo} • <strong>Validade:</strong> {dataFormatada}. 
            {isVencido 
              ? ' A sincronização e emissão de notas fiscais estão sujeitas a interrupção imediata. Providencie a renovação do certificado A1 com urgência.' 
              : ' Providencie a renovação do certificado para evitar a interrupção da emissão fiscal e sincronização do Hub.'}
          </p>
        </div>
      </div>
    </div>
  )
}
