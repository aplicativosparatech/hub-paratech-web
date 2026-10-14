using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class ParatechDialog : Form
    {
        private static Image? cachedLogo = null;

        private static Image? GetLogo()
        {
            if (cachedLogo != null) return cachedLogo;
            try
            {
                if (File.Exists("logo.png"))
                {
                    cachedLogo = Image.FromFile("logo.png");
                    return cachedLogo;
                }
            }
            catch { }
            return null;
        }

        public ParatechDialog(string message, string title, MessageBoxButtons buttons = MessageBoxButtons.OK, MessageBoxIcon icon = MessageBoxIcon.Information)
        {
            Text = title;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            TopMost = true;
            BackColor = Color.White;
            ShowInTaskbar = true;

            try
            {
                if (File.Exists("icon.ico"))
                {
                    Icon = new Icon("icon.ico");
                }
            }
            catch { }

            int formWidth = 460;
            int currentY = 16;

            // Painel Superior com Logomarca Paratech
            var logo = GetLogo();
            if (logo != null)
            {
                var pbLogo = new PictureBox
                {
                    Image = logo,
                    SizeMode = PictureBoxSizeMode.Zoom,
                    Size = new Size(280, 75),
                    Location = new Point((formWidth - 280) / 2, currentY),
                    BackColor = Color.Transparent
                };
                Controls.Add(pbLogo);
                currentY += 85;

                // Linha divisória sutil
                var separator = new Panel
                {
                    Location = new Point(24, currentY),
                    Size = new Size(formWidth - 48, 1),
                    BackColor = Color.FromArgb(230, 235, 242)
                };
                Controls.Add(separator);
                currentY += 16;
            }

            // Ícone da mensagem (se aplicável)
            int textLeft = 24;
            int textWidth = formWidth - 48;

            // Caixa de texto da mensagem com formatação limpa
            var lblMessage = new Label
            {
                Text = message,
                Font = new Font("Segoe UI", 9.75f, FontStyle.Regular),
                ForeColor = Color.FromArgb(30, 41, 59), // slate-800
                Location = new Point(textLeft, currentY),
                Width = textWidth,
                AutoSize = true,
                MaximumSize = new Size(textWidth, 400)
            };
            Controls.Add(lblMessage);

            // Ajusta a posição Y com base no tamanho do texto
            currentY += Math.Max(lblMessage.PreferredHeight, 30) + 24;

            // Barra inferior de botões
            var bottomPanel = new Panel
            {
                Location = new Point(0, currentY),
                Size = new Size(formWidth, 60),
                BackColor = Color.FromArgb(248, 250, 252) // slate-50
            };

            var bottomBorder = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(formWidth, 1),
                BackColor = Color.FromArgb(226, 232, 240) // slate-200
            };
            bottomPanel.Controls.Add(bottomBorder);

            if (buttons == MessageBoxButtons.OK)
            {
                var btnOk = new Button
                {
                    Text = "OK",
                    DialogResult = DialogResult.OK,
                    Size = new Size(110, 36),
                    Location = new Point((formWidth - 110) / 2, 12),
                    BackColor = Color.FromArgb(14, 116, 144), // cyan-700
                    ForeColor = Color.White,
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                    FlatStyle = FlatStyle.Flat,
                    Cursor = Cursors.Hand
                };
                btnOk.FlatAppearance.BorderSize = 0;
                bottomPanel.Controls.Add(btnOk);
                AcceptButton = btnOk;
            }
            else if (buttons == MessageBoxButtons.OKCancel || buttons == MessageBoxButtons.YesNo)
            {
                var btnPrimary = new Button
                {
                    Text = buttons == MessageBoxButtons.YesNo ? "Sim" : "OK",
                    DialogResult = buttons == MessageBoxButtons.YesNo ? DialogResult.Yes : DialogResult.OK,
                    Size = new Size(100, 36),
                    Location = new Point(formWidth - 230, 12),
                    BackColor = Color.FromArgb(14, 116, 144),
                    ForeColor = Color.White,
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                    FlatStyle = FlatStyle.Flat,
                    Cursor = Cursors.Hand
                };
                btnPrimary.FlatAppearance.BorderSize = 0;

                var btnSecondary = new Button
                {
                    Text = buttons == MessageBoxButtons.YesNo ? "Não" : "Cancelar",
                    DialogResult = buttons == MessageBoxButtons.YesNo ? DialogResult.No : DialogResult.Cancel,
                    Size = new Size(100, 36),
                    Location = new Point(formWidth - 120, 12),
                    BackColor = Color.FromArgb(241, 245, 249),
                    ForeColor = Color.FromArgb(71, 85, 105),
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                    FlatStyle = FlatStyle.Flat,
                    Cursor = Cursors.Hand
                };
                btnSecondary.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);

                bottomPanel.Controls.Add(btnPrimary);
                bottomPanel.Controls.Add(btnSecondary);
                AcceptButton = btnPrimary;
                CancelButton = btnSecondary;
            }

            Controls.Add(bottomPanel);
            ClientSize = new Size(formWidth, currentY + 60);
        }

        public static DialogResult Show(string message, string title = "Hub Paratech", MessageBoxButtons buttons = MessageBoxButtons.OK, MessageBoxIcon icon = MessageBoxIcon.Information)
        {
            using var dlg = new ParatechDialog(message, title, buttons, icon);
            return dlg.ShowDialog();
        }

        public static DialogResult ShowInfo(string message, string title = "Hub Paratech - Informação")
        {
            return Show(message, title, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        public static DialogResult ShowSuccess(string message, string title = "Hub Paratech - Sucesso")
        {
            return Show(message, title, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        public static DialogResult ShowWarning(string message, string title = "Hub Paratech - Atenção")
        {
            return Show(message, title, MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        public static DialogResult ShowError(string message, string title = "Hub Paratech - Erro")
        {
            return Show(message, title, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }

        public static bool PromptPassword(string prompt, string title, Func<string, bool> validator, Form? parent = null)
        {
            using var form = new Form
            {
                Text = title,
                StartPosition = FormStartPosition.CenterScreen,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                TopMost = true,
                BackColor = Color.White,
                Width = 420,
                Height = 310
            };

            try
            {
                if (File.Exists("icon.ico")) form.Icon = new Icon("icon.ico");
            }
            catch { }

            var logo = GetLogo();
            int curY = 16;
            if (logo != null)
            {
                var pbLogo = new PictureBox
                {
                    Image = logo,
                    SizeMode = PictureBoxSizeMode.Zoom,
                    Size = new Size(240, 65),
                    Location = new Point((420 - 240) / 2, curY),
                    BackColor = Color.Transparent
                };
                form.Controls.Add(pbLogo);
                curY += 75;
            }

            var lbl = new Label
            {
                Text = prompt,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(24, curY),
                Width = 356,
                AutoSize = true
            };
            form.Controls.Add(lbl);
            curY += 32;

            var txtPass = new TextBox
            {
                Location = new Point(24, curY),
                Width = 356,
                PasswordChar = '•',
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42)
            };
            form.Controls.Add(txtPass);
            curY += 45;

            var btnConfirm = new Button
            {
                Text = "Validar",
                DialogResult = DialogResult.OK,
                Size = new Size(130, 36),
                Location = new Point(250, curY),
                BackColor = Color.FromArgb(14, 116, 144),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnConfirm.FlatAppearance.BorderSize = 0;

            var btnCancel = new Button
            {
                Text = "Cancelar",
                DialogResult = DialogResult.Cancel,
                Size = new Size(100, 36),
                Location = new Point(140, curY),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(71, 85, 105),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);

            form.Controls.Add(btnConfirm);
            form.Controls.Add(btnCancel);
            form.AcceptButton = btnConfirm;
            form.CancelButton = btnCancel;

            bool success = false;
            btnConfirm.Click += (s, e) =>
            {
                if (validator(txtPass.Text))
                {
                    success = true;
                    form.DialogResult = DialogResult.OK;
                    form.Close();
                }
                else
                {
                    ShowError("Senha incorreta! Verifique os dados informados.", "Validação de Senha");
                    txtPass.SelectAll();
                    txtPass.Focus();
                }
            };

            var res = parent != null ? form.ShowDialog(parent) : form.ShowDialog();
            return success;
        }
    }
}
