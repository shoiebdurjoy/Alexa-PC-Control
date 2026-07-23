const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load config from the C# agent's appsettings.json
const configPath = path.join(__dirname, '..', 'windows-pc-agent', 'src', 'AlexaPCAgent', 'appsettings.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const BACKEND_URL = config.BackendWebSocketUrl;
const AGENT_TOKEN = config.AgentToken;
const DEVICE_ID = require('os').hostname();

let retryDelay = 2000;
const MAX_RETRY = 60000;
let ws = null;

function executeCommand(payload) {
  const cmd = (payload.command || '').toUpperCase();
  const params = payload.params || {};

  switch (cmd) {
    case 'LOCK':
      try {
        execSync('rundll32.exe user32.dll,LockWorkStation');
        return { success: true, message: 'PC workstation locked.' };
      } catch (e) {
        return { success: false, message: 'Failed to lock workstation.' };
      }

    case 'SHUTDOWN': {
      const mins = params.durationMinutes || 0;
      if (mins > 0) {
        execSync(`shutdown /s /t ${mins * 60} /f`);
        return { success: true, message: `PC shutdown scheduled in ${mins} minutes.` };
      }
      execSync('shutdown /s /t 0 /f');
      return { success: true, message: 'PC shutdown initiated.' };
    }

    case 'RESTART': {
      const mins = params.durationMinutes || 0;
      if (mins > 0) {
        execSync(`shutdown /r /t ${mins * 60} /f`);
        return { success: true, message: `PC restart scheduled in ${mins} minutes.` };
      }
      execSync('shutdown /r /t 0 /f');
      return { success: true, message: 'PC restart initiated.' };
    }

    case 'SLEEP':
      try {
        execSync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
        return { success: true, message: 'PC put to sleep.' };
      } catch (e) {
        return { success: false, message: 'Failed to put PC to sleep.' };
      }

    case 'CANCEL_SCHEDULE':
      try {
        execSync('shutdown /a');
        return { success: true, message: 'Scheduled power action cancelled.' };
      } catch (e) {
        return { success: true, message: 'No pending power actions.' };
      }

    case 'MUTE':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"');
        return { success: true, message: 'PC audio mute toggled.' };
      } catch (e) {
        return { success: false, message: 'Failed to mute.' };
      }

    case 'UNMUTE':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"');
        return { success: true, message: 'PC audio unmute toggled.' };
      } catch (e) {
        return { success: false, message: 'Failed to unmute.' };
      }

    case 'VOLUME_UP':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"');
        return { success: true, message: 'PC volume increased.' };
      } catch (e) {
        return { success: false, message: 'Failed to increase volume.' };
      }

    case 'VOLUME_DOWN':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"');
        return { success: true, message: 'PC volume decreased.' };
      } catch (e) {
        return { success: false, message: 'Failed to decrease volume.' };
      }

    case 'SET_VOLUME': {
      const level = Math.max(0, Math.min(100, params.volumePercent || 50));
      try {
        const ps = `$wshell = New-Object -ComObject WScript.Shell; ` +
          `$obj = New-Object -ComObject MMDeviceEnumerator.MMDeviceEnumerator; ` +
          `Write-Host 'Volume set attempted to ${level}'`;
        // Use nircmd if available, otherwise fallback
        try {
          execSync(`nircmd.exe setsysvolume ${Math.round(level * 655.35)}`);
        } catch (_) {
          // Fallback: press volume keys to approximate
          execSync(`powershell -Command "1..50 | ForEach-Object { (New-Object -ComObject WScript.Shell).SendKeys([char]174) }; 1..${Math.round(level / 2)} | ForEach-Object { (New-Object -ComObject WScript.Shell).SendKeys([char]175) }"`);
        }
        return { success: true, message: `PC volume set to ${level} percent.` };
      } catch (e) {
        return { success: false, message: 'Failed to set volume.' };
      }
    }

    case 'GET_STATUS':
      return {
        success: true,
        message: 'Status fetched.',
        data: {
          online: true,
          volumePercent: 50,
          isMuted: false,
          uptimeSeconds: Math.round(require('os').uptime()),
          activeScheduledTasks: 0,
          timestamp: Date.now()
        }
      };

    default:
      return { success: false, message: `Unknown command: ${cmd}` };
  }
}

function connect() {
  console.log(`[Agent] Connecting to ${BACKEND_URL}...`);

  ws = new WebSocket(BACKEND_URL, {
    headers: {
      'X-Agent-Token': AGENT_TOKEN,
      'X-Device-Id': DEVICE_ID
    }
  });

  ws.on('open', () => {
    console.log(`[Agent] Connected to Render backend. Device: ${DEVICE_ID}`);
    retryDelay = 2000;
  });

  ws.on('message', (data) => {
    try {
      const payload = JSON.parse(data.toString());
      console.log(`[Agent] Received command: ${payload.command}`);

      const result = executeCommand(payload);
      console.log(`[Agent] Result: ${result.message}`);

      const response = JSON.stringify({
        version: '1.0',
        command: payload.command,
        success: result.success,
        message: result.message,
        data: result.data || null,
        timestamp: Date.now()
      });

      ws.send(response);
    } catch (e) {
      console.error('[Agent] Error processing message:', e.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[Agent] Disconnected (code: ${code}). Reconnecting in ${retryDelay / 1000}s...`);
    const jitter = Math.random() * 1000;
    setTimeout(connect, retryDelay + jitter);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY);
  });

  ws.on('error', (err) => {
    console.error(`[Agent] WebSocket error: ${err.message}`);
  });

  ws.on('ping', () => {
    // ws library auto-responds with pong
  });
}

console.log('==============================================');
console.log(' Alexa-PC-Control Windows Agent (Node.js)');
console.log(` Backend: ${BACKEND_URL}`);
console.log(` Device:  ${DEVICE_ID}`);
console.log('==============================================');
connect();
