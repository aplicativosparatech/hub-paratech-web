using System;
using System.Drawing;
using System.Windows.Forms;
using QRCoder;

namespace HubParatechDesktop
{
    public class NoticeWarningForm : Form
    {
        private static NoticeWarningForm? activeInstance = null;
        private static readonly object lockObj = new object();

        public static void ShowNotice(string pixPayload, decimal valor, string dataVencimento, string clienteNome, int diasRestantes, bool isTolerancia, int intervaloHoras, string? mensagemPersonalizada)
        {
            lock (lockObj)
            {
                if (activeInstance != null && !activeInstance.IsDisposed)
                {
                    try
                    {
                        if (activeInstance.InvokeRequired)
                        {
                            activeInstance.BeginInvoke(new Action(() => {
                                activeInstance.BringToFront();
                                activeInstance.Activate();
                            }));
                        }
                        else
                        {
                            activeInstance.BringToFront();
                            activeInstance.Activate();
                        }
                        return;
                    }
                    catch { }
                }

                activeInstance = new NoticeWarningForm(pixPayload, valor, dataVencimento, clienteNome, diasRestantes, isTolerancia, intervaloHoras, mensagemPersonalizada);
                activeInstance.Show();
            }
        }

        public NoticeWarningForm(string pixPayload, decimal valor, string dataVencimento, string clienteNome, int diasRestantes, bool isTolerancia, int intervaloHoras, string? mensagemPersonalizada)
        {
            Text = "Lembrete Preventivo de Mensalidade • Hub Paratech";
            Size = new Size(620, 610);
            MinimumSize = new Size(580, 560);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = true;
            TopMost = true;
            BackColor = Color.FromArgb(248, 250, 252); // slate-50

            try
            {
                Icon = AppResources.GetIcon();
            }
            catch { }

            FormClosed += (s, e) => {
                lock (lockObj) { activeInstance = null; }
            };

            // 1. Cabeçalho Superior Amigável
            var topHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 85,
                BackColor = isTolerancia ? Color.FromArgb(254, 243, 199) : Color.FromArgb(238, 242, 255), // amber-100 ou indigo-50
                Padding = new Padding(20, 12, 20, 12)
            };

            var headerBorder = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 1,
                BackColor = isTolerancia ? Color.FromArgb(252, 211, 77) : Color.FromArgb(199, 210, 254)
            };
            topHeader.Controls.Add(headerBorder);

            var pbLogo = new PictureBox
            {
                Size = new Size(130, 60),
                Location = new Point(20, 12),
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.Transparent
            };
            var logoImg = AppResources.GetLogo();
            if (logoImg != null) pbLogo.Image = logoImg;
            topHeader.Controls.Add(pbLogo);

            var lblHeaderTitle = new Label
            {
                Text = isTolerancia ? "⚠️ MENSALIDADE VENCIDA (EM TOLERÂNCIA)" : "🔔 LEMBRETE DE VENCIMENTO DA MENSALIDADE",
                Font = new Font("Segoe UI", 12f, FontStyle.Bold),
                ForeColor = isTolerancia ? Color.FromArgb(180, 83, 9) : Color.FromArgb(49, 46, 129), // amber-700 ou indigo-900
                Location = new Point(165, 18),
                AutoSize = true
            };
            topHeader.Controls.Add(lblHeaderTitle);

            string statusTxt = isTolerancia
                ? "Seu sistema continua liberado, mas regularize via Pix para evitar o bloqueio."
                : (diasRestantes == 0
                    ? "Sua fatura vence HOJE! Pague via Pix para manter o sistema ativo."
                    : (diasRestantes == 1
                        ? "Sua fatura vence AMANHÃ! Pague via Pix com tranquilidade."
                        : $"Sua fatura vence em {diasRestantes} dias. Evite imprevistos antecipando o Pix."));

            var lblHeaderSub = new Label
            {
                Text = statusTxt,
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = isTolerancia ? Color.FromArgb(146, 64, 14) : Color.FromArgb(79, 70, 229),
                Location = new Point(165, 46),
                AutoSize = true
            };
            topHeader.Controls.Add(lblHeaderSub);
            Controls.Add(topHeader);

            // 2. Painel Central com Informações da Fatura e Pix
            var contentPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(24, 16, 24, 16),
                BackColor = Color.White
            };

            // Card Resumo da Fatura
            var cardFatura = new Panel
            {
                Location = new Point(24, 12),
                Size = new Size(556, 74),
                BackColor = Color.FromArgb(248, 250, 252),
                BorderStyle = BorderStyle.FixedSingle
            };

            var lblEmpresa = new Label
            {
                Text = string.IsNullOrEmpty(clienteNome) ? "Cliente Paratech" : clienteNome,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(14, 12),
                AutoSize = true
            };
            cardFatura.Controls.Add(lblEmpresa);

            string dtFormatada = dataVencimento;
            if (DateTime.TryParse(dataVencimento, out DateTime dtV))
                dtFormatada = dtV.ToString("dd/MM/yyyy");

            var lblVenc = new Label
            {
                Text = $"Vencimento: {dtFormatada}",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(14, 40),
                AutoSize = true
            };
            cardFatura.Controls.Add(lblVenc);

            var lblVal = new Label
            {
                Text = valor > 0 ? $"R$ {valor:N2}" : "Consulte no Portal",
                Font = new Font("Segoe UI", 16f, FontStyle.Bold),
                ForeColor = isTolerancia ? Color.FromArgb(180, 83, 9) : Color.FromArgb(14, 116, 144),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(cardFatura.Width - 220, 20),
                Size = new Size(205, 34),
                TextAlign = ContentAlignment.MiddleRight
            };
            cardFatura.Controls.Add(lblVal);
            contentPanel.Controls.Add(cardFatura);

            // QR Code do PIX
            int qrTop = 96;
            var pbQr = new PictureBox
            {
                Size = new Size(160, 160),
                Location = new Point((contentPanel.Width - 160) / 2, qrTop),
                SizeMode = PictureBoxSizeMode.Zoom,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White
            };

            if (!string.IsNullOrEmpty(pixPayload) && !pixPayload.StartsWith("ERRO"))
            {
                try
                {
                    using (QRCodeGenerator qrGen = new QRCodeGenerator())
                    using (QRCodeData qrData = qrGen.CreateQrCode(pixPayload, QRCodeGenerator.ECCLevel.M))
                    using (PngByteQRCode qrCode = new PngByteQRCode(qrData))
                    {
                        byte[] qrBytes = qrCode.GetGraphic(20);
                        using (var ms = new System.IO.MemoryStream(qrBytes))
                        {
                            pbQr.Image = Image.FromStream(ms);
                        }
                    }
                }
                catch { }
            }
            contentPanel.Controls.Add(pbQr);

            // Botão Copiar Código Pix
            var btnCopyPix = new Button
            {
                Text = "⚡ Copiar Código PIX (Copia e Cola)",
                Size = new Size(300, 38),
                Location = new Point((contentPanel.Width - 300) / 2, qrTop + 172),
                BackColor = Color.FromArgb(14, 116, 144), // cyan-700
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnCopyPix.FlatAppearance.BorderSize = 0;
            btnCopyPix.Click += (s, e) => {
                if (!string.IsNullOrEmpty(pixPayload) && !pixPayload.StartsWith("ERRO"))
                {
                    try
                    {
                        Clipboard.SetText(pixPayload);
                        btnCopyPix.Text = "✓ Código PIX Copiado!";
                        btnCopyPix.BackColor = Color.FromArgb(16, 185, 129); // emerald-600
                        var timerReset = new System.Windows.Forms.Timer { Interval = 2500 };
                        timerReset.Tick += (st, et) => {
                            timerReset.Stop();
                            timerReset.Dispose();
                            if (!btnCopyPix.IsDisposed)
                            {
                                btnCopyPix.Text = "⚡ Copiar Código PIX (Copia e Cola)";
                                btnCopyPix.BackColor = Color.FromArgb(14, 116, 144);
                            }
                        };
                        timerReset.Start();
                        ParatechDialog.ShowSuccess("Código Pix Copia e Cola copiado para a Área de Transferência!\nAbra o aplicativo do seu banco e escolha 'Pix Copia e Cola'.", "Pix Copiado com Sucesso");
                    }
                    catch (Exception ex)
                    {
                        ParatechDialog.ShowError("Falha ao copiar: " + ex.Message, "Erro");
                    }
                }
                else
                {
                    ParatechDialog.ShowWarning("Código Pix indisponível no momento. Por favor acesse o Portal Paratech.", "Aviso");
                }
            };
            contentPanel.Controls.Add(btnCopyPix);

            // Mensagem explicativa ou personalizada
            string msgTexto = !string.IsNullOrWhiteSpace(mensagemPersonalizada)
                ? mensagemPersonalizada
                : "Seu sistema continua funcionando normalmente. Pague via Pix no seu banco para evitar interrupções.";

            var lblMensagem = new Label
            {
                Text = msgTexto,
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(24, qrTop + 220),
                Size = new Size(556, 36),
                TextAlign = ContentAlignment.MiddleCenter
            };
            contentPanel.Controls.Add(lblMensagem);
            Controls.Add(contentPanel);

            // 3. Rodapé com Botão de Dispensar e Continuar Trabalhando
            var bottomPanel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 80,
                BackColor = Color.FromArgb(248, 250, 252),
                Padding = new Padding(20, 12, 20, 12)
            };

            var bottomBorder = new Panel
            {
                Dock = DockStyle.Top,
                Height = 1,
                BackColor = Color.FromArgb(226, 232, 240)
            };
            bottomPanel.Controls.Add(bottomBorder);

            var btnEntendi = new Button
            {
                Text = "Continuar Trabalhando (Fechar Aviso)",
                Size = new Size(340, 42),
                Location = new Point((bottomPanel.Width - 340) / 2, 10),
                BackColor = Color.FromArgb(16, 185, 129), // emerald-600
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnEntendi.FlatAppearance.BorderSize = 0;
            btnEntendi.Click += (s, e) => Close();
            bottomPanel.Controls.Add(btnEntendi);

            var lblRecorrencia = new Label
            {
                Text = $"ℹ️ Este aviso será reapresentado a cada {intervaloHoras}h enquanto o sistema estiver aberto, até a baixa do pagamento.",
                Font = new Font("Segoe UI", 7.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(0, 56),
                Size = new Size(bottomPanel.Width, 18),
                TextAlign = ContentAlignment.MiddleCenter
            };
            bottomPanel.Controls.Add(lblRecorrencia);

            bottomPanel.Resize += (s, e) => {
                btnEntendi.Location = new Point((bottomPanel.Width - btnEntendi.Width) / 2, 10);
                lblRecorrencia.Size = new Size(bottomPanel.Width, 18);
            };

            Controls.Add(bottomPanel);
        }
    }
}
