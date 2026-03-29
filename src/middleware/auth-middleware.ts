import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';
import { verifyAuthToken } from '../utils/jwt.js';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
  };
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Missing or invalid Authorization header'));
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

export type { AuthenticatedRequest };
