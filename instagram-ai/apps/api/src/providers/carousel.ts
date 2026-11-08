import { clip } from './poster'
import type { MediaSlide } from './media'

export const MIN_SLIDES = 3
export const MAX_SLIDES = 6

export type CarouselPlanInput = {
  brandName: string
  description: string
  tagline?: string | null
  services?: string[]
  callToAction?: string | null
  /** Optional outline lines from the brand's own carousel outline. */
  outline?: string[]
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.replace(/^[\s\-–—*•\d.)]+/, '').trim())
    .filter(Boolean)
}

function key(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/**
 * Cover, 1-4 benefit slides, closing CTA: always 3 to 6 slides. Benefits come from the post
 * description first, then the brand's services, so every slide says something real.
 */
export function planCarousel(input: CarouselPlanInput): MediaSlide[] {
  const brand = clip(input.brandName || 'Your brand', 28)
  const lines = sentences(input.description)
  const cover = clip(lines[0] || input.description.trim() || brand, 80)
  const tagline = input.tagline?.trim() ? clip(input.tagline.trim().split(/\r?\n/)[0]!, 110) : ''
  const seen = new Set<string>([key(cover)])
  const benefits: Array<{ headline: string; body: string }> = []
  const add = (headline: string, body: string) => {
    const id = key(headline)
    if (!id || seen.has(id) || benefits.length >= MAX_SLIDES - 2) return
    seen.add(id)
    benefits.push({ headline: clip(headline, 56), body: clip(body, 110) })
  }

  const outline = (input.outline ?? []).flatMap((line) => sentences(line))
  for (const line of outline) {
    const [head, ...rest] = line.split(/\s*[:–—-]\s+/)
    add(head ?? line, rest.join(' - ') || tagline)
  }
  for (const line of lines.slice(1)) add(line, tagline)
  for (const service of input.services ?? []) {
    add(service, tagline && tagline.toLowerCase() !== service.toLowerCase() ? tagline : `Talk to ${brand} about ${service.toLowerCase()}.`)
  }
  if (benefits.length === 0) add(`Why ${brand}`, tagline || `${brand} is ready to help.`)

  const total = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, benefits.length + 2))
  const used = benefits.slice(0, total - 2)

  const slides: MediaSlide[] = [{ role: 'cover', index: 0, total, headline: cover, body: tagline || undefined }]
  used.forEach((item, i) => slides.push({ role: 'benefit', index: i + 1, total, headline: item.headline, body: item.body }))
  slides.push({
    role: 'cta',
    index: total - 1,
    total,
    headline: clip(`Ready to work with ${brand}?`, 60),
    body: tagline || undefined,
  })
  return slides
}
