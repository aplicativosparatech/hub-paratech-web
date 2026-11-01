# 🎙️ Especificação: Assistente de Voz & Agente de IA com RAG Paratech

Este documento define a arquitetura, pilha de tecnologias e escopo de implementação do **Assistente de Voz e Copiloto de IA com RAG** para o ecossistema de sistemas Paratech (**MEI Simples**, **TechSlim**, **Gastro**, **Pes.ai**, **Hub Paratech Desktop** e outros).

---

## 🎯 Gatilho Oficial de Acionamento

Quando o usuário emitir o comando:
> **`IMPLANTAR O ASSISTENTE DE VOZ NO SISTEMA [NOME DO SISTEMA]`**  
> *(ou de forma simplificada: **`IMPLANTAR O ASSISTENTE DE VOZ`**)*

O agente carregará este plano técnico e iniciará a implementação dos módulos de voz (STT/TTS), o motor de intenções locais e a integração do RAG com a base de conhecimento no sistema informado.

---

## 🏗️ Pilares da Arquitetura

### 1. Voz "Mãos Livres" no Balcão (STT & TTS)
* **Reconhecimento de Fala (STT - Speech-to-Text)**:
  * Suporte nativo para Windows e Android via `speech_to_text` / Windows Speech API / Vosk / Whisper local para operação offline.
  * Ativação por Push-to-Talk (atalho no teclado `F2` ou segurar `Barra de Espaço`, ou botão de microfone flutuante no PDV).
* **Síntese de Fala (TTS - Text-to-Speech)**:
  * Motor ultraleve `flutter_tts` usando vozes nativas do sistema operacional (zero latência, sem consumo de dados).

### 2. Comandos Operacionais de Caixa (Offline First)
* Adicionar itens à venda ativa por voz (*"Adiciona 2 Cocas lata e 1 misto"*).
* Consultar preço e saldo de estoque (*"Preço da lâmpada LED 9W e quanto tem em estoque?"*).
* Fechamento e descontos expressos (*"Desconto de 10% e fecha no Pix"*).
* Lançamento de despesas e retiradas de caixa (*"Lança despesa de R$ 50 de água mineral"*).
* Consulta de fiado e saldo de clientes (*"Quanto o Carlos está me devendo?"*).

### 3. RAG Tributário e "Contador de Bolso"
* **Bases de Conhecimento Indexadas**:
  * Legislação do MEI / Simples Nacional (limite anual de R$ 81.000, regras do DAS, compras fora do estado).
  * Catálogo de NCM, CEST, Monofásicos e Substituição Tributária.
  * Tabela de erros e rejeições da SEFAZ traduzidos para português claro e com botão de autocorreção.

### 4. RAG Operacional de Suporte (Autônomo)
* Respostas passo a passo para qualquer dúvida sobre a operação do sistema:
  * Configurar impressora térmica ESC/POS.
  * Como cancelar uma nota emitida.
  * Como dar entrada em nota fiscal por XML.

### 5. Copiloto de Gestão e Insights
* Diagnóstico de vendas diárias e semanais.
* Alerta de produtos encalhados há mais de 30/60 dias.
* Previsão de esgotamento de estoque de itens com alto giro.

---

## 📋 Roteiro de Execução ao Disparar o Gatilho

1. **Dependências**: Adicionar plugins de áudio e fala (`speech_to_text`, `flutter_tts`, `record`).
2. **Parser de Intenções**: Implementar processador léxico e de intenções de caixa local para resposta instantânea offline.
3. **Componente de UI**: Criar widget flutuante e gaveta deslizante ("Copiloto Paratech") com atalho de teclado configurável.
4. **Base RAG Local/Cloud**: Integrar cliente de consulta rápida com embeddings/LLM leve (Gemini Flash) para dúvidas complexas e suporte.
