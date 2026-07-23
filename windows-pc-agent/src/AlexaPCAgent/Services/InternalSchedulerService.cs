using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace AlexaPCAgent.Services
{
    public class InternalSchedulerService
    {
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _scheduledTasks = new();

        public event Action<string>? OnScheduleStarted;
        public event Action<string>? OnScheduleCancelled;
        public event Action<string>? OnScheduleExecuted;

        public bool ScheduleAction(string actionName, TimeSpan delay, Func<Task> action)
        {
            CancelAction(actionName);

            var cts = new CancellationTokenSource();
            _scheduledTasks[actionName] = cts;

            OnScheduleStarted?.Invoke(actionName);

            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(delay, cts.Token);
                    if (!cts.Token.IsCancellationRequested)
                    {
                        await action();
                        OnScheduleExecuted?.Invoke(actionName);
                    }
                }
                catch (TaskCanceledException)
                {
                    OnScheduleCancelled?.Invoke(actionName);
                }
                finally
                {
                    _scheduledTasks.TryRemove(actionName, out _);
                    cts.Dispose();
                }
            }, cts.Token);

            return true;
        }

        public bool CancelAction(string actionName)
        {
            if (_scheduledTasks.TryRemove(actionName, out var cts))
            {
                cts.Cancel();
                cts.Dispose();
                OnScheduleCancelled?.Invoke(actionName);
                return true;
            }
            return false;
        }

        public bool CancelAll()
        {
            bool cancelled = false;
            foreach (var key in _scheduledTasks.Keys)
            {
                if (CancelAction(key))
                {
                    cancelled = true;
                }
            }
            return cancelled;
        }

        public bool HasActiveSchedule(string actionName)
        {
            return _scheduledTasks.ContainsKey(actionName);
        }

        public int GetActiveScheduleCount() => _scheduledTasks.Count;
    }
}
