import { IG_SCOPES } from '@instagram-ai/shared'
import type { Env } from '../env'
import { verifyMetaSignature } from '../crypto'

export type IgProfile = {
  igUserId: string
  username: string
  accountType: string
  scopes: string
}

export type TokenResult = {
  accessToken: string
  expiresInSec: number
  profile: IgProfile
}

export type ContainerInput = {
  igUserId: string
  accessToken: string
  format: 'photo' | 'carousel' | 'reel'
  caption: string
  mediaUrls: string[]
}

export type InsightMedia = {
  id: string
  format: string
  likes: number
  comments: number
  saves: number
  reach: number
}

export type InsightResult = {
  followersAvailable: boolean
  followers: Array<{ date: string; value: number }>
  media: InsightMedia[]
}

export type MetaCall = { method: string; [key: string]: unknown }

export interface MetaClient {
  buildAuthorizeUrl(state: string): string
  exchangeCode(code: string): Promise<TokenResult>
  refreshToken(accessToken: string): Promise<{ accessToken: string; expiresInSec: number }>
  getProfile(accessToken: string): Promise<IgProfile>
  createMediaContainer(input: ContainerInput): Promise<string>
  getContainerStatus(accessToken: string, containerId: string): Promise<'IN_PROGRESS' | 'FINISHED' | 'ERROR'>
  publishContainer(accessToken: string, igUserId: string, containerId: string): Promise<string>
  findMediaByContainer(accessToken: string, containerId: string): Promise<string | null>
  replyToComment(accessToken: string, commentId: string, message: string): Promise<{ id: string }>
  hideComment(accessToken: string, commentId: string, hide: boolean): Promise<void>
  deleteComment(accessToken: string, commentId: string): Promise<void>
  sendMessage(accessToken: string, igUserId: string, recipientId: string, text: string): Promise<{ id: string }>
  sendPrivateReply(accessToken: string, igUserId: string, commentId: string, text: string): Promise<{ id: string }>
  getInsights(accessToken: string, igUserId: string): Promise<InsightResult>
  verifyWebhook(raw: Buffer, header: string | undefined): boolean
}

const GRAPH = 'https://graph.instagram.com/v21.0'

export class FakeMetaClient implements MetaClient {
  calls: MetaCall[] = []
  refreshFails = false
  insights: InsightResult = {
    followersAvailable: true,
    followers: [
      { date: '2026-03-01', value: 100 },
      { date: '2026-04-01', value: 120 },
    ],
    media: [
      { id: 'm1', format: 'carousel', likes: 10, comments: 2, saves: 12, reach: 200 },
      { id: 'm2', format: 'photo', likes: 4, comments: 1, saves: 5, reach: 90 },
    ],
  }
  private containers = new Map<string, { caption: string; urls: string[] }>()
  private published = new Map<string, string>()
  private seq = 1

  constructor(private secret: string) {}

  buildAuthorizeUrl(state: string): string {
    const url = new URL('https://instagram.example/oauth')
    url.searchParams.set('state', state)
    url.searchParams.set('scope', IG_SCOPES.join(','))
    return url.toString()
  }

  async exchangeCode(code: string): Promise<TokenResult> {
    this.calls.push({ method: 'exchangeCode', code })
    return {
      accessToken: `fake-token-${code}`,
      expiresInSec: 60 * 24 * 60 * 60,
      profile: {
        igUserId: `ig_${code}`,
        username: `tester_${code}`,
        accountType: 'BUSINESS',
        scopes: IG_SCOPES.join(','),
      },
    }
  }

  async refreshToken(accessToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
    this.calls.push({ method: 'refreshToken' })
    if (this.refreshFails) throw new Error('refresh failed')
    return { accessToken: `${accessToken}-refreshed`, expiresInSec: 60 * 24 * 60 * 60 }
  }

  async getProfile(_accessToken: string): Promise<IgProfile> {
    this.calls.push({ method: 'getProfile' })
    return {
      igUserId: 'ig_profile',
      username: 'profile',
      accountType: 'BUSINESS',
      scopes: IG_SCOPES.join(','),
    }
  }

  async createMediaContainer(input: ContainerInput): Promise<string> {
    const id = `container_${this.seq++}`
    this.containers.set(id, { caption: input.caption, urls: input.mediaUrls })
    this.calls.push({ method: 'createMediaContainer', caption: input.caption, urls: input.mediaUrls, format: input.format })
    return id
  }

  async getContainerStatus(): Promise<'FINISHED'> {
    return 'FINISHED'
  }

  async publishContainer(_accessToken: string, _igUserId: string, containerId: string): Promise<string> {
    const existing = this.published.get(containerId)
    if (existing) return existing
    const id = `media_${this.seq++}`
    this.published.set(containerId, id)
    const container = this.containers.get(containerId)
    this.calls.push({ method: 'publishContainer', containerId, caption: container?.caption, mediaId: id })
    return id
  }

  async findMediaByContainer(_accessToken: string, containerId: string): Promise<string | null> {
    return this.published.get(containerId) ?? null
  }

  async replyToComment(_accessToken: string, commentId: string, message: string): Promise<{ id: string }> {
    const id = `reply_${this.seq++}`
    this.calls.push({ method: 'replyToComment', commentId, message, id })
    return { id }
  }

  async hideComment(_accessToken: string, commentId: string, hide: boolean): Promise<void> {
    this.calls.push({ method: 'hideComment', commentId, hide })
  }

  async deleteComment(_accessToken: string, commentId: string): Promise<void> {
    this.calls.push({ method: 'deleteComment', commentId })
  }

  async sendMessage(_accessToken: string, _igUserId: string, recipientId: string, text: string): Promise<{ id: string }> {
    const id = `dm_${this.seq++}`
    this.calls.push({ method: 'sendMessage', recipientId, text, id })
    return { id }
  }

  async sendPrivateReply(_accessToken: string, _igUserId: string, commentId: string, text: string): Promise<{ id: string }> {
    const id = `pr_${this.seq++}`
    this.calls.push({ method: 'sendPrivateReply', commentId, text, id })
    return { id }
  }

  async getInsights(): Promise<InsightResult> {
    this.calls.push({ method: 'getInsights' })
    return this.insights
  }

  verifyWebhook(raw: Buffer, header: string | undefined): boolean {
    return verifyMetaSignature(this.secret, raw, header)
  }
}

type FetchImpl = typeof fetch

export class RealMetaClient implements MetaClient {
  constructor(
    private env: Env,
    private fetchImpl: FetchImpl = fetch,
  ) {}

  buildAuthorizeUrl(state: string): string {
    const url = new URL('https://www.instagram.com/oauth/authorize')
    url.searchParams.set('client_id', this.env.META_APP_ID)
    url.searchParams.set('redirect_uri', this.env.META_REDIRECT_URI)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', IG_SCOPES.join(','))
    url.searchParams.set('state', state)
    return url.toString()
  }

  async exchangeCode(code: string): Promise<TokenResult> {
    const body = new URLSearchParams({
      client_id: this.env.META_APP_ID,
      client_secret: this.env.META_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: this.env.META_REDIRECT_URI,
      code,
    })
    const short = await this.json<{ access_token: string }>('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const long = await this.json<{ access_token: string; expires_in?: number }>(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: this.env.META_APP_SECRET,
        access_token: short.access_token,
      })}`,
    )
    const profile = await this.getProfile(long.access_token)
    return { accessToken: long.access_token, expiresInSec: long.expires_in ?? 60 * 24 * 60 * 60, profile }
  }

  async refreshToken(accessToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
    const data = await this.json<{ access_token: string; expires_in: number }>(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
        grant_type: 'ig_refresh_token',
        access_token: accessToken,
      })}`,
    )
    return { accessToken: data.access_token, expiresInSec: data.expires_in }
  }

  async getProfile(accessToken: string): Promise<IgProfile> {
    const data = await this.json<{ user_id?: string; id?: string; username?: string; account_type?: string }>(
      `${GRAPH}/me?${new URLSearchParams({ fields: 'user_id,username,account_type', access_token: accessToken })}`,
    )
    return {
      igUserId: data.user_id || data.id || '',
      username: data.username || '',
      accountType: data.account_type || 'BUSINESS',
      scopes: IG_SCOPES.join(','),
    }
  }

  async createMediaContainer(input: ContainerInput): Promise<string> {
    if (input.format === 'carousel') {
      const children: string[] = []
      for (const url of input.mediaUrls) {
        const child = await this.form<{ id: string }>(`${GRAPH}/${input.igUserId}/media`, {
          image_url: url,
          is_carousel_item: 'true',
          access_token: input.accessToken,
        })
        children.push(child.id)
      }
      const parent = await this.form<{ id: string }>(`${GRAPH}/${input.igUserId}/media`, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: input.caption,
        access_token: input.accessToken,
      })
      return parent.id
    }
    const fields: Record<string, string> =
      input.format === 'reel'
        ? { media_type: 'REELS', video_url: input.mediaUrls[0] ?? '', caption: input.caption, access_token: input.accessToken }
        : { image_url: input.mediaUrls[0] ?? '', caption: input.caption, access_token: input.accessToken }
    const created = await this.form<{ id: string }>(`${GRAPH}/${input.igUserId}/media`, fields)
    return created.id
  }

  async getContainerStatus(accessToken: string, containerId: string): Promise<'IN_PROGRESS' | 'FINISHED' | 'ERROR'> {
    const data = await this.json<{ status_code?: string }>(
      `${GRAPH}/${containerId}?${new URLSearchParams({ fields: 'status_code', access_token: accessToken })}`,
    )
    if (data.status_code === 'FINISHED' || data.status_code === 'IN_PROGRESS' || data.status_code === 'ERROR') {
      return data.status_code
    }
    return 'ERROR'
  }

  async publishContainer(accessToken: string, igUserId: string, containerId: string): Promise<string> {
    const data = await this.form<{ id: string }>(`${GRAPH}/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    })
    return data.id
  }

  async findMediaByContainer(accessToken: string, containerId: string): Promise<string | null> {
    const data = await this.json<{ id?: string; status_code?: string; published_id?: string }>(
      `${GRAPH}/${containerId}?${new URLSearchParams({ fields: 'id,status_code', access_token: accessToken })}`,
    )
    return data.published_id ?? null
  }

  async replyToComment(accessToken: string, commentId: string, message: string): Promise<{ id: string }> {
    return this.form(`${GRAPH}/${commentId}/replies`, { message, access_token: accessToken })
  }

  async hideComment(accessToken: string, commentId: string, hide: boolean): Promise<void> {
    await this.form(`${GRAPH}/${commentId}`, { hide: hide ? 'true' : 'false', access_token: accessToken })
  }

  async deleteComment(accessToken: string, commentId: string): Promise<void> {
    await this.json(`${GRAPH}/${commentId}?${new URLSearchParams({ access_token: accessToken })}`, { method: 'DELETE' })
  }

  async sendMessage(accessToken: string, igUserId: string, recipientId: string, text: string): Promise<{ id: string }> {
    return this.json(`${GRAPH}/${igUserId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    })
  }

  async sendPrivateReply(accessToken: string, igUserId: string, commentId: string, text: string): Promise<{ id: string }> {
    return this.json(`${GRAPH}/${igUserId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    })
  }

  async getInsights(accessToken: string, igUserId: string): Promise<InsightResult> {
    try {
      const followers = await this.json<{ data?: Array<{ values?: Array<{ value: number; end_time: string }> }> }>(
        `${GRAPH}/${igUserId}/insights?${new URLSearchParams({
          metric: 'follower_count',
          period: 'day',
          access_token: accessToken,
        })}`,
      )
      const media = await this.json<{ data?: Array<{ id: string; media_type?: string; like_count?: number; comments_count?: number }> }>(
        `${GRAPH}/${igUserId}/media?${new URLSearchParams({
          fields: 'id,media_type,like_count,comments_count',
          access_token: accessToken,
        })}`,
      )
      return {
        followersAvailable: true,
        followers: (followers.data?.[0]?.values ?? []).map((value) => ({ date: value.end_time, value: value.value })),
        media: (media.data ?? []).map((item) => ({
          id: item.id,
          format: (item.media_type ?? 'IMAGE').toLowerCase(),
          likes: item.like_count ?? 0,
          comments: item.comments_count ?? 0,
          saves: 0,
          reach: 0,
        })),
      }
    } catch {
      return { followersAvailable: false, followers: [], media: [] }
    }
  }

  verifyWebhook(raw: Buffer, header: string | undefined): boolean {
    return verifyMetaSignature(this.env.META_APP_SECRET, raw, header)
  }

  private async form<T>(url: string, fields: Record<string, string>): Promise<T> {
    return this.json<T>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
    })
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(url, init)
    const data = (await response.json()) as T & { error?: { message?: string } }
    if (!response.ok) {
      throw new Error(data.error?.message || `Instagram request failed (${response.status})`)
    }
    return data
  }
}

export function createMetaClient(env: Env): MetaClient {
  if (!env.META_APP_ID) return new FakeMetaClient(env.META_APP_SECRET || 'dev-meta-secret')
  return new RealMetaClient(env)
}
