import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PostMedia } from '../lib/types'

export type Job = { id: string; status: string; error: string | null; createdAt?: string } | null
export type PreviewFormat = 'photo' | 'carousel' | 'reel' | 'video' | 'story'

export function emptyPreviewMessage(format: PreviewFormat): string {
  if (format === 'carousel') return 'Generate to see the carousel'
  if (format === 'reel') return 'Generate to see the reel'
  if (format === 'video') return 'Generate to see the video'
  if (format === 'story') return 'Generate to see the story'
  return 'Generate to see the photo'
}

function busyMessage(format: PreviewFormat): string {
  if (format === 'carousel') return 'Designing your carousel slides…'
  if (format === 'story') return 'Designing your story…'
  return 'Generating…'
}

export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

function useElapsed(active: boolean, key: string | undefined): number {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    setSeconds(0)
    if (!active) return
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [active, key])
  return seconds
}

function RenderProgress({ format, job, seconds }: { format: PreviewFormat; job: NonNullable<Job>; seconds: number }) {
  const noun = format === 'reel' ? 'reel' : 'video'
  const queued = job.status === 'queued'
  return (
    <div className="phone-progress" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <strong>{queued ? `Your ${noun} is queued` : `Rendering your ${noun}`}</strong>
      <span className="progress-bar" aria-hidden="true"><i /></span>
      <small>{queued ? 'Waiting for a free slot' : 'Designing the scenes and adding the voiceover'} · {clock(seconds)}</small>
      <small>{seconds > 120 ? 'Still working. A generated video can take a few minutes.' : 'The preview appears here when the file is ready.'}</small>
    </div>
  )
}

function Carousel({ items, onVideoError }: { items: PostMedia[]; onVideoError: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const key = items.map((item) => item.id).join(',')

  useEffect(() => {
    setActive(0)
    track.current?.scrollTo({ left: 0 })
  }, [key])

  function go(index: number) {
    const el = track.current
    if (!el) return
    const next = Math.min(items.length - 1, Math.max(0, index))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    setActive(next)
  }

  return (
    <div className="carousel-view">
      <div
        className="carousel-track"
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget
          if (el.clientWidth) setActive(Math.min(items.length - 1, Math.round(el.scrollLeft / el.clientWidth)))
        }}
      >
        {items.map((item, index) => (
          <div className="carousel-slide" key={item.id} role="group" aria-label={`Slide ${index + 1} of ${items.length}`}>
            {item.mimeType.startsWith('video/')
              ? <video src={item.url} controls playsInline onError={() => onVideoError(item.id)} />
              : <img src={item.url} alt={`Slide ${index + 1}`} />}
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <>
          <span className="carousel-count">{active + 1}/{items.length}</span>
          {active > 0 ? <button type="button" className="carousel-nav prev" aria-label="Previous slide" onClick={() => go(active - 1)}>‹</button> : null}
          {active < items.length - 1 ? <button type="button" className="carousel-nav next" aria-label="Next slide" onClick={() => go(active + 1)}>›</button> : null}
          <div className="carousel-dots">
            {items.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={index === active ? 'dot active' : 'dot'}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === active}
                onClick={() => go(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function CreatePhonePreview({
  format,
  media,
  caption,
  job,
  busy,
}: {
  format: PreviewFormat
  media: PostMedia[]
  caption: string
  job: Job
  busy: boolean
}) {
  const mediaKey = useMemo(() => media.map((item) => item.id).join(','), [media])
  const [rejected, setRejected] = useState<Record<string, true>>({})
  const [accepted, setAccepted] = useState<Record<string, true>>({})

  useEffect(() => {
    setRejected({})
    setAccepted({})
  }, [mediaKey])

  const ordered = [...media].sort((a, b) => a.position - b.position)
  const usable = ordered.filter((item) => !rejected[item.id])
  const pendingImages = usable.filter((item) => !item.mimeType.startsWith('video/') && !accepted[item.id])
  const playable = usable.filter((item) => item.mimeType.startsWith('video/') || accepted[item.id])
  const shown = format === 'carousel' ? playable : playable.slice(0, 1)
  const hasMedia = shown.length > 0
  const motion = format === 'reel' || format === 'video'
  const jobActive = Boolean(job && (job.status === 'queued' || job.status === 'running'))
  const jobFailed = Boolean(job && job.status === 'failed')
  const pendingMotion = motion && jobActive && !hasMedia
  const generating = (busy || jobActive) && !hasMedia && !jobFailed
  const waiting = pendingImages.length > 0 && !hasMedia
  const failed = jobFailed && !hasMedia
  const unplayable = !hasMedia && ordered.length > 0 && usable.length === 0
  const elapsed = useElapsed(motion && jobActive, job?.id)
  const framed = format !== 'photo'

  const rejectVideo = (id: string) => setRejected((current) => ({ ...current, [id]: true }))

  let body: ReactNode
  if (hasMedia && format === 'carousel') {
    body = <Carousel items={shown} onVideoError={rejectVideo} />
  } else if (hasMedia) {
    body = (
      <div className={framed ? 'phone-media framed' : 'phone-media'}>
        {shown.map((item) => (
          item.mimeType.startsWith('video/')
            ? (
              <video
                key={item.id}
                src={item.url}
                controls
                playsInline
                preload="metadata"
                onError={() => rejectVideo(item.id)}
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget
                  if (video.videoWidth < 8 || video.videoHeight < 8) rejectVideo(item.id)
                }}
              />
            )
            : <img key={item.id} src={item.url} alt="" />
        ))}
      </div>
    )
  } else if (pendingMotion && job) {
    body = <RenderProgress format={format} job={job} seconds={elapsed} />
  } else if (generating || waiting) {
    body = (
      <p className="phone-empty" role="status">
        {framed && !waiting ? <span className="spinner" aria-hidden="true" /> : null}
        <span>{waiting ? 'Loading preview…' : busyMessage(format)}</span>
      </p>
    )
  } else if (failed) {
    body = (
      <p className="phone-empty failed" role="alert">
        <strong>Generation did not finish</strong>
        <span>{job?.error || 'Something went wrong. Try again.'}</span>
      </p>
    )
  } else if (unplayable) {
    body = (
      <p className="phone-empty failed" role="alert">
        <strong>This file cannot be previewed</strong>
        <span>The browser could not play it. Press Generate to render it again.</span>
      </p>
    )
  } else {
    body = <p className="phone-empty">{emptyPreviewMessage(format)}</p>
  }

  const phoneClass = format === 'video' ? 'phone wide' : format === 'story' || format === 'reel' ? 'phone tall' : 'phone'
  const frameClass = framed ? `frame ratio-${format}${hasMedia ? ' has-media' : ''}` : ''

  return (
    <div className={phoneClass}>
      {/* Probe images off-screen so a 1×1 red fixture never paints in the phone. */}
      {pendingImages.map((item) => (
        <img
          key={`probe-${item.id}`}
          src={item.url}
          alt=""
          hidden
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalWidth < 8 || image.naturalHeight < 8) {
              setRejected((current) => ({ ...current, [item.id]: true }))
            } else {
              setAccepted((current) => ({ ...current, [item.id]: true }))
            }
          }}
          onError={() => setRejected((current) => ({ ...current, [item.id]: true }))}
        />
      ))}
      {framed ? <div className={frameClass}>{body}</div> : body}
      <p className="caption">{caption || 'Caption'}</p>
    </div>
  )
}
