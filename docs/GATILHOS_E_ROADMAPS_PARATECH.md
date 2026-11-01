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

---

### Como Usar
Basta digitar exatamente a frase do gatilho (substituindo `[NOME DO SISTEMA]` pelo sistema desejado, como `MEI_SIMPLES`, `TechSlim`, `Gastro`, etc.) em qualquer momento para iniciar imediatamente a execução do plano técnico.
