using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class AboutForm : Form
    {
        public AboutForm(string? token = null, DateTime? lastSync = null, string? modo = "hub")
        {
            Text = "Sobre o Hub Paratech";
            Size = new Size(520, 560);
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

            int curY = 20;
            int formWidth = 520;

            // Logomarca Oficial da Paratech
            if (File.Exists("logo.png"))
            {
                var pbLogo = new PictureBox
                {
                    Image = Image.FromFile("logo.png"),
                    SizeMode = PictureBoxSizeMode.Zoom,
                    Size = new Size(320, 90),
                    Location = new Point((formWidth - 320) / 2, curY),
                    BackColor = Color.Transparent
                };
                Controls.Add(pbLogo);
                curY += 100;
            }

            // Título do Produto
            var lblTitle = new Label
            {
                Text = "Hub Paratech Desktop",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, curY),
                Size = new Size(formWidth, 32)
            };
            Controls.Add(lblTitle);
            curY += 34;

            // Versão Oficial
            var lblVersion = new Label
            {
                Text = "Versão v2.4.0 • Build Oficial Outubro/2026",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(14, 116, 144), // cyan-700
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(0, curY),
                Size = new Size(formWidth, 22)
            };
            Controls.Add(lblVersion);
            curY += 28;

            // Descrição breve
            var lblDesc = new Label
            {
                Text = "Módulo desktop de monitoramento fiscal, sincronização com o Portal Web\ne segurança automatizada para softwares de gestão comercial e contábil.",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                TextAlign = ContentAlignment.MiddleCenter,
                Location = new Point(20, curY),
                Size = new Size(formWidth - 40, 36)
            };
            Controls.Add(lblDesc);
            curY += 46;

            // Painel de Informações Oficiais e Links
            var infoCard = new Panel
            {
                Location = new Point(30, curY),
                Size = new Size(formWidth - 60, 190),
                BackColor = Color.FromArgb(248, 250, 252), // slate-50
                BorderStyle = BorderStyle.FixedSingle
            };

            int cardY = 14;

            // 1. Site da Paratech
            var lblSiteTitle = new Label
            {
                Text = "🌐 Site Oficial da Paratech:",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(16, cardY),
                AutoSize = true
            };
            var lnkSite = new LinkLabel
            {
                Text = "https://paratechsolucoes.com.br",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                LinkColor = Color.FromArgb(2, 132, 199),
                Location = new Point(210, cardY),
                AutoSize = true,
                Cursor = Cursors.Hand
            };
            lnkSite.LinkClicked += (s, e) => OpenUrl("https://paratechsolucoes.com.br");
            infoCard.Controls.Add(lblSiteTitle);
            infoCard.Controls.Add(lnkSite);
            cardY += 30;

            // 2. Endereço do Portal Web
            var lblPortalTitle = new Label
            {
                Text = "☁️ Endereço do Portal Web:",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(16, cardY),
                AutoSize = true
            };
            var lnkPortal = new LinkLabel
            {
                Text = "https://hub-paratech-web.vercel.app",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                LinkColor = Color.FromArgb(2, 132, 199),
                Location = new Point(210, cardY),
                AutoSize = true,
                Cursor = Cursors.Hand
            };
            lnkPortal.LinkClicked += (s, e) => OpenUrl("https://hub-paratech-web.vercel.app");
            infoCard.Controls.Add(lblPortalTitle);
            infoCard.Controls.Add(lnkPortal);
            cardY += 30;

            // 3. Suporte & WhatsApp
            var lblWhatsTitle = new Label
            {
                Text = "💬 Suporte & Atendimento:",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(16, cardY),
                AutoSize = true
            };
            var lnkWhats = new LinkLabel
            {
                Text = "(37) 92000-7857 (WhatsApp)",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                LinkColor = Color.FromArgb(16, 185, 129), // emerald-600
                Location = new Point(210, cardY),
                AutoSize = true,
                Cursor = Cursors.Hand
            };
            lnkWhats.LinkClicked += (s, e) => OpenUrl("https://wa.me/5537920007857?text=Olá%20Paratech,%20estou%20entrando%20em%20contato%20pelo%20HubParatech%20Desktop");
            infoCard.Controls.Add(lblWhatsTitle);
            infoCard.Controls.Add(lnkWhats);
            cardY += 30;

            // 4. Empresa Desenvolvedora
            var lblEmpresa = new Label
            {
                Text = "🏢 Desenvolvido por: Paratech Soluções & Sistemas",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(16, cardY),
                AutoSize = true
            };
            infoCard.Controls.Add(lblEmpresa);
            cardY += 26;

            // 5. Status do Token Local
            string tokenStatus = !string.IsNullOrWhiteSpace(token)
                ? (token.Length > 8 ? token.Substring(0, 4) + "••••" + token.Substring(token.Length - 4) : "Configurado")
                : "Não Configurado";

            var lblTokenStatus = new Label
            {
                Text = $"🔑 Token: {tokenStatus} | Modo: {modo?.ToUpper() ?? "HUB"} | Sincronização: {(lastSync.HasValue && lastSync.Value > DateTime.MinValue ? lastSync.Value.ToString("dd/MM/yyyy HH:mm") : "Pendente")}",
                Font = new Font("Segoe UI", 8f, FontStyle.Italic),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(16, cardY),
                AutoSize = true
            };
            infoCard.Controls.Add(lblTokenStatus);

            Controls.Add(infoCard);
            curY += 205;

            // Botão Fechar
            var btnClose = new Button
            {
                Text = "Fechar",
                DialogResult = DialogResult.OK,
                Size = new Size(130, 38),
                Location = new Point((formWidth - 130) / 2, curY),
                BackColor = Color.FromArgb(14, 116, 144), // cyan-700
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.Click += (s, e) => Close();
            Controls.Add(btnClose);
            AcceptButton = btnClose;
        }

        private static void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                ParatechDialog.ShowError("Não foi possível abrir o link: " + ex.Message, "Erro ao abrir link");
            }
        }
    }
}
