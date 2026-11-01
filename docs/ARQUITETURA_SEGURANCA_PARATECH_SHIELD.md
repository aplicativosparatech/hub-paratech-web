# 🛡️ Especificação da Arquitetura Paratech Security Shield

Este documento define as diretrizes, fórmulas matemáticas e arquitetura de segurança, anti-pirataria e anti-engenharia reversa para o ecossistema de sistemas Paratech (**MEI Simples**, **TechSlim**, **Gastro**, **Pes.ai**, **Hub Paratech Desktop** e outros).

---

## 📌 Gatilho de Implantação
A implantação em qualquer sistema específico será disparada pelo comando:
> **`IMPLANTAR O SISTEMA DE PROTEÇÃO NO SISTEMA [NOME DO SISTEMA]`**

---

## 1. Identificação Única da Máquina (Hardware Fingerprint)

### Componentes de Hardware Utilizados:
* **UUID da Placa-Mãe / BIOS**: Consulta WMI/CIM `Win32_ComputerSystemProduct.UUID`.
* **Serial Físico do Disco C: (SSD/HD)**: Consulta WMI/CIM `Win32_DiskDrive.SerialNumber`.
* **MAC Address Principal**: Adaptador de rede físico ativo (`Win32_NetworkAdapterConfiguration` ou `Get-NetAdapter`).

### Algoritmo do HWID:
```
HWID_STRING = UUID + "|" + SERIAL_SSD + "|" + MAC + "|" + "PARATECH_SHIELD_SALT_2026"
HWID = SHA256(HWID_STRING).toUpperCase()
```
*Formato de Exibição*: `PARATECH-HWID-XXXX-XXXX-XXXX-XXXX`

---

## 2. Licença Dinâmica no Instalador (Challenge / Response com OTP)

### Código de Desafio (Gerado pelo Instalador / Máquina do Cliente):
* Janela de tempo: Intervalos de 15 minutos (900 segundos).
```
TIME_BLOCK = FLOOR(CURRENT_UNIX_TIMESTAMP / 900)
CHALLENGE_HASH = HMAC_SHA256(HWID + "|" + TIME_BLOCK, "PARATECH_CHALLENGE_SECRET")
CHALLENGE_CODE = "INST-" + CHALLENGE_HASH.SUBSTRING(0, 4) + "-" + CHALLENGE_HASH.SUBSTRING(4, 8)
```

### Chave de Ativação (Gerada pelo Administrador no Portal Paratech):
* Você insere o `CHALLENGE_CODE` no Portal Paratech ou associa ao CNPJ do cliente:
```
ACTIVATION_HASH = HMAC_SHA256(CHALLENGE_CODE + "|" + CNPJ, "PARATECH_ACTIVATION_MASTER_KEY")
ACTIVATION_KEY = "ACTV-" + ACTIVATION_HASH.SUBSTRING(0, 4) + "-" + ACTIVATION_HASH.SUBSTRING(4, 8)
```
* Se passarem mais de 15 minutos, a chave deixa de ser válida.

---

## 3. Check-in Silencioso e Chave Rotativa (Rolling Token & Dead-man's Switch)

1. **Ticket de Operação Local**:
   - O sistema grava um ticket criptografado localmente assinado com validade de **30 dias**.
   - Permite que o caixa/PDV funcione 100% offline se faltar internet no comércio.
2. **Auditoria Silenciosa em Background**:
   - A cada 3 a 5 dias, o sistema faz uma chamada invisível ao Portal Paratech (`/api/hub/security/heartbeat`).
   - Se o cliente estiver ativo e adimplente, o Portal renova o ticket por mais 30 dias.
   - O sistema envia telemetria: detecção de alteração manual no relógio do Windows, hash dos executáveis.
3. **Bloqueio por Isolamento Prolongado (Dead-man's Switch)**:
   - Se o executável for bloqueado no Firewall ou o PC for desligado da internet por mais de 30 dias corridos, o ticket expira por tempo e bloqueia a abertura do sistema exigindo conexão com a Paratech.

---

## 4. Blindagem Contra Engenharia Reversa e IAs

### Flutter Desktop (MEI Simples, TechSlim, Gastro, Pes.ai):
* Compilação AOT (código de máquina nativo x86-64 puro).
* Flag de ofuscação extrema:
  ```powershell
  flutter build windows --release --obfuscate --split-debug-info=./build/simbolos_protegidos
  ```
* Remove identificadores de classes, métodos e variáveis, deixando impossível a leitura por IAs ou descompiladores.

### C# .NET (Hub Executável):
* Publicação em Native AOT (`<PublishAot>true</PublishAot>`) para gerar binário nativo x64 eliminando a VM e o bytecode IL.
* Ofuscação de fluxo de controle (*Control Flow Flattening*) com Obfuscar.

### Criptografia do Banco SQLite Local:
* Banco criptografado com AES-256 (SQLCipher).
* A chave do banco é derivada do HWID da máquina. Se copiado para outro computador, o banco não abre.

### Proteção de Rotas de API (Request Signing):
* Headers: `X-Paratech-HWID`, `X-Paratech-Timestamp`, `X-Paratech-Signature`.
* Assinatura: `HMAC_SHA256(Timestamp + Metodo + Rota + Body + HWID, ClientSecret)`.
* Janela de tolerância de 120 segundos contra ataques de replay.
