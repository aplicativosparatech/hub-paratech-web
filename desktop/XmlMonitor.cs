using System;
using System.IO;
using System.Net.Http.Headers;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Text.Json;
using System.Linq;

namespace HubParatechDesktop
{
    public class FormaPagamentoLocal
    {
        public string tipo { get; set; } = "99";
        public string nome { get; set; } = "Outros";
        public decimal valor { get; set; }
    }

    public class DadosXmlExtraidos
    {
        public string? Chave { get; set; }
        public string? Modelo { get; set; }
        public string? Numero { get; set; }
        public string? Serie { get; set; }
        public decimal ValorTotal { get; set; }
        public string? DataEmissao { get; set; }
        public string? CStat { get; set; }
        public string? MotivoSefaz { get; set; }
        public bool IsAutorizada { get; set; }
        public List<FormaPagamentoLocal> FormasPagamento { get; set; } = new List<FormaPagamentoLocal>();
        public string FormasPagamentoJson { get; set; } = "[]";
    }

    public class ValidacaoXmlResultado
    {
        public bool Valido { get; set; } = false;
        public string? MotivoDescarte { get; set; }
        public DadosXmlExtraidos? Dados { get; set; }
    }

    public class XmlSyncEventArgs : EventArgs
    {
        public bool IsSyncing { get; set; }
        public string StatusMessage { get; set; } = "";
        public string? FileName { get; set; }
        public DadosXmlExtraidos? Dados { get; set; }
        public bool IsRealTime { get; set; }
        public bool Sucesso { get; set; }
        public string? StatusDescricao { get; set; }
        public string? TipoPasta { get; set; }
        public string? FilePath { get; set; }
    }

    public class XmlMonitor
    {
        // Eventos globais para comunicação com a UI do Tray e Monitor em Tempo Real
        public static event EventHandler<XmlSyncEventArgs>? OnSyncStatusChanged;
        public static event EventHandler<XmlSyncEventArgs>? OnXmlProcessed;

        private FileSystemWatcher? watcher;
        private string rootPath;
        private string hubToken;
        private string tipoPasta; // "vendas" ou "compras"
        private HttpClient http;
        private bool isRunning = true;
        private string modoProcessamento = "hub"; // "hub" (pré-processa localmente) ou "portal" (envia bruto)

        private static readonly Dictionary<string, string> NomesFormasPagamento = new Dictionary<string, string>
        {
            { "01", "Dinheiro" },
            { "02", "Cheque" },
            { "03", "Cartão de Crédito" },
            { "04", "Cartão de Débito" },
            { "05", "Crédito Loja" },
            { "10", "Vale Alimentação" },
            { "11", "Vale Refeição" },
            { "12", "Vale Presente" },
            { "13", "Vale Combustível" },
            { "14", "Duplicata Mercantil" },
            { "15", "Boleto Bancário" },
            { "16", "Depósito Bancário" },
            { "17", "PIX" },
            { "18", "Transferência Bancária" },
            { "19", "Cashback / Fidelidade" },
            { "20", "PIX" },
            { "90", "Sem Pagamento" },
            { "99", "Outros" }
        };

        private static readonly string[] NomeMeses = new string[]
        {
            "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
            "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
        };

        public XmlMonitor(string path, string tipoPasta, string token, HttpClient httpClient, string modoProcessamento = "hub")
        {
            this.rootPath = path;
            this.tipoPasta = tipoPasta;
            this.hubToken = token;
            this.http = httpClient;
            this.modoProcessamento = string.Equals(modoProcessamento, "portal", StringComparison.OrdinalIgnoreCase) ? "portal" : "hub";

            if (!Directory.Exists(path))
            {
                try { Directory.CreateDirectory(path); } catch { }
            }

            try
            {
                // FileSystemWatcher monitorando recursivamente a pasta raiz e todas as subpastas
                watcher = new FileSystemWatcher(path, "*.xml");
                watcher.IncludeSubdirectories = true; // Captura subpastas criadas pelo ERP (ex: 2026/10, Outubro_2026)
                watcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size;
                
                // Eventos de tempo real: assim que o arquivo é gerado ou gravado pelo PDV/ERP
                watcher.Created += (s, e) => _ = ProcessFileAsync(e.FullPath, isRealTime: true);
                watcher.Changed += (s, e) => _ = ProcessFileAsync(e.FullPath, isRealTime: true);
                watcher.EnableRaisingEvents = true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao iniciar watcher em {path}: {ex.Message}");
            }

            // Inicia varredura e monitoramento periódico de arquivos existentes em segundo plano
            Task.Run(StartPeriodicScanAsync);
        }

        public void TriggerScan()
        {
            Task.Run(ScanExistingFilesAsync);
        }

        public void SetModoProcessamento(string modo)
        {
            this.modoProcessamento = string.Equals(modo, "portal", StringComparison.OrdinalIgnoreCase) ? "portal" : "hub";
        }

        private async Task StartPeriodicScanAsync()
        {
            while (isRunning)
            {
                await ScanExistingFilesAsync();
                await Task.Delay(120000); // Re-varre a cada 2 minutos para resiliência de rede e arquivos copiados
            }
        }

        private async Task ScanExistingFilesAsync()
        {
            if (!Directory.Exists(rootPath)) return;

            try
            {
                // Busca todos os .xml na pasta principal e em todas as subpastas recursivamente
                var dirInfo = new DirectoryInfo(rootPath);
                var files = dirInfo.GetFiles("*.xml", SearchOption.AllDirectories)
                                   .OrderByDescending(f => f.LastWriteTime) // Prioriza os mais recentes (de hoje e deste mês)
                                   .ToList();

                int totalArquivos = files.Count;
                int jaProcessados = 0;
                int enviadosNestaRodada = 0;
                int falhas = 0;

                Debug.WriteLine($"[Auditoria Hub] Iniciando conferência em {rootPath}. Total de arquivos XML encontrados: {totalArquivos}");

                if (totalArquivos > 0)
                {
                    OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                    {
                        IsSyncing = true,
                        StatusMessage = $"Varrendo {totalArquivos} notas fiscais...",
                        TipoPasta = tipoPasta
                    });
                }

                foreach (var fileInfo in files)
                {
                    if (!isRunning) break;

                    string file = fileInfo.FullName;
                    string fileName = fileInfo.Name;
                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(fileName);

                    // REGRA: Arquivos menores que 35 chars sem chave são tipicamente rascunhos temporários do ERP
                    if (fileNameWithoutExt.Length <= 35 && !Regex.IsMatch(fileName, @"\d{44}"))
                    {
                        continue;
                    }

                    string fileIdentifier = $"{fileName}_{fileInfo.Length}";

                    if (XmlUploadCache.IsUploaded(fileIdentifier))
                    {
                        jaProcessados++;
                        continue;
                    }

                    bool sucesso = await ProcessFileAsync(file, isRealTime: false);
                    if (sucesso) enviadosNestaRodada++;
                    else falhas++;

                    await Task.Delay(40); // Pausa suave para não sobrecarregar I/O ou rede
                }

                OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                {
                    IsSyncing = false,
                    StatusMessage = "Monitorando",
                    TipoPasta = tipoPasta
                });

                Debug.WriteLine($"[Auditoria Hub] Resumo em {rootPath}: Total={totalArquivos}, No Cache={jaProcessados}, Enviados={enviadosNestaRodada}, Falhas={falhas}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao varrer arquivos existentes em {rootPath}: {ex.Message}");
                OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                {
                    IsSyncing = false,
                    StatusMessage = "Monitorando",
                    TipoPasta = tipoPasta
                });
            }
        }

        public static ValidacaoXmlResultado ValidarEExtrairXml(byte[] fileBytes, string fileName)
        {
            var res = new ValidacaoXmlResultado();
            if (fileBytes == null || fileBytes.Length < 180)
            {
                res.MotivoDescarte = "Arquivo vazio ou muito curto (< 180 bytes).";
                return res;
            }

            try
            {
                string xml = System.Text.Encoding.UTF8.GetString(fileBytes);

                // 1. Descartar eventos fiscais (Cancelamento, Carta de Correção) e inutilizações que não sejam a nota fiscal
                if (xml.Contains("<procEventoNFe") || xml.Contains("<retEnvEvento") || xml.Contains("<detEvento"))
                {
                    res.MotivoDescarte = "Arquivo é um Evento Fiscal (Cancelamento ou CC-e), não uma emissão de NF-e/NFC-e.";
                    return res;
                }
                if (xml.Contains("<procInutNFe") || xml.Contains("<inutNFe") || xml.Contains("<retInutNFe"))
                {
                    res.MotivoDescarte = "Arquivo é uma Inutilização de Numeração, não uma emissão.";
                    return res;
                }

                // 2. Deve conter a estrutura de nota fiscal eletrônica
                bool hasInfNFe = xml.Contains("<infNFe") || xml.Contains("<nfeProc") || xml.Contains("<NFe");
                if (!hasInfNFe)
                {
                    res.MotivoDescarte = "Arquivo XML não contém estrutura de NF-e ou NFC-e (<infNFe>).";
                    return res;
                }

                var dados = new DadosXmlExtraidos();

                // 3. Chave de Acesso (44 caracteres - suporta CNPJ alfanumérico IN RFB 2.229/2024)
                var matchChave = Regex.Match(xml, @"<(?:chNFe|chCTe|chMDFe)[^>]*>([A-Za-z0-9]{44})<");
                if (matchChave.Success)
                {
                    dados.Chave = matchChave.Groups[1].Value.ToUpper();
                }
                else
                {
                    var matchId = Regex.Match(xml, @"Id\s*=\s*[""'](?:NFe|NFCe|CTe|MDFe)?([A-Za-z0-9]{44})[""']", RegexOptions.IgnoreCase);
                    if (matchId.Success)
                    {
                        dados.Chave = matchId.Groups[1].Value.ToUpper();
                    }
                    else
                    {
                        var matchFile = Regex.Match(fileName, @"([A-Za-z0-9]{44})");
                        if (matchFile.Success)
                        {
                            dados.Chave = matchFile.Groups[1].Value.ToUpper();
                        }
                    }
                }

                if (string.IsNullOrEmpty(dados.Chave) || dados.Chave.Length != 44)
                {
                    res.MotivoDescarte = "Chave de acesso de 44 caracteres não encontrada no XML.";
                    return res;
                }

                // 4. Modelo (55 = NF-e, 65 = NFC-e)
                dados.Modelo = dados.Chave.Substring(20, 2);
                if (dados.Modelo != "55" && dados.Modelo != "65")
                {
                    var matchMod = Regex.Match(xml, @"<mod>(\d{2})</mod>");
                    if (matchMod.Success) dados.Modelo = matchMod.Groups[1].Value;
                }

                // 5. Número e Série
                var matchNum = Regex.Match(xml, @"<nNF>(\d+)</nNF>");
                if (matchNum.Success) dados.Numero = matchNum.Groups[1].Value;
                else dados.Numero = Convert.ToInt64(dados.Chave.Substring(25, 9)).ToString();

                var matchSerie = Regex.Match(xml, @"<serie>(\d+)</serie>");
                if (matchSerie.Success) dados.Serie = matchSerie.Groups[1].Value;
                else dados.Serie = Convert.ToInt32(dados.Chave.Substring(22, 3)).ToString();

                // 6. Data de Emissão REAL DO XML (<dhEmi> ou <dEmi>)
                // Esta é a verdade fiscal soberana registrada no momento da assinatura/autorização
                var matchEmi = Regex.Match(xml, @"<(?:dhEmi|dEmi)[^>]*>([^<]+)<");
                if (matchEmi.Success)
                {
                    dados.DataEmissao = matchEmi.Groups[1].Value;
                }
                else
                {
                    // Fallback para os dígitos da Chave (AAMM)
                    string aamm = dados.Chave.Substring(2, 4);
                    dados.DataEmissao = $"20{aamm.Substring(0, 2)}-{aamm.Substring(2, 2)}-01T00:00:00-03:00";
                }

                // 7. Valor Total
                var matchValor = Regex.Match(xml, @"<vNF>([\d\.]+)</vNF>");
                if (matchValor.Success && decimal.TryParse(matchValor.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out decimal v))
                {
                    dados.ValorTotal = v;
                }

                // 8. Status SEFAZ (<cStat> e <protNFe>)
                var matchStat = Regex.Match(xml, @"<cStat>(\d+)</cStat>");
                if (matchStat.Success) dados.CStat = matchStat.Groups[1].Value;

                var matchMotivo = Regex.Match(xml, @"<xMotivo>([^<]+)</xMotivo>");
                if (matchMotivo.Success) dados.MotivoSefaz = matchMotivo.Groups[1].Value;

                dados.IsAutorizada = (dados.CStat == "100" || xml.Contains("Autorizado o uso")) && xml.Contains("<Signature");

                // 9. Formas de Pagamento (<detPag> ou <pag>)
                var detPagMatches = Regex.Matches(xml, @"<detPag[^>]*>([\s\S]*?)</detPag>");
                if (detPagMatches.Count > 0)
                {
                    foreach (Match m in detPagMatches)
                    {
                        string inner = m.Groups[1].Value;
                        string tPag = "99";
                        decimal vPag = 0;

                        var mTPag = Regex.Match(inner, @"<tPag>(\d+)</tPag>");
                        if (mTPag.Success) tPag = mTPag.Groups[1].Value.PadLeft(2, '0');

                        var mVPag = Regex.Match(inner, @"<vPag>([\d\.]+)</vPag>");
                        if (mVPag.Success)
                        {
                            decimal.TryParse(mVPag.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out vPag);
                        }

                        string nome = NomesFormasPagamento.ContainsKey(tPag) ? NomesFormasPagamento[tPag] : "Outros";
                        dados.FormasPagamento.Add(new FormaPagamentoLocal
                        {
                            tipo = tPag,
                            nome = nome,
                            valor = vPag
                        });
                    }
                }
                else
                {
                    var mTPag = Regex.Match(xml, @"<tPag>(\d+)</tPag>");
                    var mVPag = Regex.Match(xml, @"<vPag>([\d\.]+)</vPag>");
                    if (mTPag.Success || mVPag.Success)
                    {
                        string tPag = mTPag.Success ? mTPag.Groups[1].Value.PadLeft(2, '0') : "99";
                        decimal vPag = dados.ValorTotal;
                        if (mVPag.Success)
                        {
                            decimal.TryParse(mVPag.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out vPag);
                        }
                        string nome = NomesFormasPagamento.ContainsKey(tPag) ? NomesFormasPagamento[tPag] : "Outros";
                        dados.FormasPagamento.Add(new FormaPagamentoLocal { tipo = tPag, nome = nome, valor = vPag });
                    }
                    else
                    {
                        dados.FormasPagamento.Add(new FormaPagamentoLocal { tipo = "99", nome = "Outros", valor = dados.ValorTotal });
                    }
                }

                dados.FormasPagamentoJson = JsonSerializer.Serialize(dados.FormasPagamento);

                res.Valido = true;
                res.Dados = dados;
            }
            catch (Exception ex)
            {
                res.MotivoDescarte = $"Erro ao interpretar conteúdo XML: {ex.Message}";
            }

            return res;
        }

        private async Task<bool> ProcessFileAsync(string filePath, bool isRealTime = false)
        {
            try
            {
                if (!File.Exists(filePath)) return false;

                string fileName = Path.GetFileName(filePath);
                string fileNameWithoutExt = Path.GetFileNameWithoutExtension(filePath);

                // Identificador preliminar
                FileInfo fi = new FileInfo(filePath);
                string fileIdentifier = $"{fileName}_{fi.Length}";

                // Se já foi enviado anteriormente, não envia de novo
                if (XmlUploadCache.IsUploaded(fileIdentifier))
                {
                    return true;
                }

                // Tenta ler o arquivo com segurança (esperando o ERP terminar a gravação no disco)
                byte[]? fileBytes = await ReadFileWithRetryAsync(filePath, maxRetries: 4, delayMs: 1500);
                if (fileBytes == null || fileBytes.Length == 0) return false;

                // Análise e Validação Fiscal Completa do Conteúdo
                var validacao = ValidarEExtrairXml(fileBytes, fileName);
                if (!validacao.Valido || validacao.Dados == null)
                {
                    Debug.WriteLine($"[Hub Monitor] Arquivo ignorado ({fileName}): {validacao.MotivoDescarte}");
                    return false;
                }

                var dadosLocais = validacao.Dados;

                // Se a chave já estiver no cache, marca o identificador e pula
                if (XmlUploadCache.IsUploaded(fileIdentifier, dadosLocais.Chave))
                {
                    XmlUploadCache.MarkAsUploaded(fileIdentifier, dadosLocais.Chave);
                    return true;
                }

                // Dispara indicador visual de que está sincronizando/enviando
                string modeloNome = dadosLocais.Modelo == "65" ? "NFC-e" : (dadosLocais.Modelo == "55" ? "NF-e" : "Nota");
                OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                {
                    IsSyncing = true,
                    StatusMessage = $"Enviando {modeloNome} nº {dadosLocais.Numero}...",
                    FileName = fileName,
                    Dados = dadosLocais,
                    IsRealTime = isRealTime,
                    TipoPasta = tipoPasta,
                    FilePath = filePath
                });

                using (var content = new MultipartFormDataContent())
                {
                    content.Add(new StringContent(hubToken), "hub_token");
                    content.Add(new StringContent(tipoPasta), "tipo_pasta");

                    // Anexa metadados já analisados pelo Hub
                    if (modoProcessamento == "hub")
                    {
                        if (!string.IsNullOrEmpty(dadosLocais.FormasPagamentoJson))
                            content.Add(new StringContent(dadosLocais.FormasPagamentoJson), "formas_pagamento_json");

                        if (!string.IsNullOrEmpty(dadosLocais.Modelo))
                            content.Add(new StringContent(dadosLocais.Modelo), "modelo");

                        if (!string.IsNullOrEmpty(dadosLocais.Chave))
                            content.Add(new StringContent(dadosLocais.Chave), "chave");

                        if (!string.IsNullOrEmpty(dadosLocais.Numero))
                            content.Add(new StringContent(dadosLocais.Numero), "numero");

                        if (!string.IsNullOrEmpty(dadosLocais.Serie))
                            content.Add(new StringContent(dadosLocais.Serie), "serie");
                    }

                    var fileContent = new ByteArrayContent(fileBytes);
                    fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");
                    content.Add(fileContent, "xml_file", fileName);

                    var response = await http.PostAsync("https://hub-paratech-web.vercel.app/api/hub/upload-xml", content);

                    if (response.IsSuccessStatusCode)
                    {
                        // 1. Marca no cache local que foi enviado
                        XmlUploadCache.MarkAsUploaded(fileIdentifier, dadosLocais.Chave);

                        // 2. Cria cópia de conferência na pasta Contabilidade_Paratech/{MM-MES-AAAA}
                        SaveBackupCopy(filePath, fileBytes, dadosLocais);

                        // 3. Adiciona ao log em tempo real
                        LiveMonitorForm.AddLog(new XmlLogItem
                        {
                            Timestamp = DateTime.Now,
                            TipoPasta = tipoPasta == "compras" ? "Entrada" : "Saída",
                            Modelo = dadosLocais.Modelo ?? "65",
                            Numero = dadosLocais.Numero ?? "",
                            Serie = dadosLocais.Serie ?? "1",
                            DataEmissao = dadosLocais.DataEmissao ?? "",
                            ValorTotal = dadosLocais.ValorTotal,
                            Chave = dadosLocais.Chave ?? "",
                            Status = "Sucesso",
                            Arquivo = fileName,
                            IsRealTime = isRealTime
                        });

                        // 4. Notifica ouvintes da UI
                        OnXmlProcessed?.Invoke(this, new XmlSyncEventArgs
                        {
                            IsSyncing = false,
                            StatusMessage = "Sincronizado",
                            FileName = fileName,
                            Dados = dadosLocais,
                            IsRealTime = isRealTime,
                            Sucesso = true,
                            StatusDescricao = "Enviado com sucesso",
                            TipoPasta = tipoPasta,
                            FilePath = filePath
                        });

                        OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                        {
                            IsSyncing = false,
                            StatusMessage = "Monitorando",
                            TipoPasta = tipoPasta
                        });

                        Debug.WriteLine($"[Hub Local] XML enviado com sucesso: {fileName} (Chave: {dadosLocais.Chave})");
                        return true;
                    }
                    else
                    {
                        Debug.WriteLine($"[Hub Local] Falha ao enviar XML {fileName}: Status {response.StatusCode}");

                        LiveMonitorForm.AddLog(new XmlLogItem
                        {
                            Timestamp = DateTime.Now,
                            TipoPasta = tipoPasta == "compras" ? "Entrada" : "Saída",
                            Modelo = dadosLocais.Modelo ?? "65",
                            Numero = dadosLocais.Numero ?? "",
                            Serie = dadosLocais.Serie ?? "1",
                            DataEmissao = dadosLocais.DataEmissao ?? "",
                            ValorTotal = dadosLocais.ValorTotal,
                            Chave = dadosLocais.Chave ?? "",
                            Status = $"Falha ({response.StatusCode})",
                            Arquivo = fileName,
                            IsRealTime = isRealTime
                        });

                        OnXmlProcessed?.Invoke(this, new XmlSyncEventArgs
                        {
                            IsSyncing = false,
                            StatusMessage = "Erro no envio",
                            FileName = fileName,
                            Dados = dadosLocais,
                            IsRealTime = isRealTime,
                            Sucesso = false,
                            StatusDescricao = $"Erro HTTP {(int)response.StatusCode}",
                            TipoPasta = tipoPasta,
                            FilePath = filePath
                        });

                        OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                        {
                            IsSyncing = false,
                            StatusMessage = "Monitorando",
                            TipoPasta = tipoPasta
                        });

                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao processar XML {filePath}: {ex.Message}");
                OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                {
                    IsSyncing = false,
                    StatusMessage = "Monitorando",
                    TipoPasta = tipoPasta
                });
                return false;
            }
        }

        private void SaveBackupCopy(string sourceFilePath, byte[] fileBytes, DadosXmlExtraidos? dados)
        {
            try
            {
                int ano = DateTime.Now.Year;
                int mes = DateTime.Now.Month;

                if (dados != null && !string.IsNullOrEmpty(dados.DataEmissao))
                {
                    var match = Regex.Match(dados.DataEmissao, @"^(\d{4})-(\d{2})");
                    if (match.Success)
                    {
                        ano = int.Parse(match.Groups[1].Value);
                        mes = int.Parse(match.Groups[2].Value);
                    }
                }

                if (mes < 1 || mes > 12) mes = DateTime.Now.Month;
                string nomeMes = NomeMeses[mes - 1];
                string folderMesAno = $"{mes:D2}-{nomeMes}-{ano}";

                string driveRoot = Path.GetPathRoot(sourceFilePath) ?? "C:\\";
                string targetDir = Path.Combine(driveRoot, "Contabilidade_Paratech", folderMesAno);

                try
                {
                    if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);
                    string destFile = Path.Combine(targetDir, Path.GetFileName(sourceFilePath));
                    File.Copy(sourceFilePath, destFile, true);
                }
                catch
                {
                    string fallbackRoot = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                    string fallbackDir = Path.Combine(fallbackRoot, "Contabilidade_Paratech", folderMesAno);
                    if (!Directory.Exists(fallbackDir)) Directory.CreateDirectory(fallbackDir);
                    string destFile = Path.Combine(fallbackDir, Path.GetFileName(sourceFilePath));
                    File.Copy(sourceFilePath, destFile, true);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao criar cópia de conferência na Contabilidade_Paratech: {ex.Message}");
            }
        }

        private async Task<byte[]?> ReadFileWithRetryAsync(string path, int maxRetries, int delayMs)
        {
            for (int i = 0; i < maxRetries; i++)
            {
                try
                {
                    using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                    using (var ms = new MemoryStream())
                    {
                        await fs.CopyToAsync(ms);
                        return ms.ToArray();
                    }
                }
                catch (IOException)
                {
                    // Arquivo pode estar sendo escrito pelo ERP, aguarda e tenta novamente
                    await Task.Delay(delayMs);
                }
                catch
                {
                    return null;
                }
            }
            return null;
        }

        public void Stop()
        {
            isRunning = false;
            if (watcher != null)
            {
                watcher.EnableRaisingEvents = false;
                watcher.Dispose();
            }
        }
    }
}
