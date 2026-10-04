using System;
using System.IO;
using System.Text.Json;

namespace HubParatechDesktop
{
    public class ConfigData
    {
        public string HubToken { get; set; } = "";
    }

    public static class ConfigManager
    {
        private static readonly string ConfigPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "HubParatech", "config.json");

        public static ConfigData Load()
        {
            if (File.Exists(ConfigPath))
            {
                var json = File.ReadAllText(ConfigPath);
                return JsonSerializer.Deserialize<ConfigData>(json) ?? new ConfigData();
            }
            return new ConfigData();
        }

        public static void Save(ConfigData data)
        {
            var dir = Path.GetDirectoryName(ConfigPath);
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir!);
            var json = JsonSerializer.Serialize(data);
            File.WriteAllText(ConfigPath, json);
        }
    }
}
