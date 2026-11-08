import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from './lib/api'
import { Hint, Pager, confirmDelete } from './lib/form'
import { Switch } from './lib/switch'
import {
  DEFAULT_SLOTS,
  SLOT_POSITIONS,
  faceSwitchNotice,
  lengthsFor,
  newSlot,
  parseTags,
  slotProblem,
  templateQuery,
  type Slot,
  type TemplateRow,
} from './lib/templates'

type Staff = { id: string; email: string; name: string; role: 'SUPER_ADMIN' | 'SUPPORT' }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function FaceSwitch({ superAdmin, onChange }: { superAdmin: boolean; onChange?: (enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    api<{ facePersonalization: boolean }>('/api/admin/templates?page=1')
      .then((body) => setEnabled(body.facePersonalization))
      .catch((cause) => setError(messageOf(cause)))
  }, [])
  async function toggle(next: boolean) {
    const previous = enabled
    setPending(true)
    setError('')
    setEnabled(next)
    setNotice(faceSwitchNotice(next))
    try {
      const body = await api<{ facePersonalization: boolean }>('/api/admin/templates/face-switch', { method: 'PUT', body: JSON.stringify({ enabled: next }) })
      setEnabled(body.facePersonalization)
      onChange?.(body.facePersonalization)
    } catch (cause) {
      setEnabled(previous)
      setNotice('')
      setError(messageOf(cause))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="card stack">
      <h2>Face personalization</h2>
      {error ? <p className="error">{error}</p> : null}
      <p role="status" aria-live="polite">{notice}</p>
      <div className="provider-field">
        <strong>Let customers add a face photo to a template</strong>
        <div className="provider-switch">
          <Switch
            id="switch-face-personalization"
            label="Face personalization"
            checked={enabled !== false}
            disabled={!superAdmin || enabled === null || pending}
            describedBy="switch-help-face-personalization"
            onChange={(next) => void toggle(next)}
          />
          <small className="hint" id="switch-help-face-personalization">
            Off keeps every template and the text editor, but turns off face photo uploads and the AI likeness edit for the whole site.
            {superAdmin ? '' : ' Only a Super Admin can change this.'}
          </small>
        </div>
      </div>
    </div>
  )
}

type FormState = {
  id: string | null
  title: string
  kind: TemplateRow['kind']
  orientation: TemplateRow['orientation']
  durationSeconds: number
  category: string
  tags: string
  accentColor: string
  motionPrompt: string
  hasFaceSlot: boolean
  status: TemplateRow['status']
  slots: Slot[]
}

function blankForm(): FormState {
  return {
    id: null,
    title: '',
    kind: 'poster',
    orientation: 'square',
    durationSeconds: 8,
    category: '',
    tags: '',
    accentColor: '#2f6fed',
    motionPrompt: '',
    hasFaceSlot: true,
    status: 'draft',
    slots: DEFAULT_SLOTS.map((slot) => ({ ...slot })),
  }
}

function fromRow(row: TemplateRow): FormState {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    orientation: row.orientation,
    durationSeconds: row.durationSeconds ?? 8,
    category: row.category,
    tags: row.tags.join(', '),
    accentColor: row.accentColor ?? '#2f6fed',
    motionPrompt: row.motionPrompt,
    hasFaceSlot: row.hasFaceSlot,
    status: row.status,
    slots: row.textSlots.map((slot) => ({ ...slot })),
  }
}

const KIND_LABEL: Record<TemplateRow['kind'], string> = { photo: 'Photo', poster: 'Poster', video: 'Video' }

export function TemplatesPage() {
  const { staff } = useOutletContext<{ staff: Staff }>()
  const superAdmin = staff.role === 'SUPER_ADMIN'
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [filters, setFilters] = useState({ q: '', sort: 'newest', kind: '', status: '', orientation: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [form, setForm] = useState<FormState | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function load(next = page) {
    return api<{ templates: TemplateRow[]; page: number; total: number }>(`/api/admin/templates?${templateQuery(filters, next)}`).then((body) => {
      if (!body.templates.length && body.page > 1) { setPage(body.page - 1); return }
      setRows(body.templates)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page, filters])

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current))
  }
  function patchSlot(index: number, patch: Partial<Slot>) {
    setForm((current) => current && { ...current, slots: current.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) })
  }
  function filter(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }

  async function upload(id: string, file: File, kind: 'source' | 'thumbnail') {
    const data = new FormData()
    data.set('file', file)
    await api(`/api/admin/templates/${id}/image?kind=${kind}`, { method: 'POST', body: data })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || !superAdmin) return
    setError('')
    setNotice('')
    const problem = slotProblem(form.slots)
    if (problem) { setError(problem); return }
    setBusy(true)
    const body = {
      title: form.title,
      kind: form.kind,
      orientation: form.kind === 'video' && form.orientation === 'square' ? 'portrait' : form.orientation,
      durationSeconds: form.kind === 'video' ? form.durationSeconds : null,
      category: form.category,
      tags: parseTags(form.tags),
      accentColor: form.accentColor || null,
      motionPrompt: form.kind === 'video' ? form.motionPrompt : '',
      hasFaceSlot: form.hasFaceSlot,
      status: form.status,
      textSlots: form.slots,
    }
    try {
      const saved = await api<{ template: TemplateRow }>(form.id ? `/api/admin/templates/${form.id}` : '/api/admin/templates', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (sourceFile) await upload(saved.template.id, sourceFile, 'source')
      if (thumbFile) await upload(saved.template.id, thumbFile, 'thumbnail')
      setNotice(form.id ? 'Template saved' : 'Template added')
      setForm(null)
      setSourceFile(null)
      setThumbFile(null)
      await load(form.id ? page : 1)
      if (!form.id) setPage(1)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(row: TemplateRow, status: TemplateRow['status']) {
    setError('')
    try {
      await api(`/api/admin/templates/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setNotice(status === 'published' ? `${row.title} is published` : `${row.title} is now a draft`)
      await load()
    } catch (cause) {
      setError(messageOf(cause))
    }
  }

  const lengths = form ? lengthsFor(form.kind, form.orientation === 'square' ? 'portrait' : form.orientation) : []

  return (
    <section className="stack">
      <h1>Templates</h1>
      <p>The starter catalog customers pick from. Published templates show in every customer gallery. Drafts stay hidden.</p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <FaceSwitch superAdmin={superAdmin} />
      <div className="card stack">
        <h2>Find templates</h2>
        <div className="filter-grid">
          <label>Search<Hint>Matches the title, category, and tags.</Hint><input value={filters.q} onChange={(event) => filter({ q: event.target.value })} placeholder="Search templates" /></label>
          <label>Sort<Hint>Newest first, most used first, or A to Z.</Hint>
            <select value={filters.sort} onChange={(event) => filter({ sort: event.target.value })}>
              <option value="newest">Newest</option>
              <option value="popular">Most used</option>
              <option value="name">Name A-Z</option>
            </select>
          </label>
          <label>Format<Hint>Show one kind of template.</Hint>
            <select value={filters.kind} onChange={(event) => filter({ kind: event.target.value })}>
              <option value="">All formats</option>
              <option value="photo">Photo</option>
              <option value="poster">Poster</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label>Orientation<Hint>Square, portrait (story or reel), or landscape.</Hint>
            <select value={filters.orientation} onChange={(event) => filter({ orientation: event.target.value })}>
              <option value="">Any shape</option>
              <option value="square">Square</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>Status<Hint>Drafts are hidden from customers.</Hint>
            <select value={filters.status} onChange={(event) => filter({ status: event.target.value })}>
              <option value="">Draft and published</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
        </div>
      </div>
      {superAdmin ? (
        <div className="row">
          <button type="button" onClick={() => { setForm(blankForm()); setSourceFile(null); setThumbFile(null); setError(''); setNotice('') }}>Add template</button>
          <button className="secondary" type="button" onClick={() => {
            setError('')
            void api<{ created: number; skipped: number }>('/api/admin/templates/seed', { method: 'POST' })
              .then((result) => { setNotice(result.created ? `Added ${result.created} starter templates` : 'The starter templates are already in the catalog'); return load(1) })
              .catch((cause) => setError(messageOf(cause)))
          }}>Add starter templates</button>
        </div>
      ) : <p>Support can browse the catalog. Only a Super Admin can add, edit, publish, or delete templates.</p>}
      {form ? (
        <form className="card stack" onSubmit={(event) => void save(event)}>
          <h2>{form.id ? 'Edit template' : 'Add template'}</h2>
          <label>Title<Hint>The name customers see on the card.</Hint><input value={form.title} maxLength={120} required onChange={(event) => patchForm({ title: event.target.value })} /></label>
          <label>Format<Hint>Photo and poster make a still image. Video makes a short clip from a personalized first frame.</Hint>
            <select value={form.kind} onChange={(event) => patchForm({ kind: event.target.value as FormState['kind'], orientation: event.target.value === 'video' && form.orientation === 'square' ? 'portrait' : form.orientation })}>
              <option value="photo">Photo</option>
              <option value="poster">Poster</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label>Orientation<Hint>Portrait becomes a Story (photo, poster) or a Reel (video). Landscape video becomes a wide video.</Hint>
            <select value={form.orientation} onChange={(event) => patchForm({ orientation: event.target.value as FormState['orientation'] })}>
              {form.kind !== 'video' ? <option value="square">Square</option> : null}
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          {form.kind === 'video' ? (
            <label>Length in seconds<Hint>A Reel can be 4, 8, or 12 seconds. A wide video can be 8, 15, or 30.</Hint>
              <select value={form.durationSeconds} onChange={(event) => patchForm({ durationSeconds: Number(event.target.value) })}>
                {lengths.map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
              </select>
            </label>
          ) : null}
          <label>Category<Hint>A short group such as Retail or Events. Customers can filter by it.</Hint><input value={form.category} maxLength={60} onChange={(event) => patchForm({ category: event.target.value })} /></label>
          <label>Tags<Hint>Comma-separated words that help search, up to 8.</Hint><input value={form.tags} onChange={(event) => patchForm({ tags: event.target.value })} /></label>
          <label>Accent color<Hint>The poster color when a customer has no brand kit color. Use a hex value such as #2f6fed.</Hint><input value={form.accentColor} pattern="#?[0-9a-fA-F]{6}" onChange={(event) => patchForm({ accentColor: event.target.value })} /></label>
          {form.kind === 'video' ? (
            <label>Motion prompt<Hint>Tells Runway how the first frame should move, for example a slow push-in. Up to 1000 characters.</Hint><textarea rows={3} maxLength={1000} value={form.motionPrompt} onChange={(event) => patchForm({ motionPrompt: event.target.value })} /></label>
          ) : null}
          <label className="checkline"><span>Face slot</span><input type="checkbox" checked={form.hasFaceSlot} onChange={(event) => patchForm({ hasFaceSlot: event.target.checked })} /><Hint>On lets customers add their own face photo to this template.</Hint></label>
          <label>Status<Hint>Only published templates appear for customers.</Hint>
            <select value={form.status} onChange={(event) => patchForm({ status: event.target.value as FormState['status'] })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <h3>Text slots</h3>
          <Hint>Each slot is one piece of text the customer can edit. A template needs one headline. Subline and call to action are optional, and up to 3 badges become chips.</Hint>
          {form.slots.map((slot, index) => (
            <div className="card stack slot-card" key={index}>
              <div className="filter-grid">
                <label>Key<Hint>A short id with lowercase letters, numbers, and underscores.</Hint><input value={slot.key} maxLength={24} onChange={(event) => patchSlot(index, { key: event.target.value })} /></label>
                <label>Label<Hint>The field name the customer sees.</Hint><input value={slot.label} maxLength={60} onChange={(event) => patchSlot(index, { label: event.target.value })} /></label>
                <label>Where it goes<Hint>Headline is the big title. Badge is a small chip.</Hint>
                  <select value={slot.position} onChange={(event) => patchSlot(index, { position: event.target.value as Slot['position'] })}>
                    {SLOT_POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                  </select>
                </label>
                <label>Starting text<Hint>What shows until the customer changes it.</Hint><input value={slot.default} maxLength={200} onChange={(event) => patchSlot(index, { default: event.target.value })} /></label>
                <label>Maximum characters<Hint>How long the customer’s text can be, up to 200.</Hint><input type="number" min={1} max={200} value={slot.maxLength} onChange={(event) => patchSlot(index, { maxLength: Number(event.target.value) || 1 })} /></label>
                <label className="checkline"><span>Required</span><input type="checkbox" checked={slot.required} onChange={(event) => patchSlot(index, { required: event.target.checked })} /><Hint>On means the customer cannot leave it empty.</Hint></label>
              </div>
              <div className="row">
                <button className="secondary" type="button" onClick={() => {
                  if (!confirmDelete(`the "${slot.label}" text slot`)) return
                  patchForm({ slots: form.slots.filter((_, i) => i !== index) })
                }}>Delete slot</button>
              </div>
            </div>
          ))}
          <div className="row"><button className="secondary" type="button" disabled={form.slots.length >= 6} onClick={() => patchForm({ slots: [...form.slots, newSlot(form.slots)] })}>Add text slot</button></div>
          <label>Source image<Hint>Optional PNG, JPEG, or WebP shown inside the template. Leave empty to keep the current one or draw a new one from the accent color.</Hint><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setSourceFile(event.target.files?.[0] ?? null)} /></label>
          <label>Thumbnail<Hint>Optional card image. Leave empty to build it from the source and the starting text.</Hint><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setThumbFile(event.target.files?.[0] ?? null)} /></label>
          <div className="row">
            <button type="submit" disabled={busy}>{form.id ? 'Save template' : 'Add template'}</button>
            <button className="secondary" type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {rows.length === 0 ? <p>No templates match.</p> : null}
      <div className="template-grid">
        {rows.map((row) => (
          <article className="card stack" key={row.id}>
            {row.thumbnailUrl ? <img className="template-thumb" src={row.thumbnailUrl} alt={`${row.title} preview`} loading="lazy" /> : <div className="template-thumb empty">No image</div>}
            <strong>{row.title}</strong>
            <div className="row">
              <span className="badge">{KIND_LABEL[row.kind]}{row.durationSeconds ? ` · ${row.durationSeconds}s` : ''}</span>
              <span className="badge">{row.orientation}</span>
              <span className={row.status === 'published' ? 'badge ok' : 'badge'}>{row.status}</span>
              {row.hasFaceSlot ? <span className="badge">face</span> : null}
            </div>
            <small className="hint">{row.category || 'No category'} · used {row.useCount} {row.useCount === 1 ? 'time' : 'times'}</small>
            {superAdmin ? (
              <div className="row">
                <button type="button" onClick={() => { setForm(fromRow(row)); setSourceFile(null); setThumbFile(null); setError(''); setNotice('') }}>Edit</button>
                <button className="secondary" type="button" onClick={() => void setStatus(row, row.status === 'published' ? 'draft' : 'published')}>{row.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                <button className="secondary" type="button" onClick={() => {
                  if (!confirmDelete(`the template "${row.title}"`)) return
                  void api(`/api/admin/templates/${row.id}`, { method: 'DELETE' }).then(() => { setNotice('Template deleted'); return load() }).catch((cause) => setError(messageOf(cause)))
                }}>Delete</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Templates" />
    </section>
  )
}
