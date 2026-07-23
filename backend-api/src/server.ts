import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { loadAndValidateConfig } from './config';
import { ConnectionManager } from './websocket/connectionManager';
import { TokenValidator } from './auth/tokenValidator';
import { createCommandRouter } from './routes/commandRouter';

const config = loadAndValidateConfig();
const app = express();
app.use(express.json({ limit: '10kb' }));

const tokenValidator = new TokenValidator(config.agentSecretToken, config.alexaSkillSecret);
const connectionManager = new ConnectionManager();

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()), activeAgents: connectionManager.getActiveCount() });
});

// Secure REST Router for Alexa Skill
app.use('/api', tokenValidator.validateSkillSecretMiddleware, createCommandRouter(connectionManager));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const agentTokenHeader = request.headers['x-agent-token'];
  const deviceIdHeader = (request.headers['x-device-id'] as string) || 'default-pc';

  if (!tokenValidator.validateAgentToken(agentTokenHeader)) {
    console.warn(`[Security Warning] Unauthorized WebSocket connection attempt from ${request.socket.remoteAddress}`);
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

// Ping/Pong keepalive loop every 30 seconds
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);

server.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` Alexa-PC-Control Backend API Server (v1.1.0)`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(` Listening on Port: ${config.port}`);
  console.log(` Health Endpoint: http://0.0.0.0:${config.port}/health`);
  console.log(`=======================================================`);
});

// Graceful Shutdown Handling
function gracefulShutdown(signal: string) {
  console.log(`[Server Shutdown] Received ${signal}. Closing HTTP and WebSocket connections...`);
  clearInterval(pingInterval);

  wss.clients.forEach((ws) => {
    try {
      ws.close(1001, 'Server shutting down');
    } catch {}
  });

  server.close(() => {
    console.log('[Server Shutdown] HTTP server closed cleanly. Exiting.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Server Shutdown] Forced exit due to timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
