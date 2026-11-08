import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TemplateCardData } from '../lib/templates'
import { TemplateGallery } from './templates'

const apiMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/api', () => ({ api: apiMock }))
vi.mock('./shell', () => ({ useSession: () => ({ role: 'OWNER' }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let host: HTMLElement

function card(id: string, patch: Partial<TemplateCardData> = {}): TemplateCardData {
  return {
    id, title: `Template ${id}`, kind: 'poster', category: 'Food', tags: [], orientation: 'square', durationSeconds: null, format: 'photo',
    textSlots: [
      { key: 'headline', label: 'Headline', default: 'Fresh daily', maxLength: 20, position: 'headline', required: true },
      { key: 'cta', label: 'Call to action', default: 'Order', maxLength: 12, position: 'cta', required: false },
    ],
    hasFaceSlot: true, motionPrompt: '', status: 'published', useCount: 2, platform: true, mine: false, thumbnailUrl: `/media/${id}.png`, sourceUrl: null, ...patch,
  }
}

const list = (templates: TemplateCardData[], total = templates.length, page = 1) => ({ templates, categories: ['Food'], page, pageSize: 20, total, facePersonalization: true })

function paths(): string[] {
  return apiMock.mock.calls.map((call) => String(call[0]))
}

async function flush(ms = 0) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })
}

function setValue(element: Element, value: string) {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  act(() => {
    setter?.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}

function click(element: Element | null | undefined) {
  if (!element) throw new Error('Nothing to click')
  act(() => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

function button(label: string | RegExp, scope: ParentNode = host): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find((item) => (typeof label === 'string' ? item.textContent === label : label.test(item.textContent ?? '')))
}

beforeEach(() => {
  apiMock.mockReset()
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host.remove()
})

function mount(onOpenDraft = vi.fn(), canWrite = true) {
  root = createRoot(host)
  act(() => root?.render(<TemplateGallery canWrite={canWrite} onOpenDraft={onOpenDraft} />))
  return onOpenDraft
}

describe('template gallery', () => {
  it('searches, sorts, filters, switches tab, and pages 20 at a time', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/templates?')) {
        const page = Number(new URLSearchParams(path.split('?')[1]).get('page'))
        return list(page === 1 ? Array.from({ length: 20 }, (_, i) => card(`a${i}`)) : [card('b0')], 21, page)
      }
      return {}
    })
    mount()
    await flush()
    expect(host.querySelectorAll('.template-card')).toHaveLength(20)
    expect(host.querySelectorAll('small.hint').length).toBeGreaterThanOrEqual(5)

    setValue(host.querySelector('input[type="search"]') as Element, 'sale')
    await flush(350)
    expect(paths().some((path) => path.includes('q=sale') && path.includes('page=1'))).toBe(true)

    const selects = host.querySelectorAll('select')
    setValue(selects[0] as Element, 'popular')
    await flush()
    expect(paths().some((path) => path.includes('sort=popular'))).toBe(true)
    setValue(selects[1] as Element, 'video')
    await flush()
    expect(paths().some((path) => path.includes('kind=video'))).toBe(true)

    click(button('Next'))
    await flush()
    expect(paths().some((path) => path.includes('page=2'))).toBe(true)
    expect(host.querySelectorAll('.template-card')).toHaveLength(1)

    click([...host.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === 'Mine'))
    await flush()
    const last = paths().filter((path) => path.startsWith('/api/templates?')).pop() ?? ''
    expect(last).toContain('tab=mine')
    expect(last).toContain('page=1')
  })

  it('shows an empty Mine tab hint', async () => {
    apiMock.mockResolvedValue(list([]))
    mount()
    await flush()
    click([...host.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === 'Mine'))
    await flush()
    expect(host.textContent).toContain('Save as template')
  })
})

describe('template detail', () => {
  function setup(faceOn = true) {
    apiMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/templates?')) return { ...list([card('t1')]), facePersonalization: faceOn }
      if (path === '/api/templates/faces') return { faces: [{ id: 'f1', url: '/media/f1.png', filename: 'me.png', createdAt: '', deleteAfter: '2027-02-01T00:00:00.000Z' }] }
      if (path.startsWith('/api/library')) return { assets: [] }
      if (path.endsWith('/preview')) return { image: 'data:image/png;base64,AAAA' }
      if (path.endsWith('/personalize')) return { post: { id: 'post-9' } }
      return {}
    })
  }

  async function open() {
    const onOpenDraft = mount()
    await flush()
    click(host.querySelector('.template-open'))
    await flush()
    return onOpenDraft
  }

  it('validates text before Generate and explains each field', async () => {
    setup()
    await open()
    const dialog = host.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toBeTruthy()
    const inputs = dialog.querySelectorAll('form input[maxlength]')
    expect(inputs[0]?.getAttribute('maxlength')).toBe('20')
    expect(dialog.querySelectorAll('small.hint').length).toBeGreaterThanOrEqual(6)
    expect(button('Generate', dialog)?.disabled).toBe(false)
    setValue(inputs[0] as Element, '   ')
    expect(button('Generate', dialog)?.disabled).toBe(true)
    expect(dialog.textContent).toContain('Headline is required')
  })

  it('requires consent for a face and sends the draft request', async () => {
    setup()
    const onOpenDraft = await open()
    const dialog = host.querySelector('[role="dialog"]') as HTMLElement
    const upload = dialog.querySelector('input[type="file"]') as HTMLInputElement
    expect(upload.disabled).toBe(true)
    click(dialog.querySelector('[role="radio"]'))
    expect(button('Generate', dialog)?.disabled).toBe(true)
    expect(dialog.textContent).toMatch(/permission/)
    click(dialog.querySelector('input[type="checkbox"]'))
    expect(upload.disabled).toBe(false)
    expect(button('Generate', dialog)?.disabled).toBe(false)
    click(button('Generate', dialog))
    await flush()
    const call = apiMock.mock.calls.find((item) => String(item[0]).endsWith('/personalize'))
    expect(call).toBeTruthy()
    expect(JSON.parse(call?.[1].body)).toMatchObject({ values: { headline: 'Fresh daily', cta: 'Order' }, faceAssetId: 'f1', consent: true })
    expect(onOpenDraft).toHaveBeenCalledWith('post-9')
  })

  it('hides the face section when the admin turned it off', async () => {
    setup(false)
    await open()
    const dialog = host.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.querySelector('input[type="file"]')).toBeNull()
    expect(host.textContent).toContain('turned off by the admin')
    click(button('Generate', dialog))
    await flush()
    expect(apiMock.mock.calls.some((item) => String(item[0]).endsWith('/personalize'))).toBe(true)
  })

  it('shows a readable failure and stays open', async () => {
    setup()
    apiMock.mockImplementationOnce(async () => list([card('t1')])).mockImplementationOnce(async () => ({ faces: [] }))
    const onOpenDraft = await open()
    apiMock.mockImplementation(async (path: string) => {
      if (path.endsWith('/personalize')) throw new Error('Your plan has no AI credits left')
      if (path.endsWith('/preview')) return { image: 'data:image/png;base64,AAAA' }
      return { faces: [], assets: [] }
    })
    const dialog = host.querySelector('[role="dialog"]') as HTMLElement
    click(button('Generate', dialog))
    await flush()
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('no AI credits')
    expect(onOpenDraft).not.toHaveBeenCalled()
    expect(button('Generate', dialog)?.disabled).toBe(false)
  })
})
