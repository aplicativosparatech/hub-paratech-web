# 🚀 Paratech Universal Auto-Updater Kit

Kit universal de atualização automática para todos os sistemas da **Paratech Sistemas** (MEI Simples, Hub Desktop, TechSlim, TechPro, Gastro, Pes.Ai, Bar-pdv+, FichasTech, etc.).

---

## 📦 O Que Contém Este Pacote

```
paratech-updater-kit/
│
├── bin/
│   └── ParatechUpdater.exe       <-- Utilitário executável universal para Windows
│
├── sdk-flutter/
│   └── paratech_updater_service.dart <-- Módulo para sistemas Flutter (Gastro, Pes.Ai, TechSlim)
│
├── sdk-delphi/
│   └── ParatechUpdater.pas       <-- Unit pronta para Delphi (7 ao 12) e Lazarus
│
├── sdk-csharp/
│   └── ParatechUpdater.cs        <-- Classe C# .NET (WinForms, WPF, Console)
│
└── README.md                     <-- Este manual de integração
```

---

## 1. 🌐 A API Universal na Nuvem (Funciona em Qualquer Linguagem)

O **Portal Hub Paratech** disponibiliza o endpoint oficial para qualquer aplicação checar versões:

* **Endpoint**: `https://hub-paratech-web.vercel.app/api/hub/versoes/check`
* **Método**: `GET` ou `POST`
* **Parâmetros**:
  * `sistema_id` (Obrigatório): identificador cadastrado no Hub (ex: `gastro`, `pes_ai`, `tech_slim`, `mei_simples`)
  * `versao_atual` (Obrigatório): versão atual instalada no cliente (ex: `1.0.0`)
  * `build_number` (Opcional): número da compilação (ex: `100`)
  * `cnpj` (Opcional): CNPJ do cliente para aplicar políticas personalizadas
  * `nome_computador` (Opcional): nome da máquina para telemetria no painel

### Exemplo de Resposta (JSON):
```json
{
  "sucesso": true,
  "sistema_id": "gastro",
  "tem_atualizacao": true,
  "versao_atual": "1.0.0",
  "versao_mais_recente": "1.1.0",
  "build_number_mais_recente": 110,
  "obrigatoria": false,
  "politica_efetiva": "informativa",
  "changelog": "• Novo módulo de Delivery Integrado\n• Correção na impressão de comandas",
  "url_download": "https://.../Instalador_Gastro_v1.1.0.exe",
  "tamanho_bytes": 45000000
}
```

---

## 2. ⚡ Como Usar o Executável Universal `ParatechUpdater.exe` (Qualquer Linguagem)

Basta colocar o arquivo `ParatechUpdater.exe` na mesma pasta do seu sistema (ou na pasta de instalação) e chamá-lo com os parâmetros:

### Modos de Execução:
1. **Modo Informativo / Visual (com diálogo para o cliente)**:
   ```cmd
   ParatechUpdater.exe --app=gastro --version=1.0.0 --mode=dialog
   ```
   *Se houver nova versão*: Abre a janela visual com as novidades (changelog) e botões "Atualizar Agora" e "Lembrar Mais Tarde".

2. **Modo Automático / Silencioso (em background)**:
   ```cmd
   ParatechUpdater.exe --app=gastro --version=1.0.0 --mode=auto
   ```
   *Se houver nova versão*: Baixa em segundo plano e instala silenciosamente sem intervenção manual.

---

## 3. 📱 Integração em Sistemas Flutter (Gastro, Pes.Ai, TechSlim)

1. Copie o arquivo `sdk-flutter/paratech_updater_service.dart` para `lib/services/` do projeto.
2. Na inicialização do app (em `main.dart` ou `initState` da tela principal):
   ```dart
   import 'services/paratech_updater_service.dart';

   ParatechUpdaterService().initialize(
     database: database,
     sistemaId: 'gastro', // ou 'pes_ai', 'tech_slim'
     versaoAtual: '1.0.0',
     buildNumberAtual: 1,
   );
   ```

---

## 4. 🏛️ Integração em Delphi / Lazarus

1. Adicione a unit `sdk-delphi/ParatechUpdater.pas` no seu projeto.
2. Na inicialização do sistema ou no menu "Ajuda > Verificar Atualizações":
   ```pascal
   uses ParatechUpdater;

   // Modo Informativo (Abre diálogo com changelog se houver nova versão)
   TParatechUpdater.ExecutarAtualizador('gastro', '1.0.0', tmInformativo);

   // Modo Automático (Silencioso em background)
   TParatechUpdater.ExecutarAtualizador('gastro', '1.0.0', tmAutomatico);
   ```

---

## 5. 💻 Integração em C# / .NET

1. Adicione o arquivo `sdk-csharp/ParatechUpdater.cs` ao seu projeto.
2. Chame em qualquer ponto:
   ```csharp
   using Paratech.Updater;

   ParatechUpdater.Executar("gastro", "1.0.0", UpdateMode.Informativo);
   ```

---

## 6. 🌐 Como Publicar uma Nova Versão para os Clientes

1. Acesse o **Portal Hub-Paratech** (`/dashboard/versoes`).
2. Clique no botão verde **"+ Publicar Nova Versão"**.
3. Selecione o sistema (`Gastro`, `Pes.Ai`, `TechSlim`, `MEI Simples` ou digite um novo).
4. Digite a versão (ex: `1.1.0`), o changelog e faça upload do arquivo `.exe` (ou cole a URL direta).
5. Pronto! Todas as máquinas dos clientes receberão a atualização automaticamente na próxima inicialização.
