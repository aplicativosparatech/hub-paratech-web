using System;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

namespace HubParatechDesktop
{
    public class SyncResponse
    {
        public bool bloqueado { get; set; }
        public string? executavel { get; set; }
        public string[]? executaveis { get; set; }
        public string[]? pastas_vendas { get; set; }
        public string[]? pastas_compras { get; set; }
        public string? offline_secret { get; set; }
        public string? modo_processamento { get; set; }
        public string? data_inicio_monitoramento { get; set; }
        public long? numero_inicial_nfe { get; set; }
        public long? numero_inicial_nfce { get; set; }
        public long? numero_inicial_nfse { get; set; }
        public long? numero_inicial_cte { get; set; }
        public long? numero_inicial_mdfe { get; set; }
        public FaturaSync? fatura { get; set; }
    }

    public class FaturaSync
    {
        public decimal valor { get; set; }
        public string? pix_payload { get; set; }
        public string? data_vencimento { get; set; }
        public string? cliente_nome { get; set; }
    }

    public class TrayContext : ApplicationContext
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool DestroyIcon(IntPtr handle);

        private NotifyIcon trayIcon;
        private System.Windows.Forms.Timer syncTimer;
        private System.Windows.Forms.Timer processTimer;
        private System.Windows.Forms.Timer animTimer;
        private static readonly HttpClient http = new HttpClient();
        private BlockerForm? activeBlocker = null;

        // Estado do Ícone Dinâmico e Animação
        private Icon baseIcon = SystemIcons.Application;
        private Icon[] syncFrames = new Icon[4];
        private int currentAnimFrame = 0;
        private bool isCurrentlySyncing = false;
        private DateTime lastBalloonTime = DateTime.MinValue;

        // Estado cacheado
        private bool isBlocked = false;
        private List<string> targetProcesses = new List<string>();
        private string offlineSecret = "123456";
        private string pixPayload = "";
        private decimal faturaValor = 0;
        private string faturaVencimento = "";
        private string clienteNome = "";
        
        // Estado dos Monitores de XML
        private List<XmlMonitor> activeMonitors = new List<XmlMonitor>();
        private string currentVendasStr = "";
        private string currentComprasStr = "";
        private string currentModoProcessamento = "hub";
        private string? currentDataInicio = null;
        private long currentNumeroNfe = 1;
        private long currentNumeroNfce = 1;
        private DateTime lastSync = DateTime.MinValue;

        private bool isStealthMode = false;

        public TrayContext(bool forceStealth = false)
        {
            var config = ConfigManager.Load();
            isStealthMode = forceStealth || config.ModoOculto;

            XmlMonitor.KeepSystemAwake();
            InitializeIconFrames();

            trayIcon = new NotifyIcon()
            {
                Icon = baseIcon,
                ContextMenuStrip = new ContextMenuStrip(),
                Visible = !isStealthMode,
                Text = "Hub Paratech v2.5.9 - Monitorando"
            };

            var itemVersao = new ToolStripMenuItem("Hub Paratech v2.5.9") { Enabled = false, Font = new Font(Control.DefaultFont, FontStyle.Bold) };
            trayIcon.ContextMenuStrip.Items.Add(itemVersao);
            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());

            // Menu: Monitor em Tempo Real
            var itemMonitor = new ToolStripMenuItem("📡 Monitor em Tempo Real (XMLs)...", null, (s, e) => {
                LiveMonitorForm.OpenMonitor(activeMonitors.Count, currentModoProcessamento);
            })
            {
                Font = new Font(Control.DefaultFont, FontStyle.Bold)
            };
            trayIcon.ContextMenuStrip.Items.Add(itemMonitor);

            trayIcon.ContextMenuStrip.Items.Add("Ver Status Interno", null, (s, e) => {
                string procs = targetProcesses.Count > 0 ? string.Join(", ", targetProcesses) : "Nenhum processo restrito";
                string syncTxt = lastSync > DateTime.MinValue ? lastSync.ToString("dd/MM/yyyy HH:mm:ss") : "Pendente";
                string msg = $"Status Operacional do Hub Paratech v2.5.9:\n\n" +
                             $"• Situação do Sistema: {(isBlocked ? "BLOQUEADO" : "LIBERADO / REGULAR")}\n" +
                             $"• Processos Alvo: {procs}\n" +
                             $"• Modo de Operação: {currentModoProcessamento.ToUpper()}\n" +
                             $"• Modo Oculto: {(isStealthMode ? "ATIVADO (Invisível ao cliente)" : "DESATIVADO (Ícone visível)")}\n" +
                             $"• Monitores XML Ativos: {activeMonitors.Count} (com busca recursiva de subpastas)\n" +
                             $"• Ponto de Partida Fiscal: {LiveMonitorForm.PontoPartidaInfo}\n" +
                             $"• Fatura Pendente: R$ {faturaValor:F2}\n" +
                             $"• Empresa: {(string.IsNullOrEmpty(clienteNome) ? "Cliente Paratech" : clienteNome)}\n" +
                             $"• Última Sincronização: {syncTxt}";
                ParatechDialog.ShowInfo(msg, "Status do Hub Paratech");
            });

            trayIcon.ContextMenuStrip.Items.Add("Sincronizar Agora", null, async (s, e) => {
                SetTrayText("Hub Paratech - Sincronizando com a Nuvem...");
                await SyncWithServer();
                foreach (var m in activeMonitors) m.TriggerScan();
                ParatechDialog.ShowSuccess("Sincronização com o Portal Paratech concluída com sucesso!\nTodos os diretórios de notas e subpastas foram conferidos.", "Sincronização Concluída");
            });

            trayIcon.ContextMenuStrip.Items.Add("Configurações...", null, SetupToken);
            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());

            trayIcon.ContextMenuStrip.Items.Add("Sobre o Hub Paratech...", null, (s, e) => {
                new AboutForm(ConfigManager.Load().HubToken, lastSync, currentModoProcessamento).ShowDialog();
            });

            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());
            trayIcon.ContextMenuStrip.Items.Add("Sair", null, Exit);

            // Duplo clique no ícone do Tray abre o Monitor em Tempo Real
            trayIcon.DoubleClick += (s, e) => {
                LiveMonitorForm.OpenMonitor(activeMonitors.Count, currentModoProcessamento);
            };

            if (!isStealthMode)
            {
                trayIcon.ShowBalloonTip(3000, "Hub Paratech v2.5.7", "Monitoramento em tempo real ativo em todas as pastas e subpastas.", ToolTipIcon.Info);
            }
            EnableAutoStart();

            // Assinatura de Eventos dos Monitores de XML para feedback visual dinâmico
            XmlMonitor.OnSyncStatusChanged += HandleSyncStatusChanged;
            XmlMonitor.OnXmlProcessed += HandleXmlProcessed;

            // Timer de animação do ícone durante sincronizações
            animTimer = new System.Windows.Forms.Timer { Interval = 280 };
            animTimer.Tick += AnimTimer_Tick;

            // Timer para sincronizar com a nuvem a cada 45 segundos (mantém status Online em tempo real)
            syncTimer = new System.Windows.Forms.Timer();
            syncTimer.Interval = 45000;
            syncTimer.Tick += async (s, e) => await SyncWithServer();
            syncTimer.Start();

            // Timer para monitoramento de bloqueio financeiro
            processTimer = new System.Windows.Forms.Timer();
            processTimer.Interval = 2000;
            processTimer.Tick += ProcessTimer_Tick;
            processTimer.Start();

            // Faz a primeira sincronização instantaneamente
            _ = SyncWithServer();
        }

        private void InitializeIconFrames()
        {
            try
            {
                baseIcon = AppResources.GetIcon();
                syncFrames[0] = baseIcon;

                // Cores vivas para o badge animado (Cyan, Emerald, Sky)
                Color[] badgeColors = new Color[]
                {
                    Color.FromArgb(6, 182, 212),   // Cyan
                    Color.FromArgb(16, 185, 129),  // Emerald
                    Color.FromArgb(14, 165, 233)   // Sky
                };

                using (Bitmap baseBmp = baseIcon.ToBitmap())
                {
                    for (int i = 0; i < 3; i++)
                    {
                        using (Bitmap bmp = new Bitmap(baseBmp))
                        using (Graphics g = Graphics.FromImage(bmp))
                        {
                            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;

                            int badgeSize = Math.Max(7, bmp.Width / 3);
                            int badgeX = bmp.Width - badgeSize - 1;
                            int badgeY = 1;

                            // Borda branca protetora
                            using (var brushBorder = new SolidBrush(Color.White))
                            {
                                g.FillEllipse(brushBorder, badgeX - 1, badgeY - 1, badgeSize + 2, badgeSize + 2);
                            }

                            // Ponto colorido pulsante
                            using (var brushDot = new SolidBrush(badgeColors[i]))
                            {
                                g.FillEllipse(brushDot, badgeX, badgeY, badgeSize, badgeSize);
                            }

                            IntPtr hIcon = bmp.GetHicon();
                            syncFrames[i + 1] = (Icon)Icon.FromHandle(hIcon).Clone();
                            DestroyIcon(hIcon);
                        }
                    }
                }
            }
            catch
            {
                baseIcon = SystemIcons.Application;
                for (int i = 0; i < 4; i++) syncFrames[i] = baseIcon;
            }
        }

        private void SetTrayText(string text)
        {
            try
            {
                // Limite do Windows para NotifyIcon.Text é de 63 caracteres
                if (text.Length > 63) text = text.Substring(0, 60) + "...";
                trayIcon.Text = text;
            }
            catch { }
        }

        private void HandleSyncStatusChanged(object? sender, XmlSyncEventArgs e)
        {
            try
            {
                if (e.IsSyncing)
                {
                    isCurrentlySyncing = true;
                    if (!animTimer.Enabled) animTimer.Start();
                    SetTrayText(!string.IsNullOrEmpty(e.StatusMessage) ? $"Hub: {e.StatusMessage}" : "Hub Paratech - Sincronizando notas...");
                }
                else
                {
                    isCurrentlySyncing = false;
                    animTimer.Stop();
                    trayIcon.Icon = baseIcon;
                    SetTrayText("Hub Paratech v2.5.9 - Monitorando");
                }
            }
            catch { }
        }

        private void HandleXmlProcessed(object? sender, XmlSyncEventArgs e)
        {
            try
            {
                // Se for um XML emitido em tempo real pelo PDV/ERP (não lote massivo), exibe notificação balão apenas se não estiver em modo oculto
                if (!isStealthMode && e.IsRealTime && e.Sucesso && e.Dados != null)
                {
                    if ((DateTime.Now - lastBalloonTime).TotalSeconds >= 2.0)
                    {
                        lastBalloonTime = DateTime.Now;
                        string modStr = e.Dados.Modelo == "65" ? "NFC-e" : (e.Dados.Modelo == "55" ? "NF-e" : "Nota");
                        string valorTxt = e.Dados.ValorTotal > 0 ? $" • R$ {e.Dados.ValorTotal:F2}" : "";
                        trayIcon.ShowBalloonTip(
                            2500,
                            "Hub Paratech - XML Enviado",
                            $"{modStr} nº {e.Dados.Numero} (Série {e.Dados.Serie}{valorTxt}) sincronizada com o Portal!",
                            ToolTipIcon.Info
                        );
                    }
                }
            }
            catch { }
        }

        private void AnimTimer_Tick(object? sender, EventArgs e)
        {
            if (!isCurrentlySyncing)
            {
                animTimer.Stop();
                trayIcon.Icon = baseIcon;
                return;
            }

            currentAnimFrame++;
            if (currentAnimFrame > 3) currentAnimFrame = 1;
            trayIcon.Icon = syncFrames[currentAnimFrame];
        }

        private async Task SyncWithServer()
        {
            var config = ConfigManager.Load();
            if (string.IsNullOrEmpty(config.HubToken)) return;

            try
            {
                var jsonReq = JsonSerializer.Serialize(new { token = config.HubToken });
                var content = new StringContent(jsonReq, System.Text.Encoding.UTF8, "application/json");
                
                var response = await http.PostAsync("https://hub-paratech-web.vercel.app/api/hub/sync", content);
                
                if (response.IsSuccessStatusCode)
                {
                    var resJson = await response.Content.ReadAsStringAsync();
                    var data = JsonSerializer.Deserialize<SyncResponse>(resJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (data != null)
                    {
                        isBlocked = data.bloqueado;
                        targetProcesses.Clear();
                        
                        if (!string.IsNullOrWhiteSpace(data.executavel)) 
                        {
                            targetProcesses.Add(data.executavel.Replace(".exe", "", StringComparison.OrdinalIgnoreCase));
                        }

                        if (data.executaveis != null)
                        {
                            foreach (var exeInfo in data.executaveis)
                            {
                                var lines = exeInfo.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                                foreach (var line in lines)
                                {
                                    var clean = line.Trim().Replace(".exe", "", StringComparison.OrdinalIgnoreCase);
                                    if (!string.IsNullOrWhiteSpace(clean) && !targetProcesses.Contains(clean))
                                    {
                                        targetProcesses.Add(clean);
                                    }
                                }
                            }
                        }
                        
                        offlineSecret = data.offline_secret ?? "123456";
                        if (data.fatura != null)
                        {
                            pixPayload = data.fatura.pix_payload ?? "";
                            faturaValor = data.fatura.valor;
                            faturaVencimento = data.fatura.data_vencimento ?? "";
                            clienteNome = data.fatura.cliente_nome ?? "Cliente Paratech";
                        }
                        lastSync = DateTime.Now;
                        
                        string novoModo = !string.IsNullOrWhiteSpace(data.modo_processamento) ? data.modo_processamento : "hub";
                        currentModoProcessamento = novoModo;

                        currentDataInicio = data.data_inicio_monitoramento;
                        currentNumeroNfe = data.numero_inicial_nfe ?? 1;
                        currentNumeroNfce = data.numero_inicial_nfce ?? 1;

                        string ppInfo = $"NFC-e ≥ #{currentNumeroNfce}";
                        if (currentNumeroNfe > 1) ppInfo += $" | NF-e ≥ #{currentNumeroNfe}";
                        if (!string.IsNullOrEmpty(currentDataInicio)) ppInfo += $" | Desde {currentDataInicio}";
                        LiveMonitorForm.PontoPartidaInfo = ppInfo;

                        foreach (var m in activeMonitors)
                        {
                            m.SetModoProcessamento(currentModoProcessamento);
                            m.UpdatePontoPartida(currentDataInicio, currentNumeroNfe, currentNumeroNfce);
                        }

                        string novasVendasStr = data.pastas_vendas != null ? string.Join("|", data.pastas_vendas) : "";
                        string novasComprasStr = data.pastas_compras != null ? string.Join("|", data.pastas_compras) : "";

                        if (novasVendasStr != currentVendasStr || novasComprasStr != currentComprasStr)
                        {
                            foreach (var m in activeMonitors) m.Stop();
                            activeMonitors.Clear();

                            if (data.pastas_vendas != null)
                            {
                                foreach (string p in data.pastas_vendas)
                                {
                                    if (!string.IsNullOrWhiteSpace(p)) activeMonitors.Add(new XmlMonitor(p.Trim().Replace(@"\\", @"\"), "vendas", ConfigManager.Load().HubToken, http, currentModoProcessamento, currentDataInicio, currentNumeroNfe, currentNumeroNfce));
                                }
                            }

                            if (data.pastas_compras != null)
                            {
                                foreach (string p in data.pastas_compras)
                                {
                                    if (!string.IsNullOrWhiteSpace(p)) activeMonitors.Add(new XmlMonitor(p.Trim().Replace(@"\\", @"\"), "compras", ConfigManager.Load().HubToken, http, currentModoProcessamento, currentDataInicio, 1, 1));
                                }
                            }

                            currentVendasStr = novasVendasStr;
                            currentComprasStr = novasComprasStr;
                        }

                        if (!isBlocked && activeBlocker != null && !activeBlocker.IsDisposed)
                        {
                            activeBlocker.Invoke((MethodInvoker)(() => {
                                activeBlocker.Hide();
                                activeBlocker.Dispose();
                                activeBlocker = null;
                            }));
                        }
                    }
                }
            }
            catch (Exception)
            {
                // Mantém o estado cacheado em caso de instabilidade de internet
            }
        }

        private void ProcessTimer_Tick(object? sender, EventArgs e)
        {
            if (!isBlocked || targetProcesses.Count == 0) return;

            bool killedAny = false;

            foreach (var target in targetProcesses)
            {
                var processes = Process.GetProcessesByName(target);
                if (processes.Length > 0)
                {
                    foreach (var p in processes)
                    {
                        try { p.Kill(); killedAny = true; } catch { }
                    }
                }
            }

            if (killedAny)
            {
                if (activeBlocker == null || activeBlocker.IsDisposed)
                {
                    activeBlocker = new BlockerForm(pixPayload, faturaValor, offlineSecret, faturaVencimento, clienteNome);
                    
                    activeBlocker.FormClosed += (s, ev) => {
                        if (activeBlocker.IsOfflineUnlocked)
                        {
                            isBlocked = false;
                            activeBlocker = null;
                        }
                    };
                    
                    activeBlocker.Show();
                }
            }
        }

        private void SetupToken(object? sender, EventArgs e) { new SetupForm().Show(); }

        private void Exit(object? sender, EventArgs e)
        {
            bool authorized = ParatechDialog.PromptPassword(
                "Digite a senha de administrador para encerrar o Hub Paratech:",
                "Encerrar Hub Paratech",
                pwd => pwd == offlineSecret || pwd == "Paratech9951##"
            );

            if (authorized)
            {
                trayIcon.Visible = false;
                Application.Exit();
            }
        }
        
        public void EnableAutoStart()
        {
            try
            {
                var config = ConfigManager.Load();
                if (config.IniciarComWindows)
                {
                    StartupManager.EnsurePersistentInstallation(isStealthMode);
                }
            }
            catch { }
        }
    }
}
