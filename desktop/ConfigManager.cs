using System;
using System.IO;
using System.Text.Json;

namespace HubParatechDesktop
{
    public class ConfigData
    {
        public string HubToken { get; set; } = "";
        public bool ModoOculto { get; set; } = false;
        public bool IniciarComWindows { get; set; } = true;
    }

    public static class ConfigManager
    {
        private static readonly string ConfigPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "HubParatech", "config.json");

        public static ConfigData Load()
        {
            try
            {
                if (File.Exists(ConfigPath))
                {
                    var json = File.ReadAllText(ConfigPath);
                    return JsonSerializer.Deserialize<ConfigData>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new ConfigData();
                }
            }
            catch { }
            return new ConfigData();
        }

        public static void Save(ConfigData data)
        {
            try
            {
                var dir = Path.GetDirectoryName(ConfigPath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir!);
                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(ConfigPath, json);
            }
            catch { }
        }
    }
}
