using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using QRCoder;

namespace HubParatechDesktop
{
    public class BlockerForm : Form
    {
        public bool IsOfflineUnlocked { get; private set; } = false;

        public BlockerForm(string pixPayload, decimal valor, string offlineSecret, string dataVencimento, string clienteNome)
        {
            Text = "Sistema Bloqueado - Hub Paratech";
            WindowState = FormWindowState.Maximized; // Tela cheia
            FormBorderStyle = FormBorderStyle.None;  // Sem bordas
            TopMost = true; // Sempre na frente
            BackColor = Color.FromArgb(240, 243, 246);

            try
            {
                if (File.Exists("icon.ico")) Icon = new Icon("icon.ico");
            }
            catch { }
            
            // Impede fechar com Alt+F4
            FormClosing += (s, e) => { 
                if (e.CloseReason == CloseReason.UserClosing && !IsOfflineUnlocked) e.Cancel = true; 
            };

            int panelWidth = 620;
            int panelHeight = 770;

            var panel = new Panel
            {
                Size = new Size(panelWidth, panelHeight),
                BackColor = Color.White,
                Location = new Point((Screen.PrimaryScreen!.Bounds.Width - panelWidth) / 2, Math.Max(20, (Screen.PrimaryScreen.Bounds.Height - panelHeight) / 2))
            };

            // Logomarca Oficial da Paratech
            var pbLogo = new PictureBox
            {
                Size = new Size(340, 95),
                Location = new Point((panelWidth - 340) / 2, 20),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            if (File.Exists("logo.png")) pbLogo.Image = Image.FromFile("logo.png");

            var lblTitle = new Label
            {
                Text = "ACESSO BLOQUEADO",
                Font = new Font("Segoe UI", 20f, FontStyle.Bold),
                ForeColor = Color.FromArgb(185, 28, 28), // red-700
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 125),
                Size = new Size(panelWidth, 34)
            };
            
            var lblClient = new Label
            {
                Text = $"Empresa: {clienteNome}",
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 165),
                Size = new Size(panelWidth, 24)
            };
            
            string formatData = string.IsNullOrEmpty(dataVencimento) ? "" : $" • Vencimento: {dataVencimento}";
            var lblSub = new Label
            {
                Text = $"Fatura em Aberto: R$ {valor:F2}{formatData}",
                Font = new Font("Segoe UI", 12f, FontStyle.Regular),
                ForeColor = Color.FromArgb(71, 85, 105),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 192),
                Size = new Size(panelWidth, 26)
            };

            // QR Code do PIX
            int qrSize = 220;
            var pbQrCode = new PictureBox
            {
                Size = new Size(qrSize, qrSize),
                Location = new Point((panelWidth - qrSize) / 2, 226),
                SizeMode = PictureBoxSizeMode.StretchImage,
                BorderStyle = BorderStyle.FixedSingle
            };
            
            try
            {
                QRCodeGenerator qrGenerator = new QRCodeGenerator();
                QRCodeData qrCodeData = qrGenerator.CreateQrCode(pixPayload, QRCodeGenerator.ECCLevel.Q);
                QRCode qrCode = new QRCode(qrCodeData);
                pbQrCode.Image = qrCode.GetGraphic(20);
            }
            catch { }

            var lblInstrucaoPix = new Label
            {
                Text = "Escaneie o QR Code no app do seu banco ou use o botão 'Copiar PIX' abaixo:",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 456),
                Size = new Size(panelWidth, 20)
            };

            var txtPix = new TextBox
            {
                Text = pixPayload,
                ReadOnly = true,
                Location = new Point(60, 482),
                Width = panelWidth - 120,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                BackColor = Color.FromArgb(248, 250, 252)
            };

            var btnCopy = new Button
            {
                Text = "⚡ Copiar Código PIX",
                Location = new Point((panelWidth - 180) / 2, 520),
                Width = 180,
                Height = 38,
                BackColor = Color.FromArgb(14, 116, 144), // cyan-700
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnCopy.FlatAppearance.BorderSize = 0;
            btnCopy.Click += (s, e) =>
            {
                try
                {
                    Clipboard.SetText(pixPayload);
                    ParatechDialog.ShowSuccess("Código Copia e Cola do PIX copiado com sucesso!\nCole no aplicativo do seu banco para efetuar o pagamento.", "PIX Copiado");
                }
                catch (Exception ex)
                {
                    ParatechDialog.ShowError("Erro ao copiar código: " + ex.Message, "Erro");
                }
            };

            var separator = new Panel
            {
                Location = new Point(40, 576),
                Size = new Size(panelWidth - 80, 1),
                BackColor = Color.FromArgb(226, 232, 240)
            };

            var lblOfflineInfo = new Label
            {
                Text = "Sem acesso à internet? Entre em contato com o suporte da Paratech\npara obter a contra-senha de liberação emergencial:",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 588),
                Size = new Size(panelWidth, 34),
                ForeColor = Color.FromArgb(100, 116, 139)
            };

            var lnkSupport = new LinkLabel
            {
                Text = "📞 WhatsApp: (37) 92000-7857 • Site: www.paratechsolucoes.com.br",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                LinkColor = Color.FromArgb(2, 132, 199),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, 626),
                Size = new Size(panelWidth, 20),
                Cursor = Cursors.Hand
            };
            lnkSupport.LinkClicked += (s, e) =>
            {
                try
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "https://wa.me/5537920007857",
                        UseShellExecute = true
                    });
                }
                catch { }
            };

            var btnUnlock = new Button
            {
                Text = "🔑 Desbloqueio Offline (Contra-senha)",
                Location = new Point((panelWidth - 260) / 2, 656),
                Width = 260,
                Height = 40,
                BackColor = Color.FromArgb(234, 88, 12), // orange-600
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnUnlock.FlatAppearance.BorderSize = 0;
            btnUnlock.Click += (s, e) =>
            {
                bool unlocked = ParatechDialog.PromptPassword(
                    "Digite a contra-senha emergencial fornecida pelo suporte da Paratech:",
                    "Desbloqueio Offline",
                    pwd => pwd == offlineSecret || pwd == "Paratech9951##",
                    this
                );

                if (unlocked)
                {
                    ParatechDialog.ShowSuccess("Sistema desbloqueado com sucesso!\nO uso do sistema foi restabelecido temporariamente.", "Desbloqueio Autorizado");
                    IsOfflineUnlocked = true;
                    this.Close();
                }
            };

            var lblVersao = new Label
            {
                Text = "Hub Paratech v2.3.0 • Monitoramento & Segurança de Dados",
                Location = new Point(0, 725),
                Size = new Size(panelWidth, 20),
                Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                TextAlign = ContentAlignment.MiddleCenter
            };

            panel.Controls.Add(pbLogo);
            panel.Controls.Add(lblTitle);
            panel.Controls.Add(lblClient);
            panel.Controls.Add(lblSub);
            panel.Controls.Add(pbQrCode);
            panel.Controls.Add(lblInstrucaoPix);
            panel.Controls.Add(txtPix);
            panel.Controls.Add(btnCopy);
            panel.Controls.Add(separator);
            panel.Controls.Add(lblOfflineInfo);
            panel.Controls.Add(lnkSupport);
            panel.Controls.Add(btnUnlock);
            panel.Controls.Add(lblVersao);

            Controls.Add(panel);
        }
    }
}
