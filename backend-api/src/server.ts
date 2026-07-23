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

app.get('/health', (_req: express.Request, res: express.Response): void => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    activeAgents: connectionManager.getActiveCount()
  });
});

app.use('/api', tokenValidator.validateSkillSecretMiddleware, createCommandRouter(connectionManager));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request: http.IncomingMessage, socket: import('stream').Duplex, head: Buffer): void => {
  const agentTokenHeader = request.headers['x-agent-token'];
  const deviceIdHeader = (request.headers['x-device-id'] as string) || 'default-pc';

  if (!tokenValidator.validateAgentToken(agentTokenHeader)) {
    console.warn(`[Security] Unauthorized WebSocket attempt from ${request.socket.remoteAddress}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws: WebSocket): void => {
    wss.emit('connection', ws, request, deviceIdHeader);
  });
});

wss.on('connection', (ws: WebSocket, _request: http.IncomingMessage, deviceId: string): void => {
  connectionManager.registerAgent(deviceId, ws);

  ws.on('close', (): void => {
    connectionManager.unregisterAgent(deviceId);
  });

  ws.on('error', (err: Error): void => {
    console.error(`[WebSocket Error] Agent ${deviceId}:`, err.message);
  });
});

const pingInterval = setInterval((): void => {
  wss.clients.forEach((ws: WebSocket): void => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);

server.listen(config.port, (): void => {
  console.log(`=======================================================`);
  console.log(` Alexa-PC-Control Backend API Server (v1.2.0)`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(` Port: ${config.port}`);
  console.log(` Health: http://0.0.0.0:${config.port}/health`);
  console.log(`=======================================================`);
});

function gracefulShutdown(signal: string): void {
  console.log(`[Shutdown] Received ${signal}. Closing connections...`);
  clearInterval(pingInterval);

  wss.clients.forEach((ws: WebSocket): void => {
    try { ws.close(1001, 'Server shutting down'); } catch (_e) { /* ignore */ }
  });

  server.close((): void => {
    console.log('[Shutdown] Clean exit.');
    process.exit(0);
  });

  setTimeout((): void => {
    console.error('[Shutdown] Forced exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', (): void => gracefulShutdown('SIGTERM'));
process.on('SIGINT', (): void => gracefulShutdown('SIGINT'));
