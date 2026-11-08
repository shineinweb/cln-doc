import { IG_SCOPES, type SocialNetwork } from '@instagram-ai/shared'
import type { MetaClient } from './meta'

const GRAPH = 'https://graph.facebook.com/v21.0'
const IG_GRAPH = 'https://graph.instagram.com/v21.0'

export type OauthApp = { clientId: string; clientSecret: string }

export type ConnectedProfile = {
  externalId: string
  displayName: string
  username: string
  accessToken: string
  refreshToken: string | null
  expiresInSec: number
  scopes: string
  accountType?: string
}

export type PublishInput = {
  network: SocialNetwork
  format: string
  caption: string
  mediaUrls: string[]
  accessToken: string
  externalId: string
  containerId?: string | null
}

export type PublishResult = { remoteId: string; pending?: boolean; containerId?: string }

export type FirstCommentInput = {
  network: 'instagram' | 'facebook'
  accessToken: string
  remoteId: string
  externalId: string
  text: string
}

export type NetworkCall = { method: string; network?: string; [key: string]: unknown }

export interface NetworkGateway {
  calls: NetworkCall[]
  buildAuthorizeUrl(input: { network: SocialNetwork; app: OauthApp; redirectUri: string; state: string }): string
  exchangeCode(input: { network: SocialNetwork; app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile>
  publish(input: PublishInput): Promise<PublishResult>
  firstComment(input: FirstCommentInput): Promise<{ id: string }>
}

export class FakeNetworkGateway implements NetworkGateway {
  calls: NetworkCall[] = []
  private seq = 1

  buildAuthorizeUrl(input: { network: SocialNetwork; app: OauthApp; redirectUri: string; state: string }): string {
    this.calls.push({ method: 'authorize', network: input.network, state: input.state })
    const url = officialAuthorizeUrl(input.network, input.app.clientId, input.redirectUri, input.state)
    return url
  }

  async exchangeCode(input: { network: SocialNetwork; app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile> {
    this.calls.push({ method: 'exchange', network: input.network, code: input.code })
    return {
      externalId: `${input.network}_${input.code}`,
      displayName: `${input.network} ${input.code}`,
      username: input.code,
      accessToken: `token-${input.network}-${input.code}`,
      refreshToken: null,
      expiresInSec: 60 * 24 * 60 * 60,
      scopes: 'publish',
      accountType: 'BUSINESS',
    }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const remoteId = `${input.network}_${this.seq++}`
    this.calls.push({
      method: 'publish',
      network: input.network,
      format: input.format,
      externalId: input.externalId,
      caption: input.caption,
      remoteId,
    })
    return { remoteId }
  }

  async firstComment(input: FirstCommentInput): Promise<{ id: string }> {
    const id = `comment_${this.seq++}`
    this.calls.push({ method: 'firstComment', network: input.network, remoteId: input.remoteId, text: input.text, id })
    return { id }
  }
}

export class RealNetworkGateway implements NetworkGateway {
  calls: NetworkCall[] = []

  constructor(
    private meta: MetaClient,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  buildAuthorizeUrl(input: { network: SocialNetwork; app: OauthApp; redirectUri: string; state: string }): string {
    return officialAuthorizeUrl(input.network, input.app.clientId, input.redirectUri, input.state)
  }

  async exchangeCode(input: { network: SocialNetwork; app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile> {
    if (input.network === 'instagram') return this.exchangeInstagram(input)
    if (input.network === 'facebook') return this.exchangeFacebook(input)
    if (input.network === 'tiktok') return this.exchangeTikTok(input)
    return this.exchangeYouTube(input)
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (input.network === 'instagram') return this.publishInstagram(input)
    if (input.network === 'facebook') return this.publishFacebook(input)
    if (input.network === 'tiktok') return this.publishTikTok(input)
    return this.publishYouTube(input)
  }

  async firstComment(input: FirstCommentInput): Promise<{ id: string }> {
    if (input.network === 'instagram') {
      const sent = await this.meta.commentOnMedia(input.accessToken, input.remoteId, input.text)
      return sent
    }
    const sent = await this.json<{ id: string }>(`${GRAPH}/${input.remoteId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message: input.text, access_token: input.accessToken }),
    })
    return { id: sent.id }
  }

  private async publishInstagram(input: PublishInput): Promise<PublishResult> {
    let containerId = input.containerId ?? null
    if (!containerId) {
      const format = input.format === 'reel' || input.format === 'video' || input.format === 'carousel' || input.format === 'story'
        ? input.format
        : 'photo'
      containerId = await this.meta.createMediaContainer({
        igUserId: input.externalId,
        accessToken: input.accessToken,
        format,
        caption: input.caption,
        mediaUrls: input.mediaUrls,
      })
    }
    const status = await this.meta.getContainerStatus(input.accessToken, containerId)
    if (status === 'IN_PROGRESS') return { remoteId: '', pending: true, containerId }
    if (status === 'ERROR') throw new Error('Instagram could not process the media')
    const existing = await this.meta.findMediaByContainer(input.accessToken, containerId)
    const remoteId = existing ?? await this.meta.publishContainer(input.accessToken, input.externalId, containerId)
    return { remoteId, containerId }
  }

  private async publishFacebook(input: PublishInput): Promise<PublishResult> {
    if (input.format === 'story') return this.publishFacebookStory(input)
    if (input.format === 'video' || input.format === 'reel') {
      const sent = await this.json<{ id: string }>(`${GRAPH}/${input.externalId}/videos`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          file_url: input.mediaUrls[0] ?? '',
          description: input.caption,
          access_token: input.accessToken,
        }),
      })
      return { remoteId: sent.id }
    }
    const sent = await this.json<{ id: string }>(`${GRAPH}/${input.externalId}/feed`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        message: input.caption,
        link: input.mediaUrls[0] ?? '',
        access_token: input.accessToken,
      }),
    })
    return { remoteId: sent.id }
  }

  private async publishFacebookStory(input: PublishInput): Promise<PublishResult> {
    const url = input.mediaUrls[0] ?? ''
    const video = /\.(mp4|mov)(\?|$)/i.test(url)
    if (!video) {
      const photo = await this.json<{ id: string }>(`${GRAPH}/${input.externalId}/photos`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url, published: 'false', access_token: input.accessToken }),
      })
      const story = await this.json<{ post_id?: string; id?: string }>(`${GRAPH}/${input.externalId}/photo_stories`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ photo_id: photo.id, access_token: input.accessToken }),
      })
      const remoteId = story.post_id || story.id
      if (!remoteId) throw new Error('Facebook did not publish the story')
      return { remoteId }
    }
    const started = await this.json<{ video_id?: string; upload_url?: string }>(`${GRAPH}/${input.externalId}/video_stories`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ upload_phase: 'start', access_token: input.accessToken }),
    })
    if (!started.video_id || !started.upload_url) throw new Error('Facebook did not start the story upload')
    const media = await this.fetchImpl(url)
    if (!media.ok) throw new Error('The story video could not be read')
    const bytes = Buffer.from(await media.arrayBuffer())
    const uploaded = await this.fetchImpl(started.upload_url, {
      method: 'POST',
      headers: {
        authorization: `OAuth ${input.accessToken}`,
        offset: '0',
        file_size: String(bytes.length),
      },
      body: bytes,
    })
    if (!uploaded.ok) throw new Error('Facebook did not accept the story video')
    const finished = await this.json<{ post_id?: string }>(`${GRAPH}/${input.externalId}/video_stories`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        upload_phase: 'finish',
        video_id: started.video_id,
        access_token: input.accessToken,
      }),
    })
    if (!finished.post_id) throw new Error('Facebook did not publish the story')
    return { remoteId: finished.post_id }
  }

  private async publishTikTok(input: PublishInput): Promise<PublishResult> {
    if (input.format === 'story') throw new Error('TikTok cannot publish a story')
    const sent = await this.json<{ data?: { publish_id?: string }; error?: { code?: string; message?: string } }>(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: input.caption.slice(0, 2200),
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: input.mediaUrls[0] ?? '',
          },
        }),
      },
    )
    if (!sent.data?.publish_id || (sent.error?.code && sent.error.code !== 'ok')) {
      throw new Error(sent.error?.message || 'TikTok did not accept the video')
    }
    return { remoteId: sent.data.publish_id }
  }

  private async publishYouTube(input: PublishInput): Promise<PublishResult> {
    if (input.format === 'story') throw new Error('YouTube cannot publish a story')
    const media = await this.fetchImpl(input.mediaUrls[0] ?? '')
    if (!media.ok) throw new Error('The video file could not be read for YouTube')
    const bytes = Buffer.from(await media.arrayBuffer())
    if (!bytes.length) throw new Error('The video file could not be read for YouTube')
    const title = input.caption.replace(/\s+/g, ' ').trim().slice(0, 100) || 'Untitled'
    const started = await this.fetchImpl(
      'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': 'video/mp4',
          'x-upload-content-length': String(bytes.length),
        },
        body: JSON.stringify({
          snippet: { title, description: input.caption.slice(0, 5000) },
          status: { privacyStatus: 'public' },
        }),
      },
    )
    if (!started.ok) throw new Error('YouTube did not start the upload')
    const location = started.headers.get('location')
    if (!location) throw new Error('YouTube did not start the upload')
    const uploaded = await this.fetchImpl(location, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) },
      body: bytes,
    })
    const body = await uploaded.json() as { id?: string; error?: { message?: string } }
    if (!uploaded.ok || !body.id) throw new Error(body.error?.message || 'YouTube did not accept the video')
    return { remoteId: body.id }
  }

  private async exchangeInstagram(input: { app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile> {
    const short = await this.json<{ access_token: string }>('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.app.clientId,
        client_secret: input.app.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    })
    const long = await this.json<{ access_token: string; expires_in?: number }>(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: input.app.clientSecret,
        access_token: short.access_token,
      })}`,
    )
    const profile = await this.json<{ user_id?: string; id?: string; username?: string; account_type?: string }>(
      `${IG_GRAPH}/me?${new URLSearchParams({ fields: 'user_id,username,account_type', access_token: long.access_token })}`,
    )
    return {
      externalId: profile.user_id || profile.id || '',
      displayName: profile.username || '',
      username: profile.username || '',
      accessToken: long.access_token,
      refreshToken: null,
      expiresInSec: long.expires_in ?? 60 * 24 * 60 * 60,
      scopes: IG_SCOPES.join(','),
      accountType: profile.account_type || 'BUSINESS',
    }
  }

  private async exchangeFacebook(input: { app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile> {
    const token = await this.json<{ access_token: string; expires_in?: number }>(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: input.app.clientId,
        client_secret: input.app.clientSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
      })}`,
    )
    const pages = await this.json<{ data?: Array<{ id: string; name: string; access_token: string }> }>(
      `${GRAPH}/me/accounts?${new URLSearchParams({ access_token: token.access_token })}`,
    )
    const page = pages.data?.[0]
    if (!page?.id || !page.access_token) throw new Error('Facebook did not return a Page')
    return {
      externalId: page.id,
      displayName: page.name,
      username: page.name,
      accessToken: page.access_token,
      refreshToken: null,
      expiresInSec: token.expires_in ?? 60 * 24 * 60 * 60,
      scopes: 'pages_manage_posts,pages_show_list,pages_read_engagement',
    }
  }

  private async exchangeTikTok(input: { app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile> {
    const token = await this.json<{
      access_token?: string
      refresh_token?: string
      expires_in?: number
      open_id?: string
      error?: string
      error_description?: string
    }>('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: input.app.clientId,
        client_secret: input.app.clientSecret,
        code: input.code,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
      }),
    })
    if (!token.access_token || !token.open_id) throw new Error(token.error_description || token.error || 'TikTok did not return a token')
    let username = token.open_id
    let displayName = token.open_id
    try {
      const info = await this.json<{ data?: { user?: { display_name?: string; username?: string } } }>(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username',
        { headers: { authorization: `Bearer ${token.access_token}` } },
      )
      displayName = info.data?.user?.display_name || displayName
      username = info.data?.user?.username || username
    } catch {
      displayName = token.open_id
    }
    return {
      externalId: token.open_id,
      displayName,
      username,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresInSec: token.expires_in ?? 24 * 60 * 60,
      scopes: 'video.publish,user.info.basic',
    }
  }

  private async exchangeYouTube(input: { app: OauthApp; redirectUri: string; code: string }): Promise<ConnectedProfile> {
    const token = await this.json<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }>(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: input.code,
          client_id: input.app.clientId,
          client_secret: input.app.clientSecret,
          redirect_uri: input.redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    )
    if (!token.access_token) throw new Error(token.error_description || token.error || 'YouTube did not return a token')
    const channel = await this.json<{ items?: Array<{ id: string; snippet?: { title?: string } }> }>(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { authorization: `Bearer ${token.access_token}` } },
    )
    const item = channel.items?.[0]
    if (!item?.id) throw new Error('YouTube did not return a channel')
    return {
      externalId: item.id,
      displayName: item.snippet?.title || item.id,
      username: item.snippet?.title || item.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresInSec: token.expires_in ?? 3600,
      scopes: 'youtube.upload',
    }
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(url, init)
    const data = await response.json() as T & { error?: { message?: string } | string }
    if (!response.ok) {
      const message = typeof data.error === 'string' ? data.error : data.error?.message
      throw new Error(message || `The network request failed (${response.status})`)
    }
    return data
  }
}

function officialAuthorizeUrl(network: SocialNetwork, clientId: string, redirectUri: string, state: string): string {
  if (network === 'instagram') {
    const url = new URL('https://www.instagram.com/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', IG_SCOPES.join(','))
    url.searchParams.set('state', state)
    return url.toString()
  }
  if (network === 'facebook') {
    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'pages_show_list,pages_manage_posts,pages_read_engagement')
    return url.toString()
  }
  if (network === 'tiktok') {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
    url.searchParams.set('client_key', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'video.publish,user.info.basic')
    return url.toString()
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly')
  url.searchParams.set('state', state)
  return url.toString()
}
