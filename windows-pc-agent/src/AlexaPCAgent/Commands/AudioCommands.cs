using System;
using System.Threading;
using System.Threading.Tasks;
using AlexaPCAgent.Models;
using AlexaPCAgent.Native;

namespace AlexaPCAgent.Commands
{
    public class MuteCommand : ICommand
    {
        public string CommandName => "MUTE";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            bool success = CoreAudioApi.SetMute(true);
            if (!success)
            {
                Win32Api.keybd_event(Win32Api.VK_VOLUME_MUTE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                Win32Api.keybd_event(Win32Api.VK_VOLUME_MUTE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
            }
            return Task.FromResult(CommandResult.Ok("PC audio muted."));
        }
    }

    public class UnmuteCommand : ICommand
    {
        public string CommandName => "UNMUTE";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            bool success = CoreAudioApi.SetMute(false);
            if (!success && CoreAudioApi.GetMute())
            {
                Win32Api.keybd_event(Win32Api.VK_VOLUME_MUTE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                Win32Api.keybd_event(Win32Api.VK_VOLUME_MUTE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
            }
            return Task.FromResult(CommandResult.Ok("PC audio unmuted."));
        }
    }

    public class VolumeUpCommand : ICommand
    {
        public string CommandName => "VOLUME_UP";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            float current = CoreAudioApi.GetMasterVolume();
            float next = Math.Min(100f, current + 10f);
            bool success = CoreAudioApi.SetMasterVolume(next);
            if (!success)
            {
                for (int i = 0; i < 5; i++)
                {
                    Win32Api.keybd_event(Win32Api.VK_VOLUME_UP, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                    Win32Api.keybd_event(Win32Api.VK_VOLUME_UP, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
            }
            return Task.FromResult(CommandResult.Ok($"PC volume increased to {Math.Round(next)} percent."));
        }
    }

    public class VolumeDownCommand : ICommand
    {
        public string CommandName => "VOLUME_DOWN";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            float current = CoreAudioApi.GetMasterVolume();
            float next = Math.Max(0f, current - 10f);
            bool success = CoreAudioApi.SetMasterVolume(next);
            if (!success)
            {
                for (int i = 0; i < 5; i++)
                {
                    Win32Api.keybd_event(Win32Api.VK_VOLUME_DOWN, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                    Win32Api.keybd_event(Win32Api.VK_VOLUME_DOWN, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
                }
            }
            return Task.FromResult(CommandResult.Ok($"PC volume decreased to {Math.Round(next)} percent."));
        }
    }

    public class SetVolumeCommand : ICommand
    {
        public string CommandName => "SET_VOLUME";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            int level = payload.Params?.VolumePercent ?? 50;
            level = Math.Max(0, Math.Min(100, level));

            bool success = CoreAudioApi.SetMasterVolume(level);
            if (success)
            {
                return Task.FromResult(CommandResult.Ok($"PC volume set to {level} percent."));
            }
            return Task.FromResult(CommandResult.Fail("Failed to set master volume level."));
        }
    }

    public class MediaPlayCommand : ICommand
    {
        public string CommandName => "MEDIA_PLAY";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            Win32Api.keybd_event(Win32Api.VK_MEDIA_PLAY_PAUSE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Win32Api.keybd_event(Win32Api.VK_MEDIA_PLAY_PAUSE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
            return Task.FromResult(CommandResult.Ok("PC media play toggled."));
        }
    }

    public class MediaPauseCommand : ICommand
    {
        public string CommandName => "MEDIA_PAUSE";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            Win32Api.keybd_event(Win32Api.VK_MEDIA_PLAY_PAUSE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Win32Api.keybd_event(Win32Api.VK_MEDIA_PLAY_PAUSE, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
            return Task.FromResult(CommandResult.Ok("PC media pause toggled."));
        }
    }

    public class MediaNextCommand : ICommand
    {
        public string CommandName => "MEDIA_NEXT";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            Win32Api.keybd_event(Win32Api.VK_MEDIA_NEXT_TRACK, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Win32Api.keybd_event(Win32Api.VK_MEDIA_NEXT_TRACK, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
            return Task.FromResult(CommandResult.Ok("PC media skipped to next track."));
        }
    }

    public class MediaPrevCommand : ICommand
    {
        public string CommandName => "MEDIA_PREV";

        public Task<CommandResult> ExecuteAsync(CommandPayload payload, CancellationToken cancellationToken)
        {
            Win32Api.keybd_event(Win32Api.VK_MEDIA_PREV_TRACK, 0, Win32Api.KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Win32Api.keybd_event(Win32Api.VK_MEDIA_PREV_TRACK, 0, Win32Api.KEYEVENTF_EXTENDEDKEY | Win32Api.KEYEVENTF_KEYUP, UIntPtr.Zero);
            return Task.FromResult(CommandResult.Ok("PC media returned to previous track."));
        }
    }
}
