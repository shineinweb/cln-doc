import { robotsContent, seoFromRecord, type PublicPageRecord } from '@instagram-ai/shared'

export type PageSeo = {
  title: string
  description: string
  indexed: boolean
  canonical?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
}

function meta(name: string, content: string): void {
  let element = document.head.querySelector(`meta[name="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute('name', name)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function property(name: string, content: string): void {
  if (!content) return
  let element = document.head.querySelector(`meta[property="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute('property', name)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

export function applyPageSeo(page: PageSeo): void {
  document.title = page.title
  meta('description', page.description)
  meta('robots', page.indexed ? 'index,follow' : 'noindex')
  property('og:title', page.ogTitle || page.title)
  property('og:description', page.ogDescription || page.description)
  if (page.ogImage) property('og:image', page.ogImage)
  if (page.canonical) {
    let link = document.head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', page.canonical)
  }
}

export function applyRecordSeo(page: PublicPageRecord, canonicalHost: string): void {
  const seo = seoFromRecord(page, canonicalHost)
  applyPageSeo({
    title: seo.title,
    description: seo.description,
    indexed: seo.indexed,
    canonical: seo.canonical,
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImage: seo.ogImage,
  })
}

export function applyPathRobots(pathname: string, title: string): void {
  const robots = robotsContent(pathname)
  applyPageSeo({ title, description: '', indexed: robots === 'index,follow' })
}
