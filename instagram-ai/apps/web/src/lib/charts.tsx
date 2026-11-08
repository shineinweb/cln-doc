import type { MetricPoint, NamedValue } from '@instagram-ai/shared'
import { chartSeriesOrEmpty } from '@instagram-ai/shared'

const EMPTY = 'No metrics yet.'
const COLORS = ['#2f6fed', '#d6b25e', '#6ec6a8', '#c77d6b', '#9db7ff', '#b7c0d4']

function EmptyChart({ title }: { title?: string }) {
  return (
    <div className="chart-empty" role="img" aria-label={EMPTY}>
      {title ? <strong>{title}</strong> : null}
      <p>{EMPTY}</p>
    </div>
  )
}

export function LineMetricsChart({
  title,
  series,
}: {
  title: string
  series: Array<{ label: string; points: MetricPoint[]; color?: string }>
}) {
  const usable = series
    .map((item) => ({ ...item, points: chartSeriesOrEmpty(item.points) as MetricPoint[] }))
    .filter((item) => item.points.length > 0)
  if (!usable.length) return <EmptyChart title={title} />
  const all = usable.flatMap((item) => item.points)
  const dates = [...new Set(all.map((point) => point.date))].sort()
  const values = all.map((point) => point.value)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 320
  const height = 160
  const pad = 24
  function x(index: number) {
    if (dates.length <= 1) return pad + (width - pad * 2) / 2
    return pad + (index / (dates.length - 1)) * (width - pad * 2)
  }
  function y(value: number) {
    const span = max - min || 1
    return height - pad - ((value - min) / span) * (height - pad * 2)
  }
  return (
    <figure className="chart-card">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {usable.map((item, seriesIndex) => {
          const path = item.points
            .map((point) => {
              const index = dates.indexOf(point.date)
              return `${index === 0 || item.points.indexOf(point) === 0 ? 'M' : 'L'}${x(index)} ${y(point.value)}`
            })
            .join(' ')
          return (
            <path
              key={item.label}
              d={path}
              fill="none"
              stroke={item.color ?? COLORS[seriesIndex % COLORS.length]}
              strokeWidth="2.5"
            />
          )
        })}
      </svg>
      <ul className="chart-legend">
        {usable.map((item, index) => (
          <li key={item.label} style={{ color: item.color ?? COLORS[index % COLORS.length] }}>{item.label}</li>
        ))}
      </ul>
    </figure>
  )
}

export function BarMetricsChart({ title, bars }: { title: string; bars: NamedValue[] }) {
  const usable = chartSeriesOrEmpty(bars) as NamedValue[]
  if (!usable.length) return <EmptyChart title={title} />
  const max = Math.max(...usable.map((item) => item.value), 1)
  return (
    <figure className="chart-card">
      <figcaption>{title}</figcaption>
      <div className="bar-chart" role="img" aria-label={title}>
        {usable.map((item, index) => (
          <div className="bar-row" key={item.name}>
            <span>{item.name}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(4, (item.value / max) * 100)}%`,
                  background: COLORS[index % COLORS.length],
                }}
              />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </figure>
  )
}

export function DoughnutMetricsChart({ title, slices }: { title: string; slices: NamedValue[] }) {
  const usable = chartSeriesOrEmpty(slices) as NamedValue[]
  if (!usable.length) return <EmptyChart title={title} />
  const total = usable.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return <EmptyChart title={title} />
  const size = 160
  const radius = 54
  const cx = size / 2
  const cy = size / 2
  let angle = -Math.PI / 2
  const arcs = usable.map((item, index) => {
    const sweep = (item.value / total) * Math.PI * 2
    const start = angle
    angle += sweep
    const end = angle
    const large = sweep > Math.PI ? 1 : 0
    const x1 = cx + radius * Math.cos(start)
    const y1 = cy + radius * Math.sin(start)
    const x2 = cx + radius * Math.cos(end)
    const y2 = cy + radius * Math.sin(end)
    return {
      ...item,
      color: COLORS[index % COLORS.length],
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`,
    }
  })
  return (
    <figure className="chart-card">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        {arcs.map((arc) => <path key={arc.name} d={arc.d} fill={arc.color} />)}
        <circle cx={cx} cy={cy} r={28} fill="#17191f" />
      </svg>
      <ul className="chart-legend">
        {arcs.map((arc) => (
          <li key={arc.name} style={{ color: arc.color }}>{arc.name}: {arc.value}</li>
        ))}
      </ul>
    </figure>
  )
}
