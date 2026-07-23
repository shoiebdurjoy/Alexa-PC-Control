using System;
using AlexaPCAgent.Native;

namespace AlexaPCAgent.Services
{
    public class StatusMonitorService
    {
        private readonly InternalSchedulerService _scheduler;

        public StatusMonitorService(InternalSchedulerService scheduler)
        {
            _scheduler = scheduler;
        }

        public object GetSystemStatus()
        {
            float volumePercent = (float)Math.Round(CoreAudioApi.GetMasterVolume(), 1);
            bool isMuted = CoreAudioApi.GetMute();
            long uptimeSeconds = Environment.TickCount / 1000;
            int activeSchedules = _scheduler.GetActiveScheduleCount();

            return new
            {
                online = true,
                volumePercent = volumePercent,
                isMuted = isMuted,
                uptimeSeconds = uptimeSeconds,
                activeScheduledTasks = activeSchedules,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
        }
    }
}
