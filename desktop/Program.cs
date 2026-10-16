using System;
using System.Windows.Forms;

namespace HubParatechDesktop;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        bool forceStealth = false;
        bool isSetup = false;
        bool isInstall = false;
        bool isUninstall = false;

        foreach (var arg in args)
        {
            var lower = arg.Trim().ToLowerInvariant();
            if (lower == "--stealth" || lower == "--oculto" || lower == "--silent") forceStealth = true;
            if (lower == "--setup" || lower == "--config") isSetup = true;
            if (lower == "--install") isInstall = true;
            if (lower == "--uninstall") isUninstall = true;
        }

        if (isUninstall)
        {
            StartupManager.DisableAutoStart();
            ParatechDialog.ShowInfo("Hub Paratech foi desvinculado da inicialização do Windows.", "Hub Paratech");
            return;
        }

        if (isInstall)
        {
            if (StartupManager.InstallToSystem(out string targetExe, out string err))
            {
                ParatechDialog.ShowSuccess($"Hub Paratech instalado com sucesso em:\n{targetExe}\n\nO monitoramento foi registrado para iniciar com o Windows em modo protegido.", "Instalação Concluída");
            }
            else
            {
                ParatechDialog.ShowError($"Falha na instalação automática: {err}\nExecute como Administrador.", "Hub Paratech");
            }
            return;
        }

        if (isSetup)
        {
            Application.Run(new SetupForm());
            return;
        }

        // Se o token nunca foi configurado, abre a tela de setup primeiro para o técnico
        var config = ConfigManager.Load();
        if (string.IsNullOrWhiteSpace(config.HubToken))
        {
            var setup = new SetupForm();
            if (setup.ShowDialog() != DialogResult.OK)
            {
                // Recarrega apos fechar o setup
                config = ConfigManager.Load();
            }
        }

        // Executa o contexto da bandeja ou modo oculto
        Application.Run(new TrayContext(forceStealth));
    }
}