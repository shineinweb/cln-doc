import type { MediaAsset } from '@prisma/client'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { audit } from '../audit'
import { isDisplayableImage } from '../providers/poster'
import { FACE_OFF_NOTICE } from '../settings'
import type { CustomerContext } from './context'

export const FACE_RETENTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const FACE_IMAGE_KINDS = ['face', 'upload', 'reference', 'generated_image']

export function assertFaceFeature(ctx: CustomerContext): void {
  if (!ctx.settings.features.facePersonalization) throw new ApiError(403, 'feature_disabled', FACE_OFF_NOTICE)
}

export function presentFace(deps: Deps, asset: MediaAsset, deleteAfter: Date | null) {
  return {
    id: asset.id,
    url: deps.storage.url(asset.storageKey),
    filename: asset.filename,
    createdAt: asset.createdAt,
    deleteAfter,
  }
}

export async function storeFacePhoto(
  deps: Deps,
  ctx: CustomerContext,
  file: { buffer: Buffer; filename: string; mimeType: string },
  now = new Date(),
) {
  assertFaceFeature(ctx)
  const ext = file.mimeType === 'image/jpeg' ? 'jpg' : file.mimeType === 'image/webp' ? 'webp' : 'png'
  const storageKey = await deps.storage.put(file.buffer, ext)
  const asset = await deps.prisma.mediaAsset.create({
    data: { organizationId: ctx.organization.id, kind: 'face', storageKey, mimeType: file.mimeType, filename: file.filename },
  })
  const deleteAfter = new Date(now.getTime() + FACE_RETENTION_DAYS * DAY_MS)
  await deps.prisma.faceConsent.create({
    data: { organizationId: ctx.organization.id, userId: ctx.user.id, mediaAssetId: asset.id, acceptedAt: now, deleteAfter },
  })
  await audit(deps.prisma, {
    organizationId: ctx.organization.id,
    actorType: 'user',
    actorId: ctx.user.id,
    action: 'face.consent',
    targetType: 'media',
    targetId: asset.id,
    metadata: { deleteAfter: deleteAfter.toISOString(), source: 'upload' },
  })
  return presentFace(deps, asset, deleteAfter)
}

export async function listFacePhotos(deps: Deps, ctx: CustomerContext) {
  await sweepFacePhotos(deps)
  const assets = await deps.prisma.mediaAsset.findMany({
    where: { organizationId: ctx.organization.id, kind: 'face' },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  const consents = await deps.prisma.faceConsent.findMany({
    where: { organizationId: ctx.organization.id, mediaAssetId: { in: assets.map((asset) => asset.id) }, deletedAt: null },
  })
  const due = new Map(consents.map((row) => [row.mediaAssetId, row.deleteAfter]))
  return assets.map((asset) => presentFace(deps, asset, due.get(asset.id) ?? null))
}

async function eraseFace(deps: Deps, asset: MediaAsset, reason: 'requested' | 'expired', actor: { id: string; organizationId: string }): Promise<void> {
  await deps.prisma.$transaction(async (tx) => {
    await tx.postMedia.deleteMany({ where: { mediaAssetId: asset.id } })
    await tx.faceConsent.updateMany({ where: { mediaAssetId: asset.id, deletedAt: null }, data: { deletedAt: new Date() } })
    await tx.mediaAsset.deleteMany({ where: { id: asset.id } })
  })
  await deps.storage.remove(asset.storageKey)
  await audit(deps.prisma, {
    organizationId: actor.organizationId,
    actorType: reason === 'expired' ? 'system' : 'user',
    actorId: reason === 'expired' ? null : actor.id,
    action: reason === 'expired' ? 'face.expired' : 'face.deleted',
    targetType: 'media',
    targetId: asset.id,
  })
}

export async function deleteFacePhoto(deps: Deps, ctx: CustomerContext, id: string): Promise<void> {
  const asset = await deps.prisma.mediaAsset.findFirst({ where: { id, organizationId: ctx.organization.id, kind: 'face' } })
  if (!asset) throw notFound('Face photo not found')
  await eraseFace(deps, asset, 'requested', { id: ctx.user.id, organizationId: ctx.organization.id })
}

/** Deletes every face upload whose 30 days are over, and keeps the consent row as the record. */
export async function sweepFacePhotos(deps: Deps, now = new Date()): Promise<number> {
  const due = await deps.prisma.faceConsent.findMany({
    where: { deletedAt: null, deleteAfter: { lte: now } },
    take: 200,
  })
  let removed = 0
  for (const consent of due) {
    const asset = await deps.prisma.mediaAsset.findFirst({ where: { id: consent.mediaAssetId, kind: 'face' } })
    if (asset) {
      await eraseFace(deps, asset, 'expired', { id: consent.userId, organizationId: consent.organizationId })
      removed += 1
    } else {
      await deps.prisma.faceConsent.update({ where: { id: consent.id }, data: { deletedAt: now } })
    }
  }
  return removed
}

export async function resolveFace(
  deps: Deps,
  ctx: CustomerContext,
  assetId: string,
  consent: boolean | undefined,
): Promise<{ asset: MediaAsset; bytes: Buffer; mimeType: string }> {
  assertFaceFeature(ctx)
  if (consent !== true) {
    throw new ApiError(400, 'consent_required', 'Confirm that this is your face, or that you have the person’s permission')
  }
  const asset = await deps.prisma.mediaAsset.findFirst({
    where: { id: assetId, organizationId: ctx.organization.id, kind: { in: FACE_IMAGE_KINDS } },
  })
  if (!asset) throw notFound('Face photo not found')
  const stored = await deps.prisma.faceConsent.findFirst({ where: { mediaAssetId: asset.id, deletedAt: null } })
  if (asset.kind === 'face' && (!stored || (stored.deleteAfter && stored.deleteAfter.getTime() <= Date.now()))) {
    throw new ApiError(404, 'not_found', 'That face photo was deleted. Upload it again to use it.')
  }
  const file = await deps.storage.read(asset.storageKey)
  if (!file || !isDisplayableImage(file.bytes, asset.mimeType || file.mimeType) || asset.mimeType.startsWith('video/')) {
    throw new ApiError(400, 'validation', 'The face photo must be a PNG, JPEG, or WebP image')
  }
  if (!stored) {
    await deps.prisma.faceConsent.create({
      data: { organizationId: ctx.organization.id, userId: ctx.user.id, mediaAssetId: asset.id, deleteAfter: null },
    })
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'face.consent',
      targetType: 'media',
      targetId: asset.id,
      metadata: { source: 'library' },
    })
  }
  return { asset, bytes: file.bytes, mimeType: asset.mimeType || file.mimeType }
}
