import { FormEvent, useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { NETWORK_LABEL, REEL_LENGTHS, SOCIAL_NETWORKS, VIDEO_LENGTHS, composePublishCaption, defaultDuration, firstCommentAvailable, formatRejection, isSocialNetwork, roleHas, zonedDay, type AudienceHour, type HashtagChip, type OrgRole, type SocialNetwork } from '@instagram-ai/shared'
import { api } from '../lib/api'
import { DoughnutMetricsChart, LineMetricsChart } from '../lib/charts'
import { Hint, Pager, confirmDelete, fetchAll } from '../lib/form'
import { BestTime } from '../lib/best-time'
import type { Claim, PackageInfo, PostRecord, SocialAccountInfo } from '../lib/types'
import { useSession } from './shell'
import { SaveAsTemplate } from './templates'
import { CreatePhonePreview, type Job } from './create-preview'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function Notice({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
    </>
  )
}

const FORMATS = ['photo', 'carousel', 'reel', 'video', 'story'] as const
type DraftFormat = (typeof FORMATS)[number]

function lengthsFor(format: DraftFormat): readonly number[] {
  if (format === 'reel') return REEL_LENGTHS
  if (format === 'video') return VIDEO_LENGTHS
  return []
}

function captionStillQueued(copyError: string | undefined, status: string | undefined): boolean {
  if (!copyError) return false
  return status === 'queued' || status === 'running' || /caption could not be generated/i.test(copyError) && status !== 'ready' && status !== 'failed'
}

function networkLabel(network: string): string {
  return isSocialNetwork(network) ? NETWORK_LABEL[network as SocialNetwork] : network
}

function FirstCommentNote({ accounts }: { accounts: SocialAccountInfo[] }) {
  const blocked = accounts.filter((account) => !firstCommentAvailable(account.network))
  if (!accounts.length) return <p>A first comment is sent only after the post is published, and only after a person approved it. TikTok and YouTube cannot post one.</p>
  if (!blocked.length) return <p>Sent on Instagram and Facebook only after this post is published and a person approved it.</p>
  return <p>A first comment is not available on {blocked.map((account) => networkLabel(account.network)).join(' or ')}.</p>
}

export function CreatePage() {
  const session = useSession()
  const [params] = useSearchParams()
  const existingId = params.get('post')
  const seedFormat = params.get('format')
  const seedDescription = params.get('description')
  const initialFormat = (FORMATS as readonly string[]).includes(seedFormat ?? '') ? seedFormat as DraftFormat : 'photo'
  const [format, setFormat] = useState<DraftFormat>(initialFormat)
  const [length, setLength] = useState(8)
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState(seedDescription ?? '')
  const [aiInstructions, setAiInstructions] = useState('')
  const [generateCaption, setGenerateCaption] = useState(true)
  const [aiLanguage, setAiLanguage] = useState('')
  const [aiTone, setAiTone] = useState('')
  const [accountId, setAccountId] = useState(session.accounts.find((account) => account.status === 'connected')?.id ?? '')
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountInfo[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string; defaultFormat: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [campaignId, setCampaignId] = useState(params.get('campaign') ?? '')
  const [post, setPost] = useState<PostRecord | null>(null)
  const [job, setJob] = useState<Job>(null)
  const [caption, setCaption] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [hashtags, setHashtags] = useState<HashtagChip[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [commentKeyword, setCommentKeyword] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [smartLinkUrl, setSmartLinkUrl] = useState('')
  const [adNetworks, setAdNetworks] = useState<SocialNetwork[]>([])
  const [scheduleAt, setScheduleAt] = useState('')
  const [audienceHours, setAudienceHours] = useState<AudienceHour[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(Boolean(existingId))
  const [sampleFile, setSampleFile] = useState<File | null>(null)
  const [sampleUrl, setSampleUrl] = useState('')
  const [samplePreview, setSamplePreview] = useState<string | null>(null)
  const [referenceAssetId, setReferenceAssetId] = useState<string | null | undefined>(undefined)
  const canPublish = roleHas(session.role as OrgRole, 'posts.publish')
  const preview = (post?.media.length ?? 0) > 0

  useEffect(() => {
    if (!sampleFile) return
    const url = URL.createObjectURL(sampleFile)
    setSamplePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [sampleFile])

  useEffect(() => {
    fetchAll<{ id: string; name: string; defaultFormat: string }>('/api/categories', 'categories')
      .then((rows) => setCategories(rows))
      .catch((cause) => setError(messageOf(cause)))
    api<{ hours: AudienceHour[] }>('/api/audience-times')
      .then((body) => setAudienceHours(body.hours))
      .catch((cause) => setError(messageOf(cause)))
    fetchAll<SocialAccountInfo>('/api/social/accounts', 'accounts')
      .then((rows) => setSocialAccounts(rows.filter((account) => account.status === 'connected')))
      .catch((cause) => setError(messageOf(cause)))
    api<{ campaigns: Array<{ id: string; name: string }> }>('/api/campaigns?page=1')
      .then((body) => setCampaigns(body.campaigns))
      .catch(() => setCampaigns([]))
  }, [])

  useEffect(() => {
    if (existingId) return
    if ((FORMATS as readonly string[]).includes(seedFormat ?? '')) setFormat(seedFormat as DraftFormat)
    if (seedDescription) setDescription(seedDescription)
  }, [existingId, seedFormat, seedDescription])

  useEffect(() => {
    if (!existingId) return
    setLoadingDraft(true)
    api<{ post: PostRecord; job: Job }>(`/api/posts/${existingId}`).then((body) => {
      applyLoaded(body.post)
      setJob(body.job)
      if (body.job?.error) setNotice(body.job.error)
    }).catch((cause) => setError(messageOf(cause))).finally(() => setLoadingDraft(false))
  }, [existingId])

  useEffect(() => {
    if (!post || !job || (job.status !== 'queued' && job.status !== 'running')) return
    const timer = window.setInterval(() => {
      api<{ post: PostRecord; job: Job }>(`/api/posts/${post.id}`).then((body) => {
        setPost(body.post)
        setJob(body.job)
        setCaption(body.post.caption)
        setKeywords(body.post.keywords)
        setHashtags(body.post.hashtags)
        setCommentKeyword(body.post.commentKeyword ?? '')
        setFirstComment(body.post.firstComment ?? '')
        const pending = body.job && (body.job.status === 'queued' || body.job.status === 'running')
        if (pending) {
          setNotice((current) => /caption could not be generated/i.test(current) ? '' : current)
          setError((current) => /caption could not be generated/i.test(current) ? '' : current)
        } else if (body.job?.status === 'ready' && body.job.error) {
          setNotice(body.job.error)
        } else if (body.job?.status === 'failed') {
          setError(body.job.error || 'Generation failed. Try again.')
        }
      }).catch((cause) => setError(messageOf(cause)))
    }, 1500)
    return () => window.clearInterval(timer)
  }, [post, job])

  function applySampleFromPost(next: PostRecord) {
    if (next.reference?.url) {
      setReferenceAssetId(next.reference.id)
      setSamplePreview(next.reference.url)
      setSampleFile(null)
    } else if (next.referenceAssetId) {
      setReferenceAssetId(next.referenceAssetId)
    }
  }

  function clearSample() {
    setSampleFile(null)
    setSampleUrl('')
    setSamplePreview(null)
    setReferenceAssetId(null)
  }

  function applyLoaded(next: PostRecord) {
    setPost(next)
    setCaption(next.caption)
    setKeywords(next.keywords)
    setHashtags(next.hashtags)
    setDescription(next.description)
    setCommentKeyword(next.commentKeyword ?? '')
    setFirstComment(next.firstComment ?? '')
    setSmartLinkUrl(next.smartLinkUrl ?? '')
    setAdNetworks(next.adNetworks ?? [])
    if ((FORMATS as readonly string[]).includes(next.format)) setFormat(next.format as DraftFormat)
    if (next.durationSeconds) setLength(next.durationSeconds)
    setSelectedAccounts(next.socialAccountIds ?? [])
    applySampleFromPost(next)
    setDirty(false)
  }

  function applyPost(next: PostRecord) {
    setPost(next)
    setCaption(next.caption)
    setKeywords(next.keywords)
    setHashtags(next.hashtags)
    setCommentKeyword(next.commentKeyword ?? '')
    setFirstComment(next.firstComment ?? '')
    setSmartLinkUrl(next.smartLinkUrl ?? '')
    setAdNetworks(next.adNetworks ?? [])
    if (next.reference?.url && !sampleFile) {
      setReferenceAssetId(next.reference.id)
      setSamplePreview(next.reference.url)
    }
    setDirty(false)
  }

  async function ensurePost(): Promise<PostRecord> {
    if (post) {
      const updated = await api<{ post: PostRecord }>(`/api/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description,
          format,
          durationSeconds: lengthsFor(format).length ? length : null,
          aiInstructions,
          generateCaption,
          aiLanguage,
          aiTone,
          commentKeyword,
          firstComment,
          hashtags,
          smartLinkUrl: smartLinkUrl.trim() ? smartLinkUrl.trim() : null,
          adNetworks,
          campaignId: campaignId || null,
          ...(socialAccounts.length
            ? { socialAccountIds: selectedAccounts }
            : { instagramAccountId: accountId || null }),
        }),
      })
      applyPost(updated.post)
      return updated.post
    }
    const created = await api<{ post: PostRecord }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        format,
        description,
        categoryId: categoryId || undefined,
        durationSeconds: lengthsFor(format).length ? length : undefined,
        aiInstructions,
        generateCaption,
        aiLanguage,
        aiTone,
        commentKeyword,
        firstComment,
        smartLinkUrl: smartLinkUrl.trim() ? smartLinkUrl.trim() : null,
        adNetworks,
        campaignId: campaignId || undefined,
        hashtags: hashtags.filter((chip) => chip.enabled).map((chip) => chip.tag),
        ...(socialAccounts.length
          ? { socialAccountIds: selectedAccounts }
          : { instagramAccountId: accountId || undefined }),
      }),
    })
    applyPost(created.post)
    return created.post
  }

  async function generate() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const current = await ensurePost()
      let nextReferenceId: string | null | undefined = referenceAssetId
      if (sampleFile) {
        const body = new FormData()
        body.append('file', sampleFile)
        const uploaded = await api<{ asset: { id: string; url: string } }>('/api/media/reference', { method: 'POST', body })
        nextReferenceId = uploaded.asset.id
        setReferenceAssetId(uploaded.asset.id)
        setSamplePreview(uploaded.asset.url)
        setSampleFile(null)
      } else if (!nextReferenceId && sampleUrl.trim()) {
        const uploaded = await api<{ asset: { id: string; url: string } }>('/api/media/reference-url', {
          method: 'POST',
          body: JSON.stringify({ url: sampleUrl.trim() }),
        })
        nextReferenceId = uploaded.asset.id
        setReferenceAssetId(uploaded.asset.id)
        setSamplePreview(uploaded.asset.url)
      }
      const result = await api<{ post: PostRecord; job: Job; copyError?: string }>(`/api/posts/${current.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ referenceAssetId: nextReferenceId ?? null }),
      })
      applyPost(result.post)
      setJob(result.job)
      if (result.job?.error) setNotice(result.job.error)
      else if (result.copyError && !captionStillQueued(result.copyError, result.job?.status)) setNotice(result.copyError)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function uploadFile(file: File) {
    setBusy(true)
    setError('')
    try {
      const current = await ensurePost()
      const body = new FormData()
      body.append('file', file)
      const result = await api<{ post: PostRecord; copyError?: string }>(`/api/posts/${current.id}/media`, { method: 'POST', body })
      applyPost(result.post)
      if (result.copyError) setNotice(result.copyError)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function saveCopy() {
    if (!post) return
    const updated = await api<{ post: PostRecord }>(`/api/posts/${post.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        caption,
        keywords,
        hashtags,
        firstComment,
        commentKeyword,
        smartLinkUrl: smartLinkUrl.trim() ? smartLinkUrl.trim() : null,
        adNetworks,
        campaignId: campaignId || null,
      }),
    })
    applyPost(updated.post)
  }

  async function regenerate() {
    if (!post) return
    setBusy(true)
    try {
      await saveCopy()
      const result = await api<{ post: PostRecord; textUsed: number; imageUsed: number; videoUsed: number }>(`/api/posts/${post.id}/generate-copy`, { method: 'POST' })
      applyPost(result.post)
      setNotice(`Copy regenerated. Text credits used: ${result.textUsed}. Photo credits: ${result.imageUsed}. Video credits: ${result.videoUsed}.`)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function act(path: string, body?: unknown) {
    if (!post) return
    setError('')
    try {
      if (path === 'approve') await saveCopy()
      const result = await api<{ post?: PostRecord }>(`/api/posts/${post.id}/${path}`, {
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (result.post) applyPost(result.post)
      if (path === 'publish' && result.post?.firstCommentError) setError(result.post.firstCommentError)
      else setNotice(path === 'publish' ? 'Published' : 'Saved')
    } catch (cause) {
      setError(messageOf(cause))
      const failed = await api<{ post: PostRecord }>(`/api/posts/${post.id}`).catch(() => null)
      if (failed) applyPost(failed.post)
    }
  }

  const publishedCaption = composePublishCaption(caption, hashtags)
  const lengths = lengthsFor(format)

  return (
    <section className="stack">
      <h1>Create</h1>
      <p>Start from scratch, or <Link to="/app/templates">browse templates</Link> to personalize a ready-made photo, poster, or video.</p>
      <Notice error={error} notice={notice} />
      {post?.template ? <p className="notice" role="note">From template “{post.template.title}”. {post.template.aiNote}</p> : null}
      <div className="create-layout">
        <form className="stack" onSubmit={(event) => { event.preventDefault(); void generate() }}>
          <label>Format
            <Hint>Photo, carousel, reel, video, or story. This is the shape of the draft.</Hint>
            <select value={format} onChange={(event) => {
              const next = event.target.value as DraftFormat
              setFormat(next)
              const allowed = lengthsFor(next)
              if (allowed.length && !allowed.includes(length)) setLength(defaultDuration(next) ?? allowed[0])
            }}>
              <option value="photo">Photo</option>
              <option value="carousel">Carousel</option>
              <option value="reel">Reel</option>
              <option value="video">Video</option>
              <option value="story">Story</option>
            </select>
          </label>
          {format === 'story' ? <p>Instagram and Facebook publish a story through the official API. TikTok and YouTube cannot publish a story.</p> : null}
          {lengths.length ? (
            <label>Length
              <Hint>How long the reel or video should be, in seconds.</Hint>
              <select value={length} onChange={(event) => setLength(Number(event.target.value))}>
                {lengths.map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
              </select>
            </label>
          ) : null}
          <label>Category
            <Hint>Optional. Picking one can set the format from that category.</Hint>
            <select value={categoryId} onChange={(event) => {
              const next = event.target.value
              setCategoryId(next)
              const category = categories.find((item) => item.id === next)
              if (category && (FORMATS as readonly string[]).includes(category.defaultFormat)) {
                const nextFormat = category.defaultFormat as DraftFormat
                setFormat(nextFormat)
                const allowed = lengthsFor(nextFormat)
                if (allowed.length && !allowed.includes(length)) setLength(defaultDuration(nextFormat) ?? allowed[0])
              }
            }}>
              <option value="">None</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <fieldset className="stack">
            <legend>Accounts</legend>
            <Hint>Approving this draft approves every selected account.</Hint>
            {socialAccounts.length ? socialAccounts.map((account) => (
              <label className="checkline" key={account.id}>
                <input
                  type="checkbox"
                  checked={selectedAccounts.includes(account.id)}
                  onChange={(event) => {
                    setSelectedAccounts((current) => event.target.checked ? [...current, account.id] : current.filter((id) => id !== account.id))
                    if (account.network === 'instagram') setAccountId(event.target.checked ? account.instagramAccountId ?? '' : '')
                  }}
                />
                {isSocialNetwork(account.network) ? NETWORK_LABEL[account.network] : account.network} · {account.username || account.displayName}
                {format === 'story' && formatRejection(account.network, 'story') ? ` — ${formatRejection(account.network, 'story')}` : ''}
              </label>
            )) : (
              <label>Instagram account
                <Hint>The Instagram account this draft should use. You can choose later.</Hint>
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <option value="">Choose later</option>
                  {session.accounts.map((account) => <option key={account.id} value={account.id}>@{account.username} ({account.status})</option>)}
                </select>
              </label>
            )}
            {format === 'reel' ? <p>Reels are vertical for TikTok.</p> : null}
            {format === 'video' ? <p>Videos are wide for YouTube.</p> : null}
          </fieldset>
          <fieldset className="stack">
            <legend>Ad creative</legend>
            <Hint>A label for Facebook, Instagram, TikTok, or YouTube. This does not buy an ad or spend a budget.</Hint>
            {SOCIAL_NETWORKS.map((network) => (
              <label className="checkline" key={network}>
                <input
                  type="checkbox"
                  checked={adNetworks.includes(network)}
                  onChange={(event) => {
                    setAdNetworks((current) => event.target.checked ? [...current, network] : current.filter((item) => item !== network))
                    setDirty(true)
                  }}
                />
                {NETWORK_LABEL[network]}
              </label>
            ))}
          </fieldset>
          <label>Smart link
            <Hint>One http or https address. Visits are counted, then sent to this URL.</Hint>
            <input value={smartLinkUrl} onChange={(event) => { setSmartLinkUrl(event.target.value); setDirty(true) }} placeholder="https://example.com/spring" />
          </label>
          <p>One tracked address. A visit to the public link is counted, then sent to this URL.</p>
          <label>Description<Hint>What the post is about. The draft uses this text.</Hint><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></label>
          <label>Comment keyword
            <Hint>When a comment contains this word, an unsent reply draft is prepared. Nothing is sent.</Hint>
            <input value={commentKeyword} maxLength={80} onChange={(event) => { setCommentKeyword(event.target.value); setDirty(true) }} placeholder="Draft a reply when a comment contains this" />
          </label>
          <p>A matching comment gets an unsent draft from approved facts. Nothing is sent, and nobody is asked to follow.</p>
          <label>AI instructions
            <Hint>Extra direction for this draft, up to 8000 characters.</Hint>
            <textarea value={aiInstructions} maxLength={8000} onChange={(event) => setAiInstructions(event.target.value)} rows={5} />
          </label>
          <p>{aiInstructions.length}/8000</p>
          <label className="checkline">
            <input type="checkbox" checked={generateCaption} onChange={(event) => setGenerateCaption(event.target.checked)} />
            Generate a caption
            <Hint>Turn this on to write a caption with the image or video.</Hint>
          </label>
          <label>Custom AI language
            <Hint>Optional language for this draft, up to 500 characters.</Hint>
            <input value={aiLanguage} maxLength={500} onChange={(event) => setAiLanguage(event.target.value)} />
          </label>
          <label>Custom AI tone
            <Hint>Optional tone for this draft, up to 500 characters.</Hint>
            <input value={aiTone} maxLength={500} onChange={(event) => setAiTone(event.target.value)} />
          </label>
          <fieldset className="stack sample-reference">
            <legend>Sample / reference</legend>
            <label>Sample / reference photo
              <Hint>Optional PNG, JPEG, or WebP used as a visual reference for Generate.</Hint>
              <input
                name="reference"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file || !file.size) return
                  setSampleFile(file)
                  setReferenceAssetId(undefined)
                  setSampleUrl('')
                }}
              />
            </label>
            <label>Sample URL
              <Hint>Optional https image address. Fetched on Generate when no file is chosen. Pages are rejected.</Hint>
              <input
                value={sampleUrl}
                onChange={(event) => {
                  const next = event.target.value
                  setSampleUrl(next)
                  if (next.trim()) {
                    setSampleFile(null)
                    setSamplePreview(null)
                    setReferenceAssetId(undefined)
                  }
                }}
                placeholder="https://example.com/product.png"
                inputMode="url"
              />
            </label>
            {samplePreview ? (
              <div className="sample-thumb-row">
                <img className="sample-thumb" src={samplePreview} alt="Sample / reference preview" />
                <button className="secondary" type="button" onClick={() => clearSample()}>Clear sample</button>
              </div>
            ) : null}
          </fieldset>
          <div className="row">
            <button type="submit" disabled={busy || loadingDraft}>Generate</button>
            <label className="button secondary">Upload
              <Hint>PNG, JPEG, WebP, or MP4 to attach to this draft.</Hint>
              <input hidden type="file" accept="image/png,image/jpeg,image/webp,video/mp4" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadFile(file)
              }} />
            </label>
          </div>
        </form>
        <div className="stack">
          <CreatePhonePreview
            format={format}
            media={post?.media ?? []}
            caption={publishedCaption}
            job={job}
            busy={busy || loadingDraft}
          />
          <label>Caption<Hint>The words that publish with the post. Edit them before approval.</Hint><textarea value={caption} onChange={(event) => { setCaption(event.target.value); setDirty(true) }} rows={5} /></label>
          <div className="chips">
            {keywords.map((keyword) => (
              <button className="chip" type="button" key={keyword} onClick={() => { setKeywords(keywords.filter((item) => item !== keyword)); setDirty(true) }}>{keyword}</button>
            ))}
          </div>
          <div className="row">
            <label>Keyword
              <Hint>A short phrase to keep with this draft. Add stores it on the post.</Hint>
              <input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} placeholder="Add a keyword" />
            </label>
            <button className="secondary" type="button" onClick={() => { if (keywordDraft.trim()) { setKeywords([...keywords, keywordDraft.trim()]); setDirty(true) } setKeywordDraft('') }}>Add</button>
          </div>
          <div className="chips">
            {hashtags.map((chip) => (
              <span className={chip.enabled ? 'chip' : 'chip off'} key={chip.tag}>
                <button type="button" className="chip" onClick={() => { setHashtags(hashtags.map((item) => item.tag === chip.tag ? { ...item, enabled: !item.enabled } : item)); setDirty(true) }}>#{chip.tag}</button>
                <button type="button" className="chip" onClick={() => { setHashtags(hashtags.filter((item) => item.tag !== chip.tag)); setDirty(true) }}>Remove</button>
              </span>
            ))}
          </div>
          <div className="row">
            <label>Hashtag
              <Hint>One tag without the #. Ten tags is the maximum.</Hint>
              <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="Add a hashtag" />
            </label>
            <button className="secondary" type="button" disabled={hashtags.length >= 10} onClick={() => {
              const tag = tagDraft.replace(/^#+/, '').trim()
              if (tag && hashtags.length < 10) { setHashtags([...hashtags, { tag, enabled: true }]); setDirty(true) }
              setTagDraft('')
            }}>Add tag</button>
            <button className="secondary" type="button" onClick={() => void api<{ hashtags: string[] }>('/api/brand-kit').then((body) => {
              if (!body.hashtags.length) { setNotice('No saved hashtags yet.'); return }
              setHashtags((current) => {
                const next = [...current]
                for (const tag of body.hashtags) {
                  if (next.length >= 10) break
                  if (next.some((item) => item.tag.toLowerCase() === tag.toLowerCase())) continue
                  next.push({ tag, enabled: true })
                }
                return next
              })
              setDirty(true)
            }).catch((cause) => setError(messageOf(cause)))}>Insert saved hashtags</button>
          </div>
          <label>First comment
            <Hint>Optional. Sent only after this post is published and a person approved it.</Hint>
            <textarea value={firstComment} maxLength={2000} rows={3} onChange={(event) => { setFirstComment(event.target.value); setDirty(true) }} placeholder="Optional. Sent only after this post is published and approved." />
          </label>
          <FirstCommentNote accounts={socialAccounts.filter((account) => selectedAccounts.includes(account.id))} />
          {post?.targets?.filter((target) => target.firstCommentError).map((target) => <p className="error" key={target.id}>{target.firstCommentError}</p>)}
          {post?.firstCommentError ? <p className="error">{post.firstCommentError}</p> : null}
          {post?.alternativeCaptions?.length ? (
            <div className="stack">
              <span>Alternatives</span>
              {post.alternativeCaptions.map((text) => (
                <button className="secondary" type="button" key={text} onClick={() => { setCaption(text); setDirty(true) }}>{text}</button>
              ))}
            </div>
          ) : null}
          {post?.claimsNeedReview ? (
            <div className="stack">
              <p>These claims are not in approved facts. Accept them before publish.</p>
              <ul>{post.factualClaims.filter((claim: Claim) => claim.needsReview && !claim.accepted).map((claim) => <li key={claim.claim}>{claim.claim}</li>)}</ul>
              <button type="button" onClick={() => void act('accept-claims')}>Accept claims</button>
            </div>
          ) : null}
          <BestTime hours={audienceHours} />
          <label>Campaign
            <Hint>Optional. Attach this post to a campaign dashboard when you schedule or save.</Hint>
            <select value={campaignId} onChange={(event) => { setCampaignId(event.target.value); setDirty(true) }}>
              <option value="">No campaign</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </label>
          <div className="row">
            <button type="button" disabled={!post || busy} onClick={() => void regenerate()}>Regenerate copy</button>
            <button type="button" disabled={!preview || !canPublish || busy} onClick={() => void act('approve')}>Approve</button>
            <label>Schedule time
              <Hint>Local date and time. The post still needs approval before it can publish.</Hint>
              <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
            </label>
            <button type="button" disabled={!preview || !post?.approvedAt || dirty || !session.package.scheduling || busy} onClick={() => void act('schedule', { scheduledAt: new Date(scheduleAt).toISOString() })}>Schedule</button>
            <button type="button" disabled={!preview || !post?.approvedAt || dirty || !canPublish || Boolean(post?.claimsNeedReview) || busy} onClick={() => void act('publish')}>Publish</button>
          </div>
          {post && preview ? <SaveAsTemplate post={post} /> : null}
          {post ? <p>Status: {post.status}{post.publishError ? ` — ${post.publishError}` : ''}</p> : null}
          {adNetworks.length ? <p>Ad creative for {adNetworks.map((network) => NETWORK_LABEL[network]).join(', ')}.</p> : null}
          {post?.smartLinkPath ? <p>{post.smartLinkClicks ?? 0} clicks · <a href={post.smartLinkPath}>{post.smartLinkPath}</a></p> : null}
          {post?.targets?.length ? (
            <ul>
              {post.targets.map((target) => {
                const blocked = format === 'story' ? formatRejection(target.network, 'story') : null
                const detail = target.error || blocked
                return <li key={target.id}>{isSocialNetwork(target.network) ? NETWORK_LABEL[target.network] : target.network}: {target.status}{detail ? ` — ${detail}` : ''}</li>
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function IdeasPage() {
  const navigate = useNavigate()
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [ideas, setIdeas] = useState<Array<{ id: string; text: string; postId: string | null }>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  function load(next = page) {
    return api<{ ideas: Array<{ id: string; text: string; postId: string | null }>; page: number; total: number }>(`/api/ideas?page=${next}`).then((body) => {
      if (!body.ideas.length && body.page > 1) { setPage(body.page - 1); return }
      setIdeas(body.ideas)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack">
      <h1>Ideas</h1>
      <p>Save a one-line idea, then turn it into a draft. The draft still needs approval before it can publish.</p>
      <Notice error={error} notice={notice} />
      <form className="row" onSubmit={(event) => {
        event.preventDefault()
        const line = text.replace(/\s+/g, ' ').trim()
        if (!line) return
        void api('/api/ideas', { method: 'POST', body: JSON.stringify({ text: line }) })
          .then(() => { setText(''); setNotice('Idea saved'); return load() })
          .catch((cause) => setError(messageOf(cause)))
      }}>
        <label>Idea
          <Hint>One line, up to 280 characters. Saving it does not publish a post.</Hint>
          <input value={text} maxLength={280} onChange={(event) => setText(event.target.value)} placeholder="One line" />
        </label>
        <button type="submit">Save idea</button>
      </form>
      <ul className="stack">
        {ideas.map((idea) => (
          <li key={idea.id} className="card">
            {editing === idea.id ? (
              <form className="stack" onSubmit={(event) => {
                event.preventDefault()
                void api(`/api/ideas/${idea.id}`, { method: 'PATCH', body: JSON.stringify({ text: draft }) })
                  .then(() => { setEditing(''); setNotice('Idea saved'); return load() })
                  .catch((cause) => setError(messageOf(cause)))
              }}>
                <label>Idea
                  <Hint>One line, up to 280 characters. Saving it does not publish a post.</Hint>
                  <input value={draft} maxLength={280} onChange={(event) => setDraft(event.target.value)} />
                </label>
                <button type="submit">Save</button>
              </form>
            ) : <p>{idea.text}</p>}
            <div className="row">
              <button type="button" onClick={() => void api<{ post: { id: string } }>(`/api/ideas/${idea.id}/draft`, { method: 'POST' }).then((body) => navigate(`/app/create?post=${body.post.id}`)).catch((cause) => setError(messageOf(cause)))}>
                {idea.postId ? 'Open draft' : 'Make a draft'}
              </button>
              {canWrite ? <button className="secondary" type="button" onClick={() => { setEditing(idea.id); setDraft(idea.text) }}>Edit</button> : null}
              {canWrite ? <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this idea')) return
                void api(`/api/ideas/${idea.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button> : null}
            </div>
          </li>
        ))}
      </ul>
      <Pager page={page} total={total} onPage={setPage} label="Ideas" />
    </section>
  )
}

function noonOn(day: string, timeZone: string): string {
  for (let hour = 0; hour < 24; hour += 1) {
    const iso = `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`
    if (zonedDay(iso, timeZone) === day) return iso
  }
  return `${day}T12:00:00.000Z`
}

function monthRange(date: Date): { from: string; to: string } {
  const year = date.getFullYear()
  const month = date.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  const stamp = `${year}-${String(month + 1).padStart(2, '0')}`
  return { from: `${stamp}-01T00:00:00.000Z`, to: `${stamp}-${String(days).padStart(2, '0')}T23:59:59.999Z` }
}

function PostRowActions({ post, onDone, onError }: { post: PostRecord; onDone: () => void; onError: (message: string) => void }) {
  const session = useSession()
  if (!roleHas(session.role as OrgRole, 'posts.write')) return null
  const locked = post.status === 'PUBLISHED' || post.status === 'PUBLISHING'
  return (
    <div className="row">
      <Link to={`/app/create?post=${post.id}`}>Edit</Link>
      {locked ? null : (
        <button className="secondary" type="button" onClick={() => {
          if (!confirmDelete('this post')) return
          void api(`/api/posts/${post.id}`, { method: 'DELETE' }).then(onDone).catch((cause) => onError(messageOf(cause)))
        }}>Delete</button>
      )}
    </div>
  )
}

export function CalendarPage() {
  const session = useSession()
  const [posts, setPosts] = useState<PostRecord[]>([])
  const [holding, setHolding] = useState<PostRecord[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [holdingPage, setHoldingPage] = useState(1)
  const [holdingTotal, setHoldingTotal] = useState(0)
  const [timezone, setTimezone] = useState('UTC')
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState('')
  const [over, setOver] = useState('')
  const [error, setError] = useState('')
  function load(next = page, hold = holdingPage, date = cursor) {
    const range = monthRange(date)
    return Promise.all([
      api<{ posts: PostRecord[]; timezone: string; page: number; total: number }>(`/api/posts?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&page=${next}`),
      api<{ posts: PostRecord[]; page: number; total: number }>(`/api/posts?unscheduled=1&page=${hold}`),
    ]).then(([scheduled, open]) => {
      setPosts(scheduled.posts)
      setTimezone(scheduled.timezone)
      setPage(scheduled.page)
      setTotal(scheduled.total)
      setHolding(open.posts)
      setHoldingPage(open.page)
      setHoldingTotal(open.total)
    })
  }
  useEffect(() => { load(page, holdingPage, cursor).catch(() => undefined) }, [page, holdingPage, cursor])
  if (!session.package.scheduling) return <p>Scheduling is included on Growth and Pro.</p>
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(Date.UTC(year, month, 1))
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return `${year}-${String(month + 1).padStart(2, '0')}-${day}`
  })
  const grouped = new Map<string, PostRecord[]>()
  for (const post of posts) {
    const stamp = post.scheduledAt ?? ''
    if (!stamp) continue
    const key = zonedDay(stamp, timezone)
    grouped.set(key, [...(grouped.get(key) ?? []), post])
  }
  function chips(post: PostRecord) {
    if (post.targets?.length) {
      return post.targets.map((target) => ({ id: target.id, label: `${networkLabel(target.network)} · ${target.status}` }))
    }
    return [{ id: post.id, label: post.status }]
  }
  async function move(postId: string, day: string) {
    const post = posts.find((item) => item.id === postId)
    if (!post || post.status === 'PUBLISHED' || post.status === 'PUBLISHING') return
    setError('')
    try {
      await api(`/api/posts/${postId}/move`, { method: 'POST', body: JSON.stringify({ scheduledAt: noonOn(day, timezone) }) })
      await load()
    } catch (cause) {
      setError(messageOf(cause))
    }
  }
  return (
    <section className="stack">
      <h1>Planner</h1>
      <p>Times use {timezone}. Each account is listed on its own. Drag a draft onto a day to change the time before it publishes. The grid starts {first.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.</p>
      <Notice error={error} notice="" />
      <div className="row">
        <button className="secondary" type="button" onClick={() => { setPage(1); setCursor(new Date(year, month - 1, 1)) }}>Previous month</button>
        <button className="secondary" type="button" onClick={() => { setPage(1); setCursor(new Date(year, month + 1, 1)) }}>Next month</button>
      </div>
      {holding.length ? (
        <div className="card stack">
          <strong>Not on the calendar yet</strong>
          {holding.map((post) => (
            <div key={post.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', post.id)}>
              <span>{post.caption || post.description || 'Untitled'}</span>
              {chips(post).map((chip) => <span className="target-chip" key={chip.id}>{chip.label}</span>)}
              <PostRowActions post={post} onDone={() => void load()} onError={setError} />
            </div>
          ))}
          <Pager page={holdingPage} total={holdingTotal} onPage={setHoldingPage} label="Unscheduled posts" />
        </div>
      ) : null}
      <div className="calendar">
        {cells.map((key) => (
          <div
            className={over === key ? 'day over' : 'day'}
            key={key}
            onDragOver={(event) => { event.preventDefault(); setOver(key) }}
            onDragLeave={() => setOver((current) => current === key ? '' : current)}
            onDrop={(event) => {
              event.preventDefault()
              setOver('')
              const postId = event.dataTransfer.getData('text/plain')
              if (postId) void move(postId, key)
            }}
          >
            <button type="button" onClick={() => setSelected(key)}><strong>{key.slice(-2)}</strong></button>
            {(grouped.get(key) ?? []).map((post) => (
              <div key={post.id} draggable={post.status !== 'PUBLISHED' && post.status !== 'PUBLISHING'} onDragStart={(event) => event.dataTransfer.setData('text/plain', post.id)}>
                {chips(post).map((chip) => <span className="target-chip" key={chip.id}>{chip.label}</span>)}
                <PostRowActions post={post} onDone={() => void load()} onError={setError} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Scheduled posts" />
      {selected ? (
        <ul>{(grouped.get(selected) ?? []).flatMap((post) => chips(post).map((chip) => (
          <li key={chip.id}>
            {chip.label}: {post.caption || post.description || 'Untitled'}
            <PostRowActions post={post} onDone={() => void load()} onError={setError} />
          </li>
        )))}</ul>
      ) : null}
    </section>
  )
}

type CommentRow = { id: string; text: string; authorUsername: string; igMediaId: string; hidden: boolean; deleted: boolean; replied: boolean; replyText: string | null; draftReply: string | null; done: boolean }
type Snippet = { id: string; title: string; body: string }

export function CommentsPage() {
  const session = useSession()
  const [comments, setComments] = useState<CommentRow[]>([])
  const [selected, setSelected] = useState<CommentRow | null>(null)
  const [filter, setFilter] = useState('')
  const [box, setBox] = useState<'open' | 'done'>('open')
  const [reply, setReply] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [saved, setSaved] = useState<Snippet[]>([])
  const [savedRows, setSavedRows] = useState<Snippet[]>([])
  const [savedPage, setSavedPage] = useState(1)
  const [savedTotal, setSavedTotal] = useState(0)
  const [editingSaved, setEditingSaved] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [savedBody, setSavedBody] = useState('')
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState('')
  const canModerate = roleHas(session.role as OrgRole, 'comments.moderate')
  const canReply = roleHas(session.role as OrgRole, 'comments.reply')
  async function load(next = page) {
    const params = new URLSearchParams({ state: box, page: String(next) })
    if (filter) params.set('igMediaId', filter)
    const body = await api<{ comments: CommentRow[]; page: number; total: number }>(`/api/comments?${params}`)
    if (!body.comments.length && body.page > 1) { setPage(body.page - 1); return }
    setComments(body.comments)
    setPage(body.page)
    setTotal(body.total)
  }
  function loadSavedList(next = savedPage) {
    return api<{ responses: Snippet[]; page: number; total: number }>(`/api/saved-responses?page=${next}`).then((body) => {
      if (!body.responses.length && body.page > 1) { setSavedPage(body.page - 1); return }
      setSavedRows(body.responses)
      setSavedPage(body.page)
      setSavedTotal(body.total)
    })
  }
  function loadSavedOptions() {
    return fetchAll<Snippet>('/api/saved-responses', 'responses').then(setSaved)
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [filter, box, page])
  useEffect(() => {
    fetchAll<CommentRow>(`/api/comments?state=${box}`, 'comments')
      .then((rows) => setMediaIds([...new Set(rows.map((comment) => comment.igMediaId).filter(Boolean))]))
      .catch(() => undefined)
  }, [box])
  useEffect(() => { loadSavedList(savedPage).catch(() => undefined) }, [savedPage])
  useEffect(() => {
    fetchAll<{ id: string; name: string }>('/api/members', 'members').then(setMembers).catch(() => undefined)
    loadSavedOptions().catch(() => undefined)
  }, [])
  return (
    <section className="stack">
      <h1>Comments</h1>
      <Notice error={error} notice="" />
      <div className="split">
        <div className="stack">
          <label>Show
            <Hint>Open comments still need a reply. Done comments are set aside.</Hint>
            <select value={box} onChange={(event) => { setPage(1); setBox(event.target.value as 'open' | 'done') }}>
              <option value="open">Open</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>Post
            <Hint>Limit the list to comments on one Instagram post.</Hint>
            <select value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value) }}>
              <option value="">All posts</option>
              {mediaIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          {comments.map((comment) => (
            <div className="stack" key={comment.id}>
              <button className="secondary" type="button" onClick={() => { setSelected(comment); setReply(comment.draftReply || comment.replyText || ''); setSuggestion('') }}>
                @{comment.authorUsername}: {comment.text}{comment.draftReply && !comment.replied ? ' · draft' : ''}
              </button>
              {canReply && comment.draftReply ? (
                <div className="row">
                  <button className="secondary" type="button" onClick={() => { setSelected(comment); setReply(comment.draftReply || ''); setSuggestion('') }}>Edit</button>
                  <button className="secondary" type="button" onClick={() => {
                    if (!confirmDelete('this comment draft')) return
                    void api(`/api/comments/${comment.id}/draft`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
                  }}>Delete</button>
                </div>
              ) : null}
            </div>
          ))}
          <Pager page={page} total={total} onPage={setPage} label="Comments" />
        </div>
        {selected ? (
          <div className="stack">
            <p>{selected.text}</p>
            {selected.draftReply && !selected.replied ? <p className="notice">Unsent draft from approved facts. You still send it.</p> : null}
            {suggestion ? <p className="notice">{suggestion}</p> : null}
            <button className="secondary" type="button" onClick={() => void api<{ text: string }>(`/api/comments/${selected.id}/suggest`, { method: 'POST' }).then((body) => { setSuggestion(body.text); setReply(body.text) }).catch((cause) => setError(messageOf(cause)))}>Suggest a reply</button>
            <label>Saved reply
              <Hint>Insert a snippet you saved. You still send the reply.</Hint>
              <select defaultValue="" onChange={(event) => { const found = saved.find((item) => item.id === event.target.value); if (found) setReply(found.body) }}>
                <option value="">Insert a saved reply</option>
                {saved.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label>Reply
              <Hint>The text to send, or to keep as an unsent draft.</Hint>
              <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} />
            </label>
            <div className="row">
              <button type="button" onClick={() => void api(`/api/comments/${selected.id}/reply`, { method: 'POST', body: JSON.stringify({ text: reply }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>Reply</button>
              {canReply ? <button className="secondary" type="button" onClick={() => void api<{ comment: CommentRow }>(`/api/comments/${selected.id}/draft`, { method: 'PATCH', body: JSON.stringify({ text: reply }) }).then((body) => { setSelected(body.comment); return load() }).catch((cause) => setError(messageOf(cause)))}>Save draft</button> : null}
              {canReply && selected.draftReply ? <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this comment draft')) return
                void api<{ comment: CommentRow }>(`/api/comments/${selected.id}/draft`, { method: 'DELETE' }).then((body) => { setSelected(body.comment); setReply(''); return load() }).catch((cause) => setError(messageOf(cause)))
              }}>Delete draft</button> : null}
              <button className="secondary" type="button" onClick={() => void api(`/api/comments/${selected.id}/done`, { method: 'POST', body: JSON.stringify({ done: !selected.done }) }).then(() => { setSelected({ ...selected, done: !selected.done }); return load() }).catch((cause) => setError(messageOf(cause)))}>{selected.done ? 'Reopen' : 'Mark done'}</button>
              <button className="secondary" type="button" onClick={() => void api(`/api/comments/${selected.id}/private-reply`, { method: 'POST', body: JSON.stringify({ text: reply }) }).catch((cause) => setError(messageOf(cause)))}>Private reply</button>
              {canModerate ? <button className="secondary" type="button" onClick={() => void api(`/api/comments/${selected.id}/hide`, { method: 'POST' }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>Hide</button> : null}
              {canModerate ? <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this comment on Instagram')) return
                void api(`/api/comments/${selected.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button> : null}
            </div>
            <label>Assign
              <Hint>Hand this comment to a teammate.</Hint>
              <select defaultValue="" onChange={(event) => { if (event.target.value) void api(`/api/comments/${selected.id}/assign`, { method: 'POST', body: JSON.stringify({ userId: event.target.value }) }) }}>
                <option value="">Choose a teammate</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
          </div>
        ) : <p>Select a comment.</p>}
      </div>
      <form className="stack card" onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        void api('/api/saved-responses', { method: 'POST', body: JSON.stringify({ title: data.get('title'), body: data.get('body') }) })
          .then(() => { form.reset(); return Promise.all([loadSavedList(), loadSavedOptions()]) })
          .catch((cause) => setError(messageOf(cause)))
      }}>
        <h2>Saved replies</h2>
        <p>Short snippets. Inserting one fills the reply box. A person still sends it.</p>
        <ul className="stack">{savedRows.map((item) => (
          <li key={item.id}>
            {editingSaved === item.id ? (
              <form className="stack" onSubmit={(event) => {
                event.preventDefault()
                void api(`/api/saved-responses/${item.id}`, { method: 'PATCH', body: JSON.stringify({ title: savedTitle, body: savedBody }) })
                  .then(() => { setEditingSaved(''); return Promise.all([loadSavedList(), loadSavedOptions()]) })
                  .catch((cause) => setError(messageOf(cause)))
              }}>
                <label>Title<Hint>A short name for this snippet.</Hint><input value={savedTitle} maxLength={120} onChange={(event) => setSavedTitle(event.target.value)} /></label>
                <label>Reply<Hint>The text inserted into the reply box. Sending stays a separate step.</Hint><textarea value={savedBody} maxLength={2000} rows={3} onChange={(event) => setSavedBody(event.target.value)} /></label>
                <button type="submit">Save</button>
              </form>
            ) : <span>{item.title}</span>}
            {canReply ? (
              <div className="row">
                <button className="secondary" type="button" onClick={() => { setEditingSaved(item.id); setSavedTitle(item.title); setSavedBody(item.body) }}>Edit</button>
                <button className="secondary" type="button" onClick={() => {
                  if (!confirmDelete('this saved reply')) return
                  void api(`/api/saved-responses/${item.id}`, { method: 'DELETE' }).then(() => Promise.all([loadSavedList(), loadSavedOptions()])).catch((cause) => setError(messageOf(cause)))
                }}>Delete</button>
              </div>
            ) : null}
          </li>
        ))}</ul>
        <Pager page={savedPage} total={savedTotal} onPage={setSavedPage} label="Saved replies" />
        <label>Title<Hint>A short name for this snippet.</Hint><input name="title" required maxLength={120} /></label>
        <label>Reply<Hint>The text inserted into the reply box. A person still sends it.</Hint><textarea name="body" required maxLength={2000} rows={3} /></label>
        <button type="submit">Save reply</button>
      </form>
    </section>
  )
}

type Conversation = { id: string; participantUsername: string; automationEnabled: boolean; done: boolean }
type Thread = {
  conversation: Conversation & { messages: Array<{ id: string; direction: string; body: string }> }
  send: { allowed: boolean; reason: string }
  messagesPage: number
  messagesTotal: number
}
type Rule = { id: string; name: string; kind: string; enabled: boolean; matchText?: string | null; approvedAnswer?: string | null }

export function MessagesPage() {
  const session = useSession()
  const [list, setList] = useState<Conversation[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [box, setBox] = useState<'open' | 'done'>('open')
  const [thread, setThread] = useState<Thread | null>(null)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Array<{ id: string; title: string; body: string }>>([])
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [rulesPage, setRulesPage] = useState(1)
  const [rulesTotal, setRulesTotal] = useState(0)
  const [editingRule, setEditingRule] = useState('')
  const [ruleDraft, setRuleDraft] = useState({ name: '', kind: 'faq_comment', matchText: '', approvedAnswer: '' })
  const [error, setError] = useState('')
  const canAutomate = roleHas(session.role as OrgRole, 'messages.automate') && session.package.automation
  async function open(id: string, messagesPage?: number) {
    const path = messagesPage ? `/api/conversations/${id}?messagesPage=${messagesPage}` : `/api/conversations/${id}`
    const body = await api<Thread>(path)
    setThread(body)
  }
  function loadList(next = page) {
    return api<{ conversations: Conversation[]; page: number; total: number }>(`/api/conversations?state=${box}&page=${next}`).then((body) => {
      if (!body.conversations.length && body.page > 1) { setPage(body.page - 1); return }
      setList(body.conversations)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  function loadRules(next = rulesPage) {
    return api<{ rules: Rule[]; page: number; total: number }>(`/api/automation/rules?page=${next}`).then((body) => {
      if (!body.rules.length && body.page > 1) { setRulesPage(body.page - 1); return }
      setRules(body.rules)
      setRulesPage(body.page)
      setRulesTotal(body.total)
    })
  }
  useEffect(() => { loadList(page).catch((cause) => setError(messageOf(cause))) }, [box, page])
  useEffect(() => {
    fetchAll<{ id: string; title: string; body: string }>('/api/saved-responses', 'responses').then(setSaved).catch(() => undefined)
    fetchAll<{ id: string; name: string }>('/api/members', 'members').then(setMembers).catch(() => undefined)
  }, [])
  useEffect(() => { if (canAutomate) loadRules(rulesPage).catch(() => undefined) }, [canAutomate, rulesPage])
  return (
    <section className="stack">
      <h1>Messages</h1>
      <Notice error={error} notice="" />
      <div className="split">
        <div className="stack">
          <label>Show
            <Hint>Open threads still need a reply. Done threads are set aside.</Hint>
            <select value={box} onChange={(event) => { setPage(1); setBox(event.target.value as 'open' | 'done') }}>
              <option value="open">Open</option>
              <option value="done">Done</option>
            </select>
          </label>
          {list.map((item) => <button className="secondary" type="button" key={item.id} onClick={() => void open(item.id).catch((cause) => setError(messageOf(cause)))}>@{item.participantUsername}</button>)}
          <Pager page={page} total={total} onPage={setPage} label="Messages" />
        </div>
        {thread ? (
          <div className="stack">
            <div className="thread">
              {thread.conversation.messages.map((item) => <p className={item.direction === 'outbound' ? 'bubble out' : 'bubble'} key={item.id}>{item.body}</p>)}
            </div>
            <Pager page={thread.messagesPage} total={thread.messagesTotal} onPage={(next) => void open(thread.conversation.id, next).catch((cause) => setError(messageOf(cause)))} label="Messages in this thread" />
            <button className="secondary" type="button" onClick={() => void api(`/api/conversations/${thread.conversation.id}/done`, { method: 'POST', body: JSON.stringify({ done: !thread.conversation.done }) }).then(() => loadList()).then(() => open(thread.conversation.id)).catch((cause) => setError(messageOf(cause)))}>{thread.conversation.done ? 'Reopen' : 'Mark done'}</button>
            <button className="secondary" type="button" onClick={() => void api<{ text: string }>(`/api/conversations/${thread.conversation.id}/suggest`, { method: 'POST' }).then((body) => setText(body.text)).catch((cause) => setError(messageOf(cause)))}>Draft a reply</button>
            <label>Saved response
              <Hint>Insert a saved snippet. You still send it.</Hint>
              <select defaultValue="" onChange={(event) => { const found = saved.find((item) => item.id === event.target.value); if (found) setText(found.body) }}>
                <option value="">Choose</option>
                {saved.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label>Message
              <Hint>The text to send in this thread.</Hint>
              <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} />
            </label>
            {thread.send.allowed ? (
              <button type="button" onClick={() => void api(`/api/conversations/${thread.conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ text }) }).then(() => open(thread.conversation.id)).catch((cause) => setError(messageOf(cause)))}>Send</button>
            ) : (
              <div className="stack">
                <p>{thread.send.reason}</p>
                <label>Assign instead
                  <Hint>Hand this thread to a teammate when you cannot send.</Hint>
                  <select defaultValue="" onChange={(event) => { if (event.target.value) void api(`/api/conversations/${thread.conversation.id}/assign`, { method: 'POST', body: JSON.stringify({ userId: event.target.value }) }) }}>
                    <option value="">Choose a teammate</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            {canAutomate ? (
              <label>Automation for this thread
                <Hint>Allow the approved rules to answer this thread.</Hint>
                <input type="checkbox" checked={thread.conversation.automationEnabled} onChange={(event) => void api(`/api/conversations/${thread.conversation.id}/automation`, { method: 'PATCH', body: JSON.stringify({ enabled: event.target.checked }) }).then(() => open(thread.conversation.id))} />
              </label>
            ) : null}
          </div>
        ) : <p>Select a conversation.</p>}
      </div>
      {canAutomate ? (
        <form className="stack card" onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void api('/api/automation/rules', {
            method: 'POST',
            body: JSON.stringify({ name: form.get('name'), kind: form.get('kind'), matchText: form.get('matchText'), approvedAnswer: form.get('approvedAnswer'), enabled: true }),
          }).then(() => loadRules()).catch((cause) => setError(messageOf(cause)))
        }}>
          <h2>Automation rules</h2>
          <ul className="stack">{rules.map((rule) => (
            <li key={rule.id}>
              {editingRule === rule.id ? (
                <form className="stack" onSubmit={(event) => {
                  event.preventDefault()
                  void api(`/api/automation/rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(ruleDraft) })
                    .then(() => { setEditingRule(''); return loadRules() })
                    .catch((cause) => setError(messageOf(cause)))
                }}>
                  <label>Name<Hint>A name you will recognize in the list.</Hint><input value={ruleDraft.name} onChange={(event) => setRuleDraft({ ...ruleDraft, name: event.target.value })} required /></label>
                  <label>Kind
                    <Hint>What this rule watches for.</Hint>
                    <select value={ruleDraft.kind} onChange={(event) => setRuleDraft({ ...ruleDraft, kind: event.target.value })}>
                      <option value="faq_comment">FAQ comment</option>
                      <option value="business_hours_dm">Business-hours message</option>
                      <option value="human_request">Ask for a person</option>
                      <option value="complaint">Complaint</option>
                      <option value="scheduled_publish">Scheduled publish</option>
                    </select>
                  </label>
                  <label>Match<Hint>Text that should trigger the rule. Leave blank to use the kind only.</Hint><input value={ruleDraft.matchText} onChange={(event) => setRuleDraft({ ...ruleDraft, matchText: event.target.value })} /></label>
                  <label>Approved answer<Hint>The reply the rule may send. Approval of the answer stays with you.</Hint><textarea value={ruleDraft.approvedAnswer} onChange={(event) => setRuleDraft({ ...ruleDraft, approvedAnswer: event.target.value })} /></label>
                  <button type="submit">Save</button>
                </form>
              ) : <span>{rule.name} · {rule.kind} · {rule.enabled ? 'on' : 'off'}</span>}
              <div className="row">
                <button className="secondary" type="button" onClick={() => { setEditingRule(rule.id); setRuleDraft({ name: rule.name, kind: rule.kind, matchText: rule.matchText ?? '', approvedAnswer: rule.approvedAnswer ?? '' }) }}>Edit</button>
                <button className="secondary" type="button" onClick={() => {
                  if (!confirmDelete('this automation rule')) return
                  void api(`/api/automation/rules/${rule.id}`, { method: 'DELETE' }).then(() => loadRules()).catch((cause) => setError(messageOf(cause)))
                }}>Delete</button>
              </div>
            </li>
          ))}</ul>
          <Pager page={rulesPage} total={rulesTotal} onPage={setRulesPage} label="Automation rules" />
          <label>Name<Hint>A name you will recognize in the list.</Hint><input name="name" required /></label>
          <label>Kind
            <Hint>What this rule watches for.</Hint>
            <select name="kind">
              <option value="faq_comment">FAQ comment</option>
              <option value="business_hours_dm">Business-hours message</option>
              <option value="human_request">Ask for a person</option>
              <option value="complaint">Complaint</option>
              <option value="scheduled_publish">Scheduled publish</option>
            </select>
          </label>
          <label>Match<Hint>Text that should trigger the rule. Leave blank to use the kind only.</Hint><input name="matchText" /></label>
          <label>Approved answer<Hint>The reply the rule may send. A person still approves the answer.</Hint><textarea name="approvedAnswer" /></label>
          <button type="submit">Add rule</button>
        </form>
      ) : null}
    </section>
  )
}

type ReportRow = {
  id: string
  metric: string
  value: number
  capturedAt: string
  dimensions: unknown
}

function storedMetricLines(dimensions: unknown): string[] {
  if (!dimensions || typeof dimensions !== 'object') return []
  const record = dimensions as Record<string, unknown>
  const lines: string[] = []
  if (Array.isArray(record.followers)) {
    for (const item of record.followers) {
      if (!item || typeof item !== 'object') continue
      const date = (item as { date?: unknown }).date
      const value = (item as { value?: unknown }).value
      if (typeof date === 'string' && typeof value === 'number') lines.push(`Followers ${date}: ${value}`)
    }
  }
  if (record.byFormat && typeof record.byFormat === 'object') {
    for (const [format, stats] of Object.entries(record.byFormat as Record<string, unknown>)) {
      if (!stats || typeof stats !== 'object') continue
      const row = stats as Record<string, unknown>
      const parts = ['posts', 'saves', 'reach', 'comments'].flatMap((key) => typeof row[key] === 'number' ? [`${key} ${row[key]}`] : [])
      if (parts.length) lines.push(`${format}: ${parts.join(', ')}`)
    }
  }
  if (Array.isArray(record.hours)) {
    for (const item of record.hours) {
      if (!item || typeof item !== 'object') continue
      const hour = (item as { hour?: unknown }).hour
      const value = (item as { value?: unknown }).value
      if (typeof hour === 'number' && typeof value === 'number') lines.push(`Online at ${hour}:00: ${value}`)
    }
  }
  return lines
}

export function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 8)}01`
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [charts, setCharts] = useState<{ reach: Array<{ date: string; value: number }>; engagement: Array<{ date: string; value: number }>; formatMix: Array<{ name: string; value: number }> }>({
    reach: [],
    engagement: [],
    formatMix: [],
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  function load(start: string, end: string, next = page) {
    return api<{ rows: ReportRow[]; page: number; total: number; charts?: typeof charts }>(`/api/reports?from=${start}&to=${end}&page=${next}`)
      .then((body) => {
        setRows(body.rows)
        setPage(body.page)
        setTotal(body.total)
        setCharts(body.charts ?? { reach: [], engagement: [], formatMix: [] })
      })
      .catch((cause) => setError(messageOf(cause)))
  }
  useEffect(() => { void load(from, to, page) }, [from, to, page])
  return (
    <section className="stack">
      <h1>Reports</h1>
      <p>Stored official metrics for the dates you choose. A day with no snapshot stays blank.</p>
      <Notice error={error} notice="" />
      <form className="row" onSubmit={(event) => { event.preventDefault(); setError(''); setPage(1) }}>
        <label>From<Hint>The first day to include.</Hint><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<Hint>The last day to include.</Hint><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="submit">Show report</button>
      </form>
      <DoughnutMetricsChart title="Format mix" slices={charts.formatMix} />
      {rows && rows.length === 0 ? <p>No stored official metrics in this range.</p> : null}
      <div className="cards">
        {rows?.map((row) => (
          <article className="card" key={row.id}>
            <span>{row.metric}</span>
            <strong>{row.value}</strong>
            <p>{row.capturedAt}</p>
            {storedMetricLines(row.dimensions).map((line, index) => <p key={`${row.id}-${index}`}>{line}</p>)}
          </article>
        ))}
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Report rows" />
    </section>
  )
}

export function SmartLinksPage() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [posts, setPosts] = useState<PostRecord[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  function load(next = page) {
    return api<{ posts: PostRecord[]; page: number; total: number }>(`/api/posts?smartLink=1&page=${next}`).then((body) => {
      if (!body.posts.length && body.page > 1) { setPage(body.page - 1); return }
      setPosts(body.posts)
      setPage(body.page)
      setTotal(body.total)
      setDrafts(Object.fromEntries(body.posts.map((post) => [post.id, post.smartLinkUrl ?? ''])))
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack">
      <h1>Smart Links</h1>
      <p>Each post keeps one link. Opening the public address adds one to the click count, then continues to the URL.</p>
      <Notice error={error} notice={notice} />
      {posts.length === 0 ? <p>No tracked link yet. Add one on Create.</p> : null}
      {posts.map((post) => (
        <article className="card stack" key={post.id}>
          <strong>{post.caption || post.description || 'Untitled'}</strong>
          <p>{post.smartLinkClicks ?? 0} clicks</p>
          {post.smartLinkPath ? <p><a href={post.smartLinkPath}>{post.smartLinkPath}</a></p> : null}
          {editing === post.id ? (
            <label>URL
              <Hint>An http or https address. Saving replaces the tracked destination.</Hint>
              <input value={drafts[post.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [post.id]: event.target.value }))} />
            </label>
          ) : <p>{post.smartLinkUrl}</p>}
          <div className="row">
            {canWrite ? <button className="secondary" type="button" onClick={() => setEditing(post.id)}>Edit</button> : null}
            {canWrite && editing === post.id ? <button type="button" onClick={() => void api(`/api/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ smartLinkUrl: (drafts[post.id] ?? '').trim() || null }) }).then(() => { setNotice('Link saved'); setEditing(''); return load() }).catch((cause) => setError(messageOf(cause)))}>Save link</button> : null}
            {canWrite ? <button className="secondary" type="button" onClick={() => {
              if (!confirmDelete('this smart link')) return
              void api(`/api/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ smartLinkUrl: null }) }).then(() => { setNotice('Link removed'); return load() }).catch((cause) => setError(messageOf(cause)))
            }}>Delete</button> : null}
            <Link to={`/app/create?post=${post.id}`}>Open draft</Link>
          </div>
        </article>
      ))}
      <Pager page={page} total={total} onPage={setPage} label="Smart links" />
    </section>
  )
}

export function AdsPage() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [posts, setPosts] = useState<PostRecord[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  function load(next = page) {
    return api<{ posts: PostRecord[]; page: number; total: number }>(`/api/posts?ad=1&page=${next}`).then((body) => {
      if (!body.posts.length && body.page > 1) { setPage(body.page - 1); return }
      setPosts(body.posts)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack">
      <h1>Ads</h1>
      <p>Posts marked as an ad creative for Facebook, Instagram, TikTok, or YouTube. Nothing on this page buys an ad.</p>
      <Notice error={error} notice="" />
      {posts.length === 0 ? <p>No ad creative yet. Mark one on Create.</p> : null}
      {posts.map((post) => (
        <article className="card stack" key={post.id}>
          <strong>{post.caption || post.description || 'Untitled'}</strong>
          <p>Ad creative for {(post.adNetworks ?? []).map((network) => NETWORK_LABEL[network]).join(', ')}.</p>
          <div className="row">
            {canWrite ? <Link to={`/app/create?post=${post.id}`}>Edit</Link> : <Link to={`/app/create?post=${post.id}`}>Open draft</Link>}
            {canWrite && post.status !== 'PUBLISHED' && post.status !== 'PUBLISHING' ? (
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this post')) return
                void api(`/api/posts/${post.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            ) : null}
          </div>
        </article>
      ))}
      <Pager page={page} total={total} onPage={setPage} label="Ad creatives" />
    </section>
  )
}

export function InsightsPage() {
  const [data, setData] = useState<{
    followers: { available: boolean; series: Array<{ date: string; value: number }> }
    engagementByFormat: Record<string, { posts: number; saves: number; reach: number; comments: number }>
    responseTimes: { averageMinutes: number | null; sample: number }
    awaitingApproval: number
    publishingFailures: number
    quota: { text: { used: number; limit: number }; image: { used: number; limit: number }; video: { used: number; limit: number } }
    recommendation: { text: string }
    charts?: { reach: Array<{ date: string; value: number }>; engagement: Array<{ date: string; value: number }> }
  } | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  useEffect(() => { api<NonNullable<typeof data>>('/api/insights').then(setData).catch((cause) => setError(messageOf(cause))) }, [])
  const formats = data ? Object.entries(data.engagementByFormat) : []
  const visibleFormats = formats.slice((page - 1) * 20, page * 20)
  return (
    <section className="stack">
      <h1>Insights</h1>
      <Notice error={error} notice="" />
      {data ? (
        <>
          <p>{data.followers.available ? `Followers: ${data.followers.series.map((point) => `${point.date} ${point.value}`).join(', ')}` : 'Follower trend is not available for this account.'}</p>
          <LineMetricsChart
            title="Reach and engagement"
            series={[
              { label: 'Reach', points: data.charts?.reach ?? [], color: '#2f6fed' },
              { label: 'Engagement', points: data.charts?.engagement ?? [], color: '#d6b25e' },
            ]}
          />
          <div className="cards">
            {visibleFormats.map(([format, stats]) => (
              <article className="card" key={format}><h2>{format}</h2><p>{stats.posts} posts · {stats.saves} saves · {stats.reach} reach · {stats.comments} comments</p></article>
            ))}
          </div>
          <Pager page={page} total={formats.length} onPage={setPage} label="Insight rows" />
          <p>Average reply time: {data.responseTimes.averageMinutes === null ? 'no replies yet' : `${data.responseTimes.averageMinutes} minutes`} ({data.responseTimes.sample} samples)</p>
          <p>Awaiting approval: {data.awaitingApproval}. Publishing failures: {data.publishingFailures}.</p>
          <p>Quota — text {data.quota.text.used}/{data.quota.text.limit}, photos {data.quota.image.used}/{data.quota.image.limit}, videos {data.quota.video.used}/{data.quota.video.limit}.</p>
          <p>{data.recommendation.text}</p>
        </>
      ) : null}
    </section>
  )
}

const SETTINGS = [
  ['brand', 'Brand'],
  ['kit', 'Brand kit'],
  ['ai', 'Custom AI'],
  ['categories', 'Categories'],
  ['team', 'Team'],
  ['billing', 'Billing'],
  ['instagram', 'Accounts'],
] as const

export function SettingsLayout() {
  return (
    <section className="stack">
      <h1>Settings</h1>
      <nav className="row settings-links">{SETTINGS.map(([path, label]) => <Link key={path} to={path}>{label}</Link>)}</nav>
      <Outlet />
    </section>
  )
}

export function BrandSettings() {
  const [brand, setBrand] = useState({ brandName: '', businessDescription: '', targetAudience: '', voiceAndTone: '', productsAndServices: '', approvedFacts: '', topicsToAvoid: '', preferredLanguage: 'en' })
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ brand: { brandName: string; businessDescription: string; targetAudience: string; voiceAndTone: string; productsAndServices: string; approvedFacts: string[]; topicsToAvoid: string; preferredLanguage: string } | null }>('/api/brand').then((body) => {
      if (!body.brand) return
      setBrand({
        brandName: body.brand.brandName,
        businessDescription: body.brand.businessDescription,
        targetAudience: body.brand.targetAudience,
        voiceAndTone: body.brand.voiceAndTone,
        productsAndServices: body.brand.productsAndServices,
        approvedFacts: body.brand.approvedFacts.join('\n'),
        topicsToAvoid: body.brand.topicsToAvoid,
        preferredLanguage: body.brand.preferredLanguage,
      })
    }).catch((cause) => setError(messageOf(cause)))
  }, [])
  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await api('/api/brand', { method: 'PUT', body: JSON.stringify({ ...brand, approvedFacts: brand.approvedFacts.split('\n').map((line) => line.trim()).filter(Boolean) }) })
    } catch (cause) {
      setError(messageOf(cause))
    }
  }
  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <Notice error={error} notice="" />
      {([
        ['brandName', 'Brand name', 'The name customers should recognize.'],
        ['businessDescription', 'Business description', 'What the business does, in a few sentences.'],
        ['targetAudience', 'Target audience', 'Who the posts are for.'],
        ['voiceAndTone', 'Voice and tone', 'How the writing should sound.'],
        ['productsAndServices', 'Products and services', 'What you offer.'],
        ['topicsToAvoid', 'Topics to avoid', 'Subjects the drafts should leave out.'],
        ['preferredLanguage', 'Preferred language', 'A language code such as en.'],
      ] as const).map(([key, label, hint]) => (
        <label key={key}>{label}<Hint>{hint}</Hint><input value={brand[key]} onChange={(event) => setBrand({ ...brand, [key]: event.target.value })} /></label>
      ))}
      <label>Approved facts<Hint>One fact per line. Drafts can use these without extra review.</Hint><textarea value={brand.approvedFacts} onChange={(event) => setBrand({ ...brand, approvedFacts: event.target.value })} rows={5} /></label>
      <button type="submit">Save brand</button>
    </form>
  )
}

export function BrandKitSettings() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [color, setColor] = useState('')
  const [tags, setTags] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    api<{ logoUrl: string | null; primaryColor: string | null; hashtags: string[] }>('/api/brand-kit').then((body) => {
      setColor(body.primaryColor ?? '')
      setTags(body.hashtags.join('\n'))
      setLogoUrl(body.logoUrl)
    }).catch((cause) => setError(messageOf(cause)))
  }, [])
  return (
    <form className="stack" onSubmit={(event) => {
      event.preventDefault()
      const hashtags = tags.split('\n').map((line) => line.trim()).filter(Boolean)
      void api('/api/brand-kit', { method: 'PUT', body: JSON.stringify({ primaryColor: color.trim() || null, hashtags }) })
        .then(() => setNotice('Brand kit saved'))
        .catch((cause) => setError(messageOf(cause)))
    }}>
      <h2>Brand kit</h2>
      <Notice error={error} notice={notice} />
      <p>Logo, one primary color, and hashtags for this organization. The designed video ad uses the logo and color. Create can insert the hashtags.</p>
      {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: 96, height: 96, objectFit: 'contain', background: '#101218', borderRadius: 12 }} /> : <p>No logo yet.</p>}
      <label>Logo
        <Hint>PNG, JPEG, or WebP. The video ad uses this logo.</Hint>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          const body = new FormData()
          body.append('file', file)
          void api<{ logoUrl: string | null }>('/api/brand-kit/logo', { method: 'POST', body }).then((result) => {
            setLogoUrl(result.logoUrl)
            setNotice('Logo saved')
          }).catch((cause) => setError(messageOf(cause)))
        }} />
      </label>
      <label>Primary color
        <Hint>One color as #RRGGBB, such as #312e81.</Hint>
        <input value={color} onChange={(event) => setColor(event.target.value)} placeholder="#312e81" maxLength={7} />
      </label>
      {color ? <span className="chip" style={{ background: color }}> </span> : null}
      <label>Hashtags<Hint>One hashtag per line. Create can insert these.</Hint><textarea value={tags} onChange={(event) => setTags(event.target.value)} rows={5} placeholder="One hashtag per line" /></label>
      <div className="row">
        <button type="submit">Save brand kit</button>
        {canWrite ? <button className="secondary" type="button" onClick={() => {
          if (!confirmDelete('this brand kit')) return
          void api<{ logoUrl: string | null; primaryColor: string | null; hashtags: string[] }>('/api/brand-kit', { method: 'DELETE' }).then((body) => {
            setColor(body.primaryColor ?? '')
            setTags(body.hashtags.join('\n'))
            setLogoUrl(body.logoUrl)
            setNotice('Brand kit deleted')
          }).catch((cause) => setError(messageOf(cause)))
        }}>Delete</button> : null}
      </div>
    </form>
  )
}

export function CustomAiSettings() {
  const session = useSession()
  const [profile, setProfile] = useState<{ customizable: boolean; requiredPackage: string; modelId: string; hasCustomerKey: boolean; instructions: string; allowedModels: string[] } | null>(null)
  const [instructions, setInstructions] = useState('')
  const [modelId, setModelId] = useState('')
  const [providerKey, setProviderKey] = useState('')
  const [tone, setTone] = useState('')
  const [language, setLanguage] = useState('')
  const [knowledge, setKnowledge] = useState<Array<{ id: string; title: string; body: string; approved: boolean }>>([])
  const [knowledgePage, setKnowledgePage] = useState(1)
  const [knowledgeTotal, setKnowledgeTotal] = useState(0)
  const [editingKnowledge, setEditingKnowledge] = useState('')
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeBody, setKnowledgeBody] = useState('')
  const [error, setError] = useState('')
  const unlocked = Boolean(profile?.customizable && session.package.customAi && roleHas(session.role as OrgRole, 'ai.customize'))
  function loadKnowledge(next = knowledgePage) {
    return api<{ knowledge: typeof knowledge; page: number; total: number }>(`/api/ai/knowledge?page=${next}`).then((body) => {
      if (!body.knowledge.length && body.page > 1) { setKnowledgePage(body.page - 1); return }
      setKnowledge(body.knowledge)
      setKnowledgePage(body.page)
      setKnowledgeTotal(body.total)
    })
  }
  useEffect(() => {
    api<NonNullable<typeof profile> & { tone?: string; language?: string }>('/api/ai/profile').then((body) => {
      setProfile(body)
      setInstructions(body.instructions)
      setModelId(body.modelId)
      setTone(body.tone ?? '')
      setLanguage(body.language ?? '')
    }).catch((cause) => setError(messageOf(cause)))
  }, [])
  useEffect(() => { loadKnowledge(knowledgePage).catch(() => undefined) }, [knowledgePage])
  return (
    <div className="stack">
      <Notice error={error} notice="" />
      <p>{profile?.customizable ? 'Custom AI is available on this organization.' : `Custom AI is locked. ${profile?.requiredPackage ?? 'Pro'} unlocks your own instructions and key.`}</p>
      <fieldset disabled={!unlocked} className="stack">
        <label>Instructions<Hint>Standing directions for drafts, up to 8000 characters.</Hint><textarea value={instructions} maxLength={8000} onChange={(event) => setInstructions(event.target.value)} rows={5} /></label>
        <label>Tone<Hint>How the writing should sound, up to 500 characters.</Hint><input value={tone} maxLength={500} onChange={(event) => setTone(event.target.value)} /></label>
        <label>Language<Hint>The language drafts should use, up to 500 characters.</Hint><input value={language} maxLength={500} onChange={(event) => setLanguage(event.target.value)} /></label>
        <label>Model
          <Hint>Which allowed model writes for this organization.</Hint>
          <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
            {(profile?.allowedModels ?? []).map((model) => <option key={model}>{model}</option>)}
          </select>
        </label>
        <label>Your model key<Hint>Optional key stored for your model. Leave blank to keep the saved key.</Hint><input value={providerKey} onChange={(event) => setProviderKey(event.target.value)} type="password" placeholder={profile?.hasCustomerKey ? 'A key is stored' : 'Optional'} /></label>
        <button type="button" onClick={() => void api('/api/ai/profile', { method: 'PUT', body: JSON.stringify({ instructions, modelId, tone, language, ...(providerKey ? { providerKey } : {}) }) }).catch((cause) => setError(messageOf(cause)))}>Save custom AI</button>
      </fieldset>
      <h2>Knowledge</h2>
      <ul className="stack">{knowledge.map((item) => (
        <li key={item.id}>
          {editingKnowledge === item.id ? (
            <form className="stack" onSubmit={(event) => {
              event.preventDefault()
              void api(`/api/ai/knowledge/${item.id}`, { method: 'PATCH', body: JSON.stringify({ title: knowledgeTitle, body: knowledgeBody }) })
                .then(() => { setEditingKnowledge(''); return loadKnowledge() })
                .catch((cause) => setError(messageOf(cause)))
            }}>
              <label>Title<Hint>A short name for this fact.</Hint><input value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} required /></label>
              <label>Fact<Hint>The fact drafts may use after it is approved.</Hint><textarea value={knowledgeBody} onChange={(event) => setKnowledgeBody(event.target.value)} required /></label>
              <button type="submit">Save</button>
            </form>
          ) : <span>{item.title} · {item.approved ? 'approved' : 'pending'}</span>}
          <div className="row">
            {unlocked && !item.approved ? <button type="button" onClick={() => void api(`/api/ai/knowledge/${item.id}/approve`, { method: 'POST' }).then(() => loadKnowledge())}>Approve</button> : null}
            {unlocked ? <button className="secondary" type="button" onClick={() => { setEditingKnowledge(item.id); setKnowledgeTitle(item.title); setKnowledgeBody(item.body) }}>Edit</button> : null}
            {unlocked ? <button className="secondary" type="button" onClick={() => {
              if (!confirmDelete('this fact')) return
              void api(`/api/ai/knowledge/${item.id}`, { method: 'DELETE' }).then(() => loadKnowledge()).catch((cause) => setError(messageOf(cause)))
            }}>Delete</button> : null}
          </div>
        </li>
      ))}</ul>
      <Pager page={knowledgePage} total={knowledgeTotal} onPage={setKnowledgePage} label="Knowledge" />
      {unlocked ? (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          void api('/api/ai/knowledge', { method: 'POST', body: JSON.stringify({ title: data.get('title'), body: data.get('body') }) }).then(() => { form.reset(); return loadKnowledge() }).catch((cause) => setError(messageOf(cause)))
        }}>
          <label>Title<Hint>A short name for this fact.</Hint><input name="title" required /></label>
          <label>Fact<Hint>What drafts may say. It stays pending until you approve it.</Hint><textarea name="body" required /></label>
          <button type="submit">Add knowledge</button>
        </form>
      ) : null}
    </div>
  )
}

export function CategoriesSettings() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [categories, setCategories] = useState<Array<{ id: string; name: string; styleNotes: string; defaultFormat: string }>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState({ name: '', styleNotes: '', defaultFormat: 'photo' })
  const [error, setError] = useState('')
  function load(next = page) {
    return api<{ categories: typeof categories; page: number; total: number }>(`/api/categories?page=${next}`).then((body) => {
      if (!body.categories.length && body.page > 1) { setPage(body.page - 1); return }
      setCategories(body.categories)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <div className="stack">
      <Notice error={error} notice="" />
      <ul className="stack">{categories.map((category) => (
        <li key={category.id}>
          {editing === category.id ? (
            <form className="stack" onSubmit={(event) => {
              event.preventDefault()
              void api(`/api/categories/${category.id}`, { method: 'PATCH', body: JSON.stringify(draft) })
                .then(() => { setEditing(''); return load() })
                .catch((cause) => setError(messageOf(cause)))
            }}>
              <label>Name<Hint>The category name shown on Create.</Hint><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
              <label>Style notes<Hint>How posts in this category should look or sound.</Hint><input value={draft.styleNotes} onChange={(event) => setDraft({ ...draft, styleNotes: event.target.value })} /></label>
              <label>Default format
                <Hint>The format Create selects for this category.</Hint>
                <select value={draft.defaultFormat} onChange={(event) => setDraft({ ...draft, defaultFormat: event.target.value })}><option value="photo">Photo</option><option value="carousel">Carousel</option><option value="reel">Reel</option><option value="video">Video</option><option value="story">Story</option></select>
              </label>
              <button type="submit">Save</button>
            </form>
          ) : <span>{category.name} · {category.defaultFormat}</span>}
          {canWrite ? (
            <div className="row">
              <button className="secondary" type="button" onClick={() => { setEditing(category.id); setDraft({ name: category.name, styleNotes: category.styleNotes, defaultFormat: category.defaultFormat }) }}>Edit</button>
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this category')) return
                void api(`/api/categories/${category.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          ) : null}
        </li>
      ))}</ul>
      <Pager page={page} total={total} onPage={setPage} label="Categories" />
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        void api('/api/categories', { method: 'POST', body: JSON.stringify({ name: data.get('name'), styleNotes: data.get('styleNotes'), defaultFormat: data.get('defaultFormat') }) }).then(() => { form.reset(); return load() }).catch((cause) => setError(messageOf(cause)))
      }}>
        <label>Name<Hint>The category name shown on Create.</Hint><input name="name" required /></label>
        <label>Style notes<Hint>How posts in this category should look or sound.</Hint><input name="styleNotes" /></label>
        <label>Default format
          <Hint>The format Create selects for this category.</Hint>
          <select name="defaultFormat"><option value="photo">Photo</option><option value="carousel">Carousel</option><option value="reel">Reel</option><option value="video">Video</option><option value="story">Story</option></select>
        </label>
        <button type="submit">Add category</button>
      </form>
    </div>
  )
}

export function TeamSettings() {
  const session = useSession()
  const canManage = roleHas(session.role as OrgRole, 'members.manage')
  const [members, setMembers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState('')
  function load(next = page) {
    return api<{ members: typeof members; page: number; total: number }>(`/api/members?page=${next}`).then((body) => {
      if (!body.members.length && body.page > 1) { setPage(body.page - 1); return }
      setMembers(body.members)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <div className="stack">
      <Notice error={error} notice={invite} />
      <ul className="stack">{members.map((member) => (
        <li key={member.id}>{member.name} · {member.email} · {member.role}
          {canManage && member.role !== 'OWNER' ? (
            <label>Edit role
              <Hint>What this teammate can change. The owner role stays with the owner.</Hint>
              <select value={member.role} onChange={(event) => void api(`/api/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }).then(() => load())}>
                <option>ADMIN</option><option>EDITOR</option><option>SUPPORT</option>
              </select>
            </label>
          ) : null}
          {canManage && member.role !== 'OWNER' ? (
            <div className="row">
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this teammate')) return
                void api(`/api/members/${member.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          ) : null}
        </li>
      ))}</ul>
      <Pager page={page} total={total} onPage={setPage} label="Team" />
      <form className="row" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void api<{ token?: string }>('/api/invitations', { method: 'POST', body: JSON.stringify({ email: form.get('email'), role: form.get('role') }) })
          .then((body) => setInvite(body.token ? `Invitation token: ${body.token}` : 'Invitation sent'))
          .catch((cause) => setError(messageOf(cause)))
      }}>
        <label>Email<Hint>Where the invitation is sent.</Hint><input name="email" type="email" required placeholder="Email" /></label>
        <label>Role
          <Hint>The access the new teammate starts with.</Hint>
          <select name="role"><option>ADMIN</option><option>EDITOR</option><option>SUPPORT</option></select>
        </label>
        <button type="submit">Invite</button>
      </form>
    </div>
  )
}

export function BillingSettings() {
  const [billing, setBilling] = useState<{ package: PackageInfo; status: string; usage: { text: number; image: number; video: number }; devAssign: boolean; currentPeriodEnd: string } | null>(null)
  const [error, setError] = useState('')
  function load() { return api<NonNullable<typeof billing>>('/api/billing').then(setBilling) }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  return (
    <div className="stack">
      <Notice error={error} notice="" />
      {billing ? (
        <>
          <p>{billing.package.name} · {billing.status} · renews {new Date(billing.currentPeriodEnd).toLocaleDateString()}</p>
          <p>Used this period: {billing.usage.text} text, {billing.usage.image} photos, {billing.usage.video} videos.</p>
          <div className="row">
            {(['starter', 'growth', 'pro'] as const).map((id) => (
              <button key={id} className="secondary" type="button" onClick={() => void api<{ url?: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ packageId: id }) }).then((body) => { if (body.url) window.location.href = body.url }).catch((cause) => setError(messageOf(cause)))}>Checkout {id}</button>
            ))}
            <button className="secondary" type="button" onClick={() => void api<{ url: string }>('/api/billing/portal', { method: 'POST' }).then((body) => { window.location.href = body.url }).catch((cause) => setError(messageOf(cause)))}>Billing portal</button>
          </div>
          {billing.devAssign ? (
            <div className="row">
              {(['starter', 'growth', 'pro'] as const).map((id) => (
                <button key={id} type="button" onClick={() => void api('/api/billing/dev/assign', { method: 'POST', body: JSON.stringify({ packageId: id }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>Assign {id}</button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function InstagramSettings() {
  const session = useSession()
  const canConnect = roleHas(session.role as OrgRole, 'instagram.connect')
  const [social, setSocial] = useState<SocialAccountInfo[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  function loadSocial(next = page) {
    return api<{ accounts: SocialAccountInfo[]; page: number; total: number }>(`/api/social/accounts?page=${next}`).then((body) => {
      if (!body.accounts.length && body.page > 1) { setPage(body.page - 1); return }
      setSocial(body.accounts)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { loadSocial(page).catch((cause) => setError(messageOf(cause))) }, [page])
  function connect(network: SocialNetwork | 'instagram') {
    const path = network === 'instagram' ? '/api/integrations/instagram/connect' : `/api/integrations/${network}/connect`
    void api<{ authorizeUrl: string }>(path).then((body) => { window.location.href = body.authorizeUrl }).catch((cause) => setError(messageOf(cause)))
  }
  return (
    <div className="stack">
      <h2>Accounts</h2>
      <Notice error={error} notice="" />
      <p>Connect Instagram, a Facebook Page, TikTok, or YouTube with that network’s official login. Tokens stay encrypted.</p>
      <ul className="stack">{social.map((account) => (
        <li key={account.id}>{networkLabel(account.network)} · {account.username || account.displayName} · {account.status} {account.lastError ? `· ${account.lastError}` : ''}
          {canConnect ? (
            <div className="row">
              <button className="secondary" type="button" onClick={() => {
                const path = account.network === 'instagram'
                  ? `/api/integrations/instagram/connect?accountId=${encodeURIComponent(account.instagramAccountId ?? account.id)}`
                  : `/api/integrations/${account.network}/connect?accountId=${encodeURIComponent(account.id)}`
                void api<{ authorizeUrl: string }>(path).then((body) => { window.location.href = body.authorizeUrl }).catch((cause) => setError(messageOf(cause)))
              }}>Edit</button>
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this connected account')) return
                void api(`/api/social/accounts/${account.id}`, { method: 'DELETE' }).then(() => loadSocial()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          ) : null}
        </li>
      ))}</ul>
      <Pager page={page} total={total} onPage={setPage} label="Accounts" />
      <div className="connect-actions">
        <button type="button" onClick={() => connect('instagram')}>Connect Instagram</button>
        <button type="button" onClick={() => connect('facebook')}>Connect Facebook</button>
        <button type="button" onClick={() => connect('tiktok')}>Connect TikTok</button>
        <button type="button" onClick={() => connect('youtube')}>Connect YouTube</button>
      </div>
      <p>{session.accounts.filter((account) => account.status === 'connected' || account.status === 'expired').length} of {session.package.instagramAccounts} Instagram accounts used.</p>
    </div>
  )
}
