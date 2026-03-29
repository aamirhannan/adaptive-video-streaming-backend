import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { createVideoRouter } from './modules/videos/video.routes.js';
import { createSocketServer } from './realtime/socket.js';

const bootstrap = async () => {
  try {
    await connectDatabase();
    console.log('MongoDB connected');

    const app = createApp();
    const server = createServer(app);
    const io = createSocketServer(server);
    app.use('/api/videos', createVideoRouter(io));
    app.use(errorHandler);

    server.listen(env.port, () => {
      console.log(`Server is running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void bootstrap();
