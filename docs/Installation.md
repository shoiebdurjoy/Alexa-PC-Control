# Installation & Deployment Guide (Render 24/7 Setup)

This guide walks through deploying the **Backend API to Render**, setting up the **Alexa Custom Skill**, and configuring your **Windows PC Agent** for automatic startup.

---

## Step 1: Deploy Backend API to Render (24/7 Free / Starter Web Service)

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub account and select repository **`shoiebdurjoy/Alexa-PC-Control`**.
4. Configure service settings:
   - **Name**: `alexa-pc-control-backend`
   - **Root Directory**: `backend-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. **Environment Variables**:
   Add the following variables in Render Dashboard under **Environment**:
   - `AGENT_SECRET_TOKEN`: `Select_A_Strong_Random_Secret_Token_For_PC_Agent`
   - `ALEXA_SKILL_SECRET`: `Select_A_Strong_Random_Secret_For_Alexa_Skill`
6. Click **Create Web Service**.
7. Render will build and deploy your service at a public URL (e.g. `https://alexa-pc-control-backend.onrender.com`).

---

## Step 2: Configure Alexa Custom Skill

1. Log into [Amazon Developer Console](https://developer.amazon.com/alexa/console/ask).
2. Open or Create a Custom Skill named **`Alexa PC Control`**.
3. **Interaction Model**:
   - Go to **Build** -> **Interaction Model** -> **JSON Editor**.
   - Paste contents of `alexa-skill/interactionModels/custom/en-US.json`.
   - Click **Save Model** and **Build Model**.
4. **Lambda / Endpoint Configuration**:
   - Set environment variables in your Alexa Lambda function:
     - `BACKEND_API_URL`: `https://alexa-pc-control-backend.onrender.com/api/command`
     - `SKILL_SECRET`: `(Your ALEXA_SKILL_SECRET from Step 1)`
   - Click **Save** and **Deploy**.

---

## Step 3: Configure Windows PC Agent

1. Open `windows-pc-agent/src/AlexaPCAgent/appsettings.json` on your PC:
   ```json
   {
     "BackendWebSocketUrl": "wss://alexa-pc-control-backend.onrender.com/ws",
     "AgentToken": "Select_A_Strong_Random_Secret_Token_For_PC_Agent",
     "AutoStart": true
   }
   ```
2. Build / Publish executable:
   ```bash
   cd windows-pc-agent/src/AlexaPCAgent
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```
3. Run `AlexaPCAgent.exe`.
   - The agent will connect outward to your Render backend via WSS (`wss://alexa-pc-control-backend.onrender.com/ws`).
   - The system tray icon will display **Status: Online (Connected)**.
   - It will automatically launch every time Windows boots up. Zero port forwarding needed!

---

## Step 4: Verification

Say: *"Alexa, ask my computer to lock the PC"*!
