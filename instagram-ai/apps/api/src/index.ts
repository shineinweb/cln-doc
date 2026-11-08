import { createApp } from './app'
import { createDeps } from './deps'
import { loadEnv } from './env'
import { logger } from './logger'
import { seedReference } from './seed'
import { processGenerationJob } from './services/content'
import { sweepFacePhotos } from './services/faces'
import { seedStarterTemplates } from './services/templates'

const env = loadEnv()
const deps = createDeps(env)
await seedReference(deps.prisma, env)
await deps.prisma.generationJob.updateMany({
  where: { status: 'running' },
  data: { status: 'queued', error: null },
})
const pending = await deps.prisma.generationJob.findMany({ where: { status: 'queued' }, select: { id: true }, take: 20 })
for (const job of pending) {
  void processGenerationJob(deps, job.id).catch((error) => {
    deps.logger.error({ err: error, jobId: job.id }, 'video generation failed')
  })
}
void seedStarterTemplates(deps)
  .then((result) => logger.info(result, 'starter templates ready'))
  .catch((error) => logger.error({ err: error }, 'starter templates failed'))
const faceSweep = () => sweepFacePhotos(deps).catch((error) => logger.error({ err: error }, 'face photo sweep failed'))
void faceSweep()
setInterval(() => void faceSweep(), 60 * 60 * 1000).unref()
const app = createApp(deps)
app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'api listening')
})

