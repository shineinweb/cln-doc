import { describe, expect, it } from 'vitest'
import { campaignMetricTotals, chartSeriesOrEmpty, metricSeries } from '@instagram-ai/shared'

describe('empty charts invent nothing', () => {
  it('keeps empty series empty for SVG helpers', () => {
    expect(chartSeriesOrEmpty([])).toEqual([])
    expect(metricSeries([], 'engagement')).toEqual([])
    expect(campaignMetricTotals([])).toEqual({
      impressions: null,
      reach: null,
      engagement: null,
    })
  })
})
