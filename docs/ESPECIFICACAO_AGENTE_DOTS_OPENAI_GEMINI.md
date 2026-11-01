# 🤖 Especificação: Agente de IA Dots (OpenAI & Gemini) Paratech

Este documento define a arquitetura, modelo de dados e escopo de implementação do **Agente de IA Integrado (OpenAI Assistants / Google Gemini 1.5)** para o ecossistema de sistemas Paratech (**MEI Simples**, **TechSlim**, **Gastro**, **Pes.ai**, **Hub Paratech Desktop** e outros).

---

## 🎯 Gatilho Oficial de Acionamento

Quando o usuário emitir o comando:
> **`IMPLEMENTAR DOTS OPENAI NO SISTEMA [NOME DO SISTEMA]`**  
> *(ou variações como: **`IMPLEMENTAR AGENTE IA NO SISTEMA [NOME DO SISTEMA]`**)*

O assistente carregará este plano técnico e iniciará a integração do Agente no sistema informado via Hub Paratech, suportando OpenAI (Assistants / GPT-4o-mini) e Google Gemini (1.5 Flash / Pro).

---

## 🏗️ Pilares da Arquitetura Multi-Tenant com Agente Único

1. **Agente Único Mestre (Assistant ID / System Instruction)**:
   - Mantido no backend do Hub Paratech com as instruções mestre: regras do Simples Nacional/MEI, interpretação de erros da SEFAZ, manual do software e tom de voz amigável.
2. **Isolamento de Conversas por Empresa (`thread_id`)**:
   - Cada empresa ou terminal tem sua própria thread de mensagens. Os dados de um cliente nunca são compartilhados nem visualizados por outro.
3. **Segurança de Credenciais**:
   - As chaves de API da OpenAI e do Google Gemini ficam seguras no servidor Hub Paratech, nunca expostas no código do aplicativo local.
4. **Function Calling (Ações no Sistema)**:
   - O agente pode invocar ferramentas do banco SQLite local:
     - `consultarPrecoEstoque(nomeOuCodigo)`
     - `resumoVendasDia(data)`
     - `explicarRejeicaoSefaz(codigoRejeicao)`
     - `listarClientesComDebito()`

---

## 📋 Escopo de Execução ao Disparar o Gatilho

1. **Endpoint no Hub Paratech**: Criar rota `/api/ia/chat` que recebe a pergunta do MEI Simples, injeta o contexto e roteia para OpenAI ou Gemini.
2. **Interface no MEI Simples**: Widget deslizante ("Copiloto IA") com chat flutuante, histórico de mensagens e botões de ação rápida.
3. **Chave de Licença do Módulo**: Verificação de status do complemento pago à parte para liberação do assistente.
