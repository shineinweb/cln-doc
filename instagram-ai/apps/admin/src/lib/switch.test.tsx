import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { isOn, providerStatusLine, toggleNotice } from './providers'
import { Switch } from './switch'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Demo({ disabled = false }: { disabled?: boolean }) {
  const [on, setOn] = useState(true)
  return <Switch id="s" label="Use OpenAI" checked={on} onChange={setOn} disabled={disabled} describedBy="h" />
}

describe('provider switch', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('is an accessible switch that flips its state on click', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<Demo />) })
    const button = host.querySelector('button') as HTMLButtonElement
    expect(button.getAttribute('role')).toBe('switch')
    expect(button.getAttribute('aria-label')).toBe('Use OpenAI')
    expect(button.getAttribute('aria-describedby')).toBe('h')
    expect(button.getAttribute('aria-checked')).toBe('true')
    expect(host.textContent).toContain('On')
    await act(async () => { button.click() })
    expect(button.getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).toContain('Off')
    await act(async () => { root.unmount() })
  })

  it('does not toggle while disabled', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<Demo disabled />) })
    const button = host.querySelector('button') as HTMLButtonElement
    await act(async () => { button.click() })
    expect(button.getAttribute('aria-checked')).toBe('true')
    await act(async () => { root.unmount() })
  })
})

describe('provider status text', () => {
  it('shows set and on/off for each provider', () => {
    expect(providerStatusLine({
      openaiKeySet: true, runwayKeySet: true, videoProviderUrlSet: false,
      openaiEnabled: false, runwayEnabled: true, videoProviderUrlEnabled: true,
    })).toBe('OpenAI key: set, off. Runway key: set, on. Video provider URL: not set, on.')
    expect(providerStatusLine({
      openaiKeySet: true, runwayKeySet: false, videoProviderUrlSet: false,
      status: { openai: 'OpenAI key: set, off', runway: 'Runway key: not set, on', videoProvider: 'Video provider URL: not set, on' },
    })).toBe('OpenAI key: set, off. Runway key: not set, on. Video provider URL: not set, on.')
  })

  it('treats a missing flag as on and words the toggle notice', () => {
    expect(isOn(null, 'openaiEnabled')).toBe(true)
    expect(isOn({ openaiKeySet: true, runwayKeySet: false, videoProviderUrlSet: false, runwayEnabled: false }, 'runwayEnabled')).toBe(false)
    expect(toggleNotice('Runway', false)).toBe('Runway is off. The stored key or URL is kept.')
    expect(toggleNotice('Runway', true)).toBe('Runway is on.')
  })
})
