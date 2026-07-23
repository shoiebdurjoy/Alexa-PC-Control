import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { ConnectionManager } from './websocket/connectionManager';
import { TokenValidator } from './auth/tokenValidator';
import { createCommandRouter } from './routes/commandRouter';

dotenv.config();

const PORT = process.env.PORT || 8080;
const AGENT_SECRET_TOKEN = process.env.AGENT_SECRET_TOKEN || 'DEFAULT_AGENT_SECRET_TOKEN';
const ALEXA_SKILL_SECRET = process.env.ALEXA_SKILL_SECRET || 'DEFAULT_SKILL_SECRET';

const app = express();
app.use(express.json());

const tokenValidator = new TokenValidator(AGENT_SECRET_TOKEN, ALEXA_SKILL_SECRET);
const connectionManager = new ConnectionManager();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Secure API Command Router for Alexa Skill
app.use('/api', tokenValidator.validateSkillSecretMiddleware, createCommandRouter(connectionManager));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const agentTokenHeader = request.headers['x-agent-token'];
  const deviceIdHeader = (request.headers['x-device-id'] as string) || 'default-pc';

  if (!tokenValidator.validateAgentToken(agentTokenHeader)) {
    console.warn(`[WebSocket Upgrade] Unauthorized connection attempt from ${request.socket.remoteAddress}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, deviceIdHeader);
  });
});

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage, deviceId: string) => {
  connectionManager.registerAgent(deviceId, ws);

  ws.on('close', () => {
    connectionManager.unregisterAgent(deviceId);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket Error] Agent ${deviceId}:`, err.message);
  });
});

// Keepalive Ping/Pong loop every 30 seconds
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Alexa-PC-Control Backend API Server running on port ${PORT}`);
  console.log(` WebSocket Hub: wss://0.0.0.0:${PORT}/ws`);
  console.log(` Alexa REST endpoint: http://0.0.0.0:${PORT}/api/command`);
  console.log(`=======================================================`);
});
