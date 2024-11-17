import { Request, Response } from 'express';
import { version } from '../../package.json';

export const healthController = {
  check: async (req: Request, res: Response) => {
    try {
      // You can add more checks here (database, redis, etc.)
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.json(status);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};