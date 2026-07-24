const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isPkg = typeof process.pkg !== 'undefined';
let configPath = '';
let appsPath = '';

if (isPkg) {
  const appDataDir = path.join(process.env.APPDATA, 'AlexaPCAgent');
  configPath = path.join(appDataDir, 'appsettings.json');
  appsPath = path.join(appDataDir, 'apps.json');
} else {
  const localPath = path.join(__dirname, 'appsettings.json');
  const srcPath = path.join(__dirname, 'src', 'AlexaPCAgent', 'appsettings.json');
  configPath = fs.existsSync(localPath) ? localPath : srcPath;

  const localAppsPath = path.join(__dirname, 'apps.json');
  const srcAppsPath = path.join(__dirname, 'src', 'AlexaPCAgent', 'apps.json');
  appsPath = fs.existsSync(localAppsPath) ? localAppsPath : srcAppsPath;
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

let appsRegistry = [];
try {
  appsRegistry = JSON.parse(fs.readFileSync(appsPath, 'utf8'));
} catch (err) {
  console.error('[Agent] Failed to load apps.json registry:', err.message);
}

const BACKEND_URL = process.env.BACKEND_URL || config.BackendWebSocketUrl;
const AGENT_TOKEN = process.env.AGENT_TOKEN || config.AgentToken;
const DEVICE_ID = require('os').hostname();

let retryDelay = 2000;
const MAX_RETRY = 60000;
let ws = null;

// In-memory power scheduler (survives network disconnects, runs in agent process)
const activePowerTimers = new Map(); // Key: 'POWER_ACTION', Value: { timeoutId, action, scheduledTime }

function triggerImmediatePowerAction(action) {
  switch (action) {
    case 'SHUTDOWN':
      execSync('shutdown /s /t 0', { windowsHide: true });
      break;
    case 'RESTART':
      execSync('shutdown /r /t 0', { windowsHide: true });
      break;
    case 'SLEEP':
      execSync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', { windowsHide: true });
      break;
  }
}

function cancelActivePowerAction() {
  const timer = activePowerTimers.get('POWER_ACTION');
  if (timer) {
    clearTimeout(timer.timeoutId);
    activePowerTimers.delete('POWER_ACTION');
    return true;
  }
  return false;
}

function schedulePowerAction(action, minutes) {
  cancelActivePowerAction();
  const delayMs = minutes * 60 * 1000;
  
  const timeoutId = setTimeout(() => {
    activePowerTimers.delete('POWER_ACTION');
    try {
      triggerImmediatePowerAction(action);
    } catch (e) {
      console.error(`[Agent] Failed to execute scheduled action ${action}:`, e.message);
    }
  }, delayMs);

  activePowerTimers.set('POWER_ACTION', {
    timeoutId,
    action,
    scheduledTime: Date.now() + delayMs
  });
}

function normalizeName(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[\s\-_.\u2010-\u2015\u2212\uff0d\u200b]/g, '')
    .trim();
}

function findAppInRegistry(appQuery) {
  if (!appQuery) return null;
  const queryLower = appQuery.toLowerCase().trim();
  const queryNormalized = normalizeName(appQuery);

  // 1. Exact match (case-insensitive) on name or aliases
  let app = appsRegistry.find(a => 
    a.name.toLowerCase() === queryLower || 
    (a.aliases && a.aliases.map(al => al.toLowerCase()).includes(queryLower))
  );
  if (app) return app;

  // 2. Normalized match (stripped punctuation/spaces) on name or aliases
  app = appsRegistry.find(a => 
    normalizeName(a.name) === queryNormalized || 
    (a.aliases && a.aliases.map(normalizeName).includes(queryNormalized))
  );
  if (app) return app;

  // 3. Substring/fuzzy match
  app = appsRegistry.find(a => 
    normalizeName(a.name).includes(queryNormalized) || 
    (a.aliases && a.aliases.some(al => normalizeName(al).includes(queryNormalized))) ||
    queryNormalized.includes(normalizeName(a.name))
  );
  return app || null;
}

function executeCommand(payload) {
  const cmd = (payload.command || '').toUpperCase();
  const params = payload.params || {};

  switch (cmd) {
    case 'LOCK':
      try {
        execSync('rundll32.exe user32.dll,LockWorkStation', { windowsHide: true });
        return { success: true, message: 'PC workstation locked.' };
      } catch (e) {
        return { success: false, message: 'Failed to lock workstation: ' + e.message };
      }

    case 'SHUTDOWN': {
      const mins = params.durationMinutes || 0;
      try {
        if (mins > 0) {
          schedulePowerAction('SHUTDOWN', mins);
          return { success: true, message: `PC shutdown scheduled in ${mins} minutes via internal scheduler.` };
        }
        setTimeout(() => {
          try { triggerImmediatePowerAction('SHUTDOWN'); } catch (err) { console.error(err); }
        }, 1000);
        return { success: true, message: 'PC shutdown initiated.' };
      } catch (e) {
        return { success: false, message: 'Failed to execute shutdown: ' + e.message };
      }
    }

    case 'RESTART': {
      const mins = params.durationMinutes || 0;
      try {
        if (mins > 0) {
          schedulePowerAction('RESTART', mins);
          return { success: true, message: `PC restart scheduled in ${mins} minutes via internal scheduler.` };
        }
        setTimeout(() => {
          try { triggerImmediatePowerAction('RESTART'); } catch (err) { console.error(err); }
        }, 1000);
        return { success: true, message: 'PC restart initiated.' };
      } catch (e) {
        return { success: false, message: 'Failed to execute restart: ' + e.message };
      }
    }

    case 'SLEEP': {
      const mins = params.durationMinutes || 0;
      try {
        if (mins > 0) {
          schedulePowerAction('SLEEP', mins);
          return { success: true, message: `PC sleep scheduled in ${mins} minutes via internal scheduler.` };
        }
        setTimeout(() => {
          try { triggerImmediatePowerAction('SLEEP'); } catch (err) { console.error(err); }
        }, 1000);
        return { success: true, message: 'PC put to sleep.' };
      } catch (e) {
        return { success: false, message: 'Failed to put PC to sleep: ' + e.message };
      }
    }

    case 'CANCEL_SCHEDULE': {
      const cancelled = cancelActivePowerAction();
      // Also trigger shutdown /a in case any legacy OS-level timer is active
      try { execSync('shutdown /a', { windowsHide: true }); } catch (_) {}
      return { 
        success: true, 
        message: cancelled 
          ? 'Scheduled PC power action cancelled.' 
          : 'No pending scheduled power actions.' 
      };
    }

    case 'MUTE':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', { windowsHide: true });
        return { success: true, message: 'PC audio mute toggled.' };
      } catch (e) {
        return { success: false, message: 'Failed to toggle mute: ' + e.message };
      }

    case 'UNMUTE':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', { windowsHide: true });
        return { success: true, message: 'PC audio unmute toggled.' };
      } catch (e) {
        return { success: false, message: 'Failed to toggle unmute: ' + e.message };
      }

    case 'VOLUME_UP':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"', { windowsHide: true });
        return { success: true, message: 'PC volume increased.' };
      } catch (e) {
        return { success: false, message: 'Failed to increase volume: ' + e.message };
      }

    case 'VOLUME_DOWN':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"', { windowsHide: true });
        return { success: true, message: 'PC volume decreased.' };
      } catch (e) {
        return { success: false, message: 'Failed to decrease volume: ' + e.message };
      }

    case 'SET_VOLUME': {
      const level = Math.max(0, Math.min(100, params.volumePercent || 50));
      try {
        try {
          execSync(`nircmd.exe setsysvolume ${Math.round(level * 655.35)}`, { windowsHide: true });
        } catch (_) {
          execSync(`powershell -Command "1..50 | ForEach-Object { (New-Object -ComObject WScript.Shell).SendKeys([char]174) }; 1..${Math.round(level / 2)} | ForEach-Object { (New-Object -ComObject WScript.Shell).SendKeys([char]175) }"`, { windowsHide: true });
        }
        return { success: true, message: `PC volume set to ${level} percent.` };
      } catch (e) {
        return { success: false, message: 'Failed to set volume: ' + e.message };
      }
    }

    case 'MEDIA_PLAY':
    case 'MEDIA_PAUSE':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]179)"', { windowsHide: true });
        return { success: true, message: 'PC media play/pause toggled.' };
      } catch (e) {
        return { success: false, message: 'Failed to toggle media play/pause: ' + e.message };
      }

    case 'MEDIA_NEXT':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]176)"', { windowsHide: true });
        return { success: true, message: 'PC media playing next track.' };
      } catch (e) {
        return { success: false, message: 'Failed to play next track: ' + e.message };
      }

    case 'MEDIA_PREV':
      try {
        execSync('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]177)"', { windowsHide: true });
        return { success: true, message: 'PC media playing previous track.' };
      } catch (e) {
        return { success: false, message: 'Failed to play previous track: ' + e.message };
      }

    case 'OPEN_APP': {
      const appQuery = (params.appName || '').trim();
      if (!appQuery) {
        return { success: false, message: 'No application name specified.' };
      }

      const app = findAppInRegistry(appQuery);
      if (!app) {
        return { success: false, message: `Application ${params.appName} is not configured in the registry.` };
      }

      try {
        let isRunning = false;
        try {
          execSync(`powershell -Command "Get-Process -Name '${app.processName}' -ErrorAction Stop"`, { stdio: 'ignore', windowsHide: true });
          isRunning = true;
        } catch (_) {}

        if (isRunning) {
          const psCommand = `$wshell = New-Object -ComObject Wscript.Shell; $p = Get-Process -Name '${app.processName}' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($p) { $wshell.AppActivate($p.Id) }`;
          execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore', windowsHide: true });
          return { success: true, message: `${app.name} is already running. Brought to foreground.` };
        } else {
          const resolvedCommand = app.launchCommand.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '%'+name+'%');
          const { exec } = require('child_process');
          exec(resolvedCommand, { windowsHide: true }, (err) => {
            if (err) console.error(`[Agent] Failed to run launchCommand for ${app.name}:`, err.message);
          });

          // Wait and verify launch
          let launched = false;
          for (let i = 0; i < 5; i++) {
            execSync(`powershell -Command "Start-Sleep -Seconds 1"`, { stdio: 'ignore', windowsHide: true });
            try {
              execSync(`powershell -Command "Get-Process -Name '${app.processName}' -ErrorAction Stop"`, { stdio: 'ignore', windowsHide: true });
              launched = true;
              break;
            } catch (_) {}
          }

          if (launched) {
            return { success: true, message: `Opened ${app.name}.` };
          } else {
            return { success: false, message: `Failed to open ${app.name}: The application was started but the process could not be verified.` };
          }
        }
      } catch (e) {
        return { success: false, message: `Failed to open ${app.name}: ${e.message}` };
      }
    }

    case 'CLOSE_APP': {
      const appQuery = (params.appName || '').trim();
      if (!appQuery) {
        return { success: false, message: 'No application name specified.' };
      }

      const app = findAppInRegistry(appQuery);
      if (!app) {
        return { success: false, message: `Application ${params.appName} is not configured in the registry.` };
      }

      try {
        let isRunning = false;
        try {
          execSync(`powershell -Command "Get-Process -Name '${app.processName}' -ErrorAction Stop"`, { stdio: 'ignore', windowsHide: true });
          isRunning = true;
        } catch (_) {}

        if (!isRunning) {
          return { success: true, message: `${app.name} is not currently running.` };
        }

        try {
          execSync(`taskkill /IM "${app.processName}.exe"`, { stdio: 'ignore', windowsHide: true });
        } catch (_) {}

        // Poll process presence up to 6 times (500ms sleep, total 3 seconds max)
        let remains = true;
        for (let i = 0; i < 6; i++) {
          execSync(`powershell -Command "Start-Sleep -Milliseconds 500"`, { stdio: 'ignore', windowsHide: true });
          try {
            execSync(`powershell -Command "Get-Process -Name '${app.processName}' -ErrorAction Stop"`, { stdio: 'ignore', windowsHide: true });
          } catch (_) {
            remains = false;
            break;
          }
        }

        if (remains) {
          const allowForce = app.allowForceKill === true;
          if (allowForce) {
            try {
              execSync(`taskkill /F /IM "${app.processName}.exe"`, { stdio: 'ignore', windowsHide: true });
            } catch (_) {}

            // Poll force-kill verification up to 4 times (250ms sleep, total 1s max)
            let stillRemains = true;
            for (let j = 0; j < 4; j++) {
              execSync(`powershell -Command "Start-Sleep -Milliseconds 250"`, { stdio: 'ignore', windowsHide: true });
              try {
                execSync(`powershell -Command "Get-Process -Name '${app.processName}' -ErrorAction Stop"`, { stdio: 'ignore', windowsHide: true });
              } catch (_) {
                stillRemains = false;
                break;
              }
            }

            if (stillRemains) {
              return { success: false, message: `Failed to close ${app.name}: The process remains active after force-kill.` };
            } else {
              return { success: true, message: `Closed ${app.name}.` };
            }
          } else {
            return {
              success: true,
              message: `${app.name} requires your confirmation to close because it may contain unsaved work.`
            };
          }
        }

        return { success: true, message: `Closed ${app.name}.` };
      } catch (e) {
        return { success: false, message: `Failed to close ${app.name}: ${e.message}` };
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

let heartbeatTimeout = null;

function connect() {
  console.log(`[${new Date().toISOString()}] [Agent] Connecting to ${BACKEND_URL}...`);

  ws = new WebSocket(BACKEND_URL, {
    headers: {
      'X-Agent-Token': AGENT_TOKEN,
      'X-Device-Id': DEVICE_ID
    }
  });

  function heartbeat() {
    clearTimeout(heartbeatTimeout);
    // Server sends ping every 30s. If we don't get any ping or message in 45s, terminate.
    heartbeatTimeout = setTimeout(() => {
      console.warn(`[${new Date().toISOString()}] [Agent] No heartbeat from server in 45s. Terminating connection...`);
      if (ws) {
        try { ws.terminate(); } catch (_) {}
      }
    }, 45000);
  }

  ws.on('open', () => {
    console.log(`[${new Date().toISOString()}] [Agent] Connected to Render backend. Device: ${DEVICE_ID}`);
    retryDelay = 2000;
    heartbeat();
  });

  ws.on('message', (data) => {
    heartbeat();
    try {
      const payload = JSON.parse(data.toString());
      const requestId = payload.requestId || 'unknown-req-id';
      console.log(`[${new Date().toISOString()}] [Agent] [ReqID: ${requestId}] Received command: ${payload.command}`);

      const result = executeCommand(payload);
      console.log(`[${new Date().toISOString()}] [Agent] [ReqID: ${requestId}] Result: ${result.message}`);

      const response = JSON.stringify({
        version: '1.0',
        requestId: requestId,
        command: payload.command,
        success: result.success,
        message: result.message,
        data: result.data || null,
        timestamp: Date.now()
      });

      ws.send(response);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [Agent] Error processing message:`, e.message);
    }
  });

  ws.on('close', (code, reason) => {
    clearTimeout(heartbeatTimeout);
    console.log(`[${new Date().toISOString()}] [Agent] Disconnected (code: ${code}). Reconnecting in ${retryDelay / 1000}s...`);
    const jitter = Math.random() * 1000;
    setTimeout(connect, retryDelay + jitter);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY);
  });

  ws.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] [Agent] WebSocket error: ${err.message}`);
  });

  ws.on('ping', () => {
    heartbeat();
  });
}

console.log('==============================================');
console.log(' Alexa-PC-Control Windows Agent (Node.js)');
console.log(` Backend: ${BACKEND_URL}`);
console.log(` Device:  ${DEVICE_ID}`);
console.log('==============================================');
connect();
