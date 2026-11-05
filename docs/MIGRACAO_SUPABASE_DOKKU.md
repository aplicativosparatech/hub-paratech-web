# Guia de Migração: Supabase Cloud & Vercel ➔ VPS Própria (Dokku + Supabase Open Source)

> **Gatilho de Continuação:** `MIGRAÇÃO SUPABASE`  
> Registrado em: 05/11/2026

Este documento contém o planejamento completo para migrar a infraestrutura do **Hub Paratech** e sistemas satélites (inclusive aplicações criadas no **Lovable**) de serviços de nuvem compartilhada (Supabase Cloud + Vercel) para uma **VPS Própria** (ex: ShardCloud 12GB RAM) com **Supabase Open Source** e **Dokku**.

---

## 1. Escopo da Migração

| Componente | Origem Atual | Destino VPS | Vantagens |
| :--- | :--- | :--- | :--- |
| **Banco de Dados** | Supabase Cloud PostgreSQL | PostgreSQL 15/16 (Docker) | Sem limites de conexões / custo fixo |
| **Autenticação** | Supabase Auth (GoTrue) | Supabase Auth Self-Hosted | Usuários e senhas preservados via schema `auth` |
| **Storage** | Supabase Storage (AWS S3) | Supabase Storage (MinIO/Local) | Sem limite de 50MB por arquivo para instaladores |
| **Frontend/APIs** | Vercel (Next.js Serverless) | Dokku (Node.js Persistente) | **Fim do timeout de 10s/15s** para SEFAZ e lote de XMLs |
| **SSL** | Automático Vercel | Dokku Let's Encrypt | Certificados HTTPS grátis e auto-renováveis |
| **Agendador** | Vercel Cron (`vercel.json`) | Cron nativo Linux / Dokku | Execução pontual sem depender de plano pago |
| **Aplicações Lovable** | Supabase Cloud | Supabase VPS Custom | Integração direta via URL customizada e Anon Key |
| **Serviços Extras** | - | Evolution API, Evo CRM, n8n, Redis | Consolidação de toda a operação numa única máquina |

---

## 2. Roteiro de Execução

1. **Provisionamento da VPS:**
   - SO: Ubuntu 24.04 LTS (12GB RAM recomendado).
   - Instalação do Dokku e Docker Engine.

2. **Supabase Self-Hosted:**
   - Deploy via `docker compose` oficial da Supabase.
   - Geração de `JWT_SECRET`, `ANON_KEY` e `SERVICE_ROLE_KEY`.
   - Mapeamento de subdomínio: `https://supabase.seudominio.com.br`.

3. **Migração do Banco de Dados:**
   - `pg_dump` completo do banco na nuvem.
   - `pg_restore` no banco local da VPS (schemas `public`, `auth`, `storage`).

4. **Migração do Storage:**
   - Sincronização dos arquivos dos buckets `xmls`, `certificados` e `instaladores`.

5. **Deploy da Aplicação no Dokku:**
   - Criação do app `dokku apps:create hub-web`.
   - Configuração das variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, etc.).
   - Ativação do SSL: `dokku letsencrypt:enable hub-web`.
   - Deploy contínuo: `git push dokku main`.

6. **Virada no Desktop Hub e Gateways:**
   - Atualização da URL em `desktop/UpdateManager.cs`.
   - Ajuste das rotas de Webhook (Pix, InfinitePay, Mercado Pago).

---

*Para continuar e iniciar a execução técnica a qualquer momento, basta acionar o comando:* **`MIGRAÇÃO SUPABASE`**.
