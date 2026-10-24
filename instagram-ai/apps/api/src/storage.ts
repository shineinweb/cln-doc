import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
}

export class LocalStorage {
  constructor(
    private dir: string,
    private baseUrl: string,
  ) {}

  url(storageKey: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}/media/${storageKey}`
  }

  async put(bytes: Buffer, extension: string): Promise<string> {
    const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
    const storageKey = `${randomBytes(16).toString('hex')}.${safeExt}`
    await mkdir(this.dir, { recursive: true })
    await writeFile(path.join(this.dir, storageKey), bytes)
    return storageKey
  }

  async read(storageKey: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
    if (!/^[a-f0-9]{32}\.[a-z0-9]+$/i.test(storageKey)) return null
    try {
      const bytes = await readFile(path.join(this.dir, storageKey))
      const ext = storageKey.split('.').pop() ?? ''
      return { bytes, mimeType: MIME[ext] ?? 'application/octet-stream' }
    } catch {
      return null
    }
  }

  async remove(storageKey: string): Promise<void> {
    if (!/^[a-f0-9]{32}\.[a-z0-9]+$/i.test(storageKey)) return
    await rm(path.join(this.dir, storageKey), { force: true })
  }
}
