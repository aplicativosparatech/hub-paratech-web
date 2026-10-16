using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HubParatechDesktop
{
    public static class StartupManager
    {
        public const string AppName = "HubParatech";
        public const string TaskName = "HubParatechMonitor";
        public const string DefaultInstallDir = @"C:\Paratech\HubDesktop";
        public const string DefaultInstallExe = @"C:\Paratech\HubDesktop\HubParatechDesktop.exe";

        public static bool IsAdmin()
        {
            try
            {
                using var identity = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }

        public static string GetTargetInstallDir()
        {
            if (IsAdmin())
            {
                return DefaultInstallDir;
            }
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Paratech", "HubDesktop");
        }

        public static string GetTargetInstallExe()
        {
            return Path.Combine(GetTargetInstallDir(), "HubParatechDesktop.exe");
        }

        public static bool EnsurePersistentInstallation(bool stealth = true)
        {
            try
            {
                string targetDir = GetTargetInstallDir();
                string targetExe = GetTargetInstallExe();
                string currentExe = Application.ExecutablePath;

                // 1. Garante que o diretório alvo existe
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                // 2. Se o processo atual NÃO está rodando do diretório instalado oficial (ex: rodou de Downloads, PenDrive, Desktop)
                if (!string.Equals(currentExe, targetExe, StringComparison.OrdinalIgnoreCase))
                {
                    // Copia o executável principal para a pasta fixa protegida
                    File.Copy(currentExe, targetExe, true);

                    // Copia recursos adjacentes (logo, ícone)
                    string currentDir = Application.StartupPath;
                    string srcLogo = Path.Combine(currentDir, "logo.png");
                    string dstLogo = Path.Combine(targetDir, "logo.png");
                    if (File.Exists(srcLogo)) try { File.Copy(srcLogo, dstLogo, true); } catch { }

                    string srcIcon = Path.Combine(currentDir, "icon.ico");
                    string dstIcon = Path.Combine(targetDir, "icon.ico");
                    if (File.Exists(srcIcon)) try { File.Copy(srcIcon, dstIcon, true); } catch { }

                    // Registra inicialização automática apontando para o targetExe oficial
                    EnableAutoStart(targetExe, stealth);

                    // Inicia o processo definitivo e encerra a instância temporária
                    var psi = new ProcessStartInfo
                    {
                        FileName = targetExe,
                        Arguments = stealth ? "--stealth" : "",
                        UseShellExecute = true,
                        WorkingDirectory = targetDir
                    };
                    Process.Start(psi);
                    Environment.Exit(0);
                    return true;
                }

                // 3. Se já está rodando do diretório oficial, garante o registro ativo no Windows
                EnableAutoStart(targetExe, stealth);
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Falha na persistência automática: {ex.Message}");
                return false;
            }
        }

        public static bool EnableAutoStart(string? customExePath = null, bool stealth = true)
        {
            string exePath = customExePath ?? GetTargetInstallExe();
            string command = stealth ? $"\"{exePath}\" --stealth" : $"\"{exePath}\"";
            bool success = false;

            // 1. Registro do Windows: CurrentUser (Inicialização no Logon do Usuário Atual)
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                if (key != null)
                {
                    key.SetValue(AppName, command);
                    success = true;
                }
            }
            catch { }

            // 2. Registro do Windows: LocalMachine (Para todos os usuários se tiver permissão de Admin)
            if (IsAdmin())
            {
                try
                {
                    using var hklmKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                    hklmKey?.SetValue(AppName, command);
                }
                catch { }

                // 3. Agendador de Tarefas do Windows (Task Scheduler) com Privilégios Máximos (RL HIGHEST)
                // Isto impede que usuários comuns finalizem ou desativem no Gerenciador de Tarefas
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "schtasks.exe",
                        Arguments = $"/create /tn \"{TaskName}\" /tr \"\\\"{exePath}\\\" {(stealth ? "--stealth" : "")}\" /sc onlogon /rl highest /f",
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    using var proc = Process.Start(psi);
                    proc?.WaitForExit(3000);
                }
                catch { }
            }

            return success;
        }

        public static bool DisableAutoStart()
        {
            bool ok = false;
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                key?.DeleteValue(AppName, false);
                ok = true;
            }
            catch { }

            if (IsAdmin())
            {
                try
                {
                    using var hklmKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                    hklmKey?.DeleteValue(AppName, false);
                }
                catch { }

                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "schtasks.exe",
                        Arguments = $"/delete /tn \"{TaskName}\" /f",
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    using var proc = Process.Start(psi);
                    proc?.WaitForExit(3000);
                }
                catch { }
            }

            return ok;
        }

        public static bool IsAutoStartConfigured()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", false);
                var val = key?.GetValue(AppName);
                if (val != null) return true;
            }
            catch { }

            try
            {
                using var hklmKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", false);
                var valHklm = hklmKey?.GetValue(AppName);
                if (valHklm != null) return true;
            }
            catch { }

            return false;
        }

        public static bool InstallToSystem(out string installedPath, out string errorMessage)
        {
            installedPath = GetTargetInstallExe();
            string targetDir = GetTargetInstallDir();
            errorMessage = "";

            try
            {
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                string currentExe = Application.ExecutablePath;
                if (!string.Equals(currentExe, installedPath, StringComparison.OrdinalIgnoreCase))
                {
                    File.Copy(currentExe, installedPath, true);
                }

                string currentDir = Application.StartupPath;
                string srcLogo = Path.Combine(currentDir, "logo.png");
                string dstLogo = Path.Combine(targetDir, "logo.png");
                if (File.Exists(srcLogo) && !File.Exists(dstLogo))
                {
                    try { File.Copy(srcLogo, dstLogo, true); } catch { }
                }

                string srcIcon = Path.Combine(currentDir, "icon.ico");
                string dstIcon = Path.Combine(targetDir, "icon.ico");
                if (File.Exists(srcIcon) && !File.Exists(dstIcon))
                {
                    try { File.Copy(srcIcon, dstIcon, true); } catch { }
                }

                // Configura inicialização no registro e agendador
                EnableAutoStart(installedPath, true);

                return true;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }
    }
}
