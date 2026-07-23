using System.Threading;
using System.Threading.Tasks;
using AlexaPCAgent.Models;

namespace AlexaPCAgent.Commands
{
    public interface ICommand
    {
        string CommandName { get; }
        Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken);
    }
}
