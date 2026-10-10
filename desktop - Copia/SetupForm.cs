using System;
using System.Drawing;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class SetupForm : Form
    {
        private TextBox txtToken;
        private Button btnSave;

        public SetupForm()
        {
            Text = "Configuração do Hub Paratech";
            Size = new Size(400, 200);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;

            var lbl = new Label { Text = "Cole o Token do Cliente:", Location = new Point(20, 30), AutoSize = true };
            
            var config = ConfigManager.Load();
            txtToken = new TextBox { Location = new Point(20, 60), Width = 340, Text = config.HubToken };

            btnSave = new Button { 
                Text = "Salvar", 
                Location = new Point(260, 100), 
                Width = 100, Height = 35, 
                BackColor = Color.SteelBlue, 
                ForeColor = Color.White, 
                FlatStyle = FlatStyle.Flat 
            };
            btnSave.Click += BtnSave_Click;

            Controls.Add(lbl);
            Controls.Add(txtToken);
            Controls.Add(btnSave);
        }

        private void BtnSave_Click(object? sender, EventArgs e)
        {
            var config = ConfigManager.Load();
            config.HubToken = txtToken.Text.Trim();
            ConfigManager.Save(config);
            MessageBox.Show("Token salvo com sucesso!", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
        }
    }
}
