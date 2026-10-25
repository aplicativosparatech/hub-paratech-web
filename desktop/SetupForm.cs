using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class SetupForm : Form
    {
        private TextBox txtToken;
        private CheckBox chkModoOculto;
        private CheckBox chkAutoStart;
        private Button btnInstallSystem;
        private Button btnSave;
        private Button btnCancel;

        public SetupForm()
        {
            Text = "Configuração do Hub Paratech v2.6.0";
            Size = new Size(500, 480);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            TopMost = true;
            BackColor = Color.White;

            try
            {
                Icon = AppResources.GetIcon();
            }
            catch { }

            int curY = 16;
            int formWidth = 500;

            // Logomarca Paratech Oficial
            var logoImg = AppResources.GetLogo();
            if (logoImg != null)
            {
                var pbLogo = new PictureBox
                {
                    Image = logoImg,
                    SizeMode = PictureBoxSizeMode.Zoom,
                    Size = new Size(260, 70),
                    Location = new Point((formWidth - 260) / 2, curY),
                    BackColor = Color.Transparent
                };
                Controls.Add(pbLogo);
                curY += 76;

                // Separador
                var separator = new Panel
                {
                    Location = new Point(24, curY),
                    Size = new Size(formWidth - 48, 1),
                    BackColor = Color.FromArgb(226, 232, 240)
                };
                Controls.Add(separator);
                curY += 14;
            }

            var lblPrompt = new Label
            {
                Text = "Token de Autenticação do Cliente (Portal Paratech):",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(24, curY),
                AutoSize = true
            };
            Controls.Add(lblPrompt);
            curY += 24;

            var config = ConfigManager.Load();
            txtToken = new TextBox
            {
                Location = new Point(24, curY),
                Width = formWidth - 48,
                Font = new Font("Segoe UI", 10f, FontStyle.Regular),
                ForeColor = Color.FromArgb(15, 23, 42),
                Text = config.HubToken
            };
            Controls.Add(txtToken);
            curY += 34;

            var lnkPortal = new LinkLabel
            {
                Text = "Não sabe seu token? Acesse o Portal Paratech para copiar.",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                LinkColor = Color.FromArgb(2, 132, 199),
                Location = new Point(24, curY),
                AutoSize = true,
                Cursor = Cursors.Hand
            };
            lnkPortal.LinkClicked += (s, e) =>
            {
                try
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "https://hub-paratech-web.vercel.app/dashboard/clientes",
                        UseShellExecute = true
                    });
                }
                catch { }
            };
            Controls.Add(lnkPortal);
            curY += 28;

            // Opções de Segurança e Inicialização
            var grpSecurity = new Panel
            {
                Location = new Point(24, curY),
                Size = new Size(formWidth - 48, 120),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };

            chkAutoStart = new CheckBox
            {
                Text = "Iniciar automaticamente junto com o Windows (Protegido)",
                Checked = config.IniciarComWindows,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(12, 10),
                AutoSize = true
            };
            grpSecurity.Controls.Add(chkAutoStart);

            var lblAutoStartDesc = new Label
            {
                Text = "Configura o Registro e o Agendador de Tarefas do Windows para inicialização automática com privilégios.",
                Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(32, 32),
                Size = new Size(grpSecurity.Width - 40, 28)
            };
            grpSecurity.Controls.Add(lblAutoStartDesc);

            chkModoOculto = new CheckBox
            {
                Text = "Modo Oculto (Sem ícone na barra de tarefas / Invisível ao cliente)",
                Checked = config.ModoOculto,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(185, 28, 28), // red-700
                Location = new Point(12, 64),
                AutoSize = true
            };
            grpSecurity.Controls.Add(chkModoOculto);

            var lblModoOcultoDesc = new Label
            {
                Text = "O aplicativo roda 100% invisível em segundo plano. O cliente não pode fechar nem burlar os bloqueios.",
                Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(32, 86),
                Size = new Size(grpSecurity.Width - 40, 28)
            };
            grpSecurity.Controls.Add(lblModoOcultoDesc);

            Controls.Add(grpSecurity);
            curY += 130;

            // Botão Instalação do Sistema
            btnInstallSystem = new Button
            {
                Text = "🛡️ Instalar no Sistema (C:\\Paratech\\HubDesktop)",
                Size = new Size(formWidth - 48, 34),
                Location = new Point(24, curY),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(15, 23, 42),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnInstallSystem.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnInstallSystem.Click += BtnInstallSystem_Click;
            Controls.Add(btnInstallSystem);
            curY += 44;

            // Painel inferior com botões
            var bottomPanel = new Panel
            {
                Location = new Point(0, curY),
                Size = new Size(formWidth, 60),
                BackColor = Color.FromArgb(248, 250, 252)
            };

            var bottomBorder = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(formWidth, 1),
                BackColor = Color.FromArgb(226, 232, 240)
            };
            bottomPanel.Controls.Add(bottomBorder);

            var lblVersao = new Label
            {
                Text = "v2.6.0 Standalone",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(24, 20),
                AutoSize = true
            };
            bottomPanel.Controls.Add(lblVersao);

            btnSave = new Button
            {
                Text = "Salvar e Iniciar",
                Size = new Size(130, 36),
                Location = new Point(formWidth - 154, 12),
                BackColor = Color.FromArgb(14, 116, 144), // cyan-700
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnSave.FlatAppearance.BorderSize = 0;
            btnSave.Click += BtnSave_Click;
            bottomPanel.Controls.Add(btnSave);

            btnCancel = new Button
            {
                Text = "Cancelar",
                Size = new Size(90, 36),
                Location = new Point(formWidth - 254, 12),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(71, 85, 105),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnCancel.Click += (s, e) => Close();
            bottomPanel.Controls.Add(btnCancel);

            Controls.Add(bottomPanel);
            ClientSize = new Size(formWidth, curY + 60);

            AcceptButton = btnSave;
            CancelButton = btnCancel;
        }

        private void BtnInstallSystem_Click(object? sender, EventArgs e)
        {
            if (StartupManager.InstallToSystem(out string targetPath, out string err))
            {
                ParatechDialog.ShowSuccess($"Hub Paratech instalado com sucesso em:\n{targetPath}\n\nO executável foi copiado e configurado no Agendador de Tarefas e Registro do Windows para iniciar com o sistema.", "Instalação no Sistema Concluída");
            }
            else
            {
                ParatechDialog.ShowError($"Não foi possível copiar para {StartupManager.DefaultInstallDir}:\n{err}\n\nRecomenda-se executar o Hub Paratech como Administrador.", "Falha na Instalação");
            }
        }

        private void BtnSave_Click(object? sender, EventArgs e)
        {
            var config = ConfigManager.Load();
            config.HubToken = txtToken.Text.Trim();
            config.ModoOculto = chkModoOculto.Checked;
            config.IniciarComWindows = chkAutoStart.Checked;
            ConfigManager.Save(config);

            if (config.IniciarComWindows)
            {
                StartupManager.EnsurePersistentInstallation(config.ModoOculto);
            }
            else
            {
                StartupManager.DisableAutoStart();
            }

            ParatechDialog.ShowSuccess("Configurações salvas com sucesso!\nO Hub Paratech está ativo e monitorando este computador.", "Configuração Salva");
            Close();
        }
    }
}
