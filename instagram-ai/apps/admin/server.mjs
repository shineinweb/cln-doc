import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000'
const port = Number(process.env.PORT ?? 5174)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')

export function shouldProxy(url) {
  const pathname = url.split('?')[0]
  return pathname.startsWith('/api') || pathname.startsWith('/media')
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/'
  if (shouldProxy(url)) {
    const target = new URL(url, API)
    const headers = { ...req.headers, host: target.host }
    const proxyReq = http.request(target, { method: req.method, headers }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', () => {
      res.writeHead(502)
      res.end('API unavailable')
    })
    req.pipe(proxyReq)
    return
  }
  const pathname = decodeURIComponent(url.split('?')[0])
  const filePath = path.join(dist, pathname === '/' ? 'index.html' : pathname)
  const safe = filePath.startsWith(dist) && fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(dist, 'index.html')
  const ext = path.extname(safe)
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' })
  fs.createReadStream(safe).pipe(res)
})

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(port)
}
