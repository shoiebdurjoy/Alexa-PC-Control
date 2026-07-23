import { WebSocket } from 'ws';

export interface ConnectedAgent {
  deviceId: string;
  socket: WebSocket;
  connectedAt: number;
  lastPing: number;
}

export class ConnectionManager {
  private agents = new Map<string, ConnectedAgent>();

  public registerAgent(deviceId: string, socket: WebSocket): void {
    const existing = this.agents.get(deviceId);
    if (existing && existing.socket !== socket) {
      try {
        existing.socket.close(1000, 'Replaced by new connection');
      } catch {}
    }

    this.agents.set(deviceId, {
      deviceId,
      socket,
      connectedAt: Date.now(),
      lastPing: Date.now()
    });

    console.log(`[ConnectionManager] Registered Agent: ${deviceId} (Total active: ${this.agents.size})`);
  }

  public unregisterAgent(deviceId: string): void {
    if (this.agents.has(deviceId)) {
      this.agents.delete(deviceId);
      console.log(`[ConnectionManager] Unregistered Agent: ${deviceId} (Total active: ${this.agents.size})`);
    }
  }

  public getAgent(deviceId?: string): ConnectedAgent | undefined {
    if (deviceId && this.agents.has(deviceId)) {
      return this.agents.get(deviceId);
    }
    // Return first connected agent if deviceId not specified
    const firstKey = this.agents.keys().next().value;
    return firstKey ? this.agents.get(firstKey) : undefined;
  }

  public getActiveCount(): number {
    return this.agents.size;
  }

  public sendCommandToAgent(deviceId: string | undefined, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const agent = this.getAgent(deviceId);
      if (!agent || agent.socket.readyState !== WebSocket.OPEN) {
        return reject(new Error('Target Windows PC Agent is not connected to backend WebSocket hub.'));
      }

      const jsonPayload = JSON.stringify(payload);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Agent execution response timed out.'));
      }, 5000);

      const messageHandler = (data: any) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.command === payload.command) {
            cleanup();
            resolve(response);
          }
        } catch (e) {
          // Ignore non-matching message frames
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        agent.socket.removeListener('message', messageHandler);
      };

      agent.socket.on('message', messageHandler);
      agent.socket.send(jsonPayload, (err) => {
        if (err) {
          cleanup();
          reject(err);
        }
      });
    });
  }
}
