import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { loadAndValidateConfig } from './config';
import { ConnectionManager } from './websocket/connectionManager';
import { TokenValidator } from './auth/tokenValidator';
import { createCommandRouter } from './routes/commandRouter';
import { createAlexaRouter } from './routes/alexaRouter';
import { verifyAlexaRequest, ExtendedRequest } from './auth/alexaVerifier';
import { logEvent, getLogs } from './logger';

const config = loadAndValidateConfig();
const app = express();

// Capture raw body buffer for Alexa cryptographic signature verification
app.use(express.json({
  limit: '10kb',
  verify: (req: ExtendedRequest, _res: express.Response, buf: Buffer): void => {
    req.rawBody = buf;
  }
}));

const tokenValidator = new TokenValidator(config.agentSecretToken, config.alexaSkillSecret);
const connectionManager = new ConnectionManager();

app.get('/health', (_req: express.Request, res: express.Response): void => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    activeAgents: connectionManager.getActiveCount()
  });
});

app.get('/logs', (_req: express.Request, res: express.Response): void => {
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(getLogs());
});

// Apply Alexa HTTPS signature validation ONLY to the /api/alexa endpoint
app.post('/api/alexa', verifyAlexaRequest);

// Mount Alexa router
app.use('/api', createAlexaRouter(connectionManager, config.alexaSkillId));

// Secure REST Router for external API triggers (requires X-Skill-Secret header)
app.use('/api', tokenValidator.validateSkillSecretMiddleware, createCommandRouter(connectionManager));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request: http.IncomingMessage, socket: import('stream').Duplex, head: Buffer): void => {
  const agentTokenHeader = request.headers['x-agent-token'];
  const deviceIdHeader = (request.headers['x-device-id'] as string) || 'default-pc';

  logEvent(`[Upgrade Request] Host: ${request.headers.host} | IP: ${request.socket.remoteAddress} | Device ID: ${deviceIdHeader} | Token Provided: ${agentTokenHeader ? 'Yes' : 'No'}`);

  if (!tokenValidator.validateAgentToken(agentTokenHeader)) {
    logEvent(`[Upgrade Failure] Unauthorized attempt from ${request.socket.remoteAddress}. Invalid token: ${agentTokenHeader}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  logEvent(`[Upgrade Success] Token validated. Upgrading connection for Device ID: ${deviceIdHeader}...`);

  wss.handleUpgrade(request, socket, head, (ws: WebSocket): void => {
    wss.emit('connection', ws, request, deviceIdHeader);
  });
});

wss.on('connection', (ws: WebSocket, _request: http.IncomingMessage, deviceId: string): void => {
  logEvent(`[WebSocket Connect] Agent ${deviceId} connected. Socket state: ${ws.readyState}`);
  connectionManager.registerAgent(deviceId, ws);

  ws.on('message', (rawData: any): void => {
    try {
      const data = JSON.parse(rawData.toString());
      if (data && data.type === 'ping') {
        logEvent(`[Heartbeat Ping] Received JSON ping from agent: ${deviceId}`);
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        logEvent(`[Heartbeat Pong] Sent JSON pong to agent: ${deviceId}`);
      } else {
        logEvent(`[WebSocket Message] Received data from agent ${deviceId}: ${rawData.toString().substring(0, 300)}`);
      }
    } catch (e: any) {
      logEvent(`[WebSocket Message Error] Failed parsing frame from agent ${deviceId}: ${e.message}`);
    }
  });

  ws.on('close', (code: number, reason: string): void => {
    logEvent(`[WebSocket Disconnect] Agent ${deviceId} disconnected. Code: ${code} | Reason: ${reason || 'None'}`);
    connectionManager.unregisterAgent(deviceId, ws);
  });

  ws.on('error', (err: Error): void => {
    logEvent(`[WebSocket Error] Agent ${deviceId}: ${err.message}`);
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
