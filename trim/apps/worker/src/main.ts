import { PrismaClient } from '@trim/database';
import { deliverPendingOutbox } from '@trim/metrc-sandbox';
import { Queue } from 'bullmq';
import { config } from 'dotenv';
import IORedis from 'ioredis';
import { resolve } from 'node:path';
import { INFRASTRUCTURE_QUEUE } from './queues';

config({ path: resolve(__dirname, '../../../.env') });

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(INFRASTRUCTURE_QUEUE, { connection });
  await queue.waitUntilReady();
  const prisma = new PrismaClient();
  const deliver = async (): Promise<void> => {
    const count = await deliverPendingOutbox(prisma);
    if (count > 0) {
      console.log(`Delivered ${count} Metrc sandbox outbox row${count === 1 ? '' : 's'}.`);
    }
  };
  await deliver();
  const timer = setInterval(() => {
    void deliver().catch((error: unknown) => {
      console.error(error);
    });
  }, 1000);
  console.log(
    `Trim worker connected. Queue "${INFRASTRUCTURE_QUEUE}" is ready. Pending Metrc outbox rows are delivered to the sandbox.`,
  );

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    console.log(`Trim worker received ${signal}. Closing the queue connection.`);
    clearInterval(timer);
    await queue.close();
    await prisma.$disconnect();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await new Promise(() => undefined);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
