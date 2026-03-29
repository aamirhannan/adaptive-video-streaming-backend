import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { userRouter } from './modules/users/user.routes.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.send('Adaptive Video Streaming API is running');
  });

  app.use('/api/auth', userRouter);

  app.use(errorHandler);

  return app;
};
