using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class SetupForm : Form
    {
        private TextBox txtToken;
        private Button btnSave;
        private Button btnCancel;

        public SetupForm()
        {
            Text = "Configuração do Hub Paratech v2.3.0";
            Size = new Size(460, 330);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            TopMost = true;
            BackColor = Color.White;

            try
            {
                if (File.Exists("icon.ico")) Icon = new Icon("icon.ico");
            }
            catch { }

            int curY = 16;
            int formWidth = 460;

            // Logomarca Paratech Oficial
            if (File.Exists("logo.png"))
            {
                var pbLogo = new PictureBox
                {
                    Image = Image.FromFile("logo.png"),
                    SizeMode = PictureBoxSizeMode.Zoom,
                    Size = new Size(260, 75),
                    Location = new Point((formWidth - 260) / 2, curY),
                    BackColor = Color.Transparent
                };
                Controls.Add(pbLogo);
                curY += 85;

                // Separador
                var separator = new Panel
                {
                    Location = new Point(24, curY),
                    Size = new Size(formWidth - 48, 1),
                    BackColor = Color.FromArgb(226, 232, 240)
                };
                Controls.Add(separator);
                curY += 16;
            }

            var lblPrompt = new Label
            {
                Text = "Informe o Token do Cliente (disponível no Portal Paratech):",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(24, curY),
                AutoSize = true
            };
            Controls.Add(lblPrompt);
            curY += 26;

            var config = ConfigManager.Load();
            txtToken = new TextBox
            {
                Location = new Point(24, curY),
                Width = formWidth - 48,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(15, 23, 42),
                Text = config.HubToken
            };
            Controls.Add(txtToken);
            curY += 38;

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
            curY += 32;

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
                Text = "v2.3.0",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(24, 20),
                AutoSize = true
            };
            bottomPanel.Controls.Add(lblVersao);

            btnSave = new Button
            {
                Text = "Salvar Token",
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

        private void BtnSave_Click(object? sender, EventArgs e)
        {
            var config = ConfigManager.Load();
            config.HubToken = txtToken.Text.Trim();
            ConfigManager.Save(config);

            ParatechDialog.ShowSuccess("Token configurado com sucesso!\nO Hub Paratech já iniciou o monitoramento e sincronização.", "Configuração Salva");
            Close();
        }
    }
}
