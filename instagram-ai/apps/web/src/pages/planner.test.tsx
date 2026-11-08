import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanPost, PlanRecord } from '../lib/planner'
import { PlanForm, PlanReview, type ReviewProps } from './planner'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLElement

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host.remove()
  vi.restoreAllMocks()
})

function mount(node: React.ReactNode) {
  root = createRoot(host)
  act(() => root?.render(<MemoryRouter>{node}</MemoryRouter>))
}

function setValue(element: Element, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  act(() => {
    setter?.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}

function click(element: Element | null | undefined) {
  if (!element) throw new Error('Nothing to click')
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function button(label: string | RegExp, scope: ParentNode = host): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((item) => (typeof label === 'string' ? item.textContent === label : label.test(item.textContent ?? '')))
}

const NOW = new Date('2027-01-10T08:00:00.000Z')

const accounts = [{ id: 'fb1', network: 'facebook', displayName: 'Cafe page', username: 'cafe', status: 'connected', lastError: null, instagramAccountId: null }]

describe('plan form', () => {
  it('explains each field and blocks an incomplete plan', () => {
    const onSubmit = vi.fn()
    mount(<PlanForm accounts={accounts} campaigns={[]} audience={[]} timeZone="UTC" busy={false} now={NOW} onSubmit={onSubmit} />)
    expect(host.querySelectorAll('small.hint').length).toBeGreaterThanOrEqual(12)
    click(button('Generate plan'))
    expect(onSubmit).not.toHaveBeenCalled()
    const alert = host.querySelector('[role="alert"]')
    expect(alert?.textContent).toMatch(/account/)
    expect(alert?.textContent).toMatch(/goal/)
  })

  it('submits a valid plan and shows how many posts it will draft', () => {
    const onSubmit = vi.fn()
    mount(<PlanForm accounts={accounts} campaigns={[{ id: 'c1', name: 'Spring' }]} audience={[]} timeZone="UTC" busy={false} now={NOW} onSubmit={onSubmit} />)
    expect(host.textContent).toContain('No audience data yet')
    click([...host.querySelectorAll('label.checkline')].find((label) => label.textContent?.includes('Cafe page'))?.querySelector('input'))
    setValue(host.querySelector('input[placeholder="Promote the spring menu"]') as Element, 'Promote the spring menu')
    setValue(host.querySelector('select') as Element, 'week')
    expect(host.textContent).toContain('This will draft 7 posts')
    click(button('Generate plan'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ range: 'week', goal: 'Promote the spring menu', socialAccountIds: ['fb1'], startDate: '2027-01-11' })
  })

  it('warns when a month would be too long', () => {
    const onSubmit = vi.fn()
    mount(<PlanForm accounts={accounts} campaigns={[]} audience={[]} timeZone="UTC" busy={false} now={NOW} onSubmit={onSubmit} />)
    click([...host.querySelectorAll('label.checkline')].find((label) => label.textContent?.includes('Cafe page'))?.querySelector('input'))
    setValue(host.querySelector('input[placeholder="Promote the spring menu"]') as Element, 'Promote the spring menu')
    setValue(host.querySelectorAll('select')[0] as Element, 'month')
    setValue(host.querySelectorAll('select')[1] as Element, '3')
    click(button('Generate plan'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/at most 31/)
  })
})

const plan: PlanRecord = {
  id: 'plan1',
  range: 'week',
  startsAt: '2027-01-11T10:00:00.000Z',
  endsAt: '2027-01-13T10:00:00.000Z',
  status: 'proposed',
  campaignId: null,
  counts: { total: 3, pending: 2, scheduled: 1, published: 0, failed: 0 },
  createdAt: '2027-01-10T08:00:00.000Z',
  inputs: { goal: 'Spring menu', postsPerDay: 1, formats: ['photo'], socialAccountIds: ['fb1'] },
}

function post(id: string, extra: Partial<PlanPost> = {}): PlanPost {
  return {
    id,
    status: 'PENDING_APPROVAL',
    format: 'photo',
    description: `Topic ${id}`,
    caption: `Caption ${id}`,
    hashtags: [{ tag: 'latte', enabled: true }],
    scheduledAt: '2027-01-11T10:00:00.000Z',
    approvedAt: null,
    claimsNeedReview: false,
    publishError: null,
    mediaState: 'none',
    mediaError: null,
    media: [],
    ...extra,
  }
}

const posts = [
  post('p1'),
  post('p2', { scheduledAt: '2027-01-12T10:00:00.000Z' }),
  post('p3', { status: 'SCHEDULED', approvedAt: '2027-01-10T09:00:00.000Z', scheduledAt: '2027-01-13T10:00:00.000Z', mediaState: 'ready' }),
]

function handlers() {
  return {
    onPage: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onApprove: vi.fn(),
    onRegenerate: vi.fn(),
    onMedia: vi.fn(),
    onDeleteSelected: vi.fn(),
    onRegeneratePlan: vi.fn(),
  }
}

function Harness(props: Partial<ReviewProps> & { fns: ReturnType<typeof handlers> }) {
  const [selected, setSelected] = useState<string[]>([])
  const { fns, ...rest } = props
  return (
    <PlanReview
      plan={plan}
      posts={posts}
      timeZone="UTC"
      view="list"
      page={1}
      total={3}
      selected={selected}
      canWrite
      canApprove
      canGenerate
      busy={false}
      onSelect={setSelected}
      {...fns}
      {...rest}
    />
  )
}

function card(id: string): HTMLElement {
  return host.querySelector(`[data-post="${id}"]`) as HTMLElement
}

describe('plan review', () => {
  it('shows date and time, format, topic, caption, hashtags and the media badge', () => {
    mount(<Harness fns={handlers()} />)
    const first = card('p1')
    expect(first.textContent).toContain('Mon, Jan 11')
    expect(first.textContent).toContain('10:00')
    expect(first.textContent).toContain('Photo')
    expect(first.textContent).toContain('Topic p1')
    expect(first.textContent).toContain('Caption p1')
    expect(first.textContent).toContain('#latte')
    expect(first.textContent).toContain('No media yet')
    expect(first.textContent).toContain('Needs your approval')
    expect(card('p3').textContent).toContain('Media ready')
    expect(card('p3').textContent).toContain('Approved and scheduled')
  })

  it('approves one post and never offers approval for one that is already scheduled', () => {
    const fns = handlers()
    mount(<Harness fns={fns} />)
    click(button('Approve', card('p1')))
    expect(fns.onApprove).toHaveBeenCalledWith(['p1'])
    expect(button('Approve', card('p3'))).toBeUndefined()
  })

  it('approves the selected posts, then everything after a confirmation', () => {
    const fns = handlers()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mount(<Harness fns={fns} />)
    expect(button(/Approve selected/)?.disabled).toBe(true)
    click(card('p1').querySelector('input[type="checkbox"]'))
    click(card('p2').querySelector('input[type="checkbox"]'))
    expect(card('p3').querySelector('input[type="checkbox"]')).not.toBeNull()
    click(button('Approve selected (2)'))
    expect(fns.onApprove).toHaveBeenLastCalledWith(['p1', 'p2'])

    click(button('Approve all'))
    expect(confirm).toHaveBeenCalled()
    expect(fns.onApprove).toHaveBeenCalledTimes(1)
    confirm.mockReturnValue(true)
    click(button('Approve all'))
    expect(fns.onApprove).toHaveBeenLastCalledWith(null)
  })

  it('selects every waiting post on the page at once', () => {
    const fns = handlers()
    mount(<Harness fns={fns} />)
    click(host.querySelector('input[aria-label="Select all waiting posts on this page"]'))
    expect(button(/Approve selected/)?.textContent).toBe('Approve selected (2)')
  })

  it('asks before deleting one post or the selected posts', () => {
    const fns = handlers()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mount(<Harness fns={fns} />)
    click(button('Delete', card('p1')))
    expect(confirm).toHaveBeenCalledWith('Delete this post?')
    expect(fns.onDelete).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    click(button('Delete', card('p1')))
    expect(fns.onDelete).toHaveBeenCalledWith('p1')

    click(card('p2').querySelector('input[type="checkbox"]'))
    click(button('Delete selected (1)'))
    expect(fns.onDeleteSelected).toHaveBeenCalledWith(['p2'])
  })

  it('edits a post inline and saves the new words', () => {
    const fns = handlers()
    mount(<Harness fns={fns} />)
    click(button('Edit', card('p1')))
    setValue(card('p1').querySelector('textarea') as Element, 'A better caption')
    setValue(card('p1').querySelectorAll('input')[2] as Element, '#coffee #morning')
    click(button('Save changes', card('p1')))
    expect(fns.onSave).toHaveBeenCalledTimes(1)
    const [id, patch] = fns.onSave.mock.calls[0]
    expect(id).toBe('p1')
    expect(patch).toMatchObject({
      caption: 'A better caption',
      description: 'Topic p1',
      format: 'photo',
      hashtags: [{ tag: 'coffee', enabled: true }, { tag: 'morning', enabled: true }],
      scheduledAt: '2027-01-11T10:00:00.000Z',
    })
  })

  it('moves a post to another day and runs the per-post actions', () => {
    const fns = handlers()
    mount(<Harness fns={fns} />)
    setValue(card('p1').querySelector('input[aria-label="Move to"]') as Element, '2027-01-14T18:30')
    click(button('Move', card('p1')))
    expect(fns.onSave).toHaveBeenCalledWith('p1', { scheduledAt: '2027-01-14T18:30:00.000Z' })
    click(button('Regenerate', card('p1')))
    expect(fns.onRegenerate).toHaveBeenCalledWith('p1')
    click(button('Generate media', card('p1')))
    expect(fns.onMedia).toHaveBeenCalledWith('p1')
  })

  it('regenerates the plan only after a confirmation', () => {
    const fns = handlers()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mount(<Harness fns={fns} />)
    click(button('Regenerate plan'))
    expect(fns.onRegeneratePlan).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    click(button('Regenerate plan'))
    expect(fns.onRegeneratePlan).toHaveBeenCalledTimes(1)
  })

  it('is read-only for a viewer', () => {
    mount(<Harness fns={handlers()} canWrite={false} canApprove={false} canGenerate={false} />)
    expect(button('Approve')).toBeUndefined()
    expect(button('Approve all')).toBeUndefined()
    expect(button('Edit', card('p1'))).toBeUndefined()
    expect(button('Delete', card('p1'))).toBeUndefined()
    expect(button('Regenerate plan')).toBeUndefined()
    expect(host.querySelector('input[type="checkbox"]')).toBeNull()
    expect(card('p1').textContent).toContain('Caption p1')
  })

  it('pages the list 20 at a time and opens a calendar chip for review', () => {
    const fns = handlers()
    const many = Array.from({ length: 20 }, (_, index) => post(`m${index}`))
    mount(<Harness fns={fns} posts={many} total={31} />)
    expect(host.querySelectorAll('article.plan-item')).toHaveLength(20)
    click(button('Next'))
    expect(fns.onPage).toHaveBeenCalledWith(2)
    act(() => root?.unmount())

    const calendarFns = handlers()
    root = createRoot(host)
    act(() => root?.render(<MemoryRouter><Harness fns={calendarFns} view="calendar" /></MemoryRouter>))
    expect(host.querySelectorAll('.plan-day')).toHaveLength(3)
    expect(host.querySelector('article.plan-item')).toBeNull()
    click([...host.querySelectorAll('.plan-chip')][1])
    expect(card('p2').textContent).toContain('Caption p2')
    click(button('Approve', card('p2')))
    expect(calendarFns.onApprove).toHaveBeenCalledWith(['p2'])
  })
})
