using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ParatechUpdaterApp
{
    public class UpdateDialogForm : Form
    {
        private readonly UpdateApiResponse info;
        private readonly int callerPid;
        private ProgressBar progressBar;
        private Label lblStatus;
        private Button btnAtualizar;
        private Button btnDepois;
        private bool isDownloading = false;

        public UpdateDialogForm(UpdateApiResponse info, int callerPid)
        {
            this.info = info;
            this.callerPid = callerPid;

            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Paratech - Nova Versão Disponível";
            this.Size = new Size(520, 420);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.White;
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // Painel de Topo (Verde Esmeralda)
            Panel pnlTop = new Panel
            {
                Dock = DockStyle.Top,
                Height = 70,
                BackColor = Color.FromArgb(16, 185, 129) // Emerald 500
            };

            Label lblTitulo = new Label
            {
                Text = "🚀 Nova Atualização Disponível!",
                Font = new Font("Segoe UI", 13F, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(20, 14),
                AutoSize = true
            };

            Label lblSubtitulo = new Label
            {
                Text = $"Sistema: {info.sistema_id?.ToUpper()} • Versão {info.versao_mais_recente} (Build #{info.build_number_mais_recente})",
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(240, 253, 250),
                Location = new Point(23, 40),
                AutoSize = true
            };

            pnlTop.Controls.Add(lblTitulo);
            pnlTop.Controls.Add(lblSubtitulo);
            this.Controls.Add(pnlTop);

            // Conteúdo
            int currentY = 85;

            if (info.obrigatoria)
            {
                Panel pnlAviso = new Panel
                {
                    Location = new Point(20, currentY),
                    Size = new Size(465, 34),
                    BackColor = Color.FromArgb(254, 243, 199) // Amber 100
                };
                Label lblAviso = new Label
                {
                    Text = "⚠️ Atualização crítica obrigatória da SEFAZ ou do Sistema.",
                    Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
                    ForeColor = Color.FromArgb(146, 64, 14), // Amber 800
                    Location = new Point(10, 8),
                    AutoSize = true
                };
                pnlAviso.Controls.Add(lblAviso);
                this.Controls.Add(pnlAviso);
                currentY += 42;
            }

            Label lblNovidades = new Label
            {
                Text = "O que há de novo nesta versão:",
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                ForeColor = Color.FromArgb(51, 65, 85),
                Location = new Point(20, currentY),
                AutoSize = true
            };
            this.Controls.Add(lblNovidades);
            currentY += 24;

            TextBox txtChangelog = new TextBox
            {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                BackColor = Color.FromArgb(248, 250, 252),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(20, currentY),
                Size = new Size(465, info.obrigatoria ? 110 : 145),
                Font = new Font("Consolas", 8.5F),
                Text = string.IsNullOrWhiteSpace(info.changelog)
                    ? "• Melhorias gerais de estabilidade e novas funcionalidades."
                    : info.changelog.Replace("\n", Environment.NewLine)
            };
            this.Controls.Add(txtChangelog);
            currentY += txtChangelog.Height + 12;

            // Barra de Progresso
            progressBar = new ProgressBar
            {
                Location = new Point(20, currentY),
                Size = new Size(465, 14),
                Visible = false,
                Style = ProgressBarStyle.Marquee
            };
            this.Controls.Add(progressBar);

            lblStatus = new Label
            {
                Location = new Point(20, currentY + 18),
                Size = new Size(465, 18),
                ForeColor = Color.FromArgb(16, 185, 129),
                Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
                Visible = false,
                Text = "Preparando download..."
            };
            this.Controls.Add(lblStatus);

            // Botões de Rodapé
            btnAtualizar = new Button
            {
                Text = "Atualizar Agora",
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(130, 36),
                Location = new Point(355, 330),
                Cursor = Cursors.Hand
            };
            btnAtualizar.FlatAppearance.BorderSize = 0;
            btnAtualizar.Click += BtnAtualizar_Click;

            btnDepois = new Button
            {
                Text = "Lembrar Mais Tarde",
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(71, 85, 105),
                FlatStyle = FlatStyle.Flat,
                Size = new Size(140, 36),
                Location = new Point(205, 330),
                Cursor = Cursors.Hand,
                Visible = !info.obrigatoria
            };
            btnDepois.FlatAppearance.BorderSize = 0;
            btnDepois.Click += (s, e) => this.Close();

            this.Controls.Add(btnDepois);
            this.Controls.Add(btnAtualizar);
        }

        private async void BtnAtualizar_Click(object? sender, EventArgs e)
        {
            if (isDownloading) return;
            isDownloading = true;

            btnAtualizar.Enabled = false;
            btnDepois.Enabled = false;
            progressBar.Visible = true;
            lblStatus.Visible = true;
            lblStatus.Text = "Baixando atualização do Hub Paratech...";

            await Task.Run(() =>
            {
                Program.BaixarEExecutar(info, callerPid, silencioso: false);
            });

            this.Close();
        }
    }
}
