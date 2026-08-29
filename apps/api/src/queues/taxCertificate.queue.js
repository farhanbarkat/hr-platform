import { Queue } from 'bullmq';
import redis from '../db/redis.js';

// Reuse existing Redis connection instance
const redisConnection = redis?.options
  ? { host: redis.options.host, port: redis.options.port, password: redis.options.password }
  : { host: '127.0.0.1', port: 6379 };

export const taxCertificateQueue = new Queue('tax-certificate-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});