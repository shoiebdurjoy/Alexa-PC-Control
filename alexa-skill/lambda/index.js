const Alexa = require('ask-sdk-core');
const axios = require('axios');

const BACKEND_API_URL = process.env.BACKEND_API_URL;
const SKILL_SECRET = process.env.SKILL_SECRET;

async function sendBackendCommand(command, params = {}) {
    if (!BACKEND_API_URL || !SKILL_SECRET) {
        console.error('Lambda Environment Error: BACKEND_API_URL or SKILL_SECRET missing.');
        return {
            success: false,
            message: 'Skill environment configuration is incomplete. Please set BACKEND_API_URL and SKILL_SECRET.'
        };
    }

    try {
        const response = await axios.post(
            BACKEND_API_URL,
            { command, params },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Skill-Secret': SKILL_SECRET
                },
                timeout: 3500
            }
        );
        return response.data;
    } catch (error) {
        console.error('Backend API Call Error:', error.message);
        return {
            success: false,
            message: error.response?.data?.message || 'Could not connect to backend server. Make sure your PC Agent is online.'
        };
    }
}

const LockIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'LockIntent';
    },
    async handle(handlerInput) {
        const result = await sendBackendCommand('LOCK');
        const speakOutput = result.success ? 'Locking your PC.' : `Failed to lock PC: ${result.message}`;
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const PowerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PowerIntent';
    },
    async handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        const rawAction = slots.Action?.value?.toLowerCase() || 'shutdown';
        const durationMinutes = slots.DurationMinutes?.value ? parseInt(slots.DurationMinutes.value, 10) : 0;

        let command = 'SHUTDOWN';
        if (rawAction.includes('sleep') || rawAction.includes('standby')) command = 'SLEEP';
        if (rawAction.includes('restart') || rawAction.includes('reboot')) command = 'RESTART';

        const result = await sendBackendCommand(command, { durationMinutes });
        const speakOutput = result.message || `Initiating ${command.toLowerCase()}`;
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const CancelScheduleIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CancelScheduleIntent';
    },
    async handle(handlerInput) {
        const result = await sendBackendCommand('CANCEL_SCHEDULE');
        return handlerInput.responseBuilder.speak(result.message || 'Cancelled scheduled power action.').getResponse();
    }
};

const VolumeControlIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'VolumeControlIntent';
    },
    async handle(handlerInput) {
        const actionSlot = handlerInput.requestEnvelope.request.intent.slots.VolumeAction?.value?.toLowerCase() || '';

        let command = 'VOLUME_UP';
        if (actionSlot.includes('mute') && !actionSlot.includes('unmute')) command = 'MUTE';
        else if (actionSlot.includes('unmute')) command = 'UNMUTE';
        else if (actionSlot.includes('decrease') || actionSlot.includes('down') || actionSlot.includes('quieter')) command = 'VOLUME_DOWN';

        const result = await sendBackendCommand(command);
        return handlerInput.responseBuilder.speak(result.message || 'Volume updated.').getResponse();
    }
};

const SetVolumeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetVolumeIntent';
    },
    async handle(handlerInput) {
        const volumeSlot = handlerInput.requestEnvelope.request.intent.slots.VolumePercent?.value;
        const volumePercent = volumeSlot ? parseInt(volumeSlot, 10) : 50;

        const result = await sendBackendCommand('SET_VOLUME', { volumePercent });
        return handlerInput.responseBuilder.speak(result.message || `Volume set to ${volumePercent} percent.`).getResponse();
    }
};

const PCStatusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PCStatusIntent';
    },
    async handle(handlerInput) {
        const result = await sendBackendCommand('GET_STATUS');
        if (result.success && result.data) {
            const d = result.data;
            const speakOutput = `Your PC is online. Volume is at ${d.volumePercent} percent, ${d.isMuted ? 'muted' : 'unmuted'}. Active scheduled timers: ${d.activeScheduledTasks}.`;
            return handlerInput.responseBuilder.speak(speakOutput).getResponse();
        }
        return handlerInput.responseBuilder.speak(result.message || 'Could not fetch PC status.').getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can ask me to lock the PC, set volume, mute, shut down in thirty minutes, or ask for status. What would you like to do?';
        return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.speak('Goodbye!').getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error('Skill Error:', error);
        return handlerInput.responseBuilder
            .speak('Sorry, I had trouble understanding that command. Please try again.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LockIntentHandler,
        PowerIntentHandler,
        CancelScheduleIntentHandler,
        VolumeControlIntentHandler,
        SetVolumeIntentHandler,
        PCStatusIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
