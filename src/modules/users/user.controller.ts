import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth-middleware.js';
import { HttpError } from '../../utils/http-error.js';
import { UserService } from './user.service.js';

export class UserController {
  constructor(private readonly userService: UserService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body as {
        email?: string;
        password?: string;
        role?: 'admin' | 'editor' | 'viewer';
      };

      if (!email || !password) {
        throw new HttpError(400, 'Email and password are required');
      }

      const registerInput =
        role !== undefined ? { email, password, role } : { email, password };

      const result = await this.userService.register(registerInput);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };

      if (!email || !password) {
        throw new HttpError(400, 'Email and password are required');
      }

      const result = await this.userService.login({ email, password });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new HttpError(401, 'Unauthorized');
      }

      const user = await this.userService.getUserByUserId(req.user.userId);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };
}
