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

                // REGRA SOLICITADA:
                // Sistemas como Gdoor gravam 2 arquivos (um provisório curto e um com a chave de 44 dígitos).
                // Ignora arquivos com nome curto (<= 35 caracteres) para pegar apenas o XML oficial com chave.
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

                // Tenta ler o arquivo com segurança (lidando com arquivo em gravação pelo ERP)
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
                        // REGRA: O ARQUIVO ORIGINAL NUNCA É MOVIDO OU APAGADO!
                        // Ele permanece intacto na pasta do cliente para o ERP continuar funcionando normalmente.
                        // Marcamos no cache em disco que o arquivo já foi enviado com sucesso.
                        XmlUploadCache.MarkAsUploaded(fileIdentifier);
                        Debug.WriteLine($"XML enviado com sucesso: {fileName}");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao processar XML {filePath}: {ex.Message}");
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
