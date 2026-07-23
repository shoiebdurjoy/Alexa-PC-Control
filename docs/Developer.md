# Developer Guide

## 🛠️ Codebase Structure

```
Alexa-PC-Control/
├── docs/                   # Architecture, Installation, Developer & Command specs
├── alexa-skill/            # ASK SDK Custom Skill & Interaction Model JSON
├── backend-api/            # Node.js TypeScript WebSocket hub & HTTP bridge
└── windows-pc-agent/       # C# .NET 8 WinForms System Tray background agent
```

---

## 💻 Windows Agent Architecture (C# .NET 8)

The Windows agent is designed around the **Command Pattern** for modularity and future extensibility.

### Core Interfaces & Classes

1. **`ICommand`**:
   ```csharp
   public interface ICommand
   {
       string CommandName { get; }
       Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken);
   }
   ```
2. **`CommandRegistry`**:
   Holds the mapping of string command identifiers (e.g. `"LOCK"`, `"SET_VOLUME"`) to concrete `ICommand` handler instances.
3. **`InternalSchedulerService`**:
   Manages scheduled execution of delayed power actions (e.g., shutdown in 30 minutes) using `System.Threading.CancellationTokenSource`.
4. **`CoreAudioApi`**:
   Native P/Invoke interface for Windows Audio Session API (WASAPI `MMDeviceEnumerator` and `IAudioEndpointVolume`). Allows exact scalar volume setting (0.0 to 1.0) and mute toggling without hotkey simulation.

---

## 🔮 Extending the Command Registry (Adding New Commands)

To add a new command in future releases (e.g. `OPEN_APP`, `BRIGHTNESS`, `SCREENSHOT`):

1. **Define Payload**: Add payload type or parameters in `CommandPayload.cs`.
2. **Create Handler**: Implement `ICommand`:
   ```csharp
   public class LaunchAppCommand : ICommand
   {
       public string CommandName => "LAUNCH_APP";
       public async Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
       {
           // Secure predefined app lookup (e.g. "chrome", "vscode")
           // Execute action
           return CommandResult.Success("Launched application");
       }
   }
   ```
3. **Register Handler**: Register in `CommandRegistry.cs`:
   ```csharp
   _registry.Register(new LaunchAppCommand());
   ```
4. **Update Skill**: Add corresponding Intent & Utterance in `alexa-skill/interactionModels/custom/en-US.json`.

---

## 🧪 Local Testing Workflow

1. Start Backend API locally (`npm run dev` in `backend-api`).
2. Run PC Agent in Debug mode (`dotnet run` in `windows-pc-agent/src/AlexaPCAgent`).
3. Send test HTTP payload directly to Backend API using cURL / Postman:
   ```bash
   curl -X POST http://localhost:8080/api/command \
     -H "Content-Type: application/json" \
     -H "X-Skill-Secret: YOUR_SECURE_SKILL_SECRET" \
     -d '{"command": "LOCK"}'
   ```
4. Verify sub-100ms workstation locking action.
