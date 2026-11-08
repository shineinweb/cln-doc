export type ProviderFlags = {
  openaiKeySet: boolean
  runwayKeySet: boolean
  videoProviderUrlSet: boolean
  openaiEnabled?: boolean
  runwayEnabled?: boolean
  videoProviderUrlEnabled?: boolean
  status?: { openai: string; runway: string; videoProvider: string }
}

export type ProviderToggleField = 'openaiEnabled' | 'runwayEnabled' | 'videoProviderUrlEnabled'

export const PROVIDER_TOGGLES: Array<{
  field: ProviderToggleField
  label: string
  name: string
  help: string
}> = [
  {
    field: 'openaiEnabled',
    label: 'Use OpenAI',
    name: 'OpenAI',
    help: 'Off keeps the stored key but stops image, voice, and text requests to OpenAI. The built-in fallbacks are used instead.',
  },
  {
    field: 'runwayEnabled',
    label: 'Use Runway',
    name: 'Runway',
    help: 'Off keeps the stored key but skips Runway when a video is made.',
  },
  {
    field: 'videoProviderUrlEnabled',
    label: 'Use the video provider URL',
    name: 'The video provider',
    help: 'Off keeps the stored URL but skips the custom video provider.',
  },
]

export function isOn(flags: ProviderFlags | null, field: ProviderToggleField): boolean {
  return flags?.[field] !== false
}

export function providerStatusLine(flags: ProviderFlags | null): string {
  const state = (field: ProviderToggleField) => (isOn(flags, field) ? 'on' : 'off')
  const set = (value: boolean | undefined) => (value ? 'set' : 'not set')
  if (flags?.status) return `${flags.status.openai}. ${flags.status.runway}. ${flags.status.videoProvider}.`
  return [
    `OpenAI key: ${set(flags?.openaiKeySet)}, ${state('openaiEnabled')}`,
    `Runway key: ${set(flags?.runwayKeySet)}, ${state('runwayEnabled')}`,
    `Video provider URL: ${set(flags?.videoProviderUrlSet)}, ${state('videoProviderUrlEnabled')}`,
  ].join('. ') + '.'
}

export function toggleNotice(name: string, enabled: boolean): string {
  return enabled
    ? `${name} is on.`
    : `${name} is off. The stored key or URL is kept.`
}
