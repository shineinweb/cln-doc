import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { roleHas, type OrgRole } from '@instagram-ai/shared'
import { api } from '../lib/api'
import { Hint, Pager, confirmDelete } from '../lib/form'
import {
  CONSENT_LABEL,
  EMPTY_FILTERS,
  FACE_TERMS,
  TEMPLATE_SORTS,
  TEMPLATE_TABS,
  galleryQuery,
  generateBlocker,
  kindLabel,
  orientationFor,
  slotIssues,
  slotsFromPost,
  startingValues,
  templateKindFor,
  type FacePhoto,
  type GalleryFilters,
  type TemplateCardData,
  type TemplateTab,
} from '../lib/templates'
import type { PostRecord } from '../lib/types'
import { useSession } from './shell'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function Notice({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
    </>
  )
}

type LibraryAsset = { id: string; url: string; mimeType: string; filename: string; kind: string }

export function TemplatesPage() {
  const session = useSession()
  const navigate = useNavigate()
  const canWrite = roleHas(session.role as OrgRole, 'ai.use') && roleHas(session.role as OrgRole, 'posts.write')
  return <TemplateGallery canWrite={canWrite} onOpenDraft={(postId) => navigate(`/app/create?post=${postId}`)} />
}

export function TemplateGallery({ canWrite, onOpenDraft }: { canWrite: boolean; onOpenDraft: (postId: string) => void }) {
  const [filters, setFilters] = useState<GalleryFilters>(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<TemplateCardData[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [faceOn, setFaceOn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TemplateCardData | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.q === search ? current : { ...current, q: search }))
      setPage(1)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  function load(next = page) {
    setLoading(true)
    return api<{ templates: TemplateCardData[]; categories: string[]; page: number; total: number; facePersonalization: boolean }>(`/api/templates?${galleryQuery(filters, next)}`)
      .then((body) => {
        if (!body.templates.length && body.page > 1) {
          setPage(body.page - 1)
          return
        }
        setItems(body.templates)
        setCategories(body.categories)
        setTotal(body.total)
        setFaceOn(body.facePersonalization)
        setError('')
      })
      .catch((cause) => setError(messageOf(cause)))
      .finally(() => setLoading(false))
  }
  useEffect(() => { void load(page) }, [page, filters])

  function change(patch: Partial<GalleryFilters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  return (
    <section className="stack">
      <h1>Templates</h1>
      <p>Pick a sample photo, poster, or video, change its text, add your own face photo if you like, and make a draft. Nothing is published until a person approves it.</p>
      <Notice error={error} notice={notice} />
      {!faceOn ? <p className="notice">Face personalization is turned off by the admin. You can still edit a template’s text.</p> : null}
      <div className="tabs" role="tablist" aria-label="Template groups">
        {TEMPLATE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filters.tab === tab.id}
            className={filters.tab === tab.id ? 'tab active' : 'tab secondary'}
            onClick={() => change({ tab: tab.id as TemplateTab })}
          >{tab.label}</button>
        ))}
      </div>
      <div className="card stack">
        <div className="filter-grid">
          <label>Search<Hint>Matches the title, tags, and category.</Hint>
            <input type="search" value={search} placeholder="Search templates" onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>Sort<Hint>Newest first, most used first, or A to Z.</Hint>
            <select value={filters.sort} onChange={(event) => change({ sort: event.target.value })}>
              {TEMPLATE_SORTS.map((sort) => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
            </select>
          </label>
          <label>Format<Hint>Show only photos, posters, or videos.</Hint>
            <select value={filters.kind} onChange={(event) => change({ kind: event.target.value })}>
              <option value="">All formats</option>
              <option value="photo">Photo</option>
              <option value="poster">Poster</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label>Shape<Hint>Square, portrait for Stories and Reels, or landscape.</Hint>
            <select value={filters.orientation} onChange={(event) => change({ orientation: event.target.value })}>
              <option value="">Any shape</option>
              <option value="square">Square</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>Category<Hint>Group templates by topic.</Hint>
            <select value={filters.category} onChange={(event) => change({ category: event.target.value })}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
        </div>
      </div>
      {loading && !items.length ? <p>Loading templates…</p> : null}
      {!loading && !items.length ? (
        <p>
          {filters.tab === 'mine'
            ? 'You have no private templates yet. Open a post in Create and choose Save as template.'
            : filters.tab === 'recent'
              ? 'You have not used a template yet.'
              : 'No templates match. Try a different search or filter.'}
        </p>
      ) : null}
      <div className="template-grid">
        {items.map((item) => (
          <article className="card stack template-card" key={item.id}>
            <button type="button" className="template-open" onClick={() => setSelected(item)} aria-label={`Open ${item.title}`}>
              {item.thumbnailUrl ? <img className={`template-thumb ${item.orientation}`} src={item.thumbnailUrl} alt={`${item.title} preview`} loading="lazy" /> : <span className="template-thumb empty">No image</span>}
            </button>
            <strong className="template-title">{item.title}</strong>
            <div className="row">
              <span className="badge">{kindLabel(item)}</span>
              <span className="badge">{item.orientation}</span>
              {item.hasFaceSlot && faceOn ? <span className="badge">Face</span> : null}
              {item.mine ? <span className="badge ok">Mine</span> : null}
            </div>
            <small className="hint">{item.category || 'General'} · used {item.useCount} {item.useCount === 1 ? 'time' : 'times'}</small>
            <button type="button" onClick={() => setSelected(item)}>Use template</button>
          </article>
        ))}
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Templates" />
      {selected ? (
        <TemplateDrawer
          key={selected.id}
          template={selected}
          faceOn={faceOn}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onOpenDraft={onOpenDraft}
          onChanged={(message) => { setSelected(null); setNotice(message); void load() }}
        />
      ) : null}
    </section>
  )
}

export function TemplateDrawer({
  template,
  faceOn,
  canWrite,
  onClose,
  onOpenDraft,
  onChanged,
}: {
  template: TemplateCardData
  faceOn: boolean
  canWrite: boolean
  onClose: () => void
  onOpenDraft: (postId: string) => void
  onChanged: (message: string) => void
}) {
  const slots = template.textSlots
  const [values, setValues] = useState<Record<string, string>>(() => startingValues(slots))
  const [faces, setFaces] = useState<FacePhoto[]>([])
  const [library, setLibrary] = useState<LibraryAsset[]>([])
  const [faceId, setFaceId] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [details, setDetails] = useState({ title: template.title, category: template.category, tags: template.tags.join(', ') })
  const request = useRef(0)
  const faceActive = faceOn && template.hasFaceSlot
  const issues = slotIssues(slots, values)
  const blocker = generateBlocker({ slots, values, faceId, consent, canWrite })
  const chosenFace = faces.find((face) => face.id === faceId)?.url ?? library.find((asset) => asset.id === faceId)?.url ?? null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!faceActive) return
    api<{ faces: FacePhoto[] }>('/api/templates/faces').then((body) => setFaces(body.faces)).catch(() => setFaces([]))
    api<{ assets: LibraryAsset[] }>('/api/library?page=1')
      .then((body) => setLibrary(body.assets.filter((asset) => asset.mimeType.startsWith('image/'))))
      .catch(() => setLibrary([]))
  }, [faceActive])

  useEffect(() => {
    if (Object.keys(issues).length) return
    const ticket = request.current + 1
    request.current = ticket
    const timer = window.setTimeout(() => {
      setPreviewing(true)
      api<{ image: string }>(`/api/templates/${template.id}/preview`, {
        method: 'POST',
        body: JSON.stringify({ values, faceAssetId: consent && faceId ? faceId : undefined, consent: consent && faceId ? true : undefined }),
      })
        .then((body) => { if (request.current === ticket) { setPreview(body.image); setError('') } })
        .catch((cause) => { if (request.current === ticket) setError(messageOf(cause)) })
        .finally(() => { if (request.current === ticket) setPreviewing(false) })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [template.id, values, faceId, consent])

  async function uploadFace(file: File) {
    setError('')
    setNotice('')
    try {
      const data = new FormData()
      data.set('file', file)
      const body = await api<{ face: FacePhoto }>('/api/templates/faces?consent=1', { method: 'POST', body: data })
      setFaces((current) => [body.face, ...current])
      setFaceId(body.face.id)
      setNotice('Face photo added. It is deleted automatically after 30 days.')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  async function removeFace(face: FacePhoto) {
    if (!confirmDelete('this face photo')) return
    try {
      await api(`/api/templates/faces/${face.id}`, { method: 'DELETE' })
      setFaces((current) => current.filter((item) => item.id !== face.id))
      if (faceId === face.id) setFaceId(null)
      setNotice('Face photo deleted')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  async function generate() {
    if (blocker) { setError(blocker); return }
    setBusy(true)
    setError('')
    try {
      const body = await api<{ post: PostRecord }>(`/api/templates/${template.id}/personalize`, {
        method: 'POST',
        body: JSON.stringify({ values, faceAssetId: faceId ?? undefined, consent: faceId ? consent : undefined }),
      })
      onOpenDraft(body.post.id)
    } catch (cause) {
      setError(messageOf(cause))
      setBusy(false)
    }
  }

  async function saveDetails() {
    setError('')
    try {
      await api(`/api/templates/${template.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: details.title,
          category: details.category,
          tags: details.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        }),
      })
      onChanged('Template saved')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  async function removeTemplate() {
    if (!confirmDelete(`the template "${template.title}"`)) return
    try {
      await api(`/api/templates/${template.id}`, { method: 'DELETE' })
      onChanged('Template deleted')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  const video = template.kind === 'video'
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="template-drawer" role="dialog" aria-modal="true" aria-label={`Personalize ${template.title}`} onClick={(event) => event.stopPropagation()}>
        <div className="row spread">
          <h2>{template.title}</h2>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
        <div className="row">
          <span className="badge">{kindLabel(template)}</span>
          <span className="badge">{template.orientation}</span>
          <span className="badge">Makes a {template.format}</span>
        </div>
        <div className={`template-preview ${template.orientation}`} aria-live="polite">
          {preview || template.thumbnailUrl ? <img src={preview ?? template.thumbnailUrl ?? ''} alt={`Preview of ${template.title}`} /> : <span>No preview</span>}
          {previewing ? <span className="preview-busy">Updating preview…</span> : null}
        </div>
        <Hint>The preview shows your text, your brand color and logo. The AI likeness edit only runs when you press Generate.</Hint>
        <Notice error={error} notice={notice} />
        <form className="stack" onSubmit={(event) => { event.preventDefault(); void generate() }}>
          <h3>Your text</h3>
          {slots.map((slot) => (
            <label key={slot.key}>
              {slot.label}{slot.required ? ' (required)' : ''}
              <Hint>{`${slot.position === 'headline' ? 'The big title' : slot.position === 'subline' ? 'The supporting line' : slot.position === 'cta' ? 'The button text' : 'A small chip'}. Up to ${slot.maxLength} characters.`}</Hint>
              <input
                value={values[slot.key] ?? ''}
                maxLength={slot.maxLength}
                aria-invalid={Boolean(issues[slot.key])}
                disabled={!canWrite}
                onChange={(event) => setValues((current) => ({ ...current, [slot.key]: event.target.value }))}
              />
              {issues[slot.key] ? <small className="field-error">{issues[slot.key]}</small> : null}
            </label>
          ))}
          {faceActive ? (
            <fieldset className="stack face-box">
              <legend>Your face photo (optional)</legend>
              <Hint>A clear photo of one person, facing the camera. It is placed in the template as a portrait.</Hint>
              <label className="checkline">
                <input type="checkbox" checked={consent} disabled={!canWrite} onChange={(event) => setConsent(event.target.checked)} />
                <span>{CONSENT_LABEL}</span>
                <Hint>Required before you upload or use a face photo.</Hint>
              </label>
              <label>Upload a photo
                <Hint>PNG, JPEG, or WebP. Needs the consent box ticked first.</Hint>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={!canWrite || !consent}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void uploadFace(file)
                  }}
                />
              </label>
              {faces.length ? (
                <div className="face-list" role="radiogroup" aria-label="Your face photos">
                  {faces.map((face) => (
                    <div className={faceId === face.id ? 'face-item active' : 'face-item'} key={face.id}>
                      <button type="button" role="radio" aria-checked={faceId === face.id} className="secondary" onClick={() => setFaceId(faceId === face.id ? null : face.id)}>
                        <img src={face.url} alt={face.filename} />
                      </button>
                      <small className="hint">{face.deleteAfter ? `Deleted ${new Date(face.deleteAfter).toLocaleDateString()}` : 'Kept'}</small>
                      <button type="button" className="secondary" onClick={() => void removeFace(face)}>Delete</button>
                    </div>
                  ))}
                </div>
              ) : null}
              {library.length ? (
                <label>Or choose from the Content Library
                  <Hint>Pick a photo you already uploaded.</Hint>
                  <select value={library.some((asset) => asset.id === faceId) ? faceId ?? '' : ''} onChange={(event) => setFaceId(event.target.value || null)}>
                    <option value="">None</option>
                    {library.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}
                  </select>
                </label>
              ) : null}
              {chosenFace ? <img className="face-chosen" src={chosenFace} alt="Chosen face photo" /> : null}
              <p className="hint">{FACE_TERMS}</p>
            </fieldset>
          ) : null}
          {video ? <p className="hint">Videos start from your personalized first frame and are animated by Runway when it is on. The face moves approximately, it is not a frame-accurate swap. Without Runway you get a designed local ad built from that frame.</p> : null}
          <p className="hint">Results are drafts. You review and approve them in Create before anything publishes. Label them as AI-generated on networks that ask for it.</p>
          <div className="row">
            <button type="submit" disabled={busy || Boolean(blocker)}>{busy ? 'Generating…' : 'Generate'}</button>
            {blocker && canWrite ? <small className="hint">{blocker}</small> : null}
          </div>
        </form>
        {template.mine && canWrite ? (
          <div className="stack">
            <h3>Template details</h3>
            <label>Title<Hint>The name on your template card.</Hint><input value={details.title} maxLength={120} onChange={(event) => setDetails((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Category<Hint>A short group name for filtering.</Hint><input value={details.category} maxLength={60} onChange={(event) => setDetails((current) => ({ ...current, category: event.target.value }))} /></label>
            <label>Tags<Hint>Comma-separated words that help search.</Hint><input value={details.tags} onChange={(event) => setDetails((current) => ({ ...current, tags: event.target.value }))} /></label>
            <div className="row">
              <button type="button" className="secondary" onClick={() => void saveDetails()}>Save details</button>
              <button type="button" className="secondary" onClick={() => void removeTemplate()}>Delete template</button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export function SaveAsTemplate({ post }: { post: PostRecord }) {
  const session = useSession()
  const canWrite = roleHas(session.role as OrgRole, 'posts.write')
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const usable = post.media.some((item) => item.mimeType.startsWith('image/')) || Boolean(post.reference)
  if (!canWrite || !usable) return null
  async function save() {
    setError('')
    try {
      await api('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          kind: templateKindFor(post.format),
          orientation: orientationFor(post.format),
          durationSeconds: templateKindFor(post.format) === 'video' ? post.durationSeconds ?? undefined : undefined,
          category: 'My templates',
          tags: [],
          hasFaceSlot: true,
          motionPrompt: templateKindFor(post.format) === 'video' ? post.aiInstructions ?? '' : '',
          textSlots: slotsFromPost(post),
          postId: post.id,
        }),
      })
      setNotice('Saved to your templates.')
      setOpen(false)
      setTitle('')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }
  return (
    <div className="stack">
      <Notice error={error} notice={notice} />
      {notice ? <Link to="/app/templates">Open My templates</Link> : null}
      {open ? (
        <div className="stack">
          <label>Template title
            <Hint>The name this private template gets. Only your organization can see it.</Hint>
            <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="row">
            <button type="button" disabled={!title.trim()} onClick={() => void save()}>Save template</button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="secondary" onClick={() => { setOpen(true); setNotice('') }}>Save as template</button>
      )}
    </div>
  )
}
