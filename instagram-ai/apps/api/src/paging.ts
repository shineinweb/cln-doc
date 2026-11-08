export const PAGE_SIZE = 20

export function readPage(query: unknown, key = 'page'): number {
  if (!query || typeof query !== 'object') return 1
  const raw = (query as Record<string, unknown>)[key]
  const value = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 1
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.floor(value)
}

export function pageArgs(page: number): { skip: number; take: number } {
  return { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }
}

export function pageBody(page: number, total: number): { page: number; pageSize: number; total: number } {
  return { page, pageSize: PAGE_SIZE, total }
}

export function slicePage<T>(items: readonly T[], page: number): { items: T[]; page: number; pageSize: number; total: number } {
  const start = (page - 1) * PAGE_SIZE
  return { items: items.slice(start, start + PAGE_SIZE), ...pageBody(page, items.length) }
}
