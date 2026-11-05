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
using System.Runtime.InteropServices;

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

    public class GapItemPortal
    {
        public string? modelo { get; set; }
        public string? serie { get; set; }
        public long numero_inicial { get; set; }
        public long numero_final { get; set; }
        public int quantidade { get; set; }
    }

    public class ReconciliacaoGapsResponse
    {
        public bool success { get; set; }
        public int total_gaps { get; set; }
        public List<GapItemPortal>? gaps { get; set; }
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
        private string? dataInicioMonitoramento;
        private long numeroInicialNfe = 1;
        private long numeroInicialNfce = 1;

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

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern uint SetThreadExecutionState(uint esFlags);

        private const uint ES_CONTINUOUS = 0x80000000;
        private const uint ES_SYSTEM_REQUIRED = 0x00000001;
        private const uint ES_AWAYMODE_REQUIRED = 0x00000040;

        public static void KeepSystemAwake()
        {
            try
            {
                SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED);
            }
            catch { }
        }

        public XmlMonitor(string path, string tipoPasta, string token, HttpClient httpClient, string modoProcessamento = "hub", string? dataInicio = null, long? nfeInicial = null, long? nfceInicial = null)
        {
            this.rootPath = path;
            this.tipoPasta = tipoPasta;
            this.hubToken = token;
            this.http = httpClient;
            this.modoProcessamento = string.Equals(modoProcessamento, "portal", StringComparison.OrdinalIgnoreCase) ? "portal" : "hub";
            this.dataInicioMonitoramento = dataInicio;
            this.numeroInicialNfe = nfeInicial.HasValue && nfeInicial.Value > 0 ? nfeInicial.Value : 1;
            this.numeroInicialNfce = nfceInicial.HasValue && nfceInicial.Value > 0 ? nfceInicial.Value : 1;

            // Impede suspensão de thread e economia de energia do Windows para garantir monitoramento ininterrupto
            KeepSystemAwake();

            if (!Directory.Exists(path))
            {
                try { Directory.CreateDirectory(path); } catch { }
            }

            SetupWatcher();

            // Inicia varredura e monitoramento periódico de arquivos existentes em segundo plano
            Task.Run(StartPeriodicScanAsync);
        }

        public void UpdatePontoPartida(string? dataInicio, long? nfe, long? nfce)
        {
            this.dataInicioMonitoramento = dataInicio;
            this.numeroInicialNfe = nfe.HasValue && nfe.Value > 0 ? nfe.Value : 1;
            this.numeroInicialNfce = nfce.HasValue && nfce.Value > 0 ? nfce.Value : 1;
        }

        public bool IsAnteriorAoPontoPartida(DadosXmlExtraidos dados, out string motivo)
        {
            motivo = "";

            // 1. Verificação de Data de Emissão vs Data Início do Monitoramento (Vendas e Compras)
            if (!string.IsNullOrWhiteSpace(dataInicioMonitoramento))
            {
                string dataInicioFormatada = dataInicioMonitoramento.Trim();
                if (dataInicioFormatada.Length == 7) // Ex: "2026-09" -> "2026-09-01"
                {
                    dataInicioFormatada += "-01";
                }
                else if (dataInicioFormatada.Length > 10)
                {
                    dataInicioFormatada = dataInicioFormatada.Substring(0, 10);
                }

                string? dataEmi = null;
                if (!string.IsNullOrWhiteSpace(dados.DataEmissao))
                {
                    var m = Regex.Match(dados.DataEmissao, @"^(\d{4}-\d{2}-\d{2})");
                    if (m.Success) dataEmi = m.Groups[1].Value;
                }

                if (string.IsNullOrEmpty(dataEmi) && !string.IsNullOrEmpty(dados.Chave) && dados.Chave.Length == 44)
                {
                    string aa = dados.Chave.Substring(2, 2);
                    string mm = dados.Chave.Substring(4, 2);
                    dataEmi = $"20{aa}-{mm}-01";
                }

                if (!string.IsNullOrEmpty(dataEmi))
                {
                    if (string.Compare(dataEmi, dataInicioFormatada, StringComparison.Ordinal) < 0)
                    {
                        motivo = $"Ignorado (Emissão {dataEmi} < {dataInicioFormatada})";
                        return true;
                    }
                }
            }

            // 2. Verificação de Numeração Inicial (Vendas)
            if (tipoPasta == "vendas" && long.TryParse(dados.Numero, out long num) && num > 0)
            {
                if (dados.Modelo == "65" && numeroInicialNfce > 1 && num < numeroInicialNfce)
                {
                    motivo = $"Ignorado (NFC-e #{num} < #{numeroInicialNfce})";
                    return true;
                }
                if (dados.Modelo == "55" && numeroInicialNfe > 1 && num < numeroInicialNfe)
                {
                    motivo = $"Ignorado (NF-e #{num} < #{numeroInicialNfe})";
                    return true;
                }
            }

            return false;
        }

        private void SetupWatcher()
        {
            try
            {
                if (watcher != null)
                {
                    try { watcher.EnableRaisingEvents = false; watcher.Dispose(); } catch { }
                }

                if (!Directory.Exists(rootPath)) return;

                // FileSystemWatcher monitorando recursivamente a pasta raiz e todas as subpastas
                watcher = new FileSystemWatcher(rootPath, "*.xml");
                watcher.IncludeSubdirectories = true; // Captura subpastas criadas pelo ERP (ex: 2026/10, Outubro_2026)
                watcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size;
                watcher.InternalBufferSize = 65536; // 64 KB de buffer para evitar InternalBufferOverflowException em rajadas de notas
                
                // Eventos de tempo real: assim que o arquivo é gerado ou gravado pelo PDV/ERP
                watcher.Created += (s, e) => _ = ProcessFileAsync(e.FullPath, isRealTime: true);
                watcher.Changed += (s, e) => _ = ProcessFileAsync(e.FullPath, isRealTime: true);
                watcher.Error += (s, e) =>
                {
                    Debug.WriteLine($"[XmlMonitor] Erro detectado no FileSystemWatcher para {rootPath}: {e.GetException()?.Message}. Reiniciando...");
                    Task.Delay(2000).ContinueWith(_ => SetupWatcher());
                };
                watcher.EnableRaisingEvents = true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao iniciar watcher em {rootPath}: {ex.Message}");
            }
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
                // Garante que o watcher continua ativo no Windows
                if (watcher != null && !watcher.EnableRaisingEvents && Directory.Exists(rootPath))
                {
                    try { watcher.EnableRaisingEvents = true; } catch { }
                }

                // Mantém a thread e sistema ativos contra suspensão
                KeepSystemAwake();

                await ScanExistingFilesAsync();
                await Task.Delay(30000); // Re-varre a cada 30 segundos (em vez de 120s) garantindo persistência sem hibernar
            }
        }

        public static List<FileInfo> SafeEnumerateXmlFiles(string root)
        {
            var result = new List<FileInfo>();
            try
            {
                var rootDir = new DirectoryInfo(root);
                if (!rootDir.Exists) return result;

                var stack = new Stack<DirectoryInfo>();
                stack.Push(rootDir);

                while (stack.Count > 0)
                {
                    var currentDir = stack.Pop();
                    try
                    {
                        var files = currentDir.GetFiles();
                        foreach (var f in files)
                        {
                            if (f.Extension.Equals(".xml", StringComparison.OrdinalIgnoreCase))
                            {
                                result.Add(f);
                            }
                        }
                    }
                    catch { }

                    try
                    {
                        var subDirs = currentDir.GetDirectories();
                        foreach (var sd in subDirs)
                        {
                            try
                            {
                                if (!sd.Attributes.HasFlag(FileAttributes.Hidden) && !sd.Attributes.HasFlag(FileAttributes.System))
                                {
                                    stack.Push(sd);
                                }
                            }
                            catch { }
                        }
                    }
                    catch { }
                }
            }
            catch { }
            return result;
        }

        private async Task ScanExistingFilesAsync()
        {
            if (!Directory.Exists(rootPath)) return;

            try
            {
                // Busca todos os arquivos XML (case-insensitive) na pasta principal e em todas as subpastas recursivamente
                var files = SafeEnumerateXmlFiles(rootPath)
                                   .OrderByDescending(f => f.LastWriteTime) // Prioriza os mais recentes (de hoje e deste mês)
                                   .ToList();

                int totalArquivos = files.Count;
                int jaProcessados = 0;
                int enviadosNestaRodada = 0;
                int falhas = 0;
                int analisados = 0;

                Debug.WriteLine($"[Auditoria Hub] Iniciando conferência em {rootPath}. Total de arquivos XML encontrados: {totalArquivos}");

                if (totalArquivos > 0)
                {
                    LiveMonitorForm.ReportProgress(0, totalArquivos, $"Iniciando conferência de {totalArquivos} notas fiscais...", isSyncing: true);
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
                    analisados++;

                    if (totalArquivos > 0 && (analisados % 10 == 0 || analisados == totalArquivos))
                    {
                        int pct = (int)Math.Round((double)analisados * 100.0 / totalArquivos);
                        LiveMonitorForm.ReportProgress(analisados, totalArquivos, $"Varrendo notas: {analisados} de {totalArquivos} ({pct}%)...", isSyncing: true);
                    }

                    string file = fileInfo.FullName;
                    string fileName = fileInfo.Name;

                    // Ignora arquivos vazios ou rascunhos de bloqueio menores que 100 bytes
                    if (fileInfo.Length < 100)
                    {
                        continue;
                    }

                    string fileIdentifier = $"{fileName}_{fileInfo.Length}";

                    // Extração de chave e metadados
                    string? chRapida = null;
                    string? dataEmiChave = null;
                    string modChave = "65";
                    long numChave = 0;
                    string serieChave = "1";
                    decimal valorRapido = 0;

                    // 1. Extração preliminar se chave de 44 dígitos constar no nome do arquivo
                    var matchChaveNome = Regex.Match(fileName, @"\d{44}");
                    if (matchChaveNome.Success)
                    {
                        chRapida = matchChaveNome.Value;
                        modChave = chRapida.Substring(20, 2);
                        numChave = long.TryParse(chRapida.Substring(25, 9), out long n) ? n : 0;
                        serieChave = long.TryParse(chRapida.Substring(22, 3), out long s) ? s.ToString() : "1";
                    }

                    // 2. Extrai metadados reais de dentro do XML (dhEmi real com dia e horário exatos, valor total e número)
                    var meta = ExtrairMetadadosRapidos(file);
                    if (!string.IsNullOrEmpty(meta.chave)) chRapida = meta.chave;
                    if (!string.IsNullOrEmpty(meta.modelo)) modChave = meta.modelo;
                    if (long.TryParse(meta.numero, out long nParsed) && nParsed > 0) numChave = nParsed;
                    if (!string.IsNullOrEmpty(meta.serie)) serieChave = meta.serie;
                    if (!string.IsNullOrEmpty(meta.dhEmi)) dataEmiChave = meta.dhEmi;
                    if (meta.valor > 0) valorRapido = meta.valor;

                    // Fallback para data da chave ou do arquivo caso não haja dhEmi no XML
                    if (string.IsNullOrEmpty(dataEmiChave))
                    {
                        if (matchChaveNome.Success && chRapida != null && chRapida.Length == 44)
                        {
                            string aa = chRapida.Substring(2, 2);
                            string mm = chRapida.Substring(4, 2);
                            dataEmiChave = $"20{aa}-{mm}-01";
                        }
                        else
                        {
                            dataEmiChave = fileInfo.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss");
                        }
                    }

                    if (XmlUploadCache.IsUploaded(fileIdentifier, chRapida))
                    {
                        jaProcessados++;
                        if (LiveMonitorForm.CountLogs < 2000)
                        {
                            LiveMonitorForm.AddLog(new XmlLogItem
                            {
                                Timestamp = fileInfo.LastWriteTime,
                                TipoPasta = tipoPasta == "compras" ? "Entrada" : "Saída",
                                Modelo = modChave,
                                Numero = numChave > 0 ? numChave.ToString() : Path.GetFileNameWithoutExtension(fileName),
                                Serie = serieChave,
                                DataEmissao = dataEmiChave ?? "",
                                ValorTotal = valorRapido,
                                Chave = chRapida ?? "-",
                                Status = "Já no Portal (Sincronizado)",
                                Arquivo = file,
                                IsRealTime = false
                            });
                        }
                        continue;
                    }

                    // PRÉ-FILTRO ULTRA-RÁPIDO: Ponto de partida fiscal
                    if (chRapida != null)
                    {
                        bool ignorar = false;
                        string motivoIgnorar = "Ignorado (Ponto de Partida)";

                        if (!string.IsNullOrWhiteSpace(dataInicioMonitoramento) && dataEmiChave != null)
                        {
                            string dataInicioFormatada = dataInicioMonitoramento.Trim();
                            if (dataInicioFormatada.Length == 7) dataInicioFormatada += "-01";
                            else if (dataInicioFormatada.Length > 10) dataInicioFormatada = dataInicioFormatada.Substring(0, 10);

                            string dataComp = dataEmiChave.Length >= 10 ? dataEmiChave.Substring(0, 10) : dataEmiChave;
                            if (string.Compare(dataComp, dataInicioFormatada, StringComparison.Ordinal) < 0)
                            {
                                ignorar = true;
                                motivoIgnorar = $"Ignorado (Emissão {dataComp} < {dataInicioFormatada})";
                            }
                        }

                        if (!ignorar && tipoPasta == "vendas" && numChave > 0)
                        {
                            if (modChave == "65" && numeroInicialNfce > 1 && numChave < numeroInicialNfce)
                            {
                                ignorar = true;
                                motivoIgnorar = $"Ignorado (NFC-e #{numChave} < #{numeroInicialNfce})";
                            }
                            else if (modChave == "55" && numeroInicialNfe > 1 && numChave < numeroInicialNfe)
                            {
                                ignorar = true;
                                motivoIgnorar = $"Ignorado (NF-e #{numChave} < #{numeroInicialNfe})";
                            }
                        }

                        if (ignorar)
                        {
                            XmlUploadCache.MarkAsUploaded(fileIdentifier, chRapida);
                            jaProcessados++;
                            if (LiveMonitorForm.CountLogs < 2000)
                            {
                                LiveMonitorForm.AddLog(new XmlLogItem
                                {
                                    Timestamp = fileInfo.LastWriteTime,
                                    TipoPasta = tipoPasta == "compras" ? "Entrada" : "Saída",
                                    Modelo = modChave,
                                    Numero = numChave > 0 ? numChave.ToString() : Path.GetFileNameWithoutExtension(fileName),
                                    Serie = serieChave,
                                    DataEmissao = dataEmiChave ?? "",
                                    ValorTotal = valorRapido,
                                    Chave = chRapida ?? "-",
                                    Status = motivoIgnorar,
                                    Arquivo = file,
                                    IsRealTime = false
                                });
                            }
                            continue;
                        }
                    }

                    bool sucesso = await ProcessFileAsync(file, isRealTime: false);
                    if (sucesso) enviadosNestaRodada++;
                    else falhas++;

                    await Task.Delay(40); // Pausa suave para não sobrecarregar I/O ou rede
                }

                LiveMonitorForm.ReportProgress(totalArquivos, totalArquivos, $"Sincronização em dia • {totalArquivos} notas conferidas", isSyncing: false);

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
                LiveMonitorForm.ReportProgress(100, 100, "Monitoramento ativo", isSyncing: false);
                OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                {
                    IsSyncing = false,
                    StatusMessage = "Monitorando",
                    TipoPasta = tipoPasta
                });
            }
        }

        public static (decimal valor, string? dhEmi, string? chave, string? modelo, string? numero, string? serie) ExtrairMetadadosRapidos(string filePath)
        {
            try
            {
                if (!File.Exists(filePath)) return (0, null, null, null, null, null);
                byte[] bytes;
                using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    int len = (int)Math.Min(fs.Length, 32768);
                    bytes = new byte[len];
                    fs.Read(bytes, 0, len);
                }

                string text = System.Text.Encoding.UTF8.GetString(bytes);
                if (text.Contains("encoding=\"ISO-8859-1\"") || text.Contains("encoding=\"iso-8859-1\""))
                {
                    try { text = System.Text.Encoding.GetEncoding("ISO-8859-1").GetString(bytes); } catch { }
                }

                decimal valor = 0;
                var matchV = Regex.Match(text, @"<vNF>([\d\.]+)</vNF>");
                if (matchV.Success && decimal.TryParse(matchV.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out decimal v))
                {
                    valor = v;
                }

                string? dhEmi = null;
                var matchEmi = Regex.Match(text, @"<(?:dhEmi|dEmi)[^>]*>([^<]+)<");
                if (matchEmi.Success)
                {
                    dhEmi = matchEmi.Groups[1].Value;
                }

                string? chave = null;
                var matchChave = Regex.Match(text, @"<(?:chNFe|chCTe|chMDFe)[^>]*>([A-Za-z0-9]{44})<");
                if (matchChave.Success)
                {
                    chave = matchChave.Groups[1].Value.ToUpper();
                }
                else
                {
                    var matchId = Regex.Match(text, @"Id\s*=\s*[""'](?:NFe|NFCe|CTe|MDFe)?([A-Za-z0-9]{44})[""']", RegexOptions.IgnoreCase);
                    if (matchId.Success)
                    {
                        chave = matchId.Groups[1].Value.ToUpper();
                    }
                }

                string? modelo = null;
                if (!string.IsNullOrEmpty(chave) && chave.Length == 44)
                {
                    modelo = chave.Substring(20, 2);
                }
                else
                {
                    var matchMod = Regex.Match(text, @"<mod>(\d{2})</mod>");
                    if (matchMod.Success) modelo = matchMod.Groups[1].Value;
                }

                string? numero = null;
                var matchNum = Regex.Match(text, @"<nNF>(\d+)</nNF>");
                if (matchNum.Success)
                {
                    numero = matchNum.Groups[1].Value;
                }
                else if (!string.IsNullOrEmpty(chave) && chave.Length == 44)
                {
                    numero = Convert.ToInt64(chave.Substring(25, 9)).ToString();
                }

                string? serie = null;
                var matchSerie = Regex.Match(text, @"<serie>(\d+)</serie>");
                if (matchSerie.Success)
                {
                    serie = matchSerie.Groups[1].Value;
                }
                else if (!string.IsNullOrEmpty(chave) && chave.Length == 44)
                {
                    serie = Convert.ToInt32(chave.Substring(22, 3)).ToString();
                }

                return (valor, dhEmi, chave, modelo, numero, serie);
            }
            catch
            {
                return (0, null, null, null, null, null);
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

        private async Task<bool> ProcessFileAsync(string filePath, bool isRealTime = false, bool forceUpload = false)
        {
            try
            {
                if (!File.Exists(filePath)) return false;

                string fileName = Path.GetFileName(filePath);
                string fileNameWithoutExt = Path.GetFileNameWithoutExtension(filePath);

                // Identificador preliminar
                FileInfo fi = new FileInfo(filePath);
                string fileIdentifier = $"{fileName}_{fi.Length}";

                // Se já foi enviado anteriormente, não envia de novo (a menos que seja forceUpload na reconciliação de gaps)
                if (!forceUpload && XmlUploadCache.IsUploaded(fileIdentifier))
                {
                    return true;
                }

                // Tenta ler o arquivo com segurança (esperando o ERP terminar a gravação no disco)
                byte[]? fileBytes = await ReadFileWithRetryAsync(filePath, maxRetries: 4, delayMs: 1500);
                if (fileBytes == null || fileBytes.Length == 0) return false;

                // Atualiza o identificador com o tamanho real dos bytes lidos do disco
                fileIdentifier = $"{fileName}_{fileBytes.Length}";

                // Análise e Validação Fiscal Completa do Conteúdo
                var validacao = ValidarEExtrairXml(fileBytes, fileName);
                if (!validacao.Valido || validacao.Dados == null)
                {
                    Debug.WriteLine($"[Hub Monitor] Arquivo ignorado ({fileName}): {validacao.MotivoDescarte}");
                    return false;
                }

                var dadosLocais = validacao.Dados;

                // Se a chave já estiver no cache, marca o identificador e pula (a menos que forceUpload seja true)
                if (!forceUpload && XmlUploadCache.IsUploaded(fileIdentifier, dadosLocais.Chave))
                {
                    XmlUploadCache.MarkAsUploaded(fileIdentifier, dadosLocais.Chave);
                    return true;
                }

                // VALIDAÇÃO FISCAL PRÉVIA: Ponto de Partida Fiscal (ignora arquivos antigos sem fazer requisição de rede)
                if (!forceUpload && IsAnteriorAoPontoPartida(dadosLocais, out string motivoPontoPartida))
                {
                    XmlUploadCache.MarkAsUploaded(fileIdentifier, dadosLocais.Chave);
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
                        Status = motivoPontoPartida,
                        Arquivo = filePath,
                        IsRealTime = isRealTime
                    });
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
                        var respString = await response.Content.ReadAsStringAsync();
                        bool isIgnored = false;
                        string reason = "";
                        try
                        {
                            using var doc = JsonDocument.Parse(respString);
                            if (doc.RootElement.TryGetProperty("ignored", out var ignProp) && ignProp.GetBoolean())
                            {
                                isIgnored = true;
                                if (doc.RootElement.TryGetProperty("reason", out var reasProp))
                                {
                                    reason = reasProp.GetString() ?? "";
                                }
                            }
                        }
                        catch { }

                        // 1. Marca no cache local que foi processado
                        XmlUploadCache.MarkAsUploaded(fileIdentifier, dadosLocais.Chave);

                        if (isIgnored)
                        {
                            string statusIgn = !string.IsNullOrWhiteSpace(reason)
                                ? (reason.Length > 40 ? reason.Substring(0, 37) + "..." : reason)
                                : "Ignorado pelo Portal";

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
                                Status = $"Ignorado ({statusIgn})",
                                Arquivo = filePath,
                                IsRealTime = isRealTime
                            });

                            OnXmlProcessed?.Invoke(this, new XmlSyncEventArgs
                            {
                                IsSyncing = false,
                                StatusMessage = "Ignorado",
                                FileName = fileName,
                                Dados = dadosLocais,
                                IsRealTime = isRealTime,
                                Sucesso = false,
                                StatusDescricao = reason,
                                TipoPasta = tipoPasta,
                                FilePath = filePath
                            });

                            OnSyncStatusChanged?.Invoke(this, new XmlSyncEventArgs
                            {
                                IsSyncing = false,
                                StatusMessage = "Monitorando",
                                TipoPasta = tipoPasta
                            });

                            return true;
                        }

                        // 2. Cria cópia de conferência na pasta Contabilidade_Paratech/{MM-MES-AAAA} apenas se foi aceito com sucesso
                        SaveBackupCopy(filePath, fileBytes, dadosLocais);

                        // 3. Adiciona ao log em tempo real com status Sucesso
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
                            Arquivo = filePath,
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
                            Arquivo = filePath,
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
                LiveMonitorForm.AddLog(new XmlLogItem
                {
                    Timestamp = DateTime.Now,
                    TipoPasta = tipoPasta == "compras" ? "Entrada" : "Saída",
                    Modelo = "XML",
                    Numero = Path.GetFileNameWithoutExtension(filePath),
                    Serie = "-",
                    DataEmissao = DateTime.Now.ToString("yyyy-MM-dd"),
                    ValorTotal = 0,
                    Chave = "-",
                    Status = $"Erro: {ex.Message}",
                    Arquivo = filePath,
                    IsRealTime = isRealTime
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

        public static async Task<(int recuperados, int ausentes, string mensagem)> ExecutarReconciliacaoGapsAsync(
            string hubToken,
            HttpClient client,
            List<XmlMonitor> monitores)
        {
            if (string.IsNullOrEmpty(hubToken) || monitores == null || monitores.Count == 0)
            {
                return (0, 0, "Nenhum monitor ativo ou token do cliente não configurado.");
            }

            try
            {
                var jsonReq = JsonSerializer.Serialize(new { hub_token = hubToken });
                var contentReq = new StringContent(jsonReq, System.Text.Encoding.UTF8, "application/json");

                var resp = await client.PostAsync("https://hub-paratech-web.vercel.app/api/hub/reconciliar-gaps", contentReq);
                if (!resp.IsSuccessStatusCode)
                {
                    return (0, 0, $"Falha ao consultar gaps no portal: HTTP {(int)resp.StatusCode}");
                }

                var respStr = await resp.Content.ReadAsStringAsync();
                var gapData = JsonSerializer.Deserialize<ReconciliacaoGapsResponse>(respStr);

                if (gapData == null || !gapData.success)
                {
                    return (0, 0, "Resposta inválida recebida do Portal Paratech.");
                }

                if (gapData.gaps == null || gapData.gaps.Count == 0)
                {
                    return (0, 0, "✅ Sequência fiscal 100% perfeita!\n\nNão há nenhuma quebra ou nota faltante identificada no Portal Paratech.");
                }

                // Cria mapa de números faltantes esperados
                var faltantesNfce = new HashSet<long>();
                var faltantesNfe = new HashSet<long>();

                foreach (var g in gapData.gaps)
                {
                    for (long n = g.numero_inicial; n <= g.numero_final; n++)
                    {
                        if (g.modelo == "55") faltantesNfe.Add(n);
                        else faltantesNfce.Add(n);
                    }
                }

                int totalFaltantesEsperados = faltantesNfce.Count + faltantesNfe.Count;
                int recuperados = 0;

                Debug.WriteLine($"[Reconciliação Gaps] {totalFaltantesEsperados} notas faltantes no portal. Iniciando varredura profunda no disco do PDV...");

                // Mapeia todos os arquivos XML locais em todas as pastas de vendas e subpastas
                var arquivosLocais = new List<FileInfo>();
                foreach (var m in monitores.Where(x => x.tipoPasta == "vendas"))
                {
                    arquivosLocais.AddRange(SafeEnumerateXmlFiles(m.rootPath));
                }

                var numerosRecuperados = new HashSet<long>();

                foreach (var fileInfo in arquivosLocais)
                {
                    if (fileInfo.Length < 100) continue;

                    var meta = ExtrairMetadadosRapidos(fileInfo.FullName);
                    if (long.TryParse(meta.numero, out long numNota) && numNota > 0)
                    {
                        bool precisaEnviar = false;
                        if (meta.modelo == "65" && faltantesNfce.Contains(numNota) && !numerosRecuperados.Contains(numNota))
                        {
                            precisaEnviar = true;
                        }
                        else if (meta.modelo == "55" && faltantesNfe.Contains(numNota) && !numerosRecuperados.Contains(numNota))
                        {
                            precisaEnviar = true;
                        }

                        if (precisaEnviar)
                        {
                            // Remove do cache para forçar envio
                            string fileId = $"{fileInfo.Name}_{fileInfo.Length}";
                            XmlUploadCache.RemoveKey(fileId);
                            if (!string.IsNullOrEmpty(meta.chave)) XmlUploadCache.RemoveKey(meta.chave);

                            // Envia o arquivo forçando o upload (bypassa cache local já que a nuvem acusou falta)
                            var monitor = monitores.FirstOrDefault(x => x.tipoPasta == "vendas") ?? monitores[0];
                            bool ok = await monitor.ProcessFileAsync(fileInfo.FullName, isRealTime: false, forceUpload: true);
                            if (ok)
                            {
                                recuperados++;
                                numerosRecuperados.Add(numNota);
                                string modNome = meta.modelo == "65" ? "NFC-e" : "NF-e";
                                LiveMonitorForm.AddLog(new XmlLogItem
                                {
                                    Timestamp = DateTime.Now,
                                    TipoPasta = "Saída",
                                    Modelo = meta.modelo ?? "65",
                                    Numero = numNota.ToString(),
                                    Serie = meta.serie ?? "1",
                                    DataEmissao = meta.dhEmi ?? DateTime.Now.ToString("yyyy-MM-dd"),
                                    ValorTotal = meta.valor,
                                    Chave = meta.chave ?? "-",
                                    Status = "Recuperado & Enviado (Gap)",
                                    Arquivo = fileInfo.FullName,
                                    IsRealTime = false
                                });
                            }
                        }
                    }
                }

                // 2. Camada de Varredura Expandida: Se ainda restarem notas faltantes, busca na pasta pai do ERP (ex: NFCe\XML)
                if (numerosRecuperados.Count < totalFaltantesEsperados)
                {
                    var pastasPaisProcessadas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var m in monitores.Where(x => x.tipoPasta == "vendas"))
                    {
                        try
                        {
                            var pDir = Directory.GetParent(m.rootPath);
                            if (pDir != null && pDir.Exists && pastasPaisProcessadas.Add(pDir.FullName))
                            {
                                var arquivosPai = SafeEnumerateXmlFiles(pDir.FullName);
                                foreach (var fileInfo in arquivosPai)
                                {
                                    if (fileInfo.Length < 100) continue;
                                    var meta = ExtrairMetadadosRapidos(fileInfo.FullName);
                                    if (long.TryParse(meta.numero, out long numNota) && numNota > 0)
                                    {
                                        bool precisaEnviar = false;
                                        if (meta.modelo == "65" && faltantesNfce.Contains(numNota) && !numerosRecuperados.Contains(numNota))
                                            precisaEnviar = true;
                                        else if (meta.modelo == "55" && faltantesNfe.Contains(numNota) && !numerosRecuperados.Contains(numNota))
                                            precisaEnviar = true;

                                        if (precisaEnviar)
                                        {
                                            string fileId = $"{fileInfo.Name}_{fileInfo.Length}";
                                            XmlUploadCache.RemoveKey(fileId);
                                            if (!string.IsNullOrEmpty(meta.chave)) XmlUploadCache.RemoveKey(meta.chave);

                                            bool ok = await m.ProcessFileAsync(fileInfo.FullName, isRealTime: false, forceUpload: true);
                                            if (ok)
                                            {
                                                recuperados++;
                                                numerosRecuperados.Add(numNota);
                                                LiveMonitorForm.AddLog(new XmlLogItem
                                                {
                                                    Timestamp = DateTime.Now,
                                                    TipoPasta = "Saída (Pasta Raiz)",
                                                    Modelo = meta.modelo ?? "65",
                                                    Numero = numNota.ToString(),
                                                    Serie = meta.serie ?? "1",
                                                    DataEmissao = meta.dhEmi ?? DateTime.Now.ToString("yyyy-MM-dd"),
                                                    ValorTotal = meta.valor,
                                                    Chave = meta.chave ?? "-",
                                                    Status = "Recuperado & Enviado (Gap)",
                                                    Arquivo = fileInfo.FullName,
                                                    IsRealTime = false
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                }

                int ausentes = totalFaltantesEsperados - recuperados;

                string msg = recuperados > 0
                    ? $"🎉 Auditoria e Reconciliação Concluída!\n\n• {recuperados} notas foram localizadas no disco do computador do cliente e sincronizadas com sucesso no Portal!\n• {ausentes} números faltantes não possuem arquivo XML no computador do cliente (correspondem a pulos de sequência no PDV, prontos para inutilização segura)."
                    : $"Auditoria e Reconciliação Concluída!\n\n• Nenhuma das {ausentes} numerações faltantes possui arquivo XML no disco do cliente.\n• Todas as quebras correspondem a saltos de emissão no PDV e estão aptas para inutilização na SEFAZ.";

                return (recuperados, ausentes, msg);
            }
            catch (Exception ex)
            {
                return (0, 0, $"Erro durante reconciliação de gaps: {ex.Message}");
            }
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
