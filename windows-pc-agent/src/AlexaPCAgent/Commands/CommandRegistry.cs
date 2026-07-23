using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using AlexaPCAgent.Models;

namespace AlexaPCAgent.Commands
{
    public class CommandRegistry
    {
        private readonly ConcurrentDictionary<string, ICommand> _handlers = new(StringComparer.OrdinalIgnoreCase);

        public void Register(ICommand command)
        {
            _handlers[command.CommandName] = command;
        }

        public bool HasCommand(string commandName)
        {
            return _handlers.ContainsKey(commandName);
        }

        public async Task<CommandResult> DispatchAsync(CommandPayload payload, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(payload.Command))
            {
                return CommandResult.Fail("Command name is empty.");
            }

            if (_handlers.TryGetValue(payload.Command, out var handler))
            {
                return await handler.ExecuteAsync(payload, cancellationToken);
            }

            return CommandResult.Fail($"Unknown command: {payload.Command}");
        }
    }
}
