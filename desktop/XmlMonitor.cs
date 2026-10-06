using System;
using System.IO;
using System.Net.Http.Headers;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Net.Http;

namespace HubParatechDesktop
{
    public class XmlMonitor
    {
        private FileSystemWatcher watcher;
        private string hubToken;
        private string tipoPasta; // "vendas" ou "compras"
        private HttpClient http;

        public XmlMonitor(string path, string tipoPasta, string token, HttpClient httpClient)
        {
            this.tipoPasta = tipoPasta;
            this.hubToken = token;
            this.http = httpClient;

            if (!Directory.Exists(path))
            {
                Directory.CreateDirectory(path);
            }

            watcher = new FileSystemWatcher(path, "*.xml");
            watcher.Created += OnXmlCreated;
            watcher.EnableRaisingEvents = true;
        }

        private async void OnXmlCreated(object sender, FileSystemEventArgs e)
        {
            // Aguarda um instante para garantir que o arquivo terminou de ser gravado pelo ERP local
            await Task.Delay(2000); 

            try
            {
                byte[] fileBytes = await File.ReadAllBytesAsync(e.FullPath);

                using (var content = new MultipartFormDataContent())
                {
                    content.Add(new StringContent(hubToken), "hub_token");
                    content.Add(new StringContent(tipoPasta), "tipo_pasta");
                    
                    var fileContent = new ByteArrayContent(fileBytes);
                    fileContent.Headers.ContentType = MediaTypeHeaderValue.Parse("application/xml");
                    content.Add(fileContent, "xml_file", Path.GetFileName(e.FullPath));

                    var response = await http.PostAsync("https://hub-paratech-web.vercel.app/api/hub/upload-xml", content);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        // Opcional: mover para pasta "enviados"
                        string enviadosPath = Path.Combine(Path.GetDirectoryName(e.FullPath) ?? "", "Enviados");
                        if (!Directory.Exists(enviadosPath)) Directory.CreateDirectory(enviadosPath);
                        File.Move(e.FullPath, Path.Combine(enviadosPath, Path.GetFileName(e.FullPath)), true);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro ao processar XML {e.Name}: {ex.Message}");
            }
        }

        public void Stop()
        {
            watcher.EnableRaisingEvents = false;
            watcher.Dispose();
        }
    }
}
