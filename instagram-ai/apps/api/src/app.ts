import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { ZodError } from 'zod'
import type { Deps } from './deps'
import { ApiError } from './errors'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { customerRoutes } from './routes/customer'
import { publicRoutes } from './routes/public'
import { webhookRoutes } from './routes/webhooks'

export function createApp(deps: Deps): express.Express {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(cors({
    origin: [deps.env.WEB_ORIGIN, deps.env.ADMIN_ORIGIN],
    credentials: true,
    allowedHeaders: ['content-type', 'x-csrf-token', 'x-organization-id', 'stripe-signature', 'x-hub-signature-256'],
  }))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/webhooks')) {
      express.raw({ type: '*/*', limit: '2mb' })(req, res, next)
      return
    }
    express.json({ limit: '1mb' })(req, res, next)
  })
  app.use((req, res, next) => {
    const started = Date.now()
    res.on('finish', () => {
      if (req.path === '/api/health') return
      deps.logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }, 'request')
    })
    next()
  })
  app.use(publicRoutes(deps))
  app.use(webhookRoutes(deps))
  app.use(authRoutes(deps))
  app.use(customerRoutes(deps))
  app.use(adminRoutes(deps))
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Not found' } })
  })
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: { code: 'validation', message: error.issues[0]?.message ?? 'Invalid input' } })
      return
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } })
      return
    }
    deps.logger.error({ err: error }, 'request failed')
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } })
  })
  return app
}
