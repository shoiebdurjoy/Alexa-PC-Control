import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ConnectionManager } from '../websocket/connectionManager';

const ALLOWED_COMMANDS = new Set([
  'LOCK',
  'SHUTDOWN',
  'SLEEP',
  'RESTART',
  'CANCEL_SCHEDULE',
  'MUTE',
  'UNMUTE',
  'VOLUME_UP',
  'VOLUME_DOWN',
  'SET_VOLUME',
  'GET_STATUS'
]);

interface CommandRequestBody {
  command?: string;
  params?: Record<string, unknown>;
  deviceId?: string;
}

export function createCommandRouter(connectionManager: ConnectionManager): Router {
  const router = Router();

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, message: 'Rate limit exceeded.' }
  });

  router.post('/command', apiLimiter, async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CommandRequestBody;
    const command = body.command;
    const params = body.params;
    const deviceId = body.deviceId;

    if (!command || typeof command !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid or missing command string.' });
      return;
    }

    const normalizedCmd = command.toUpperCase().trim();
    if (!ALLOWED_COMMANDS.has(normalizedCmd)) {
      res.status(400).json({ success: false, message: `Command '${normalizedCmd}' is not allowed.` });
      return;
    }

    try {
      const requestId = require('crypto').randomUUID();
      const payload = {
        version: '1.0',
        requestId,
        command: normalizedCmd,
        params: params && typeof params === 'object' ? params : {},
        timestamp: Date.now()
      };

      const result = await connectionManager.sendCommandToAgent(deviceId, payload);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to dispatch command to PC agent';
      console.error('[CommandRouter Error]:', message);
      res.status(502).json({ success: false, message });
    }
  });

  router.get('/status', (_req: Request, res: Response): void => {
    res.json({
      status: 'online',
      activeAgents: connectionManager.getActiveCount(),
      timestamp: Date.now()
    });
  });

  return router;
}
