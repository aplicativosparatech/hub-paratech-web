# 🌐 Roadmap e Especificação das Versões Web & SaaS Multi-Tenant

Este documento define o plano arquitetural para a criação das versões Web (SaaS / Backoffice em Nuvem) e o ecossistema White-Label (B2B para Software Houses parceiras) dos sistemas Paratech (**MEI Simples**, **TechSlim**, **Gastro**, **Pes.ai** e outros).

---

## 🎯 Gatilho Oficial de Acionamento

Quando o usuário emitir o comando:
> **`VAMOS INICIAR A VERSAO WEB DO SISTEMA [NOME DO SISTEMA]`**  
*(Exemplo: "VAMOS INICIAR A VERSAO WEB DO SISTEMA MEI_SIMPLES" ou "VAMOS INICIAR A VERSAO WEB DO SISTEMA GASTRO")*

O agente deverá carregar este roadmap e executar o plano de implantação da versão Web correspondente.

---

## 🏗️ Modelo Arquitetural: Edge-First POS + Cloud SaaS Backoffice

```
┌────────────────────────────────────────────────────────┐
│             NUVEM / SAAS BACKOFFICE (WEB)             │
│   • Gestão de Produtos, Preços e Estoque Central       │
│   • Importação de XML de Notas de Compra (Distribuidor)│
│   • Financeiro Completo (DRE, Contas a Pagar/Receber)  │
│   • Painel do Dono (Acesso via Celular / Computador)   │
│   • Relatórios Fiscais e Contábeis                     │
│   • Suporte Multi-Tenant & White-Label (Soft. Houses)  │
└──────────────────────────┬─────────────────────────────┘
                           │ Sincronização Assíncrona
                           │ (Internet Online / Silenciosa)
                           ▼
┌────────────────────────────────────────────────────────┐
│             TERMINAL LOCAL (DESKTOP / ANDROID)         │
│   • Frente de Caixa / PDV Ultraleve (SQLite Cache)     │
│   • Leitor de Código de Barras / Balança               │
│   • Emissão Instantânea NFC-e e NF-e                   │
│   • Emissão em Contingência Offline (Sem Internet)    │
│   • Impressão Térmica Direta (ESC/POS)                 │
└────────────────────────────────────────────────────────┘
```

---

## 📋 Escopo de Execução ao Disparar o Gatilho

Ao receber a ordem `"VAMOS INICIAR A VERSAO WEB DO SISTEMA [NOME DO SISTEMA]"`:

### 1. Modelagem Multi-Tenant na Nuvem
- Criar ou estender schemas no banco de dados (Supabase/PostgreSQL) com isolamento estrito via **Row Level Security (RLS)** por `empresa_id` e `softwarehouse_id`.
- Suporte a hierarquia de 3 níveis: Super Admin Paratech -> Software House Parceira -> Comerciante Final.

### 2. Backoffice Web do Sistema
- Desenvolver o portal web dedicado para aquele segmento (ex: telas específicas de mesas/comandas para o Gastro Web, ou frentes de pesagem para o Pes.ai Web).
- Telas de cadastro mestre, importação de XML de compra com sugestão tributária automática e relatórios de fluxo de caixa.

### 3. Conector de Sincronização (Hub Sync Engine)
- Implementar endpoints no Hub para:
  - `GET /api/sync/produtos`: O PDV local baixa alterações de catálogo e preços.
  - `POST /api/sync/vendas`: O PDV local sobe o lote de vendas e notas emitidas (inclusive notas geradas em contingência offline).

### 4. Camada White-Label (Marca Branca)
- Customização dinâmica de logotipo, paleta de cores e nome comercial por revendedor/software house.
- Configuração de subdomínios ou domínios personalizados (ex: `pdv.parceiroerp.com.br`).
