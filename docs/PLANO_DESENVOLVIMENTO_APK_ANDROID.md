# 📱 Especificação Técnica: Aplicativo Android (APK) - PDV & Gestão de Bolso para MEI

Este documento define a arquitetura, pilha de tecnologias e escopo de implementação do **Aplicativo Android (APK)** oficial para o **MEI Simples** e expansível para os outros sistemas Paratech (**TechSlim**, **Gastro**, **Pes.ai**).

Projetado especificamente para **usuários leigos**, eliminando jargões fiscais e simplificando a rotina de vendas e controle em balcão, feiras, entregas e rua.

---

## 🎯 Gatilho Oficial de Acionamento

Quando o usuário emitir o comando:
> **`DESENVOLVER O APK [NOME DO SISTEMA]`**  
> *(ou de forma direta: **`DESENVOLVER O APK`**)*

O agente carregará este plano técnico e iniciará o desenvolvimento do aplicativo mobile integrado à nuvem e ao desktop.

---

## 🏗️ Pilares da Arquitetura do App

```
┌────────────────────────────────────────────────────────┐
│             HUB / NUVEM CENTRAL (API & SUPABASE)       │
│  • Catálogo de Produtos e Estoque Centralizado         │
│  • Histórico de Vendas, Relatórios e Limite MEI        │
│  • Fila de Impressão Remota (Cloud Spooler p/ Windows) │
└──────────────────────────┬─────────────────────────────┘
                           │ Sincronização em Tempo Real (REST / WebSocket)
            ┌──────────────┴──────────────┐
            ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   DESKTOP (PC BALCÃO)    │  │   APLICATIVO ANDROID     │
│  • Hub Desktop Ativo     │  │  • PDV Rápido em 3 Cliques│
│  • Impressora do Windows │  │  • Impressora Bluetooth   │
│    (Recebe do celular)   │  │  • Envio via WhatsApp     │
│                          │  │  • Controle por Voz       │
└──────────────────────────┘  └──────────────────────────┘
```

---

## ⚡ Funcionalidades Essenciais do APK

### 1. Sistema Completo de Impressão e Compartilhamento
O usuário leigo pode escolher onde e como quer entregar o comprovante/cupom fiscal:
* **Impressão na Impressora do Windows (Remota / Rede)**:
  * Quando o vendedor está na loja ou depósito com o celular, ao finalizar uma venda no app, ele pode tocar em *"Imprimir no Computador"*.
  * O app despacha o comando para a fila do Hub Desktop (via API local ou nuvem), e o Windows imprime na impressora térmica USB/Rede ou A4 configurada no caixa.
* **Impressão Direta via Bluetooth (ESC/POS)**:
  * Pareamento nativo e descomplicado com mini-impressoras térmicas portáteis Bluetooth (58mm e 80mm - padrão de maquininhas e impressoras de cinto).
  * Emissão instantânea de DANFE NFC-e compacta ou comprovante não fiscal para feirantes, entregadores e autônomos.
* **Envio Direto pelo WhatsApp**:
  * Botão em destaque *"Enviar no WhatsApp"*. Abre a conversa do cliente com o link/comprovante formatado ou PDF do DANFE em 1 toque, sem precisar gastar papel.

### 2. Controle por Voz Inteligente (Mãos Livres)
Integrado ao motor de voz do ecossistema Paratech:
* **Botão Flutuante de Microfone**: O vendedor apenas segura e fala:
  * *"Adiciona 2 águas minerais e fecha no Pix"*
  * *"Qual o preço do óleo de soja?"*
  * *"Quanto vendi hoje?"*
  * *"Quanto falta pro meu limite de MEI estourar?"*
* **Feedback por Áudio**: O aplicativo responde falando em português claro e amigável confirmando a ação realizada.

### 3. Venda Ultrarrápida em 3 Cliques ("PDV de Bolso")
* Grade visual com fotos e botões grandes dos produtos mais vendidos.
* Câmera do celular funcionando como leitor rápido de código de barras (dispensa comprar leitor externo).
* Pagamento via Pix Dinâmico na tela do celular com confirmação sonora de "caixa registradora" ou vibração.

### 4. Gestão Preventiva do MEI (Sem Contabilidade Complicada)
* **Termômetro do Limite MEI**: Barra colorida visual no topo mostrando o faturamento acumulado no ano contra o teto de R$ 81.000, evitando desenquadramento acidental.
* **Lembrete e Pix do DAS**: Alerta automático nos dias que antecedem o dia 20 com botão de *"Copiar Pix do DAS"* para pagar sem atrasos nem juros.
* **Zero Jargão Fiscal**: Nenhuma tela pede CFOP, CST, CSOSN ou NCM. O motor fiscal classifica tudo nos bastidores.

---

## 🛠️ Stack Tecnológica Recomendada

1. **Framework Frontend**: Flutter (mesmo ecossistema moderno da Paratech, gerando APK ultraleve, rápido e com alta compatibilidade Android 8 ao 15+).
2. **Comunicação Bluetooth**: Biblioteca `flutter_bluetooth_serial` ou `blue_thermal_printer` com driver ESC/POS nativo.
3. **Comunicação Windows**: Endpoint WebSocket/REST via Hub Paratech Desktop (`/api/printer/print-job`).
4. **Voz**: `speech_to_text` e `flutter_tts` para reconhecimento e síntese nativa com baixíssimo consumo de bateria.
5. **Backend**: Supabase / PostgreSQL com sincronização assíncrona (opera até com internet fraca ou offline).

---

## 📋 Fases de Execução ao Disparar o Gatilho

1. **Fase 1 - Conexão e Autenticação Nuvem**:
   * Login do MEI por e-mail/senha ou WhatsApp com sincronização da base de produtos e estoque.
2. **Fase 2 - Motor de Venda Mobile & Pagamento Pix**:
   * PDV de bolso com catálogo por foto, leitor por câmera e QR Code Pix dinâmico.
3. **Fase 3 - Tripla Saída (Windows, Bluetooth e WhatsApp)**:
   * Drivers ESC/POS Bluetooth, fila de impressão remota no Windows via Hub e gerador de mensagem rápida para WhatsApp.
4. **Fase 4 - Assistente de Voz & Painel MEI**:
   * Implementação do microfone de comandos rápidos e termômetro visual do limite anual do MEI.
