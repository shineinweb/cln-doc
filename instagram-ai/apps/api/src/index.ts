import { createApp } from './app'
import { createDeps } from './deps'
import { loadEnv } from './env'
import { logger } from './logger'
import { seedReference } from './seed'

const env = loadEnv()
const deps = createDeps(env)
await seedReference(deps.prisma, env)
const app = createApp(deps)
app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'api listening')
})
