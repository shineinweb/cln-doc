import Busboy from 'busboy'
import type { Request } from 'express'
import { ApiError } from './errors'

export async function readUpload(req: Request): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      reject(new ApiError(400, 'validation', 'Upload a multipart file'))
      return
    }
    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 25 * 1024 * 1024 } })
    const chunks: Buffer[] = []
    let file: { filename: string; mimeType: string } | undefined
    let tooBig = false
    busboy.on('file', (_name, stream, info) => {
      file = { filename: info.filename || 'upload', mimeType: info.mimeType || 'application/octet-stream' }
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('limit', () => {
        tooBig = true
      })
    })
    busboy.on('error', reject)
    busboy.on('finish', () => {
      if (tooBig) {
        reject(new ApiError(413, 'validation', 'File is too large'))
        return
      }
      if (!file) {
        reject(new ApiError(400, 'validation', 'Choose a file'))
        return
      }
      resolve({ buffer: Buffer.concat(chunks), filename: file.filename, mimeType: file.mimeType })
    })
    req.pipe(busboy)
  })
}

export function extensionFor(mimeType: string, filename: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'video/mp4') return 'mp4'
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : 'bin'
}
