import { Router, Request, Response } from 'express';
import { ConnectionManager } from '../websocket/connectionManager';

export function createCommandRouter(connectionManager: ConnectionManager): Router {
  const router = Router();

  router.post('/command', async (req: Request, res: Response) => {
    const { command, params, deviceId } = req.body || {};

    if (!command) {
      res.status(400).json({ success: false, message: 'Missing required field: command' });
      return;
    }

    try {
      const payload = {
        version: '1.0',
        command: command.toUpperCase(),
        params: params || {},
        timestamp: Date.now()
      };

      const result = await connectionManager.sendCommandToAgent(deviceId, payload);
      res.json(result);
    } catch (error: any) {
      console.error('[CommandRouter] Error dispatching command:', error.message);
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
