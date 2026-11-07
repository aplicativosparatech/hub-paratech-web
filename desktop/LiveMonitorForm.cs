using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;

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
                    // 1. Tenta capturar YYYY-MM-DD em qualquer posição (ex: 2026-11-03T18:45:00-03:00)
                    var m = System.Text.RegularExpressions.Regex.Match(DataEmissao, @"(\d{4})-(\d{2})-(\d{2})");
                    if (m.Success && int.TryParse(m.Groups[1].Value, out int y) && int.TryParse(m.Groups[2].Value, out int mo) && int.TryParse(m.Groups[3].Value, out int d))
                    {
                        try { return new DateTime(y, mo, d); } catch { }
                    }

                    // 2. Tenta capturar formato brasileiro DD/MM/YYYY
                    var mBr = System.Text.RegularExpressions.Regex.Match(DataEmissao, @"(\d{2})/(\d{2})/(\d{4})");
                    if (mBr.Success && int.TryParse(mBr.Groups[3].Value, out int yBr) && int.TryParse(mBr.Groups[2].Value, out int moBr) && int.TryParse(mBr.Groups[1].Value, out int dBr))
                    {
                        try { return new DateTime(yBr, moBr, dBr); } catch { }
                    }

                    // 3. TryParse geral
                    if (DateTime.TryParse(DataEmissao, out DateTime dt))
                        return dt.Date;
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
        public static string? ConfidenceTimerText { get; set; } = null;
        public static int PastasCount { get; set; } = 0;
        public static string? PastasDescricao { get; set; } = null;
        public static List<string> PastasCaminhos { get; set; } = new List<string>();
        public static Action? OnForceRescanRequested { get; set; } = null;
        public static Func<Task>? OnReconciliarGapsRequested { get; set; } = null;

        private static int currentProgress = 100;
        private static int maxProgress = 100;
        private static string progressMessage = "Sincronização em dia • Monitoramento ativo";
        private static bool isSyncingActive = false;

        private DataGridView dgvLogs;
        private Label lblTotalEnviados;
        private Label lblSubTotalEnviados;
        private Label lblTotalNoCache;
        private Label lblSubTotalNoCache;
        private Label lblPastasMonitoradas;
        private Label lblSubPastasMonitoradas;
        private Label lblModoOperacao;
        private Label lblSubModoOperacao;
        private Label lblStatusPill;
        private ProgressBar pbSync;
        private Label lblProgressMessage;
        private Label lblProgressPercent;
        private ComboBox cmbFiltroData;
        private DateTimePicker dtpFiltro;
        private Label lblContadorFiltro;
        private TextBox txtBuscaRapida;
        private Button btnLimparBusca;
        private System.Windows.Forms.Timer refreshTimer;
        private ToolTip toolTipGlobal = new ToolTip();

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
                            foreach (var it in items.Take(1500))
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
                    copy = GlobalLogItems.Take(1500).ToList();
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
                    if (GlobalLogItems.Count > 2500)
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
                Height = 88,
                BackColor = Color.FromArgb(248, 250, 252),
                Padding = new Padding(20, 8, 20, 8)
            };

            int cardWidth = 240;
            int cardGap = 16;
            int curX = 20;

            // Card 1: Notas Sincronizadas
            var card1 = CreateCard("NOTAS SINCRONIZADAS", "0", out lblTotalEnviados, out lblSubTotalEnviados);
            card1.Location = new Point(curX, 8);
            card1.Size = new Size(cardWidth, 70);
            statsPanel.Controls.Add(card1);
            curX += cardWidth + cardGap;

            // Card 2: Monitores Ativos
            int qPastasIni = PastasCount > 0 ? PastasCount : pastasCount;
            var card2 = CreateCard("PASTAS MONITORADAS", $"{Math.Max(1, qPastasIni)} pasta(s) ativa(s)", out lblPastasMonitoradas, out lblSubPastasMonitoradas);
            card2.Location = new Point(curX, 8);
            card2.Size = new Size(cardWidth, 70);
            statsPanel.Controls.Add(card2);
            curX += cardWidth + cardGap;

            // Card 3: Intervalo de Notas
            var card3 = CreateCard("INTERVALO DE NOTAS", "Carregando...", out lblTotalNoCache, out lblSubTotalNoCache);
            card3.Location = new Point(curX, 8);
            card3.Size = new Size(cardWidth, 70);
            statsPanel.Controls.Add(card3);
            curX += cardWidth + cardGap;

            // Card 4: Modo
            var card4 = CreateCard("MODO DE OPERAÇÃO", "TEMPO REAL", out lblModoOperacao, out lblSubModoOperacao);
            card4.Location = new Point(curX, 8);
            card4.Size = new Size(cardWidth, 70);
            statsPanel.Controls.Add(card4);

            statsPanel.Resize += (s, e) => {
                try
                {
                    int wDisponivel = statsPanel.Width - 40 - (cardGap * 3);
                    if (wDisponivel > 600)
                    {
                        int dynamicWidth = wDisponivel / 4;
                        card1.Width = dynamicWidth;
                        card2.Width = dynamicWidth;
                        card3.Width = dynamicWidth;
                        card4.Width = dynamicWidth;

                        card1.Location = new Point(20, 8);
                        card2.Location = new Point(20 + dynamicWidth + cardGap, 8);
                        card3.Location = new Point(20 + (dynamicWidth + cardGap) * 2, 8);
                        card4.Location = new Point(20 + (dynamicWidth + cardGap) * 3, 8);
                    }
                }
                catch { }
            };

            Controls.Add(statsPanel);

            // 2.5 Barra de Progresso, Busca Rápida e Filtro por Data
            var toolBarPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 88,
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

            // Linha 1 - Lado Esquerdo: Progresso da Sincronização / Varredura
            var pnlProgress = new Panel
            {
                Location = new Point(20, 6),
                Size = new Size(380, 36),
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
                Location = new Point(0, 18),
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
                Location = new Point(245, 17),
                AutoSize = true
            };
            pnlProgress.Controls.Add(lblProgressPercent);

            toolBarPanel.Controls.Add(pnlProgress);

            // Linha 1 - Lado Direito: Filtro por Data de Emissão (com suporte a Todas as Datas, Hoje, Ontem, etc.)
            var pnlFilter = new Panel
            {
                Size = new Size(580, 36),
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(toolBarPanel.Width - 600, 6),
                BackColor = Color.Transparent
            };

            var lblFiltro = new Label
            {
                Text = "📅 Emissão:",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(71, 85, 105),
                Location = new Point(0, 7),
                AutoSize = true
            };
            pnlFilter.Controls.Add(lblFiltro);

            cmbFiltroData = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 8.5f),
                Size = new Size(180, 26),
                Location = new Point(78, 4)
            };
            cmbFiltroData.Items.Add("Todas as Datas (Geral)");
            cmbFiltroData.Items.Add($"Hoje ({DateTime.Today:dd/MM})");
            cmbFiltroData.Items.Add($"Ontem ({DateTime.Today.AddDays(-1):dd/MM})");
            cmbFiltroData.Items.Add("Últimos 7 dias");
            cmbFiltroData.Items.Add("Data no Calendário ▾");

            // Seleção inicial inteligente: se houver notas hoje, abre em Hoje (1); caso contrário Todas as Datas (0)
            bool temNotasHoje = false;
            lock (LogLock)
            {
                temNotasHoje = GlobalLogItems.Any(x => x.DataEmissaoData == DateTime.Today);
            }
            cmbFiltroData.SelectedIndex = temNotasHoje ? 1 : 0;
            pnlFilter.Controls.Add(cmbFiltroData);

            dtpFiltro = new DateTimePicker
            {
                Format = DateTimePickerFormat.Short,
                Font = new Font("Segoe UI", 8.5f),
                Size = new Size(95, 24),
                Location = new Point(264, 4),
                Value = DateTime.Today,
                Enabled = false
            };
            pnlFilter.Controls.Add(dtpFiltro);

            lblContadorFiltro = new Label
            {
                Text = "Carregando...",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(14, 116, 144),
                Location = new Point(365, 7),
                AutoSize = true
            };
            pnlFilter.Controls.Add(lblContadorFiltro);

            toolBarPanel.Controls.Add(pnlFilter);

            // Linha 2 - Barra de Busca em Tempo Real Multi-Campos (Número, Data, Valor, Chave)
            var pnlBuscaRapida = new Panel
            {
                Location = new Point(20, 48),
                Size = new Size(toolBarPanel.Width - 40, 32),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right,
                BackColor = Color.FromArgb(248, 250, 252)
            };

            var lblBuscaIcone = new Label
            {
                Text = "🔍 BUSCAR NOTA:",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(8, 7),
                AutoSize = true
            };
            pnlBuscaRapida.Controls.Add(lblBuscaIcone);

            txtBuscaRapida = new TextBox
            {
                Font = new Font("Segoe UI", 9f),
                Location = new Point(125, 4),
                Size = new Size(380, 24),
                ForeColor = Color.FromArgb(15, 23, 42),
                BorderStyle = BorderStyle.FixedSingle
            };
            toolTipGlobal.SetToolTip(txtBuscaRapida, "Digite para pesquisar instantaneamente por:\n• Número da Nota (ex: 2954)\n• Data de Emissão (ex: 01/10/2026 ou 01/10)\n• Valor Total em R$ (ex: 158,59 ou 158.59)\n• Chave de Acesso (44 dígitos ou parcial)\n• Caminho do Arquivo ou Status");
            txtBuscaRapida.TextChanged += (s, e) => {
                RefreshDataGrid();
            };
            pnlBuscaRapida.Controls.Add(txtBuscaRapida);

            btnLimparBusca = new Button
            {
                Text = "✕ Limpar",
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                Location = new Point(512, 4),
                Size = new Size(68, 24),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.White,
                ForeColor = Color.FromArgb(100, 116, 139),
                Cursor = Cursors.Hand
            };
            btnLimparBusca.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnLimparBusca.Click += (s, e) => {
                txtBuscaRapida.Text = "";
                txtBuscaRapida.Focus();
                RefreshDataGrid();
            };
            pnlBuscaRapida.Controls.Add(btnLimparBusca);

            var lblDicaBusca = new Label
            {
                Text = "Filtro em tempo real por Número, Data de Emissão, Valor Total (R$) ou Chave de Acesso",
                Font = new Font("Segoe UI", 8f, FontStyle.Italic),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(590, 7),
                AutoSize = true
            };
            pnlBuscaRapida.Controls.Add(lblDicaBusca);

            toolBarPanel.Controls.Add(pnlBuscaRapida);

            toolBarPanel.Resize += (s, e) => {
                pnlFilter.Location = new Point(toolBarPanel.Width - pnlFilter.Width - 20, 6);
                pnlBuscaRapida.Width = toolBarPanel.Width - 40;
                int maxTxtWidth = Math.Max(260, Math.Min(480, pnlBuscaRapida.Width - 440));
                txtBuscaRapida.Width = maxTxtWidth;
                btnLimparBusca.Location = new Point(txtBuscaRapida.Right + 6, 4);
                lblDicaBusca.Location = new Point(btnLimparBusca.Right + 12, 7);
            };

            cmbFiltroData.SelectedIndexChanged += (s, e) => {
                if (cmbFiltroData.SelectedIndex == 1) // Hoje
                {
                    dtpFiltro.Value = DateTime.Today;
                    dtpFiltro.Enabled = false;
                }
                else if (cmbFiltroData.SelectedIndex == 2) // Ontem
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
                string url = AppConfig.NfceSaidasUrl;
                lock (LogLock)
                {
                    if (GlobalLogItems.Any(x => x.Modelo == "65"))
                    {
                        url = AppConfig.NfceSaidasUrl;
                    }
                    else if (GlobalLogItems.Any(x => x.Modelo == "55"))
                    {
                        url = AppConfig.NfeSaidasUrl;
                    }
                    else if (GlobalLogItems.Any(x => x.TipoPasta == "Entrada"))
                    {
                        url = AppConfig.NfeEntradasUrl;
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

            var btnRescan = new Button
            {
                Text = "🔄 Forçar Varredura Agora",
                Size = new Size(190, 36),
                Location = new Point(350, 12),
                BackColor = Color.FromArgb(241, 245, 249),
                ForeColor = Color.FromArgb(14, 116, 144),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnRescan.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnRescan.Click += (s, e) => {
                btnRescan.Enabled = false;
                btnRescan.Text = "Varrendo notas...";
                try
                {
                    OnForceRescanRequested?.Invoke();
                }
                catch { }
                var t = new System.Windows.Forms.Timer { Interval = 3000 };
                t.Tick += (st, et) => {
                    t.Stop();
                    t.Dispose();
                    if (!btnRescan.IsDisposed)
                    {
                        btnRescan.Enabled = true;
                        btnRescan.Text = "🔄 Forçar Varredura Agora";
                    }
                };
                t.Start();
            };
            bottomPanel.Controls.Add(btnRescan);

            var btnReconciliar = new Button
            {
                Text = "⚖️ Reconciliar Gaps",
                Size = new Size(160, 36),
                Location = new Point(550, 12),
                BackColor = Color.FromArgb(238, 242, 255),
                ForeColor = Color.FromArgb(79, 70, 229),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnReconciliar.FlatAppearance.BorderColor = Color.FromArgb(199, 210, 254);
            btnReconciliar.Click += async (s, e) => {
                btnReconciliar.Enabled = false;
                btnReconciliar.Text = "Reconciliando...";
                try
                {
                    if (OnReconciliarGapsRequested != null)
                    {
                        await OnReconciliarGapsRequested.Invoke();
                    }
                }
                catch { }
                finally
                {
                    if (!btnReconciliar.IsDisposed)
                    {
                        btnReconciliar.Enabled = true;
                        btnReconciliar.Text = "⚖️ Reconciliar Gaps";
                    }
                }
            };
            bottomPanel.Controls.Add(btnReconciliar);

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

            // Timer suave de atualização (a cada 1 segundo para atualizar o timer de confiança e logs)
            refreshTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            refreshTimer.Tick += (s, e) => {
                try
                {
                    if (lblStatusPill != null && !lblStatusPill.IsDisposed)
                    {
                        if (!string.IsNullOrEmpty(ConfidenceTimerText))
                        {
                            lblStatusPill.Text = ConfidenceTimerText;
                            lblStatusPill.ForeColor = Color.FromArgb(180, 83, 9); // amber-700
                            lblStatusPill.BackColor = Color.FromArgb(254, 243, 199); // amber-100
                            lblStatusPill.Width = 270;
                        }
                        else
                        {
                            lblStatusPill.Text = "● MONITORAMENTO ATIVO";
                            lblStatusPill.ForeColor = Color.FromArgb(16, 185, 129); // emerald-600
                            lblStatusPill.BackColor = Color.FromArgb(236, 253, 245); // emerald-50
                            lblStatusPill.Width = 200;
                        }
                    }

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

        private Panel CreateCard(string title, string value, out Label lblValue, out Label lblSub)
        {
            var pnl = new Panel
            {
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12, 6, 12, 6)
            };

            var lblT = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(10, 6),
                AutoSize = true
            };
            pnl.Controls.Add(lblT);

            lblValue = new Label
            {
                Text = value,
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42),
                Location = new Point(10, 24),
                AutoSize = true
            };
            pnl.Controls.Add(lblValue);

            lblSub = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 7.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(10, 48),
                AutoSize = true
            };
            pnl.Controls.Add(lblSub);

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

                // 1. Atualizar Card 1: Notas Sincronizadas
                if (lblTotalEnviados != null && !lblTotalEnviados.IsDisposed)
                {
                    int countSincronizadas = allCopy.Count(x =>
                        x.Status == "Sucesso" ||
                        x.Status == "Enviado" ||
                        x.Status.Contains("Sincronizado") ||
                        x.Status.Contains("Portal") ||
                        x.Status.Contains("Cache")
                    );
                    int countEnviadosAgora = allCopy.Count(x => x.IsRealTime || x.Status == "Sucesso" || x.Status == "Enviado");

                    lblTotalEnviados.Text = $"{countSincronizadas} notas";
                    if (lblSubTotalEnviados != null && !lblSubTotalEnviados.IsDisposed)
                    {
                        if (countEnviadosAgora > 0)
                            lblSubTotalEnviados.Text = $"{countEnviadosAgora} transmitidas nesta sessão";
                        else
                            lblSubTotalEnviados.Text = "100% sincronizadas no Portal";
                    }
                }

                // 2. Atualizar Card 2: Pastas Monitoradas
                if (lblPastasMonitoradas != null && !lblPastasMonitoradas.IsDisposed)
                {
                    int qPastas = PastasCount > 0 ? PastasCount : (PastasCaminhos.Count > 0 ? PastasCaminhos.Count : 1);
                    lblPastasMonitoradas.Text = $"{qPastas} pasta(s) ativa(s)";
                    if (lblSubPastasMonitoradas != null && !lblSubPastasMonitoradas.IsDisposed)
                    {
                        lblSubPastasMonitoradas.Text = "Varredura contínua + subpastas";
                    }

                    if (PastasCaminhos != null && PastasCaminhos.Count > 0)
                    {
                        string toolTipText = "Pastas monitoradas em tempo real:\n" + string.Join("\n", PastasCaminhos);
                        toolTipGlobal.SetToolTip(lblPastasMonitoradas, toolTipText);
                    }
                }

                // 3. Atualizar Card 3: Intervalo de Notas / Numeração
                if (lblTotalNoCache != null && !lblTotalNoCache.IsDisposed)
                {
                    var notasComNumero = allCopy.Where(x => x.NumeroLong > 0).ToList();
                    if (notasComNumero.Count > 0)
                    {
                        long minNum = notasComNumero.Min(x => x.NumeroLong);
                        long maxNum = notasComNumero.Max(x => x.NumeroLong);

                        string modStr = allCopy.Any(x => x.Modelo == "65") ? "NFC-e" : (allCopy.Any(x => x.Modelo == "55") ? "NF-e" : "Notas");
                        lblTotalNoCache.Text = $"#{minNum} a #{maxNum}";
                        if (lblSubTotalNoCache != null && !lblSubTotalNoCache.IsDisposed)
                        {
                            lblSubTotalNoCache.Text = $"{modStr} ({notasComNumero.Count} notas na faixa)";
                        }
                        toolTipGlobal.SetToolTip(lblTotalNoCache, $"Intervalo Local: #{minNum} até #{maxNum}\nPonto de Partida Fiscal: {PontoPartidaInfo}");
                    }
                    else
                    {
                        lblTotalNoCache.Text = PontoPartidaInfo;
                        if (lblSubTotalNoCache != null && !lblSubTotalNoCache.IsDisposed)
                        {
                            lblSubTotalNoCache.Text = "Aguardando leitura de notas";
                        }
                    }
                }

                // 4. Atualizar Card 4: Modo de Operação
                if (lblModoOperacao != null && !lblModoOperacao.IsDisposed)
                {
                    lblModoOperacao.Text = "TEMPO REAL";
                    if (lblSubModoOperacao != null && !lblSubModoOperacao.IsDisposed)
                    {
                        lblSubModoOperacao.Text = "Varredura contínua ativa";
                    }
                }

                // 5. Filtragem por data
                int modoFiltro = cmbFiltroData != null ? cmbFiltroData.SelectedIndex : 0;
                DateTime dataEscolhida = dtpFiltro != null ? dtpFiltro.Value.Date : DateTime.Today;

                List<XmlLogItem> filtered;
                if (modoFiltro == 1) // Hoje
                {
                    filtered = allCopy.Where(x => x.DataEmissaoData == DateTime.Today).ToList();
                }
                else if (modoFiltro == 2) // Ontem
                {
                    filtered = allCopy.Where(x => x.DataEmissaoData == DateTime.Today.AddDays(-1)).ToList();
                }
                else if (modoFiltro == 3) // Últimos 7 dias
                {
                    DateTime d7 = DateTime.Today.AddDays(-7);
                    filtered = allCopy.Where(x => (x.DataEmissaoData ?? DateTime.MinValue) >= d7).ToList();
                }
                else if (modoFiltro == 4) // Data no Calendário
                {
                    filtered = allCopy.Where(x => x.DataEmissaoData == dataEscolhida).ToList();
                }
                else // 0 = Todas as Datas (Geral)
                {
                    filtered = allCopy;
                }

                // 6. Filtragem por busca rápida textual (Número, Data da Emissão, Valor Total, Chave de Acesso)
                string termoBusca = (txtBuscaRapida?.Text ?? "").Trim();
                if (!string.IsNullOrEmpty(termoBusca))
                {
                    string termoLower = termoBusca.ToLowerInvariant();
                    string termoDigitos = Regex.Replace(termoBusca, @"[^\d]", "");
                    string termoVirgula = termoBusca.Replace(".", ",");
                    string termoPonto = termoBusca.Replace(",", ".");

                    filtered = filtered.Where(x =>
                    {
                        // 1. Número da Nota (ex: 2954, 4543)
                        if (!string.IsNullOrEmpty(x.Numero))
                        {
                            if (x.Numero.Equals(termoBusca, StringComparison.OrdinalIgnoreCase)) return true;
                            if (!string.IsNullOrEmpty(termoDigitos) && x.Numero.Equals(termoDigitos, StringComparison.OrdinalIgnoreCase)) return true;
                            if (x.Numero.Contains(termoLower, StringComparison.OrdinalIgnoreCase)) return true;
                        }

                        // 2. Chave de Acesso (44 dígitos ou parte dela)
                        if (!string.IsNullOrEmpty(x.Chave))
                        {
                            if (x.Chave.Contains(termoLower, StringComparison.OrdinalIgnoreCase)) return true;
                            if (!string.IsNullOrEmpty(termoDigitos) && x.Chave.Contains(termoDigitos, StringComparison.OrdinalIgnoreCase)) return true;
                        }

                        // 3. Data da Emissão (ex: 01/10/2026, 01/10, 2026-10-01)
                        if (!string.IsNullOrEmpty(x.DataEmissao))
                        {
                            if (x.DataEmissao.Contains(termoLower, StringComparison.OrdinalIgnoreCase)) return true;
                            if (x.DataEmissaoData.HasValue)
                            {
                                string d1 = x.DataEmissaoData.Value.ToString("dd/MM/yyyy");
                                string d2 = x.DataEmissaoData.Value.ToString("dd/MM");
                                string d3 = x.DataEmissaoData.Value.ToString("yyyy-MM-dd");
                                if (d1.Contains(termoLower) || d2.Contains(termoLower) || d3.Contains(termoLower)) return true;
                            }
                        }

                        // 4. Valor Total (ex: 158,59 ou 158.59 ou 158)
                        if (x.ValorTotal > 0)
                        {
                            string vStrVirgula = x.ValorTotal.ToString("F2");
                            string vStrPonto = x.ValorTotal.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
                            string vStrInt = ((long)x.ValorTotal).ToString();
                            if (vStrVirgula.Contains(termoVirgula) || vStrPonto.Contains(termoPonto) || (!string.IsNullOrEmpty(termoDigitos) && vStrInt == termoDigitos)) return true;
                        }

                        // 5. Arquivo ou Status do Processamento
                        if (!string.IsNullOrEmpty(x.Arquivo) && x.Arquivo.Contains(termoLower, StringComparison.OrdinalIgnoreCase)) return true;
                        if (!string.IsNullOrEmpty(x.Status) && x.Status.Contains(termoLower, StringComparison.OrdinalIgnoreCase)) return true;

                        return false;
                    }).ToList();
                }

                // Inverter a ordem: Notas finais no início (mais recentes e com maior número no topo)
                filtered = filtered
                    .OrderByDescending(x => x.DataEmissaoData ?? DateTime.MinValue)
                    .ThenByDescending(x => x.NumeroLong)
                    .ThenByDescending(x => x.Timestamp)
                    .ToList();

                // Atualizar contador do filtro
                if (lblContadorFiltro != null && !lblContadorFiltro.IsDisposed)
                {
                    if (!string.IsNullOrEmpty(termoBusca))
                    {
                        lblContadorFiltro.Text = $"Filtrando: {filtered.Count} resultado(s) para \"{termoBusca}\"";
                        lblContadorFiltro.ForeColor = Color.FromArgb(2, 132, 199); // sky-600
                    }
                    else if (modoFiltro == 1 && filtered.Count == 0 && allCopy.Count > 0)
                    {
                        lblContadorFiltro.Text = $"0 notas hoje ({DateTime.Today:dd/MM}) • {allCopy.Count} no histórico geral (Escolha 'Todas as Datas')";
                        lblContadorFiltro.ForeColor = Color.FromArgb(217, 119, 6); // amber
                    }
                    else
                    {
                        lblContadorFiltro.Text = $"Exibindo {filtered.Count} nota(s) de {allCopy.Count} total";
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
                        else if (!string.IsNullOrEmpty(item.DataEmissao))
                        {
                            var m = System.Text.RegularExpressions.Regex.Match(item.DataEmissao, @"(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?");
                            if (m.Success)
                            {
                                string hora = m.Groups[4].Success ? $" {m.Groups[4].Value}:{m.Groups[5].Value}" : "";
                                emissaoFormatada = $"{m.Groups[3].Value}/{m.Groups[2].Value}/{m.Groups[1].Value}{hora}";
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
