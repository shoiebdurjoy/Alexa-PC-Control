import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export class TokenValidator {
  private readonly agentToken: string;
  private readonly skillSecret: string;

  constructor(agentToken: string, skillSecret: string) {
    this.agentToken = agentToken;
    this.skillSecret = skillSecret;
  }

  private safeCompare(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  public validateAgentToken(token: string | string[] | undefined): boolean {
    if (!token) return false;
    const value = Array.isArray(token) ? token[0] : token;
    return this.safeCompare(value, this.agentToken);
  }

  public validateSkillSecretMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const headerSecret = req.headers['x-skill-secret'];
    const value = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;

    if (!value || !this.safeCompare(value, this.skillSecret)) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    next();
  };
}
