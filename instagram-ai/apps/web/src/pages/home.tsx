import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { NETWORK_LABEL, roleHas, type OrgRole } from '@instagram-ai/shared'
import { api } from '../lib/api'
import { BarMetricsChart, DoughnutMetricsChart, LineMetricsChart } from '../lib/charts'
import { Hint, Pager, confirmDelete } from '../lib/form'
import type { PostRecord } from '../lib/types'
import { useSession } from './shell'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function Notice({ error, notice }: { error: string; notice?: string }) {
  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice">{notice}</p> : null}
    </>
  )
}

type Credits = {
  text: { used: number; limit: number; remaining: number }
  image: { used: number; limit: number; remaining: number }
  video: { used: number; limit: number; remaining: number }
}

type HomeBody = {
  scheduledPosts: number
  awaitingApproval: number
  credits: Credits
  weekStrip: PostRecord[]
  recentGenerations: Array<{ id: string; url: string; mimeType: string; filename: string; kind: string }>
  recentPosts: PostRecord[]
  charts: { formatMix: Array<{ name: string; value: number }> }
  publishingErrors: Array<{ id: string; publishError: string | null; status: string }>
  page: number
  total: number
}

const IDEA_CARDS = [
  { format: 'photo', label: 'Image', description: 'A clean product photo with soft daylight and space for a short caption.' },
  { format: 'video', label: 'Video', description: 'A short video that shows the product in use, ready for a voiceover.' },
  { format: 'carousel', label: 'Carousel', description: 'A three-slide carousel: hook, proof, and a clear next step.' },
] as const

export function HomeDashboardPage() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [data, setData] = useState<HomeBody | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  function load(next = page) {
    return api<HomeBody>(`/api/dashboard?page=${next}`).then((body) => {
      setData(body)
      if (!body.publishingErrors.length && body.page > 1) setPage(body.page - 1)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack home-dashboard">
      <div className="row home-hero">
        <div>
          <h1>Home</h1>
          <p>Plan the next week, open an idea, and keep approval before anything goes live.</p>
        </div>
        {canWrite ? <Link className="button" to="/app/create">Create New</Link> : null}
      </div>
      <Notice error={error} />
      {data?.credits ? (
        <div className="credits-strip" aria-label="Remaining AI credits">
          <span>Photos left: {data.credits.image.remaining}/{data.credits.image.limit}</span>
          <span>Videos left: {data.credits.video.remaining}/{data.credits.video.limit}</span>
          <span>Text left: {data.credits.text.remaining}/{data.credits.text.limit}</span>
        </div>
      ) : null}
      <section className="stack">
        <h2>Next 7 days</h2>
        <div className="week-strip">
          {data?.weekStrip.length ? data.weekStrip.map((post) => (
            <article className="week-card" key={post.id}>
              <strong>{post.format}</strong>
              <p>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'No time'}</p>
              <p>{post.caption || post.description || 'Untitled'}</p>
              <Link to={`/app/create?post=${post.id}`}>Open</Link>
            </article>
          )) : <p>Nothing scheduled in the next seven days.</p>}
        </div>
      </section>
      <section className="stack">
        <h2>Ideas for you</h2>
        <div className="idea-cards">
          {IDEA_CARDS.map((idea) => (
            <Link
              className="idea-card"
              key={idea.format}
              to={`/app/create?format=${idea.format}&description=${encodeURIComponent(idea.description)}`}
            >
              <strong>{idea.label}</strong>
              <p>{idea.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="stack">
        <h2>Recent generations</h2>
        <div className="recent-media">
          {data?.recentGenerations.length ? data.recentGenerations.map((asset) => (
            asset.mimeType.startsWith('video/')
              ? <video key={asset.id} src={asset.url} muted playsInline />
              : <img key={asset.id} src={asset.url} alt={asset.filename} />
          )) : <p>No generated media yet.</p>}
        </div>
      </section>
      <section className="stack">
        <h2>What would help today?</h2>
        <div className="help-links row">
          <Link to="/app/create">Create</Link>
          <Link to="/app/ads">Ads</Link>
          <Link to="/app/reports">Reports</Link>
          <Link to="/app/calendar">Planner</Link>
          <Link to="/app/auto-posting">Auto Posting</Link>
          <Link to="/app/campaigns">Campaigns</Link>
        </div>
      </section>
      <DoughnutMetricsChart title="Format mix" slices={data?.charts.formatMix ?? []} />
      <h2>Publishing errors</h2>
      <ul className="stack">{data?.publishingErrors.map((item) => (
        <li className="card" key={item.id}>
          <p>{item.publishError || 'Publish failed'}</p>
          {canWrite ? (
            <div className="row">
              <Link to={`/app/create?post=${item.id}`}>Edit</Link>
              {item.status !== 'PUBLISHED' && item.status !== 'PUBLISHING' ? (
                <button className="secondary" type="button" onClick={() => {
                  if (!confirmDelete('this post')) return
                  void api(`/api/posts/${item.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
                }}>Delete</button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}</ul>
      <Pager page={data?.page ?? page} total={data?.total ?? 0} onPage={setPage} label="Publishing errors" />
    </section>
  )
}

export function AutoPostingPage() {
  const session = useSession()
  const canPublish = roleHas(session.role as OrgRole, 'posts.publish')
  const [queue, setQueue] = useState<PostRecord[]>([])
  const [scheduled, setScheduled] = useState<PostRecord[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  function load() {
    return Promise.all([
      api<{ posts: PostRecord[] }>('/api/posts?status=PENDING_APPROVAL&page=1'),
      api<{ posts: PostRecord[] }>('/api/posts?status=SCHEDULED&page=1'),
    ]).then(([pending, timed]) => {
      setQueue(pending.posts)
      setScheduled(timed.posts)
    })
  }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  async function tryPublish(post: PostRecord) {
    setError('')
    setNotice('')
    if (!post.approvedAt) {
      setError('A person has to approve this post before it can publish')
      return
    }
    try {
      await api(`/api/posts/${post.id}/publish`, { method: 'POST' })
      setNotice('Published')
      await load()
    } catch (cause) {
      setError(messageOf(cause))
    }
  }
  return (
    <section className="stack">
      <h1>Auto Posting</h1>
      <p>Approval queue and scheduled posts only. Nothing publishes without a person approving it first.</p>
      <p>Want a week or month of posts drafted for you? <Link to="/app/planner">Open the AI Schedule Planner</Link> and review each post before it is scheduled.</p>
      <Notice error={error} notice={notice} />
      <h2>Approval queue</h2>
      {queue.length === 0 ? <p>No posts waiting for approval.</p> : null}
      {queue.map((post) => (
        <article className="card stack" key={post.id}>
          <strong>{post.caption || post.description || 'Untitled'}</strong>
          <p>{post.format} · {post.status}{post.approvedAt ? ' · approved' : ' · not approved'}</p>
          <div className="row">
            <Link to={`/app/create?post=${post.id}`}>Open</Link>
            {canPublish ? (
              <button type="button" disabled={!post.approvedAt} onClick={() => void tryPublish(post)}>
                Publish
              </button>
            ) : null}
          </div>
        </article>
      ))}
      <h2>Scheduled</h2>
      {scheduled.length === 0 ? <p>No scheduled posts.</p> : null}
      {scheduled.map((post) => (
        <article className="card stack" key={post.id}>
          <strong>{post.caption || post.description || 'Untitled'}</strong>
          <p>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : 'No time'} · {post.approvedAt ? 'approved' : 'not approved'}</p>
          <div className="row">
            <Link to={`/app/create?post=${post.id}`}>Open</Link>
            {canPublish ? (
              <button type="button" disabled={!post.approvedAt} onClick={() => void tryPublish(post)}>
                Publish now
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  )
}

export function ContentLibraryPage() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [assets, setAssets] = useState<Array<{ id: string; url: string; mimeType: string; filename: string; kind: string; postId: string | null }>>([])
  const [drafts, setDrafts] = useState<PostRecord[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  function load(next = page) {
    return api<{ assets: typeof assets; drafts: PostRecord[]; page: number; total: number }>(`/api/library?page=${next}`)
      .then((body) => {
        setAssets(body.assets)
        setDrafts(body.drafts)
        setPage(body.page)
        setTotal(body.total)
      })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack">
      <h1>Content Library</h1>
      <p>This organization’s media and drafts. Delete asks for confirmation first. Want a head start? <Link to="/app/templates">Browse templates</Link>.</p>
      <Notice error={error} />
      <h2>Drafts</h2>
      {drafts.length === 0 ? <p>No drafts yet.</p> : null}
      {drafts.map((post) => (
        <article className="card row" key={post.id}>
          <div>
            <strong>{post.caption || post.description || 'Untitled'}</strong>
            <p>{post.format} · {post.status}</p>
          </div>
          <div className="row">
            <Link to={`/app/create?post=${post.id}`}>Open</Link>
            {canWrite && post.status !== 'PUBLISHED' && post.status !== 'PUBLISHING' ? (
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this draft')) return
                void api(`/api/posts/${post.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            ) : null}
          </div>
        </article>
      ))}
      <h2>Media</h2>
      <div className="library-grid">
        {assets.map((asset) => (
          <article className="card stack" key={asset.id}>
            {asset.mimeType.startsWith('video/')
              ? <video src={asset.url} controls muted playsInline />
              : <img src={asset.url} alt={asset.filename} />}
            <p>{asset.filename}</p>
            <div className="row">
              {asset.postId ? <Link to={`/app/create?post=${asset.postId}`}>Open</Link> : <a href={asset.url} target="_blank" rel="noreferrer">Open</a>}
              {canWrite ? (
                <button className="secondary" type="button" onClick={() => {
                  if (!confirmDelete('this media file')) return
                  void api(`/api/library/media/${asset.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
                }}>Delete</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {!assets.length ? <p>No media yet.</p> : null}
      <Pager page={page} total={total} onPage={setPage} label="Media" />
    </section>
  )
}

export function ModelStudioPage() {
  return (
    <section className="stack">
      <h1>Model Studio</h1>
      <p>This workspace uses platform providers only. There is no third-party model marketplace.</p>
      <article className="card stack">
        <h2>OpenAI</h2>
        <p>Creates photo drafts and captions from your description. The platform OpenAI key lives in Admin under Site settings → Provider secrets.</p>
      </article>
      <article className="card stack">
        <h2>Runway</h2>
        <p>Optional video generation for reels and wide videos when a Runway key is set. Without it, local designed video still runs.</p>
      </article>
      <p>
        Keys are set in the admin site:{' '}
        <a href="http://127.0.0.1:5174/settings">Admin → Site settings</a>
        . Customer accounts cannot paste provider keys here.
      </p>
    </section>
  )
}

type Campaign = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  postIds: string[]
}

type CampaignDashboard = {
  campaign: Campaign & { posts?: Array<{ id: string; caption: string; description: string; format: string; status: string }> }
  totals: { impressions: number | null; reach: number | null; engagement: number | null }
  series: { reach: Array<{ date: string; value: number }>; engagement: Array<{ date: string; value: number }> }
  byNetwork: Array<{ name: string; value: number }>
}

export function CampaignsPage() {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [posts, setPosts] = useState<PostRecord[]>([])
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  function load() {
    return Promise.all([
      api<{ campaigns: Campaign[] }>('/api/campaigns?page=1'),
      api<{ posts: PostRecord[] }>('/api/posts?page=1'),
    ]).then(([list, postList]) => {
      setCampaigns(list.campaigns)
      setPosts(postList.posts)
    })
  }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const body = await api<{ campaign: Campaign }>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          postIds: selected,
        }),
      })
      setName('')
      setSelected([])
      navigate(`/app/campaigns/${body.campaign.id}`)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }
  return (
    <section className="stack">
      <h1>Campaigns</h1>
      <p>Group your own posts and sum only stored official metrics. Empty stays empty. No ad buy and no competitor scrape.</p>
      <Notice error={error} />
      {canWrite ? (
        <form className="card stack" onSubmit={(event) => void onCreate(event)}>
          <h2>New campaign</h2>
          <label>Name<Hint>A short label for this group of posts.</Hint><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
          <div className="row">
            <label>Starts<Hint>First day of the campaign range.</Hint><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
            <label>Ends<Hint>Last day of the campaign range.</Hint><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label>
          </div>
          <fieldset className="stack">
            <legend>Attach posts</legend>
            {posts.map((post) => (
              <label key={post.id} className="row">
                <input
                  type="checkbox"
                  checked={selected.includes(post.id)}
                  onChange={(event) => {
                    setSelected((current) => event.target.checked ? [...current, post.id] : current.filter((id) => id !== post.id))
                  }}
                />
                <span>{post.caption || post.description || post.id} · {post.format}</span>
              </label>
            ))}
            {!posts.length ? <p>No posts to attach yet.</p> : null}
          </fieldset>
          <button type="submit">Create campaign</button>
        </form>
      ) : null}
      {campaigns.map((campaign) => (
        <article className="card row" key={campaign.id}>
          <div>
            <strong>{campaign.name}</strong>
            <p>{campaign.startsAt.slice(0, 10)} → {campaign.endsAt.slice(0, 10)} · {campaign.postIds.length} posts</p>
          </div>
          <div className="row">
            <Link to={`/app/campaigns/${campaign.id}`}>Open dashboard</Link>
            {canWrite ? (
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this campaign')) return
                void api(`/api/campaigns/${campaign.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            ) : null}
          </div>
        </article>
      ))}
      {!campaigns.length ? <p>No campaigns yet.</p> : null}
    </section>
  )
}

export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [data, setData] = useState<CampaignDashboard | null>(null)
  const [available, setAvailable] = useState<PostRecord[]>([])
  const [attachId, setAttachId] = useState('')
  const [error, setError] = useState('')
  function load() {
    return Promise.all([
      api<CampaignDashboard>(`/api/campaigns/${id}`),
      api<{ posts: PostRecord[] }>('/api/posts?page=1'),
    ]).then(([dashboard, posts]) => {
      setData(dashboard)
      const attached = new Set(dashboard.campaign.postIds)
      setAvailable(posts.posts.filter((post) => !attached.has(post.id)))
    })
  }
  useEffect(() => { if (id) load().catch((cause) => setError(messageOf(cause))) }, [id])
  const totals = data?.totals
  return (
    <section className="stack">
      <p><Link to="/app/campaigns">← Campaigns</Link></p>
      <h1>{data?.campaign.name ?? 'Campaign'}</h1>
      {data ? <p>{data.campaign.startsAt.slice(0, 10)} → {data.campaign.endsAt.slice(0, 10)}</p> : null}
      <Notice error={error} />
      <div className="cards">
        <article className="card"><span>Impressions</span><strong>{totals?.impressions ?? '—'}</strong></article>
        <article className="card"><span>Reach</span><strong>{totals?.reach ?? '—'}</strong></article>
        <article className="card"><span>Engagement</span><strong>{totals?.engagement ?? '—'}</strong></article>
      </div>
      <p>Totals use only stored official metrics for attached posts. Missing values stay blank.</p>
      <LineMetricsChart
        title="Reach and engagement"
        series={[
          { label: 'Reach', points: data?.series.reach ?? [], color: '#2f6fed' },
          { label: 'Engagement', points: data?.series.engagement ?? [], color: '#d6b25e' },
        ]}
      />
      <BarMetricsChart
        title="Reach by network"
        bars={(data?.byNetwork ?? []).map((row) => ({
          name: row.name in NETWORK_LABEL ? NETWORK_LABEL[row.name as keyof typeof NETWORK_LABEL] : row.name,
          value: row.value,
        }))}
      />
      <h2>Attached posts</h2>
      {data?.campaign.posts?.length ? data.campaign.posts.map((post) => (
        <article className="card row" key={post.id}>
          <div>
            <strong>{post.caption || post.description || 'Untitled'}</strong>
            <p>{post.format} · {post.status}</p>
          </div>
          <div className="row">
            <Link to={`/app/create?post=${post.id}`}>Open</Link>
            {canWrite ? (
              <button className="secondary" type="button" onClick={() => {
                void api(`/api/campaigns/${id}/posts/${post.id}`, { method: 'DELETE' })
                  .then(() => load())
                  .catch((cause) => setError(messageOf(cause)))
              }}>Detach</button>
            ) : null}
          </div>
        </article>
      )) : <p>No posts attached.</p>}
      {canWrite ? (
        <form className="row" onSubmit={(event) => {
          event.preventDefault()
          if (!attachId) return
          void api(`/api/campaigns/${id}/posts`, { method: 'POST', body: JSON.stringify({ postIds: [attachId] }) })
            .then(() => { setAttachId(''); return load() })
            .catch((cause) => setError(messageOf(cause)))
        }}>
          <label>Attach a post
            <Hint>Links an existing draft or published post to this campaign.</Hint>
            <select value={attachId} onChange={(event) => setAttachId(event.target.value)}>
              <option value="">Choose a post</option>
              {available.map((post) => (
                <option key={post.id} value={post.id}>{post.caption || post.description || post.id}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!attachId}>Attach</button>
        </form>
      ) : null}
    </section>
  )
}
