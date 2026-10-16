using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace HubParatechDesktop
{
    public class XmlLogItem
    {
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string TipoPasta { get; set; } = "Venda"; // Venda ou Compra
        public string Modelo { get; set; } = "65"; // 55 ou 65
        public string Numero { get; set; } = "";
        public string Serie { get; set; } = "";
        public string DataEmissao { get; set; } = "";
        public decimal ValorTotal { get; set; }
        public string Chave { get; set; } = "";
        public string Status { get; set; } = "Sucesso";
        public string Arquivo { get; set; } = "";
        public bool IsRealTime { get; set; }
    }

    public class LiveMonitorForm : Form
    {
        private static readonly List<XmlLogItem> GlobalLogItems = new List<XmlLogItem>();
        private static readonly object LogLock = new object();
        private static LiveMonitorForm? activeInstance = null;

        private DataGridView dgvLogs;
        private Label lblTotalEnviados;
        private Label lblTotalNoCache;
        private Label lblPastasMonitoradas;
        private Label lblModoOperacao;
        private Label lblStatusPill;
        private System.Windows.Forms.Timer refreshTimer;

        public static void AddLog(XmlLogItem item)
        {
            lock (LogLock)
            {
                GlobalLogItems.Insert(0, item);
                if (GlobalLogItems.Count > 300)
                {
                    GlobalLogItems.RemoveAt(GlobalLogItems.Count - 1);
                }
            }

            if (activeInstance != null && !activeInstance.IsDisposed)
            {
                try
                {
                    activeInstance.BeginInvoke(new Action(() => activeInstance.RefreshDataGrid()));
                }
                catch { }
            }
        }

        public static void OpenMonitor(int pastasCount, string modo)
        {
            if (activeInstance != null && !activeInstance.IsDisposed)
            {
                activeInstance.BringToFront();
                activeInstance.Activate();
                return;
            }

            activeInstance = new LiveMonitorForm(pastasCount, modo);
            activeInstance.Show();
        }

        public LiveMonitorForm(int pastasCount, string modo)
        {
            Text = "Monitor de Sincronização em Tempo Real de XMLs • Hub Paratech";
            Size = new Size(1060, 680);
            MinimumSize = new Size(880, 560);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.Sizable;
            BackColor = Color.FromArgb(248, 250, 252); // slate-50

            try
            {
                Icon = AppResources.GetIcon();
            }
            catch { }

            FormClosed += (s, e) => { activeInstance = null; };

            // 1. Cabeçalho Superior
            var topPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 84,
                BackColor = Color.White,
                Padding = new Padding(20, 12, 20, 12)
            };

            var topBorder = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 1,
                BackColor = Color.FromArgb(226, 232, 240)
            };
            topPanel.Controls.Add(topBorder);

            // Logomarca (se existir)
            int headerLeft = 20;
            var logoImg = AppResources.GetLogo();
            if (logoImg != null)
            {
                try
                {
                    var pbLogo = new PictureBox
                    {
                        Image = logoImg,
                        SizeMode = PictureBoxSizeMode.Zoom,
                        Size = new Size(160, 60),
                        Location = new Point(headerLeft, 12),
                        BackColor = Color.Transparent
                    };
                    topPanel.Controls.Add(pbLogo);
                    headerLeft += 175;
                }
                catch { }
            }

            var lblTitle = new Label
            {
                Text = "Monitor de Emissões e Sincronização Fiscal",
                Font = new Font("Segoe UI", 13.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(headerLeft, 14),
                AutoSize = true
            };
            topPanel.Controls.Add(lblTitle);

            var lblSubtitle = new Label
            {
                Text = "Varredura automática em tempo real em todas as pastas e subpastas de notas fiscais.",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(headerLeft, 44),
                AutoSize = true
            };
            topPanel.Controls.Add(lblSubtitle);

            // Status Pill (Verde Piscante / Ativo)
            lblStatusPill = new Label
            {
                Text = "● MONITORAMENTO ATIVO",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(16, 185, 129), // emerald-600
                BackColor = Color.FromArgb(236, 253, 245), // emerald-50
                BorderStyle = BorderStyle.FixedSingle,
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(200, 32),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(topPanel.Width - 220, 24)
            };
            topPanel.Controls.Add(lblStatusPill);
            Controls.Add(topPanel);

            // 2. Painel de Indicadores / Cards
            var statsPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 82,
                BackColor = Color.FromArgb(248, 250, 252),
                Padding = new Padding(20, 10, 20, 10)
            };

            int cardWidth = 235;
            int cardGap = 16;
            int curX = 20;

            // Card 1: Enviados Nesta Sessão
            var card1 = CreateCard("ENVIADOS NA SESSÃO", "0", out lblTotalEnviados);
            card1.Location = new Point(curX, 10);
            card1.Size = new Size(cardWidth, 62);
            statsPanel.Controls.Add(card1);
            curX += cardWidth + cardGap;

            // Card 2: Monitores Ativos
            var card2 = CreateCard("PASTAS MONITORADAS", $"{pastasCount} pasta(s) + subpastas", out lblPastasMonitoradas);
            card2.Location = new Point(curX, 10);
            card2.Size = new Size(cardWidth, 62);
            statsPanel.Controls.Add(card2);
            curX += cardWidth + cardGap;

            // Card 3: Validações Ativas
            var card3 = CreateCard("VALIDAÇÃO FISCAL", "Tags <dhEmi> e <cStat>", out lblTotalNoCache);
            card3.Location = new Point(curX, 10);
            card3.Size = new Size(cardWidth, 62);
            statsPanel.Controls.Add(card3);
            curX += cardWidth + cardGap;

            // Card 4: Modo
            var card4 = CreateCard("MODO DE OPERAÇÃO", modo.ToUpper(), out lblModoOperacao);
            card4.Location = new Point(curX, 10);
            card4.Size = new Size(cardWidth, 62);
            statsPanel.Controls.Add(card4);

            Controls.Add(statsPanel);

            // 3. Grid de Logs em Tempo Real
            dgvLogs = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Color.White,
                BorderStyle = BorderStyle.None,
                RowHeadersVisible = false,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                AllowUserToResizeRows = false,
                ReadOnly = true,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                Font = new Font("Segoe UI", 9f)
            };

            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Horário", DataPropertyName = "Horario", FillWeight = 60 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Fluxo", DataPropertyName = "Tipo", FillWeight = 45 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Modelo", DataPropertyName = "Modelo", FillWeight = 50 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Número", DataPropertyName = "Numero", FillWeight = 55 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Série", DataPropertyName = "Serie", FillWeight = 35 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Emissão <dhEmi>", DataPropertyName = "Emissao", FillWeight = 85 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Valor (R$)", DataPropertyName = "Valor", FillWeight = 65 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Chave de Acesso", DataPropertyName = "Chave", FillWeight = 160 });
            dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Status Portal", DataPropertyName = "Status", FillWeight = 75 });

            // Estilização do Grid
            dgvLogs.EnableHeadersVisualStyles = false;
            dgvLogs.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(241, 245, 249);
            dgvLogs.ColumnHeadersDefaultCellStyle.ForeColor = Color.FromArgb(71, 85, 105);
            dgvLogs.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            dgvLogs.ColumnHeadersHeight = 36;
            dgvLogs.RowTemplate.Height = 30;
            dgvLogs.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(250, 250, 250);

            var gridContainer = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(20, 0, 20, 10)
            };
            gridContainer.Controls.Add(dgvLogs);
            Controls.Add(gridContainer);

            // 4. Rodapé de Ações
            var bottomPanel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 60,
                BackColor = Color.White,
                Padding = new Padding(20, 12, 20, 12)
            };

            var bottomBorder = new Panel
            {
                Dock = DockStyle.Top,
                Height = 1,
                BackColor = Color.FromArgb(226, 232, 240)
            };
            bottomPanel.Controls.Add(bottomBorder);

            var btnPortal = new Button
            {
                Text = "🌐 Abrir Portal Web",
                Size = new Size(150, 36),
                Location = new Point(20, 12),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(15, 23, 42),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnPortal.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnPortal.Click += (s, e) => {
                try {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo {
                        FileName = "https://hub-paratech-web.vercel.app/dashboard/documentos",
                        UseShellExecute = true
                    });
                } catch { }
            };
            bottomPanel.Controls.Add(btnPortal);

            var btnLimpar = new Button
            {
                Text = "Limpar Histórico Local",
                Size = new Size(160, 36),
                Location = new Point(180, 12),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(100, 116, 139),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnLimpar.FlatAppearance.BorderColor = Color.FromArgb(226, 232, 240);
            btnLimpar.Click += (s, e) => {
                lock (LogLock) GlobalLogItems.Clear();
                RefreshDataGrid();
            };
            bottomPanel.Controls.Add(btnLimpar);

            var btnClose = new Button
            {
                Text = "Fechar Monitor",
                Size = new Size(130, 36),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(bottomPanel.Width - 150, 12),
                BackColor = Color.FromArgb(14, 116, 144), // cyan-700
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.Click += (s, e) => Close();
            bottomPanel.Controls.Add(btnClose);

            Controls.Add(bottomPanel);

            // Timer suave de atualização
            refreshTimer = new System.Windows.Forms.Timer { Interval = 2500 };
            refreshTimer.Tick += (s, e) => RefreshDataGrid();
            refreshTimer.Start();

            RefreshDataGrid();
        }

        private Panel CreateCard(string title, string value, out Label lblValue)
        {
            var pnl = new Panel
            {
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12, 8, 12, 8)
            };

            var lblT = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(10, 8),
                AutoSize = true
            };
            pnl.Controls.Add(lblT);

            lblValue = new Label
            {
                Text = value,
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(10, 26),
                AutoSize = true
            };
            pnl.Controls.Add(lblValue);

            return pnl;
        }

        private void RefreshDataGrid()
        {
            List<XmlLogItem> copy;
            lock (LogLock)
            {
                copy = GlobalLogItems.ToList();
            }

            int countSucesso = copy.Count(x => x.Status == "Sucesso" || x.Status == "Enviado");
            lblTotalEnviados.Text = countSucesso.ToString();

            dgvLogs.Rows.Clear();
            foreach (var item in copy)
            {
                string tipoMod = item.Modelo == "65" ? "NFC-e (65)" : (item.Modelo == "55" ? "NF-e (55)" : item.Modelo);
                string emissaoFormatada = item.DataEmissao;
                if (DateTime.TryParse(item.DataEmissao, out DateTime dtEmi))
                {
                    emissaoFormatada = dtEmi.ToString("dd/MM/yyyy HH:mm");
                }

                int rowIndex = dgvLogs.Rows.Add(
                    item.Timestamp.ToString("HH:mm:ss"),
                    item.TipoPasta,
                    tipoMod,
                    item.Numero,
                    item.Serie,
                    emissaoFormatada,
                    item.ValorTotal > 0 ? item.ValorTotal.ToString("N2") : "-",
                    item.Chave,
                    item.Status
                );

                var row = dgvLogs.Rows[rowIndex];
                if (item.Status == "Sucesso" || item.Status == "Enviado")
                {
                    row.Cells[8].Style.ForeColor = Color.FromArgb(16, 185, 129); // emerald-600
                    row.Cells[8].Style.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
                }
                else if (item.Status.Contains("Cache") || item.Status.Contains("Já no Portal"))
                {
                    row.Cells[8].Style.ForeColor = Color.FromArgb(14, 116, 144); // cyan-700
                }
                else
                {
                    row.Cells[8].Style.ForeColor = Color.FromArgb(239, 68, 68); // red-500
                }
            }
        }
    }
}
