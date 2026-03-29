import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
};

export const signAuthToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as NonNullable<SignOptions['expiresIn']>,
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, env.jwtSecret);
  return decoded as AuthTokenPayload;
};
