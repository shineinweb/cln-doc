import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BestTime } from './best-time'

function render(hours: Array<{ hour: number; value: number }> | null) {
  const html = renderToString(<BestTime hours={hours} />)
  return { text: html.replace(/<[^>]+>/g, ''), html, unmount() {} }
}

describe('best time', () => {
  it('renders nothing invented when insights are empty', () => {
    const empty = render([])
    expect(empty.text).toContain('No audience times yet.')
    expect(empty.text).not.toMatch(/\d/)
    expect(empty.html.toLowerCase()).not.toContain('heatmap')
    empty.unmount()

    const missing = render(null)
    expect(missing.text).toBe('')
    expect(missing.html.toLowerCase()).not.toContain('heatmap')
    missing.unmount()

    const invalid = render([{ hour: 99, value: 10 }, { hour: -1, value: 4 }])
    expect(invalid.text).toContain('No audience times yet.')
    expect(invalid.text).not.toMatch(/\d{1,2}:00/)
    expect(invalid.html.toLowerCase()).not.toContain('heatmap')
    invalid.unmount()
  })

  it('shows only the audience hours that were stored', () => {
    const view = render([{ hour: 18, value: 40 }])
    expect(view.text).toContain('18:00')
    expect(view.text).toContain('40')
    expect(view.text).not.toContain('09:00')
    expect(view.html.toLowerCase()).not.toContain('heatmap')
    view.unmount()
  })
})
