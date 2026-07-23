# Architecture Specification (Render 24/7 Cloud Architecture)

## Overview

`Alexa-PC-Control` connects an Amazon Echo voice request to a Windows workstation via a **24/7 cloud backend hosted on Render**. The PC Agent initiates an **outbound-only, encrypted WebSocket (WSS) connection** to Render upon Windows login.

```
[ Amazon Echo ]
       │
       ▼ (Voice Utterance)
[ Alexa Custom Skill ] (AWS Lambda)
       │
       ▼ (HTTPS REST POST /api/command)
[ Render Backend Server ] (24/7 Web Service - Fastify / Express + WS Hub)
       │
       ▼ (Persistent Outbound TLS WebSocket: wss://alexa-pc-control.onrender.com/ws)
[ Windows PC Agent ] (C# .NET 8 System Tray Application)
       │
       ▼ (Native Win32 & WASAPI P/Invoke)
[ Windows Workstation ] (Lock, Master Volume, Power Management)
```

---

## Key Network & Security Advantages

1. **Zero Incoming Ports / No Port Forwarding**: The Windows PC Agent connects *outward* to `wss://your-app.onrender.com/ws`. Home routers and firewalls permit outbound HTTPS/WSS traffic by default.
2. **Permanent 24/7 Uptime**: The backend runs continuously on Render. When your PC is powered on, the agent instantly establishes its persistent socket.
3. **Sub-100ms Latency**: Commands travel from Alexa to Render over HTTPS, and from Render to your PC over the pre-established WSS socket in milliseconds.
4. **Mutual Secret Security**:
   - `X-Skill-Secret`: Validates Alexa Skill HTTP triggers to Render.
   - `X-Agent-Token`: Validates Windows PC Agent WebSocket connections to Render.

---

## Connection Flow Lifecycle

1. **Windows Boot**: Windows loads `AlexaPCAgent.exe` silently into the System Tray.
2. **WebSocket Handshake**: Agent initiates `ClientWebSocket.ConnectAsync("wss://alexa-pc-control.onrender.com/ws")` with `X-Agent-Token` header.
3. **Connection Registry**: Render Backend registers the active socket in memory.
4. **Keepalive**: Render and Agent exchange ping/pong keepalive frames every 30 seconds.
5. **Voice Execution**:
   - User says *"Alexa, ask my computer to lock the PC"*.
   - Alexa Skill sends HTTP POST to Render `/api/command`.
   - Render pushes JSON payload over the active WSS socket to `AlexaPCAgent`.
   - `AlexaPCAgent` executes `user32.dll!LockWorkStation()` natively.
