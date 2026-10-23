using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using System.Diagnostics;
using System.Text.Json;

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

        [System.Text.Json.Serialization.JsonIgnore]
        public long NumeroLong => long.TryParse(Numero, out long n) ? n : 0;

        [System.Text.Json.Serialization.JsonIgnore]
        public DateTime? DataEmissaoData
        {
            get
            {
                if (!string.IsNullOrWhiteSpace(DataEmissao))
                {
                    if (DateTime.TryParse(DataEmissao, out DateTime dt))
                        return dt.Date;
                    var m = System.Text.RegularExpressions.Regex.Match(DataEmissao, @"^(\d{4})-(\d{2})-(\d{2})");
                    if (m.Success && int.TryParse(m.Groups[1].Value, out int y) && int.TryParse(m.Groups[2].Value, out int mo) && int.TryParse(m.Groups[3].Value, out int d))
                    {
                        return new DateTime(y, mo, d);
                    }
                }
                return Timestamp.Date;
            }
        }
    }

    public class LiveMonitorForm : Form
    {
        private static readonly List<XmlLogItem> GlobalLogItems = new List<XmlLogItem>();
        private static readonly object LogLock = new object();
        private static LiveMonitorForm? activeInstance = null;
        public static string PontoPartidaInfo { get; set; } = "Configuração do Portal";

        private static int currentProgress = 100;
        private static int maxProgress = 100;
        private static string progressMessage = "Sincronização em dia • Monitoramento ativo";
        private static bool isSyncingActive = false;

        private DataGridView dgvLogs;
        private Label lblTotalEnviados;
        private Label lblTotalNoCache;
        private Label lblPastasMonitoradas;
        private Label lblModoOperacao;
        private Label lblStatusPill;
        private ProgressBar pbSync;
        private Label lblProgressMessage;
        private Label lblProgressPercent;
        private ComboBox cmbFiltroData;
        private DateTimePicker dtpFiltro;
        private Label lblContadorFiltro;
        private System.Windows.Forms.Timer refreshTimer;

        private static readonly string HistoryPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "HubParatech",
            "monitor_history.json"
        );

        static LiveMonitorForm()
        {
            LoadHistory();
        }

        public static int CountLogs
        {
            get
            {
                lock (LogLock) return GlobalLogItems.Count;
            }
        }

        private static void LoadHistory()
        {
            try
            {
                if (File.Exists(HistoryPath))
                {
                    string json = File.ReadAllText(HistoryPath);
                    var items = JsonSerializer.Deserialize<List<XmlLogItem>>(json);
                    if (items != null)
                    {
                        lock (LogLock)
                        {
                            GlobalLogItems.Clear();
                            foreach (var it in items.Take(300))
                            {
                                if (it.ValorTotal == 0 && !string.IsNullOrEmpty(it.Arquivo) && File.Exists(it.Arquivo))
                                {
                                    var meta = XmlMonitor.ExtrairMetadadosRapidos(it.Arquivo);
                                    if (meta.valor > 0) it.ValorTotal = meta.valor;
                                    if (!string.IsNullOrEmpty(meta.dhEmi)) it.DataEmissao = meta.dhEmi;
                                }
                                GlobalLogItems.Add(it);
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private static void SaveHistory()
        {
            try
            {
                List<XmlLogItem> copy;
                lock (LogLock)
                {
                    copy = GlobalLogItems.Take(200).ToList();
                }
                string dir = Path.GetDirectoryName(HistoryPath)!;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                string json = JsonSerializer.Serialize(copy, new JsonSerializerOptions { WriteIndented = false });
                File.WriteAllText(HistoryPath, json);
            }
            catch { }
        }

        public static void AddLog(XmlLogItem item)
        {
            lock (LogLock)
            {
                var existing = GlobalLogItems.FirstOrDefault(x => x.Chave == item.Chave && !string.IsNullOrEmpty(x.Chave));
                if (existing != null)
                {
                    if (existing.ValorTotal == 0 && item.ValorTotal > 0)
                        existing.ValorTotal = item.ValorTotal;
                    if (!string.IsNullOrEmpty(item.Status))
                        existing.Status = item.Status;
                    if (!string.IsNullOrEmpty(item.DataEmissao))
                        existing.DataEmissao = item.DataEmissao;
                    if (!string.IsNullOrEmpty(item.Arquivo))
                        existing.Arquivo = item.Arquivo;
                }
                else
                {
                    GlobalLogItems.Insert(0, item);
                    if (GlobalLogItems.Count > 400)
                    {
                        GlobalLogItems.RemoveAt(GlobalLogItems.Count - 1);
                    }
                }
            }

            SaveHistory();

            if (activeInstance != null && !activeInstance.IsDisposed)
            {
                try
                {
                    activeInstance.BeginInvoke(new Action(() => activeInstance.RefreshDataGrid()));
                }
                catch { }
            }
        }

        public static void ReportProgress(int current, int total, string message, bool isSyncing = true)
        {
            currentProgress = current;
            maxProgress = Math.Max(1, total);
            progressMessage = message;
            isSyncingActive = isSyncing;

            if (activeInstance != null && !activeInstance.IsDisposed)
            {
                try
                {
                    activeInstance.BeginInvoke(new Action(() => activeInstance.UpdateProgressUI()));
                }
                catch { }
            }
        }

        public void UpdateProgressUI()
        {
            if (InvokeRequired)
            {
                try { BeginInvoke(new Action(UpdateProgressUI)); } catch { }
                return;
            }

            try
            {
                if (pbSync != null && !pbSync.IsDisposed)
                {
                    pbSync.Maximum = Math.Max(1, maxProgress);
                    pbSync.Value = Math.Min(Math.Max(0, currentProgress), pbSync.Maximum);
                }

                if (lblProgressPercent != null && !lblProgressPercent.IsDisposed)
                {
                    int pct = maxProgress > 0 ? (int)Math.Round((double)currentProgress * 100.0 / maxProgress) : 100;
                    if (pct > 100) pct = 100;
                    lblProgressPercent.Text = $"{pct}%";
                    lblProgressPercent.ForeColor = isSyncingActive ? Color.FromArgb(14, 116, 144) : Color.FromArgb(16, 185, 129);
                }

                if (lblProgressMessage != null && !lblProgressMessage.IsDisposed)
                {
                    lblProgressMessage.Text = progressMessage;
                }
            }
            catch { }
        }

        public static void OpenWebPortal(string url)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                };
                Process.Start(psi);
                return;
            }
            catch { }

            try
            {
                var psiCmd = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c start \"\" \"{url}\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process.Start(psiCmd);
                return;
            }
            catch { }

            try
            {
                Process.Start("explorer.exe", $"\"{url}\"");
            }
            catch { }
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

            // Card 3: Ponto de Partida Fiscal
            var card3 = CreateCard("PONTO DE PARTIDA FISCAL", PontoPartidaInfo, out lblTotalNoCache);
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

            // 2.5 Barra de Progresso e Filtro por Data
            var toolBarPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 52,
                BackColor = Color.White,
                Padding = new Padding(20, 6, 20, 6)
            };

            var toolBarBorder = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 1,
                BackColor = Color.FromArgb(226, 232, 240)
            };
            toolBarPanel.Controls.Add(toolBarBorder);

            // Lado Esquerdo: Progresso da Sincronização / Varredura
            var pnlProgress = new Panel
            {
                Location = new Point(20, 6),
                Size = new Size(380, 40),
                Anchor = AnchorStyles.Top | AnchorStyles.Left,
                BackColor = Color.Transparent
            };

            lblProgressMessage = new Label
            {
                Text = progressMessage,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(0, 2),
                AutoSize = true
            };
            pnlProgress.Controls.Add(lblProgressMessage);

            pbSync = new ProgressBar
            {
                Location = new Point(0, 20),
                Size = new Size(240, 14),
                Minimum = 0,
                Maximum = 100,
                Value = 100,
                Style = ProgressBarStyle.Continuous
            };
            pnlProgress.Controls.Add(pbSync);

            lblProgressPercent = new Label
            {
                Text = "100%",
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Color.FromArgb(16, 185, 129),
                Location = new Point(245, 19),
                AutoSize = true
            };
            pnlProgress.Controls.Add(lblProgressPercent);

            toolBarPanel.Controls.Add(pnlProgress);

            // Lado Direito: Filtro por Data de Emissão (Padrão: Data do Dia)
            var pnlFilter = new Panel
            {
                Size = new Size(540, 40),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(toolBarPanel.Width - 560, 6),
                BackColor = Color.Transparent
            };

            var lblFiltro = new Label
            {
                Text = "📅 Emissão:",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(0, 9),
                AutoSize = true
            };
            pnlFilter.Controls.Add(lblFiltro);

            cmbFiltroData = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 8.5f),
                Size = new Size(160, 26),
                Location = new Point(78, 6)
            };
            cmbFiltroData.Items.Add($"Hoje ({DateTime.Today:dd/MM})");
            cmbFiltroData.Items.Add($"Ontem ({DateTime.Today.AddDays(-1):dd/MM})");
            cmbFiltroData.Items.Add("Últimos 7 dias");
            cmbFiltroData.Items.Add("Todas as Datas");
            cmbFiltroData.Items.Add("Data no Calendário ▾");
            cmbFiltroData.SelectedIndex = 0; // Padrão solicitado: Data do Dia!
            pnlFilter.Controls.Add(cmbFiltroData);

            dtpFiltro = new DateTimePicker
            {
                Format = DateTimePickerFormat.Short,
                Font = new Font("Segoe UI", 8.5f),
                Size = new Size(95, 24),
                Location = new Point(244, 6),
                Value = DateTime.Today,
                Enabled = false
            };
            pnlFilter.Controls.Add(dtpFiltro);

            lblContadorFiltro = new Label
            {
                Text = "Carregando...",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(14, 116, 144),
                Location = new Point(345, 9),
                AutoSize = true
            };
            pnlFilter.Controls.Add(lblContadorFiltro);

            toolBarPanel.Controls.Add(pnlFilter);

            toolBarPanel.Resize += (s, e) => {
                pnlFilter.Location = new Point(toolBarPanel.Width - pnlFilter.Width - 20, 6);
            };

            cmbFiltroData.SelectedIndexChanged += (s, e) => {
                if (cmbFiltroData.SelectedIndex == 0) // Hoje
                {
                    dtpFiltro.Value = DateTime.Today;
                    dtpFiltro.Enabled = false;
                }
                else if (cmbFiltroData.SelectedIndex == 1) // Ontem
                {
                    dtpFiltro.Value = DateTime.Today.AddDays(-1);
                    dtpFiltro.Enabled = false;
                }
                else if (cmbFiltroData.SelectedIndex == 4) // Calendário
                {
                    dtpFiltro.Enabled = true;
                }
                else
                {
                    dtpFiltro.Enabled = false;
                }
                RefreshDataGrid();
            };

            dtpFiltro.ValueChanged += (s, e) => {
                if (cmbFiltroData.SelectedIndex != 4)
                {
                    cmbFiltroData.SelectedIndex = 4;
                }
                RefreshDataGrid();
            };

            Controls.Add(toolBarPanel);

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
                Font = new Font("Segoe UI", 9f),
                AutoGenerateColumns = false,
                ColumnHeadersVisible = true,
                ScrollBars = ScrollBars.Both
            };

            EnsureColumns();

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
                string url = "https://hub-paratech-web.vercel.app/dashboard/notas-fiscais/saidas/nfce";
                lock (LogLock)
                {
                    if (GlobalLogItems.Any(x => x.Modelo == "65"))
                    {
                        url = "https://hub-paratech-web.vercel.app/dashboard/notas-fiscais/saidas/nfce";
                    }
                    else if (GlobalLogItems.Any(x => x.Modelo == "55"))
                    {
                        url = "https://hub-paratech-web.vercel.app/dashboard/notas-fiscais/saidas/nfe";
                    }
                    else if (GlobalLogItems.Any(x => x.TipoPasta == "Entrada"))
                    {
                        url = "https://hub-paratech-web.vercel.app/dashboard/notas-fiscais/entradas/nfe";
                    }
                }
                OpenWebPortal(url);
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
                try
                {
                    lock (LogLock) GlobalLogItems.Clear();
                    try { if (File.Exists(HistoryPath)) File.Delete(HistoryPath); } catch { }
                    XmlUploadCache.Clear();
                    RefreshDataGrid();
                }
                catch { }
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
            gridContainer.BringToFront();

            // Timer suave de atualização
            refreshTimer = new System.Windows.Forms.Timer { Interval = 2500 };
            refreshTimer.Tick += (s, e) => {
                try
                {
                    if (Visible && !IsDisposed && dgvLogs != null && !dgvLogs.IsDisposed)
                    {
                        RefreshDataGrid();
                    }
                }
                catch { }
            };
            refreshTimer.Start();

            Shown += (s, e) => {
                try { RefreshDataGrid(); } catch { }
            };
        }

        private void EnsureColumns()
        {
            if (dgvLogs == null) return;
            if (dgvLogs.Columns.Count >= 9) return;

            try
            {
                dgvLogs.SuspendLayout();
                dgvLogs.AutoGenerateColumns = false;
                if (dgvLogs.Columns.Count < 9)
                {
                    dgvLogs.Columns.Clear();
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colHorario", HeaderText = "Horário", FillWeight = 60 });
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colFluxo", HeaderText = "Fluxo", FillWeight = 45 });
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colModelo", HeaderText = "Modelo", FillWeight = 50 });
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colNumero", HeaderText = "Número", FillWeight = 55 });
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colSerie", HeaderText = "Série", FillWeight = 35 });
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colEmissao", HeaderText = "Emissão <dhEmi>", FillWeight = 85 });

                    var colValor = new DataGridViewTextBoxColumn
                    {
                        Name = "colValor",
                        HeaderText = "Valor (R$)",
                        FillWeight = 65
                    };
                    colValor.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
                    colValor.HeaderCell.Style.Alignment = DataGridViewContentAlignment.MiddleRight;
                    dgvLogs.Columns.Add(colValor);

                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colChave", HeaderText = "Chave de Acesso", FillWeight = 160 });
                    dgvLogs.Columns.Add(new DataGridViewTextBoxColumn { Name = "colStatus", HeaderText = "Status Portal", FillWeight = 75 });
                }
                dgvLogs.ResumeLayout();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LiveMonitor] Falha ao configurar colunas: {ex.Message}");
            }
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
            if (dgvLogs == null || dgvLogs.IsDisposed) return;

            if (InvokeRequired)
            {
                try
                {
                    BeginInvoke(new Action(RefreshDataGrid));
                }
                catch { }
                return;
            }

            try
            {
                EnsureColumns();
                if (dgvLogs.Columns.Count < 9) return;

                UpdateProgressUI();

                List<XmlLogItem> allCopy;
                lock (LogLock)
                {
                    allCopy = GlobalLogItems.ToList();
                }

                if (lblTotalEnviados != null && !lblTotalEnviados.IsDisposed)
                {
                    int countSucesso = allCopy.Count(x => x.Status == "Sucesso" || x.Status == "Enviado");
                    lblTotalEnviados.Text = countSucesso.ToString();
                }

                if (lblTotalNoCache != null && !lblTotalNoCache.IsDisposed)
                {
                    lblTotalNoCache.Text = PontoPartidaInfo;
                }

                // 1. Filtragem por data (Padrão: Data do Dia / Hoje)
                int modoFiltro = cmbFiltroData != null ? cmbFiltroData.SelectedIndex : 0;
                DateTime dataEscolhida = dtpFiltro != null ? dtpFiltro.Value.Date : DateTime.Today;

                List<XmlLogItem> filtered;
                if (modoFiltro == 0) // Hoje (Padrão)
                {
                    filtered = allCopy.Where(x => x.DataEmissaoData == DateTime.Today).ToList();
                }
                else if (modoFiltro == 1) // Ontem
                {
                    filtered = allCopy.Where(x => x.DataEmissaoData == DateTime.Today.AddDays(-1)).ToList();
                }
                else if (modoFiltro == 2) // Últimos 7 dias
                {
                    DateTime d7 = DateTime.Today.AddDays(-7);
                    filtered = allCopy.Where(x => (x.DataEmissaoData ?? DateTime.MinValue) >= d7).ToList();
                }
                else if (modoFiltro == 4) // Data no Calendário
                {
                    filtered = allCopy.Where(x => x.DataEmissaoData == dataEscolhida).ToList();
                }
                else // 3 = Todas as Datas
                {
                    filtered = allCopy;
                }

                // 2. Inverter a ordem: Notas finais no início (mais recentes e com maior número no topo)
                filtered = filtered
                    .OrderByDescending(x => x.DataEmissaoData ?? DateTime.MinValue)
                    .ThenByDescending(x => x.NumeroLong)
                    .ThenByDescending(x => x.Timestamp)
                    .ToList();

                // 3. Atualizar contador do filtro
                if (lblContadorFiltro != null && !lblContadorFiltro.IsDisposed)
                {
                    if (modoFiltro == 0 && filtered.Count == 0 && allCopy.Count > 0)
                    {
                        lblContadorFiltro.Text = $"0 notas hoje ({DateTime.Today:dd/MM}) • {allCopy.Count} no histórico geral (Escolha 'Todas as Datas')";
                        lblContadorFiltro.ForeColor = Color.FromArgb(217, 119, 6); // amber
                    }
                    else
                    {
                        lblContadorFiltro.Text = $"Exibindo {filtered.Count} nota(s)";
                        lblContadorFiltro.ForeColor = Color.FromArgb(14, 116, 144); // cyan-700
                    }
                }

                dgvLogs.SuspendLayout();
                try
                {
                    dgvLogs.Rows.Clear();
                    foreach (var item in filtered)
                    {
                        if (dgvLogs.Columns.Count < 9) break;

                        string tipoMod = item.Modelo == "65" ? "NFC-e (65)" : (item.Modelo == "55" ? "NF-e (55)" : item.Modelo);
                        string emissaoFormatada = item.DataEmissao;
                        if (DateTime.TryParse(item.DataEmissao, out DateTime dtEmi))
                        {
                            emissaoFormatada = dtEmi.ToString("dd/MM/yyyy HH:mm");
                        }
                        else if (!string.IsNullOrEmpty(item.DataEmissao) && item.DataEmissao.Length >= 10)
                        {
                            var m = System.Text.RegularExpressions.Regex.Match(item.DataEmissao, @"^(\d{4})-(\d{2})-(\d{2})");
                            if (m.Success)
                            {
                                emissaoFormatada = $"{m.Groups[3].Value}/{m.Groups[2].Value}/{m.Groups[1].Value}";
                            }
                        }

                        string valorStr = item.ValorTotal > 0 ? item.ValorTotal.ToString("N2") : "-";

                        int rowIndex = -1;
                        try
                        {
                            rowIndex = dgvLogs.Rows.Add(
                                item.Timestamp.ToString("HH:mm:ss"),
                                item.TipoPasta,
                                tipoMod,
                                item.Numero,
                                item.Serie,
                                emissaoFormatada,
                                valorStr,
                                item.Chave,
                                item.Status
                            );
                        }
                        catch
                        {
                            continue;
                        }

                        if (rowIndex >= 0 && rowIndex < dgvLogs.Rows.Count)
                        {
                            var row = dgvLogs.Rows[rowIndex];
                            if (item.Status == "Sucesso" || item.Status == "Enviado")
                            {
                                row.Cells[8].Style.ForeColor = Color.FromArgb(16, 185, 129); // emerald-600
                                row.Cells[8].Style.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
                            }
                            else if (item.Status.StartsWith("Ignorado") || item.Status.Contains("Ponto de Partida"))
                            {
                                row.Cells[8].Style.ForeColor = Color.FromArgb(217, 119, 6); // amber-600
                                row.Cells[8].Style.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
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
                finally
                {
                    dgvLogs.ResumeLayout();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LiveMonitor] Erro protegido ao atualizar grid: {ex.Message}");
            }
        }
    }
}
