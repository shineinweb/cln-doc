import { describe, expect, it } from 'vitest'
import { hasAdminRoute, seoFromRecord } from '@instagram-ai/shared'
import { customerNav, navMatches } from './nav'
import { WEB_PATHS } from './routes'
import { applyPageSeo, applyRecordSeo } from './seo'
import { shouldProxy } from '../../server.mjs'

const sources = import.meta.glob(['../**/*.{ts,tsx,css,html}', '../../index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('customer site boundaries', () => {
  it('has no admin route and does not point at the admin origin', () => {
    expect(hasAdminRoute(WEB_PATHS)).toBe(false)
    expect(WEB_PATHS.some((route) => route.includes('admin'))).toBe(false)
    const text = Object.entries(sources)
      .filter(([file]) => !file.endsWith('.test.ts'))
      .map(([, value]) => String(value))
      .join('\n')
    expect(text).not.toContain('localhost:5174')
    expect(text).not.toContain('admin.example.com')
    expect(text).not.toContain('path="/admin"')
    expect(text).not.toContain("path='/admin'")
  })

  it('marks a logged-in app screen noindex and copies public SEO from the record', () => {
    applyPageSeo({ title: 'Workspace', description: 'Customer workspace', indexed: false })
    expect(document.title).toBe('Workspace')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    const page = {
      path: '/pricing',
      title: 'Plans from the record',
      description: 'The description stored by the admin SEO screen.',
      ogTitle: 'Plans',
      ogDescription: 'Share text',
      ogImage: '',
      indexed: true,
      inSitemap: true,
    }
    applyRecordSeo(page, 'https://app.example.com')
    const seo = seoFromRecord(page, 'https://app.example.com')
    expect(document.title).toBe(page.title)
    expect(document.title).toBe(seo.title)
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(page.description)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow')
  })

  it('hides calendar and inboxes on Starter and limits Support to comments and messages', () => {
    const starter = customerNav('OWNER', { scheduling: false, commentInbox: false, dmInbox: false }).map((item) => item.label)
    expect(starter).toEqual(['Dashboard', 'Create', 'Insights', 'Settings'])
    const support = customerNav('SUPPORT', { scheduling: true, commentInbox: true, dmInbox: true }).map((item) => item.label)
    expect(support).toEqual(['Comments', 'Messages'])
    expect(navMatches('/app', '/app')).toBe(true)
    expect(navMatches('/app/create', '/app')).toBe(false)
    expect(navMatches('/app/settings/brand', '/app/settings')).toBe(true)
  })

  it('proxies API, media, robots, and sitemap to the API process', () => {
    expect(shouldProxy('/api/health')).toBe(true)
    expect(shouldProxy('/media/abc')).toBe(true)
    expect(shouldProxy('/robots.txt')).toBe(true)
    expect(shouldProxy('/sitemap.xml')).toBe(true)
    expect(shouldProxy('/')).toBe(false)
    expect(shouldProxy('/app/create')).toBe(false)
  })
})
