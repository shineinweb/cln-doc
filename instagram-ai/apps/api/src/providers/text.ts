import { SYSTEM_PROMPT, findForbiddenIntents, normalizeHashtags, normalizeKeywords } from '@instagram-ai/shared'
import type { Env } from '../env'

export type BrandContext = {
  brandName: string
  businessDescription: string
  targetAudience: string
  voiceAndTone: string
  productsAndServices: string
  approvedFacts: string[]
  topicsToAvoid: string
  preferredLanguage: string
}

export type TextRequest = {
  kind: 'post_copy' | 'carousel_outline' | 'reel_script' | 'calendar_ideas' | 'comment_reply' | 'dm_reply' | 'proposal'
  system: string
  brand: BrandContext
  instructions: string
  approvedKnowledge: Array<{ title: string; body: string }>
  content: {
    category?: string
    styleNotes?: string
    description?: string
    mediaDescription?: string
    untrustedText?: string
  }
  model: string
  apiKey?: string
  proposalHint?: string
}

export interface TextProvider {
  complete(request: TextRequest): Promise<unknown>
}

export class FakeTextProvider implements TextProvider {
  calls: TextRequest[] = []
  scripted: unknown[] = []

  async complete(request: TextRequest): Promise<unknown> {
    this.calls.push(request)
    if (this.scripted.length) return this.scripted.shift()
    return deterministicCopy(request)
  }
}

export function deterministicCopy(request: TextRequest): unknown {
  if (request.kind === 'proposal') {
    const hint = request.proposalHint || 'Thanks for your message.'
    const intents = findForbiddenIntents(`${request.instructions}\n${request.content.untrustedText ?? ''}`)
    if (intents.includes('follow')) return { type: 'reply_comment', text: hint }
    return { type: request.proposalHint?.startsWith('dm:') ? 'send_dm' : 'reply_comment', text: hint.replace(/^dm:/, '') }
  }
  if (request.kind === 'comment_reply' || request.kind === 'dm_reply') {
    const question = (request.content.untrustedText ?? '').toLowerCase()
    const fact = request.brand.approvedFacts.find((item) => item.trim())
    if (fact && /close|hours|open|when/.test(question)) return { text: fact }
    return { text: 'Thanks for writing. A teammate can confirm anything that is not in our approved facts.' }
  }
  const description = request.content.description || request.content.mediaDescription || 'a new post'
  const category = request.content.category || 'post'
  const words = description.split(/\s+/).filter((word) => word.length > 3).slice(0, 4)
  return {
    caption: `${request.brand.brandName ? `${request.brand.brandName}: ` : ''}${description}`.trim(),
    keywords: normalizeKeywords([category, request.brand.targetAudience, ...words].filter(Boolean) as string[]),
    hashtags: normalizeHashtags([category, ...(request.brand.targetAudience || '').split(/\s+/), ...words]).map((chip) => chip.tag),
    creativeBrief: [request.content.styleNotes, description, request.brand.voiceAndTone].filter(Boolean).join(' '),
    callToAction: 'See the details on the profile',
    alternativeCaptions: [`Another way to say it: ${description}`],
    factualClaims: [] as Array<{ claim: string }>,
    carouselOutline: ['Opening', 'Detail', 'Close'],
    reelScript: `Open on the subject. ${description}`,
    calendarIdeas: [{ day: 'Monday', idea: description }],
  }
}

export class OpenAiTextProvider implements TextProvider {
  constructor(private platformKey: string, private fetchImpl: typeof fetch = fetch) {}

  async complete(request: TextRequest): Promise<unknown> {
    const key = request.apiKey || this.platformKey
    const response = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model === 'platform-default' ? 'gpt-4o-mini' : request.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: request.system || SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ brand: request.brand, instructions: request.instructions, knowledge: request.approvedKnowledge, content: request.content, kind: request.kind }) },
        ],
      }),
    })
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || 'Text provider failed')
    return JSON.parse(payload.choices?.[0]?.message?.content || '{}')
  }
}

export function createTextProvider(env: Env): TextProvider {
  if (env.TEXT_PROVIDER_KEY) return new OpenAiTextProvider(env.TEXT_PROVIDER_KEY)
  return new FakeTextProvider()
}
