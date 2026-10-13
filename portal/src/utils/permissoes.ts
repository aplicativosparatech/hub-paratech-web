import { SupabaseClient } from '@supabase/supabase-js'

export interface ModuloPermissao {
  id: string
  modulo_chave: string
  nome: string
  descricao: string | null
  categoria: string
  rota: string | null
  icone: string | null
  ordem: number
  permitido_cliente: boolean
  permitido_contabilidade: boolean
  permitido_admin: boolean
  created_at?: string
  updated_at?: string
}

export type PermissoesMap = Record<string, { cliente: boolean; contabilidade: boolean }>

/**
 * Busca todas as regras de permissão de módulos do banco
 */
export async function carregarPermissoesModulos(supabase: SupabaseClient): Promise<{
  lista: ModuloPermissao[]
  map: PermissoesMap
}> {
  try {
    const { data, error } = await supabase
      .from('permissoes_modulos')
      .select('*')
      .order('ordem', { ascending: true })

    if (error || !data) {
      console.error('Erro ao carregar permissões:', error)
      return { lista: [], map: {} }
    }

    const map: PermissoesMap = {}
    data.forEach((m: ModuloPermissao) => {
      map[m.modulo_chave] = {
        cliente: m.permitido_cliente,
        contabilidade: m.permitido_contabilidade
      }
    })

    return { lista: data, map }
  } catch (err) {
    console.error('Falha na consulta de permissões:', err)
    return { lista: [], map: {} }
  }
}

/**
 * Verifica se um papel tem acesso a uma funcionalidade específica
 */
export function hasPermission(
  map: PermissoesMap,
  moduloChave: string,
  role: 'admin' | 'cliente' | 'contabilidade' | null | undefined
): boolean {
  if (role === 'admin') return true
  if (!role) return false

  const perm = map[moduloChave]
  if (!perm) return true // padrão liberado se não configurado

  if (role === 'cliente') return perm.cliente
  if (role === 'contabilidade') return perm.contabilidade

  return false
}
