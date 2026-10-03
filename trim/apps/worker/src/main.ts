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
  console.log(
    `Trim worker connected. Queue "${INFRASTRUCTURE_QUEUE}" is ready. No business jobs are registered.`,
  );

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    console.log(`Trim worker received ${signal}. Closing the queue connection.`);
    await queue.close();
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
