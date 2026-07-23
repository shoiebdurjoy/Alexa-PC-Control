using System;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;

namespace AlexaPCAgent
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            ApplicationConfiguration.Initialize();

            string configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
            string backendUrl = "wss://localhost:8080/ws";
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
    }
}
