using System;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

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
        private NotifyIcon trayIcon;
        private System.Windows.Forms.Timer syncTimer;
        private System.Windows.Forms.Timer processTimer;
        private static readonly HttpClient http = new HttpClient();
        private BlockerForm? activeBlocker = null;

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
        private DateTime lastSync = DateTime.MinValue;

        public TrayContext()
        {
            trayIcon = new NotifyIcon()
            {
                Icon = new Icon("icon.ico"),
                ContextMenuStrip = new ContextMenuStrip(),
                Visible = true,
                Text = "Hub Paratech v2.3.0 - Monitorando"
            };

            var itemVersao = new ToolStripMenuItem("Hub Paratech v2.3.0") { Enabled = false, Font = new Font(Control.DefaultFont, FontStyle.Bold) };
            trayIcon.ContextMenuStrip.Items.Add(itemVersao);
            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());

            trayIcon.ContextMenuStrip.Items.Add("Ver Status Interno", null, (s, e) => {
                string procs = targetProcesses.Count > 0 ? string.Join(", ", targetProcesses) : "Nenhum processo restrito";
                string syncTxt = lastSync > DateTime.MinValue ? lastSync.ToString("dd/MM/yyyy HH:mm:ss") : "Pendente";
                string msg = $"Status Operacional do Hub Paratech:\n\n" +
                             $"• Situação do Sistema: {(isBlocked ? "BLOQUEADO" : "LIBERADO / REGULAR")}\n" +
                             $"• Processos Alvo: {procs}\n" +
                             $"• Modo de Operação: {currentModoProcessamento.ToUpper()}\n" +
                             $"• Monitores XML Ativos: {activeMonitors.Count}\n" +
                             $"• Fatura Pendente: R$ {faturaValor:F2}\n" +
                             $"• Empresa: {(string.IsNullOrEmpty(clienteNome) ? "Cliente Paratech" : clienteNome)}\n" +
                             $"• Última Sincronização: {syncTxt}";
                ParatechDialog.ShowInfo(msg, "Status do Hub Paratech");
            });

            trayIcon.ContextMenuStrip.Items.Add("Sincronizar Agora", null, async (s, e) => {
                await SyncWithServer();
                foreach (var m in activeMonitors) m.TriggerScan();
                ParatechDialog.ShowSuccess("Sincronização com o Portal Paratech concluída com sucesso!\nTodos os diretórios de notas foram verificados.", "Sincronização Concluída");
            });

            trayIcon.ContextMenuStrip.Items.Add("Configurar Token", null, SetupToken);
            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());

            trayIcon.ContextMenuStrip.Items.Add("Sobre o Hub Paratech...", null, (s, e) => {
                new AboutForm(ConfigManager.Load().HubToken, lastSync, currentModoProcessamento).ShowDialog();
            });

            trayIcon.ContextMenuStrip.Items.Add(new ToolStripSeparator());
            trayIcon.ContextMenuStrip.Items.Add("Sair", null, Exit);

            trayIcon.ShowBalloonTip(3000, "Hub Paratech v2.3.0", "Iniciado e monitorando os sistemas.", ToolTipIcon.Info);
            EnableAutoStart();

            // Timer para sincronizar com a nuvem a cada 1 hora (3600000 ms)
            syncTimer = new System.Windows.Forms.Timer();
            syncTimer.Interval = 3600000;
            syncTimer.Tick += async (s, e) => await SyncWithServer();
            syncTimer.Start();

            // Timer para matar o processo alvo se estiver bloqueado (ex: a cada 2 segundos)
            processTimer = new System.Windows.Forms.Timer();
            processTimer.Interval = 2000;
            processTimer.Tick += ProcessTimer_Tick;
            processTimer.Start();

            // Faz a primeira sincronização instantaneamente
            _ = SyncWithServer();
        }

        private async Task SyncWithServer()
        {
            var config = ConfigManager.Load();
            if (string.IsNullOrEmpty(config.HubToken)) return;

            try
            {
                var jsonReq = JsonSerializer.Serialize(new { token = config.HubToken });
                var content = new StringContent(jsonReq, System.Text.Encoding.UTF8, "application/json");
                
                // Usando a URL real de produção da Vercel
                var response = await http.PostAsync("https://hub-paratech-web.vercel.app/api/hub/sync", content);
                
                if (response.IsSuccessStatusCode)
                {
                    var resJson = await response.Content.ReadAsStringAsync();
                    var data = JsonSerializer.Deserialize<SyncResponse>(resJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (data != null)
                    {
                        isBlocked = data.bloqueado;
                        
                        targetProcesses.Clear();
                        
                        // Adiciona o executável antigo (se houver)
                        if (!string.IsNullOrWhiteSpace(data.executavel)) 
                        {
                            targetProcesses.Add(data.executavel.Replace(".exe", "", StringComparison.OrdinalIgnoreCase));
                        }

                        // Adiciona a lista de executáveis novos (campo texto do configuracoes_hub configurado pelo usuário)
                        if (data.executaveis != null)
                        {
                            foreach (var exeInfo in data.executaveis)
                            {
                                // O JSON salva as strings, que pode conter quebras de linha dependendo do textarea.
                                // Na nossa base ele separa por quebra de linha. Se a string vier com \n, a gente dá split.
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
                        
                        // Configurar modo de processamento (hub ou portal)
                        string novoModo = !string.IsNullOrWhiteSpace(data.modo_processamento) ? data.modo_processamento : "hub";
                        currentModoProcessamento = novoModo;

                        // Atualiza o modo nos monitores já em execução
                        foreach (var m in activeMonitors)
                        {
                            m.SetModoProcessamento(currentModoProcessamento);
                        }

                        // Configurar monitores de XML
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
                                    if (!string.IsNullOrWhiteSpace(p)) activeMonitors.Add(new XmlMonitor(p.Trim().Replace(@"\\", @"\"), "vendas", ConfigManager.Load().HubToken, http, currentModoProcessamento));
                                }
                            }

                            if (data.pastas_compras != null)
                            {
                                foreach (string p in data.pastas_compras)
                                {
                                    if (!string.IsNullOrWhiteSpace(p)) activeMonitors.Add(new XmlMonitor(p.Trim().Replace(@"\\", @"\"), "compras", ConfigManager.Load().HubToken, http, currentModoProcessamento));
                                }
                            }

                            currentVendasStr = novasVendasStr;
                            currentComprasStr = novasComprasStr;
                        }

                        // Se não estiver mais bloqueado e a tela estiver aberta, fecha ela
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
                // Se der erro de internet, mantém o último estado conhecido (isBlocked)
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

            // Exibe a tela de bloqueio se não estiver visível E tiver matado algum
            // Ou se já quisermos exibir a tela direto:
            // Por segurança, vamos exibir se matou ou se já tiver ativa (para bloquear uso)
            if (killedAny)
            {
                if (activeBlocker == null || activeBlocker.IsDisposed)
                {
                    activeBlocker = new BlockerForm(pixPayload, faturaValor, offlineSecret, faturaVencimento, clienteNome);
                    
                    // Adiciona evento para saber quando a tela é fechada pelo Desbloqueio Offline
                    activeBlocker.FormClosed += (s, ev) => {
                        if (activeBlocker.IsOfflineUnlocked)
                        {
                            isBlocked = false; // Desbloqueia temporariamente localmente
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
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey("SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run", true);
                key?.SetValue("HubParatech", Application.ExecutablePath);
            }
            catch { }
        }
    }
}
