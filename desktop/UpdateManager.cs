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
        private static readonly HttpClient http = new HttpClient { Timeout = TimeSpan.FromSeconds(35) };
        private const string CheckApiUrl = "https://hub-paratech-web.vercel.app/api/hub/versoes/check";
        public const string VersaoAtual = "2.8.4";
        public const int BuildNumberAtual = 284;
        private static bool isUpdating = false;

        private static void LogUpdate(string message)
        {
            try
            {
                string tempDir = Path.Combine(Path.GetTempPath(), "ParatechUpdates");
                Directory.CreateDirectory(tempDir);
                string logFile = Path.Combine(tempDir, "update.log");
                string logLine = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}";
                File.AppendAllText(logFile, logLine);
                Debug.WriteLine($"[UpdateManager] {message}");
            }
            catch { }
        }

        public static async Task<ParatechUpdateInfo?> CheckForUpdatesAsync(string? token = null, bool isManualCheck = false, NotifyIcon? trayIcon = null, bool isForceUpdate = false)
        {
            if (isUpdating) return null;

            try
            {
                string pcName = Environment.MachineName;
                string query = $"?sistema_id=hub_desktop&versao_atual={VersaoAtual}&build_number={BuildNumberAtual}&nome_computador={Uri.EscapeDataString(pcName)}&so=Windows";
                
                if (!string.IsNullOrEmpty(token))
                {
                    query += $"&token={Uri.EscapeDataString(token)}";
                }

                LogUpdate($"Verificando novas versões em {CheckApiUrl}{query}...");

                var resp = await http.GetAsync(CheckApiUrl + query);
                if (!resp.IsSuccessStatusCode)
                {
                    LogUpdate($"Falha na consulta HTTP: {resp.StatusCode}");
                    if (isManualCheck)
                    {
                        ParatechDialog.ShowWarning($"Servidor de versões respondeu com código {(int)resp.StatusCode}.", "Aviso");
                    }
                    return null;
                }

                string json = await resp.Content.ReadAsStringAsync();
                var info = JsonSerializer.Deserialize<ParatechUpdateInfo>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (info != null && info.tem_atualizacao)
                {
                    LogUpdate($"Atualização encontrada! Versão mais recente: {info.versao_mais_recente} (Build {info.build_number_mais_recente}). Forçada: {isForceUpdate}, Obrigatória: {info.obrigatoria}, Política: {info.politica_efetiva}");

                    if (isForceUpdate || info.obrigatoria || info.politica_efetiva == "automatica")
                    {
                        // Atualização silenciosa imediata em background (disparada remotamente ou por política automática)
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
                                $"Nova versão {info.versao_mais_recente} do Hub Paratech disponível!\n\n" +
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
                else
                {
                    LogUpdate($"Sistema já está na versão mais recente ({VersaoAtual}).");
                    if (isManualCheck)
                    {
                        ParatechDialog.ShowInfo($"O Hub Paratech já está na versão mais recente ({VersaoAtual}).", "Hub Atualizado");
                    }
                }

                return info;
            }
            catch (Exception ex)
            {
                LogUpdate($"Exceção ao checar atualizações: {ex.Message}");
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

                string fileName = Path.GetFileName(new Uri(info.url_download).AbsolutePath);
                if (string.IsNullOrEmpty(fileName) || !fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                {
                    fileName = $"HubUpdate_{info.versao_mais_recente}.exe";
                }

                string downloadedFile = Path.Combine(tempDir, fileName);
                LogUpdate($"Iniciando download do pacote a partir de: {info.url_download} -> {downloadedFile}");

                // Download do novo binário com buffer
                using (var response = await http.GetAsync(info.url_download, HttpCompletionOption.ResponseHeadersRead))
                {
                    response.EnsureSuccessStatusCode();
                    using (var fs = new FileStream(downloadedFile, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        await response.Content.CopyToAsync(fs);
                    }
                }

                long downloadedSize = new FileInfo(downloadedFile).Length;
                LogUpdate($"Download concluído ({downloadedSize} bytes). Preparando substituição atômica...");

                string currentExePath = Application.ExecutablePath;
                string processName = Path.GetFileNameWithoutExtension(currentExePath);
                string updaterBat = Path.Combine(tempDir, "apply_hub_update.bat");
                string logPath = Path.Combine(tempDir, "update.log");

                bool isInstaller = fileName.IndexOf("setup", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                  fileName.IndexOf("instalador", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                  fileName.IndexOf("install", StringComparison.OrdinalIgnoreCase) >= 0;

                string batContent;
                if (isInstaller)
                {
                    // Se for Instalador Setup (InnoSetup, etc.), executa silencioso
                    batContent = $@"@echo off
chcp 65001 > nul
echo [%date% %time%] Aguardando encerramento do processo anterior... >> ""{logPath}""
taskkill /f /im {processName}.exe > nul 2>&1
timeout /t 2 /nobreak > nul
echo [%date% %time%] Executando instalador silencioso... >> ""{logPath}""
start /wait """" ""{downloadedFile}"" /SILENT /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
echo [%date% %time%] Instalador finalizado. Reiniciando aplicativo... >> ""{logPath}""
start """" ""{currentExePath}""
del ""{downloadedFile}"" > nul 2>&1
del ""%~f0"" > nul 2>&1
";
                }
                else
                {
                    // Se for binário direto .exe, substitui atômico com retry
                    batContent = $@"@echo off
chcp 65001 > nul
echo [%date% %time%] Aguardando encerramento de {processName}.exe... >> ""{logPath}""
taskkill /f /im {processName}.exe > nul 2>&1
timeout /t 2 /nobreak > nul
set RETRY_COUNT=0

:retry
set /a RETRY_COUNT+=1
copy /y ""{downloadedFile}"" ""{currentExePath}"" > nul
if errorlevel 1 (
    echo [%date% %time%] Tentativa %RETRY_COUNT% falhou. Tentando novamente em 1s... >> ""{logPath}""
    if %RETRY_COUNT% gtr 15 goto falha
    timeout /t 1 /nobreak > nul
    goto retry
)

echo [%date% %time%] Binario substituido com sucesso. Reiniciando... >> ""{logPath}""
start """" ""{currentExePath}""
del ""{downloadedFile}"" > nul 2>&1
del ""%~f0"" > nul 2>&1
exit

:falha
echo [%date% %time%] ERRO CRITICO: Nao foi possivel substituir o executavel apos 15 tentativas. >> ""{logPath}""
start """" ""{currentExePath}""
exit
";
                }

                File.WriteAllText(updaterBat, batContent);
                LogUpdate($"Script de aplicação gerado em {updaterBat}. Disparando e encerrando processo atual.");

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
                LogUpdate($"ERRO na aplicação da atualização: {ex.Message}");
                isUpdating = false;
            }
        }
    }
}
