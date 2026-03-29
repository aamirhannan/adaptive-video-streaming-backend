import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth-middleware.js';
import type { Role } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';

export const requireRoles = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      next(new HttpError(403, 'Forbidden'));
      return;
    }

    next();
  };
};
