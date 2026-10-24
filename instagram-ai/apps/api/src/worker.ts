import { createDeps } from './deps'
import { loadEnv } from './env'
import { logger } from './logger'
import { startWorkers } from './queues'
import { sweepDuePosts } from './services/content'

const env = loadEnv()
const deps = createDeps(env)
await sweepDuePosts(deps)
const stop = await startWorkers(deps)
logger.info('worker listening')

process.on('SIGINT', () => {
  stop().finally(() => process.exit(0))
})
process.on('SIGTERM', () => {
  stop().finally(() => process.exit(0))
})
