using System;
using System.Diagnostics;
using System.IO;

namespace Paratech.Updater
{
    public enum UpdateMode
    {
        Informativo, // Exibe diálogo se houver atualização
        Automatico   // Atualiza silenciosamente em background
    }

    public static class ParatechUpdater
    {
        /// <summary>
        /// Aciona o utilitário autônomo ParatechUpdater.exe
        /// </summary>
        /// <param name="sistemaId">Identificador do sistema no Hub (ex: 'gastro', 'tech_pro', 'mei_simples')</param>
        /// <param name="versaoAtual">Versão atual da aplicação (ex: '1.0.0')</param>
        /// <param name="modo">Informativo (pergunta ao usuário) ou Automático (silencioso)</param>
        /// <param name="cnpj">CNPJ opcional da empresa para política individual</param>
        public static void Executar(string sistemaId, string versaoAtual, UpdateMode modo = UpdateMode.Informativo, string? cnpj = null)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string updaterExe = Path.Combine(appDir, "ParatechUpdater.exe");

            if (!File.Exists(updaterExe))
            {
                updaterExe = Path.Combine(appDir, "..", "ParatechUpdater.exe");
                if (!File.Exists(updaterExe))
                {
                    updaterExe = @"C:\Program Files\Paratech\ParatechUpdater.exe";
                }
            }

            if (!File.Exists(updaterExe)) return;

            string modoStr = modo == UpdateMode.Automatico ? "auto" : "dialog";
            string args = $"--app={sistemaId} --version={versaoAtual} --mode={modoStr}";
            if (!string.IsNullOrWhiteSpace(cnpj))
            {
                args += $" --cnpj={cnpj.Trim()}";
            }

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = updaterExe,
                Arguments = args,
                UseShellExecute = true,
                WindowStyle = modo == UpdateMode.Automatico ? ProcessWindowStyle.Hidden : ProcessWindowStyle.Normal
            };

            Process.Start(psi);
        }
    }
}
