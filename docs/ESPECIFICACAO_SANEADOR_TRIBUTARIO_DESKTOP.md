# 🛡️ Especificação Técnica: Saneador Tributário Paratech Desktop

Este documento define a arquitetura, pilha de tecnologias e manual de operação do **Saneador Tributário Paratech Desktop**, o novo produto oficial da suíte Paratech Sistemas (ao lado de MEI Simples, TechSlim, Gastro, Pes.ai e Hub Paratech).

Localização do projeto: [`D:\Sistemas Paratech\Saneador Tributario`](file:///d:/Sistemas%20Paratech/Saneador%20Tributario)  
Executável compilado e autocontido: [`D:\Sistemas Paratech\Saneador Tributario\publish\SaneadorTributario.exe`](file:///d:/Sistemas%20Paratech/Saneador%20Tributario/publish/SaneadorTributario.exe)

---

## 🎯 Objetivo & Casos de Uso

Permite que o técnico ou o cliente final audite, saneie e corrija a tributação de catálogos inteiros de produtos (NCM, CEST, Monofásico PIS/COFINS, Substituição Tributária e enquadramento na Reforma Tributária IBS/CBS) **100% no computador local**, com desempenho máximo e sem necessidade de fazer upload de bases pesadas para a web.

A inteligência tributária e de IA é consultada via API leve diretamente no Hub Paratech.

---

## 💾 Fontes de Dados e Formatos Suportados

| Formato / Banco | Extensão / Modo | Mecanismo de Leitura | Modos de Saída |
|---|---|---|---|
| **Firebird** | `.fdb`, `.gdb` ou Porta 3050 | `FirebirdSql.Data.FirebirdClient` nativo | Update Direto no Banco ou Script SQL (`SET AUTODDL...`) |
| **PostgreSQL** | Servidor / Conexão Direta | `Npgsql` com transação ACID | Update Direto no Banco ou Script SQL (`BEGIN...`) |
| **SQLite** | `.db`, `.sqlite`, `.sqlite3` | `Microsoft.Data.Sqlite` | Update Direto no Banco ou Script SQL (`BEGIN TRANSACTION...`) |
| **Planilhas Excel** | `.xlsx`, `.xls` (legado e moderno) | `ExcelDataReader` + `ClosedXML` | Planilha Colorida Saneada com diagnósticos e Script SQL |
| **Arquivos de Dados** | `.csv`, `.json` | Parser nativo com auto-delimitador | Arquivo `.csv` / `.json` saneado e Script SQL |
| **Dumps SQL** | `.sql` (MySQL/Postgres/Firebird/SQLite) | Parser léxico de comandos `INSERT INTO` | Script SQL de atualização correspondente |

---

## 🔐 Controle de Licença & Segurança (Paratech Security Shield)

1. **Hardware Fingerprint (HWID)**:
   * UUID da Placa-Mãe (`Win32_ComputerSystemProduct.UUID`) + Serial do Disco C: (`Win32_DiskDrive.SerialNumber`) + MAC Address Físico + Salt SHA256.
   * Formato: `PARATECH-HWID-XXXX-XXXX-XXXX-XXXX`.
2. **Check-in Automático com o Hub**:
   * Consulta periódica via endpoint `/api/hub/sync` usando o token do cliente.
   * Se o cliente estiver ativo e adimplente, renova o ticket offline por **30 dias**.
3. **Bloqueio por Inadimplência / Licença Suspensa**:
   * Abre a tela cheia de bloqueio `BlockerForm` com QR Code Pix oficial do Banco Central gerado na hora com o valor da fatura pendente, botão de cópia e campo para liberação offline via código de desafio OTP de 15 minutos (`INST-XXXX-XXXX` -> `ACTV-XXXX-XXXX`).

---

## 🧭 Fluxo de Uso em 4 Passos

1. **Passo 1 (Conexão)**: Selecione o banco de dados ou arquivo e clique em *Conectar e Listar Tabelas*.
2. **Passo 2 (Mapeamento)**: O sistema identifica automaticamente as colunas (Código, Descrição, NCM, CEST, etc.). Revise ou ajuste se necessário e clique em *Carregar Produtos*.
3. **Passo 3 (Auditoria Inteligente)**: Clique em *Iniciar Saneamento Inteligente*. A aplicação consulta o Hub em lotes rápidos e categoriza cada item em *Conforme*, *Inconsistente*, *Monofásico* ou *Reforma Tributária*.
4. **Passo 4 (Gravação & Exportação)**:
   * Grava diretamente no banco Firebird/Postgres/SQLite com 1 clique;
   * Salva o arquivo `.sql` de atualização pronto para executar;
   * Exporta a planilha Excel `.xlsx` com o relatório completo para a contabilidade do cliente.
