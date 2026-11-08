import { useState } from 'react'
import { storedAudienceHours, type AudienceHour } from '@instagram-ai/shared'
import { Pager } from './form'

export function formatAudienceHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function BestTime({ hours }: { hours: AudienceHour[] | null }) {
  const [page, setPage] = useState(1)
  if (!hours) return null
  const stored = storedAudienceHours({ hours })
  if (!stored.length) return <p className="notice">No audience times yet.</p>
  const start = (page - 1) * 20
  const visible = stored.slice(start, start + 20)
  return (
    <div className="stack">
      <p>Audience online, from stored Meta insights</p>
      <ul>
        {visible.map((item) => (
          <li key={item.hour}>{formatAudienceHour(item.hour)} · {item.value}</li>
        ))}
      </ul>
      <Pager page={page} total={stored.length} onPage={setPage} label="Audience hours" />
    </div>
  )
}
