using System;
using System.Runtime.InteropServices;

namespace AlexaPCAgent.Native
{
    public static class Win32Api
    {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool LockWorkStation();

        [DllImport("powrprof.dll", SetLastError = true)]
        public static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool ExitWindowsEx(uint uFlags, uint dwReason);

        [DllImport("advapi32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern bool InitiateSystemShutdownEx(
            string? lpMachineName,
            string? lpMessage,
            uint dwTimeout,
            bool bForceAppsClosed,
            bool bRebootAfterShutdown,
            uint dwReason
        );

        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        public const byte VK_VOLUME_MUTE = 0xAD;
        public const byte VK_VOLUME_DOWN = 0xAE;
        public const byte VK_VOLUME_UP = 0xAF;

        public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        public const uint KEYEVENTF_KEYUP = 0x0002;

        public const uint EWX_LOGOFF = 0x00000000;
        public const uint EWX_SHUTDOWN = 0x00000001;
        public const uint EWX_REBOOT = 0x00000002;
        public const uint EWX_FORCE = 0x00000004;
        public const uint EWX_POWEROFF = 0x00000008;
    }
}
