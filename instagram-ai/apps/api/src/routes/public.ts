import { sitemapXml, type PublicPageRecord } from '@instagram-ai/shared'
import { Router } from 'express'
import type { Deps } from '../deps'
import { asyncRoute } from '../http'
import { loadSettings, registrationOpen } from '../settings'
import { PACKAGE_SEED } from '../seed'

export function publicRoutes(deps: Deps): Router {
  const router = Router()

  router.get('/api/health', asyncRoute(async (_req, res) => {
    let db = false
    try {
      await deps.prisma.$queryRaw`SELECT 1`
      db = true
    } catch {
      db = false
    }
    const { pingRedis } = await import('../queues')
    const redis = await pingRedis(deps.env.REDIS_URL)
    res.status(db ? 200 : 503).json({ ok: db, db, redis })
  }))

  router.get('/api/public/config', asyncRoute(async (_req, res) => {
    const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
    res.json({
      productName: settings.general.productName,
      logo: settings.general.logo,
      supportEmail: settings.general.supportEmail,
      publicSiteUrl: settings.general.publicSiteUrl,
      maintenanceMessage: settings.general.maintenanceMessage,
      registrationOpen: registrationOpen(settings),
      canonicalHost: settings.seo.canonicalHost,
      titleTemplate: settings.seo.titleTemplate,
      siteDescription: settings.seo.siteDescription,
    })
  }))

  router.get('/api/public/pricing', asyncRoute(async (_req, res) => {
    const packages = await deps.prisma.package.findMany({ orderBy: { sortOrder: 'asc' } })
    res.json({
      packages: (packages.length ? packages : PACKAGE_SEED).map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        priceMinor: pkg.priceMinor,
        currency: pkg.currency,
        instagramAccounts: pkg.instagramAccounts,
        seats: pkg.seats,
        monthlyAiGenerations: pkg.monthlyAiGenerations,
        monthlyImageGenerations: pkg.monthlyImageGenerations,
        monthlyVideoGenerations: pkg.monthlyVideoGenerations,
        scheduling: pkg.scheduling,
        commentInbox: pkg.commentInbox,
        dmInbox: pkg.dmInbox,
        automation: pkg.automation,
        customAi: pkg.customAi,
        videoGeneration: pkg.videoGeneration,
      })),
    })
  }))

  router.get('/api/public/pages', asyncRoute(async (req, res) => {
    const path = typeof req.query.path === 'string' ? req.query.path : undefined
    const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
    const pages = await deps.prisma.publicPage.findMany({ orderBy: { path: 'asc' } })
    const withBody = pages.map((page) => ({
      ...page,
      body: page.path === '/privacy' ? settings.legal.privacy : page.path === '/terms' ? settings.legal.terms : page.path === '/data-deletion' ? settings.legal.dataDeletion : '',
    }))
    res.json({ pages: path ? withBody.filter((page) => page.path === path) : withBody })
  }))

  router.get('/api/public/redirects', asyncRoute(async (_req, res) => {
    const redirects = await deps.prisma.seoRedirect.findMany()
    res.json({ redirects })
  }))

  router.get('/robots.txt', asyncRoute(async (_req, res) => {
    const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
    const sitemap = `Sitemap: ${settings.seo.canonicalHost.replace(/\/$/, '')}/sitemap.xml\n`
    const body = settings.robots.includes('Sitemap:') ? settings.robots : `${settings.robots.trim()}\n${sitemap}`
    res.type('text/plain').send(body.endsWith('\n') ? body : `${body}\n`)
  }))

  router.get('/sitemap.xml', asyncRoute(async (_req, res) => {
    const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
    const pages = await deps.prisma.publicPage.findMany()
    const records: PublicPageRecord[] = pages.map((page) => ({
      path: page.path,
      title: page.title,
      description: page.description,
      ogTitle: page.ogTitle,
      ogDescription: page.ogDescription,
      ogImage: page.ogImage,
      indexed: page.indexed,
      inSitemap: page.inSitemap,
    }))
    res.type('application/xml').send(sitemapXml(settings.seo.canonicalHost, records))
  }))

  router.get('/media/:key', asyncRoute(async (req, res) => {
    const file = await deps.storage.read(req.params.key)
    if (!file) {
      res.status(404).end()
      return
    }
    res.setHeader('content-type', file.mimeType)
    res.setHeader('cache-control', 'public, max-age=3600')
    res.send(file.bytes)
  }))

  return router
}
