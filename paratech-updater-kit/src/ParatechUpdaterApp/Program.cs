using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ParatechUpdaterApp
{
    public class UpdateApiResponse
    {
        public bool tem_atualizacao { get; set; }
        public string? sistema_id { get; set; }
        public string? versao_atual { get; set; }
        public int build_number_atual { get; set; }
        public string? versao_mais_recente { get; set; }
        public int build_number_mais_recente { get; set; }
        public bool obrigatoria { get; set; }
        public string? politica_efetiva { get; set; }
        public string? changelog { get; set; }
        public string? url_download { get; set; }
        public long? tamanho_bytes { get; set; }
    }

    internal static class Program
    {
        private static readonly HttpClient http = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
        private const string BaseApiUrl = "https://hub-paratech-web.vercel.app/api/hub/versoes/check";

        [STAThread]
        static void Main(string[] args)
        {
            ApplicationConfiguration.Initialize();

            // Parser de argumentos:
            // --app=gastro --version=1.0.0 --mode=dialog|auto --cnpj=... --caller_pid=1234
            string sistemaId = "mei_simples";
            string versaoAtual = "1.0.0";
            string modo = "dialog";
            string cnpj = "";
            int callerPid = 0;

            foreach (var arg in args)
            {
                if (arg.StartsWith("--app=", StringComparison.OrdinalIgnoreCase))
                    sistemaId = arg.Substring(6).Trim();
                else if (arg.StartsWith("--version=", StringComparison.OrdinalIgnoreCase) || arg.StartsWith("--versao=", StringComparison.OrdinalIgnoreCase))
                    versaoAtual = arg.Substring(arg.IndexOf('=') + 1).Trim();
                else if (arg.StartsWith("--mode=", StringComparison.OrdinalIgnoreCase) || arg.StartsWith("--modo=", StringComparison.OrdinalIgnoreCase))
                    modo = arg.Substring(arg.IndexOf('=') + 1).Trim().ToLower();
                else if (arg.StartsWith("--cnpj=", StringComparison.OrdinalIgnoreCase))
                    cnpj = arg.Substring(7).Trim();
                else if (arg.StartsWith("--caller_pid=", StringComparison.OrdinalIgnoreCase))
                    int.TryParse(arg.Substring(13), out callerPid);
            }

            // Se rodar sem argumentos, exibe tela de teste/ajuda
            if (args.Length == 0)
            {
                MessageBox.Show(
                    "Paratech Universal Auto-Updater v1.0.0\n\n" +
                    "Uso via linha de comando:\n" +
                    "ParatechUpdater.exe --app=<sistema_id> --version=<versao_atual> [--mode=dialog|auto] [--cnpj=<cnpj>]\n\n" +
                    "Exemplo:\n" +
                    "ParatechUpdater.exe --app=gastro --version=1.0.0 --mode=dialog",
                    "Paratech Auto-Updater",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            // Consulta a API na nuvem
            try
            {
                string pcName = Environment.MachineName;
                string query = $"?sistema_id={Uri.EscapeDataString(sistemaId)}&versao_atual={Uri.EscapeDataString(versaoAtual)}&nome_computador={Uri.EscapeDataString(pcName)}&cnpj={Uri.EscapeDataString(cnpj)}&so=Windows";

                var response = http.GetAsync(BaseApiUrl + query).GetAwaiter().GetResult();
                if (!response.IsSuccessStatusCode) return;

                string json = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                var info = JsonSerializer.Deserialize<UpdateApiResponse>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (info == null || !info.tem_atualizacao)
                {
                    // Sem atualização: sai silenciosamente se for auto
                    if (modo == "dialog_verbose")
                    {
                        MessageBox.Show($"Você já está utilizando a versão mais recente do sistema ({versaoAtual}).", "Sistema Atualizado", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    return;
                }

                // Se houver atualização
                bool forcarAuto = info.obrigatoria || info.politica_efetiva == "automatica" || modo == "auto";

                if (forcarAuto)
                {
                    // Executa download silencioso
                    BaixarEExecutar(info, callerPid, silencioso: true);
                }
                else
                {
                    // Exibe diálogo com interface gráfica
                    Application.Run(new UpdateDialogForm(info, callerPid));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Erro no updater: {ex.Message}");
            }
        }

        public static void BaixarEExecutar(UpdateApiResponse info, int callerPid, bool silencioso)
        {
            if (string.IsNullOrEmpty(info.url_download)) return;

            try
            {
                string tempDir = Path.Combine(Path.GetTempPath(), "ParatechUpdates");
                Directory.CreateDirectory(tempDir);

                string destExe = Path.Combine(tempDir, $"Instalador_{info.sistema_id}_v{info.versao_mais_recente}.exe");

                using (var resp = http.GetAsync(info.url_download, HttpCompletionOption.ResponseHeadersRead).GetAwaiter().GetResult())
                {
                    resp.EnsureSuccessStatusCode();
                    using (var fs = new FileStream(destExe, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        resp.Content.CopyToAsync(fs).GetAwaiter().GetResult();
                    }
                }

                // Encerra o processo chamador se foi passado o PID
                if (callerPid > 0)
                {
                    try
                    {
                        var proc = Process.GetProcessById(callerPid);
                        proc?.Kill();
                    }
                    catch { }
                }

                // Executa instalador silencioso
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = destExe,
                    Arguments = "/SILENT /SUPPRESSMSGBOXES /FORCECLOSEAPPLICATIONS /RESTARTAPPLICATIONS",
                    UseShellExecute = true
                };

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                if (!silencioso)
                {
                    MessageBox.Show("Erro ao baixar atualização: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }
    }
}
