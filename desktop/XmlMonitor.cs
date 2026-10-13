using System;
using System.IO;
using System.Net.Http.Headers;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Text.Json;

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
        public List<FormaPagamentoLocal> FormasPagamento { get; set; } = new List<FormaPagamentoLocal>();
        public string FormasPagamentoJson { get; set; } = "[]";
    }

    public class XmlMonitor
    {
        private FileSystemWatcher? watcher;
        private string rootPath;
        private string hubToken;
        private string tipoPasta; // "vendas" ou "compras"
        private HttpClient http;
        private bool isRunning = true;

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

        public XmlMonitor(string path, string tipoPasta, string token, HttpClient httpClient)
        {
            this.rootPath = path;
            this.tipoPasta = tipoPasta;
            this.hubToken = token;
            this.http = httpClient;

            if (!Directory.Exists(path))
            {
                try { Directory.CreateDirectory(path); } catch { }
            }

            try
            {
                watcher = new FileSystemWatcher(path, "*.xml");
                watcher.IncludeSubdirectories = true; // Monitora todas as subpastas
                watcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size;
                watcher.Created += (s, e) => _ = ProcessFileAsync(e.FullPath);
                watcher.Changed += (s, e) => _ = ProcessFileAsync(e.FullPath);
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
                // Busca todos os .xml na pasta e em todas as subpastas
                var files = Directory.GetFiles(rootPath, "*.xml", SearchOption.AllDirectories);
                int totalArquivos = files.Length;
                int jaProcessados = 0;
                int enviadosNestaRodada = 0;
                int falhas = 0;

                Debug.WriteLine($"[Auditoria Hub] Iniciando conferência em {rootPath}. Total de arquivos XML encontrados: {totalArquivos}");

                foreach (var file in files)
                {
                    if (!isRunning) break;

                    string fileName = Path.GetFileName(file);
                    string fileNameWithoutExt = Path.GetFileNameWithoutExtension(file);
                    if (fileNameWithoutExt.Length <= 35) continue;

                    FileInfo fi = new FileInfo(file);
                    string fileIdentifier = $"{fileName}_{fi.Length}";

                    if (XmlUploadCache.IsUploaded(fileIdentifier))
                    {
                        jaProcessados++;
                        continue;
                    }

                    bool sucesso = await ProcessFileAsync(file);
                    if (sucesso) enviadosNestaRodada++;
                    else falhas++;

                    await Task.Delay(40); // Pausa suave para não sobrecarregar I/O ou rede
                }

                Debug.WriteLine($"[Auditoria Hub] Resumo de conferência em {rootPath}: Total={totalArquivos}, No Cache={jaProcessados}, Enviados={enviadosNestaRodada}, Falhas={falhas}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao varrer arquivos existentes em {rootPath}: {ex.Message}");
            }
        }

        public static DadosXmlExtraidos ExtrairDadosXmlLocal(byte[] fileBytes, string fileName)
        {
            var dados = new DadosXmlExtraidos();
            try
            {
                string xml = System.Text.Encoding.UTF8.GetString(fileBytes);

                // 1. Chave de Acesso (44 dígitos)
                var matchChave = Regex.Match(xml, @"<(?:chNFe|chCTe|chMDFe)[^>]*>(\d{44})<");
                if (matchChave.Success)
                {
                    dados.Chave = matchChave.Groups[1].Value;
                }
                else
                {
                    var matchId = Regex.Match(xml, @"Id\s*=\s*[""'](?:NFe|NFCe|CTe|MDFe)?(\d{44})[""']", RegexOptions.IgnoreCase);
                    if (matchId.Success)
                    {
                        dados.Chave = matchId.Groups[1].Value;
                    }
                    else
                    {
                        var matchFile = Regex.Match(fileName, @"(\d{44})");
                        if (matchFile.Success)
                        {
                            dados.Chave = matchFile.Groups[1].Value;
                        }
                    }
                }

                // 2. Modelo (55 ou 65)
                if (!string.IsNullOrEmpty(dados.Chave) && dados.Chave.Length == 44)
                {
                    dados.Modelo = dados.Chave.Substring(20, 2);
                }
                else
                {
                    var matchMod = Regex.Match(xml, @"<mod>(\d{2})</mod>");
                    if (matchMod.Success) dados.Modelo = matchMod.Groups[1].Value;
                }

                // 3. Número e Série
                var matchNum = Regex.Match(xml, @"<nNF>(\d+)</nNF>");
                if (matchNum.Success) dados.Numero = matchNum.Groups[1].Value;

                var matchSerie = Regex.Match(xml, @"<serie>(\d+)</serie>");
                if (matchSerie.Success) dados.Serie = matchSerie.Groups[1].Value;

                // 4. Valor Total
                var matchValor = Regex.Match(xml, @"<vNF>([\d\.]+)</vNF>");
                if (matchValor.Success && decimal.TryParse(matchValor.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out decimal v))
                {
                    dados.ValorTotal = v;
                }

                // 5. Data de Emissão
                var matchEmi = Regex.Match(xml, @"<(?:dhEmi|dEmi)[^>]*>([^<]+)<");
                if (matchEmi.Success) dados.DataEmissao = matchEmi.Groups[1].Value;

                // 6. Formas de Pagamento (<detPag> ou <pag>)
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
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro na extração local de XML: {ex.Message}");
            }

            return dados;
        }

        private async Task<bool> ProcessFileAsync(string filePath)
        {
            try
            {
                if (!File.Exists(filePath)) return false;

                string fileName = Path.GetFileName(filePath);
                string fileNameWithoutExt = Path.GetFileNameWithoutExtension(filePath);

                // REGRA: Ignora arquivos curtos (<= 35 caracteres) como rascunhos do Gdoor
                if (fileNameWithoutExt.Length <= 35)
                {
                    return false;
                }

                // Identificador único (Nome do arquivo + Tamanho do arquivo)
                FileInfo fi = new FileInfo(filePath);
                string fileIdentifier = $"{fileName}_{fi.Length}";

                // Se já foi enviado anteriormente, NÃO envia de novo
                if (XmlUploadCache.IsUploaded(fileIdentifier))
                {
                    return true;
                }

                // Tenta ler o arquivo com segurança (lidando com gravação pelo ERP)
                byte[]? fileBytes = await ReadFileWithRetryAsync(filePath, maxRetries: 4, delayMs: 1500);
                if (fileBytes == null || fileBytes.Length == 0) return false;

                // Extração local pré-processada pelo Hub no computador do cliente
                var dadosLocais = ExtrairDadosXmlLocal(fileBytes, fileName);

                using (var content = new MultipartFormDataContent())
                {
                    content.Add(new StringContent(hubToken), "hub_token");
                    content.Add(new StringContent(tipoPasta), "tipo_pasta");

                    // Anexa metadados já mastigados pelo Hub (economiza CPU na nuvem)
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

                    var fileContent = new ByteArrayContent(fileBytes);
                    fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");
                    content.Add(fileContent, "xml_file", fileName);

                    var response = await http.PostAsync("https://hub-paratech-web.vercel.app/api/hub/upload-xml", content);

                    if (response.IsSuccessStatusCode)
                    {
                        // 1. Marca no cache local que foi enviado (evita duplicidades no futuro)
                        XmlUploadCache.MarkAsUploaded(fileIdentifier);

                        // 2. Cria cópia de conferência em Contabilidade_Paratech/{MM-MES-AAAA} SEM mexer no original
                        SaveBackupCopy(filePath, fileBytes);

                        Debug.WriteLine($"[Hub Local] XML enviado e conferido com sucesso: {fileName} (Mod {dadosLocais.Modelo})");
                        return true;
                    }
                    else
                    {
                        Debug.WriteLine($"[Hub Local] Falha ao enviar XML {fileName}: Status {response.StatusCode}");
                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao processar XML {filePath}: {ex.Message}");
                return false;
            }
        }

        private void SaveBackupCopy(string sourceFilePath, byte[] fileBytes)
        {
            try
            {
                // Determina Ano e Mês (priorizando a data de emissão do XML)
                int ano = DateTime.Now.Year;
                int mes = DateTime.Now.Month;

                try
                {
                    string xmlPreview = System.Text.Encoding.UTF8.GetString(fileBytes, 0, Math.Min(fileBytes.Length, 4096));
                    var match = Regex.Match(xmlPreview, @"<(?:dhEmi|dEmi)[^>]*>(\d{4})-(\d{2})-(\d{2})");
                    if (match.Success)
                    {
                        ano = int.Parse(match.Groups[1].Value);
                        mes = int.Parse(match.Groups[2].Value);
                    }
                    else
                    {
                        var fi = new FileInfo(sourceFilePath);
                        ano = fi.LastWriteTime.Year;
                        mes = fi.LastWriteTime.Month;
                    }
                }
                catch
                {
                    var fi = new FileInfo(sourceFilePath);
                    ano = fi.LastWriteTime.Year;
                    mes = fi.LastWriteTime.Month;
                }

                if (mes < 1 || mes > 12) mes = DateTime.Now.Month;
                string nomeMes = NomeMeses[mes - 1];
                string folderMesAno = $"{mes:D2}-{nomeMes}-{ano}";

                // Base do drive onde o arquivo monitorado reside (ex: C:\ ou D:\)
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
                    // Fallback para a pasta do perfil caso a raiz do drive exija elevação
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
