import { Queue, Worker } from 'bullmq';
import sgMail from '@sendgrid/mail';

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

let notificationQueue = null;
let notificationWorker = null;

try {
  notificationQueue = new Queue('notification-delivery-queue', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  notificationWorker = new Worker(
    'notification-delivery-queue',
    async (job) => {
      const { channel, payload } = job.data;

      if (channel === 'EMAIL') {
        if (!process.env.SENDGRID_API_KEY) {
          console.warn(`[SendGrid STUB] Email to ${payload.to} skipped (No SENDGRID_API_KEY set).`);
          return { delivered: false, stub: true };
        }

        const msg = {
          to: payload.to,
          from: process.env.SENDGRID_FROM_EMAIL || 'notifications@hrplatform.com',
          subject: payload.subject,
          text: payload.text,
          html: payload.html || `<p>${payload.text}</p>`,
        };

        await sgMail.send(msg);
        return { delivered: true };
      }

      if (channel === 'PUSH' || channel === 'SMS') {
        console.log(`[${channel} STUB] Message dispatched for recipient: ${payload.recipientId}`);
        return { delivered: true, stub: true };
      }
    },
    { connection: redisConnection }
  );

  notificationWorker.on('failed', async (job, err) => {
    console.error(`[Notification Queue Error] Job ${job?.id} failed on attempt ${job?.attemptsMade}: ${err.message}`);

    if (job?.attemptsMade >= (job?.opts?.attempts || 3)) {
      console.error(`\n🚨 [CRITICAL ALERT TO ENGINEERING TEAM]`);
      console.error(`Channel [${job.data.channel}] failed repeatedly for recipient: ${job.data.payload.to || job.data.payload.recipientId}`);
      console.error(`Reason: ${err.message}`);
      console.error(`🚨 [END ALERT]\n`);
    }
  });

  notificationQueue.on('error', (err) => {
    console.warn(`[BullMQ Queue Notice] Redis connection error: ${err.message}`);
  });
} catch (err) {
  console.warn(`[Notification Queue] Initialized in fallback mode: ${err.message}`);
}

export { notificationQueue, notificationWorker };