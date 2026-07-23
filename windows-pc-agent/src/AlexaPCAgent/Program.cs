using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;

namespace AlexaPCAgent
{
    internal static class Program
    {
        private static Mutex? _singleInstanceMutex;

        [STAThread]
        static void Main()
        {
            const string mutexName = @"Global\AlexaPCAgent_SingleInstance_Mutex_v1";
            _singleInstanceMutex = new Mutex(true, mutexName, out bool createdNew);

            if (!createdNew)
            {
                // Single instance check: Another instance of AlexaPCAgent is already running. Exit silently.
                return;
            }

            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
                string backendUrl = "wss://alexa-pc-control-backend.onrender.com/ws";
                string agentToken = "DEFAULT_AGENT_SECRET_TOKEN";

                if (File.Exists(configPath))
                {
                    try
                    {
                        string json = File.ReadAllText(configPath);
                        using var doc = JsonDocument.Parse(json);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("BackendWebSocketUrl", out var urlProp)) backendUrl = urlProp.GetString() ?? backendUrl;
                        if (root.TryGetProperty("AgentToken", out var tokenProp)) agentToken = tokenProp.GetString() ?? agentToken;
                    }
                    catch { }
                }

                Application.Run(new AppContext(backendUrl, agentToken));
            }
            finally
            {
                if (_singleInstanceMutex != null)
                {
                    try { _singleInstanceMutex.ReleaseMutex(); } catch { }
                    _singleInstanceMutex.Dispose();
                }
            }
        }
    }
}
