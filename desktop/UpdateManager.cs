using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class ParatechUpdateInfo
    {
        public bool tem_atualizacao { get; set; }
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

    public static class UpdateManager
    {
        private static readonly HttpClient http = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
        private const string CheckApiUrl = "https://hub-paratech-web.vercel.app/api/hub/versoes/check";
        private const string VersaoAtual = "2.6.0";
        private const int BuildNumberAtual = 260;
        private static bool isUpdating = false;

        public static async Task<ParatechUpdateInfo?> CheckForUpdatesAsync(string? token = null, bool isManualCheck = false, NotifyIcon? trayIcon = null)
        {
            if (isUpdating) return null;

            try
            {
                string pcName = Environment.MachineName;
                string query = $"?sistema_id=hub_desktop&versao_atual={VersaoAtual}&build_number={BuildNumberAtual}&nome_computador={Uri.EscapeDataString(pcName)}&so=Windows";
                
                var resp = await http.GetAsync(CheckApiUrl + query);
                if (!resp.IsSuccessStatusCode) return null;

                string json = await resp.Content.ReadAsStringAsync();
                var info = JsonSerializer.Deserialize<ParatechUpdateInfo>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (info != null && info.tem_atualizacao)
                {
                    if (info.obrigatoria || info.politica_efetiva == "automatica")
                    {
                        // Atualização silenciosa em background
                        _ = PerformSilentUpdateAsync(info);
                    }
                    else
                    {
                        // Notificação informativa na bandeja
                        if (trayIcon != null)
                        {
                            trayIcon.ShowBalloonTip(
                                8000,
                                "🚀 Nova Versão do Hub Paratech",
                                $"Versão {info.versao_mais_recente} disponível!\nClique aqui para atualizar.",
                                ToolTipIcon.Info
                            );
                        }

                        if (isManualCheck)
                        {
                            var result = MessageBox.Show(
                                $"Nova versão {info.versao_mais_recente} disponível!\n\n" +
                                $"Novidades:\n{info.changelog ?? "• Melhorias gerais de sincronização e segurança."}\n\n" +
                                $"Deseja atualizar agora?",
                                "Atualização do Hub Paratech",
                                MessageBoxButtons.YesNo,
                                MessageBoxIcon.Information
                            );

                            if (result == DialogResult.Yes)
                            {
                                _ = PerformSilentUpdateAsync(info);
                            }
                        }
                    }
                }
                else if (isManualCheck)
                {
                    ParatechDialog.ShowInfo($"O Hub Paratech já está na versão mais recente ({VersaoAtual}).", "Hub Atualizado");
                }

                return info;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[UpdateManager] Erro ao checar atualizações: {ex.Message}");
                if (isManualCheck)
                {
                    ParatechDialog.ShowWarning($"Não foi possível checar atualizações no momento.\n{ex.Message}", "Aviso de Conexão");
                }
                return null;
            }
        }

        public static async Task PerformSilentUpdateAsync(ParatechUpdateInfo info)
        {
            if (isUpdating || string.IsNullOrEmpty(info.url_download)) return;
            isUpdating = true;

            try
            {
                string tempDir = Path.Combine(Path.GetTempPath(), "ParatechUpdates");
                Directory.CreateDirectory(tempDir);

                string downloadedFile = Path.Combine(tempDir, $"HubUpdate_{info.versao_mais_recente}.exe");
                
                // Download do novo binário
                using (var response = await http.GetAsync(info.url_download, HttpCompletionOption.ResponseHeadersRead))
                {
                    response.EnsureSuccessStatusCode();
                    using (var fs = new FileStream(downloadedFile, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        await response.Content.CopyToAsync(fs);
                    }
                }

                string currentExePath = Application.ExecutablePath;
                string updaterBat = Path.Combine(tempDir, "apply_hub_update.bat");

                // Gera script de substituição atômica:
                // Aguarda o processo atual encerrar, substitui o .exe e reabre
                string batContent = $@"@echo off
timeout /t 2 /nobreak > nul
:retry
copy /y ""{downloadedFile}"" ""{currentExePath}"" > nul
if errorlevel 1 (
    timeout /t 1 /nobreak > nul
    goto retry
)
start """" ""{currentExePath}""
del ""{downloadedFile}"" > nul 2>&1
del ""%~f0"" > nul 2>&1
";
                File.WriteAllText(updaterBat, batContent);

                // Executa o script e encerra o app atual
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c \"{updaterBat}\"",
                    WindowStyle = ProcessWindowStyle.Hidden,
                    CreateNoWindow = true,
                    UseShellExecute = true
                };

                Process.Start(psi);
                Application.Exit();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[UpdateManager] Erro na aplicação da atualização: {ex.Message}");
                isUpdating = false;
            }
        }
    }
}
