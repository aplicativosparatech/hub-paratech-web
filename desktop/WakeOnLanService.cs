using System;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace HubParatechDesktop
{
    public static class WakeOnLanService
    {
        /// <summary>
        /// Dispara o pacote mágico UDP (Wake-on-LAN) para acordar uma máquina na rede local
        /// </summary>
        public static void SendWakeOnLan(string macAddress, string broadcastIp = "255.255.255.255", int port = 9)
        {
            try
            {
                var cleanMac = (macAddress ?? "").Replace(":", "").Replace("-", "").Trim();
                if (cleanMac.Length != 12)
                {
                    Debug.WriteLine($"[WOL] MAC Address inválido: '{macAddress}'");
                    return;
                }

                byte[] macBytes = Enumerable.Range(0, cleanMac.Length)
                    .Where(x => x % 2 == 0)
                    .Select(x => Convert.ToByte(cleanMac.Substring(x, 2), 16))
                    .ToArray();

                // Magic Packet: 6 bytes de 0xFF seguidos de 16 repetições do MAC
                byte[] packet = new byte[102];
                for (int i = 0; i < 6; i++) packet[i] = 0xFF;
                for (int i = 1; i <= 16; i++)
                {
                    Buffer.BlockCopy(macBytes, 0, packet, i * 6, 6);
                }

                using var client = new UdpClient();
                client.EnableBroadcast = true;
                client.Send(packet, packet.Length, new IPEndPoint(IPAddress.Parse(broadcastIp), port));
                Debug.WriteLine($"[WOL] Magic packet enviado para {cleanMac} via {broadcastIp}:{port}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WOL] Erro ao enviar pacote Wake-on-LAN: {ex.Message}");
            }
        }

        /// <summary>
        /// Obtém o primeiro IP local IPv4 ativo e o MAC Address da placa física
        /// </summary>
        public static (string ipLocal, string macAddress) GetLocalNetworkInfo()
        {
            string ip = "";
            string mac = "";
            try
            {
                foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus == OperationalStatus.Up &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        nic.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
                    {
                        var props = nic.GetIPProperties();
                        foreach (var addr in props.UnicastAddresses)
                        {
                            if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                            {
                                ip = addr.Address.ToString();
                                byte[] bytes = nic.GetPhysicalAddress().GetAddressBytes();
                                if (bytes != null && bytes.Length == 6)
                                {
                                    mac = string.Join(":", bytes.Select(b => b.ToString("X2")));
                                }
                                break;
                            }
                        }
                        if (!string.IsNullOrEmpty(ip) && !string.IsNullOrEmpty(mac)) break;
                    }
                }
            }
            catch { }
            return (ip, mac);
        }
    }
}
