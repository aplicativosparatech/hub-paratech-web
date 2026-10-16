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

        public static bool EnableAutoStart(string? customExePath = null)
        {
            string exePath = customExePath ?? Application.ExecutablePath;
            bool success = false;

            // 1. Registro do Windows: CurrentUser (Inicialização no Logon do Usuário Atual)
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                if (key != null)
                {
                    key.SetValue(AppName, $"\"{exePath}\"");
                    success = true;
                }
            }
            catch { }

            // 2. Registro do Windows: LocalMachine (Para todos os usuários, se tiver permissão de Admin)
            if (IsAdmin())
            {
                try
                {
                    using var hklmKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                    hklmKey?.SetValue(AppName, $"\"{exePath}\"");
                }
                catch { }

                // 3. Agendador de Tarefas do Windows (Task Scheduler) com Privilégios Máximos (RL HIGHEST)
                // Isto impede que usuários comuns finalizem ou desativem no Gerenciador de Tarefas
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "schtasks.exe",
                        Arguments = $"/create /tn \"{TaskName}\" /tr \"\\\"{exePath}\\\" --stealth\" /sc onlogon /rl highest /f",
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
            installedPath = DefaultInstallExe;
            errorMessage = "";

            try
            {
                if (!Directory.Exists(DefaultInstallDir))
                {
                    Directory.CreateDirectory(DefaultInstallDir);
                }

                string currentExe = Application.ExecutablePath;
                if (!string.Equals(currentExe, DefaultInstallExe, StringComparison.OrdinalIgnoreCase))
                {
                    File.Copy(currentExe, DefaultInstallExe, true);
                }

                string currentDir = Application.StartupPath;
                string srcLogo = Path.Combine(currentDir, "logo.png");
                string dstLogo = Path.Combine(DefaultInstallDir, "logo.png");
                if (File.Exists(srcLogo) && !File.Exists(dstLogo))
                {
                    try { File.Copy(srcLogo, dstLogo, true); } catch { }
                }

                string srcIcon = Path.Combine(currentDir, "icon.ico");
                string dstIcon = Path.Combine(DefaultInstallDir, "icon.ico");
                if (File.Exists(srcIcon) && !File.Exists(dstIcon))
                {
                    try { File.Copy(srcIcon, dstIcon, true); } catch { }
                }

                // Configura inicialização no registro e agendador
                EnableAutoStart(DefaultInstallExe);

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
