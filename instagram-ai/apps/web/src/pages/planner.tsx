import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  NETWORK_LABEL,
  PLAN_MAX_POSTS,
  PLAN_WEEKDAY_LABELS,
  POST_FORMATS,
  isSocialNetwork,
  roleHas,
  type AudienceHour,
  type OrgRole,
  type PostFormat,
  type SocialNetwork,
} from '@instagram-ai/shared'
import { api } from '../lib/api'
import { Hint, Pager, confirmDelete, fetchAll } from '../lib/form'
import {
  canApprove,
  defaultPlanForm,
  formatSlot,
  fromLocalInput,
  groupByDay,
  hashtagText,
  isLocked,
  mediaLabel,
  parseHashtagInput,
  planRequestBody,
  statusLabel,
  toLocalInput,
  toggle,
  validatePlanForm,
  type PlanFormState,
  type PlanPost,
  type PlanRecord,
  type PostPatch,
} from '../lib/planner'
import type { SocialAccountInfo } from '../lib/types'
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

const FORMAT_LABEL: Record<PostFormat, string> = { photo: 'Photo', carousel: 'Carousel', reel: 'Reel', video: 'Video', story: 'Story' }

function accountLabel(account: SocialAccountInfo): string {
  const network = isSocialNetwork(account.network) ? NETWORK_LABEL[account.network as SocialNetwork] : account.network
  return `${network} · ${account.displayName || account.username}`
}

export type PlanFormProps = {
  accounts: SocialAccountInfo[]
  campaigns: Array<{ id: string; name: string }>
  audience: AudienceHour[]
  timeZone: string
  busy: boolean
  now?: Date
  onSubmit: (form: PlanFormState) => void
}

export function PlanForm({ accounts, campaigns, audience, timeZone, busy, now, onSubmit }: PlanFormProps) {
  const [form, setForm] = useState<PlanFormState>(() => defaultPlanForm(now ?? new Date(), timeZone))
  const [errors, setErrors] = useState<string[]>([])
  const check = useMemo(() => validatePlanForm(form, { timeZone, now, audience }), [form, timeZone, now, audience])
  function patch(next: Partial<PlanFormState>) {
    setForm((current) => ({ ...current, ...next }))
    setErrors([])
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (check.errors.length) {
      setErrors(check.errors)
      return
    }
    onSubmit(form)
  }
  return (
    <form className="card stack" onSubmit={submit} aria-label="Generate a plan">
      <h2>Generate a plan</h2>
      <p>The AI drafts the posts. Nothing is scheduled to publish until you approve it.</p>
      <div className="row">
        <label>Range
          <Hint>How far ahead to plan.</Hint>
          <select value={form.range} onChange={(event) => patch({ range: event.target.value as PlanFormState['range'] })}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label>Start date
          <Hint>{`The first day of the plan, in your account time zone (${timeZone}).`}</Hint>
          <input type="date" value={form.startDate} onChange={(event) => patch({ startDate: event.target.value })} required />
        </label>
        <label>Posts per day
          <Hint>One to three posts on each day you post.</Hint>
          <select value={form.postsPerDay} onChange={(event) => patch({ postsPerDay: Number(event.target.value) })}>
            {[1, 2, 3].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="stack">
        <legend>Days to post on</legend>
        <Hint>Pick the weekdays that should get posts.</Hint>
        <div className="row">
          {PLAN_WEEKDAY_LABELS.map((label, day) => (
            <label key={label} className="checkline">
              <input type="checkbox" checked={form.weekdays.includes(day)} onChange={(event) => patch({ weekdays: toggle(form.weekdays, day, event.target.checked) })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="stack">
        <legend>Formats to mix</legend>
        <Hint>The plan rotates through these formats.</Hint>
        <div className="row">
          {POST_FORMATS.map((format) => (
            <label key={format} className="checkline">
              <input type="checkbox" checked={form.formats.includes(format)} onChange={(event) => patch({ formats: toggle(form.formats, format, event.target.checked) })} />
              {FORMAT_LABEL[format]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="stack">
        <legend>Target accounts</legend>
        <Hint>Every post in the plan goes to these connected accounts once you approve it.</Hint>
        {accounts.length === 0 ? <p className="notice">Connect an Instagram, Facebook, TikTok, or YouTube account in Settings first.</p> : null}
        <div className="row">
          {accounts.map((account) => (
            <label key={account.id} className="checkline">
              <input type="checkbox" checked={form.socialAccountIds.includes(account.id)} onChange={(event) => patch({ socialAccountIds: toggle(form.socialAccountIds, account.id, event.target.checked) })} />
              {accountLabel(account)}
            </label>
          ))}
        </div>
      </fieldset>
      <label>Goal or theme
        <Hint>What this stretch of posts should achieve, in a sentence.</Hint>
        <input value={form.goal} maxLength={500} onChange={(event) => patch({ goal: event.target.value })} placeholder="Promote the spring menu" />
      </label>
      <label>Topics to cover
        <Hint>One per line. Leave empty to let the AI choose from your goal and brand info.</Hint>
        <textarea rows={3} value={form.topics} onChange={(event) => patch({ topics: event.target.value })} />
      </label>
      <label>Promotions and dates
        <Hint>Only list offers you really run. The AI will not invent prices or deals.</Hint>
        <textarea rows={2} maxLength={1000} value={form.promotions} onChange={(event) => patch({ promotions: event.target.value })} />
      </label>
      <div className="row">
        <label>Tone
          <Hint>For example friendly, bold, or calm. Empty uses your brand voice.</Hint>
          <input value={form.tone} maxLength={200} onChange={(event) => patch({ tone: event.target.value })} />
        </label>
        <label>Language
          <Hint>Empty uses the language from your brand settings.</Hint>
          <input value={form.language} maxLength={100} onChange={(event) => patch({ language: event.target.value })} />
        </label>
      </div>
      <label className="checkline">
        <input type="checkbox" checked={form.useBestTimes} disabled={audience.length === 0} onChange={(event) => patch({ useBestTimes: event.target.checked })} />
        Use best times from my audience data
        <Hint>{audience.length ? 'Posts go out at the hours your audience is online most, from stored Meta insights.' : 'No audience data yet, so default times are used (10:00, 17:00, 09:00/13:00/18:00).'}</Hint>
      </label>
      <label>Campaign
        <Hint>Optional. Attach every post in the plan to one of your campaigns.</Hint>
        <select value={form.campaignId} onChange={(event) => patch({ campaignId: event.target.value })}>
          <option value="">No campaign</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
      </label>
      <p>{check.slotCount > 0 ? `This will draft ${check.slotCount} post${check.slotCount === 1 ? '' : 's'} (at most ${PLAN_MAX_POSTS}).` : `A plan holds at most ${PLAN_MAX_POSTS} posts.`}</p>
      {errors.length ? <ul className="error" role="alert">{errors.map((message) => <li key={message}>{message}</li>)}</ul> : null}
      <button type="submit" disabled={busy}>{busy ? 'Drafting the plan' : 'Generate plan'}</button>
    </form>
  )
}

type ItemProps = {
  post: PlanPost
  timeZone: string
  canWrite: boolean
  canApprove: boolean
  canGenerate: boolean
  checked: boolean
  busy: boolean
  onCheck: (checked: boolean) => void
  onSave: (id: string, patch: PostPatch) => void
  onDelete: (id: string) => void
  onApprove: (ids: string[]) => void
  onRegenerate: (id: string) => void
  onMedia: (id: string) => void
}

export function PlanItem({ post, timeZone, canWrite, canApprove: mayApprove, canGenerate, checked, busy, onCheck, onSave, onDelete, onApprove, onRegenerate, onMedia }: ItemProps) {
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState(post.caption)
  const [topic, setTopic] = useState(post.description)
  const [tags, setTags] = useState(hashtagText(post.hashtags))
  const [format, setFormat] = useState(post.format as PostFormat)
  const [when, setWhen] = useState(toLocalInput(post.scheduledAt, timeZone))
  const locked = isLocked(post)
  useEffect(() => {
    setCaption(post.caption)
    setTopic(post.description)
    setTags(hashtagText(post.hashtags))
    setFormat(post.format as PostFormat)
    setWhen(toLocalInput(post.scheduledAt, timeZone))
  }, [post.caption, post.description, post.format, post.scheduledAt, timeZone])
  function save() {
    const scheduledAt = fromLocalInput(when, timeZone)
    onSave(post.id, {
      caption,
      description: topic,
      hashtags: parseHashtagInput(tags),
      format,
      ...(scheduledAt ? { scheduledAt } : {}),
    })
    setEditing(false)
  }
  function move() {
    const scheduledAt = fromLocalInput(when, timeZone)
    if (scheduledAt) onSave(post.id, { scheduledAt })
  }
  return (
    <article className="card stack plan-item" data-post={post.id}>
      <div className="row">
        {canWrite && !locked ? (
          <label className="checkline">
            <input type="checkbox" aria-label={`Select ${post.description || 'post'}`} checked={checked} onChange={(event) => onCheck(event.target.checked)} />
          </label>
        ) : null}
        <strong>{formatSlot(post.scheduledAt, timeZone)}</strong>
        <span className="badge">{FORMAT_LABEL[post.format as PostFormat] ?? post.format}</span>
        <span className={post.status === 'SCHEDULED' || post.status === 'PUBLISHED' ? 'badge ok' : 'badge'}>{statusLabel(post)}</span>
        <span className={post.mediaState === 'ready' ? 'badge ok' : post.mediaState === 'failed' ? 'badge bad' : 'badge'}>{mediaLabel(post)}</span>
      </div>
      {editing ? (
        <div className="stack">
          <label>Topic<Hint>The idea behind this post.</Hint><input value={topic} maxLength={4000} onChange={(event) => setTopic(event.target.value)} /></label>
          <label>Caption<Hint>What viewers read. Editing a post means you approve it again.</Hint><textarea rows={4} maxLength={2200} value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
          <label>Hashtags<Hint>Up to 10, separated by spaces.</Hint><input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
          <div className="row">
            <label>Format<Hint>Changing it clears generated media.</Hint>
              <select value={format} onChange={(event) => setFormat(event.target.value as PostFormat)}>
                {POST_FORMATS.map((item) => <option key={item} value={item}>{FORMAT_LABEL[item]}</option>)}
              </select>
            </label>
            <label>Publish at<Hint>{`Date and time in ${timeZone}.`}</Hint><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></label>
          </div>
          <div className="row">
            <button type="button" disabled={busy} onClick={save}>Save changes</button>
            <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <p><strong>{post.description || 'No topic'}</strong></p>
          <p className="plan-caption">{post.caption || 'No caption yet'}</p>
          {post.hashtags.length ? <p className="hint">{hashtagText(post.hashtags)}</p> : null}
          {post.claimsNeedReview ? <p className="notice">A factual claim needs a person to accept it before approval. Open the post to review it.</p> : null}
          {post.mediaState === 'failed' && post.mediaError ? <p className="error">{post.mediaError}</p> : null}
          {post.publishError ? <p className="error">{post.publishError}</p> : null}
        </div>
      )}
      <div className="row">
        {canWrite && !locked && !editing ? <button type="button" className="secondary" onClick={() => setEditing(true)}>Edit</button> : null}
        {canWrite && !locked && !editing ? (
          <>
            <input type="datetime-local" aria-label="Move to" value={when} onChange={(event) => setWhen(event.target.value)} />
            <button type="button" className="secondary" disabled={busy} onClick={move}>Move</button>
          </>
        ) : null}
        {canWrite && !locked && canGenerate ? <button type="button" className="secondary" disabled={busy} onClick={() => onRegenerate(post.id)}>Regenerate</button> : null}
        {canGenerate && !locked && post.mediaState !== 'generating' ? <button type="button" className="secondary" disabled={busy} onClick={() => onMedia(post.id)}>Generate media</button> : null}
        {mayApprove && canApprove(post) ? <button type="button" disabled={busy} onClick={() => onApprove([post.id])}>Approve</button> : null}
        {canWrite && !locked ? <button type="button" className="secondary" onClick={() => { if (confirmDelete('this post')) onDelete(post.id) }}>Delete</button> : null}
        <Link to={`/app/create?post=${post.id}`}>Open in Create</Link>
      </div>
    </article>
  )
}

export type ReviewProps = {
  plan: PlanRecord
  posts: PlanPost[]
  timeZone: string
  view: 'list' | 'calendar'
  page: number
  total: number
  selected: string[]
  canWrite: boolean
  canApprove: boolean
  canGenerate: boolean
  busy: boolean
  onPage: (page: number) => void
  onSelect: (ids: string[]) => void
  onSave: (id: string, patch: PostPatch) => void
  onDelete: (id: string) => void
  onApprove: (ids: string[] | null) => void
  onRegenerate: (id: string) => void
  onMedia: (id: string) => void
  onDeleteSelected: (ids: string[]) => void
  onRegeneratePlan: () => void
}

export function PlanReview(props: ReviewProps) {
  const { plan, posts, timeZone, view, selected, canWrite, busy } = props
  const [focus, setFocus] = useState('')
  const open = posts.filter((post) => canApprove(post))
  const allChecked = open.length > 0 && open.every((post) => selected.includes(post.id))
  function itemFor(post: PlanPost) {
    return (
      <PlanItem
        key={post.id}
        post={post}
        timeZone={timeZone}
        canWrite={canWrite}
        canApprove={props.canApprove}
        canGenerate={props.canGenerate}
        checked={selected.includes(post.id)}
        busy={busy}
        onCheck={(checked) => props.onSelect(toggle(selected, post.id, checked))}
        onSave={props.onSave}
        onDelete={props.onDelete}
        onApprove={(ids) => props.onApprove(ids)}
        onRegenerate={props.onRegenerate}
        onMedia={props.onMedia}
      />
    )
  }
  const focused = posts.find((post) => post.id === focus)
  return (
    <section className="stack" aria-label="Plan review">
      <p>{plan.counts.pending} waiting for approval · {plan.counts.scheduled} approved and scheduled · {plan.counts.published} published</p>
      <div className="row plan-bulk">
        {canWrite || props.canApprove ? (
          <label className="checkline">
            <input type="checkbox" aria-label="Select all waiting posts on this page" checked={allChecked} onChange={(event) => props.onSelect(event.target.checked ? [...new Set([...selected, ...open.map((post) => post.id)])] : selected.filter((id) => !open.some((post) => post.id === id)))} />
            Select all on this page
          </label>
        ) : null}
        {props.canApprove ? (
          <>
            <button type="button" disabled={busy || selected.length === 0} onClick={() => props.onApprove(selected)}>Approve selected ({selected.length})</button>
            <button type="button" disabled={busy || plan.counts.pending === 0} onClick={() => {
              if (window.confirm(`Approve all ${plan.counts.pending} waiting posts? They will publish at their scheduled times.`)) props.onApprove(null)
            }}>Approve all</button>
          </>
        ) : null}
        {canWrite ? (
          <button type="button" className="secondary" disabled={busy || selected.length === 0} onClick={() => {
            if (window.confirm(`Delete ${selected.length} selected posts?`)) props.onDeleteSelected(selected)
          }}>Delete selected ({selected.length})</button>
        ) : null}
        {canWrite && props.canGenerate ? (
          <button type="button" className="secondary" disabled={busy || plan.counts.pending === 0} onClick={() => {
            if (window.confirm('Regenerate every post that is still waiting for approval? Your edits to those posts will be replaced.')) props.onRegeneratePlan()
          }}>Regenerate plan</button>
        ) : null}
      </div>
      {view === 'calendar' ? (
        <div className="stack">
          <div className="plan-calendar">
            {groupByDay(posts, timeZone).map((group) => (
              <div className="plan-day card" key={group.day}>
                <strong>{group.day}</strong>
                {group.posts.map((post) => (
                  <button key={post.id} type="button" className={`plan-chip${focus === post.id ? ' active' : ''}`} onClick={() => setFocus(post.id)}>
                    {formatSlot(post.scheduledAt, timeZone).split(', ').pop()} · {FORMAT_LABEL[post.format as PostFormat] ?? post.format} · {post.description || 'Post'}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {focused ? itemFor(focused) : <p>Pick a post on the calendar to review it.</p>}
        </div>
      ) : (
        <div className="stack">
          {posts.map(itemFor)}
          <Pager page={props.page} total={props.total} onPage={props.onPage} label="Plan posts" />
        </div>
      )}
      {posts.length === 0 ? <p>This plan has no posts left.</p> : null}
    </section>
  )
}

type PlanList = { plans: PlanRecord[]; timezone: string; page: number; total: number }
type PlanDetail = { plan: PlanRecord; posts: PlanPost[]; timezone: string; page: number; total: number }
type ActionResult = { notice?: string | null; copyErrors?: number; approved?: string[]; skipped?: Array<{ id: string; reason: string }>; mediaQueued?: number }

export function PlannerPage() {
  const session = useSession()
  const role = session.role as OrgRole
  const canWrite = roleHas(role, 'posts.write')
  const canApprovePosts = roleHas(role, 'posts.publish')
  const canGenerate = roleHas(role, 'ai.use')
  const canMedia = roleHas(role, 'ai.generateMedia')
  const [params, setParams] = useSearchParams()
  const planId = params.get('plan') ?? ''
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [plansPage, setPlansPage] = useState(1)
  const [plansTotal, setPlansTotal] = useState(0)
  const [timeZone, setTimeZone] = useState('UTC')
  const [detail, setDetail] = useState<PlanDetail | null>(null)
  const [calendarPosts, setCalendarPosts] = useState<PlanPost[]>([])
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [selected, setSelected] = useState<string[]>([])
  const [accounts, setAccounts] = useState<SocialAccountInfo[]>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [audience, setAudience] = useState<AudienceHour[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadPlans(next = plansPage) {
    const body = await api<PlanList>(`/api/plans?page=${next}`)
    setPlans(body.plans)
    setPlansTotal(body.total)
    setTimeZone(body.timezone)
  }

  async function loadDetail(id = planId, nextPage = page, nextView = view) {
    if (!id) {
      setDetail(null)
      return
    }
    const body = await api<PlanDetail>(`/api/plans/${id}?page=${nextPage}`)
    if (body.posts.length === 0 && nextPage > 1) {
      setPage(nextPage - 1)
      return
    }
    setDetail(body)
    setTimeZone(body.timezone)
    if (nextView === 'calendar') setCalendarPosts(await fetchAll<PlanPost>(`/api/plans/${id}`, 'posts'))
  }

  async function refresh() {
    await Promise.all([loadPlans(), loadDetail()])
  }

  useEffect(() => {
    loadPlans().catch((cause) => setError(messageOf(cause)))
    fetchAll<SocialAccountInfo>('/api/social/accounts', 'accounts')
      .then((rows) => setAccounts(rows.filter((account) => account.status === 'connected')))
      .catch(() => setAccounts([]))
    fetchAll<{ id: string; name: string }>('/api/campaigns', 'campaigns').then(setCampaigns).catch(() => setCampaigns([]))
    api<{ hours: AudienceHour[] }>('/api/audience-times').then((body) => setAudience(body.hours)).catch(() => setAudience([]))
  }, [plansPage])

  useEffect(() => {
    setSelected([])
    loadDetail(planId, page, view).catch((cause) => setError(messageOf(cause)))
  }, [planId, page, view])

  async function run(work: () => Promise<ActionResult | void>, done?: (result: ActionResult) => string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = (await work()) ?? {}
      const parts = [done ? done(result) : '', result.notice ?? '']
      if (result.skipped?.length) parts.push(`${result.skipped.length} skipped: ${[...new Set(result.skipped.map((item) => item.reason))].join('; ')}`)
      setNotice(parts.filter(Boolean).join(' '))
      await refresh()
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  function generate(form: PlanFormState) {
    void run(async () => {
      const body = await api<PlanDetail & ActionResult>('/api/plans', { method: 'POST', body: JSON.stringify(planRequestBody(form)) })
      setPage(1)
      setParams({ plan: body.plan.id })
      return body
    }, (result) => `Drafted ${(result as { total?: number }).total ?? 0} posts for review.${result.copyErrors ? ` ${result.copyErrors} used a short draft because the caption writer was unavailable.` : ''}`)
  }

  const base = `/api/plans/${planId}`
  const posts = view === 'calendar' ? calendarPosts : detail?.posts ?? []

  return (
    <section className="stack">
      <h1>AI Schedule Planner</h1>
      <p>Let the AI draft a day, week, or month of posts from your brand info and goals. You review, edit, delete, or approve each one. Nothing publishes without your approval.</p>
      <Notice error={error} notice={notice} />
      {canWrite && canGenerate ? (
        <PlanForm accounts={accounts} campaigns={campaigns} audience={audience} timeZone={timeZone} busy={busy} onSubmit={generate} />
      ) : (
        <p className="notice">You can review plans here. Ask an owner or editor to generate or approve posts.</p>
      )}
      <h2>Your plans</h2>
      {plans.length === 0 ? <p>No plans yet.</p> : null}
      {plans.map((plan) => (
        <article className="card row" key={plan.id}>
          <div>
            <strong>{plan.inputs.goal || 'Content plan'}</strong>
            <p>{plan.range} · {plan.startsAt.slice(0, 10)} to {plan.endsAt.slice(0, 10)} · {plan.counts.total} posts · {plan.counts.pending} waiting · {plan.counts.scheduled} scheduled</p>
          </div>
          <div className="row">
            <button type="button" className="secondary" onClick={() => { setPage(1); setParams({ plan: plan.id }) }}>Review</button>
            {canWrite ? (
              <button type="button" className="secondary" onClick={() => {
                if (!confirmDelete('this plan and its unpublished posts')) return
                void run(async () => {
                  await api(`/api/plans/${plan.id}`, { method: 'DELETE' })
                  if (plan.id === planId) setParams({})
                }, () => 'Plan deleted.')
              }}>Delete</button>
            ) : null}
          </div>
        </article>
      ))}
      <Pager page={plansPage} total={plansTotal} onPage={setPlansPage} label="Plans" />
      {detail ? (
        <div className="stack">
          <div className="row">
            <h2>Review: {detail.plan.inputs.goal || 'Content plan'}</h2>
            <button type="button" className="secondary" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
            <button type="button" className="secondary" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
          </div>
          <PlanReview
            plan={detail.plan}
            posts={posts}
            timeZone={timeZone}
            view={view}
            page={page}
            total={detail.total}
            selected={selected}
            canWrite={canWrite}
            canApprove={canApprovePosts}
            canGenerate={canMedia && canWrite}
            busy={busy}
            onPage={setPage}
            onSelect={setSelected}
            onSave={(id, patch) => void run(() => api(`${base}/posts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(() => undefined), () => 'Saved. Edited posts need approval again.')}
            onDelete={(id) => void run(() => api(`${base}/posts/${id}`, { method: 'DELETE' }).then(() => undefined), () => 'Post deleted.')}
            onApprove={(ids) => void run(
              () => api<ActionResult>(`${base}/approve`, { method: 'POST', body: JSON.stringify(ids ? { postIds: ids } : {}) }).then((result) => { setSelected([]); return result }),
              (result) => `Approved ${result.approved?.length ?? 0} post${result.approved?.length === 1 ? '' : 's'}.${result.mediaQueued ? ` Generating media for ${result.mediaQueued}.` : ''}`,
            )}
            onRegenerate={(id) => void run(() => api<ActionResult>(`${base}/posts/${id}/regenerate`, { method: 'POST' }), () => 'Post regenerated. It needs approval again.')}
            onMedia={(id) => void run(() => api<ActionResult>(`${base}/posts/${id}/media`, { method: 'POST' }), () => 'Media requested.')}
            onDeleteSelected={(ids) => void run(() => api<ActionResult>(`${base}/posts/delete`, { method: 'POST', body: JSON.stringify({ postIds: ids }) }).then((result) => { setSelected([]); return result }), () => 'Selected posts deleted.')}
            onRegeneratePlan={() => void run(() => api<ActionResult>(`${base}/regenerate`, { method: 'POST' }), () => 'Plan regenerated. Posts need approval again.')}
          />
        </div>
      ) : null}
    </section>
  )
}
