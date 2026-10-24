import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import type { Deps } from './deps'

export async function pingRedis(url: string): Promise<boolean> {
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 800,
    lazyConnect: true,
    enableOfflineQueue: false,
  })
  try {
    await client.connect()
    return (await client.ping()) === 'PONG'
  } catch {
    return false
  } finally {
    client.disconnect()
  }
}

async function addJob(deps: Deps, queueName: string, name: string, data: object, options: { delay?: number; jobId: string }): Promise<void> {
  const connection = new IORedis(deps.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true })
  try {
    await connection.connect()
    const queue = new Queue(queueName, { connection })
    await queue.add(name, data, { ...options, removeOnComplete: true, removeOnFail: 20 })
    await queue.close()
  } catch (error) {
    deps.logger.warn({ err: error, queueName }, 'queue unavailable')
  } finally {
    connection.disconnect()
  }
}

export async function enqueuePublish(deps: Deps, postId: string, delayMs: number): Promise<void> {
  await addJob(deps, 'publish', 'publish', { postId }, { delay: Math.max(0, delayMs), jobId: `post-${postId}` })
}

export async function enqueueVideo(deps: Deps, jobId: string): Promise<void> {
  await addJob(deps, 'video', 'video', { jobId }, { jobId: `video-${jobId}` })
}

export async function startWorkers(deps: Deps): Promise<() => Promise<void>> {
  const { Worker } = await import('bullmq')
  const { publishPost, sweepDuePosts } = await import('./services/content')
  const { processGenerationJob } = await import('./services/content')
  const connection = new IORedis(deps.env.REDIS_URL, { maxRetriesPerRequest: null })
  const publishWorker = new Worker('publish', async (job) => publishPost(deps, String(job.data.postId)), { connection })
  const videoWorker = new Worker('video', async (job) => {
    await processGenerationJob(deps, String(job.data.jobId))
  }, { connection })
  const timer = setInterval(() => {
    sweepDuePosts(deps).catch((error) => deps.logger.error({ err: error }, 'sweep failed'))
  }, 60_000)
  return async () => {
    clearInterval(timer)
    await publishWorker.close()
    await videoWorker.close()
    await connection.quit()
  }
}
