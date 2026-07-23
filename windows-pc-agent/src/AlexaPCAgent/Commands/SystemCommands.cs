using System;
using System.Threading;
using System.Threading.Tasks;
using AlexaPCAgent.Models;
using AlexaPCAgent.Native;
using AlexaPCAgent.Services;

namespace AlexaPCAgent.Commands
{
    public class LockCommand : ICommand
    {
        public string CommandName => "LOCK";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            bool success = Win32Api.LockWorkStation();
            return Task.FromResult(success 
                ? CommandResult.Ok("PC workstation locked.") 
                : CommandResult.Fail("Failed to lock PC workstation."));
        }
    }

    public class ShutdownCommand : ICommand
    {
        private readonly InternalSchedulerService _scheduler;

        public ShutdownCommand(InternalSchedulerService scheduler)
        {
            _scheduler = scheduler;
        }

        public string CommandName => "SHUTDOWN";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            int durationMinutes = payload.Params?.DurationMinutes ?? 0;

            if (durationMinutes > 0)
            {
                _scheduler.ScheduleAction("POWER_ACTION", TimeSpan.FromMinutes(durationMinutes), () =>
                {
                    Win32Api.InitiateSystemShutdownEx(null, "Alexa Scheduled Shutdown", 0, true, false, 0);
                    return Task.CompletedTask;
                });
                return Task.FromResult(CommandResult.Ok($"PC shutdown scheduled in {durationMinutes} minutes."));
            }

            bool success = Win32Api.InitiateSystemShutdownEx(null, "Alexa Voice Shutdown", 0, true, false, 0);
            return Task.FromResult(success 
                ? CommandResult.Ok("PC shutdown initiated.") 
                : CommandResult.Fail("Failed to initiate PC shutdown."));
        }
    }

    public class SleepCommand : ICommand
    {
        private readonly InternalSchedulerService _scheduler;

        public SleepCommand(InternalSchedulerService scheduler)
        {
            _scheduler = scheduler;
        }

        public string CommandName => "SLEEP";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            int durationMinutes = payload.Params?.DurationMinutes ?? 0;

            if (durationMinutes > 0)
            {
                _scheduler.ScheduleAction("POWER_ACTION", TimeSpan.FromMinutes(durationMinutes), () =>
                {
                    Win32Api.SetSuspendState(false, true, false);
                    return Task.CompletedTask;
                });
                return Task.FromResult(CommandResult.Ok($"PC sleep scheduled in {durationMinutes} minutes."));
            }

            bool success = Win32Api.SetSuspendState(false, true, false);
            return Task.FromResult(success 
                ? CommandResult.Ok("PC put to sleep.") 
                : CommandResult.Fail("Failed to put PC to sleep."));
        }
    }

    public class RestartCommand : ICommand
    {
        private readonly InternalSchedulerService _scheduler;

        public RestartCommand(InternalSchedulerService scheduler)
        {
            _scheduler = scheduler;
        }

        public string CommandName => "RESTART";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            int durationMinutes = payload.Params?.DurationMinutes ?? 0;

            if (durationMinutes > 0)
            {
                _scheduler.ScheduleAction("POWER_ACTION", TimeSpan.FromMinutes(durationMinutes), () =>
                {
                    Win32Api.InitiateSystemShutdownEx(null, "Alexa Scheduled Restart", 0, true, true, 0);
                    return Task.CompletedTask;
                });
                return Task.FromResult(CommandResult.Ok($"PC restart scheduled in {durationMinutes} minutes."));
            }

            bool success = Win32Api.InitiateSystemShutdownEx(null, "Alexa Voice Restart", 0, true, true, 0);
            return Task.FromResult(success 
                ? CommandResult.Ok("PC restart initiated.") 
                : CommandResult.Fail("Failed to initiate PC restart."));
        }
    }

    public class CancelScheduleCommand : ICommand
    {
        private readonly InternalSchedulerService _scheduler;

        public CancelScheduleCommand(InternalSchedulerService scheduler)
        {
            _scheduler = scheduler;
        }

        public string CommandName => "CANCEL_SCHEDULE";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            bool cancelled = _scheduler.CancelAll();
            return Task.FromResult(cancelled
                ? CommandResult.Ok("Scheduled PC power action cancelled.")
                : CommandResult.Ok("No scheduled power actions were pending."));
        }
    }

    public class StatusCommand : ICommand
    {
        private readonly StatusMonitorService _statusMonitor;

        public StatusCommand(StatusMonitorService statusMonitor)
        {
            _statusMonitor = statusMonitor;
        }

        public string CommandName => "GET_STATUS";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            var status = _statusMonitor.GetSystemStatus();
            return Task.FromResult(CommandResult.Ok("PC Status fetched.", status));
        }
    }
}
