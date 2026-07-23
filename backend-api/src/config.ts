import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  agentSecretToken: string;
  alexaSkillSecret: string;
  alexaSkillId?: string;
}

export function loadAndValidateConfig(): AppConfig {
  const portStr = process.env.PORT || '8080';
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`[Config Error] Invalid PORT environment variable: ${portStr}`);
  }

  const agentSecretToken = process.env.AGENT_SECRET_TOKEN;
  const alexaSkillSecret = process.env.ALEXA_SKILL_SECRET;
  const alexaSkillId = process.env.ALEXA_SKILL_ID;

  const missing: string[] = [];
  if (!agentSecretToken) missing.push('AGENT_SECRET_TOKEN');
  if (!alexaSkillSecret) missing.push('ALEXA_SKILL_SECRET');

  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[Config Error] Missing required production environment variables: ${missing.join(', ')}`);
    } else {
      console.warn(`[Config Warning] Missing environment variables (${missing.join(', ')}). Using fallback development tokens.`);
    }
  }

  return {
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
    agentSecretToken: agentSecretToken || 'DEV_AGENT_SECRET_FALLBACK_TOKEN_123',
    alexaSkillSecret: alexaSkillSecret || 'DEV_ALEXA_SKILL_SECRET_FALLBACK_456',
    alexaSkillId
  };
}
