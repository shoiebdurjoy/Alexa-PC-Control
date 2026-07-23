import { WebSocket } from 'ws';

export interface ConnectedAgent {
  deviceId: string;
  socket: WebSocket;
  connectedAt: number;
  lastPing: number;
}

export interface CommandPayload {
  version: string;
  command: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface CommandResponse {
  command: string;
  success: boolean;
  message: string;
  data?: any;
  [key: string]: any;
}

export class ConnectionManager {
  private agents = new Map<string, ConnectedAgent>();

  public registerAgent(deviceId: string, socket: WebSocket): void {
    const existing = this.agents.get(deviceId);
    if (existing && existing.socket !== socket) {
      try {
        existing.socket.close(1000, 'Replaced by new connection');
      } catch (_e) { /* ignore close errors */ }
    }

    this.agents.set(deviceId, {
      deviceId,
      socket,
      connectedAt: Date.now(),
      lastPing: Date.now()
    });

    console.log(`[ConnectionManager] Registered Agent: ${deviceId} (Total: ${this.agents.size})`);
  }

  public unregisterAgent(deviceId: string): void {
    if (this.agents.has(deviceId)) {
      this.agents.delete(deviceId);
      console.log(`[ConnectionManager] Unregistered Agent: ${deviceId} (Total: ${this.agents.size})`);
    }
  }

  public getAgent(deviceId?: string): ConnectedAgent | undefined {
    if (deviceId && this.agents.has(deviceId)) {
      return this.agents.get(deviceId);
    }
    const iter = this.agents.values();
    const first = iter.next();
    return first.done ? undefined : first.value;
  }

  public getActiveCount(): number {
    return this.agents.size;
  }

  public sendCommandToAgent(deviceId: string | undefined, payload: CommandPayload): Promise<CommandResponse> {
    return new Promise<CommandResponse>((resolve, reject) => {
      const agent = this.getAgent(deviceId);
      if (!agent || agent.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('Target Windows PC Agent is not connected.'));
        return;
      }

      const jsonPayload = JSON.stringify(payload);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Agent response timed out.'));
      }, 5000);

      const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]): void => {
        try {
          const response = JSON.parse(data.toString()) as CommandResponse;
          if (response.command === payload.command) {
            cleanup();
            resolve(response);
          }
        } catch (_e) {
          /* ignore non-matching frames */
        }
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        agent.socket.removeListener('message', messageHandler);
      };

      agent.socket.on('message', messageHandler);
      agent.socket.send(jsonPayload, (err?: Error) => {
        if (err) {
          cleanup();
          reject(err);
        }
      });
    });
  }
}
