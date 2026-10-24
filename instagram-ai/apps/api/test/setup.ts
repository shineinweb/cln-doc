import { rm } from 'node:fs/promises'
import { beforeEach } from 'vitest'
import { prisma } from '../src/db'
import { loadEnv } from '../src/env'
import { resetRateLimits } from '../src/rate-limit'
import { seedReference } from '../src/seed'

const TABLES = [
  'post_media',
  'messages',
  'conversations',
  'comments',
  'draft_feedback',
  'generation_jobs',
  'posts',
  'media_assets',
  'oauth_credentials',
  'instagram_accounts',
  'automation_rules',
  'saved_responses',
  'webhook_events',
  'metric_snapshots',
  'ai_knowledge',
  'ai_usage',
  'ai_profiles',
  'brand_profiles',
  'content_categories',
  'invitations',
  'memberships',
  'subscription_events',
  'subscriptions',
  'oauth_states',
  'audit_logs',
  'organizations',
  'password_resets',
  'sessions',
  'users',
  'staff_users',
  'seo_sets',
  'seo_redirects',
  'public_pages',
  'site_settings',
  'packages',
]

beforeEach(async () => {
  resetRateLimits()
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0')
  for (const table of TABLES) await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``)
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1')
  await rm('/tmp/instagram-ai-test-media', { recursive: true, force: true })
  await seedReference(prisma, loadEnv())
})
