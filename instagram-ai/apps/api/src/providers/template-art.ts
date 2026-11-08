import { deflateSync } from 'node:zlib'

export const ART_STYLES = ['mesh', 'sunburst', 'waves', 'bokeh', 'stripes'] as const
export type ArtStyle = (typeof ART_STYLES)[number]

type Rgb = [number, number, number]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, tail])
}

function encodePng(rgb: Uint8Array, w: number, h: number): Buffer {
  const stride = w * 3
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y += 1) {
    raw[y * (stride + 1)] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function hashSeed(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function prng(seed: number): () => number {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function parseHex(value: string | null | undefined): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec((value ?? '').trim())
  if (!match) return [224, 69, 123]
  const n = parseInt(match[1] as string, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h / 6, s, l]
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const hue = ((h % 1) + 1) % 1
  const f = (n: number) => {
    const k = (n + hue * 12) % 12
    const a = s * Math.min(l, 1 - l)
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function palette(accent: string | null | undefined): { deep: Rgb; mid: Rgb; bright: Rgb; warm: Rgb } {
  const [h, s] = toHsl(parseHex(accent))
  const sat = Math.max(0.7, s)
  return {
    deep: fromHsl(h + 0.02, 0.6, 0.08),
    mid: fromHsl(h - 0.04, 0.65, 0.26),
    bright: fromHsl(h, Math.min(1, sat + 0.1), 0.56),
    warm: fromHsl(h + 0.08, 0.92, 0.64),
  }
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t))
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

export type ArtOptions = { style: ArtStyle; accent?: string | null; seed: string; width?: number; height?: number }

/** Abstract hero artwork drawn in pure code, so templates never need an external download. */
export function renderTemplateArt(options: ArtOptions): Buffer {
  const w = options.width ?? 1200
  const h = options.height ?? 560
  const rand = prng(hashSeed(options.seed))
  const pal = palette(options.accent)
  const px = new Uint8Array(w * h * 3)
  const put = (i: number, c: Rgb) => {
    px[i] = Math.max(0, Math.min(255, c[0]))
    px[i + 1] = Math.max(0, Math.min(255, c[1]))
    px[i + 2] = Math.max(0, Math.min(255, c[2]))
  }
  const base = (x: number, y: number): Rgb => mixRgb(pal.deep, pal.mid, (x / w) * 0.6 + (y / h) * 0.4)

  if (options.style === 'mesh') {
    const blobs = [pal.bright, pal.warm, pal.mid, pal.bright].map((color) => ({
      color,
      x: rand() * w,
      y: rand() * h,
      r: (0.35 + rand() * 0.3) * Math.max(w, h),
    }))
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let c = base(x, y)
        for (const blob of blobs) {
          const d = Math.hypot(x - blob.x, y - blob.y) / blob.r
          c = mixRgb(c, blob.color, Math.exp(-d * d * 2.2) * 0.85)
        }
        put((y * w + x) * 3, c)
      }
    }
  } else if (options.style === 'sunburst') {
    const cx = w * (0.4 + rand() * 0.2)
    const cy = h * (0.55 + rand() * 0.2)
    const rays = 14 + Math.floor(rand() * 10)
    const phase = rand() * Math.PI * 2
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const angle = Math.atan2(y - cy, x - cx)
        const dist = Math.hypot(x - cx, y - cy) / Math.max(w, h)
        const ray = 0.5 + 0.5 * Math.sin(angle * rays + phase)
        let c = base(x, y)
        c = mixRgb(c, pal.bright, ray * 0.35 * Math.exp(-dist * 1.4))
        c = mixRgb(c, pal.warm, Math.exp(-dist * dist * 40) * 0.9)
        put((y * w + x) * 3, c)
      }
    }
  } else if (options.style === 'waves') {
    const bands = 5
    const params = Array.from({ length: bands }, (_, i) => ({
      amp: 20 + rand() * 50,
      freq: 0.004 + rand() * 0.006,
      phase: rand() * Math.PI * 2,
      y: (h * (i + 0.6)) / bands,
      color: i % 2 ? pal.bright : pal.warm,
    }))
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let c = base(x, y)
        for (const band of params) {
          const edge = band.y + Math.sin(x * band.freq + band.phase) * band.amp
          const t = (y - edge) / 90
          if (t > 0) c = mixRgb(c, band.color, Math.min(0.45, t * 0.45))
        }
        put((y * w + x) * 3, c)
      }
    }
  } else if (options.style === 'bokeh') {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) put((y * w + x) * 3, base(x, y))
    const dots = Array.from({ length: 34 }, () => ({
      x: rand() * w,
      y: rand() * h,
      r: 20 + rand() * 90,
      a: 0.12 + rand() * 0.3,
      color: rand() > 0.5 ? pal.bright : pal.warm,
    }))
    for (const dot of dots) {
      const x0 = Math.max(0, Math.floor(dot.x - dot.r))
      const x1 = Math.min(w - 1, Math.ceil(dot.x + dot.r))
      const y0 = Math.max(0, Math.floor(dot.y - dot.r))
      const y1 = Math.min(h - 1, Math.ceil(dot.y + dot.r))
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const d = Math.hypot(x - dot.x, y - dot.y) / dot.r
          if (d > 1) continue
          const ring = d > 0.86 ? 1.5 : 1
          const i = (y * w + x) * 3
          const cur: Rgb = [px[i] as number, px[i + 1] as number, px[i + 2] as number]
          put(i, mixRgb(cur, dot.color, dot.a * ring * (1 - d * 0.5)))
        }
      }
    }
  } else {
    const slope = 0.4 + rand() * 0.5
    const gap = 70 + rand() * 50
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const t = ((x + y * slope) % gap) / gap
        const stripe = t < 0.5 ? Math.sin(t * Math.PI * 2) : 0
        let c = base(x, y)
        c = mixRgb(c, pal.bright, stripe * 0.4 * (0.4 + 0.6 * (x / w)))
        c = mixRgb(c, pal.warm, Math.exp(-(((x - w * 0.8) ** 2 + (y - h * 0.3) ** 2) / (w * w * 0.05))) * 0.6)
        put((y * w + x) * 3, c)
      }
    }
  }
  return encodePng(px, w, h)
}
