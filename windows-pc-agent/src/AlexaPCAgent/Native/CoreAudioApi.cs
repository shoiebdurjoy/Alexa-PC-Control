using System;
using System.Runtime.InteropServices;

namespace AlexaPCAgent.Native
{
    public static class CoreAudioApi
    {
        [ComImport]
        [Guid("BCDE0380-4980-4E27-87A0-160F9884232F")]
        private class MMDeviceEnumeratorComObject { }

        [ComImport]
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceEnumerator
        {
            int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr ppDevices);
            int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
        }

        [ComImport]
        [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDevice
        {
            int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        }

        [ComImport]
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioEndpointVolume
        {
            int RegisterControlChangeNotify(IntPtr pNotify);
            int UnregisterControlChangeNotify(IntPtr pNotify);
            int GetChannelCount(out uint pnChannelCount);
            int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
            int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
            int GetMasterVolumeLevel(out float pfLevelDB);
            int GetMasterVolumeLevelScalar(out float pfLevel);
            int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
            int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
            int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
            int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
            int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
        }

        private static IAudioEndpointVolume? GetEndpointVolume()
        {
            try
            {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                enumerator.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out IMMDevice device);
                Guid iid = typeof(IAudioEndpointVolume).GUID;
                device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out object endpointObj);
                return (IAudioEndpointVolume)endpointObj;
            }
            catch
            {
                return null;
            }
        }

        public static float GetMasterVolume()
        {
            var volume = GetEndpointVolume();
            if (volume == null) return 0f;
            volume.GetMasterVolumeLevelScalar(out float level);
            return level * 100f;
        }

        public static bool SetMasterVolume(float percent)
        {
            var volume = GetEndpointVolume();
            if (volume == null) return false;
            float scalar = Math.Max(0f, Math.Min(1f, percent / 100f));
            Guid guid = Guid.Empty;
            return volume.SetMasterVolumeLevelScalar(scalar, ref guid) == 0;
        }

        public static bool GetMute()
        {
            var volume = GetEndpointVolume();
            if (volume == null) return false;
            volume.GetMute(out bool mute);
            return mute;
        }

        public static bool SetMute(bool mute)
        {
            var volume = GetEndpointVolume();
            if (volume == null) return false;
            Guid guid = Guid.Empty;
            return volume.SetMute(mute, ref guid) == 0;
        }
    }
}
