import { FormEvent, useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { composePublishCaption, roleHas, zonedDay, type HashtagChip, type OrgRole } from '@instagram-ai/shared'
import { api } from '../lib/api'
import type { AccountInfo, Claim, PackageInfo, PostRecord } from '../lib/types'
import { useSession } from './shell'

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

export function DashboardPage() {
  const [counts, setCounts] = useState<{ scheduledPosts: number; awaitingApproval: number; unansweredComments: number; aiQuota: { used: number; limit: number }; publishingErrors: Array<{ id: string; publishError: string | null }> } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<NonNullable<typeof counts>>('/api/dashboard').then(setCounts).catch((cause) => setError(messageOf(cause)))
  }, [])
  return (
    <section className="stack">
      <h1>Dashboard</h1>
      <Notice error={error} notice="" />
      {counts ? (
        <div className="cards">
          <article className="card"><span>Scheduled</span><strong>{counts.scheduledPosts}</strong></article>
          <article className="card"><span>Awaiting approval</span><strong>{counts.awaitingApproval}</strong></article>
          <article className="card"><span>Unanswered comments</span><strong>{counts.unansweredComments}</strong></article>
          <article className="card"><span>Text quota used</span><strong>{counts.aiQuota.used}/{counts.aiQuota.limit}</strong></article>
        </div>
      ) : null}
      <h2>Publishing errors</h2>
      <ul>{counts?.publishingErrors.map((item) => <li key={item.id}>{item.publishError || 'Publish failed'}</li>)}</ul>
    </section>
  )
}

type Job = { id: string; status: string; error: string | null } | null

export function CreatePage() {
  const session = useSession()
  const [format, setFormat] = useState<'photo' | 'carousel' | 'reel'>('photo')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState(session.accounts.find((account) => account.status === 'connected')?.id ?? '')
  const [categories, setCategories] = useState<Array<{ id: string; name: string; defaultFormat: string }>>([])
  const [post, setPost] = useState<PostRecord | null>(null)
  const [job, setJob] = useState<Job>(null)
  const [caption, setCaption] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [hashtags, setHashtags] = useState<HashtagChip[]>([])
  const [keywordDraft, setKeywordDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const canPublish = roleHas(session.role as OrgRole, 'posts.publish')
  const preview = (post?.media.length ?? 0) > 0

  useEffect(() => {
    api<{ categories: Array<{ id: string; name: string; defaultFormat: string }> }>('/api/categories')
      .then((body) => setCategories(body.categories))
      .catch((cause) => setError(messageOf(cause)))
  }, [])

  useEffect(() => {
    if (!post || !job || (job.status !== 'queued' && job.status !== 'running')) return
    const timer = window.setInterval(() => {
      api<{ post: PostRecord; job: Job }>(`/api/posts/${post.id}`).then((body) => {
        setPost(body.post)
        setJob(body.job)
        setCaption(body.post.caption)
        setKeywords(body.post.keywords)
        setHashtags(body.post.hashtags)
      }).catch((cause) => setError(messageOf(cause)))
    }, 1500)
    return () => window.clearInterval(timer)
  }, [post, job])

  function applyPost(next: PostRecord) {
    setPost(next)
    setCaption(next.caption)
    setKeywords(next.keywords)
    setHashtags(next.hashtags)
    setDirty(false)
  }

  async function ensurePost(): Promise<PostRecord> {
    if (post) {
      const updated = await api<{ post: PostRecord }>(`/api/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description, format, instagramAccountId: accountId || null }),
      })
      applyPost(updated.post)
      return updated.post
    }
    const created = await api<{ post: PostRecord }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ format, description, categoryId: categoryId || undefined, instagramAccountId: accountId || undefined }),
    })
    applyPost(created.post)
    return created.post
  }

  async function generate(reference: File | null) {
    setBusy(true)
    setError('')
    try {
      const current = await ensurePost()
      let referenceAssetId: string | undefined
      if (reference) {
        const body = new FormData()
        body.append('file', reference)
        const uploaded = await api<{ asset: { id: string } }>('/api/media/reference', { method: 'POST', body })
        referenceAssetId = uploaded.asset.id
      }
      const result = await api<{ post: PostRecord; job: Job; copyError?: string }>(`/api/posts/${current.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ referenceAssetId }),
      })
      applyPost(result.post)
      setJob(result.job)
      if (result.copyError) setNotice(result.copyError)
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
      body: JSON.stringify({ caption, keywords, hashtags }),
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
      setNotice(path === 'publish' ? 'Published' : 'Saved')
    } catch (cause) {
      setError(messageOf(cause))
      const failed = await api<{ post: PostRecord }>(`/api/posts/${post.id}`).catch(() => null)
      if (failed) applyPost(failed.post)
    }
  }

  const publishedCaption = composePublishCaption(caption, hashtags)
  const videoPending = format === 'reel' && job && job.status !== 'ready' && job.status !== 'failed' && !preview

  return (
    <section className="stack">
      <h1>Create</h1>
      <Notice error={error} notice={notice} />
      <div className="create-layout">
        <form className="stack" onSubmit={(event) => { event.preventDefault(); const file = new FormData(event.currentTarget).get('reference'); void generate(file instanceof File && file.size ? file : null) }}>
          <label>Format
            <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
              <option value="photo">Photo</option>
              <option value="carousel">Carousel</option>
              <option value="reel">Reel</option>
            </select>
          </label>
          <label>Category
            <select value={categoryId} onChange={(event) => {
              const next = event.target.value
              setCategoryId(next)
              const category = categories.find((item) => item.id === next)
              if (category && (category.defaultFormat === 'photo' || category.defaultFormat === 'carousel' || category.defaultFormat === 'reel')) {
                setFormat(category.defaultFormat)
              }
            }}>
              <option value="">None</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>Instagram account
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Choose later</option>
              {session.accounts.map((account) => <option key={account.id} value={account.id}>@{account.username} ({account.status})</option>)}
            </select>
          </label>
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></label>
          <label>Reference photo<input name="reference" type="file" accept="image/png,image/jpeg,image/webp" /></label>
          <div className="row">
            <button type="submit" disabled={busy}>Generate</button>
            <label className="button secondary">Upload
              <input hidden type="file" accept="image/png,image/jpeg,image/webp,video/mp4" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadFile(file)
              }} />
            </label>
          </div>
        </form>
        <div className="stack">
          <div className="phone">
            {videoPending ? <p className="caption">Video is {job?.status}. The preview appears here when the file is ready.</p> : null}
            {job?.status === 'failed' ? <p className="caption">{job.error || 'Video generation failed'}</p> : null}
            {post?.media.map((item) => item.mimeType.startsWith('video/')
              ? <video key={item.id} src={item.url} controls />
              : <img key={item.id} src={item.url} alt="" />)}
            {!preview && !videoPending ? <p className="caption">The preview shows the image or video, the caption, and the hashtags still turned on.</p> : null}
            <p className="caption">{publishedCaption || 'Caption'}</p>
          </div>
          {post?.creativeBrief ? <p>{post.creativeBrief}</p> : null}
          {post?.callToAction ? <p>{post.callToAction}</p> : null}
          <label>Caption<textarea value={caption} onChange={(event) => { setCaption(event.target.value); setDirty(true) }} rows={5} /></label>
          <div className="chips">
            {keywords.map((keyword) => (
              <button className="chip" type="button" key={keyword} onClick={() => { setKeywords(keywords.filter((item) => item !== keyword)); setDirty(true) }}>{keyword}</button>
            ))}
          </div>
          <div className="row">
            <input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} placeholder="Add a keyword" />
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
            <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="Add a hashtag" />
            <button className="secondary" type="button" disabled={hashtags.length >= 10} onClick={() => {
              const tag = tagDraft.replace(/^#+/, '').trim()
              if (tag && hashtags.length < 10) { setHashtags([...hashtags, { tag, enabled: true }]); setDirty(true) }
              setTagDraft('')
            }}>Add tag</button>
          </div>
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
          <div className="row">
            <button type="button" disabled={!post || busy} onClick={() => void regenerate()}>Regenerate copy</button>
            <button type="button" disabled={!preview || !canPublish || busy} onClick={() => void act('approve')}>Approve</button>
            <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
            <button type="button" disabled={!preview || !post?.approvedAt || dirty || !session.package.scheduling || busy} onClick={() => void act('schedule', { scheduledAt: new Date(scheduleAt).toISOString() })}>Schedule</button>
            <button type="button" disabled={!preview || !post?.approvedAt || dirty || !canPublish || Boolean(post?.claimsNeedReview) || busy} onClick={() => void act('publish')}>Publish</button>
          </div>
          {post ? <p>Status: {post.status}{post.publishError ? ` — ${post.publishError}` : ''}</p> : null}
        </div>
      </div>
    </section>
  )
}

export function CalendarPage() {
  const session = useSession()
  const [posts, setPosts] = useState<PostRecord[]>([])
  const [timezone, setTimezone] = useState(session.organization.name ? 'UTC' : 'UTC')
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState('')
  useEffect(() => {
    api<{ posts: PostRecord[]; timezone: string }>('/api/posts').then((body) => {
      setPosts(body.posts)
      setTimezone(body.timezone)
    }).catch(() => undefined)
  }, [])
  if (!session.package.scheduling) return <p>Scheduling is included on Growth and Pro.</p>
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(Date.UTC(year, month, 1))
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${day}`
    return key
  })
  const grouped = new Map<string, PostRecord[]>()
  for (const post of posts) {
    const stamp = post.scheduledAt ?? ''
    if (!stamp) continue
    const key = zonedDay(stamp, timezone)
    grouped.set(key, [...(grouped.get(key) ?? []), post])
  }
  return (
    <section className="stack">
      <h1>Calendar</h1>
      <p>Times use {timezone}. The grid starts {first.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.</p>
      <div className="row">
        <button className="secondary" type="button" onClick={() => setCursor(new Date(year, month - 1, 1))}>Previous</button>
        <button className="secondary" type="button" onClick={() => setCursor(new Date(year, month + 1, 1))}>Next</button>
      </div>
      <div className="calendar">
        {cells.map((key) => (
          <button className="day" type="button" key={key} onClick={() => setSelected(key)}>
            <strong>{key.slice(-2)}</strong>
            <div>{(grouped.get(key) ?? []).map((post) => post.status).join(', ')}</div>
          </button>
        ))}
      </div>
      {selected ? (
        <ul>{(grouped.get(selected) ?? []).map((post) => <li key={post.id}>{post.status}: {post.caption || post.description || 'Untitled'}</li>)}</ul>
      ) : null}
    </section>
  )
}

type CommentRow = { id: string; text: string; authorUsername: string; igMediaId: string; hidden: boolean; deleted: boolean; replied: boolean; replyText: string | null }

export function CommentsPage() {
  const session = useSession()
  const [comments, setComments] = useState<CommentRow[]>([])
  const [selected, setSelected] = useState<CommentRow | null>(null)
  const [filter, setFilter] = useState('')
  const [reply, setReply] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState('')
  const canModerate = roleHas(session.role as OrgRole, 'comments.moderate')
  async function load() {
    const body = await api<{ comments: CommentRow[] }>(filter ? `/api/comments?igMediaId=${encodeURIComponent(filter)}` : '/api/comments')
    setComments(body.comments)
  }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [filter])
  useEffect(() => { api<{ members: Array<{ id: string; name: string }> }>('/api/members').then((body) => setMembers(body.members)).catch(() => undefined) }, [])
  const mediaIds = [...new Set(comments.map((comment) => comment.igMediaId))]
  return (
    <section className="stack">
      <h1>Comments</h1>
      <Notice error={error} notice="" />
      <div className="split">
        <div className="stack">
          <label>Post
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">All posts</option>
              {mediaIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          {comments.map((comment) => (
            <button className="secondary" type="button" key={comment.id} onClick={() => { setSelected(comment); setReply(comment.replyText ?? ''); setSuggestion('') }}>
              @{comment.authorUsername}: {comment.text}
            </button>
          ))}
        </div>
        {selected ? (
          <div className="stack">
            <p>{selected.text}</p>
            {suggestion ? <p className="notice">{suggestion}</p> : null}
            <button className="secondary" type="button" onClick={() => void api<{ text: string }>(`/api/comments/${selected.id}/suggest`, { method: 'POST' }).then((body) => { setSuggestion(body.text); setReply(body.text) }).catch((cause) => setError(messageOf(cause)))}>Suggest a reply</button>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} />
            <div className="row">
              <button type="button" onClick={() => void api(`/api/comments/${selected.id}/reply`, { method: 'POST', body: JSON.stringify({ text: reply }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>Reply</button>
              <button className="secondary" type="button" onClick={() => void api(`/api/comments/${selected.id}/private-reply`, { method: 'POST', body: JSON.stringify({ text: reply }) }).catch((cause) => setError(messageOf(cause)))}>Private reply</button>
              {canModerate ? <button className="secondary" type="button" onClick={() => void api(`/api/comments/${selected.id}/hide`, { method: 'POST' }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>Hide</button> : null}
              {canModerate ? <button className="secondary" type="button" onClick={() => void api(`/api/comments/${selected.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>Delete</button> : null}
            </div>
            <label>Assign
              <select defaultValue="" onChange={(event) => { if (event.target.value) void api(`/api/comments/${selected.id}/assign`, { method: 'POST', body: JSON.stringify({ userId: event.target.value }) }) }}>
                <option value="">Choose a teammate</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
          </div>
        ) : <p>Select a comment.</p>}
      </div>
    </section>
  )
}

type Conversation = { id: string; participantUsername: string; automationEnabled: boolean }
type Thread = { conversation: Conversation & { messages: Array<{ id: string; direction: string; body: string }> }; send: { allowed: boolean; reason: string } }

export function MessagesPage() {
  const session = useSession()
  const [list, setList] = useState<Conversation[]>([])
  const [thread, setThread] = useState<Thread | null>(null)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Array<{ id: string; title: string; body: string }>>([])
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([])
  const [rules, setRules] = useState<Array<{ id: string; name: string; kind: string; enabled: boolean }>>([])
  const [error, setError] = useState('')
  const canAutomate = roleHas(session.role as OrgRole, 'messages.automate') && session.package.automation
  async function open(id: string) {
    const body = await api<Thread>(`/api/conversations/${id}`)
    setThread(body)
  }
  useEffect(() => {
    api<{ conversations: Conversation[] }>('/api/conversations').then((body) => setList(body.conversations)).catch((cause) => setError(messageOf(cause)))
    api<{ responses: Array<{ id: string; title: string; body: string }> }>('/api/saved-responses').then((body) => setSaved(body.responses)).catch(() => undefined)
    api<{ members: Array<{ id: string; name: string }> }>('/api/members').then((body) => setMembers(body.members)).catch(() => undefined)
    if (canAutomate) api<{ rules: Array<{ id: string; name: string; kind: string; enabled: boolean }> }>('/api/automation/rules').then((body) => setRules(body.rules)).catch(() => undefined)
  }, [canAutomate])
  return (
    <section className="stack">
      <h1>Messages</h1>
      <Notice error={error} notice="" />
      <div className="split">
        <div className="stack">
          {list.map((item) => <button className="secondary" type="button" key={item.id} onClick={() => void open(item.id).catch((cause) => setError(messageOf(cause)))}>@{item.participantUsername}</button>)}
        </div>
        {thread ? (
          <div className="stack">
            <div className="thread">
              {thread.conversation.messages.map((item) => <p className={item.direction === 'outbound' ? 'bubble out' : 'bubble'} key={item.id}>{item.body}</p>)}
            </div>
            <button className="secondary" type="button" onClick={() => void api<{ text: string }>(`/api/conversations/${thread.conversation.id}/suggest`, { method: 'POST' }).then((body) => setText(body.text)).catch((cause) => setError(messageOf(cause)))}>Draft a reply</button>
            <label>Saved response
              <select defaultValue="" onChange={(event) => { const found = saved.find((item) => item.id === event.target.value); if (found) setText(found.body) }}>
                <option value="">Choose</option>
                {saved.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} />
            {thread.send.allowed ? (
              <button type="button" onClick={() => void api(`/api/conversations/${thread.conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ text }) }).then(() => open(thread.conversation.id)).catch((cause) => setError(messageOf(cause)))}>Send</button>
            ) : (
              <div className="stack">
                <p>{thread.send.reason}</p>
                <label>Assign instead
                  <select defaultValue="" onChange={(event) => { if (event.target.value) void api(`/api/conversations/${thread.conversation.id}/assign`, { method: 'POST', body: JSON.stringify({ userId: event.target.value }) }) }}>
                    <option value="">Choose a teammate</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            {canAutomate ? (
              <label>Automation for this thread
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
          }).then(() => api<{ rules: typeof rules }>('/api/automation/rules')).then((body) => setRules(body.rules)).catch((cause) => setError(messageOf(cause)))
        }}>
          <h2>Automation rules</h2>
          <ul>{rules.map((rule) => <li key={rule.id}>{rule.name} · {rule.kind} · {rule.enabled ? 'on' : 'off'}</li>)}</ul>
          <label>Name<input name="name" required /></label>
          <label>Kind
            <select name="kind">
              <option value="faq_comment">FAQ comment</option>
              <option value="business_hours_dm">Business-hours message</option>
              <option value="human_request">Ask for a person</option>
              <option value="complaint">Complaint</option>
              <option value="scheduled_publish">Scheduled publish</option>
            </select>
          </label>
          <label>Match<input name="matchText" /></label>
          <label>Approved answer<textarea name="approvedAnswer" /></label>
          <button type="submit">Add rule</button>
        </form>
      ) : null}
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
  } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<NonNullable<typeof data>>('/api/insights').then(setData).catch((cause) => setError(messageOf(cause))) }, [])
  return (
    <section className="stack">
      <h1>Insights</h1>
      <Notice error={error} notice="" />
      {data ? (
        <>
          <p>{data.followers.available ? `Followers: ${data.followers.series.map((point) => `${point.date} ${point.value}`).join(', ')}` : 'Follower trend is not available for this account.'}</p>
          <div className="cards">
            {Object.entries(data.engagementByFormat).map(([format, stats]) => (
              <article className="card" key={format}><h2>{format}</h2><p>{stats.posts} posts · {stats.saves} saves · {stats.reach} reach · {stats.comments} comments</p></article>
            ))}
          </div>
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
  ['ai', 'Custom AI'],
  ['categories', 'Categories'],
  ['team', 'Team'],
  ['billing', 'Billing'],
  ['instagram', 'Instagram'],
] as const

export function SettingsLayout() {
  return (
    <section className="stack">
      <h1>Settings</h1>
      <nav className="row">{SETTINGS.map(([path, label]) => <Link key={path} to={path}>{label}</Link>)}</nav>
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
      {(['brandName', 'businessDescription', 'targetAudience', 'voiceAndTone', 'productsAndServices', 'topicsToAvoid', 'preferredLanguage'] as const).map((key) => (
        <label key={key}>{key}<input value={brand[key]} onChange={(event) => setBrand({ ...brand, [key]: event.target.value })} /></label>
      ))}
      <label>Approved facts<textarea value={brand.approvedFacts} onChange={(event) => setBrand({ ...brand, approvedFacts: event.target.value })} rows={5} /></label>
      <button type="submit">Save brand</button>
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
  const [error, setError] = useState('')
  const unlocked = Boolean(profile?.customizable && session.package.customAi && roleHas(session.role as OrgRole, 'ai.customize'))
  useEffect(() => {
    api<NonNullable<typeof profile>>('/api/ai/profile').then((body) => { setProfile(body); setInstructions(body.instructions); setModelId(body.modelId) }).catch((cause) => setError(messageOf(cause)))
    api<{ knowledge: typeof knowledge }>('/api/ai/knowledge').then((body) => setKnowledge(body.knowledge)).catch(() => undefined)
  }, [])
  return (
    <div className="stack">
      <Notice error={error} notice="" />
      <p>{profile?.customizable ? 'Custom AI is available on this organization.' : `Custom AI is locked. ${profile?.requiredPackage ?? 'Pro'} unlocks your own instructions and key.`}</p>
      <fieldset disabled={!unlocked} className="stack">
        <label>Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={5} /></label>
        <label>Tone<input value={tone} onChange={(event) => setTone(event.target.value)} /></label>
        <label>Language<input value={language} onChange={(event) => setLanguage(event.target.value)} /></label>
        <label>Model
          <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
            {(profile?.allowedModels ?? []).map((model) => <option key={model}>{model}</option>)}
          </select>
        </label>
        <label>Your model key<input value={providerKey} onChange={(event) => setProviderKey(event.target.value)} type="password" placeholder={profile?.hasCustomerKey ? 'A key is stored' : 'Optional'} /></label>
        <button type="button" onClick={() => void api('/api/ai/profile', { method: 'PUT', body: JSON.stringify({ instructions, modelId, tone, language, ...(providerKey ? { providerKey } : {}) }) }).catch((cause) => setError(messageOf(cause)))}>Save custom AI</button>
      </fieldset>
      <h2>Knowledge</h2>
      <ul>{knowledge.map((item) => <li key={item.id}>{item.title} · {item.approved ? 'approved' : 'pending'} {unlocked && !item.approved ? <button type="button" onClick={() => void api(`/api/ai/knowledge/${item.id}/approve`, { method: 'POST' })}>Approve</button> : null}</li>)}</ul>
      {unlocked ? (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void api('/api/ai/knowledge', { method: 'POST', body: JSON.stringify({ title: form.get('title'), body: form.get('body') }) }).then(() => api<{ knowledge: typeof knowledge }>('/api/ai/knowledge')).then((body) => setKnowledge(body.knowledge))
        }}>
          <label>Title<input name="title" required /></label>
          <label>Fact<textarea name="body" required /></label>
          <button type="submit">Add knowledge</button>
        </form>
      ) : null}
    </div>
  )
}

export function CategoriesSettings() {
  const [categories, setCategories] = useState<Array<{ id: string; name: string; styleNotes: string; defaultFormat: string }>>([])
  const [error, setError] = useState('')
  function load() { return api<{ categories: typeof categories }>('/api/categories').then((body) => setCategories(body.categories)) }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  return (
    <div className="stack">
      <Notice error={error} notice="" />
      <ul>{categories.map((category) => <li key={category.id}>{category.name} · {category.defaultFormat}</li>)}</ul>
      <form className="stack" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void api('/api/categories', { method: 'POST', body: JSON.stringify({ name: form.get('name'), styleNotes: form.get('styleNotes'), defaultFormat: form.get('defaultFormat') }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))
      }}>
        <label>Name<input name="name" required /></label>
        <label>Style notes<input name="styleNotes" /></label>
        <label>Default format
          <select name="defaultFormat"><option value="photo">Photo</option><option value="carousel">Carousel</option><option value="reel">Reel</option></select>
        </label>
        <button type="submit">Add category</button>
      </form>
    </div>
  )
}

export function TeamSettings() {
  const [members, setMembers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([])
  const [error, setError] = useState('')
  const [invite, setInvite] = useState('')
  function load() { return api<{ members: typeof members }>('/api/members').then((body) => setMembers(body.members)) }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  return (
    <div className="stack">
      <Notice error={error} notice={invite} />
      <ul>{members.map((member) => (
        <li key={member.id}>{member.name} · {member.email} · {member.role}
          {member.role !== 'OWNER' ? (
            <select value={member.role} onChange={(event) => void api(`/api/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }).then(() => load())}>
              <option>ADMIN</option><option>EDITOR</option><option>SUPPORT</option>
            </select>
          ) : null}
        </li>
      ))}</ul>
      <form className="row" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void api<{ token?: string }>('/api/invitations', { method: 'POST', body: JSON.stringify({ email: form.get('email'), role: form.get('role') }) })
          .then((body) => setInvite(body.token ? `Invitation token: ${body.token}` : 'Invitation sent'))
          .catch((cause) => setError(messageOf(cause)))
      }}>
        <input name="email" type="email" required placeholder="Email" />
        <select name="role"><option>ADMIN</option><option>EDITOR</option><option>SUPPORT</option></select>
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
  const [accounts, setAccounts] = useState<AccountInfo[]>(session.accounts)
  const [error, setError] = useState('')
  return (
    <div className="stack">
      <Notice error={error} notice="" />
      <ul>{accounts.map((account) => (
        <li key={account.id}>@{account.username} · {account.status} {account.lastError ? `· ${account.lastError}` : ''}
          <button className="secondary" type="button" onClick={() => void api(`/api/instagram/accounts/${account.id}`, { method: 'DELETE' }).then(() => setAccounts(accounts.filter((item) => item.id !== account.id))).catch((cause) => setError(messageOf(cause)))}>Disconnect</button>
        </li>
      ))}</ul>
      <button type="button" onClick={() => void api<{ authorizeUrl: string }>('/api/integrations/instagram/connect').then((body) => { window.location.href = body.authorizeUrl }).catch((cause) => setError(messageOf(cause)))}>Connect Instagram</button>
      <p>{accounts.filter((account) => account.status === 'connected' || account.status === 'expired').length} of {session.package.instagramAccounts} accounts used.</p>
    </div>
  )
}
