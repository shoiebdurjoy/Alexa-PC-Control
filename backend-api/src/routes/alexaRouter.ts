import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ConnectionManager, CommandResponse, CommandPayload } from '../websocket/connectionManager';

interface AlexaRequestEnvelope {
  session?: {
    application?: {
      applicationId?: string;
    };
  };
  request?: {
    type: string;
    requestId?: string;
    timestamp?: string;
    intent?: {
      name: string;
      slots?: Record<string, {
        name: string;
        value?: string;
        resolutions?: any;
      }>;
    };
  };
}

// In-memory sliding set to deduplicate identical retried requests from Alexa (pruned via TTL)
const processedAlexaRequestIds = new Set<string>();

export function createAlexaRouter(connectionManager: ConnectionManager, skillId: string | undefined): Router {
  const router = Router();

  router.post('/alexa', async (req: Request, res: Response): Promise<void> => {
    const envelope = req.body as AlexaRequestEnvelope;

    // Optional: Validate Alexa Skill ID if configured to prevent unauthorized requests
    if (skillId && envelope.session?.application?.applicationId !== skillId) {
      console.warn(`[Security Alert] Request rejected. Invalid Skill ID: ${envelope.session?.application?.applicationId}`);
      res.status(403).json({ success: false, message: 'Forbidden: Invalid Alexa Skill ID' });
      return;
    }

    const requestType = envelope.request?.type;
    const alexaRequestId = envelope.request?.requestId || crypto.randomUUID();

    // Prevent duplicate execution if Alexa retries the same request within its retry window
    if (envelope.request?.requestId) {
      if (processedAlexaRequestIds.has(alexaRequestId)) {
        console.log(`[Deduplication] [ReqID: ${alexaRequestId}] Duplicate Alexa request ignored.`);
        res.json(buildAlexaResponse('Ignoring duplicate command request.'));
        return;
      }
      // Add to processed registry and auto-prune after 2 minutes
      processedAlexaRequestIds.add(alexaRequestId);
      setTimeout(() => processedAlexaRequestIds.delete(alexaRequestId), 120000);
    }

    if (requestType === 'LaunchRequest') {
      res.json(buildAlexaResponse('Welcome to PC Control. You can say lock the PC, set volume, or ask for status.'));
      return;
    }

    if (requestType === 'SessionEndedRequest') {
      res.json(buildAlexaResponse('Goodbye!'));
      return;
    }

    if (requestType !== 'IntentRequest' || !envelope.request?.intent) {
      res.json(buildAlexaResponse('Sorry, I did not understand that request.'));
      return;
    }

    const intentName = envelope.request.intent.name;
    const slots = envelope.request.intent.slots || {};

    try {
      let command = '';
      let params: Record<string, unknown> = {};
      let responseMessage = 'Command sent.';

      switch (intentName) {
        case 'LockIntent':
          command = 'LOCK';
          responseMessage = 'Locking your PC.';
          break;

        case 'PowerIntent': {
          const rawAction = slots.Action?.value?.toLowerCase() || 'shutdown';
          const durationVal = slots.DurationMinutes?.value;
          const durationMinutes = durationVal ? parseInt(durationVal, 10) : 0;

          command = 'SHUTDOWN';
          if (rawAction.includes('sleep') || rawAction.includes('standby')) command = 'SLEEP';
          if (rawAction.includes('restart') || rawAction.includes('reboot')) command = 'RESTART';

          params = { durationMinutes };
          responseMessage = durationMinutes > 0
            ? `Scheduling ${command.toLowerCase()} in ${durationMinutes} minutes.`
            : `Initiating ${command.toLowerCase()} now.`;
          break;
        }

        case 'CancelScheduleIntent':
          command = 'CANCEL_SCHEDULE';
          break;

        case 'VolumeControlIntent': {
          const actionSlot = slots.VolumeAction?.value?.toLowerCase() || '';
          command = 'VOLUME_UP';
          if (actionSlot.includes('mute') && !actionSlot.includes('unmute')) command = 'MUTE';
          else if (actionSlot.includes('unmute')) command = 'UNMUTE';
          else if (actionSlot.includes('decrease') || actionSlot.includes('down') || actionSlot.includes('quieter')) command = 'VOLUME_DOWN';
          break;
        }

        case 'SetVolumeIntent': {
          const volumeVal = slots.VolumePercent?.value;
          const volumePercent = volumeVal ? parseInt(volumeVal, 10) : 50;
          command = 'SET_VOLUME';
          params = { volumePercent };
          responseMessage = `Setting volume to ${volumePercent} percent.`;
          break;
        }

        case 'PCStatusIntent':
          command = 'GET_STATUS';
          break;

        case 'AMAZON.HelpIntent':
          res.json(buildAlexaResponse('You can say lock the PC, set volume to fifty percent, mute, or ask for status.'));
          return;

        case 'AMAZON.CancelIntent':
        case 'AMAZON.StopIntent':
          res.json(buildAlexaResponse('Goodbye!'));
          return;

        default:
          res.json(buildAlexaResponse('Sorry, that command is not supported.'));
          return;
      }

      if (command) {
        const payload: CommandPayload = {
          version: '1.0',
          requestId: alexaRequestId,
          command,
          params,
          timestamp: Date.now()
        };

        const result = await connectionManager.sendCommandToAgent(undefined, payload);
        if (result.success) {
          if (command === 'GET_STATUS' && result.data) {
            const d = result.data;
            responseMessage = `Your PC is online. Volume is at ${d.volumePercent} percent, ${d.isMuted ? 'muted' : 'unmuted'}. Active scheduled timers: ${d.activeScheduledTasks}.`;
          } else if (result.message) {
            responseMessage = result.message;
          }
        } else {
          responseMessage = `Failed to execute: ${result.message}`;
        }
      }

      res.json(buildAlexaResponse(responseMessage));
    } catch (error: any) {
      console.error(`[AlexaRouter Error] [ReqID: ${alexaRequestId}]:`, error.message);
      res.json(buildAlexaResponse('Could not connect to backend server. Make sure your PC Agent is online.'));
    }
  });

  return router;
}

function buildAlexaResponse(text: string) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: text
      },
      shouldEndSession: true
    }
  };
}
