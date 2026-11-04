# 🧭 Painel Central de Gatilhos & Roadmaps Paratech

Este documento centraliza todos os **gatilhos oficiais** registrados para o desenvolvimento e evolução dos sistemas Paratech (**MEI Simples**, **TechSlim**, **Gastro**, **Pes.ai**, **Hub Paratech** e futuras aplicações).

---

## 📌 Gatilhos Salvos e Ativos

| # | Comando / Gatilho | Objetivo | Documentação / Skill |
|---|---|---|---|
| **1** | `IMPLANTAR O SISTEMA DE PROTEÇÃO NO SISTEMA [NOME DO SISTEMA]` | Blindagem anti-pirataria, amarração de hardware (HWID: Placa-Mãe, SSD, MAC), licença OTP dinâmica no instalador, check-in silencioso e anti-engenharia reversa por IAs. | [`docs/ARQUITETURA_SEGURANCA_PARATECH_SHIELD.md`](file:///d:/Sistemas%20Paratech/HUB_PARATECH/docs/ARQUITETURA_SEGURANCA_PARATECH_SHIELD.md)<br>Skill: `paratech-security-shield` |
| **2** | `VAMOS INICIAR A VERSAO WEB DO SISTEMA [NOME DO SISTEMA]` | Criação da versão Cloud Web SaaS multi-tenant, painel gerencial em nuvem com isolamento RLS, retaguarda unificada e suporte a distribuição White-Label para outras software houses. | [`docs/ROADMAP_VERSOES_WEB_SAAS.md`](file:///d:/Sistemas%20Paratech/HUB_PARATECH/docs/ROADMAP_VERSOES_WEB_SAAS.md) |
| **3** | `IMPLANTAR O ASSISTENTE DE VOZ NO SISTEMA [NOME DO SISTEMA]`<br>*(ou `IMPLANTAR O ASSISTENTE DE VOZ`)* | Implementação de assistente por comando de voz (STT/TTS mãos-livres no balcão), motor de intenções de caixa offline, RAG com legislação do MEI/tributação e suporte operacional autônomo. | [`docs/ESPECIFICACAO_ASSISTENTE_VOZ_IA_RAG.md`](file:///d:/Sistemas%20Paratech/HUB_PARATECH/docs/ESPECIFICACAO_ASSISTENTE_VOZ_IA_RAG.md) |
| **4** | `IMPLEMENTAR DOTS OPENAI NO SISTEMA [NOME DO SISTEMA]`<br>*(ou `IMPLEMENTAR AGENTE IA NO SISTEMA [NOME]`)* | Implementação de Agente de IA com OpenAI Assistants e Google Gemini 1.5 Flash multi-tenant via Hub Paratech, com Function Calling, tradutor de erros SEFAZ, consultor MEI e chat interativo. | [`docs/ESPECIFICACAO_AGENTE_DOTS_OPENAI_GEMINI.md`](file:///d:/Sistemas%20Paratech/HUB_PARATECH/docs/ESPECIFICACAO_AGENTE_DOTS_OPENAI_GEMINI.md) |
| **5** | `DESENVOLVER O APK [NOME DO SISTEMA]`<br>*(ou `DESENVOLVER O APK`)* | Criação do App Android companheiro (PDV de bolso para leigos), impressão remota no Windows via Hub, impressão Bluetooth direta (ESC/POS), envio de comprovante via WhatsApp, controle por voz hands-free e termômetro do limite MEI. | [`docs/PLANO_DESENVOLVIMENTO_APK_ANDROID.md`](file:///d:/Sistemas%20Paratech/HUB_PARATECH/docs/PLANO_DESENVOLVIMENTO_APK_ANDROID.md) |
| **6** | `SANEADOR TRIBUTARIO PARATECH`<br>*(ou `SANEADOR TRIBUTARIO DESKTOP`)* | Produto Oficial Desktop para auditoria, saneamento e Reforma Tributária (IBS/CBS) em Firebird, PostgreSQL, SQLite, Excel (.xlsx/.xls), CSV, JSON e Dumps SQL, com HWID e bloqueio integrado ao Hub. | [`docs/ESPECIFICACAO_SANEADOR_TRIBUTARIO_DESKTOP.md`](file:///d:/Sistemas%20Paratech/HUB_PARATECH/docs/ESPECIFICACAO_SANEADOR_TRIBUTARIO_DESKTOP.md)<br>Projeto: `D:\Sistemas Paratech\Saneador Tributario` |

---

### Como Usar
Basta digitar exatamente a frase do gatilho (substituindo `[NOME DO SISTEMA]` pelo sistema desejado, como `MEI_SIMPLES`, `TechSlim`, `Gastro`, etc.) em qualquer momento para iniciar imediatamente a execução do plano técnico.
