'use client'

import React, { useState, useEffect } from 'react'
import { 
  Code2, Copy, Check, Terminal, Globe, ShieldCheck, 
  ExternalLink, Sparkles, FileText, Send, Database, 
  CreditCard, CheckCircle2, ChevronRight, Layers,
  Server, Key, RefreshCw, Cpu, Package
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'

interface ClienteOption {
  id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  hub_token?: string
}

export default function CardApisHubParatech() {
  const supabase = createClient()
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null)
  const [baseUrl, setBaseUrl] = useState('https://hubfiscal.paratechsolucoes.com.br')
  const [activeLang, setActiveLang] = useState<'curl' | 'javascript' | 'python'>('curl')
  const [activeCategoria, setActiveCategoria] = useState<string>('todos')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }

    async function carregarClientes() {
      try {
        const { data } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj, hub_token')
          .eq('is_ativo', true)
          .order('razao_social')
        
        if (data && data.length > 0) {
          setClientes(data)
          setSelectedCliente(data[0])
        }
      } catch (err) {
        console.error('Erro ao carregar clientes:', err)
      }
    }
    carregarClientes()
  }, [])

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(`${label} copiado com sucesso!`, { icon: '📋' })
    setTimeout(() => setCopiedKey(null), 2200)
  }

  const tokenAtual = selectedCliente?.hub_token || 'TOKEN_HUB_DO_CLIENTE'
  const clienteIdAtual = selectedCliente?.id || 'UUID_DO_CLIENTE'

  // Lista dos 9 Endpoints do Hub Paratech
  const endpoints = [
    {
      id: 'upload_xml',
      categoria: 'xml',
      metodo: 'POST',
      rota: '/api/hub/upload-xml',
      titulo: '1. Ingestão / Upload de XMLs (Vendas & Compras)',
      badge: 'Principal',
      badgeCor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      descricao: 'Envia qualquer XML de NF-e, NFC-e, CT-e ou MDF-e. A API valida a assinatura, detecta divergências de emitente, extrai pagamentos (PIX, dinheiro, cartão), calcula monofásicos (PIS/COFINS CST 04 e 06), consulta protocolo SEFAZ e salva no Storage.',
      contentType: 'multipart/form-data',
      params: [
        { name: 'hub_token', type: 'string', required: true, desc: 'Token exclusivo da empresa cadastrada no Hub' },
        { name: 'tipo_pasta', type: 'string', required: true, desc: "'vendas' (notas emitidas) ou 'compras' (notas recebidas)" },
        { name: 'xml_file', type: 'File / Binary', required: true, desc: 'Arquivo XML da nota fiscal' }
      ],
      curl: `curl -X POST "${baseUrl}/api/hub/upload-xml" \\
  -F "hub_token=${tokenAtual}" \\
  -F "tipo_pasta=vendas" \\
  -F "xml_file=@/caminho/para/nota_fiscal.xml"`,
      javascript: `// Exemplo em Node.js / Browser (FormData)
const formData = new FormData();
formData.append('hub_token', '${tokenAtual}');
formData.append('tipo_pasta', 'vendas');
formData.append('xml_file', fs.createReadStream('./nota_fiscal.xml')); // ou File no browser

const response = await fetch('${baseUrl}/api/hub/upload-xml', {
  method: 'POST',
  body: formData
});
const data = await response.json();
console.log('Status da Nota:', data);`,
      python: `import requests

url = "${baseUrl}/api/hub/upload-xml"
files = {
    'xml_file': ('nota_fiscal.xml', open('nota_fiscal.xml', 'rb'), 'application/xml')
}
data = {
    'hub_token': '${tokenAtual}',
    'tipo_pasta': 'vendas'
}

response = requests.post(url, files=files, data=data)
print(response.json())`,
      responseExemplo: `{
  "success": true,
  "chave": "31261012345678000199550010000001001000001002",
  "numero": "100",
  "valor": 1250.80,
  "monofasico_valor": 340.50,
  "pagamentos": [{ "forma": "PIX", "valor": 1250.80 }],
  "is_autorizada": true
}`
    },
    {
      id: 'distribuicao_dfe',
      categoria: 'dfe',
      metodo: 'POST',
      rota: '/api/sefaz/distribuicao-dfe/consultar',
      titulo: '2. Distribuição DF-e SEFAZ (Notas de Fornecedores em Nuvem)',
      badge: 'Nuvem',
      badgeCor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      descricao: 'Consulta em tempo real no WebService da SEFAZ Nacional todas as notas fiscais emitidas contra o CNPJ da empresa usando o Certificado Digital A1 já armazenado no sistema (sem precisar de computador ligado no cliente).',
      contentType: 'application/json',
      params: [
        { name: 'cliente_id', type: 'UUID', required: true, desc: 'ID único da empresa no Hub' },
        { name: 'competencia', type: 'string', required: false, desc: "Mês no formato 'YYYY-MM' (ex: '2026-10')" },
        { name: 'ao_vivo', type: 'boolean', required: false, desc: 'true para acionar a SEFAZ Nacional imediatamente' }
      ],
      curl: `curl -X POST "${baseUrl}/api/sefaz/distribuicao-dfe/consultar" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cliente_id": "${clienteIdAtual}",
    "competencia": "2026-10",
    "ao_vivo": true
  }'`,
      javascript: `const response = await fetch('${baseUrl}/api/sefaz/distribuicao-dfe/consultar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cliente_id: '${clienteIdAtual}',
    competencia: '2026-10',
    ao_vivo: true
  })
});
const resultado = await response.json();
console.log('Documentos Recebidos:', resultado.documentos);`,
      python: `import requests

url = "${baseUrl}/api/sefaz/distribuicao-dfe/consultar"
payload = {
    "cliente_id": "${clienteIdAtual}",
    "competencia": "2026-10",
    "ao_vivo": True
}
response = requests.post(url, json=payload)
print(response.json())`,
      responseExemplo: `{
  "success": true,
  "totalNovos": 4,
  "ultNSU": "000000000012480",
  "maxNSU": "000000000012480"
}`
    },
    {
      id: 'manifestar_dfe',
      categoria: 'dfe',
      metodo: 'POST',
      rota: '/api/sefaz/distribuicao-dfe/manifestar',
      titulo: '3. Manifestação do Destinatário na SEFAZ',
      badge: 'SEFAZ',
      badgeCor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      descricao: 'Envia evento oficial de manifestação do destinatário assinado pelo Certificado Digital na SEFAZ Nacional.',
      contentType: 'application/json',
      params: [
        { name: 'cliente_id', type: 'UUID', required: true, desc: 'ID da empresa' },
        { name: 'chave', type: 'string (44 dígitos)', required: true, desc: 'Chave de acesso da NF-e' },
        { name: 'tipo_evento', type: 'string', required: true, desc: '210200 (Confirmação), 210210 (Ciência), 210220 (Desconhecimento), 210240 (Não Realizada)' }
      ],
      curl: `curl -X POST "${baseUrl}/api/sefaz/distribuicao-dfe/manifestar" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cliente_id": "${clienteIdAtual}",
    "chave": "31261012345678000199550010000001001000001002",
    "tipo_evento": "210200"
  }'`,
      javascript: `const res = await fetch('${baseUrl}/api/sefaz/distribuicao-dfe/manifestar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cliente_id: '${clienteIdAtual}',
    chave: '31261012345678000199550010000001001000001002',
    tipo_evento: '210200' // 210200=Confirmação | 210210=Ciência
  })
});
const data = await res.json();
console.log('Manifestação:', data);`,
      python: `import requests

url = "${baseUrl}/api/sefaz/distribuicao-dfe/manifestar"
payload = {
    "cliente_id": "${clienteIdAtual}",
    "chave": "31261012345678000199550010000001001000001002",
    "tipo_evento": "210200"
}
res = requests.post(url, json=payload)
print(res.json())`,
      responseExemplo: `{
  "success": true,
  "cStat": "135",
  "xMotivo": "Evento registrado e vinculado a NF-e",
  "protocolo": "131260000123456"
}`
    },
    {
      id: 'sefaz_status',
      categoria: 'sefaz',
      metodo: 'POST',
      rota: '/api/sefaz/status',
      titulo: '4. Status do WebService da SEFAZ por UF',
      badge: 'Monitoramento',
      badgeCor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      descricao: 'Verifica a disponibilidade dos servidores da SEFAZ por Estado.',
      contentType: 'application/json',
      params: [
        { name: 'uf', type: 'string (2 letras)', required: true, desc: 'Sigla da UF (ex: MG, SP, RJ, BA)' }
      ],
      curl: `curl -X POST "${baseUrl}/api/sefaz/status" \\
  -H "Content-Type: application/json" \\
  -d '{ "uf": "MG" }'`,
      javascript: `const res = await fetch('${baseUrl}/api/sefaz/status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uf: 'MG' })
});
const status = await res.json();
console.log(status);`,
      python: `import requests

res = requests.post("${baseUrl}/api/sefaz/status", json={"uf": "MG"})
print(res.json())`,
      responseExemplo: `{
  "online": true,
  "uf": "MG",
  "tempoRespostaMs": 142,
  "mensagem": "Serviço em Operação"
}`
    },
    {
      id: 'sefaz_inutilizar',
      categoria: 'sefaz',
      metodo: 'POST',
      rota: '/api/sefaz/inutilizar',
      titulo: '5. Inutilização de Faixa de Numeração na SEFAZ',
      badge: 'Fiscal',
      badgeCor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      descricao: 'Inutiliza números ou faixas de NF-e (55) e NFC-e (65) não utilizados.',
      contentType: 'application/json',
      params: [
        { name: 'cliente_id', type: 'UUID', required: true, desc: 'ID da empresa' },
        { name: 'modelo', type: 'number', required: true, desc: '55 (NF-e) ou 65 (NFC-e)' },
        { name: 'serie', type: 'number', required: true, desc: 'Série da nota' },
        { name: 'numero_inicial', type: 'number', required: true, desc: 'Número inicial' },
        { name: 'numero_final', type: 'number', required: true, desc: 'Número final' },
        { name: 'justificativa', type: 'string', required: true, desc: 'Mínimo 15 caracteres' }
      ],
      curl: `curl -X POST "${baseUrl}/api/sefaz/inutilizar" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cliente_id": "${clienteIdAtual}",
    "modelo": 55,
    "serie": 1,
    "numero_inicial": 105,
    "numero_final": 105,
    "justificativa": "Numeracao inutilizada por falha operacional de emissao"
  }'`,
      javascript: `const res = await fetch('${baseUrl}/api/sefaz/inutilizar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cliente_id: '${clienteIdAtual}',
    modelo: 55,
    serie: 1,
    numero_inicial: 105,
    numero_final: 105,
    justificativa: 'Numeracao inutilizada por falha operacional de emissao'
  })
});
const data = await res.json();
console.log(data);`,
      python: `import requests

res = requests.post("${baseUrl}/api/sefaz/inutilizar", json={
    "cliente_id": "${clienteIdAtual}",
    "modelo": 55,
    "serie": 1,
    "numero_inicial": 105,
    "numero_final": 105,
    "justificativa": "Numeracao inutilizada por falha operacional de emissao"
})
print(res.json())`,
      responseExemplo: `{
  "success": true,
  "cStat": "102",
  "xMotivo": "Inutilizacao de numero homologado",
  "protocolo": "131260000987654"
}`
    },
    {
      id: 'sefaz_correcao',
      categoria: 'sefaz',
      metodo: 'POST',
      rota: '/api/sefaz/corrigir-nota',
      titulo: '6. Carta de Correção Eletrônica (CC-e)',
      badge: 'Fiscal',
      badgeCor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      descricao: 'Emite uma CC-e oficial vinculada a uma NF-e autorizada.',
      contentType: 'application/json',
      params: [
        { name: 'cliente_id', type: 'UUID', required: true, desc: 'ID da empresa' },
        { name: 'chave', type: 'string', required: true, desc: 'Chave de 44 dígitos' },
        { name: 'correcao', type: 'string', required: true, desc: 'Texto da correção (mínimo 15 caracteres)' },
        { name: 'nSeqEvento', type: 'number', required: false, desc: 'Sequencial do evento (padrão 1)' }
      ],
      curl: `curl -X POST "${baseUrl}/api/sefaz/corrigir-nota" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cliente_id": "${clienteIdAtual}",
    "chave": "31261012345678000199550010000001001000001002",
    "correcao": "Correcao nos dados adicionais de cobranca do pedido",
    "nSeqEvento": 1
  }'`,
      javascript: `const res = await fetch('${baseUrl}/api/sefaz/corrigir-nota', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cliente_id: '${clienteIdAtual}',
    chave: '31261012345678000199550010000001001000001002',
    correcao: 'Correcao nos dados adicionais de cobranca do pedido',
    nSeqEvento: 1
  })
});
const data = await res.json();
console.log(data);`,
      python: `import requests

res = requests.post("${baseUrl}/api/sefaz/corrigir-nota", json={
    "cliente_id": "${clienteIdAtual}",
    "chave": "31261012345678000199550010000001001000001002",
    "correcao": "Correcao nos dados adicionais de cobranca do pedido",
    "nSeqEvento": 1
})
print(res.json())`,
      responseExemplo: `{
  "success": true,
  "cStat": "135",
  "xMotivo": "Evento registrado e vinculado a NF-e",
  "protocolo": "131260000112233"
}`
    },
    {
      id: 'auditoria_tributaria',
      categoria: 'tributario',
      metodo: 'POST',
      rota: '/api/tributario/auditar-produtos',
      titulo: '7. Auditoria Tributária de Produtos (NCM / CEST / Reforma)',
      badge: 'Inteligência',
      badgeCor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      descricao: 'Audita produtos em lote cruzando com a tabela oficial da Receita Federal e Reforma Tributária (IBS e CBS).',
      contentType: 'application/json',
      params: [
        { name: 'produtos', type: 'Array<Object>', required: true, desc: 'Lista de produtos com id, descricao, ncm, cest, cst_pis' }
      ],
      curl: `curl -X POST "${baseUrl}/api/tributario/auditar-produtos" \\
  -H "Content-Type: application/json" \\
  -d '{
    "produtos": [
      { "id": "1", "descricao": "REFRIGERANTE COCA COLA 2L", "ncm": "22021000", "cst_pis": "04" }
    ]
  }'`,
      javascript: `const res = await fetch('${baseUrl}/api/tributario/auditar-produtos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    produtos: [
      { id: '1', descricao: 'REFRIGERANTE COCA COLA 2L', ncm: '22021000', cst_pis: '04' }
    ]
  })
});
const auditoria = await res.json();
console.log(auditoria);`,
      python: `import requests

res = requests.post("${baseUrl}/api/tributario/auditar-produtos", json={
    "produtos": [
        { "id": "1", "descricao": "REFRIGERANTE COCA COLA 2L", "ncm": "22021000", "cst_pis": "04" }
    ]
})
print(res.json())`,
      responseExemplo: `{
  "success": true,
  "totalAuditados": 1,
  "divergencias": 0,
  "oportunidades": 1
}`
    },
    {
      id: 'robotech_chat',
      categoria: 'tributario',
      metodo: 'POST',
      rota: '/api/botech/chat',
      titulo: '8. Agente de IA Robotech (Consultas e Automações)',
      badge: 'IA Oficial',
      badgeCor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      descricao: 'Envia perguntas em linguagem natural e recebe respostas precisas com dados fiscais e faturas consolidadas em tempo real.',
      contentType: 'application/json',
      params: [
        { name: 'message', type: 'string', required: true, desc: 'Pergunta do usuário para o Robotech' },
        { name: 'context', type: 'Object', required: false, desc: '{ clienteId: "UUID" } para escopo de empresa' }
      ],
      curl: `curl -X POST "${baseUrl}/api/botech/chat" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Qual foi o total emitido em vendas PIX este mes?",
    "context": { "clienteId": "${clienteIdAtual}" }
  }'`,
      javascript: `const res = await fetch('${baseUrl}/api/botech/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Qual foi o total emitido em vendas PIX este mes?',
    context: { clienteId: '${clienteIdAtual}' }
  })
});
const data = await res.json();
console.log(data.resposta);`,
      python: `import requests

res = requests.post("${baseUrl}/api/botech/chat", json={
    "message": "Qual foi o total emitido em vendas PIX este mes?",
    "context": { "clienteId": "${clienteIdAtual}" }
})
print(res.json()["resposta"])`,
      responseExemplo: `{
  "resposta": "No mês atual, você emitiu um total de R$ 84.507,95 em 582 notas fiscais.",
  "provedor": "Gemini 3.5 Flash"
}`
    },
    {
      id: 'gerar_pix',
      categoria: 'financeiro',
      metodo: 'POST',
      rota: '/api/pagamentos/gerar-pix',
      titulo: '9. Geração de Cobrança PIX Dinâmica',
      badge: 'Financeiro',
      badgeCor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      descricao: 'Gera cobrança PIX imediata com QR Code em imagem e código Copia e Cola via InfinitePay ou Mercado Pago.',
      contentType: 'application/json',
      params: [
        { name: 'fatura_id', type: 'UUID', required: true, desc: 'ID da fatura cadastrada no sistema' }
      ],
      curl: `curl -X POST "${baseUrl}/api/pagamentos/gerar-pix" \\
  -H "Content-Type: application/json" \\
  -d '{ "fatura_id": "UUID_DA_FATURA" }'`,
      javascript: `const res = await fetch('${baseUrl}/api/pagamentos/gerar-pix', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fatura_id: 'UUID_DA_FATURA' })
});
const pix = await res.json();
console.log('QR Code:', pix.qr_code_base64);
console.log('Copia e Cola:', pix.pix_copia_cola);`,
      python: `import requests

res = requests.post("${baseUrl}/api/pagamentos/gerar-pix", json={
    "fatura_id": "UUID_DA_FATURA"
})
print(res.json())`,
      responseExemplo: `{
  "success": true,
  "pix_copia_cola": "00020126580014br.gov.bcb.pix...",
  "qr_code_base64": "data:image/png;base64,iVBORw0KGgo...",
  "valor": 120.00
}`
    }
  ]

  const endpointsFiltrados = endpoints.filter(ep => {
    if (activeCategoria === 'todos') return true
    return ep.categoria === activeCategoria
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* CARD PRINCIPAL DE APRESENTAÇÃO */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-indigo-500/30 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-12 top-6 opacity-10">
          <Code2 size={180} />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={14} className="text-blue-400" />
            Card APIs Hub_Paratech • Integração Direta
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
            Integre suas Aplicações sem instalar o <code className="text-amber-400 font-mono bg-black/40 px-2 py-0.5 rounded-md">hub.exe</code>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed mb-6">
            O Hub Paratech oferece uma suíte completa de <strong>APIs REST na Nuvem</strong> para que seus ERPs, PDVs, 
            sistemas web e aplicativos móveis se comuniquem diretamente com o Hub. Você pode enviar XMLs, consultar a SEFAZ Nacional 
            em tempo real via certificado A1, manifestar notas, emitir CC-e e consultar o agente Robotech IA sem qualquer agente desktop local.
          </p>

          {/* DADOS DE CONEXÃO RÁPIDA (BASE URL & SELETOR DE CLIENTE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-white/10">
            {/* Base URL */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <Globe size={14} className="text-blue-400" />
                Base URL Oficial (Host)
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-white/5">
                <code className="text-xs sm:text-sm font-mono text-emerald-400 truncate">{baseUrl}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(baseUrl, 'base_url', 'Base URL')}
                  className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
                  title="Copiar Base URL"
                >
                  {copiedKey === 'base_url' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'base_url' ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Pode ser o domínio Vercel padrão ou seu subdomínio próprio (ex.: <code className="text-slate-300">hubfiscal.paratechsolucoes.com.br</code>).
              </p>
            </div>

            {/* Seletor Dinâmico de Token de Empresa */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                <Key size={14} className="text-amber-400" />
                Empresa para Teste (Injeta Tokens nos Exemplos)
              </span>
              {clientes.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={selectedCliente?.id || ''}
                    onChange={(e) => {
                      const c = clientes.find(item => item.id === e.target.value)
                      if (c) setSelectedCliente(c)
                    }}
                    className="w-full bg-slate-950/80 border border-white/10 px-3 py-2 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {clientes.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.razao_social} ({c.cnpj})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400">hub_token:</span>
                    <code className="text-xs font-mono text-amber-300 truncate">{tokenAtual}</code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(tokenAtual, 'token_cliente', 'hub_token')}
                      className="px-2 py-0.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition shrink-0 flex items-center gap-1 cursor-pointer"
                      title="Copiar Token"
                    >
                      {copiedKey === 'token_cliente' ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedKey === 'token_cliente' ? 'Copiado!' : 'Copiar Token'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Nenhum cliente cadastrado no momento.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS E LINGUAGEM DE CÓDIGO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        
        {/* Filtro por Categoria */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 hidden md:inline">
            Filtrar:
          </span>
          {[
            { id: 'todos', label: 'Todos (9)' },
            { id: 'xml', label: 'XMLs & Upload' },
            { id: 'dfe', label: 'DF-e SEFAZ Nuvem' },
            { id: 'sefaz', label: 'Serviços SEFAZ' },
            { id: 'tributario', label: 'Tributário & IA' },
            { id: 'financeiro', label: 'PIX / Pagamentos' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategoria(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeCategoria === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Seletor de Linguagem do Snippet */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Código:</span>
          {[
            { id: 'curl', label: 'cURL' },
            { id: 'javascript', label: 'JavaScript' },
            { id: 'python', label: 'Python' }
          ].map(lang => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setActiveLang(lang.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeLang === lang.id
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

      </div>

      {/* LISTA DE CARDS DE ENDPOINTS */}
      <div className="space-y-6">
        {endpointsFiltrados.map((ep) => {
          const codeToCopy = activeLang === 'curl' ? ep.curl : activeLang === 'javascript' ? ep.javascript : ep.python
          const isCopied = copiedKey === `code_${ep.id}`
          const isCopiedRoute = copiedKey === `route_${ep.id}`

          return (
            <div 
              key={ep.id} 
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-lg transition-shadow"
            >
              {/* Header do Endpoint */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      {ep.metodo}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${ep.badgeCor}`}>
                      {ep.badge}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      {ep.contentType}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {ep.titulo}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${baseUrl}${ep.rota}`, `route_${ep.id}`, 'URL do Endpoint')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                    title="Copiar URL Completa"
                  >
                    {isCopiedRoute ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{isCopiedRoute ? 'URL Copiada!' : 'Copiar Rota'}</span>
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                {ep.descricao}
              </p>

              {/* Tabela de Parâmetros */}
              <div className="mb-5 bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Parâmetros da Requisição ({ep.contentType})
                </span>
                <div className="space-y-1.5 font-mono text-xs">
                  {ep.params.map((p, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-slate-200/40 dark:border-slate-800/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-blue-600 dark:text-blue-400">{p.name}</strong>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {p.type}
                        </span>
                        {p.required && (
                          <span className="text-[9px] font-bold text-red-500 uppercase">Obrigatório</span>
                        )}
                      </div>
                      <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                        {p.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco de Código Pronto para Copiar */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-slate-400" />
                    <span className="font-mono text-slate-300">
                      Exemplo em {activeLang === 'curl' ? 'cURL (Terminal)' : activeLang === 'javascript' ? 'JavaScript (Fetch)' : 'Python (Requests)'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(codeToCopy, `code_${ep.id}`, `Código ${activeLang.toUpperCase()}`)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    {isCopied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                    <span>{isCopied ? 'Código Copiado!' : 'Copiar Código'}</span>
                  </button>
                </div>

                <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed custom-scrollbar max-h-72">
                  <code>{codeToCopy}</code>
                </pre>
              </div>

              {/* Exemplo de Resposta JSON */}
              {ep.responseExemplo && (
                <div className="mt-3">
                  <details className="group">
                    <summary className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 cursor-pointer flex items-center gap-1 py-1">
                      <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
                      <span>Ver exemplo de Resposta JSON (HTTP 200 OK)</span>
                    </summary>
                    <div className="mt-2 p-3 bg-slate-900 dark:bg-black rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                      <pre><code>{ep.responseExemplo}</code></pre>
                    </div>
                  </details>
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  )
}
