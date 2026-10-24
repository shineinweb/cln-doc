import { createHmac } from 'node:crypto'
import request, { type Agent } from 'supertest'
import { TINY_PNG } from '../src/providers/media'
import { signStripePayload } from '../src/crypto'
import { createApp } from '../src/app'
import { createDeps, type Deps } from '../src/deps'
import { loadEnv, type Env } from '../src/env'
import { FakeMediaProvider } from '../src/providers/media'
import { FakeMetaClient } from '../src/providers/meta'
import { FakeTextProvider } from '../src/providers/text'
import { sweepDuePosts } from '../src/services/content'

export function testApp() {
  const env = loadEnv()
  const meta = new FakeMetaClient(env.META_APP_SECRET || 'test-meta-secret')
  const text = new FakeTextProvider()
  const media = new FakeMediaProvider()
  const deps = createDeps(env, { meta, text, media, inlineJobs: true })
  return { app: createApp(deps), deps, meta, text, media, env }
}

export type Session = {
  agent: Agent
  csrf: string
  orgId: string
  email: string
  userId: string
  api: ReturnType<typeof bind>
}

let seq = 0

export async function register(app: ReturnType<typeof createApp>, name = 'Ada Co'): Promise<Session> {
  seq += 1
  const email = `user${seq}-${Date.now()}@example.com`
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/register').send({
    email,
    password: 'password123',
    name: 'Ada',
    organizationName: name,
  })
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`)
  const csrf = res.body.csrfToken as string
  const orgId = res.body.organization.id as string
  return { agent, csrf, orgId, email, userId: res.body.user.id as string, api: bind(agent, csrf, orgId) }
}

export function bind(agent: Agent, csrf: string, orgId: string) {
  const headers = { 'x-csrf-token': csrf, 'x-organization-id': orgId }
  return {
    get: (url: string) => agent.get(url).set(headers),
    post: (url: string, body?: unknown) => agent.post(url).set(headers).send(body ?? {}),
    patch: (url: string, body?: unknown) => agent.patch(url).set(headers).send(body ?? {}),
    put: (url: string, body?: unknown) => agent.put(url).set(headers).send(body ?? {}),
    del: (url: string) => agent.delete(url).set(headers),
  }
}

export async function staffLogin(app: ReturnType<typeof createApp>, email = 'staff@example.com', password = 'change-me-now') {
  const agent = request.agent(app)
  const res = await agent.post('/api/admin/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`staff login failed ${res.status} ${JSON.stringify(res.body)}`)
  const csrf = res.body.csrfToken as string
  return { agent, csrf, api: bind(agent, csrf, ''), role: res.body.staff.role as string }
}

export async function upgrade(session: Session, packageId: 'starter' | 'growth' | 'pro') {
  const res = await session.api.post('/api/billing/dev/assign', { packageId })
  if (res.status !== 200) throw new Error(`upgrade failed ${JSON.stringify(res.body)}`)
}

export async function connectInstagram(session: Session, code = 'one') {
  const start = await session.api.get('/api/integrations/instagram/connect')
  if (start.status !== 200) throw new Error(`connect failed ${start.status} ${JSON.stringify(start.body)}`)
  const state = new URL(start.body.authorizeUrl).searchParams.get('state')
  const callback = await session.agent.get('/api/integrations/instagram/callback').query({ code, state })
  return { start, callback, state }
}

export async function createPost(session: Session, extra: Record<string, unknown> = {}) {
  const res = await session.api.post('/api/posts', { format: 'photo', description: 'A cup of coffee on the counter', ...extra })
  if (res.status !== 201) throw new Error(`post failed ${JSON.stringify(res.body)}`)
  return res.body.post as { id: string; caption: string; hashtags: Array<{ tag: string; enabled: boolean }> }
}

export async function uploadPng(session: Session, postId: string) {
  return session.agent
    .post(`/api/posts/${postId}/media`)
    .set('x-csrf-token', session.csrf)
    .set('x-organization-id', session.orgId)
    .attach('file', TINY_PNG, { filename: 'cup.png', contentType: 'image/png' })
}

export function metaSignature(secret: string, raw: string): string {
  return `sha256=${createHmac('sha256', secret).update(Buffer.from(raw)).digest('hex')}`
}

export function stripeSignature(secret: string, raw: string): string {
  return signStripePayload(secret, raw)
}

export async function publishDue(deps: Deps) {
  await sweepDuePosts(deps)
}

export type { Deps, Env }
