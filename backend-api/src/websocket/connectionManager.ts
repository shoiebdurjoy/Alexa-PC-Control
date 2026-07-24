import { WebSocket } from 'ws';
import { logEvent } from '../logger';

export interface ConnectedAgent {
  deviceId: string;
  socket: WebSocket;
  connectedAt: number;
  lastPing: number;
}

export interface CommandPayload {
  version: string;
  requestId: string;
  command: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface CommandResponse {
  command: string;
  requestId: string;
  success: boolean;
  message: string;
  data?: any;
  [key: string]: any;
}

export class ConnectionManager {
  private agents = new Map<string, ConnectedAgent>();

  public registerAgent(deviceId: string, socket: WebSocket): void {
    const existing = this.agents.get(deviceId);
    if (existing) {
      logEvent(`[Registry Override] Existing connection found for device ${deviceId}. Socket state: ${existing.socket.readyState}. Overriding...`);
      if (existing.socket !== socket) {
        try {
          existing.socket.close(1000, 'Replaced by new connection');
        } catch (_e) { /* ignore close errors */ }
      }
    }

    this.agents.set(deviceId, {
      deviceId,
      socket,
      connectedAt: Date.now(),
      lastPing: Date.now()
    });

    logEvent(`[Registry Register] Agent '${deviceId}' registered successfully. Active agents: ${this.agents.size} | Connected IPs: ${Array.from(this.agents.keys()).join(', ')}`);
  }

  public unregisterAgent(deviceId: string, socket: WebSocket): void {
    const existing = this.agents.get(deviceId);
    if (existing) {
      if (existing.socket === socket) {
        this.agents.delete(deviceId);
        logEvent(`[Registry Unregister] Agent '${deviceId}' unregistered. Active agents remaining: ${this.agents.size}`);
      } else {
        logEvent(`[Registry Unregister Ignored] Stale close event for '${deviceId}' ignored (already replaced).`);
      }
    } else {
      logEvent(`[Registry Unregister Warning] Attempted to unregister untracked agent '${deviceId}'`);
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
    const startTime = Date.now();
    return new Promise<CommandResponse>((resolve, reject) => {
      const agent = this.getAgent(deviceId);
      if (!agent) {
        logEvent(`[Command Route Error] [ReqID: ${payload.requestId}] Failed to route command ${payload.command}. Reason: No registered agents in map.`);
        reject(new Error('Target Windows PC Agent is not connected.'));
        return;
      }
      if (agent.socket.readyState !== WebSocket.OPEN) {
        logEvent(`[Command Route Error] [ReqID: ${payload.requestId}] Failed to route command ${payload.command}. Reason: Agent socket not in OPEN state (Current state: ${agent.socket.readyState}).`);
        reject(new Error('Target Windows PC Agent is not connected.'));
        return;
      }

      const jsonPayload = JSON.stringify(payload);
      const timeout = setTimeout(() => {
        cleanup();
        logEvent(`[Command Route Timeout] [ReqID: ${payload.requestId}] Command ${payload.command} execution timed out (5000ms).`);
        reject(new Error('Agent response timed out.'));
      }, 5000);

      const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]): void => {
        try {
          const response = JSON.parse(data.toString()) as CommandResponse;
          // Validate matching command name and unique request ID to handle async concurrency correctly
          if (response.command === payload.command && response.requestId === payload.requestId) {
            cleanup();
            const latency = Date.now() - startTime;
            logEvent(`[Command Route Success] [ReqID: ${payload.requestId}] Command: ${payload.command} | Success: ${response.success} | Latency: ${latency}ms | Message: ${response.message}`);
            resolve(response);
          }
        } catch (e: any) {
          logEvent(`[Command Route Message Error] Failed parsing message during command execution: ${e.message}`);
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
          logEvent(`[Command Route Send Error] [ReqID: ${payload.requestId}] Failed to send command socket payload: ${err.message}`);
          reject(err);
        } else {
          logEvent(`[Command Route Sent] [ReqID: ${payload.requestId}] Command payload successfully sent to socket for ${agent.deviceId}`);
        }
      });
    });
  }
}
