# Installation Guide

This document provides complete instructions for deploying and setting up **Alexa-PC-Control** across the Windows Workstation, Backend API Server, and Alexa Developer Console.

---

## Prerequisites

- **Windows PC**: Windows 10 or Windows 11 (64-bit).
- **.NET Runtime**: .NET 8.0 SDK / Desktop Runtime.
- **Node.js**: Node.js 18.x or later and `npm`.
- **Amazon Developer Account**: Free account to host Alexa Custom Skill.

---

## 1. Windows PC Agent Setup

1. **Build / Publish Application**:
   ```bash
   cd windows-pc-agent/src/AlexaPCAgent
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```
2. **Configuration**:
   Copy `appsettings.json` alongside the generated executable:
   ```json
   {
     "BackendWebSocketUrl": "wss://your-backend-api-domain.com/ws",
     "AgentToken": "YOUR_SECURE_AGENT_SECRET_TOKEN",
     "AutoStart": true
   }
   ```
3. **Run Agent**:
   - Double-click `AlexaPCAgent.exe`.
   - The application will run silently in your System Tray.
   - Right-click the system tray icon to check status or enable **Start with Windows**.

---

## 2. Backend API Server Setup

1. **Navigate to directory**:
   ```bash
   cd backend-api
   npm install
   ```
2. **Configure Environment (`.env`)**:
   ```env
   PORT=8080
   AGENT_SECRET_TOKEN=YOUR_SECURE_AGENT_SECRET_TOKEN
   ALEXA_SKILL_SECRET=YOUR_SECURE_SKILL_SECRET
   ```
3. **Start Production Server**:
   ```bash
   npm run build
   npm start
   ```

---

## 3. Alexa Custom Skill Setup

1. Log into [Amazon Developer Console](https://developer.amazon.com/alexa/console/ask).
2. Create a new Skill:
   - **Name**: `Alexa PC Control`
   - **Model**: Custom
   - **Hosting**: Alexa-Hosted (Node.js) or AWS Lambda
3. **Import Interaction Model**:
   - Go to **Build** -> **Interaction Model** -> **JSON Editor**.
   - Paste the contents of `alexa-skill/interactionModels/custom/en-US.json`.
   - Save & Build Model.
4. **Deploy Lambda Code**:
   - Copy handler code from `alexa-skill/lambda/` into the code editor.
   - Set environment variables (`BACKEND_API_URL` and `SKILL_SECRET`).
   - Click **Deploy**.
5. **Testing**:
   - Go to **Test** tab in Alexa Console.
   - Enable testing for "Development".
   - Say: `"ask my computer to lock the PC"`.
