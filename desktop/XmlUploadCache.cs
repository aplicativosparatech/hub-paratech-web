using System;
using System.Collections.Generic;
using System.IO;

namespace HubParatechDesktop
{
    public static class XmlUploadCache
    {
        private static readonly string CachePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "HubParatech",
            "uploaded_xmls.txt"
        );
        private static readonly HashSet<string> UploadedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private static readonly object LockObj = new object();

        static XmlUploadCache()
        {
            try
            {
                var dir = Path.GetDirectoryName(CachePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                if (File.Exists(CachePath))
                {
                    var lines = File.ReadAllLines(CachePath);
                    foreach (var line in lines)
                    {
                        var trimmed = line.Trim();
                        if (!string.IsNullOrEmpty(trimmed))
                        {
                            UploadedKeys.Add(trimmed);
                        }
                    }
                }
            }
            catch { }
        }

        public static bool IsUploaded(string fileIdentifier, string? chave = null)
        {
            lock (LockObj)
            {
                if (UploadedKeys.Contains(fileIdentifier)) return true;
                if (!string.IsNullOrEmpty(chave) && UploadedKeys.Contains(chave)) return true;
                return false;
            }
        }

        public static void MarkAsUploaded(string fileIdentifier, string? chave = null)
        {
            lock (LockObj)
            {
                bool addedAny = false;
                if (UploadedKeys.Add(fileIdentifier)) addedAny = true;
                if (!string.IsNullOrEmpty(chave) && UploadedKeys.Add(chave)) addedAny = true;

                if (addedAny)
                {
                    try
                    {
                        var list = new List<string> { fileIdentifier };
                        if (!string.IsNullOrEmpty(chave) && chave != fileIdentifier)
                        {
                            list.Add(chave);
                        }
                        File.AppendAllLines(CachePath, list);
                    }
                    catch { }
                }
            }
        }

        public static void Clear()
        {
            lock (LockObj)
            {
                UploadedKeys.Clear();
                try
                {
                    if (File.Exists(CachePath))
                    {
                        File.Delete(CachePath);
                    }
                }
                catch { }
            }
        }
    }
}
