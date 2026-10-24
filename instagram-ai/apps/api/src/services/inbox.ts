import {
  SYSTEM_PROMPT,
  evaluateMessageSend,
  findForbiddenIntents,
  validateProposal,
  withinBusinessHours,
  type Proposal,
} from '@instagram-ai/shared'
import type { Conversation } from '@prisma/client'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { audit } from '../audit'
import { roleHas } from '@instagram-ai/shared'
import { loadBrand } from './content'
import { assertQuota, requireWritable, type CustomerContext } from './context'
import { usableToken } from './instagram'

const HUMAN = /\b(talk|speak|real|human|person|agent|someone|representative)\b/i
const COMPLAINT = /\b(refund|complaint|terrible|worst|angry|scam)\b/i

export async function decisionFor(
  deps: Deps,
  ctx: CustomerContext,
  conversation: Conversation,
  mode: 'manual' | 'automatic',
  isPrivateReply: boolean,
) {
  const account = await deps.prisma.instagramAccount.findFirst({
    where: { id: conversation.instagramAccountId, organizationId: ctx.organization.id },
  })
  const permission = mode === 'automatic' ? 'messages.automate' : 'messages.reply'
  return evaluateMessageSend({
    mode,
    accountConnected: account?.status === 'connected',
    tokenExpired: Boolean(account?.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now()) || account?.status === 'expired',
    hasPermission: mode === 'automatic' ? ctx.subscription.package.automation : roleHas(ctx.membership.role, permission),
    packageAllowsDm: ctx.subscription.package.dmInbox,
    subscriptionWritable: ctx.subscription.status === 'trialing' || ctx.subscription.status === 'active',
    suspended: ctx.organization.suspended,
    automationFeatureOn: ctx.settings.features.inboxAutomation,
    automationEnabled: conversation.automationEnabled,
    lastUserMessageAt: conversation.lastUserMessageAt,
    privateReplySentAt: conversation.privateReplySentAt,
    recipientRespondedAt: conversation.recipientRespondedAt,
    isPrivateReply,
    now: new Date(),
  })
}

export async function sendConversationMessage(
  deps: Deps,
  ctx: CustomerContext,
  conversationId: string,
  text: string,
  mode: 'manual' | 'automatic',
): Promise<{ allowed: true } | { allowed: false; reason: string; code: string }> {
  if (mode === 'manual') requireWritable(ctx)
  const conversation = await deps.prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: ctx.organization.id },
  })
  if (!conversation) throw new ApiError(404, 'not_found', 'Conversation not found')
  const decision = await decisionFor(deps, ctx, conversation, mode, false)
  if (!decision.allowed) return decision
  const blocked = findForbiddenIntents(text)
  if (blocked.length) {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: mode === 'automatic' ? 'system' : 'user',
      actorId: ctx.user.id,
      action: 'ai.blocked_intent',
      metadata: { intents: blocked, conversationId },
    })
    return { allowed: false, reason: 'That reply is not allowed', code: 'forbidden' }
  }
  const account = await usableToken(deps, ctx.organization.id, conversation.instagramAccountId)
  const sent = await deps.meta.sendMessage(account.token, account.igUserId, conversation.participantId, text)
  await deps.prisma.message.create({
    data: {
      organizationId: ctx.organization.id,
      conversationId: conversation.id,
      direction: 'outbound',
      body: text,
      igMessageId: sent.id,
    },
  })
  await audit(deps.prisma, {
    organizationId: ctx.organization.id,
    actorType: mode === 'automatic' ? 'system' : 'user',
    actorId: ctx.user.id,
    action: 'message.sent',
    targetType: 'conversation',
    targetId: conversation.id,
  })
  return { allowed: true }
}

export async function suggestReply(
  deps: Deps,
  ctx: CustomerContext,
  kind: 'comment_reply' | 'dm_reply',
  untrustedText: string,
): Promise<string> {
  requireWritable(ctx)
  await assertQuota(deps, ctx, 'text')
  const brand = await loadBrand(deps, ctx.organization.id, ctx.organization.name)
  const knowledge = await deps.prisma.aiKnowledge.findMany({ where: { organizationId: ctx.organization.id, approved: true } })
  const blocked = findForbiddenIntents(untrustedText)
  if (blocked.length) {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'ai.blocked_intent',
      metadata: { intents: blocked, source: kind },
    })
  }
  const raw = await deps.text.complete({
    kind,
    system: SYSTEM_PROMPT,
    brand,
    instructions: '',
    approvedKnowledge: knowledge.map((item) => ({ title: item.title, body: item.body })),
    content: { untrustedText },
    model: 'platform-default',
  })
  await deps.prisma.aiUsage.create({ data: { organizationId: ctx.organization.id, kind: 'text', tokens: untrustedText.length } })
  const text = raw && typeof raw === 'object' && 'text' in raw ? String((raw as { text: unknown }).text) : ''
  return findForbiddenIntents(text).length ? 'Thanks for your message.' : text
}

async function ownerId(deps: Deps, organizationId: string): Promise<string | null> {
  const owner = await deps.prisma.membership.findFirst({ where: { organizationId, role: 'OWNER' } })
  return owner?.userId ?? null
}

export async function handleInboundContent(
  deps: Deps,
  input: {
    organizationId: string
    accountId: string
    igUserId: string
    kind: 'comment' | 'message'
    externalId: string
    text: string
    authorId: string
    authorUsername?: string
    igMediaId?: string
  },
): Promise<void> {
  const fresh = await deps.prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'instagram', externalId: input.externalId } },
  })
  if (fresh) return
  try {
    await deps.prisma.webhookEvent.create({
      data: {
        provider: 'instagram',
        externalId: input.externalId,
        organizationId: input.organizationId,
        payload: { kind: input.kind, text: input.text },
      },
    })
  } catch {
    return
  }
  const subscription = await deps.prisma.subscription.findUnique({
    where: { organizationId: input.organizationId },
    include: { package: true },
  })
  const organization = await deps.prisma.organization.findUnique({ where: { id: input.organizationId } })
  if (!subscription || !organization) return
  const settings = await (await import('../settings')).loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
  const ctx: CustomerContext = {
    user: { id: (await ownerId(deps, input.organizationId)) ?? 'system', email: '', name: 'system' },
    organization,
    membership: { id: 'system', role: 'OWNER' },
    subscription,
    settings,
  }
  if (input.kind === 'comment') {
    const comment = await deps.prisma.comment.upsert({
      where: { instagramAccountId_igCommentId: { instagramAccountId: input.accountId, igCommentId: input.externalId.replace(/^comment:/, '') } },
      create: {
        organizationId: input.organizationId,
        instagramAccountId: input.accountId,
        igCommentId: input.externalId.replace(/^comment:/, ''),
        igMediaId: input.igMediaId,
        text: input.text,
        authorId: input.authorId,
        authorUsername: input.authorUsername,
      },
      update: {},
    })
    if (findForbiddenIntents(input.text).length) {
      await audit(deps.prisma, {
        organizationId: input.organizationId,
        actorType: 'system',
        action: 'ai.blocked_intent',
        metadata: { source: 'comment', commentId: comment.id },
      })
    }
    await runCommentAutomation(deps, ctx, comment.id, input.text)
    return
  }
  const conversation = await deps.prisma.conversation.upsert({
    where: {
      organizationId_instagramAccountId_participantId: {
        organizationId: input.organizationId,
        instagramAccountId: input.accountId,
        participantId: input.authorId,
      },
    },
    create: {
      organizationId: input.organizationId,
      instagramAccountId: input.accountId,
      participantId: input.authorId,
      participantUsername: input.authorUsername,
      lastUserMessageAt: new Date(),
    },
    update: {
      lastUserMessageAt: new Date(),
      participantUsername: input.authorUsername,
      recipientRespondedAt: undefined,
    },
  })
  const current = await deps.prisma.conversation.findUnique({ where: { id: conversation.id } })
  if (current?.privateReplySentAt && !current.recipientRespondedAt) {
    await deps.prisma.conversation.update({ where: { id: current.id }, data: { recipientRespondedAt: new Date() } })
  }
  await deps.prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      direction: 'inbound',
      body: input.text,
      igMessageId: input.externalId,
    },
  })
  await runMessageAutomation(deps, ctx, conversation.id, input.text)
}

async function propose(deps: Deps, ctx: CustomerContext, untrustedText: string, hint: string): Promise<Proposal> {
  const brand = await loadBrand(deps, ctx.organization.id, ctx.organization.name)
  const raw = await deps.text.complete({
    kind: 'proposal',
    system: SYSTEM_PROMPT,
    brand,
    instructions: '',
    approvedKnowledge: [],
    content: { untrustedText },
    model: 'platform-default',
    proposalHint: hint,
  })
  if (raw && typeof raw === 'object' && 'type' in raw) return raw as Proposal
  return { type: 'reply_comment', text: hint }
}

async function runCommentAutomation(deps: Deps, ctx: CustomerContext, commentId: string, text: string): Promise<void> {
  if (!ctx.subscription.package.automation || !ctx.settings.features.inboxAutomation) return
  if (ctx.organization.suspended || (ctx.subscription.status !== 'active' && ctx.subscription.status !== 'trialing')) return
  const comment = await deps.prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment || comment.replied) return
  const rules = await deps.prisma.automationRule.findMany({
    where: { organizationId: ctx.organization.id, enabled: true, kind: 'faq_comment' },
  })
  const rule = rules.find((item) => item.matchText && text.toLowerCase().includes(item.matchText.toLowerCase()) && item.approvedAnswer)
  if (!rule?.approvedAnswer) return
  const proposal = await propose(deps, ctx, text, rule.approvedAnswer)
  const decision = validateProposal(proposal)
  if (!decision.ok) {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'system',
      action: 'ai.blocked_intent',
      metadata: { reason: decision.reason, commentId },
    })
    return
  }
  if (decision.action.type !== 'reply_comment') return
  const account = await usableToken(deps, ctx.organization.id, comment.instagramAccountId)
  if (!account.scopes.includes('instagram_business_manage_comments')) return
  await deps.meta.replyToComment(account.token, comment.igCommentId, decision.action.text)
  await deps.prisma.comment.update({
    where: { id: comment.id },
    data: { replied: true, replyText: decision.action.text, repliedAt: new Date() },
  })
  await audit(deps.prisma, {
    organizationId: ctx.organization.id,
    actorType: 'system',
    action: 'comment.replied',
    targetType: 'comment',
    targetId: comment.id,
  })
}

async function runMessageAutomation(deps: Deps, ctx: CustomerContext, conversationId: string, text: string): Promise<void> {
  if (!ctx.subscription.package.automation || !ctx.settings.features.inboxAutomation || !ctx.subscription.package.dmInbox) return
  const conversation = await deps.prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation || !conversation.automationEnabled) return
  const assignee = await ownerId(deps, ctx.organization.id)
  if (HUMAN.test(text)) {
    await deps.prisma.conversation.update({
      where: { id: conversation.id },
      data: { automationEnabled: false, assignedToId: assignee },
    })
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'system',
      action: 'conversation.escalated',
      targetId: conversation.id,
      metadata: { reason: 'human_requested' },
    })
    return
  }
  if (COMPLAINT.test(text)) {
    await deps.prisma.message.create({
      data: {
        organizationId: ctx.organization.id,
        conversationId: conversation.id,
        direction: 'draft',
        body: 'I am sorry this was frustrating. A person on the team will follow up.',
      },
    })
    await deps.prisma.conversation.update({
      where: { id: conversation.id },
      data: { automationEnabled: false, assignedToId: assignee },
    })
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'system',
      action: 'conversation.escalated',
      targetId: conversation.id,
      metadata: { reason: 'complaint' },
    })
    return
  }
  const rules = await deps.prisma.automationRule.findMany({
    where: { organizationId: ctx.organization.id, enabled: true, kind: 'business_hours_dm' },
  })
  const rule = rules[0]
  if (!rule) return
  const config = (rule.config ?? {}) as { start?: string; end?: string; days?: number[]; timeZone?: string }
  const open = withinBusinessHours(new Date(), {
    start: config.start ?? '09:00',
    end: config.end ?? '17:00',
    days: config.days ?? [1, 2, 3, 4, 5],
    timeZone: config.timeZone ?? 'UTC',
  })
  if (!open) {
    await deps.prisma.conversation.update({ where: { id: conversation.id }, data: { assignedToId: assignee } })
    return
  }
  const answer = rule.approvedAnswer || 'Thanks for your message.'
  const proposal = await propose(deps, ctx, text, `dm:${answer}`)
  const decision = validateProposal(proposal)
  if (!decision.ok || decision.action.type !== 'send_dm') {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'system',
      action: 'ai.blocked_intent',
      metadata: { conversationId, reason: decision.ok ? decision.action.type : decision.reason },
    })
    return
  }
  await sendConversationMessage(deps, ctx, conversation.id, decision.action.text, 'automatic')
}
