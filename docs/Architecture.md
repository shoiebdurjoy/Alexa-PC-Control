# Architecture Specification

## Overview

`Alexa-PC-Control` is engineered for minimum end-to-end latency, reliability, security, and extensibility. The architecture connects Amazon Alexa to a Windows workstation via a persistent WebSocket cloud bridge.

```
+------------------+         HTTPS          +-------------------+
|  Alexa Custom    | ---------------------> |   Backend API     |
|     Skill        |                        | (WebSocket Hub)   |
+------------------+                        +-------------------+
                                                      ^
                                                      | WSS (TLS WebSocket)
                                                      | Sub-100ms Persistent
                                                      v
                                            +-------------------+
                                            | Windows PC Agent  |
                                            |  (C# System Tray) |
                                            +-------------------+
                                                      |
                                                      | Native P/Invoke & WASAPI
                                                      v
                                            +-------------------+
                                            |  Windows System   |
                                            +-------------------+
```

---

## 1. Core Component Breakdown

### 1.1 Alexa Custom Skill (`alexa-skill/`)
- **Language**: Node.js 18+ (ASK SDK v2).
- **Invocation Name**: `my computer`.
- **Role**: Converts natural spoken utterances into strongly-typed `CommandPayload` JSON objects and relays them to the Backend API.
- **Latency Optimization**: Uses minimal dependencies to minimize cold-start times on AWS Lambda or standalone HTTP runtime.

### 1.2 Backend API Server (`backend-api/`)
- **Technology**: Node.js + TypeScript (`Fastify` + `ws` or standard WebSocket server).
- **Role**: Maintains persistent full-duplex WebSocket connections with PC Agents. When an HTTP endpoint receives a valid request from the Alexa Skill, it routes the payload to the registered WebSocket connection instantly.
- **Connection Management**:
  - Connection map stored in memory (`Map<DeviceId, WebSocket>`).
  - Ping/Pong heartbeat every 30 seconds to maintain NAT table pinholes on home routers.
  - Sub-10ms routing latency between HTTP POST receipt and WebSocket push.

### 1.3 Windows PC Agent (`windows-pc-agent/`)
- **Technology**: C# .NET 8 (Windows System Tray Application).
- **Role**: Runs silently in the system tray (`NotifyIcon`), auto-starts with Windows (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), maintains persistent WebSocket connection with automatic backoff reconnection, and executes native Windows APIs.
- **Design Pattern**: **Command Pattern** using `ICommand` handlers registered in a central `CommandRegistry`.

---

## 2. Low-Latency Design Principles

1. **Persistent Duplex Sockets**: Eliminates HTTP connection setup overhead (handshake/TLS) for command execution. Sockets remain connected 24/7.
2. **Native Win32 & CoreAudio Integrations**:
   - Master volume changes execute directly through WASAPI `MMDevice` P/Invoke calls, achieving scalar volume updates in under 2ms.
   - Session locking calls `user32.dll!LockWorkStation()` directly.
3. **Async / Non-blocking Dispatching**: The C# agent processes commands on a high-throughput async event loop without blocking UI or socket receiver threads.

---

## 3. Internal C# Scheduler Architecture

```
Voice Trigger -> "shutdown in 30 minutes"
                       │
                       ▼
         +---------------------------+
         | InternalSchedulerService  |
         +---------------------------+
                       │
             Creates Task.Delay & CancellationTokenSource
                       │
       +---------------+---------------+
       │                               │
       ▼                               ▼
Disconnect Occurs?            "cancel shutdown" Voice Trigger
       │                               │
   Scheduler continues           Cancels CancellationTokenSource
  in-memory countdown          and disposes active timer cleanly
```

- **Independence**: Power state schedules run entirely in memory inside the agent process (`System.Threading.CancellationTokenSource`).
- **Resilience**: Temporary loss of backend connectivity does **not** interrupt an active countdown.
- **Cancellation**: Issuing `CancelSchedule` instantly cancels active tokens and disposes timer tasks without shell process management.

---

## 4. Security & Safety Model

1. **Zero Dynamic Code Execution**:
   - `System.Diagnostics.Process.Start("cmd.exe", ...)` is strictly prohibited.
   - Command names map directly to hardcoded C# class handlers implementing `ICommand`.
2. **Mutual Token Authentication**:
   - Agents supply an `X-Agent-Token` header during WebSocket handshake.
   - Skill calls Backend API using a shared `X-Skill-Secret`.
3. **Payload Structure**:
   ```json
   {
     "version": "1.0",
     "command": "SET_VOLUME",
     "params": {
       "level": 50
     },
     "timestamp": 1721740000000
   }
   ```
