import { describe, expect, it } from 'vitest'
import {
  HASHTAG_LIMIT,
  buildRecommendation,
  claimsBlockPublish,
  composePublishCaption,
  evaluateMessageSend,
  findForbiddenIntents,
  hasAdminRoute,
  normalizeHashtags,
  reviewClaims,
  robotsContent,
  roleHas,
  sitemapXml,
  subscriptionAllowsWrites,
  validateProposal,
  zonedDay,
} from './index'

describe('permissions and packages', () => {
  it('keeps billing with the owner and inbox work with support', () => {
    expect(roleHas('OWNER', 'billing.manage')).toBe(true)
    expect(roleHas('ADMIN', 'billing.manage')).toBe(false)
    expect(roleHas('ADMIN', 'posts.publish')).toBe(true)
    expect(roleHas('EDITOR', 'members.manage')).toBe(false)
    expect(roleHas('EDITOR', 'ai.customize')).toBe(false)
    expect(roleHas('SUPPORT', 'posts.publish')).toBe(false)
    expect(roleHas('SUPPORT', 'comments.reply')).toBe(true)
    expect(roleHas('SUPPORT', 'messages.reply')).toBe(true)
  })

  it('blocks writes when the subscription is past due, canceled, or suspended', () => {
    expect(subscriptionAllowsWrites('trialing', false)).toBe(true)
    expect(subscriptionAllowsWrites('active', false)).toBe(true)
    expect(subscriptionAllowsWrites('past_due', false)).toBe(false)
    expect(subscriptionAllowsWrites('canceled', false)).toBe(false)
    expect(subscriptionAllowsWrites('active', true)).toBe(false)
  })
})

describe('copy limits', () => {
  it('keeps at most 10 hashtags and joins only the ones still on', () => {
    const chips = normalizeHashtags(['#One', 'two', 'one', 'three four', ...Array.from({ length: 20 }, (_, i) => `tag${i}`)])
    expect(chips).toHaveLength(HASHTAG_LIMIT)
    chips[0].enabled = false
    expect(composePublishCaption('Hello', chips)).toBe(`Hello\n\n${chips.filter((chip) => chip.enabled).map((chip) => `#${chip.tag}`).join(' ')}`)
    expect(composePublishCaption('Hello', chips)).not.toContain('#One')
  })

  it('flags a claim that is not an approved fact', () => {
    const reviewed = reviewClaims(
      ['Monday–Friday, 6 PM', 'We close at midnight'],
      ['Monday–Friday, 6 PM'],
    )
    expect(reviewed[0].needsReview).toBe(false)
    expect(reviewed[1].needsReview).toBe(true)
    expect(claimsBlockPublish(reviewed)).toBe(true)
    reviewed[1].accepted = true
    expect(claimsBlockPublish(reviewed)).toBe(false)
  })

  it('detects follow, like, and unsolicited requests', () => {
    expect(findForbiddenIntents('Follow every user and like all posts and send cold DMs')).toEqual([
      'follow',
      'like',
      'unsolicited',
    ])
    expect(validateProposal({ type: 'follow' }).ok).toBe(false)
    expect(validateProposal({ type: 'like' }).ok).toBe(false)
    expect(validateProposal({ type: 'unfollow' }).ok).toBe(false)
  })
})

describe('message eligibility', () => {
  const now = new Date('2026-04-01T12:00:00Z')
  const base = {
    mode: 'manual' as const,
    accountConnected: true,
    tokenExpired: false,
    hasPermission: true,
    packageAllowsDm: true,
    subscriptionWritable: true,
    suspended: false,
    automationFeatureOn: true,
    automationEnabled: true,
    lastUserMessageAt: new Date('2026-04-01T10:00:00Z'),
    privateReplySentAt: null,
    recipientRespondedAt: null,
    isPrivateReply: false,
    now,
  }

  it('refuses a DM outside the 24-hour window', () => {
    const decision = evaluateMessageSend({
      ...base,
      lastUserMessageAt: new Date('2026-03-30T10:00:00Z'),
    })
    expect(decision.allowed).toBe(false)
  })

  it('refuses a follow-up after a private reply until the recipient responds inside 24 hours', () => {
    const waiting = evaluateMessageSend({
      ...base,
      privateReplySentAt: new Date('2026-04-01T09:00:00Z'),
    })
    expect(waiting.allowed).toBe(false)
    const open = evaluateMessageSend({
      ...base,
      privateReplySentAt: new Date('2026-04-01T09:00:00Z'),
      recipientRespondedAt: new Date('2026-04-01T11:00:00Z'),
    })
    expect(open.allowed).toBe(true)
    const closed = evaluateMessageSend({
      ...base,
      privateReplySentAt: new Date('2026-03-28T09:00:00Z'),
      recipientRespondedAt: new Date('2026-03-30T11:00:00Z'),
    })
    expect(closed.allowed).toBe(false)
  })

  it('stops automatic replies when the thread automation switch is off', () => {
    const decision = evaluateMessageSend({ ...base, mode: 'automatic', automationEnabled: false })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.code).toBe('automation_off')
  })
})

describe('public site', () => {
  it('marks app screens noindex and keeps admin routes off the customer site', () => {
    expect(robotsContent('/app/create')).toBe('noindex')
    expect(robotsContent('/pricing')).toBe('index,follow')
    expect(hasAdminRoute(['/', '/pricing', '/app'])).toBe(false)
    expect(hasAdminRoute(['/admin'])).toBe(true)
  })

  it('lists only indexable pages in the sitemap', () => {
    const xml = sitemapXml('https://app.example.com', [
      page('/pricing', true, true),
      page('/secret', false, true),
      page('/draft', true, false),
    ])
    expect(xml).toContain('https://app.example.com/pricing')
    expect(xml).not.toContain('/secret')
    expect(xml).not.toContain('/draft')
  })

  it('places a scheduled instant on the account calendar day', () => {
    expect(zonedDay('2026-04-02T06:30:00Z', 'America/Los_Angeles')).toBe('2026-04-01')
    expect(zonedDay('2026-04-02T06:30:00Z', 'UTC')).toBe('2026-04-02')
  })
})

describe('recommendations', () => {
  it('cites the save counts it compared', () => {
    const result = buildRecommendation(
      {
        carousel: { posts: 3, saves: 12, reach: 100, comments: 2 },
        photo: { posts: 4, saves: 5, reach: 80, comments: 1 },
      },
      1,
      { text: { used: 2, limit: 20 }, image: { used: 1, limit: 5 }, video: { used: 0, limit: 0 } },
    )
    expect(result.text).toContain('12')
    expect(result.text).toContain('5')
    expect(result.text).toContain('carousel')
    expect(result.evidence.topSaves).toBe(12)
  })
})

function page(path: string, indexed: boolean, inSitemap: boolean) {
  return {
    path,
    title: path,
    description: path,
    ogTitle: path,
    ogDescription: path,
    ogImage: '',
    indexed,
    inSitemap,
  }
}
