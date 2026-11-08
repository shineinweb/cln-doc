import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'

function firstFont(candidates: string[]): string {
  return candidates.find((file) => existsSync(file)) ?? candidates[0]!
}

const BOLD = firstFont([
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
])
const REGULAR = firstFont([
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
])

export function isDisplayableImage(bytes: Buffer, mimeType: string): boolean {
  if (!bytes.length) return false
  if (mimeType === 'image/png') {
    return bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (mimeType === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8
  if (mimeType === 'image/webp') {
    return bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

/** Tiny fixture PNG used in tests. Not a Create preview — the phone treats sub-8px images as empty. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function crc32(buf: Buffer): number {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]!
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function hashSeed(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function parseHexColor(value: string | null | undefined): [number, number, number] | null {
  if (!value) return null
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/)
  if (!match) return null
  const n = Number.parseInt(match[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trim()}…`
}

export type PosterVariant = 'poster' | 'cover' | 'benefit' | 'cta' | 'services'
export type PosterCanvas = 'square' | 'tall' | 'wide'

export type LocalPosterInput = {
  seed?: string
  /** Pixels per 1080-unit design column. The canvas is 1080x1080 (square), 1080x1920 (tall) or 1920x1080 (wide) at size 1080. */
  size?: number
  brandName?: string
  headline?: string
  tagline?: string
  services?: string[]
  cta?: string | null
  color?: string | null
  logo?: Buffer | null
  /** Draw a light plate behind a dark logo so it stays readable on navy. */
  logoPlate?: boolean
  canvas?: PosterCanvas
  variant?: PosterVariant
  /** Supporting copy under a benefit or closing headline. */
  body?: string
  /** Benefit number shown in the hexagon badge. */
  number?: number
  /** Carousel position dots, index is 0-based. */
  page?: { index: number; total: number } | null
  /** Cover slide: show a "Swipe" pill instead of the closing CTA. */
  swipe?: boolean
  /** A sample photo shown as the hero panel. */
  hero?: Buffer | null
}

type Rgb = [number, number, number]
type Box = { x: number; y: number; w: number; h: number }
type TextItem = { text: string; bold: boolean; size: number; color: string; cx: number; y: number; shadow?: boolean }
type Pill = { label: string; cx: number; cy: number; w: number; h: number; font: number }
type Mark = { cx: number; cy: number; r: number }

const UNIT = 1080
const NAVY_TOP: Rgb = [5, 12, 36]
const NAVY_BOTTOM: Rgb = [9, 30, 78]
const BLUE_GLOW: Rgb = [56, 120, 255]
const MUTED = '0xaebbd9'

export type PosterLayout = {
  W: number
  H: number
  accent: Rgb
  logo: Box | null
  logoPlate: boolean
  marks: Mark[]
  rule: { cx: number; y: number; w: number } | null
  hero: Box | null
  pills: Pill[]
  cta: { label: string; cx: number; y: number; w: number; h: number; font: number; text: Rgb } | null
  dots: { cx: number; y: number; count: number; active: number } | null
  texts: TextItem[]
}

export function canvasSize(canvas: PosterCanvas | undefined): { W: number; H: number } {
  if (canvas === 'tall') return { W: UNIT, H: 1920 }
  if (canvas === 'wide') return { W: 1920, H: UNIT }
  return { W: UNIT, H: UNIT }
}

function luminance(rgb: Rgb): number {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

/** Keep the brand color recognisable but bright enough to read on navy. */
function posterAccent(value: string | null | undefined, seed: number): Rgb {
  const base = parseHexColor(value) ?? ([46 + (seed % 30), 112 + ((seed >>> 8) % 40), 235] as Rgb)
  const lum = luminance(base)
  if (lum >= 0.36) return base
  const lift = Math.min(0.85, (0.36 - lum) * 2.2)
  return [mix(base[0], 64, lift), mix(base[1], 140, lift), mix(base[2], 255, lift)].map(clamp) as Rgb
}

function wrapLines(text: string, perLine: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).map((word) => (word.length > perLine ? clip(word, perLine) : word))
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && `${current} ${word}`.length > perLine) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines - 1)
  kept.push(clip(lines.slice(maxLines - 1).join(' '), perLine))
  return kept
}

const DEFAULT_SERVICES = ['Expert team', 'Trusted quality', 'Real results']

/** Splits a free-text "products and services" field into short chip labels. */
export function parseServiceList(text: string | null | undefined, max = 4): string[] {
  if (!text) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[\n,;•·|]+|\band\b/i)) {
    const label = part.replace(/^[\s\-–—*\d.)]+/, '').replace(/\s+/g, ' ').trim()
    if (label.length < 3 || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    out.push(clip(label, 22))
    if (out.length >= max) break
  }
  return out
}

function ctaTextColor(accent: Rgb): Rgb {
  return luminance(accent) > 0.62 ? [6, 16, 42] : [255, 255, 255]
}

function rgbHex(rgb: Rgb): string {
  return `0x${rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`
}

function chipRow(labels: string[], cx: number, cy: number, maxWidth = 980): { pills: Pill[]; font: number } {
  let font = 28
  const rawWidths = labels.map((label) => label.length * 0.6 * font + 96)
  const gap = 24
  const total = rawWidths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, labels.length - 1)
  const fit = total > maxWidth ? maxWidth / total : 1
  font = Math.max(18, Math.round(font * fit))
  const widths = rawWidths.map((w) => w * fit)
  const span = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, labels.length - 1)
  let cursor = cx - span / 2
  const pills = labels.map((label, i) => {
    const w = widths[i]!
    const pill = { label, cx: cursor + w / 2, cy, w, h: 84, font }
    cursor += w + gap
    return pill
  })
  return { pills, font }
}

function ctaBox(label: string, cx: number, y: number, accent: Rgb): NonNullable<PosterLayout['cta']> {
  const font = label.length <= 20 ? 40 : label.length <= 30 ? 34 : 29
  const w = Math.max(420, Math.min(940, label.length * 0.58 * font + 140))
  return { label, cx, y, w, h: 88, font, text: ctaTextColor(accent) }
}

function ctaText(cta: NonNullable<PosterLayout['cta']>): TextItem {
  return { text: cta.label, bold: true, size: cta.font, color: rgbHex(cta.text), cx: cta.cx, y: cta.y + cta.h / 2 - 0.36 * cta.font }
}

function pillText(pill: Pill): TextItem {
  return { text: pill.label, bold: true, size: pill.font, color: 'white', cx: pill.cx + 14, y: pill.cy - 0.34 * pill.font }
}

/** The original square brand poster: fixed positions, used for Photo and the no-key fallback. */
function squarePosterLayout(input: LocalPosterInput, seed: number): PosterLayout {
  const brand = clip(input.brandName || 'Your Brand', 28)
  const hasLogo = Boolean(input.logo?.length)
  const headlineText = clip(input.headline || brand, 96)
  const headlineSize = headlineText.length <= 30 ? 72 : headlineText.length <= 60 ? 64 : 56
  const perLine = Math.max(10, Math.floor(900 / (0.55 * headlineSize)))
  const headlineLines = wrapLines(headlineText, perLine, 3)
  const headlineLead = Math.round(headlineSize * 1.2)
  const headlineY = 456
  const taglineLines = input.tagline ? wrapLines(clip(input.tagline, 110), 54, 2) : []
  const taglineY = headlineY + headlineLines.length * headlineLead + 16
  const services = (input.services?.length ? input.services : DEFAULT_SERVICES).slice(0, 3)
  const row = chipRow(services.map((label) => clip(label, 22)), UNIT / 2, 850)
  const accent = posterAccent(input.color, seed)
  const cta = ctaBox(clip(input.cta || 'Learn more', 44), UNIT / 2, 930, accent)
  const brandSize = Math.min(84, Math.floor(900 / (0.6 * brand.length)))
  const initial = (brand.match(/[A-Za-z0-9]/)?.[0] ?? 'B').toUpperCase()

  const texts: TextItem[] = []
  if (!hasLogo) {
    texts.push({ text: initial, bold: true, size: 88, color: 'white', cx: UNIT / 2, y: 168 - 0.345 * 88 })
    texts.push({ text: brand, bold: true, size: brandSize, color: 'white', cx: UNIT / 2, y: 288 })
  }
  headlineLines.forEach((line, i) => {
    texts.push({ text: line, bold: true, size: headlineSize, color: 'white', cx: UNIT / 2, y: headlineY + i * headlineLead, shadow: true })
  })
  taglineLines.forEach((line, i) => {
    texts.push({ text: line, bold: false, size: 32, color: MUTED, cx: UNIT / 2, y: taglineY + i * 42 })
  })
  for (const pill of row.pills) texts.push(pillText(pill))
  texts.push(ctaText(cta))

  return {
    W: UNIT,
    H: UNIT,
    accent,
    logo: hasLogo ? { x: 270, y: 64, w: 540, h: 270 } : null,
    logoPlate: Boolean(input.logoPlate && hasLogo),
    marks: hasLogo ? [] : [{ cx: UNIT / 2, cy: 168, r: 90 }],
    rule: { cx: UNIT / 2, y: 410, w: 120 },
    hero: null,
    pills: row.pills,
    cta,
    dots: null,
    texts,
  }
}

type Block = { h: number; gap?: number; emit: (y: number) => void }

/**
 * Stacks the variant's blocks and centres them inside the canvas safe area, so the same
 * content works on a square slide, a 9:16 story or reel frame and a 16:9 video frame.
 */
function flowLayout(input: LocalPosterInput, seed: number): PosterLayout {
  const variant = input.variant ?? 'poster'
  const canvas = input.canvas ?? 'square'
  const { W, H } = canvasSize(canvas)
  const cx = W / 2
  const tall = canvas === 'tall'
  const accent = posterAccent(input.color, seed)
  const brand = clip(input.brandName || 'Your Brand', 28)
  const hasLogo = Boolean(input.logo?.length)
  const hasHero = Boolean(input.hero?.length)
  const initial = (brand.match(/[A-Za-z0-9]/)?.[0] ?? 'B').toUpperCase()
  const layout: PosterLayout = {
    W, H, accent, logo: null, logoPlate: Boolean(input.logoPlate && hasLogo), marks: [], rule: null, hero: null,
    pills: [], cta: null, dots: null, texts: [],
  }

  const compact = !tall && (variant === 'benefit' || variant === 'services') || (variant === 'cover' && hasHero)
  const blocks: Block[] = []

  const brandBlock = (small: boolean): Block => {
    if (hasLogo) {
      const box = small ? { w: 340, h: 120 } : { w: 520, h: 230 }
      return { h: box.h, gap: small ? 34 : 30, emit: (y) => { layout.logo = { x: cx - box.w / 2, y, w: box.w, h: box.h } } }
    }
    const r = small ? 42 : 84
    const size = small ? Math.min(40, Math.floor(700 / (0.6 * brand.length))) : Math.min(76, Math.floor(900 / (0.6 * brand.length)))
    const wordmarkGap = small ? 12 : 20
    return {
      h: r * 2 + wordmarkGap + Math.round(size * 1.15),
      gap: small ? 34 : 30,
      emit: (y) => {
        layout.marks.push({ cx, cy: y + r, r })
        layout.texts.push({ text: initial, bold: true, size: Math.round(r * 0.98), color: 'white', cx, y: y + r - 0.345 * r * 0.98 })
        layout.texts.push({ text: brand, bold: true, size, color: 'white', cx, y: y + r * 2 + wordmarkGap })
      },
    }
  }
  const ruleBlock = (): Block => ({ h: 5, gap: 34, emit: (y) => { layout.rule = { cx, y, w: 120 } } })

  const headlineBlock = (text: string, sizes: [number, number, number], gap = 20): Block => {
    const clean = clip((text || brand).replace(/\.$/, ''), 96)
    const size = clean.length <= 30 ? sizes[0] : clean.length <= 60 ? sizes[1] : sizes[2]
    const perLine = Math.max(10, Math.floor(900 / (0.58 * size)))
    const lines = wrapLines(clean, perLine, 3)
    const lead = Math.round(size * 1.2)
    return {
      h: lines.length * lead,
      gap,
      emit: (y) => lines.forEach((line, i) => layout.texts.push({ text: line, bold: true, size, color: 'white', cx, y: y + i * lead, shadow: true })),
    }
  }
  const bodyBlock = (text: string | undefined, maxLines: number, size = 34): Block | null => {
    if (!text?.trim()) return null
    const lines = wrapLines(clip(text, 150), Math.floor(880 / (0.5 * size)), maxLines)
    const lead = Math.round(size * 1.38)
    return {
      h: lines.length * lead,
      gap: 36,
      emit: (y) => lines.forEach((line, i) => layout.texts.push({ text: line, bold: false, size, color: MUTED, cx, y: y + i * lead })),
    }
  }
  const heroBlock = (): Block => {
    const w = tall ? 900 : 860
    const h = tall ? 440 : 330
    return { h, gap: 34, emit: (y) => { layout.hero = { x: cx - w / 2, y, w, h } } }
  }
  const services = (input.services?.length ? input.services : DEFAULT_SERVICES).map((label) => clip(label, 22))
  const cardsBlock = (count: number): Block => {
    const labels = services.slice(0, count)
    const h = tall ? 116 : 92
    const gap = tall ? 26 : 20
    return {
      h: labels.length * h + (labels.length - 1) * gap,
      gap: 40,
      emit: (y) => labels.forEach((label, i) => {
        const pill: Pill = { label, cx, cy: y + h / 2 + i * (h + gap), w: 860, h, font: tall ? 40 : 34 }
        layout.pills.push(pill)
        layout.texts.push(pillText(pill))
      }),
    }
  }
  const chipsBlock = (count: number): Block => ({
    h: 84,
    gap: 44,
    emit: (y) => {
      const row = chipRow(services.slice(0, count), cx, y + 42, 980)
      for (const pill of row.pills) {
        layout.pills.push(pill)
        layout.texts.push(pillText(pill))
      }
    },
  })
  const ctaBlock = (label: string): Block => {
    const box = ctaBox(clip(label, 44), cx, 0, accent)
    return {
      h: box.h,
      gap: 0,
      emit: (y) => {
        layout.cta = { ...box, y }
        layout.texts.push(ctaText(layout.cta))
      },
    }
  }
  const badgeBlock = (): Block => ({
    h: 156,
    gap: 34,
    emit: (y) => {
      layout.marks.push({ cx, cy: y + 78, r: 78 })
      layout.texts.push({ text: String(input.number ?? 1), bold: true, size: 84, color: 'white', cx, y: y + 78 - 0.36 * 84 })
    },
  })

  const headline = input.headline || brand
  const compactHeadline: [number, number, number] = [64, 58, 52]
  if (variant === 'benefit') {
    blocks.push(brandBlock(compact), badgeBlock(), headlineBlock(headline, [72, 64, 56], 28))
    const body = bodyBlock(input.body || input.tagline, 3, 36)
    if (body) blocks.push(body)
  } else if (variant === 'services') {
    blocks.push(brandBlock(compact), headlineBlock(headline, tall ? [76, 68, 60] : compactHeadline, 30))
    if (hasHero) blocks.push(heroBlock(), chipsBlock(3))
    else blocks.push(cardsBlock(3))
  } else if (variant === 'cover') {
    blocks.push(brandBlock(compact))
    if (!compact) blocks.push(ruleBlock())
    blocks.push(headlineBlock(headline, compact ? [68, 60, 54] : [80, 70, 60], 22))
    const tagline = compact ? null : bodyBlock(input.tagline || input.body, 2, 32)
    if (tagline) blocks.push(tagline)
    if (hasHero) blocks.push(heroBlock())
    if (input.swipe) blocks.push(ctaBlock('Swipe  →'))
  } else if (variant === 'cta') {
    blocks.push(brandBlock(false), ruleBlock(), headlineBlock(headline, [68, 62, 54], 22))
    const body = bodyBlock(input.body || input.tagline, 2, 32)
    if (body) blocks.push(body)
    blocks.push(chipsBlock(3), ctaBlock(input.cta || 'Learn more'))
  } else {
    blocks.push(brandBlock(false), ruleBlock(), headlineBlock(headline, [72, 64, 56], 20))
    const tagline = bodyBlock(input.tagline, 2, 32)
    if (tagline) blocks.push(tagline)
    if (hasHero) blocks.push(heroBlock(), chipsBlock(3))
    else if (tall) blocks.push(cardsBlock(3))
    else blocks.push(chipsBlock(3))
    blocks.push(ctaBlock(input.cta || 'Learn more'))
  }

  const topSafe = tall ? 230 : 56
  const bottomReserve = tall ? 250 : input.page ? 100 : 70
  const avail = H - topSafe - bottomReserve
  const sumH = blocks.reduce((sum, block) => sum + block.h, 0)
  const sumGap = blocks.slice(0, -1).reduce((sum, block) => sum + (block.gap ?? 0), 0)
  const roomy = sumGap > 0 ? (avail - sumH) / sumGap : 1
  const gapScale = sumGap === 0 ? 1 : roomy < 1 ? Math.max(0.35, roomy) : tall ? Math.min(1.8, roomy) : 1
  const total = sumH + sumGap * gapScale
  let y = topSafe + Math.max(0, (avail - total) / 2)
  blocks.forEach((block, i) => {
    block.emit(Math.round(y))
    y += block.h + (i < blocks.length - 1 ? (block.gap ?? 0) * gapScale : 0)
  })

  if (input.page && input.page.total > 1) {
    layout.dots = { cx, y: H - (tall ? 270 : 48), count: input.page.total, active: input.page.index }
  }
  return layout
}

export function computePosterLayout(input: LocalPosterInput): PosterLayout {
  const seed = hashSeed(input.seed || input.brandName || input.headline || 'poster')
  const square = (input.canvas ?? 'square') === 'square'
  if ((input.variant ?? 'poster') === 'poster' && square && !input.hero?.length) return squarePosterLayout(input, seed)
  return flowLayout(input, seed)
}

function roundRectCoverage(px: number, py: number, cx: number, cy: number, hw: number, hh: number, rad: number): number {
  const qx = Math.max(Math.abs(px - cx) - (hw - rad), 0)
  const qy = Math.max(Math.abs(py - cy) - (hh - rad), 0)
  const d = Math.sqrt(qx * qx + qy * qy) - rad
  return d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d
}

function hexCoverage(px: number, py: number, cx: number, cy: number, apothem: number): number {
  const x = Math.abs(px - cx)
  const y = Math.abs(py - cy)
  const d = Math.max(x, y * 0.8660254 + x * 0.5) - apothem
  return d <= -0.5 ? 1 : d >= 0.5 ? 0 : 0.5 - d
}

const backgroundCache = new Map<string, Uint8ClampedArray>()

function buildBackground(w: number, h: number, k: number, glow: Rgb): Uint8ClampedArray {
  const cacheKey = `${w}x${h}:${glow.join(',')}`
  const cached = backgroundCache.get(cacheKey)
  if (cached) return cached
  const raw = new Uint8ClampedArray(w * h * 3)
  const longest = Math.max(w, h)
  const shortest = Math.min(w, h)
  const ring1 = { cx: -0.08 * w, cy: 0.42 * h, r: 0.5 * shortest }
  const ring2 = { cx: 1.1 * w, cy: 0.92 * h, r: 0.46 * shortest }
  const gridStep = Math.max(4, 40 * k)
  const dot = Math.max(0.8, 1.7 * k)
  const sx = w / longest
  const sy = h / longest
  for (let y = 0; y < h; y += 1) {
    const ny = y / (h - 1)
    for (let x = 0; x < w; x += 1) {
      const nx = x / (w - 1)
      const t = Math.min(1, Math.max(0, ny * 0.8 + nx * 0.2))
      let r = mix(NAVY_TOP[0], NAVY_BOTTOM[0], t)
      let g = mix(NAVY_TOP[1], NAVY_BOTTOM[1], t)
      let b = mix(NAVY_TOP[2], NAVY_BOTTOM[2], t)

      const g1 = Math.max(0, 1 - Math.hypot((nx - 0.82) * sx, (ny - 0.08) * sy) / 0.7)
      const g2 = Math.max(0, 1 - Math.hypot((nx - 0.08) * sx, (ny - 0.78) * sy) / 0.6)
      const lift = g1 * g1 * 0.42 + g2 * g2 * 0.26
      r += glow[0] * lift * 0.55
      g += glow[1] * lift * 0.55
      b += glow[2] * lift * 0.6

      const gx = Math.abs((x % gridStep) - gridStep / 2)
      const gy = Math.abs((y % gridStep) - gridStep / 2)
      if (Math.hypot(gx, gy) < dot) {
        const a = 0.05 + 0.1 * Math.max(g1, g2)
        r = mix(r, 255, a)
        g = mix(g, 255, a)
        b = mix(b, 255, a)
      }

      const d1 = Math.abs(Math.hypot(x - ring1.cx, y - ring1.cy) - ring1.r)
      const d2 = Math.abs(Math.hypot(x - ring2.cx, y - ring2.cy) - ring2.r)
      const arc = Math.max(Math.max(0, 1 - d1 / (2 * k + 0.5)), Math.max(0, 1 - d2 / (2 * k + 0.5)))
      if (arc > 0) {
        r = mix(r, glow[0] + 60, arc * 0.18)
        g = mix(g, glow[1] + 60, arc * 0.18)
        b = mix(b, glow[2] + 60, arc * 0.18)
      }

      const i = (y * w + x) * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  if (backgroundCache.size >= 6) backgroundCache.delete(backgroundCache.keys().next().value as string)
  backgroundCache.set(cacheKey, raw)
  return raw
}

/**
 * Sync poster plate (no text): navy gradient, brand glows, subtle grid and arcs,
 * emblem (when no logo), service chips, hero frame, CTA bar and page dots. Text, logo and
 * the sample photo are overlaid by renderLocalMarketingPoster. Never a cartoon landscape
 * and never flat colored boxes.
 */
export function buildLocalMarketingPng(input: LocalPosterInput | string = 'local-poster', sizeArg?: number): Buffer {
  const opts: LocalPosterInput = typeof input === 'string' ? { seed: input, size: sizeArg } : input
  const size = opts.size ?? 640
  const k = size / UNIT
  const layout = computePosterLayout(opts)
  const w = Math.round(layout.W * k)
  const h = Math.round(layout.H * k)
  const accent = layout.accent
  const glow: Rgb = [mix(accent[0], BLUE_GLOW[0], 0.5), mix(accent[1], BLUE_GLOW[1], 0.5), mix(accent[2], BLUE_GLOW[2], 0.5)]
  const raw = Uint8ClampedArray.from(buildBackground(w, h, k, glow))

  const blend = (x: number, y: number, rgb: Rgb, alpha: number) => {
    if (alpha <= 0 || x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 3
    raw[i] = raw[i]! + (rgb[0] - raw[i]!) * alpha
    raw[i + 1] = raw[i + 1]! + (rgb[1] - raw[i + 1]!) * alpha
    raw[i + 2] = raw[i + 2]! + (rgb[2] - raw[i + 2]!) * alpha
  }

  const drawRoundRect = (
    cx: number, cy: number, hw: number, hh: number, rad: number,
    color: (x: number, y: number) => Rgb, alpha: number,
  ) => {
    const pad = 3
    for (let y = Math.floor(cy - hh - pad); y <= Math.ceil(cy + hh + pad); y += 1) {
      for (let x = Math.floor(cx - hw - pad); x <= Math.ceil(cx + hw + pad); x += 1) {
        const cov = roundRectCoverage(x + 0.5, y + 0.5, cx, cy, hw, hh, rad)
        if (cov > 0) blend(x, y, color(x, y), cov * alpha)
      }
    }
  }
  const drawRoundRectRing = (cx: number, cy: number, hw: number, hh: number, rad: number, width: number, rgb: Rgb, alpha: number) => {
    const pad = 3
    for (let y = Math.floor(cy - hh - pad); y <= Math.ceil(cy + hh + pad); y += 1) {
      for (let x = Math.floor(cx - hw - pad); x <= Math.ceil(cx + hw + pad); x += 1) {
        const outer = roundRectCoverage(x + 0.5, y + 0.5, cx, cy, hw, hh, rad)
        const inner = roundRectCoverage(x + 0.5, y + 0.5, cx, cy, hw - width, hh - width, Math.max(1, rad - width))
        const cov = outer - inner
        if (cov > 0) blend(x, y, rgb, cov * alpha)
      }
    }
  }
  const flat = (rgb: Rgb) => () => rgb
  const drawDisc = (cx: number, cy: number, radius: number, rgb: Rgb, alpha: number) => {
    for (let y = Math.floor(cy - radius - 2); y <= Math.ceil(cy + radius + 2); y += 1) {
      for (let x = Math.floor(cx - radius - 2); x <= Math.ceil(cx + radius + 2); x += 1) {
        const cov = Math.min(1, Math.max(0, radius - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5))
        if (cov > 0) blend(x, y, rgb, cov * alpha)
      }
    }
  }

  if (layout.logo && layout.logoPlate) {
    const box = layout.logo
    drawRoundRect((box.x + box.w / 2) * k, (box.y + box.h / 2) * k, (box.w / 2 + 28) * k, (box.h / 2 + 8) * k, 36 * k, flat([246, 248, 252]), 0.96)
  }

  for (const mark of layout.marks) {
    const apothem = mark.r * 0.8660254 * k
    const px = mark.cx * k
    const py = mark.cy * k
    const span = Math.ceil(mark.r * k + 4)
    for (let y = Math.floor(py - span); y <= Math.ceil(py + span); y += 1) {
      for (let x = Math.floor(px - span); x <= Math.ceil(px + span); x += 1) {
        const outer = hexCoverage(x + 0.5, y + 0.5, px, py, apothem)
        if (outer <= 0) continue
        const inner = hexCoverage(x + 0.5, y + 0.5, px, py, apothem - 14 * k)
        const tt = Math.min(1, Math.max(0, ((x - (px - span)) + (y - (py - span))) / (span * 4)))
        const edge: Rgb = [mix(Math.min(255, accent[0] + 70), accent[0], tt), mix(Math.min(255, accent[1] + 70), accent[1], tt), mix(Math.min(255, accent[2] + 70), accent[2], tt)]
        blend(x, y, edge, outer)
        if (inner > 0) blend(x, y, [7, 18, 48], inner * 0.96)
      }
    }
  }

  if (layout.rule) {
    drawRoundRect(layout.rule.cx * k, (layout.rule.y + 2.5) * k, (layout.rule.w / 2) * k, 2.5 * k, 2.5 * k, flat(accent), 0.95)
  }

  if (layout.hero) {
    const box = layout.hero
    drawRoundRect((box.x + box.w / 2) * k, (box.y + box.h / 2) * k, (box.w / 2 + 8) * k, (box.h / 2 + 8) * k, 10 * k, flat(accent), 0.9)
  }

  for (const pill of layout.pills) {
    const cx = pill.cx * k
    const cy = pill.cy * k
    const hw = (pill.w / 2) * k
    const hh = (pill.h / 2) * k
    drawRoundRect(cx, cy, hw, hh, hh, flat([255, 255, 255]), 0.07)
    drawRoundRectRing(cx, cy, hw, hh, hh, Math.max(1, 1.8 * k), accent, 0.6)
    drawDisc(cx - hw + 34 * k, cy, 7 * k, accent, 1)
  }

  const cta = layout.cta
  if (cta) {
    const ctaCx = cta.cx * k
    const ctaCy = (cta.y + cta.h / 2) * k
    for (let layer = 3; layer >= 1; layer -= 1) {
      drawRoundRect(ctaCx, ctaCy + 4 * k, (cta.w / 2 + layer * 8) * k, (cta.h / 2 + layer * 8) * k, (cta.h / 2 + layer * 8) * k, flat(accent), 0.05)
    }
    const ctaLeft = ctaCx - (cta.w / 2) * k
    drawRoundRect(ctaCx, ctaCy, (cta.w / 2) * k, (cta.h / 2) * k, (cta.h / 2) * k, (x) => {
      const tt = Math.min(1, Math.max(0, (x - ctaLeft) / (cta.w * k)))
      return [mix(accent[0], Math.min(255, accent[0] + 55), tt), mix(accent[1], Math.min(255, accent[1] + 55), tt), mix(accent[2], Math.min(255, accent[2] + 55), tt)]
    }, 1)
  }

  if (layout.dots) {
    const { cx, y, count, active } = layout.dots
    const step = 36
    const start = cx - ((count - 1) * step) / 2
    for (let i = 0; i < count; i += 1) {
      const dx = (start + i * step) * k
      if (i === active) drawRoundRect(dx, y * k, 15 * k, 7 * k, 7 * k, flat(accent), 1)
      else drawDisc(dx, y * k, 6.5 * k, [255, 255, 255], 0.35)
    }
  }

  const rows = Buffer.alloc((1 + w * 3) * h)
  for (let y = 0; y < h; y += 1) {
    const rowStart = y * (1 + w * 3)
    rows[rowStart] = 0
    for (let x = 0; x < w * 3; x += 1) rows[rowStart + 1 + x] = clamp(raw[y * w * 3 + x]!)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/** @deprecated Use buildLocalMarketingPng — old name kept for callers. */
export function buildLocalScenePng(seed = 'local-scene', size = 640): Buffer {
  return buildLocalMarketingPng({ seed, size })
}

/** @deprecated Use buildLocalMarketingPng. */
export function buildFakePreviewPng(size = 640): Buffer {
  return buildLocalMarketingPng({ seed: 'legacy-fake-preview', size })
}

/** True when a decoded RGB sample looks like the old hills/sun cartoon (green ground + warm sky). */
export function looksLikeCartoonLandscape(bytes: Buffer): boolean {
  if (!isDisplayableImage(bytes, 'image/png') || bytes.length < 100) return false
  try {
    const size = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (size < 32 || size > 2048 || height < 32 || height > 4096) return false
    let offset = 8
    let idat: Buffer | null = null
    while (offset + 8 <= bytes.length) {
      const len = bytes.readUInt32BE(offset)
      const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
      const data = bytes.subarray(offset + 8, offset + 8 + len)
      if (type === 'IDAT') idat = idat ? Buffer.concat([idat, data]) : data
      offset += 12 + len
      if (type === 'IEND') break
    }
    if (!idat) return false
    const raw = inflateSync(idat)
    const rowBytes = 1 + size * 3
    if (raw.length < rowBytes * height) return false
    const skyY = Math.floor(height * 0.2)
    const groundY = Math.floor(height * 0.85)
    const midX = Math.floor(size * 0.5) * 3 + 1
    const sky = raw.subarray(skyY * rowBytes + midX, skyY * rowBytes + midX + 3)
    const ground = raw.subarray(groundY * rowBytes + midX, groundY * rowBytes + midX + 3)
    const skyWarm = sky[0]! > 180 && sky[1]! > 150 && sky[2]! < 200
    const groundGreen = ground[1]! > ground[0]! + 30 && ground[1]! > ground[2]! + 20 && ground[1]! > 80
    return skyWarm && groundGreen
  } catch {
    return false
  }
}

export function sniffImageMime(bytes: Buffer): string {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  return 'image/png'
}

export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
    const errors: Buffer[] = []
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(Buffer.concat(errors).toString('utf8').trim() || 'ffmpeg failed'))
    })
  })
}

function ffmpegRawRgba(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('ffmpeg failed'))))
  })
}

/** True when the visible pixels of the logo are dark, so it needs a light plate on navy. */
async function logoNeedsPlate(logoPath: string): Promise<boolean> {
  try {
    const rgba = await ffmpegRawRgba([
      '-i', logoPath, '-vf', 'scale=32:32:flags=neighbor,format=rgba', '-frames:v', '1', '-f', 'rawvideo', '-',
    ])
    let weight = 0
    let sum = 0
    for (let i = 0; i + 3 < rgba.length; i += 4) {
      const a = rgba[i + 3]! / 255
      if (a < 0.25) continue
      weight += a
      sum += a * luminance([rgba[i]!, rgba[i + 1]!, rgba[i + 2]!])
    }
    return weight > 0 && sum / weight < 0.3
  } catch {
    return false
  }
}

/**
 * Finished local brand poster: navy gradient, large logo (or brand emblem + wordmark),
 * headline, service chips and a CTA bar, composed with ffmpeg text overlays. Also renders
 * carousel slides, story frames and video scenes from the same look.
 */
export async function renderLocalMarketingPoster(input: LocalPosterInput): Promise<Buffer> {
  const size = input.size ?? 1080
  const k = size / UNIT
  const dir = await mkdtemp(path.join(tmpdir(), 'local-poster-'))
  let base: Buffer | null = null
  try {
    const logoPath = path.join(dir, 'logo.img')
    const hasLogo = Boolean(input.logo?.length)
    if (hasLogo && input.logo) await writeFile(logoPath, input.logo)
    const logoPlate = hasLogo ? await logoNeedsPlate(logoPath) : false
    const opts: LocalPosterInput = { ...input, size, logoPlate }
    base = buildLocalMarketingPng(opts)
    const layout = computePosterLayout(opts)

    const textFiles: string[] = []
    const filters: string[] = []
    for (const item of layout.texts) {
      const file = path.join(dir, `t${textFiles.length}.txt`)
      textFiles.push(file)
      await writeFile(file, item.text)
      const font = item.bold ? BOLD : REGULAR
      const shadow = item.shadow ? ':shadowcolor=0x00000066:shadowx=0:shadowy=3' : ''
      filters.push(`drawtext=fontfile=${font}:textfile=${file}:fontsize=${Math.max(8, Math.round(item.size * k))}:fontcolor=${item.color}:x=${Math.round(item.cx * k)}-text_w/2:y=${Math.round(item.y * k)}${shadow}`)
    }
    const bg = path.join(dir, 'bg.png')
    const out = path.join(dir, 'out.png')
    await writeFile(bg, base)
    const chain = filters.length ? filters.join(',') : 'null'

    const args = ['-y', '-i', bg]
    const graph: string[] = [`[0:v]${chain}[t0]`]
    let last = 't0'
    let inputIndex = 1
    if (layout.logo && hasLogo) {
      const box = layout.logo
      const bw = Math.round(box.w * k)
      const bh = Math.round(box.h * k)
      args.push('-i', logoPath)
      graph.push(`[${inputIndex}:v]scale=${bw}:${bh}:force_original_aspect_ratio=decrease[lg]`)
      graph.push(`[${last}][lg]overlay=${Math.round(box.x * k)}+(${bw}-w)/2:${Math.round(box.y * k)}+(${bh}-h)/2:format=auto[t1]`)
      last = 't1'
      inputIndex += 1
    }
    if (layout.hero && input.hero?.length) {
      const box = layout.hero
      const heroPath = path.join(dir, 'hero.img')
      await writeFile(heroPath, input.hero)
      const bw = Math.round(box.w * k)
      const bh = Math.round(box.h * k)
      args.push('-i', heroPath)
      graph.push(`[${inputIndex}:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh}[hr]`)
      graph.push(`[${last}][hr]overlay=${Math.round(box.x * k)}:${Math.round(box.y * k)}:format=auto[t2]`)
      last = 't2'
      inputIndex += 1
    }
    args.push('-filter_complex', graph.join(';'), '-map', `[${last}]`, '-frames:v', '1', out)
    await runFfmpeg(args)
    return await readFile(out)
  } catch {
    if (input.hero?.length) return renderLocalMarketingPoster({ ...input, hero: null })
    if (input.logo?.length) return renderLocalMarketingPoster({ ...input, logo: null })
    return base ?? buildLocalMarketingPng({ ...input, size })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
