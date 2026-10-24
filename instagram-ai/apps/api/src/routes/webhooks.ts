import { createHmac } from 'node:crypto'
import { Router } from 'express'
import type { Deps } from '../deps'
import { asyncRoute } from '../http'
import { applyBillingUpdate } from '../services/platform'
import { handleInboundContent } from '../services/inbox'

export function webhookRoutes(deps: Deps): Router {
  const router = Router()

  router.get('/api/webhooks/instagram', asyncRoute(async (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === deps.env.META_VERIFY_TOKEN && typeof challenge === 'string') {
      res.type('text/plain').send(challenge)
      return
    }
    res.status(403).json({ error: { code: 'forbidden', message: 'Verification failed' } })
  }))

  router.post('/api/webhooks/instagram', asyncRoute(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}))
    const signature = req.header('x-hub-signature-256')
    if (!deps.meta.verifyWebhook(raw, signature)) {
      res.status(401).json({ error: { code: 'invalid_signature', message: 'Webhook signature was rejected' } })
      return
    }
    const payload = JSON.parse(raw.toString('utf8')) as {
      entry?: Array<{
        id?: string
        changes?: Array<{ field?: string; value?: Record<string, unknown> }>
        messaging?: Array<{ sender?: { id?: string; username?: string }; message?: { mid?: string; text?: string } }>
      }>
    }
    for (const entry of payload.entry ?? []) {
      const account = entry.id
        ? await deps.prisma.instagramAccount.findFirst({ where: { igUserId: entry.id, status: { in: ['connected', 'expired'] } } })
        : null
      if (!account) continue
      for (const change of entry.changes ?? []) {
        if (change.field !== 'comments' || !change.value) continue
        const value = change.value
        const commentId = String(value.id ?? '')
        if (!commentId) continue
        const from = (value.from ?? {}) as { id?: string; username?: string }
        const media = (value.media ?? {}) as { id?: string }
        await handleInboundContent(deps, {
          organizationId: account.organizationId,
          accountId: account.id,
          igUserId: account.igUserId,
          kind: 'comment',
          externalId: `comment:${commentId}`,
          text: String(value.text ?? ''),
          authorId: from.id || 'unknown',
          authorUsername: from.username,
          igMediaId: media.id,
        })
      }
      for (const message of entry.messaging ?? []) {
        const mid = message.message?.mid || createHmac('sha256', 'message').update(JSON.stringify(message)).digest('hex')
        await handleInboundContent(deps, {
          organizationId: account.organizationId,
          accountId: account.id,
          igUserId: account.igUserId,
          kind: 'message',
          externalId: `message:${mid}`,
          text: String(message.message?.text ?? ''),
          authorId: message.sender?.id || 'unknown',
          authorUsername: message.sender?.username,
        })
      }
    }
    res.json({ ok: true })
  }))

  router.post('/api/webhooks/stripe', asyncRoute(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}))
    const update = deps.payments.handleWebhook(raw, req.header('stripe-signature'))
    if (update) await applyBillingUpdate(deps, update)
    res.json({ ok: true })
  }))

  return router
}
