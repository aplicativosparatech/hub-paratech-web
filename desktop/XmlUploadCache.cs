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

        public static bool IsUploaded(string fileIdentifier)
        {
            lock (LockObj)
            {
                return UploadedKeys.Contains(fileIdentifier);
            }
        }

        public static void MarkAsUploaded(string fileIdentifier)
        {
            lock (LockObj)
            {
                if (UploadedKeys.Add(fileIdentifier))
                {
                    try
                    {
                        File.AppendAllLines(CachePath, new[] { fileIdentifier });
                    }
                    catch { }
                }
            }
        }
    }
}
