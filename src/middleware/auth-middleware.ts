import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
import { verifyAuthToken } from '../utils/jwt.js';

type AuthenticatedRequest = Request & { user?: AuthUser };

const resolveBearerToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }
  return undefined;
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const token = resolveBearerToken(req);
  if (!token) {
    next(new HttpError(401, 'Missing or invalid Authorization header'));
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

/**
 * Same as authMiddleware but also accepts JWT in query `access_token` so
 * `<video src="...">` can play without an Authorization header (browsers
 * issue Range requests against the URL with query params preserved).
 */
export const streamAuthMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  let token = resolveBearerToken(req);
  if (!token) {
    const q = req.query.access_token;
    if (typeof q === 'string' && q.length > 0) {
      token = q;
    }
  }
  if (!token) {
    next(new HttpError(401, 'Missing or invalid Authorization header'));
    return;
  }

  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

export type { AuthenticatedRequest };
