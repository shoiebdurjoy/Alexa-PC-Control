using System;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using AlexaPCAgent.Commands;
using AlexaPCAgent.Models;

namespace AlexaPCAgent.Services
{
    public class WebSocketClientService
    {
        private readonly string _serverUrl;
        private readonly string _agentToken;
        private readonly CommandRegistry _commandRegistry;
        private ClientWebSocket? _webSocket;
        private CancellationTokenSource? _cts;

        public event Action<bool>? OnConnectionStatusChanged;
        public event Action<string>? OnLogMessage;

        public bool IsConnected => _webSocket?.State == WebSocketState.Open;

        public WebSocketClientService(string serverUrl, string agentToken, CommandRegistry commandRegistry)
        {
            _serverUrl = serverUrl;
            _agentToken = agentToken;
            _commandRegistry = commandRegistry;
        }

        public void Start()
        {
            _cts = new CancellationTokenSource();
            _ = Task.Run(() => ConnectionLoopAsync(_cts.Token));
        }

        public void Stop()
        {
            _cts?.Cancel();
            if (_webSocket != null && _webSocket.State == WebSocketState.Open)
            {
                _ = _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Agent Stopping", CancellationToken.None);
            }
        }

        private async Task ConnectionLoopAsync(CancellationToken cancellationToken)
        {
            int retryDelayMs = 1000;
            const int maxRetryDelayMs = 30000;

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    OnLogMessage?.Invoke($"Connecting to backend WebSocket at {_serverUrl}...");
                    _webSocket = new ClientWebSocket();
                    _webSocket.Options.SetRequestHeader("X-Agent-Token", _agentToken);
                    _webSocket.Options.SetRequestHeader("X-Device-Id", Environment.MachineName);

                    await _webSocket.ConnectAsync(new Uri(_serverUrl), cancellationToken);
                    
                    OnLogMessage?.Invoke("Connected to Backend WebSocket Server.");
                    OnConnectionStatusChanged?.Invoke(true);
                    retryDelayMs = 1000; // Reset backoff on success

                    await ReceiveLoopAsync(_webSocket, cancellationToken);
                }
                catch (Exception ex)
                {
                    OnLogMessage?.Invoke($"WebSocket connection error: {ex.Message}");
                }
                finally
                {
                    OnConnectionStatusChanged?.Invoke(false);
                    _webSocket?.Dispose();
                    _webSocket = null;
                }

                if (!cancellationToken.IsCancellationRequested)
                {
                    OnLogMessage?.Invoke($"Reconnecting in {retryDelayMs / 1000}s...");
                    await Task.Delay(retryDelayMs, cancellationToken);
                    retryDelayMs = Math.Min(retryDelayMs * 2, maxRetryDelayMs);
                }
            }
        }

        private async Task ReceiveLoopAsync(ClientWebSocket webSocket, CancellationToken cancellationToken)
        {
            var buffer = new byte[8192];

            while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                using var ms = new MemoryStream();
                WebSocketReceiveResult result;
                
                do
                {
                    result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server closed socket", cancellationToken);
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                ms.Seek(0, SeekOrigin.Begin);
                if (result.MessageType == WebSocketMessageType.Text)
                {
                    string jsonMessage = Encoding.UTF8.GetString(ms.ToArray());
                    OnLogMessage?.Invoke($"Received message: {jsonMessage}");
                    _ = ProcessMessageAsync(jsonMessage);
                }
            }
        }

        private async Task ProcessMessageAsync(string jsonMessage)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<CommandPayload>(jsonMessage);
                if (payload == null) return;

                var result = await _commandRegistry.DispatchAsync(payload);
                await SendResponseAsync(payload.Command, result);
            }
            catch (Exception ex)
            {
                OnLogMessage?.Invoke($"Error processing payload: {ex.Message}");
            }
        }

        private async Task SendResponseAsync(string command, CommandResult result)
        {
            if (!IsConnected || _webSocket == null) return;

            try
            {
                var response = new
                {
                    version = "1.0",
                    command = command,
                    success = result.Success,
                    message = result.Message,
                    data = result.Data,
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                };

                string json = JsonSerializer.Serialize(response);
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (Exception ex)
            {
                OnLogMessage?.Invoke($"Error sending response: {ex.Message}");
            }
        }
    }
}
