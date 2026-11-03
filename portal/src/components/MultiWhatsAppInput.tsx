'use client'

import { useState } from 'react'
import { Plus, X, MessageSquare, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

interface MultiWhatsAppInputProps {
  value: string
  onChange: (newValue: string) => void
  placeholder?: string
}

/**
 * Normaliza e formata um número para o padrão brasileiro com 55.
 */
function normalizarNumero(num: string): string | null {
  let limpo = num.replace(/\D/g, '').trim()
  if (!limpo || limpo.length < 10) return null

  // Se tiver 10 ou 11 dígitos, adiciona o DDI 55 do Brasil
  if ((limpo.length === 10 || limpo.length === 11) && !limpo.startsWith('55')) {
    limpo = '55' + limpo
  }

  return limpo.length >= 12 ? limpo : null
}

function formatarExibicao(num: string): string {
  const limpo = num.replace(/\D/g, '')
  if (limpo.startsWith('55') && limpo.length >= 12) {
    const ddi = limpo.substring(0, 2)
    const ddd = limpo.substring(2, 4)
    const resto = limpo.substring(4)
    if (resto.length === 9) {
      return `+${ddi} (${ddd}) ${resto.substring(0, 5)}-${resto.substring(5)}`
    }
    return `+${ddi} (${ddd}) ${resto.substring(0, 4)}-${resto.substring(4)}`
  }
  return num
}

export default function MultiWhatsAppInput({
  value,
  onChange,
  placeholder = 'Ex: (37) 99978-6187'
}: MultiWhatsAppInputProps) {
  const [inputValue, setInputValue] = useState('')

  // Lista de números parseada da string separada por vírgula
  const numeros = value
    ? value
        .split(/[,;\n]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0)
    : []

  const adicionarNumeros = (textoParaAdicionar: string) => {
    if (!textoParaAdicionar.trim()) return

    // Permite colar múltiplos números separados por vírgula, espaço ou ponto-e-vírgula
    const candidatos = textoParaAdicionar
      .split(/[,;\n/]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)

    const novosNumerosValidos: string[] = []

    for (const cand of candidatos) {
      const normalizado = normalizarNumero(cand)
      if (normalizado) {
        if (!numeros.includes(normalizado) && !novosNumerosValidos.includes(normalizado)) {
          novosNumerosValidos.push(normalizado)
        }
      } else {
        toast.error(`Número inválido: "${cand}". Digite DDD + número.`)
      }
    }

    if (novosNumerosValidos.length > 0) {
      const listaFinal = [...numeros, ...novosNumerosValidos]
      onChange(listaFinal.join(', '))
      setInputValue('')
      toast.success(
        novosNumerosValidos.length === 1
          ? 'WhatsApp adicionado!'
          : `${novosNumerosValidos.length} números adicionados!`
      )
    }
  }

  const removerNumero = (numeroRemover: string) => {
    const listaFinal = numeros.filter(n => n !== numeroRemover)
    onChange(listaFinal.join(', '))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      adicionarNumeros(inputValue)
    }
  }

  return (
    <div className="space-y-2">
      {/* Input de Adição com Botão + */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-800 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => adicionarNumeros(inputValue)}
          className="px-4 py-2.5 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer text-sm shrink-0"
          title="Adicionar número de WhatsApp"
        >
          <Plus size={16} />
          <span>Adicionar</span>
        </button>
      </div>

      {/* Badges dos Números Cadastrados */}
      {numeros.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          {numeros.map((num, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-900 border border-teal-200 rounded-lg text-xs font-bold shadow-2xs animate-in fade-in"
            >
              <MessageSquare size={13} className="text-teal-600" />
              <span>{formatarExibicao(num)}</span>
              <button
                type="button"
                onClick={() => removerNumero(num)}
                className="text-teal-600 hover:text-rose-600 p-0.5 rounded hover:bg-teal-100 transition cursor-pointer"
                title="Remover este WhatsApp"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          Nenhum número cadastrado ainda. Se vazio, o sistema usará o WhatsApp principal do cadastro.
        </p>
      )}
    </div>
  )
}
