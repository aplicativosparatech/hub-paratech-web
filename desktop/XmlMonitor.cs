using System;
using System.IO;
using System.Net.Http.Headers;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text.RegularExpressions;

namespace HubParatechDesktop
{
    public class XmlMonitor
    {
        private FileSystemWatcher? watcher;
        private string rootPath;
        private string hubToken;
        private string tipoPasta; // "vendas" ou "compras"
        private HttpClient http;
        private bool isRunning = true;

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

            // Inicia varredura de arquivos existentes em segundo plano
            Task.Run(ScanExistingFilesAsync);
        }

        private async Task ScanExistingFilesAsync()
        {
            if (!Directory.Exists(rootPath)) return;

            try
            {
                // Busca todos os .xml na pasta e em todas as subpastas
                var files = Directory.GetFiles(rootPath, "*.xml", SearchOption.AllDirectories);
                foreach (var file in files)
                {
                    if (!isRunning) break;
                    await ProcessFileAsync(file);
                    await Task.Delay(50); // Pausa suave para não sobrecarregar I/O ou rede
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao varrer arquivos existentes em {rootPath}: {ex.Message}");
            }
        }

        private async Task ProcessFileAsync(string filePath)
        {
            try
            {
                if (!File.Exists(filePath)) return;

                string fileName = Path.GetFileName(filePath);
                string fileNameWithoutExt = Path.GetFileNameWithoutExtension(filePath);

                // REGRA: Ignora arquivos curtos (<= 35 caracteres) como rascunhos do Gdoor
                if (fileNameWithoutExt.Length <= 35)
                {
                    return;
                }

                // Identificador único (Nome do arquivo + Tamanho do arquivo)
                FileInfo fi = new FileInfo(filePath);
                string fileIdentifier = $"{fileName}_{fi.Length}";

                // Se já foi enviado anteriormente, NÃO envia de novo
                if (XmlUploadCache.IsUploaded(fileIdentifier))
                {
                    return;
                }

                // Tenta ler o arquivo com segurança (lidando com gravação pelo ERP)
                byte[]? fileBytes = await ReadFileWithRetryAsync(filePath, maxRetries: 4, delayMs: 1500);
                if (fileBytes == null || fileBytes.Length == 0) return;

                using (var content = new MultipartFormDataContent())
                {
                    content.Add(new StringContent(hubToken), "hub_token");
                    content.Add(new StringContent(tipoPasta), "tipo_pasta");

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

                        Debug.WriteLine($"XML enviado e conferido com sucesso: {fileName}");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao processar XML {filePath}: {ex.Message}");
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
