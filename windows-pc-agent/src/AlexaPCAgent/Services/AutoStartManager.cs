using System;
using Microsoft.Win32;

namespace AlexaPCAgent.Services
{
    public static class AutoStartManager
    {
        private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppName = "AlexaPCAgent";

        public static bool IsAutoStartEnabled()
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, false);
                return key?.GetValue(AppName) != null;
            }
            catch
            {
                return false;
            }
        }

        public static bool SetAutoStart(bool enable)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RunKeyPath, true);
                if (key == null) return false;

                if (enable)
                {
                    string executablePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName 
                        ?? AppDomain.CurrentDomain.BaseDirectory + "AlexaPCAgent.exe";
                    key.SetValue(AppName, $"\"{executablePath}\"");
                }
                else
                {
                    key.DeleteValue(AppName, false);
                }
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
