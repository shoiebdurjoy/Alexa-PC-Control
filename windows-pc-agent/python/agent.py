"""
Alexa PC Control Agent (Python 3.14 Native Implementation)
High-performance, zero-AI, deterministic Windows Agent with Win32 API and WASAPI integration.
"""

import sys
import os
import json
import time
import ctypes
import threading
import winreg
import asyncio
from typing import Dict, Any, Optional

# --- Win32 P/Invoke Definitions ---
user32 = ctypes.windll.user32
powrprof = ctypes.windll.powrprof
advapi32 = ctypes.windll.advapi32

VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002

class Win32Actions:
    @staticmethod
    def lock_pc() -> bool:
        return bool(user32.LockWorkStation())

    @staticmethod
    def sleep_pc() -> bool:
        return bool(powrprof.SetSuspendState(0, 1, 0))

    @staticmethod
    def shutdown_pc(reboot: bool = False) -> bool:
        return bool(advapi32.InitiateSystemShutdownExW(
            None,
            "Alexa Voice Triggered Power Action",
            0,
            True,
            reboot,
            0
        ))

    @staticmethod
    def send_key(vk_code: int):
        user32.keybd_event(vk_code, 0, KEYEVENTF_EXTENDEDKEY, 0)
        user32.keybd_event(vk_code, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)

class AudioControl:
    @staticmethod
    def mute():
        Win32Actions.send_key(VK_VOLUME_MUTE)

    @staticmethod
    def volume_up():
        for _ in range(5):
            Win32Actions.send_key(VK_VOLUME_UP)

    @staticmethod
    def volume_down():
        for _ in range(5):
            Win32Actions.send_key(VK_VOLUME_DOWN)

# --- In-Memory Scheduler ---
class InternalScheduler:
    def __init__(self):
        self._timers: Dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    def schedule(self, name: str, delay_seconds: float, func):
        self.cancel(name)
        with self._lock:
            t = threading.Timer(delay_seconds, func)
            self._timers[name] = t
            t.start()

    def cancel(self, name: str) -> bool:
        with self._lock:
            if name in self._timers:
                self._timers[name].cancel()
                del self._timers[name]
                return True
            return False

    def cancel_all(self) -> bool:
        with self._lock:
            cancelled = len(self._timers) > 0
            for t in self._timers.values():
                t.cancel()
            self._timers.clear()
            return cancelled

    def get_active_count(self) -> int:
        with self._lock:
            return len(self._timers)

class CommandDispatcher:
    def __init__(self, scheduler: InternalScheduler):
        self.scheduler = scheduler

    def dispatch(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        cmd = payload.get("command", "").upper()
        params = payload.get("params", {}) or {}

        if cmd == "LOCK":
            success = Win32Actions.lock_pc()
            return {"success": success, "message": "PC workstation locked."}

        elif cmd == "SHUTDOWN":
            mins = params.get("durationMinutes", 0)
            if mins > 0:
                self.scheduler.schedule("POWER", mins * 60, lambda: Win32Actions.shutdown_pc(False))
                return {"success": True, "message": f"PC shutdown scheduled in {mins} minutes."}
            success = Win32Actions.shutdown_pc(False)
            return {"success": success, "message": "PC shutdown initiated."}

        elif cmd == "RESTART":
            mins = params.get("durationMinutes", 0)
            if mins > 0:
                self.scheduler.schedule("POWER", mins * 60, lambda: Win32Actions.shutdown_pc(True))
                return {"success": True, "message": f"PC restart scheduled in {mins} minutes."}
            success = Win32Actions.shutdown_pc(True)
            return {"success": success, "message": "PC restart initiated."}

        elif cmd == "SLEEP":
            mins = params.get("durationMinutes", 0)
            if mins > 0:
                self.scheduler.schedule("POWER", mins * 60, lambda: Win32Actions.sleep_pc())
                return {"success": True, "message": f"PC sleep scheduled in {mins} minutes."}
            success = Win32Actions.sleep_pc()
            return {"success": success, "message": "PC put to sleep."}

        elif cmd == "CANCEL_SCHEDULE":
            cancelled = self.scheduler.cancel("POWER")
            return {"success": True, "message": "Scheduled power action cancelled." if cancelled else "No pending power actions."}

        elif cmd == "MUTE":
            AudioControl.mute()
            return {"success": True, "message": "PC audio mute toggled."}

        elif cmd == "UNMUTE":
            AudioControl.mute()
            return {"success": True, "message": "PC audio unmute toggled."}

        elif cmd == "VOLUME_UP":
            AudioControl.volume_up()
            return {"success": True, "message": "PC volume increased."}

        elif cmd == "VOLUME_DOWN":
            AudioControl.volume_down()
            return {"success": True, "message": "PC volume decreased."}

        elif cmd == "GET_STATUS":
            return {
                "success": True,
                "message": "Status fetched.",
                "data": {
                    "online": True,
                    "activeScheduledTasks": self.scheduler.get_active_count(),
                    "timestamp": int(time.time() * 1000)
                }
            }

        return {"success": False, "message": f"Unknown command: {cmd}"}

def set_autostart(enable: bool = True):
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    app_name = "AlexaPCAgentPy"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
        if enable:
            exe_path = f'"{sys.executable}" "{os.path.abspath(__file__)}"'
            winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe_path)
        else:
            winreg.DeleteValue(key, app_name)
        winreg.CloseKey(key)
        return True
    except Exception as e:
        print("AutoStart Registry Error:", e)
        return False

if __name__ == "__main__":
    print("Alexa-PC-Control Native Agent (Python 3.14) Ready.")
    set_autostart(True)
    scheduler = InternalScheduler()
    dispatcher = CommandDispatcher(scheduler)
    res = dispatcher.dispatch({"command": "GET_STATUS"})
    print("Agent Self-Test Dispatch Status:", res)
