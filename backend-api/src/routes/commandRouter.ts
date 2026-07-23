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

export function createCommandRouter(connectionManager: ConnectionManager): Router {
  const router = Router();

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60, // 60 requests per minute limit
    message: { success: false, message: 'Too many command requests. Rate limit exceeded.' }
  });

  router.post('/command', apiLimiter, async (req: Request, res: Response) => {
    const { command, params, deviceId } = req.body || {};

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
      const payload = {
        version: '1.0',
        command: normalizedCmd,
        params: params && typeof params === 'object' ? params : {},
        timestamp: Date.now()
      };

      const result = await connectionManager.sendCommandToAgent(deviceId, payload);
      res.json(result);
    } catch (error: any) {
      console.error('[CommandRouter Error]:', error.message);
      res.status(502).json({
        success: false,
        message: error.message || 'Failed to dispatch command to PC agent'
      });
    }
  });

  router.get('/status', (req: Request, res: Response) => {
    res.json({
      status: 'online',
      activeAgents: connectionManager.getActiveCount(),
      timestamp: Date.now()
    });
  });

  return router;
}
