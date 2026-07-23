import { Request, Response, NextFunction } from 'express';

export class TokenValidator {
  private readonly agentToken: string;
  private readonly skillSecret: string;

  constructor(agentToken: string, skillSecret: string) {
    this.agentToken = agentToken;
    this.skillSecret = skillSecret;
  }

  public validateAgentToken(token: string | string[] | undefined): boolean {
    if (!token) return false;
    const value = Array.isArray(token) ? token[0] : token;
    return value === this.agentToken;
  }

  public validateSkillSecretMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const headerSecret = req.headers['x-skill-secret'];
    if (!headerSecret || headerSecret !== this.skillSecret) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing X-Skill-Secret header' });
      return;
    }
    next();
  };
}
