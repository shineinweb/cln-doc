import { api } from './api'

export const PAGE_SIZE = 20

export function Hint({ children }: { children: string }) {
  return <small className="hint">{children}</small>
}

export function Pager({ page, total, onPage, label = 'Pages' }: { page: number; total: number; onPage: (page: number) => void; label?: string }) {
  if (total <= 0) return null
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(Math.max(page, 1), pages)
  return (
    <nav className="pager" aria-label={label}>
      <button type="button" className="secondary" disabled={current <= 1} onClick={() => onPage(current - 1)}>Previous</button>
      <span>Page {current}</span>
      <button type="button" className="secondary" disabled={current >= pages} onClick={() => onPage(current + 1)}>Next</button>
    </nav>
  )
}

export function confirmDelete(name: string): boolean {
  return window.confirm(`Delete ${name}?`)
}

type Paged = { page: number; pageSize: number; total: number }

export async function fetchAll<T>(path: string, key: string): Promise<T[]> {
  const join = path.includes('?') ? '&' : '?'
  const first = await api<Paged & Record<string, T[]>>(`${path}${join}page=1`)
  const items = [...(first[key] ?? [])]
  const total = typeof first.total === 'number' ? first.total : items.length
  const size = first.pageSize || PAGE_SIZE
  const pages = Math.max(1, Math.ceil(total / size))
  for (let page = 2; page <= pages; page += 1) {
    const next = await api<Paged & Record<string, T[]>>(`${path}${join}page=${page}`)
    items.push(...(next[key] ?? []))
  }
  return items
}
