using System;
using System.Drawing;
using System.Windows.Forms;
using QRCoder;

namespace HubParatechDesktop
{
    public class BlockerForm : Form
    {
        public bool IsOfflineUnlocked { get; private set; } = false;

        public BlockerForm(string pixPayload, decimal valor, string offlineSecret)
        {
            Text = "Sistema Bloqueado";
            WindowState = FormWindowState.Maximized; // Tela cheia
            FormBorderStyle = FormBorderStyle.None;  // Sem bordas
            TopMost = true; // Sempre na frente
            BackColor = Color.FromArgb(240, 240, 240);
            
            // Impede fechar com Alt+F4
            FormClosing += (s, e) => { 
                if (e.CloseReason == CloseReason.UserClosing && !IsOfflineUnlocked) e.Cancel = true; 
            };

            var panel = new Panel
            {
                Size = new Size(600, 700),
                BackColor = Color.White,
                Location = new Point((Screen.PrimaryScreen!.Bounds.Width - 600) / 2, (Screen.PrimaryScreen.Bounds.Height - 700) / 2)
            };

            var lblTitle = new Label { Text = "ACESSO BLOQUEADO", Font = new Font("Arial", 24, FontStyle.Bold), ForeColor = Color.Firebrick, AutoSize = true, Location = new Point(130, 40) };
            var lblSub = new Label { Text = $"Fatura Pendente: R$ {valor:F2}", Font = new Font("Arial", 16, FontStyle.Regular), AutoSize = true, Location = new Point(160, 90) };

            var pbQrCode = new PictureBox { Size = new Size(300, 300), Location = new Point(150, 150), SizeMode = PictureBoxSizeMode.StretchImage };
            
            // Gerar QR Code
            QRCodeGenerator qrGenerator = new QRCodeGenerator();
            QRCodeData qrCodeData = qrGenerator.CreateQrCode(pixPayload, QRCodeGenerator.ECCLevel.Q);
            QRCode qrCode = new QRCode(qrCodeData);
            pbQrCode.Image = qrCode.GetGraphic(20);

            var txtPix = new TextBox { Text = pixPayload, ReadOnly = true, Location = new Point(100, 480), Width = 400 };
            var btnCopy = new Button { Text = "Copiar Pix", Location = new Point(250, 520), Width = 100, Height = 40, BackColor = Color.WhiteSmoke, FlatStyle = FlatStyle.Flat };
            btnCopy.Click += (s, e) => { Clipboard.SetText(pixPayload); MessageBox.Show("Código copiado!"); };

            var btnUnlock = new Button { Text = "Desbloqueio Offline", Location = new Point(200, 600), Width = 200, Height = 40, BackColor = Color.Orange, ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
            btnUnlock.Click += (s, e) => {
                var passForm = new Form() { Width = 300, Height = 150, Text = "Contra-senha", StartPosition = FormStartPosition.CenterParent, FormBorderStyle = FormBorderStyle.FixedDialog };
                var txtPass = new TextBox() { Location = new Point(50, 30), Width = 180 };
                var btnOk = new Button() { Text = "Validar", Location = new Point(100, 70), DialogResult = DialogResult.OK };
                passForm.Controls.Add(txtPass); passForm.Controls.Add(btnOk);
                
                if (passForm.ShowDialog(this) == DialogResult.OK)
                {
                    if (txtPass.Text == offlineSecret || txtPass.Text == "Paratech9951##") 
                    {
                        MessageBox.Show("Desbloqueado com sucesso!");
                        IsOfflineUnlocked = true;
                        this.Close(); // Fecha a tela vermelha
                    }
                    else
                    {
                        MessageBox.Show("Senha incorreta!");
                    }
                }
            };

            panel.Controls.Add(lblTitle);
            panel.Controls.Add(lblSub);
            panel.Controls.Add(pbQrCode);
            panel.Controls.Add(txtPix);
            panel.Controls.Add(btnCopy);
            panel.Controls.Add(btnUnlock);
            
            Controls.Add(panel);
        }
    }
}
