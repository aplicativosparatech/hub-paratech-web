using System;
using System.Drawing;
using System.IO;
using System.Reflection;

namespace HubParatechDesktop
{
    public static class AppResources
    {
        private static Image? cachedLogo = null;
        private static Icon? cachedIcon = null;

        public static Image? GetLogo()
        {
            if (cachedLogo != null) return cachedLogo;
            try
            {
                if (File.Exists("logo.png"))
                {
                    cachedLogo = Image.FromFile("logo.png");
                    return cachedLogo;
                }
                var asm = Assembly.GetExecutingAssembly();
                using var stream = asm.GetManifestResourceStream("HubParatechDesktop.logo.png");
                if (stream != null)
                {
                    cachedLogo = Image.FromStream(stream);
                    return cachedLogo;
                }
            }
            catch { }
            return null;
        }

        public static Icon GetIcon()
        {
            if (cachedIcon != null) return cachedIcon;
            try
            {
                if (File.Exists("icon.ico"))
                {
                    cachedIcon = new Icon("icon.ico");
                    return cachedIcon;
                }
                var asm = Assembly.GetExecutingAssembly();
                using var stream = asm.GetManifestResourceStream("HubParatechDesktop.icon.ico");
                if (stream != null)
                {
                    cachedIcon = new Icon(stream);
                    return cachedIcon;
                }
            }
            catch { }
            return SystemIcons.Application;
        }
    }
}
