using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace HubParatechDesktop
{
    /// <summary>
    /// Serviço de controle de energia com fechamento forçado de aplicações abertas
    /// para garantir que o Windows nunca trave ou cancele o desligamento, reinício ou hibernação.
    /// </summary>
    public static class PowerControlService
    {
        public static void ForceCloseAppsAndExecute(string action, int seconds = 10, string reason = "Comando de energia solicitado pelo Hub Paratech")
        {
            Task.Run(async () =>
            {
                try
                {
                    Debug.WriteLine($"[PowerControlService] Iniciando rotina de força de fechamento antes de '{action}'...");

                    // 1. Pré-fechamento forçado de programas e processos de usuários comuns que bloqueiam desligamento
                    KillHangingUserProcesses();

                    await Task.Delay(1000);

                    // 2. Executa a ação de energia correspondente com flags de força (/f)
                    switch (action.ToLowerInvariant())
                    {
                        case "desligar":
                        case "desligar_pc":
                        case "shutdown":
                            // /s = shutdown, /f = force (força fechar todos apps sem aviso), /t = tempo em segundos
                            RunProcess("shutdown.exe", $"/s /f /t {seconds} /c \"{reason}\"");
                            break;

                        case "reiniciar":
                        case "reiniciar_pc":
                        case "restart":
                            // /r = restart, /f = force, /t = tempo
                            RunProcess("shutdown.exe", $"/r /f /t {seconds} /c \"{reason}\"");
                            break;

                        case "hibernar":
                        case "hibernar_pc":
                        case "hibernate":
                            // Garante que o suporte a hibernação está ativado no Windows
                            RunProcess("powercfg.exe", "-h on");
                            await Task.Delay(500);
                            // shutdown /h coloca o computador em hibernação profunda imediatamente
                            RunProcess("shutdown.exe", "/h");
                            break;

                        case "cancelar":
                        case "cancelar_desligamento":
                            RunProcess("shutdown.exe", "/a");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[PowerControlService] Erro ao executar {action}: {ex.Message}");
                }
            });
        }

        /// <summary>
        /// Encerra processos de aplicativos interativos comuns de usuário (navegadores, editores, planilhas)
        /// que costumam abrir caixas de diálogo tipo 'Deseja salvar as alterações?' impedindo o desligamento.
        /// </summary>
        public static void KillHangingUserProcesses()
        {
            try
            {
                string[] targets = {
                    "notepad", "wordpad", "winword", "excel", "powerpnt",
                    "calc", "chrome", "msedge", "firefox", "brave", "opera",
                    "AcroRd32", "Acrobat", "FoxitPDFReader"
                };

                foreach (var name in targets)
                {
                    try
                    {
                        var procs = Process.GetProcessesByName(name);
                        foreach (var p in procs)
                        {
                            try
                            {
                                p.Kill();
                            }
                            catch { }
                        }
                    }
                    catch { }
                }

                // Dispara taskkill forçado para processos com janelas não salvas na sessão do usuário
                try
                {
                    RunProcess("taskkill.exe", "/F /FI \"STATUS eq NOT RESPONDING\"");
                }
                catch { }
            }
            catch { }
        }

        private static void RunProcess(string filename, string arguments)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = filename,
                    Arguments = arguments,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                using var proc = Process.Start(psi);
                proc?.WaitForExit(4000);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[PowerControlService] Falha ao rodar {filename} {arguments}: {ex.Message}");
            }
        }
    }
}
