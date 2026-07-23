# Alexa-PC-Control

> Ultra-low-latency, zero-AI, production-quality Alexa Custom Skill and Windows PC Agent for deterministic PC voice control.

---

## 🚀 Overview

**Alexa-PC-Control** provides high-speed, secure, and completely deterministic voice control of a Windows PC using Amazon Alexa. Unlike AI/LLM wrappers, this system converts voice commands directly into native Windows API executions with **zero prompt engineering, zero AI cost, and sub-100ms response times**.

---

## ⚡ Architecture Pipeline

```
[ Alexa Voice Command ]
         │
         ▼ (HTTPS REST / ASK SDK)
  [ Alexa Custom Skill ]
         │
         ▼ (HTTPS payload trigger)
  [ Backend API Server ] (Node.js / WebSocket Bridge)
         │
         ▼ (Persistent Secure WebSocket WSS connection)
[ Windows PC Agent (Tray) ] (C# .NET 8 System Tray Application)
         │
         ▼ (Native P/Invoke & WASAPI)
   [ Windows System API ] (Lock, Master Volume scalar, Power States)
```

---

## ✨ Features (v1.0)

- **Power & Session Control**: Lock PC, Put PC to sleep, Restart PC, Shutdown PC.
- **Resilient Timed Power Actions**: Shutdown, sleep, or restart after *X* minutes using an internal C# cancellation scheduler (survives temporary network disconnects).
- **Schedule Cancellation**: Instant voice cancellation of any pending shutdown, sleep, or restart timers.
- **Audio Control**: Mute, Unmute, Volume Up, Volume Down, Set master volume directly to exact percentage (0–100%).
- **Telemetry & Status**: Voice status checks (volume level, mute state, system uptime, active timers).
- **Auto-Start & Silent Operation**: Runs seamlessly in the Windows System Tray and launches automatically at login.
- **Extensible Architecture**: Future-proof command pattern registry ready for app launching, display controls, media buttons, and input macros.

---

## 📚 Documentation

Detailed documentation is available in the [`docs/`](./docs) folder:

- 🏗️ [Architecture Specification](./docs/Architecture.md) — System design, data payloads, latency optimization & security model.
- 🛠️ [Installation Guide](./docs/Installation.md) — Step-by-step setup guide for PC Agent, Backend Server, and Alexa Skill.
- 💻 [Developer Guide](./docs/Developer.md) — Codebase structure, building, extending commands, and testing.
- 📜 [Voice Commands Reference](./docs/Commands.md) — Complete list of supported Alexa sample utterances and intent mapping.

---

## 🔒 Security Principles

- **Zero Shell Execution**: No arbitrary PowerShell, CMD, or remote script execution allowed.
- **Predefined Command Registry**: Strictly typed enum dispatcher rejects unknown payload types.
- **Persistent Auth**: Mutual secret token authentication for WebSocket pairing.

---

## 📄 License

MIT License. See [LICENSE](./LICENSE) for details.
