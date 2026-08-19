import { Queue, Worker } from 'bullmq';
import { processEmployeeRows } from '../services/employeeImport.service.js';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export const employeeImportQueue = new Queue('employee-import-queue', {
  connection: redisConnection,
});

// In-memory cache for quick status polling when Redis worker finishes
export const jobResultsStore = new Map();

// Initialize worker conditionally
let worker;
try {
  worker = new Worker(
    'employee-import-queue',
    async (job) => {
      const { rows, companyId } = job.data;
      const result = await processEmployeeRows(rows, companyId);
      jobResultsStore.set(job.id, { status: 'COMPLETED', result });
      return result;
    },
    { connection: redisConnection }
  );

  worker.on('failed', (job, err) => {
    jobResultsStore.set(job.id, { status: 'FAILED', error: err.message });
  });
} catch (e) {
  console.warn('⚠️ BullMQ worker disabled (Redis not connected).');
}